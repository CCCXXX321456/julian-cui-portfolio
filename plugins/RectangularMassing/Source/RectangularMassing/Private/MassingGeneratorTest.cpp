#include "MassingGenerator.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Materials/Material.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FRectangularMassingGeometryTest, "RectangularMassing.Geometry",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FRectangularMassingGeometryTest::RunTest(const FString&)
{
    using namespace RectangularMassing;
    UWorld* World = UWorld::CreateWorld(EWorldType::EditorPreview, false);
    if (!TestNotNull(TEXT("Transient editor world"), World))
    {
        return false;
    }
    ON_SCOPE_EXIT { World->DestroyWorld(false); };

    FDimensions Dimensions;
    Dimensions.Length = 11.0;
    Dimensions.Width = 7.5;
    Dimensions.StoreyHeight = 3.25;
    Dimensions.Storeys = 3;
    Dimensions.WallThickness = 0.30;

    const FVector Base(900, -500, 126);
    UMaterial* Material = UMaterial::GetDefaultMaterial(MD_Surface);
    AActor* Mass = Spawn(*World, Dimensions, Base, Material);
    if (!TestNotNull(TEXT("A mass actor is generated"), Mass))
    {
        return false;
    }
    TestTrue(TEXT("Pivot is at the base"), Mass->GetActorLocation().Equals(Base));

    const TInlineComponentArray<UStaticMeshComponent*> Walls(Mass);
    TestEqual(TEXT("Exactly four walls"), Walls.Num(), 4);
    FBox CombinedBounds(ForceInit);
    for (const UStaticMeshComponent* Wall : Walls)
    {
        const FVector Size = Wall->Bounds.GetBox().GetSize();
        TestTrue(TEXT("Wall has the requested thickness"), FMath::IsNearlyEqual(FMath::Min(Size.X, Size.Y), 30.0, 0.01));
        TestTrue(TEXT("Wall height equals storey height times storeys"), FMath::IsNearlyEqual(Size.Z, 975.0, 0.01));
        TestTrue(TEXT("Selected material is applied"), Wall->GetMaterial(0) == Material);
        TestTrue(TEXT("Wall persists as an actor instance component"), Mass->GetInstanceComponents().Contains(Wall));
        CombinedBounds += Wall->Bounds.GetBox();
    }
    TestTrue(TEXT("Outer footprint and base elevation are exact"), CombinedBounds.Min.Equals(Base + FVector(-550, -375, 0), 0.01));
    TestTrue(TEXT("Outer footprint and top elevation are exact"), CombinedBounds.Max.Equals(Base + FVector(550, 375, 975), 0.01));

    Dimensions.WallThickness = Dimensions.Width / 2.0;
    TestNull(TEXT("Thickness that closes the interior is rejected"), Spawn(*World, Dimensions, Base, nullptr));
    return true;
}

#endif
