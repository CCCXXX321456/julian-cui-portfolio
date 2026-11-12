#pragma once

#include "CoreMinimal.h"

class AActor;
class UMaterialInterface;
class UWorld;

namespace RectangularMassing
{
struct FDimensions
{
    double Length = 18.0;
    double Width = 12.0;
    double StoreyHeight = 3.3;
    int32 Storeys = 4;
    double WallThickness = 0.24;

    double TotalHeight() const { return StoreyHeight * Storeys; }
    FText Validate() const;
};

// The actor pivot is the center of its footprint at ground level. Distances are in cm.
AActor* Spawn(UWorld& World, const FDimensions& Dimensions, const FVector& Base, UMaterialInterface* Material);
}
