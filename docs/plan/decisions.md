# Décisions (ADR) — 2026-11-12

Chaque décision cite la mesure ou la source qui la fonde. Mesures brutes : `docs/research/bench/`.

| # | Décision | Fondement |
|---|---|---|
| D1 | Noyau `no_std`, état statique tout-à-zéro (`.bss`) | wasm 1 284 374 o avec un champ non nul → **14 568 o** tout-à-zéro (mesuré) |
| D2 | `boot()` remet à zéro champ par champ | `*self = ZERO` créait un temporaire ~640 Kio sur la pile (clippy `large_stack_arrays`) |
| D3 | ABI unique générée par `nt_kernel::export_c_abi!` | partagée par `nt-web` (wasm32) et `nt-ffi` (staticlib) — zéro duplication |
| D4 | Fork `aphrody-labs/windows-rs` en dépendance git épinglée (`rev = 8ca69fda`), révisé le 2026-11-12 (avant : chemin local `vendor/`) | crate `windows` 0.100 absent de crates.io (max 0.62.2) ; écart au plan : crate `windows` du fork avec features minimales au lieu de `windows-bindgen` (S0.5 reporté, binaire final 126 Ko donc sans enjeu de taille) |
| D5 | DXC = release GitHub v1.9.2609 | le NuGet `Microsoft.Direct3D.DXC` 101.7.2207.25 embarque dxcompiler **1.7.2207** (`dxc --version`) |
| D6 | Agility SDK 1.620.2, export `D3D12SDKVersion=620` + `D3D12SDKPath` | `D3D12_SDK_VERSION 620` (d3d12.h du paquet) ; `D3D12Core.dll 1.620.2.0.20261106.5` chargé (modules du process) |
| D7 | Swapchain 4K flip-discard ×3, tearing, waitable latence 1 | `DXGI_FEATURE_PRESENT_ALLOW_TEARING` = vrai (sonde) ; GPU p99 0,32 ms |
| D8 | WebGPU : quads instanciés + SDF, un seul draw | GPU p50 0,197 ms / p99 2,42 ms à 4K (Chrome 158) |
| D9 | Mesure hors-écran (`?bench=N`, `--bench N`) | rAF étranglé à 1 Hz quand la fenêtre Chrome est occultée (mesuré) |
| D10 | .NET : exe unique NativeAOT + `DirectPInvoke` + `nt_ffi.lib` (no_std) | Learn « Native code interop with Native AOT » ; 1 089 024 o, pas de DLL noyau |
| D11 | C++23 en-têtes standard, CMake preset (VS 2026) + FetchContent épinglé ; `import std` retiré (porte expérimentale CMake 4.4) | sonde compilée `/W4 /WX /permissive-` avec WIL + DirectX-Headers |
| D12 | GPU cible confirmé : SM 6.9, DXR 1.2, mesh tier 1, work graphs 1.0, enhanced barriers, GPU upload heap | `docs/research/bench/gpu-probe-2026-11-12.json` |

## Écarts / dette

- S0.5 (`windows-bindgen`) non fait : remplacé par D4.
- HDR (R10G10B10A2 + Advanced Color) non câblé : écran HDR mesuré, à faire.
- Parité d'image HLSL/WGSL non automatisée (§4.3) : mêmes formules, comparaison pixel à écrire.
- `bun compile` (AOT) indisponible en 1.4.4 → `bun build` pour le web.
