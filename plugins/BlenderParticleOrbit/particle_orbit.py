bl_info = {
    "name": "Particle Orbit",
    "author": "Julian Cui",
    "version": (1, 0, 0),
    "blender": (5, 1, 0),
    "location": "View3D > Sidebar > 粒子环绕",
    "description": "Create editable, looping particle orbits around an object or the 3D cursor",
    "category": "Object",
}

import math

import bpy
from bpy.props import BoolProperty, FloatProperty, FloatVectorProperty, IntProperty, PointerProperty
from mathutils import Matrix, Vector


ORBIT_TAG = "julian_particle_orbit"

# The same limits apply to the creation panel and the generated modifier.
NUMBER_SETTINGS = (
    ("count", "粒子数量", "INT", 640, 1, 10000, "环中实例化的粒子数量"),
    ("radius", "半径", "FLOAT", 3.0, 0.01, 10000.0, "环的中线半径，单位为 Blender 单位"),
    ("band", "环带宽度", "FLOAT", 0.72, 0.0, 10000.0, "径向分布宽度，单位为 Blender 单位"),
    ("height", "上下起伏", "FLOAT", 0.52, 0.0, 10000.0, "沿环轴的起伏范围，单位为 Blender 单位"),
    ("size", "粒子尺寸", "FLOAT", 0.035, 0.001, 100.0, "粒子的基准半径，实际大小随随机种子变化"),
    ("turns", "每轮圈数", "INT", 1, -16, 16, "从环轴正方向观察，正值逆时针，负值顺时针，零为静止"),
    ("frames", "循环帧数", "INT", 120, 2, 100000, "完整循环的帧数，含起始帧"),
    ("seed", "随机种子", "INT", 17, 0, 1000000, "改变粒子初始位置和大小"),
)


class OrbitSettings(bpy.types.PropertyGroup):
    follow: BoolProperty(name="跟随活动对象", default=True)
    fit: BoolProperty(name="按模型尺寸设置半径", default=True)
    tilt: FloatProperty(
        name="倾角", subtype="ANGLE", default=math.radians(14),
        min=-math.pi, max=math.pi, description="环面绕自身 X 轴的倾角",
    )
    color: FloatVectorProperty(
        name="发光颜色", subtype="COLOR", size=3, default=(0.035, 0.62, 1.0),
        min=0.0, max=1.0,
    )
    emission: FloatProperty(name="发光强度", default=4.0, min=0.0, max=100.0)


for key, label, kind, default, minimum, maximum, description in NUMBER_SETTINGS:
    property_type = IntProperty if kind == "INT" else FloatProperty
    OrbitSettings.__annotations__[key] = property_type(
        name=label, default=default, min=minimum, max=maximum, description=description,
    )


def active_target(context):
    active = context.active_object
    if context.scene.particle_orbit.follow and active and active.select_get() and not active.get(ORBIT_TAG):
        return active
    return None


def evaluated_corners(target):
    bounds = [Vector(corner) for corner in target.bound_box]
    if all(corner == Vector((-1, -1, -1)) for corner in bounds):
        return []
    return [target.matrix_world @ corner for corner in bounds]


def fit_placement(context, target, settings):
    if target is None:
        return context.scene.cursor.location.copy(), settings.radius, None

    evaluated = target.evaluated_get(context.evaluated_depsgraph_get())
    matrix = evaluated.matrix_world
    try:
        inverse = matrix.inverted()
    except ValueError as error:
        raise ValueError("活动对象的变换不可逆，请先修正零缩放。") from error

    corners = evaluated_corners(evaluated)
    center = sum(corners, Vector()) / len(corners) if corners else matrix.translation
    radius = settings.radius
    if settings.fit and corners:
        untilt = Matrix.Rotation(-settings.tilt, 3, "X")
        ring_plane = [untilt @ (corner - center) for corner in corners]
        extent = max(math.hypot(point.x, point.y) for point in ring_plane)
        radius = max(0.01, extent * 1.15 + settings.band * 0.5)
    return center, radius, inverse


def build_material(material, settings):
    color = (*settings.color, 1.0)
    material.diffuse_color = color
    tree = material.node_tree
    tree.nodes.clear()
    emission = tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = settings.emission
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (240, 0)
    tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])


def build_nodes(tree, settings, radius, start_frame, material):
    tree.description = "Looping instanced particles with a seeded position and size per index."
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    for key, label, kind, _, minimum, maximum, description in NUMBER_SETTINGS:
        socket_type = "NodeSocketInt" if kind == "INT" else "NodeSocketFloat"
        socket = tree.interface.new_socket(name=label, in_out="INPUT", socket_type=socket_type)
        socket.min_value = minimum
        socket.max_value = maximum
        socket.default_value = radius if key == "radius" else getattr(settings, key)
        socket.description = description
        socket.force_non_field = True

    start = tree.interface.new_socket(name="起始帧", in_out="INPUT", socket_type="NodeSocketInt")
    start.default_value = start_frame
    start.description = "生成时采用场景的起始帧"
    start.force_non_field = True
    surface = tree.interface.new_socket(name="粒子材质", in_out="INPUT", socket_type="NodeSocketMaterial")
    surface.default_value = material

    def node(type_name, label, x, y):
        item = tree.nodes.new(type_name)
        item.label = label
        item.location = (x * 220, y * 210)
        return item

    def feed(source, destination):
        if isinstance(source, bpy.types.NodeSocket):
            tree.links.new(source, destination)
        else:
            destination.default_value = source

    def math_node(operation, label, x, y, left, right=None):
        item = node("ShaderNodeMath", label, x, y)
        item.operation = operation
        feed(left, item.inputs[0])
        if right is not None:
            feed(right, item.inputs[1])
        return item.outputs[0]

    inputs = node("NodeGroupInput", "粒子参数", 0, 1).outputs
    index = node("GeometryNodeInputIndex", "每粒子的索引", 0, -2).outputs[0]

    def random_value(label, row, minimum, maximum, salt):
        seed = math_node("ADD", "种子偏移", 1, row, inputs["随机种子"], salt)
        item = node("FunctionNodeRandomValue", label, 2, row)
        item.data_type = "FLOAT"
        # The Random Value node has several Min/Max sockets with the same name.
        feed(minimum, next(socket for socket in item.inputs if socket.name == "Min" and socket.enabled))
        feed(maximum, next(socket for socket in item.inputs if socket.name == "Max" and socket.enabled))
        feed(index, item.inputs["ID"])
        feed(seed, item.inputs["Seed"])
        return next(socket for socket in item.outputs if socket.enabled)

    # Use timeline frames so scrubbing, jumping and reopening produce the same positions.
    frame = node("GeometryNodeInputSceneTime", "时间线帧", 0, 3).outputs["Frame"]
    elapsed = math_node("SUBTRACT", "从起始帧开始", 1, 3, frame, inputs["起始帧"])
    loop_frame = math_node("FLOORED_MODULO", "循环内的帧", 2, 3, elapsed, inputs["循环帧数"])
    progress = math_node("DIVIDE", "循环进度", 3, 3, loop_frame, inputs["循环帧数"])
    cycles = math_node("MULTIPLY", "有方向的圈数", 4, 3, progress, inputs["每轮圈数"])
    radians = math_node("MULTIPLY", "圈数转弧度", 5, 3, cycles, math.tau)
    phase = random_value("初始相位", 1, 0.0, math.tau, 11)
    angle = math_node("ADD", "当前角度", 5, 2, radians, phase)

    radial_seed = random_value("环带分布", -1, -0.5, 0.5, 23)
    radial_offset = math_node("MULTIPLY", "径向偏移", 3, -1, radial_seed, inputs["环带宽度"])
    raw_radius = math_node("ADD", "粒子半径", 4, -1, inputs["半径"], radial_offset)
    distance = math_node("MAXIMUM", "半径下限", 5, -1, raw_radius, 0.001)
    cosine = math_node("COSINE", "X 方向", 6, 3, angle)
    sine = math_node("SINE", "Y 方向", 6, 2, angle)
    x_position = math_node("MULTIPLY", "X 坐标", 7, 3, cosine, distance)
    y_position = math_node("MULTIPLY", "Y 坐标", 7, 2, sine, distance)

    flutter_phase = random_value("起伏相位", -3, 0.0, math.tau, 37)
    flutter_rate = math_node("MULTIPLY", "每圈起伏两次", 6, 0, angle, 2.0)
    flutter_angle = math_node("ADD", "起伏角度", 7, 0, flutter_rate, flutter_phase)
    flutter = math_node("SINE", "起伏曲线", 8, 0, flutter_angle)
    ripple = math_node("MULTIPLY", "起伏幅度", 9, 0, flutter, 0.32)
    height_seed = random_value("高度分布", -5, -0.18, 0.18, 47)
    height_factor = math_node("ADD", "高度系数", 10, 0, ripple, height_seed)
    z_position = math_node("MULTIPLY", "Z 坐标", 11, 0, height_factor, inputs["上下起伏"])

    vector = node("ShaderNodeCombineXYZ", "环绕坐标", 12, 2)
    feed(x_position, vector.inputs["X"])
    feed(y_position, vector.inputs["Y"])
    feed(z_position, vector.inputs["Z"])
    line = node("GeometryNodeMeshLine", "创建粒子索引", 12, 4)
    line.inputs["Offset"].default_value = (0.0, 0.0, 0.0)
    feed(inputs["粒子数量"], line.inputs["Count"])
    positions = node("GeometryNodeSetPosition", "定位粒子", 13, 4)
    feed(line.outputs["Mesh"], positions.inputs["Geometry"])
    feed(vector.outputs["Vector"], positions.inputs["Position"])

    size_seed = random_value("大小随机值", -7, 0.0, 1.0, 59)
    bias = math_node("POWER", "偏向小粒子", 3, -7, size_seed, 2.6)
    variation = math_node("MULTIPLY_ADD", "尺寸变化", 4, -7, bias, 1.55)
    variation.node.inputs[2].default_value = 0.25
    size = math_node("MULTIPLY", "最终尺寸", 5, -7, inputs["粒子尺寸"], variation)
    sphere = node("GeometryNodeMeshIcoSphere", "低面数粒子", 12, -2)
    sphere.inputs["Radius"].default_value = 1.0
    sphere.inputs["Subdivisions"].default_value = 1
    shade = node("GeometryNodeSetMaterial", "应用发光材质", 13, -2)
    feed(sphere.outputs["Mesh"], shade.inputs["Geometry"])
    feed(inputs["粒子材质"], shade.inputs["Material"])

    instance = node("GeometryNodeInstanceOnPoints", "实例化粒子", 14, 4)
    feed(positions.outputs["Geometry"], instance.inputs["Points"])
    feed(shade.outputs["Geometry"], instance.inputs["Instance"])
    feed(size, instance.inputs["Scale"])
    output = node("NodeGroupOutput", "粒子环绕", 15, 4)
    feed(instance.outputs["Instances"], output.inputs["Geometry"])

    for item in tree.nodes:
        item.select = False


class OBJECT_OT_generate_particle_orbit(bpy.types.Operator):
    bl_idname = "object.generate_particle_orbit"
    bl_label = "生成粒子环绕"
    bl_description = "创建可播放和编辑的粒子环绕对象"
    bl_options = {"UNDO"}

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT" and context.scene and context.view_layer

    def execute(self, context):
        settings = context.scene.particle_orbit
        target = active_target(context)
        try:
            center, radius, inverse = fit_placement(context, target, settings)
        except ValueError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}

        name = f"Particle Orbit · {target.name}" if target else "Particle Orbit"
        orbit = mesh = tree = material = None
        try:
            mesh = bpy.data.meshes.new(name)
            orbit = bpy.data.objects.new(name, mesh)
            tree = bpy.data.node_groups.new(name, "GeometryNodeTree")
            material = bpy.data.materials.new(f"{name} Glow")
            build_material(material, settings)
            build_nodes(tree, settings, radius, context.scene.frame_start, material)
            modifier = orbit.modifiers.new("粒子环绕", "NODES")
            modifier.node_group = tree
            orbit[ORBIT_TAG] = True
            orbit.color = (*settings.color, 1.0)
            if target:
                orbit.parent = target
                orbit.matrix_parent_inverse = inverse
            orbit.location = center
            orbit.rotation_euler.x = settings.tilt
            context.scene.collection.objects.link(orbit)
        except (RuntimeError, ValueError, TypeError, KeyError, AttributeError, StopIteration) as error:
            if orbit is not None:
                bpy.data.objects.remove(orbit, do_unlink=True)
            if tree is not None:
                bpy.data.node_groups.remove(tree)
            if material is not None:
                bpy.data.materials.remove(material)
            if mesh is not None:
                bpy.data.meshes.remove(mesh)
            self.report({"ERROR"}, f"粒子环绕生成失败。{error}")
            return {"CANCELLED"}

        for selected in context.selected_objects:
            selected.select_set(False)
        orbit.select_set(True)
        context.view_layer.objects.active = orbit
        self.report({"INFO"}, f"已生成 {settings.count} 个粒子。播放时间线预览。")
        return {"FINISHED"}


class VIEW3D_PT_particle_orbit(bpy.types.Panel):
    bl_label = "粒子环绕生成器"
    bl_idname = "VIEW3D_PT_julian_particle_orbit"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "粒子环绕"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.particle_orbit
        target = active_target(context)

        placement = layout.box()
        placement.use_property_split = True
        placement.label(text=f"中心 · {target.name}" if target else "中心 · 3D 游标", icon="PIVOT_CURSOR")
        placement.prop(settings, "follow")
        row = placement.row()
        row.enabled = target is not None
        row.prop(settings, "fit")
        row = placement.row()
        row.enabled = not (target and settings.fit)
        row.prop(settings, "radius")
        placement.prop(settings, "tilt")

        shape = layout.box()
        shape.use_property_split = True
        for key in ("count", "band", "height", "size"):
            shape.prop(settings, key)

        motion = layout.box()
        motion.use_property_split = True
        for key in ("frames", "turns", "seed"):
            motion.prop(settings, key)
        motion.prop(settings, "color")
        motion.prop(settings, "emission")

        button = layout.row()
        button.scale_y = 1.35
        button.operator("object.generate_particle_orbit", icon="PARTICLES")
        if context.active_object and context.active_object.get(ORBIT_TAG):
            layout.label(text="在修改器中调整已生成的粒子环。", icon="MODIFIER")


CLASSES = (OrbitSettings, OBJECT_OT_generate_particle_orbit, VIEW3D_PT_particle_orbit)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.particle_orbit = PointerProperty(type=OrbitSettings)


def unregister():
    del bpy.types.Scene.particle_orbit
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
