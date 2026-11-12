# Windows App SDK 2.6.5 : index et graphe de fonctionnalités

Relevé le 2026-11-12 par `sdk/tools/winappsdk-graph.ts` sur les métadonnées WinRT livrées (NuGet) et le code source
(dépôts ci-dessous). Index complet interrogeable : `target/index/winappsdk.sqlite` (tables node, edge, fts).

- packages : 11
- winmds : 37
- namespaces : 79
- types : 4480
- members : 22104
- documented : 13817
- features : 17
- components : 95
- idl : 170
- idlTypes : 1723
- shippedTypesLinkedToSource : 1415
- nodes : 28838
- edges : 1518

## Dépôts

- WindowsAppSDK : https://github.com/aphrody-labs/WindowsAppSDK @ bdc0deb (2026-11-11)
- microsoft-ui-xaml : https://github.com/aphrody-labs/microsoft-ui-xaml @ e38939f2 (2026-11-12)

## Paquets livrés

### Microsoft.WindowsAppSDK

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support.

Dépendances : Microsoft.WindowsAppSDK.Base [2.6.5], Microsoft.WindowsAppSDK.Foundation 2.6.5, Microsoft.WindowsAppSDK.InteractiveExperiences 2.6.5, Microsoft.WindowsAppSDK.WinUI 2.6.5, Microsoft.WindowsAppSDK.DWrite 2.6.5, Microsoft.WindowsAppSDK.Widgets 2.6.5, Microsoft.WindowsAppSDK.AI 2.6.5, Microsoft.WindowsAppSDK.ML 2.6.5, Microsoft.WindowsAppSDK.Search 2.6.5, Microsoft.WindowsAppSDK.Runtime [2.6.5]


### Microsoft.WindowsAppSDK.AI

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This package contains the Windows AI APIs.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5, Microsoft.WindowsAppSDK.Foundation 2.6.5

- **Microsoft.Graphics.Imaging.winmd** (metadata/Microsoft.Graphics.Imaging.winmd)
  - Microsoft.Graphics.Imaging : 2 interface, 1 class, 1 struct, 1 enum ; 25 membres
- **Microsoft.Windows.AI.ContentSafety.winmd** (metadata/Microsoft.Windows.AI.ContentSafety.winmd)
  - Microsoft.Windows.AI.ContentSafety : 3 class, 1 struct, 5 interface, 1 enum ; 33 membres
- **Microsoft.Windows.AI.Foundation.winmd** (metadata/Microsoft.Windows.AI.Foundation.winmd)
  - Microsoft.Windows.AI.Foundation : 1 struct, 1 class, 2 interface ; 8 membres
- **Microsoft.Windows.AI.Imaging.winmd** (metadata/Microsoft.Windows.AI.Imaging.winmd)
  - Microsoft.Windows.AI.Imaging : 16 interface, 6 struct, 10 class, 3 enum ; 106 membres
- **Microsoft.Windows.AI.Text.winmd** (metadata/Microsoft.Windows.AI.Text.winmd)
  - Microsoft.Windows.AI.Text : 15 class, 4 enum, 28 interface, 2 struct ; 149 membres
- **Microsoft.Windows.AI.Video.winmd** (metadata/Microsoft.Windows.AI.Video.winmd)
  - Microsoft.Windows.AI.Video : 4 interface, 3 class, 1 enum ; 24 membres
- **Microsoft.Windows.AI.winmd** (metadata/Microsoft.Windows.AI.winmd)
  - Microsoft.Windows.AI : 2 class, 3 enum, 1 struct, 3 interface ; 23 membres
- **Microsoft.Windows.SemanticSearch.winmd** (metadata/Microsoft.Windows.SemanticSearch.winmd)
  - Microsoft.Windows.SemanticSearch : 1 class, 2 interface, 1 struct ; 8 membres
- **Microsoft.Windows.Vision.winmd** (metadata/Microsoft.Windows.Vision.winmd)
  - Microsoft.Windows.Vision : 2 struct, 1 enum ; 14 membres ; 3 expérimentaux
- **Microsoft.Windows.Workloads.winmd** (metadata/Microsoft.Windows.Workloads.winmd)
  - Microsoft.Windows.Workloads : 1 enum, 1 struct ; 3 membres

### Microsoft.WindowsAppSDK.Base

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This is a package that is used as a dependency by other Windows App SDK component packages and not meant to be directly referenced.

Dépendances : Microsoft.Windows.SDK.BuildTools 10.0.26100.4654, Microsoft.Windows.SDK.BuildTools.MSIX 1.7.251221100


### Microsoft.WindowsAppSDK.DWrite

DWriteCore is an implementation of the Microsoft Windows DirectWrite API that has been decoupled from the Windows OS. DWriteCore provides services for applications to enumerate fonts and format and render text.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5


### Microsoft.WindowsAppSDK.Foundation

Windows App SDK

Dépendances : Microsoft.WindowsAppSDK.Base [2.6.5, 3.0.0), Microsoft.WindowsAppSDK.InteractiveExperiences [2.6.5, 3.0.0)

- **Microsoft.Security.Authentication.OAuth.winmd** (metadata/Microsoft.Security.Authentication.OAuth.winmd)
  - Microsoft.Security.Authentication.OAuth : 10 class, 2 enum, 16 interface, 1 struct ; 139 membres
- **Microsoft.Windows.AppLifecycle.winmd** (metadata/Microsoft.Windows.AppLifecycle.winmd)
  - Microsoft.Windows.AppLifecycle : 3 class, 1 struct, 1 enum, 5 interface ; 84 membres
- **Microsoft.Windows.AppNotifications.Builder.winmd** (metadata/Microsoft.Windows.AppNotifications.Builder.winmd)
  - Microsoft.Windows.AppNotifications.Builder : 6 enum, 5 class, 1 struct, 9 interface ; 193 membres
- **Microsoft.Windows.AppNotifications.winmd** (metadata/Microsoft.Windows.AppNotifications.winmd)
  - Microsoft.Windows.AppNotifications : 4 class, 3 enum, 1 struct, 10 interface ; 83 membres
- **Microsoft.Windows.ApplicationModel.Background.UniversalBGTask.winmd** (metadata/Microsoft.Windows.ApplicationModel.Background.UniversalBGTask.winmd)
  - Microsoft.Windows.ApplicationModel.Background.UniversalBGTask : 1 interface, 1 class, 1 struct ; 2 membres
- **Microsoft.Windows.ApplicationModel.Background.winmd** (metadata/Microsoft.Windows.ApplicationModel.Background.winmd)
  - Microsoft.Windows.ApplicationModel.Background : 1 class, 1 struct, 1 interface ; 15 membres
- **Microsoft.Windows.ApplicationModel.DynamicDependency.winmd** (metadata/Microsoft.Windows.ApplicationModel.DynamicDependency.winmd)
  - Microsoft.Windows.ApplicationModel.DynamicDependency : 5 class, 2 struct, 8 interface, 2 enum ; 59 membres
- **Microsoft.Windows.ApplicationModel.Resources.winmd** (metadata/Microsoft.Windows.ApplicationModel.Resources.winmd)
  - Microsoft.Windows.ApplicationModel.Resources : 13 interface, 7 class, 1 struct, 1 enum ; 80 membres
- **Microsoft.Windows.ApplicationModel.WindowsAppRuntime.winmd** (metadata/Microsoft.Windows.ApplicationModel.WindowsAppRuntime.winmd)
  - Microsoft.Windows.ApplicationModel.WindowsAppRuntime : 4 struct, 6 class, 2 enum, 9 interface ; 145 membres
- **Microsoft.Windows.BadgeNotifications.winmd** (metadata/Microsoft.Windows.BadgeNotifications.winmd)
  - Microsoft.Windows.BadgeNotifications : 1 enum, 1 class, 1 struct, 2 interface ; 21 membres
- **Microsoft.Windows.Foundation.winmd** (metadata/Microsoft.Windows.Foundation.winmd)
  - Microsoft.Windows.Foundation : 2 struct, 1 class, 1 interface ; 105 membres
- **Microsoft.Windows.Globalization.winmd** (metadata/Microsoft.Windows.Globalization.winmd)
  - Microsoft.Windows.Globalization : 1 class, 1 interface ; 6 membres
- **Microsoft.Windows.Management.Deployment.winmd** (metadata/Microsoft.Windows.Management.Deployment.winmd)
  - Microsoft.Windows.Management.Deployment : 20 class, 32 interface, 2 struct, 6 enum ; 373 membres
- **Microsoft.Windows.Media.Capture.winmd** (metadata/Microsoft.Windows.Media.Capture.winmd)
  - Microsoft.Windows.Media.Capture : 3 class, 1 struct, 5 enum, 4 interface ; 46 membres
- **Microsoft.Windows.PushNotifications.winmd** (metadata/Microsoft.Windows.PushNotifications.winmd)
  - Microsoft.Windows.PushNotifications : 5 interface, 4 class, 1 enum, 2 struct ; 39 membres
- **Microsoft.Windows.Security.AccessControl.winmd** (metadata/Microsoft.Windows.Security.AccessControl.winmd)
  - Microsoft.Windows.Security.AccessControl : 2 struct, 1 interface, 1 class ; 6 membres
- **Microsoft.Windows.Storage.Pickers.winmd** (metadata/Microsoft.Windows.Storage.Pickers.winmd)
  - Microsoft.Windows.Storage.Pickers : 5 class, 11 interface, 2 enum, 1 struct ; 87 membres
- **Microsoft.Windows.Storage.winmd** (metadata/Microsoft.Windows.Storage.winmd)
  - Microsoft.Windows.Storage : 2 class, 1 struct, 2 enum, 4 interface ; 61 membres
- **Microsoft.Windows.System.Power.winmd** (metadata/Microsoft.Windows.System.Power.winmd)
  - Microsoft.Windows.System.Power : 8 enum, 2 interface, 1 class, 1 struct ; 73 membres
- **Microsoft.Windows.System.winmd** (metadata/Microsoft.Windows.System.winmd)
  - Microsoft.Windows.System : 1 class, 1 struct, 3 interface ; 24 membres

### Microsoft.WindowsAppSDK.InteractiveExperiences

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This package contains the Microsoft Interactive Experiences features.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5

- **Microsoft.Foundation.winmd** (metadata/10.0.18362.0/Microsoft.Foundation.winmd)
  - Microsoft.Foundation : 1 struct ; 0 membres
- **Microsoft.Graphics.winmd** (metadata/10.0.18362.0/Microsoft.Graphics.winmd)
  - Microsoft.Graphics.DirectX : 4 enum ; 160 membres
  - Microsoft.Graphics.Display : 2 class, 2 enum, 3 interface ; 50 membres
- **Microsoft.UI.winmd** (metadata/10.0.18362.0/Microsoft.UI.winmd)
  - Microsoft.UI : 1 delegate, 2 class, 3 struct, 6 interface ; 293 membres
  - Microsoft.UI.Composition : 104 class, 22 enum, 177 interface ; 1105 membres
  - Microsoft.UI.Composition.Core : 1 class, 1 interface ; 10 membres
  - Microsoft.UI.Composition.Diagnostics : 2 class, 1 enum, 3 interface ; 21 membres
  - Microsoft.UI.Composition.Effects : 2 interface, 1 class, 1 enum ; 16 membres
  - Microsoft.UI.Composition.Interactions : 17 class, 42 interface, 7 enum ; 235 membres
  - Microsoft.UI.Composition.Scenes : 29 interface, 4 enum, 17 class ; 144 membres
  - Microsoft.UI.Composition.SystemBackdrops : 3 class, 4 enum, 10 interface ; 82 membres
  - Microsoft.UI.Content : 19 class, 5 enum, 51 interface ; 401 membres
  - Microsoft.UI.Dispatching : 5 class, 1 delegate, 2 enum, 10 interface ; 60 membres
  - Microsoft.UI.Input : 45 class, 4 struct, 14 enum, 71 interface ; 567 membres
  - Microsoft.UI.Input.DragDrop : 5 class, 2 enum, 7 interface ; 58 membres
  - Microsoft.UI.Input.Interop : 1 interface, 1 class ; 2 membres
  - Microsoft.UI.System : 2 interface, 1 class ; 8 membres
  - Microsoft.UI.Windowing : 10 class, 8 enum, 28 interface ; 264 membres

### Microsoft.WindowsAppSDK.ML

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This package contains the Windows Machine Learning APIs.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5, Microsoft.WindowsAppSDK.Foundation 2.6.5, Microsoft.Windows.AI.MachineLearning [2.4.89, 3.0.0)


### Microsoft.WindowsAppSDK.Runtime

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This is a package that can be referenced to declare the WindowsAppSDK framework packages should be referenced by default.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5


### Microsoft.WindowsAppSDK.Search

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This package contains the Windows Search APIs.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5, Microsoft.WindowsAppSDK.Foundation 2.6.5, Microsoft.WindowsAppSDK.AI [2.6.5]

- **Microsoft.Windows.Search.winmd** (metadata/Microsoft.Windows.Search.winmd)
  - Microsoft.Windows.Search.AppContentIndex : 1 struct, 30 class, 18 enum, 39 interface ; 369 membres

### Microsoft.WindowsAppSDK.Widgets

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This package contains the Widgets APIs.

Dépendances : Microsoft.WindowsAppSDK.Base 2.6.5

- **Microsoft.Windows.Widgets.winmd** (metadata/Microsoft.Windows.Widgets.winmd)
  - Microsoft.Windows.Widgets.Feeds.Providers : 14 class, 25 interface ; 92 membres
  - Microsoft.Windows.Widgets.Notifications : 2 enum, 2 class, 3 interface ; 43 membres
  - Microsoft.Windows.Widgets.Providers : 28 interface, 13 class ; 115 membres
  - Microsoft.Windows.Widgets : 1 struct, 1 enum ; 3 membres

### Microsoft.WindowsAppSDK.WinUI

The Windows App SDK empowers all Windows Desktop apps with modern Windows UI, APIs, and platform features, including back-compat support. This package contains the modern Windows UI features.

Dépendances : Microsoft.Web.WebView2 1.0.3719.77, Microsoft.WindowsAppSDK.Base 2.6.5, Microsoft.WindowsAppSDK.Foundation 2.6.5, Microsoft.WindowsAppSDK.InteractiveExperiences 2.6.5

- **Microsoft.UI.Text.winmd** (metadata/Microsoft.UI.Text.winmd)
  - Microsoft.UI.Text : 25 enum, 4 class, 9 interface, 1 struct ; 509 membres
- **Microsoft.UI.Xaml.winmd** (metadata/Microsoft.UI.Xaml.winmd)
  - Microsoft.UI.Xaml : 79 class, 37 enum, 15 delegate, 6 struct, 146 interface, 3 attribute ; 1521 membres
  - Microsoft.UI.Xaml.Automation : 25 class, 21 enum, 51 interface ; 529 membres
  - Microsoft.UI.Xaml.Automation.Peers : 12 enum, 106 class, 211 interface, 1 struct ; 758 membres
  - Microsoft.UI.Xaml.Automation.Provider : 36 interface, 1 class ; 132 membres
  - Microsoft.UI.Xaml.Automation.Text : 2 enum ; 9 membres
  - Microsoft.UI.Xaml.Controls : 336 class, 95 enum, 13 delegate, 745 interface, 1 attribute ; 7545 membres
  - Microsoft.UI.Xaml.Controls.AnimatedVisuals : 8 class ; 32 membres
  - Microsoft.UI.Xaml.Controls.Primitives : 75 class, 19 enum, 6 delegate, 1 struct, 160 interface ; 1539 membres
  - Microsoft.UI.Xaml.CustomAttributes : 8 attribute ; 13 membres
  - Microsoft.UI.Xaml.Data : 1 attribute, 11 class, 3 enum, 2 delegate, 33 interface, 1 struct ; 136 membres
  - Microsoft.UI.Xaml.Documents : 20 class, 33 interface, 2 enum, 1 struct ; 563 membres
  - Microsoft.UI.Xaml.Hosting : 8 class, 16 interface, 1 enum ; 74 membres
  - Microsoft.UI.Xaml.Input : 39 class, 11 delegate, 11 enum, 52 interface ; 494 membres
  - Microsoft.UI.Xaml.Interop : 2 delegate, 8 interface, 1 enum, 1 class ; 38 membres
  - Microsoft.UI.Xaml.Markup : 3 attribute, 24 interface, 6 class, 2 struct ; 124 membres
  - Microsoft.UI.Xaml.Media : 63 class, 14 enum, 126 interface, 1 struct ; 739 membres
  - Microsoft.UI.Xaml.Media.Animation : 87 class, 6 enum, 2 attribute, 150 interface, 2 struct ; 773 membres
  - Microsoft.UI.Xaml.Media.Imaging : 3 enum, 12 class, 1 delegate, 24 interface ; 131 membres
  - Microsoft.UI.Xaml.Media.Media3D : 4 class, 8 interface, 1 struct ; 92 membres
  - Microsoft.UI.Xaml.Navigation : 5 class, 8 interface, 4 delegate, 2 enum ; 55 membres
  - Microsoft.UI.Xaml.Printing : 4 class, 3 delegate, 6 interface, 1 enum ; 38 membres
  - Microsoft.UI.Xaml.Resources : 1 class, 4 interface ; 6 membres
  - Microsoft.UI.Xaml.Settings : 2 interface, 1 enum, 1 class ; 15 membres
  - Microsoft.UI.Xaml.Shapes : 7 class, 15 interface ; 101 membres
  - Microsoft.UI.Xaml.XamlTypeInfo : 2 interface, 1 class ; 6 membres

## Fonctionnalités (TerminalVelocity, dev/Common)

| fonctionnalité | état | domaine | description | API IDL conditionnées | fichiers de code |
|---|---|---|---|---|---|
| Feature_AppNotifications | AlwaysEnabled | AppNotifications | Enables Local App sourced Notifications on the device | 0 | 2 |
| Feature_CallingPreviewSupport | AlwaysEnabled | AppNotifications | Apis for Calling preview feature | 7 | 1 |
| Feature_ApplicationData | AlwaysEnabled | ApplicationData | ApplicationData APIs | 0 | 1 |
| Feature_BackgroundTask | AlwaysEnabled | BackgroundTask | Supports BackgroundTask executions for WinAppSDK apps | 0 | 2 |
| Feature_BadgeNotifications | AlwaysEnabled | BadgeNotifications | Enables Local Badge sourced Notifications for packaged apps on the device | 0 | 1 |
| Feature_CameraCaptureUI | AlwaysEnabled | CameraCaptureUI | CameraCaptureUI for the WindowsAppRuntime | 0 | 1 |
| Feature_Decimal | AlwaysEnabled | Decimal | Decimal APIs | 0 | 1 |
| Feature_DeploymentAPI | AlwaysEnabled | DeploymentAPI | DeploymentAPI for the WindowsAppRuntime | 0 | 1 |
| Feature_DeploymentRepair | AlwaysEnabled | DeploymentAPI | Deployment Repair for the WindowsAppRuntime | 2 | 2 |
| Feature_GenerationId | AlwaysEnabled | DynamicDependency | DynamicDependency APIs to access the package graph's current Generation Id | 0 | 1 |
| Feature_EnvironmentManager | AlwaysEnabled | EnvironmentManager | EnvironmentManager for the WindowsAppRuntime | 0 | 1 |
| Feature_OAuth | AlwaysEnabled | OAuth | OAuth for the WindowsAppRuntime | 0 | 1 |
| Feature_PackageManager | AlwaysEnabled | PackageManager | Package Management APIs | 0 | 1 |
| Feature_PackageRuntime | AlwaysEnabled | PackageRuntime | Package Runtime APIs | 0 | 1 |
| Feature_PushNotifications | AlwaysEnabled | PushNotifications | Push Notifications for the WindowsAppRuntime | 0 | 1 |
| Feature_StoragePickers | AlwaysEnabled | StoragePickers | StoragePickers for the WindowsAppRuntime | 0 | 1 |
| Feature_StoragePickers2 | AlwaysEnabled | StoragePickers2 | New functionalities in Microsoft.Windows.Storage.Pickers in WindowsAppSDK 2.0 | 0 | 1 |

## Composants source

| dépôt | composant | idl | types IDL | livrés reliés | spec | test |
|---|---|---|---|---|---|---|
| WindowsAppSDK | AccessControl | 1 | 3 | 3 |  |  |
| WindowsAppSDK | AppLifecycle | 1 | 5 | 5 | specs/AppLifecycle | test/AppLifecycle |
| WindowsAppSDK | AppNotifications | 2 | 22 | 20 | specs/AppNotifications |  |
| WindowsAppSDK | ApplicationData | 1 | 5 | 5 | specs/applicationdata | test/ApplicationData |
| WindowsAppSDK | BackgroundTask | 1 | 2 | 2 | specs/BackgroundTask |  |
| WindowsAppSDK | Bootstrap | 0 | 0 | 0 |  |  |
| WindowsAppSDK | Common | 0 | 0 | 0 |  | test/Common |
| WindowsAppSDK | Decimal | 1 | 3 | 3 | specs/decimal | test/Decimal |
| WindowsAppSDK | Deployment | 1 | 5 | 5 | specs/Deployment | test/Deployment |
| WindowsAppSDK | DeploymentAgent | 0 | 0 | 0 |  |  |
| WindowsAppSDK | Detours | 0 | 0 | 0 |  |  |
| WindowsAppSDK | DynamicDependency | 1 | 9 | 9 |  | test/DynamicDependency |
| WindowsAppSDK | DynamicDependencyDataStore | 1 | 0 | 0 |  |  |
| WindowsAppSDK | DynamicDependencyLifetimeManager | 2 | 0 | 0 |  |  |
| WindowsAppSDK | EnvironmentManager | 1 | 2 | 2 |  |  |
| WindowsAppSDK | Interop | 2 | 17 | 17 |  |  |
| WindowsAppSDK | Licensing | 0 | 0 | 0 |  |  |
| WindowsAppSDK | MRTCore | 1 | 12 | 12 | specs/mrtcore |  |
| WindowsAppSDK | Notifications | 1 | 3 | 3 |  |  |
| WindowsAppSDK | OAuth | 1 | 13 | 13 | specs/OAuth |  |
| WindowsAppSDK | Package | 1 | 5 | 0 | specs/package | test/Package |
| WindowsAppSDK | PackageManager | 1 | 29 | 29 | specs/packagemanager | test/PackageManager |
| WindowsAppSDK | PowerNotifications | 1 | 10 | 10 |  | test/PowerNotifications |
| WindowsAppSDK | Projections | 0 | 0 | 0 |  |  |
| WindowsAppSDK | PushNotifications | 2 | 7 | 7 | specs/PushNotifications |  |
| WindowsAppSDK | RestartAgent | 0 | 0 | 0 |  |  |
| WindowsAppSDK | RuntimeCompatibilityOptions | 1 | 4 | 4 |  |  |
| WindowsAppSDK | UndockedRegFreeWinRT | 0 | 0 | 0 |  |  |
| WindowsAppSDK | VersionInfo | 1 | 3 | 3 | specs/VersionInfo | test/VersionInfo |
| WindowsAppSDK | WindowsAppRuntime_BootstrapDLL | 0 | 0 | 0 |  |  |
| WindowsAppSDK | WindowsAppRuntime_DLL | 0 | 0 | 0 |  |  |
| WindowsAppSDK | WindowsAppRuntime_Insights | 0 | 0 | 0 |  |  |
| WindowsAppSDK | WindowsAppRuntime_UniversalBGTaskDLL | 1 | 2 | 2 |  |  |
| microsoft-ui-xaml | AnimatedIcon | 10 | 12 | 10 |  |  |
| microsoft-ui-xaml | AnimatedVisualPlayer | 2 | 9 | 8 |  |  |
| microsoft-ui-xaml | AnnotatedScrollBar | 1 | 5 | 5 |  |  |
| microsoft-ui-xaml | AutoSuggestBox | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | Breadcrumb | 2 | 4 | 4 |  |  |
| microsoft-ui-xaml | ColorPicker | 7 | 10 | 9 |  |  |
| microsoft-ui-xaml | ComboBox | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | CommandBarFlyout | 2 | 5 | 5 |  |  |
| microsoft-ui-xaml | Common | 2 | 4 | 4 |  |  |
| microsoft-ui-xaml | DropDownButton | 2 | 2 | 2 |  |  |
| microsoft-ui-xaml | Effects | 1 | 106 | 0 |  |  |
| microsoft-ui-xaml | Expander | 2 | 6 | 6 |  |  |
| microsoft-ui-xaml | IconSource | 1 | 2 | 2 |  |  |
| microsoft-ui-xaml | ImageIcon | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | InfoBadge | 1 | 2 | 2 |  |  |
| microsoft-ui-xaml | InfoBar | 1 | 9 | 8 |  |  |
| microsoft-ui-xaml | InkCanvas | 2 | 14 | 0 |  |  |
| microsoft-ui-xaml | InkToolbar | 4 | 31 | 0 |  |  |
| microsoft-ui-xaml | Interactions | 2 | 4 | 0 |  |  |
| microsoft-ui-xaml | ItemContainer | 1 | 7 | 2 |  |  |
| microsoft-ui-xaml | ItemsView | 2 | 6 | 5 |  |  |
| microsoft-ui-xaml | LayoutPanel | 1 | 1 | 0 |  |  |
| microsoft-ui-xaml | Lights | 5 | 5 | 0 |  |  |
| microsoft-ui-xaml | MapControl | 1 | 7 | 7 |  |  |
| microsoft-ui-xaml | Materials | 7 | 11 | 4 |  |  |
| microsoft-ui-xaml | MenuBar | 2 | 5 | 5 |  |  |
| microsoft-ui-xaml | MonochromaticOverlayPresenter | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | NavigationView | 3 | 23 | 23 |  |  |
| microsoft-ui-xaml | NumberBox | 1 | 5 | 5 |  |  |
| microsoft-ui-xaml | PagerControl | 2 | 6 | 0 |  |  |
| microsoft-ui-xaml | ParallaxView | 1 | 2 | 2 |  |  |
| microsoft-ui-xaml | PersonPicture | 2 | 3 | 3 |  |  |
| microsoft-ui-xaml | PipsPager | 2 | 6 | 6 |  |  |
| microsoft-ui-xaml | ProgressBar | 1 | 3 | 3 |  |  |
| microsoft-ui-xaml | ProgressRing | 1 | 3 | 3 |  |  |
| microsoft-ui-xaml | PullToRefresh | 6 | 16 | 8 |  |  |
| microsoft-ui-xaml | RadialGradientBrush | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | RadioButtons | 3 | 4 | 3 |  |  |
| microsoft-ui-xaml | RadioMenuFlyoutItem | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | RatingControl | 2 | 5 | 5 |  |  |
| microsoft-ui-xaml | Repeater | 5 | 85 | 49 |  |  |
| microsoft-ui-xaml | ResizeGripper | 2 | 4 | 0 |  |  |
| microsoft-ui-xaml | ScrollPresenter | 4 | 41 | 33 |  |  |
| microsoft-ui-xaml | ScrollView | 2 | 3 | 2 |  |  |
| microsoft-ui-xaml | SelectorBar | 2 | 5 | 4 |  |  |
| microsoft-ui-xaml | SortIndicator | 2 | 3 | 0 |  |  |
| microsoft-ui-xaml | SplitButton | 3 | 7 | 6 |  |  |
| microsoft-ui-xaml | SwipeControl | 2 | 11 | 10 |  |  |
| microsoft-ui-xaml | SystemBackdropElement | 1 | 1 | 1 |  |  |
| microsoft-ui-xaml | TabView | 1 | 16 | 16 |  |  |
| microsoft-ui-xaml | TableView | 2 | 32 | 0 |  |  |
| microsoft-ui-xaml | TabularShaping | 1 | 1 | 0 |  |  |
| microsoft-ui-xaml | TeachingTip | 3 | 11 | 9 |  |  |
| microsoft-ui-xaml | TestHooks | 1 | 2 | 0 |  |  |
| microsoft-ui-xaml | TitleBar | 1 | 3 | 3 |  |  |
| microsoft-ui-xaml | TreeView | 2 | 15 | 15 |  |  |
| microsoft-ui-xaml | TwoPaneView | 2 | 7 | 5 |  |  |
| microsoft-ui-xaml | WebView2 | 2 | 3 | 3 |  |  |
| microsoft-ui-xaml | WrapPanel | 1 | 2 | 0 |  |  |
| microsoft-ui-xaml | dll-tabular | 1 | 2 | 0 |  |  |
| microsoft-ui-xaml | dxaml/com | 5 | 0 | 0 |  |  |
| microsoft-ui-xaml | dxaml/winrt | 8 | 1029 | 950 |  |  |

## Types livrés sans source publique

Types publics (hors interfaces exclusiveTo) absents des IDL des deux dépôts : composants livrés en binaire uniquement
(Composition, Input, Windowing, Content, Text, IA, Widgets, Search…) ou types du cœur XAML générés à la compilation (modèle XamlOM de dxaml).

- Microsoft.UI.Composition : 195
- Microsoft.UI.Input : 73
- Microsoft.UI.Xaml : 68
- Microsoft.Windows.AI : 57
- Microsoft.Windows.Widgets : 50
- Microsoft.Windows.Search : 49
- Microsoft.UI.Text : 34
- Microsoft.UI.Content : 28
- Microsoft.UI.Windowing : 18
- Microsoft.UI.Dispatching : 8
- Microsoft.Graphics.DirectX : 4
- Microsoft.Graphics.Display : 4
- Microsoft.Graphics.Imaging : 3
- Microsoft.Windows.Vision : 3
- Microsoft.Windows.SemanticSearch : 2
- Microsoft.Windows.Workloads : 2
- Microsoft.Foundation.WindowsAppSDKContract : 1
- Microsoft.UI.ClosableNotifierHandler : 1
- Microsoft.UI.ColorHelper : 1
- Microsoft.UI.Colors : 1
- Microsoft.UI.DisplayId : 1
- Microsoft.UI.IClosableNotifier : 1
- Microsoft.UI.IconId : 1
- Microsoft.UI.System : 1
- Microsoft.UI.WindowId : 1
