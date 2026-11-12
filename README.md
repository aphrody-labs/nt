# nt

Modèle du **vrai** Windows NT de ce poste, en direct et rendu entièrement par le GPU, sur la pile Microsoft.
Architecture et décisions : [docs/plan/architecture-microsoft.md](docs/plan/architecture-microsoft.md).

```
base/shell/explorer/  coque native WinUI 3 (place d'explorer.exe) (Windows App SDK 2.6.5 : Fluent, Mica, NavigationView, WebView2)
modules/web/        portage navigateur : scène GPU du noyau : WebGPU 3840x2160 MSAA 4x, boîtes instanciées + atlas glyphes/icônes, sans texte DOM
sdk/tools/host/     lecture du Windows réel via bun:ffi
                    ntsys.ts        ntdll : processeurs, compteurs, processus/threads, pilotes, pool, types et espace de noms d'objets
                    winindex.ts     index NTFS de %SystemRoot% (FindFirstFileExW + SQLite FTS5 + en-têtes PE)
                    pe.ts           lecteur PE/COFF (exports, imports, ressources)
                    pe-icon.ts      icônes réelles des PE, chemins des processus, volume NTFS et $MFT
                    desktop-svg.ts  bureau entier vectorisé en SVG (UI Automation)
                    server.ts       Bun.serve : WebSocket /kernel, /api/icon, /api/index, /desktop.svg
sdk/tools/msindex/  index récursif de la pile Microsoft (ECMA-335, API Sets, chargeur, registre WinRT, RoGetActivationFactory), verrouillé
sdk/tools/gpuprobe/ sonde des capacités Direct3D 12 (C++23 `import std`, CMake 4.5 + Ninja, vcpkg : WIL, DirectX-Headers)
sdk/tools/          fetch-tools.ts : DXC 1.9.2609, Agility SDK 1.620.2, niubash 1.5.0, CMake 4.5.0, Ninja 1.13.2 ; vsdev.ts : environnement VS
sdk/vcpkg/ports/    ports vcpkg aphrody-labs (overlay) : directx-headers 1.620.2, wil
sdk/rust/           WinUI 3 depuis Rust (windows-reactor, fork windows-rs épinglé)
.config/            configuration.winget : poste de développement (WinGet Configuration v3, DSC v3)
docs/               plan/ (architecture), research/ (faits relevés sur le poste), bun/, interop/,
                    msindex/ (pile Microsoft indexée et prouvée sur le poste : just msindex <src>)
```

Le cœur Rust de nt est le monorepo à plat basé sur windows-rs : fork `aphrody-labs/windows-rs` (master).

```
just serve        # http://localhost:8787/  (?report=1 : mesure d'affichage réelle)
just index        # index de C:\Windows
just setup        # poste Windows (winget configure)
just app          # coque WinUI 3 NativeAOT non empaquetée (just msix : MSIX)
just probe        # sonde D3D12 C++23 import std
just winui-rs     # WinUI 3 depuis Rust
```

Aucune compilation sur le poste du propriétaire : `.github/workflows/ci.yml` compile la coque, la sonde et la scène.
