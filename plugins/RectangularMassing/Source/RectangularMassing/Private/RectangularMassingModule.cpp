#include "MassingGenerator.h"

#include "AssetRegistry/AssetData.h"
#include "Editor.h"
#include "Engine/World.h"
#include "Framework/Docking/TabManager.h"
#include "GameFramework/Actor.h"
#include "LevelEditorViewport.h"
#include "LevelUtils.h"
#include "Materials/MaterialInterface.h"
#include "Modules/ModuleManager.h"
#include "PropertyCustomizationHelpers.h"
#include "ScopedTransaction.h"
#include "Styling/AppStyle.h"
#include "ToolMenus.h"
#include "UnrealClient.h"
#include "Widgets/Docking/SDockTab.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SNumericEntryBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SGridPanel.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "RectangularMassing"

namespace RectangularMassing
{
namespace
{
const FName TabId(TEXT("RectangularMassing"));

const FLevelEditorViewportClient* FindPerspectiveViewport()
{
    const FViewport* ActiveViewport = GEditor->GetActiveViewport();
    const FLevelEditorViewportClient* FirstPerspective = nullptr;
    for (const FLevelEditorViewportClient* Client : GEditor->GetLevelViewportClients())
    {
        if (!Client || !Client->Viewport || !Client->IsPerspective() || !Client->IsVisible())
        {
            continue;
        }
        if (Client->Viewport == ActiveViewport)
        {
            return Client;
        }
        if (!FirstPerspective)
        {
            FirstPerspective = Client;
        }
    }
    return FirstPerspective;
}

FVector FindBaseLocation(UWorld& World, const FDimensions& Dimensions, bool bSnapToGround)
{
    const FLevelEditorViewportClient* View = FindPerspectiveViewport();
    FVector Base = FVector::ZeroVector;
    if (View)
    {
        const FVector Start = View->GetViewLocation();
        const FVector Direction = View->GetViewRotation().Vector();
        const double Distance = FMath::Max(1000.0, 110.0 * FMath::Max(Dimensions.Length, Dimensions.Width));
        Base = Start + Direction * Distance;
        if (bSnapToGround)
        {
            FHitResult Aim;
            if (World.LineTraceSingleByChannel(Aim, Start, Start + Direction * 1000000.0, ECC_Visibility)
                && Aim.ImpactNormal.Z > 0.5)
            {
                return Aim.ImpactPoint;
            }
        }
    }

    if (bSnapToGround)
    {
        FHitResult Ground;
        const double StartZ = View ? FMath::Max(Base.Z, View->GetViewLocation().Z) + 10.0 : 100000.0;
        const FVector TraceStart(Base.X, Base.Y, StartZ);
        if (World.LineTraceSingleByChannel(Ground, TraceStart, TraceStart - FVector(0, 0, 1000000), ECC_Visibility)
            && Ground.ImpactNormal.Z > 0.5)
        {
            return Ground.ImpactPoint;
        }
        Base.Z = 0.0;
    }
    return Base;
}

class SMassingPanel final : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SMassingPanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments&)
    {
        ChildSlot
        [
            SNew(SScrollBox)
            + SScrollBox::Slot()
            [
                SNew(SBox)
                .MaxDesiredWidth(580.0f)
                .Padding(FMargin(24, 22))
                [
                    SNew(SVerticalBox)
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    [
                        SNew(STextBlock)
                        .Font(FAppStyle::GetFontStyle("DetailsView.CategoryFontStyle"))
                        .Text(LOCTEXT("Title", "矩形体量生成器"))
                    ]
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    .Padding(0, 6, 0, 18)
                    [
                        SNew(STextBlock)
                        .AutoWrapText(true)
                        .Text(LOCTEXT("Description", "在当前关卡创建矩形建筑外壳。尺寸以米为单位。"))
                    ]
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    [
                        SNew(SBorder)
                        .BorderImage(FAppStyle::GetBrush("Brushes.Recessed"))
                        .Padding(12)
                        [
                            SNew(SGridPanel)
                            .FillColumn(1, 1.0f)
                            + SGridPanel::Slot(0, 0).Padding(0, 5, 20, 5).VAlign(VAlign_Center)
                            [ Label(LOCTEXT("Length", "长度（m）")) ]
                            + SGridPanel::Slot(1, 0).Padding(0, 5)
                            [ Number(&FDimensions::Length, 0.1, 1000.0) ]
                            + SGridPanel::Slot(0, 1).Padding(0, 5, 20, 5).VAlign(VAlign_Center)
                            [ Label(LOCTEXT("Width", "宽度（m）")) ]
                            + SGridPanel::Slot(1, 1).Padding(0, 5)
                            [ Number(&FDimensions::Width, 0.1, 1000.0) ]
                            + SGridPanel::Slot(0, 2).Padding(0, 5, 20, 5).VAlign(VAlign_Center)
                            [ Label(LOCTEXT("StoreyHeight", "层高（m）")) ]
                            + SGridPanel::Slot(1, 2).Padding(0, 5)
                            [ Number(&FDimensions::StoreyHeight, 0.1, 100.0) ]
                            + SGridPanel::Slot(0, 3).Padding(0, 5, 20, 5).VAlign(VAlign_Center)
                            [ Label(LOCTEXT("Storeys", "层数")) ]
                            + SGridPanel::Slot(1, 3).Padding(0, 5)
                            [ Number(&FDimensions::Storeys, 1, 200) ]
                            + SGridPanel::Slot(0, 4).Padding(0, 5, 20, 5).VAlign(VAlign_Center)
                            [ Label(LOCTEXT("Thickness", "墙厚（m）")) ]
                            + SGridPanel::Slot(1, 4).Padding(0, 5)
                            [ Number(&FDimensions::WallThickness, 0.01, 100.0) ]
                            + SGridPanel::Slot(0, 5).Padding(0, 5, 20, 5).VAlign(VAlign_Center)
                            [ Label(LOCTEXT("Material", "墙体材质")) ]
                            + SGridPanel::Slot(1, 5).Padding(0, 5)
                            [
                                SNew(SObjectPropertyEntryBox)
                                .AllowedClass(UMaterialInterface::StaticClass())
                                .ObjectPath_Lambda([this] { return MaterialPath.ToString(); })
                                .OnObjectChanged_Lambda([this](const FAssetData& Asset) { MaterialPath = Asset.GetSoftObjectPath(); })
                                .AllowClear(true)
                            ]
                        ]
                    ]
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    .Padding(0, 12, 0, 0)
                    [
                        SNew(SCheckBox)
                        .IsChecked_Lambda([this] { return bSnapToGround ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                        .OnCheckStateChanged_Lambda([this](ECheckBoxState State) { bSnapToGround = State == ECheckBoxState::Checked; })
                        .ToolTipText(LOCTEXT("GroundTip", "将体量底部放在视口指向的可碰撞地面上。未命中地面时使用 Z = 0。"))
                        [ Label(LOCTEXT("Ground", "自动贴地")) ]
                    ]
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    .Padding(0, 12, 0, 12)
                    [
                        SNew(STextBlock)
                        .AutoWrapText(true)
                        .Text(this, &SMassingPanel::GetDimensionsText)
                    ]
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    [
                        SNew(SButton)
                        .ButtonStyle(FAppStyle::Get(), "PrimaryButton")
                        .HAlign(HAlign_Center)
                        .Text(LOCTEXT("Generate", "生成体量"))
                        .OnClicked(this, &SMassingPanel::Generate)
                    ]
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    .Padding(0, 8, 0, 0)
                    [
                        SNew(STextBlock)
                        .AutoWrapText(true)
                        .Text_Lambda([this] { return Status; })
                    ]
                ]
            ]
        ];
    }

private:
    static TSharedRef<STextBlock> Label(const FText& Text)
    {
        return SNew(STextBlock).Text(Text);
    }

    template <typename NumericType>
    TSharedRef<SWidget> Number(NumericType FDimensions::* Field, NumericType Minimum, NumericType Maximum)
    {
        return SNew(SNumericEntryBox<NumericType>)
            .MinDesiredValueWidth(120.0f)
            .AllowSpin(false)
            .MinValue(Minimum)
            .MaxValue(Maximum)
            .Value_Lambda([this, Field]() -> TOptional<NumericType> { return Dimensions.*Field; })
            .OnValueChanged_Lambda([this, Field](NumericType Value) { Dimensions.*Field = Value; Status = FText::GetEmpty(); })
            .OnValueCommitted_Lambda([this, Field](NumericType Value, ETextCommit::Type) { Dimensions.*Field = Value; });
    }

    FText GetDimensionsText() const
    {
        const FText Error = Dimensions.Validate();
        if (!Error.IsEmpty())
        {
            return Error;
        }
        return FText::Format(LOCTEXT("Summary", "总高 {0} m　·　占地 {1} m²"),
            FText::AsNumber(Dimensions.TotalHeight()), FText::AsNumber(Dimensions.Length * Dimensions.Width));
    }

    FReply Generate()
    {
        Status = Dimensions.Validate();
        if (!Status.IsEmpty())
        {
            return FReply::Handled();
        }
        UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
        if (!World || !World->GetCurrentLevel() || GEditor->PlayWorld)
        {
            Status = LOCTEXT("NoWorld", "请打开一个关卡并退出播放模式，再生成体量。");
            return FReply::Handled();
        }
        if (FLevelUtils::IsLevelLocked(World->GetCurrentLevel()))
        {
            Status = LOCTEXT("Locked", "当前关卡已锁定。请解锁后再生成。");
            return FReply::Handled();
        }

        UMaterialInterface* Material = nullptr;
        if (!MaterialPath.IsNull())
        {
            Material = Cast<UMaterialInterface>(MaterialPath.TryLoad());
            if (!Material)
            {
                Status = LOCTEXT("MaterialMissing", "无法加载所选材质。请重新选择或清空材质。");
                return FReply::Handled();
            }
        }

        const FVector Base = FindBaseLocation(*World, Dimensions, bSnapToGround);
        FScopedTransaction Transaction(LOCTEXT("Transaction", "生成矩形体量"));
        AActor* Mass = Spawn(*World, Dimensions, Base, Material);
        if (!Mass)
        {
            Transaction.Cancel();
            Status = LOCTEXT("Failed", "生成失败。请确认关卡可编辑且引擎自带的 Cube 网格可用。");
            return FReply::Handled();
        }
        GEditor->SelectNone(false, true, false);
        GEditor->SelectActor(Mass, true, true);
        GEditor->RedrawLevelEditingViewports();
        Status = LOCTEXT("Created", "已生成并选中体量。可用 Ctrl+Z 撤销。");
        return FReply::Handled();
    }

    FDimensions Dimensions;
    FSoftObjectPath MaterialPath;
    bool bSnapToGround = true;
    FText Status;
};
}

class FRectangularMassingModule final : public IModuleInterface
{
public:
    void StartupModule() override
    {
        if (IsRunningCommandlet())
        {
            return;
        }
        FGlobalTabmanager::Get()->RegisterNomadTabSpawner(TabId,
            FOnSpawnTab::CreateRaw(this, &FRectangularMassingModule::SpawnTab))
            .SetDisplayName(LOCTEXT("TabTitle", "矩形体量生成器"))
            .SetMenuType(ETabSpawnerMenuType::Hidden);
        bRegisteredTab = true;
        UToolMenus::RegisterStartupCallback(
            FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FRectangularMassingModule::RegisterMenus));
    }

    void ShutdownModule() override
    {
        if (bRegisteredTab)
        {
            UToolMenus::UnRegisterStartupCallback(this);
            UToolMenus::UnregisterOwner(this);
            if (const TSharedPtr<SDockTab> Tab = OpenTab.Pin())
            {
                Tab->SetContent(SNullWidget::NullWidget);
                Tab->RequestCloseTab();
            }
            FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(TabId);
        }
    }

private:
    TSharedRef<SDockTab> SpawnTab(const FSpawnTabArgs&)
    {
        TSharedRef<SDockTab> Tab = SNew(SDockTab)
            .TabRole(ETabRole::NomadTab)
            [
                SNew(SMassingPanel)
            ];
        OpenTab = Tab;
        return Tab;
    }

    void RegisterMenus()
    {
        FToolMenuOwnerScoped Owner(this);
        UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
        FToolMenuSection& Section = Menu->FindOrAddSection("RectangularMassing");
        Section.AddMenuEntry("OpenRectangularMassing", LOCTEXT("Menu", "矩形体量生成器"),
            LOCTEXT("MenuTip", "打开矩形建筑体量生成面板。"), FSlateIcon(),
            FUIAction(FExecuteAction::CreateLambda([] { FGlobalTabmanager::Get()->TryInvokeTab(TabId); })));
    }

    TWeakPtr<SDockTab> OpenTab;
    bool bRegisteredTab = false;
};
}

IMPLEMENT_MODULE(RectangularMassing::FRectangularMassingModule, RectangularMassing)

#undef LOCTEXT_NAMESPACE
