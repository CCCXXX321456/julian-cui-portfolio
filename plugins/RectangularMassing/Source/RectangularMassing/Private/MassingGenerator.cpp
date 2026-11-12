#include "MassingGenerator.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Editor.h"
#include "Engine/Level.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Materials/MaterialInterface.h"

#define LOCTEXT_NAMESPACE "RectangularMassing"

namespace RectangularMassing
{
FText FDimensions::Validate() const
{
    const auto InRange = [](double Value, double Minimum, double Maximum)
    {
        return FMath::IsFinite(Value) && Value >= Minimum && Value <= Maximum;
    };

    if (!InRange(Length, 0.1, 1000.0) || !InRange(Width, 0.1, 1000.0)
        || !InRange(StoreyHeight, 0.1, 100.0) || Storeys < 1 || Storeys > 200)
    {
        return LOCTEXT("InvalidDimensions", "请输入有效的长、宽、层高和层数。");
    }
    if (!InRange(WallThickness, 0.01, 100.0) || 2.0 * WallThickness >= FMath::Min(Length, Width))
    {
        return LOCTEXT("InvalidThickness", "墙厚至少为 0.01 米，且必须小于较短边的一半。");
    }
    return FText::GetEmpty();
}

AActor* Spawn(UWorld& World, const FDimensions& Dimensions, const FVector& Base, UMaterialInterface* Material)
{
    if (!Dimensions.Validate().IsEmpty() || Base.ContainsNaN() || !World.GetCurrentLevel())
    {
        return nullptr;
    }

    UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (!Cube)
    {
        return nullptr;
    }
    const FVector CubeSize = Cube->GetBounds().BoxExtent * 2.0;
    if (CubeSize.GetMin() <= 0.0)
    {
        return nullptr;
    }

    FActorSpawnParameters Params;
    Params.OverrideLevel = World.GetCurrentLevel();
    Params.ObjectFlags |= RF_Transactional;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    Params.OverrideLevel->Modify();
    AActor* Mass = World.SpawnActor<AActor>(Base, FRotator::ZeroRotator, Params);
    if (!Mass)
    {
        return nullptr;
    }

    Mass->Modify();
    USceneComponent* Root = NewObject<USceneComponent>(Mass, TEXT("Footprint"), RF_Transactional);
    Root->SetMobility(EComponentMobility::Static);
    Mass->SetRootComponent(Root);
    Mass->AddInstanceComponent(Root);
    Root->SetWorldLocation(Base);
    Root->RegisterComponent();

    const double Length = Dimensions.Length * 100.0;
    const double Width = Dimensions.Width * 100.0;
    const double Height = Dimensions.TotalHeight() * 100.0;
    const double Thickness = Dimensions.WallThickness * 100.0;
    const double MidHeight = Height * 0.5;
    const auto AddWall = [&](FName Name, const FVector& Center, const FVector& Size)
    {
        UStaticMeshComponent* Wall = NewObject<UStaticMeshComponent>(Mass, Name, RF_Transactional);
        Mass->AddInstanceComponent(Wall);
        Wall->SetupAttachment(Root);
        Wall->SetMobility(EComponentMobility::Static);
        Wall->SetStaticMesh(Cube);
        Wall->SetCollisionProfileName(TEXT("BlockAll"));
        if (Material)
        {
            Wall->SetMaterial(0, Material);
        }
        Wall->SetRelativeLocation(Center);
        Wall->SetRelativeScale3D(Size / CubeSize);
        Wall->RegisterComponent();
    };

    const double SideY = (Width - Thickness) * 0.5;
    const double SideX = (Length - Thickness) * 0.5;
    AddWall(TEXT("NorthWall"), FVector(0, SideY, MidHeight), FVector(Length, Thickness, Height));
    AddWall(TEXT("SouthWall"), FVector(0, -SideY, MidHeight), FVector(Length, Thickness, Height));
    AddWall(TEXT("EastWall"), FVector(SideX, 0, MidHeight), FVector(Thickness, Width - 2.0 * Thickness, Height));
    AddWall(TEXT("WestWall"), FVector(-SideX, 0, MidHeight), FVector(Thickness, Width - 2.0 * Thickness, Height));

    FActorLabelUtilities::SetActorLabelUnique(Mass, FText::Format(
        LOCTEXT("ActorLabel", "Rectangular Mass ({0} storeys)"), FText::AsNumber(Dimensions.Storeys)).ToString());
    Mass->MarkPackageDirty();
    return Mass;
}
}

#undef LOCTEXT_NAMESPACE
