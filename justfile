# nt — point d'entrée unique. Architecture : docs/plan/architecture-microsoft.md.
# Windows (niubash) et Unix ; les recettes qui lisent le Windows réel sont marquées [windows].
set shell := ["sh", "-cu"]
set windows-shell := ["niu", "-cu"]

rid_os := if os() == "windows" { "win" } else if os() == "macos" { "osx" } else { "linux" }
rid_arch := if arch() == "aarch64" { "arm64" } else { "x64" }
rid := env("NT_RID", rid_os + "-" + rid_arch)

default: lint web

# Outils épinglés : DXC 1.9.2609, Agility SDK 1.620.2, niubash 1.5.0 (Windows) -> sdk/tools/
tools:
    bun sdk/tools/fetch-tools.ts

install:
    bun install --frozen-lockfile

lint: install
    bun fmt --check
    bun check

# Scène GPU du noyau (WebGPU) -> target/web
web: install
    bun build modules/web/nt.html --outdir target/web --minify

# Serveur : noyau NT en direct (WebSocket /kernel), /api/icon, /api/index, /desktop.svg
serve: install
    bun sdk/tools/host/server.ts

# Index complet de %SystemRoot% (FindFirstFileExW + SQLite FTS5 + en-têtes PE) -> target/index/windows.sqlite
[windows]
index root="":
    bun sdk/tools/host/winindex.ts {{ root }} --pe

# Bureau Windows entier vectorisé en SVG (UI Automation) -> target/desktop.svg
[windows]
desktop-svg:
    bun sdk/tools/host/desktop-svg.ts

# Sonde des capacités Direct3D 12 (C++23, WIL, DirectX-Headers)
[windows]
probe:
    cd sdk/tools/gpuprobe && cmake --preset windows && cmake --build --preset windows

# Coque native WinUI 3 (Fluent, Mica, WebView2 -> scène GPU) ; nécessite `just serve` pour les données
[windows]
app:
    dotnet publish base/shell/explorer -c Release -r {{ rid }}
