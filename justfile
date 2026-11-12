# nt — point d'entrée unique (docs/plan/04-plan.md). Portable : Windows (niubash), Linux, macOS.
# Toolchains : cargo nightly épinglée (rust-toolchain.toml), bun, .NET 11, CMake (sonde D3D12, Windows).
set shell := ["sh", "-cu"]
set windows-shell := ["niu", "-cu"]

export RUSTC_WRAPPER := env("RUSTC_WRAPPER", "sccache")

# Cible Rust et RID .NET de l'hôte, surchargeables : NT_TARGET=aarch64-pc-windows-msvc just native
host_target := if os() == "windows" { arch() + "-pc-windows-msvc" } else if os() == "macos" { arch() + "-apple-darwin" } else { arch() + "-unknown-linux-gnu" }
target := env("NT_TARGET", host_target)
rid_os := if os() == "windows" { "win" } else if os() == "macos" { "osx" } else { "linux" }
rid_arch := if arch() == "aarch64" { "arm64" } else { "x64" }
rid := env("NT_RID", rid_os + "-" + rid_arch)

default: test build

# Binaires épinglés pour l'hôte : DXC 1.9.2609 (GitHub) + Agility SDK 1.620.2 (NuGet) dans tools/dxc
tools:
    bun tools/fetch-tools.ts

build: wasm ffi web native shell probe

# Dépendances JS épinglées par bun.lock
install:
    bun install --frozen-lockfile

test: install
    cargo test -p nt-kernel
    bun check

lint: install
    cargo clippy --workspace --exclude nt-web -- -D warnings
    cargo clippy -p nt-web --target wasm32-unknown-unknown -- -D warnings
    bun fmt --check
    bun check

# Noyau navigateur : wasm32 no_std, build-std + panic immediate-abort
wasm:
    cargo build -p nt-web --target wasm32-unknown-unknown --profile wasm --config .cargo/release.toml

# ABI C native du noyau (staticlib no_std) pour .NET / C++
ffi:
    cargo build -p nt-ffi --release --target {{ target }} --config .cargo/release.toml

# Hôte Direct3D 12 + Agility SDK copié à côté de l'exe
[windows]
native:
    cargo build -p nt-d3d12 --release --target {{ target }} --config .cargo/release-native.toml
    bun tools/stage-native.ts target/{{ target }}/release {{ rid_arch }}

[unix]
native:
    @echo "nt-d3d12 : Direct3D 12 est propre à Windows (cible ignorée sur {{ os() }})"

# Shell .NET 11 NativeAOT (lie la staticlib nt_ffi du RID)
shell: ffi
    dotnet publish src/dotnet/Nt.Shell -c Release -r {{ rid }}

# Sonde des capacités D3D12 (C++23, WIL, DirectX-Headers via FetchContent)
[windows]
probe:
    cd src/cpp/nt-gpu-probe && cmake --preset windows && cmake --build --preset windows

[unix]
probe:
    @echo "nt-gpu-probe : Direct3D 12 est propre à Windows (cible ignorée sur {{ os() }})"

# Bundle web de production (target/web)
web: wasm
    bun build src/web/index.html --outdir target/web --minify
    cp target/wasm32-unknown-unknown/wasm/nt_web.wasm target/web/nt.wasm

# Noyau Windows en 3D (/), vue 2D (/2d), bureau SVG (/desktop.svg), index %SystemRoot% (/api/index), démo (/demo, wasm requis)
serve:
    bun src/host/server.ts

# Index complet de %SystemRoot% (FindFirstFileExW + SQLite FTS5 + en-têtes PE) -> target/index/windows.sqlite
[windows]
index root="":
    bun src/host/winindex.ts {{ root }} --pe

# Bureau Windows entier vectorisé en SVG (UI Automation) -> target/desktop.svg
[windows]
desktop-svg:
    bun src/host/desktop-svg.ts

# Banc natif 4K (hors écran)
[windows]
bench-native: native
    target/{{ target }}/release/nt-d3d12 --bench 1200

# Vérification de compilation croisée
cross:
    cargo check -p nt-kernel -p nt-ffi -p nt-d3d12 --target aarch64-pc-windows-msvc
    cargo check -p nt-kernel -p nt-ffi --target x86_64-unknown-linux-musl
