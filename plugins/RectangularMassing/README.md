# 矩形体量生成器

面向 UE 5.7 的建筑体量编辑器插件。输入长度、宽度、层高、层数和墙厚，从一个面板在当前关卡生成矩形建筑外壳。

## 安装

1. 关闭 Unreal Editor，将整个 `RectangularMassing` 文件夹复制到你的项目的 `Plugins/` 目录下。描述文件应位于 `<项目>/Plugins/RectangularMassing/RectangularMassing.uplugin`。
2. 这是 C++ 源码插件。Windows 上需安装支持 UE 5.7 的 Visual Studio C++ 工具链和 Windows SDK。已有 C++ 项目可以直接编译项目的 Editor 目标。若原项目是纯蓝图，先用 **Tools → New C++ Class** 添加一个空类，再关闭编辑器、复制插件并编译。
3. 重新打开项目。在 **Edit → Plugins** 搜索 **Rectangular Massing**，启用后按提示重启。打开 **Tools → 矩形体量生成器**。

也可以在 UE 5.7 的命令行用 `RunUAT.bat` 构建 Windows 编辑器插件，完成后将输出文件夹放进项目的 `Plugins/`。

```bat
"<UE_5.7>\Engine\Build\BatchFiles\RunUAT.bat" BuildPlugin -Plugin="<源码目录>\RectangularMassing.uplugin" -Package="<输出目录>\RectangularMassing" -TargetPlatforms=Win64 -NoTargetPlatforms
```

## 使用

1. 在关卡的透视视口对准要摆放的位置，然后打开面板。
2. 输入尺寸。长、宽、层高和墙厚以米为单位，长度沿世界 X 轴，宽度沿 Y 轴。总高等于层高乘以层数。默认值会生成 18 × 12 × 13.2 m 的四层体量，墙厚 0.24 m。
3. 可从内容浏览器指定材质或材质实例。开启 **自动贴地** 时，插件优先取视口指向的可碰撞地面，之后尝试向下找地面，找不到时落在 Z = 0。关闭后，底部中心位于透视视口前方；没有透视视口时使用世界原点。
4. 点击 **生成体量**。四面实体墙保存在同一个普通关卡 Actor 下。体量会自动被选中，支持移动、撤销和重做。保存关卡后，生成结果可以在禁用插件时打开。

首版生成开顶的连续外壳。层数用于计算整体高度。楼板、内部空间、按层拆分外墙和随机开窗留待后续扩展。

## 验证

在编辑器的 **Session Frontend → Automation** 运行 `RectangularMassing.Geometry`，验证墙厚、体量边界和材质。也可以在面板输入默认值、生成后用 **Ctrl+Z** 和 **Ctrl+Y** 检查撤销、重做。
