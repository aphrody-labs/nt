# 01 — Stack retenue

Versions = état sourcé du 2026-11-12 ([facts.json](../research/facts.json)). Toute version est **épinglée** (fichier de toolchain, SHA vendor, CPM NuGet, lockfiles) et mise à jour par décision explicite, jamais implicitement.

## Principes

1. **Un seul noyau** (`nt-kernel`, Rust) partagé par toutes les cibles ; les langages communiquent par une **ABI C unique** (header généré).
2. **Zéro legacy** : pas de FXC/D3DCompiler (DXC seulement), pas de `windows`/`windows-sys` umbrella dans les libs, pas de Mono, pas de VSTest, pas d'outils JS tiers si bun le fait, pas de `.sln` (`.slnx`).
3. **Économe par construction** : pas d'allocation dans les boucles chaudes, rendu piloté par événements quand rien ne bouge, binaires minimaux (`build-std` + `immediate-abort`), vendoring partiel.
4. **Baseline CPU unique x86-64-v3** (alignée sur la cible ReadyToRun de .NET 11 sous Windows, Learn) ; aarch64 : `armv8.2-a+rcpc` (même source).

## Par couche

| Couche | Choix | Version épinglée | Source |
|---|---|---|---|
| Noyau | Rust nightly, `#![no_std]`, sans `alloc` dans le chemin chaud | `nightly-2026-11-11` | `rustc +nightly -V` |
| Bindings Windows (Rust) | **fork** windows-rs (vendor, SHA épinglé) : `windows-core`, `windows-link`, `windows-window`, `windows-bindgen` → bindings D3D12/DXGI **générés** dans le dépôt | windows-rs @ 2026-11-11 (core 0.101.0 main, 0.100.0 crates.io) | windows-rs `docs/readme.md` |
| Rendu natif | Direct3D 12 + DXGI flip-discard, tearing, frame-latency waitable ; Agility SDK | 1.620.2 (stable) ; 1.722.1-preview pour SM 6.10 | NuGet, DirectX-Headers |
| Shaders natifs | HLSL 202x → DXIL via **DXC** ; SM 6.6 minimum, 6.9/6.10 si `CheckFeatureSupport` OK | DXC v1.9.2609 / NuGet 101.7.2207.25 | DXC ReleaseNotes |
| Rendu navigateur | WebGPU + WGSL, `powerPreference: "high-performance"` ; features optionnelles : subgroups, immediates | Edge ≥ 157 / Chrome ≥ 158 | notes Edge Learn, Chrome versionhistory |
| Noyau navigateur | `wasm32-unknown-unknown`, exports C bruts (pas de wasm-bindgen), mémoire partagée vue zero-copy par TS | — | — |
| Hôte web / outils | **bun** : `Bun.serve` routes HTML (bundling intégré), `bun build --compile`, `bun test`, `bun check -b`, `bun fmt` | 1.4.4 | vendor/bun/docs |
| Shell & apps | .NET 11 **NativeAOT**, C# 15, `LibraryImport` vers l'ABI C, CsWin32 pour Win32 | SDK 11.0.100, ILCompiler 11.0.0, CsWin32 0.3.371 | Learn « What's new in .NET 11 », NuGet |
| Libs .NET partagées | `net10.0;net11.0` (LTS + STS) | 10.0.15 / 11.0.0 | release-metadata |
| Tests .NET | MSTest SDK sur Microsoft.Testing.Platform | MSTest.Sdk 4.5.3, MTP 2.5.3 | NuGet |
| UI déclarative (option) | `windows-reactor` (Rust, WinUI 3) ou WinUI 3 via WinAppSDK 2.6.5 | — | windows-rs, WinAppSDK releases |
| C++ | C++23, `import std`, MSVC 14.52 / clang-cl 23, CMake presets + Ninja ; WIL, DirectX-Headers, DirectXMath | STL main 2026-10-29 | STL `stl/modules/std.ixx` |
| Allocateur natif | mimalloc v3.6.1 (C/C++), arènes fixes dans le noyau | v3.6.1 | GitHub releases |
| Isolation / VM | hyperlight (micro-VM, guests `no_std`), openvmm, mxc, litebox (modèle North/South) | 0.19.0 / v0.4.0 / v1.0.1 / v0.1.0 | READMEs vendor |
| Pilotes | windows-drivers-rs | wdk 0.5.0 | crates.io |
| GC expérimental | runtimelab ZeroGC / ZeroGC.rs (mesures uniquement) | branche 2026-09-22 | runtimelab README |
| Orchestration | `just` (une recette par cible) | installé | — |
| Cache build | sccache (Rust + C++) | installé | — |

## Profils de compilation (Rust)

Repris des dépôts MS (edit, openvmm, mxc, sudo) :

| Profil | Réglages | Usage |
|---|---|---|
| `dev` | deps `opt-level = 2`, crate `opt-level = 1` | itération |
| `release` | `lto = "fat"`, `codegen-units = 1`, `panic = "immediate-abort"`, `strip`, `debug = "line-tables-only"` + split debuginfo | livrables |
| `wasm` | hérite `release`, `opt-level = 3` (perf frame) puis mesurer `"s"` | noyau navigateur |
| `[unstable]` (via `--config .cargo/release.toml`) | `build-std = ["core"]` (wasm) / `["std","panic_abort"]` (natif), `panic-immediate-abort = true` | release seulement |
| Windows msvc | `-Ctarget-cpu=x86-64-v3`, `-Ccontrol-flow-guard`, `+crt-static`, `/DYNAMICBASE /CETCOMPAT`, `ucrt.lib` dynamique | sécurité + taille |
| wasm32 | `-Ctarget-feature=+simd128` (bulk-memory, sign-ext, nontrapping-fptoint, multivalue, reference-types, mutable-globals déjà actifs par défaut : `rustc +nightly --print cfg --target wasm32-unknown-unknown`) ; `relaxed-simd` seulement si détecté côté navigateur | perf |

## Profils .NET

Sources : Learn « Optimize AOT deployments », « NativeAOT for gaming » (GDK 2610), « What's new in .NET 11 runtime ».

- `PublishAot=true`, `OptimizationPreference=Speed` (défaut recommandé pour le code temps réel).
- `InvariantGlobalization=true` seulement pour les composants sans formatage culturel (pas le shell localisé).
- `UseSystemResourceKeys=false` et `StackTraceSupport=true` (sinon diagnostic des crashs dégradé — Learn).
- `IlcInstructionSet=x86-64-v3` : décision assumée (= minimum matériel du cahier des charges, = cible R2R .NET 11 Windows) ; Learn rappelle que cela relève la config minimale.
- `<Features>runtime-async=on</Features>` (preview .NET 11, plus besoin de `EnablePreviewFeatures`).
- `TreatWarningsAsErrors`, CPM + transitive pinning, `.slnx`, MSTest SDK sur MTP.

## Cibles de cross-compilation

| Cible | Rust | .NET | C++ |
|---|---|---|---|
| x86_64-pc-windows-msvc | oui | win-x64 AOT | MSVC/clang-cl |
| aarch64-pc-windows-msvc | oui | win-arm64 AOT | MSVC ARM64 |
| wasm32-unknown-unknown | oui (noyau navigateur) | — | — |
| wasm32-wasip2 | oui (composants, cf. wassette) | — | — |
| x86_64-unknown-linux-musl | oui (guests hyperlight / CI) | linux-musl-x64 AOT | clang |

## Politique de vendoring (économie)

- `vendor/manifest.toml` : dépôt, SHA, **chemins sparse**, raison. Clone `--depth 1 --filter=blob:none --sparse`.
- Budget disque vendor : **≤ 1,5 Go** (actuel ≈ 7 Go à réduire : DirectX-Graphics-Samples → `Samples/Desktop/D3D12{HelloWorld,Fullscreen,HDR,MeshShaders,AdvancedShaderDelivery}` ; microsoft-ui-xaml, WindowsAppSDK, win32metadata → docs + headers utiles ; bun → `docs/`, `packages/bun-types/`).
- Forks réels (patchés) : windows-rs uniquement au départ, consommé par `[patch.crates-io]` ; les autres dépôts sont en lecture seule.
- `vendor/` hors git ; reconstruction par `just vendor`.
