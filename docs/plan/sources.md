# Sources (consultées le 2026-11-12)

## Données collectées automatiquement
- `docs/research/facts.json` — NuGet flat container, crates.io API, GitHub REST (releases, repos), `dotnetcli.blob.core.windows.net/.../releases-index.json`, chromestatus API.
- Chrome : `versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions` → 158.0.8127.18.
- Edge : `edgeupdates.microsoft.com/api/products` → Stable 157.0.4341.46, Beta 158.0.4370.16, Canary 159.0.4397.0.
- `docs/ms/data/repos.json` — 16 873 dépôts publics de 16 organisations Microsoft (GitHub REST, tri par push).
- Poste : `rustc +nightly -Vv`, `rustup target list --installed`, `dotnet --list-sdks`, `clang++ --version`, `nvidia-smi`, `Get-CimInstance Win32_Processor/VideoController/OperatingSystem`.

## Microsoft Learn
- What's new in .NET 11 (overview, runtime) — learn.microsoft.com/dotnet/core/whats-new/dotnet-11/
- Minimum hardware requirements updated (.NET 11) — learn.microsoft.com/dotnet/core/compatibility/jit/11/minimum-hardware-requirements
- What's new in C# 15 — learn.microsoft.com/dotnet/csharp/whats-new/csharp-15
- Optimize AOT deployments — learn.microsoft.com/dotnet/core/deploying/native-aot/optimizing
- Native code interop with Native AOT — learn.microsoft.com/dotnet/core/deploying/native-aot/interop
- NativeAOT for gaming (GDK 2610) — learn.microsoft.com/gaming/gdk/docs/gdk-dev/pc-dev/tutorials/get-started-with-custom-engine/native-aot-for-gaming
- D3D12SDKVersion symbol — learn.microsoft.com/windows/win32/direct3d12/nf-d3d12-d3d12sdkversion
- ID3D12SDKConfiguration::SetSDKVersion — learn.microsoft.com/windows/win32/api/d3d12/nf-d3d12-id3d12sdkconfiguration-setsdkversion
- Direct3D 12 programming environment setup (C++ seul langage supporté) — learn.microsoft.com/windows/win32/direct3d12/directx-12-programming-environment-set-up
- PIX : DirectX Raytracing (DXR tiers, état oct. 2026) ; Generate DirectX dump files (SM 6.10 preview) — learn.microsoft.com/windows/pix/
- Work graphs (WDDM 3.2, Windows 11 24H2) — learn.microsoft.com/windows-hardware/drivers/display/work-graphs
- Microsoft Edge web platform release notes 146–157 — learn.microsoft.com/microsoft-edge/web-platform/release-notes/{146..157}

## Dépôts vendorisés (`vendor/`, clones du 2026-11-12, `--depth 1`)
- microsoft/windows-rs : `docs/readme.md` (crates, consigne bindgen), `crates/libs/window/src/window.rs` (`run_with`), `crates/libs/windows/src/Windows/Win32/dxgi/mod.rs` (tearing, waitable, GPU preference, scaling), `crates/samples/windows/direct3d12/src/main.rs`.
- microsoft/edit : `.cargo/release.toml` (build-std, immediate-abort, CRT), README (build nightly).
- microsoft/openvmm, microsoft/mxc, microsoft/sudo, microsoft/coreutils, microsoft/wassette, hyperlight-dev/hyperlight, microsoft/litebox, microsoft/windows-drivers-rs : `Cargo.toml` profils, `.cargo/config.toml`, `rust-toolchain*`, README.
- microsoft/STL : `stl/inc/yvals_core.h` (C++23/26), `stl/modules/std.ixx`, `LICENSE.txt`.
- microsoft/DirectXShaderCompiler : `docs/ReleaseNotes.md` (SM 6.10 retail dans la release à venir, HLSL 2026 compat).
- microsoft/DirectX-Graphics-Samples : `Samples/Desktop/*` (AdvancedShaderDelivery, StateObjectDatabase, 2026-10-28).
- microsoft/microsoft-ui-xaml (sources WinUI, contributions non ouvertes), microsoft/WindowsAppSDK (`docs/roadmap.md` périmé).
- oven-sh/bun : `docs/` (fmt, check, lint, compiler, bundler/fullstack), `Cargo.toml` (`line-tables-only`).
- dotnet/runtimelab (branches via GitHub API) : `feature/ZeroGC`, `feature/ZeroGC.rs`, `feature/NativeAOT-LLVM` (README).

## Spécifications
- gpuweb/gpuweb `spec/index.bs` (via Context7) : `GPUAdapter.info/features/limits`, `getPreferredCanvasFormat`, `onSubmittedWorkDone`, `GPUFeatureName` (timestamp-query, subgroups, subgroup-size-control, atomic-vec2u-min-max…), contexte sécurisé ; wiki WG 2025-11-05 (immediates).

## Licences / marques
- microsoft/Selawik README (« open source replacement for Segoe UI »), licence OFL-1.1 ; microsoft/cascadia-code `LICENSE` (OFL-1.1, nom réservé) ; fluentui-system-icons, fluentui-emoji (MIT) ; litebox README (clause marques).
