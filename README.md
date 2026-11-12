# nt

Environnement de bureau open source inspiré de l'architecture NT : un noyau Rust nightly `no_std` unique, rendu **WebGPU** dans le navigateur et **Direct3D 12** en natif, shell **.NET 11 NativeAOT**, sonde **C++23** (CMake, WIL, DirectX-Headers), outillage **bun**. Plan, cahier des charges et design : [docs/plan/](docs/plan/README.md).

## Mesures (2026-11-12, RTX 4070, rendu 3840x2160, 10 039 instances)

| Cible                                | GPU p50 / p99   | CPU p99  | Débit     | Binaire                                   |
| ------------------------------------ | --------------- | -------- | --------- | ----------------------------------------- |
| nt in browser (Chrome 158, WebGPU)   | 0,197 / 2,42 ms | 0,40 ms  | 1 551 fps | wasm 14,2 Kio, page 22,6 Ko (9,3 Ko gzip) |
| natif Direct3D 12 (Agility 1.620.2)  | 0,252 / 0,32 ms | 0,27 ms  | ~870 fps  | exe 123,5 Kio                             |
| shell .NET 11 NativeAOT (tick noyau) | —               | 0,026 ms | —         | exe 1,04 Mio                              |

Budget 120 Hz : 8,33 ms/frame. Détail : `docs/research/bench/`.

## Arborescence

```
src/rust/nt-kernel   noyau no_std (objets, compositeur, entrées), ABI C par macro
src/rust/nt-web      cible wasm32 (exports bruts)
src/rust/nt-ffi      staticlib no_std pour .NET / C++
src/rust/nt-d3d12    hôte D3D12 (fork aphrody-labs/windows-rs en dépendance git épinglée, DXC 1.9.2609, Agility SDK)
src/web              hôte WebGPU (TS/bun), shader WGSL, serveur Bun.serve
src/dotnet/Nt.Shell  shell .NET 11 NativeAOT (DirectPInvoke statique)
src/cpp/nt-gpu-probe sonde capacités D3D12 (C++23, CMake preset, WIL + DirectX-Headers via FetchContent)
docs/                plan, recherche datée, index écosystème Microsoft / bun / skills
tools/               fetch-tools.ts (DXC + Agility SDK par OS hôte), stage-native.ts ; binaires dans tools/dxc (hors git)
```

## Commandes

`just tools` (DXC + Agility) · `just test` · `just lint` · `just build` · `just serve` (http://localhost:8787/?res=3840x2160&n=10000, `&bench=1200`) · `just bench-native` · `just cross`
