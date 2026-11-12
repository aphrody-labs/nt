# 00 — Analyse (état au 2026-11-12)

Règle : aucune affirmation sans source datée. Faits machine-vérifiables dans [`../research/facts.json`](../research/facts.json) (collecté le 2026-11-12 via NuGet, crates.io, GitHub API, dotnetcli release-metadata, chromestatus). Sources détaillées : [sources.md](sources.md).

## Poste cible (mesuré)

| Élément | Valeur | Conséquence |
|---|---|---|
| CPU | i7-13700F, 16 c / 24 t | x86-64-v3 (AVX2) OK, **pas d'AVX-512** |
| GPU | RTX 4070, driver 621.14, compute 8.9, PCIe gen 4 | DX12 + WebGPU (backend D3D12 côté navigateur à vérifier en phase 0) |
| Écran | **2560x1440 @ 144 Hz** | « 4K 120 » = rendu interne 3840x2160 ; validation native impossible sans écran 4K120 |
| OS | Windows 11 Insider **Dev**, build 28120.3302 (26H1, `br_release_flt`) | work graphs exigent 24H2+ (Learn) → OK |
| Pile graphique (dxdiag) | **WDDM 3.2**, feature level **12_2**, HAGS actif, **Resizable BAR** (BAR1 16 Go), MPO 4 plans avec HDR | flip-model + MPO exploitables (à mesurer en S0.2) |
| HDR | écran HDR (max 553 nits), Advanced Color ON | swapchain HDR en option, format à valider en S0.2 |
| Sécurité | VBS actif (`SecurityServicesRunning` = 2), Secure Boot, `testsigning` OFF, `flightsigning` ON | pilotes de test impossibles sans changement de boot ; user-mode non affecté |

Profil complet régénérable : skill `windows-machine` (`~/.claude/skills/windows-machine/profile.md`). Rust livré dans ce build : [../research/rust-in-windows.md](../research/rust-in-windows.md).
| Rust | nightly 1.102.0 (2026-11-11), LLVM 23.1.5, `rust-src`, `llvm-tools`, `miri` | `build-std` possible |
| Cibles Rust | x86_64/aarch64-pc-windows-msvc, wasm32-unknown-unknown, wasm32-wasip2, x86_64-unknown-linux-musl… | cross-compile sans installation |
| .NET | SDK 11.0.100 (GA 2026-11-10, STS), 10.0.15 LTS | multi-cible net10.0/net11.0 |
| C++ | MSVC 14.52.37025, clang 23.1.4, CMake 4.4.4 | C++23 + `import std` |
| bun | 1.4.4 (2026-10-22) | `bun check -b`, `bun fmt` ; `bun lint` absent (doc upstream seulement) |

## Hypothèses corrigées par la recherche

| Hypothèse (mémoire) | Réalité sourcée |
|---|---|
| `windows` 0.100 sur crates.io | crates.io : `windows` max **0.62.2** (2025-10-06) ; `windows-core`/`bindgen`/`window`/`link` en **0.100.0** (2026-09-03). Le crate `windows` 0.100 n'existe que dans le dépôt → fork/vendor obligatoire pour l'utiliser |
| Utiliser le crate `windows` | windows-rs `docs/readme.md` : les bibliothèques doivent **éviter** `windows`/`windows-sys` et générer leurs bindings via `windows-bindgen` |
| `-Zbuild-std-features=panic_immediate_abort` | microsoft/edit `.cargo/release.toml` : `panic = "immediate-abort"` + `[unstable] panic-immediate-abort = true`, `build-std = ["std","panic_abort"]` |
| SM 6.10 disponible | Learn (PIX, oct. 2026) : SM 6.10 **preview Agility SDK uniquement** ; DXC main : « SM 6.10 / DXIL 1.10 now available in retail » (release à venir). Agility stable 1.620.2, preview 1.722.1 |
| DXR 2.0 dispo | Learn : DXR 2.0 preview Agility uniquement (oct. 2026) |
| C++26 dans MSVC | STL `yvals_core.h` : 82 papiers C++23 ; C++26 = 1 papier partiel (P1383R2). `stl/modules/std.ixx` présent |
| .NET in-browser = Mono | .NET 11 : CoreCLR WASM, WebCIL V1, NativeAOT WASM publish ; runtimelab `feature/NativeAOT-LLVM` (WASM seul) |
| Roadmap WinAppSDK à jour | `docs/roadmap.md` parle de 1.7 ; release réelle 2.6.5 (2026-11-03) → doc périmée, se fier aux releases |
| WinUI fermé | microsoft-ui-xaml : sources publiées (MIT, `dxaml/`, `src/`), contributions de code pas encore acceptées |

## Écosystème Microsoft récent pertinent (vendorisé, `vendor/`)

| Domaine | Dépôt (dernier push) | Usage dans nt |
|---|---|---|
| Bindings Windows Rust | windows-rs (2026-11-11) : core, link, bindgen, window, reactor, canvas, composition, webview… | fork, bindings minimaux générés |
| Pilotes Rust | windows-drivers-rs `wdk 0.5.0` (2026-10-26) | phase pilotes |
| VMM / isolation | openvmm `v0.4.0` (2026-10-28), hyperlight `v0.19.0` (2026-11-04), mxc `v1.0.1`, litebox `v0.1.0` | plateformes « South » du noyau |
| GPU | DirectX-Headers (Agility 1.620.2 / 1.722.1-preview), DXC v1.9.2609, DirectX-Graphics-Samples, DirectXMath, DirectStorage 1.3.0 | rendu natif |
| C++ | STL (`import std`), WIL, mimalloc v3.6.1, snmalloc | composants natifs |
| .NET | runtimelab : ZeroGC, **ZeroGC.rs** (GC CoreCLR en Rust), NativeAOT-LLVM | .NET économe |
| Win32 metadata | win32metadata v71.0.45-preview, CsWin32 0.3.371 | interop .NET |
| Shell/apps | terminal v1.26, WSL 3.0.5, edit v2.0.0, sudo, coreutils | références d'outillage |

Pratiques de build relevées dans les dépôts MS (fichiers `Cargo.toml`/`.cargo/config.toml`) :
- edit/coreutils : `lto = true`, `codegen-units = 1`, `opt-level = "s"`, `panic = "abort"`, CRT statique + `ucrt.lib` dynamique (évite `vcruntime140.dll`).
- openvmm : profil ship `lto = "fat"`, `codegen-units = 1`.
- mxc/sudo : `-Ccontrol-flow-guard`, `+crt-static`, `/guard:cf /DYNAMICBASE /CETCOMPAT /LTCG`.
- wassette : toolchain épinglée, cibles `wasm32-wasip1/2`.

## Web (navigateur)

- Chrome stable 158.0.8127.18, Edge stable 157.0.4341.46 (APIs officielles, 2026-11-12).
- WebGPU livré dans Edge (notes Learn) : 146 transient attachments, compat mode, WebNN ; 148 `linear_indexing` ; 150 **Immediates** ; 152 **subgroup size control** ; 153 `buffer_view` ; 156 fragment depth ; 157 atomic vec2u min/max, HTML-in-canvas.
- chromestatus affiche « Proposed » pour des features déjà livrées : se fier au jalon + notes Edge, et à `adapter.features` à l'exécution.

## Contraintes non techniques

- Marques : les dépôts MS (ex. litebox README) interdisent d'impliquer un parrainage Microsoft. Le projet s'appelle **nt**, jamais « Windows » ; aucun logo MS.
- Licences assets : Fluent System Icons **MIT**, Fluent Emoji **MIT**, Cascadia Code **SIL OFL 1.1** (nom réservé). Segoe UI = propriétaire → interdit.
- windows-rs MIT/Apache-2.0 ; DXC licence LLVM + MIT (headers) ; STL Apache-2.0 avec exception LLVM (fichier LICENSE).

## Coût du vendoring actuel (mesuré)

DirectX-Graphics-Samples 3,0 Go, bun 935 Mo, microsoft-ui-xaml 851 Mo, WindowsAppSDK 336 Mo, win32metadata 327 Mo. → politique de vendoring partiel obligatoire (voir 01-stack).
