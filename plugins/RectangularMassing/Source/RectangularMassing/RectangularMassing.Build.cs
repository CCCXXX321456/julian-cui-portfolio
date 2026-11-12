using UnrealBuildTool;

public class RectangularMassing : ModuleRules
{
    public RectangularMassing(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PrivateDependencyModuleNames.AddRange(new[]
        {
            "Core", "CoreUObject", "Engine", "InputCore", "Slate", "SlateCore",
            "UnrealEd", "ToolMenus", "PropertyEditor"
        });
    }
}
