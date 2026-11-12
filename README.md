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
sdk/tools/gpuprobe/ sonde des capacités Direct3D 12 (C++23, WIL, DirectX-Headers)
sdk/tools/          fetch-tools.ts : DXC 1.9.2609, Agility SDK 1.620.2, niubash 1.5.0
docs/               plan/ (architecture), research/ (faits relevés sur le poste)
```

Le cœur Rust de nt est le monorepo à plat basé sur windows-rs : fork `aphrody-labs/windows-rs`, branches `nt/monorepo` et `nt/wasm`.

```
just serve        # http://localhost:8787/  (?report=1 : mesure d'affichage réelle)
just index        # index de C:\Windows
just app          # coque WinUI 3 (compilée par la CI)
```

Aucune compilation sur le poste du propriétaire : `.github/workflows/ci.yml` compile la coque, la sonde et la scène.
