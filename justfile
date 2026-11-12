# nt — point d'entrée unique. Architecture : docs/plan/architecture-microsoft.md.
# Windows (niubash) et Unix ; les recettes qui lisent le Windows réel sont marquées [windows].
set shell := ["sh", "-cu"]
set windows-shell := ["niu", "-cu"]

rid_os := if os() == "windows" { "win" } else if os() == "macos" { "osx" } else { "linux" }
rid_arch := if arch() == "aarch64" { "arm64" } else { "x64" }
rid := env("NT_RID", rid_os + "-" + rid_arch)
platform := if rid =~ "arm64$" { "ARM64" } else { "x64" }

default: lint web

# Outils épinglés : DXC 1.9.2609, Agility SDK 1.620.2 ; Windows : niubash 1.5.0, CMake 4.5.0, Ninja 1.13.2 -> sdk/tools/
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

# Poste de développement Windows : WinGet Configuration v3 (VS Build Tools 2026 + C++, .NET 11, bun, just, niubash, Rust…)
[windows]
setup:
    winget configure -f .config/configuration.winget

# Sonde des capacités Direct3D 12 : C++23 `import std` (CMake 4.5 + Ninja + MSVC), vcpkg (directx-headers, wil)
[windows]
probe: tools
    cd sdk/tools/gpuprobe && bun ../vsdev.ts cmake --workflow --preset windows

# Coque native WinUI 3 NativeAOT, non empaquetée autonome -> target/dotnet/publish/Nt.App/ ; données : `just serve`
[windows]
app:
    dotnet publish base/shell/explorer -c Release -r {{ rid }}

# Coque en MSIX projet unique -> target/dotnet/msix/ ; signé si NT_CERT (pfx) et NT_CERT_PASSWORD sont définis
[windows]
msix:
    dotnet publish base/shell/explorer -c Release -r {{ rid }} -p:Platform={{ platform }} -p:NtPackage=msix

# WinUI 3 depuis Rust (windows-reactor, fork windows-rs épinglé) -> target/cargo/release/reactor-winui-hello.exe
[windows]
winui-rs:
    cd sdk/rust && cargo -Zgit=shallow-deps build --release --locked
