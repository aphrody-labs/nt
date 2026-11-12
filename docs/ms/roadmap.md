> **Obsolète (2026-11-12)** : rédigé de mémoire, non sourcé. Remplacé par [docs/plan/](../plan/README.md).

# Roadmap

Objectif : monorepo Rust / .NET / C++ / TypeScript aligné sur les pratiques des dépôts Microsoft (`windows-rs`, `dotnet/runtime`, `microsoft/STL`, `microsoft/TypeScript`, `microsoft/rushstack`).

## Phase 0 : socle (fait)

- [x] Cœur Rust `nt-core`, exposé en ABI C (`nt-ffi`, cdylib + staticlib)
- [x] C++ : CMake presets + Ninja, link de la staticlib Rust
- [x] .NET 11 : `.slnx`, CPM, `LibraryImport`, MSTest SDK sur MTP
- [x] TS : bun seul (`bun:ffi`, `bun check -b`, `bun fmt`, `bun test`)
- [x] `tools/msdex` : crawl dépôts + sites Microsoft, extraction API bun, inventaire skills
- [x] `just` comme point d'entrée unique, CI GitHub Actions

## Phase 1 : qualité et vitesse

- [ ] `cbindgen` pour générer `nt.h` depuis Rust (fin du header manuel)
- [ ] vcpkg manifest (`vcpkg.json` + baseline) pour les dépendances C++ (GSL, WIL)
- [ ] sccache en CI pour Rust et C++
- [ ] Couverture : `cargo llvm-cov`, `Microsoft.Testing.Extensions.CodeCoverage`, `bun test --coverage`
- [ ] `bun lint` dès sa sortie stable (déjà dans vendor/bun/docs/lint)
- [ ] Dependabot + CodeQL (C#, C++, Rust, TS)

## Phase 2 : produits

- [ ] CLI .NET Native AOT (`System.CommandLine`) sur le cœur Rust
- [ ] App desktop WinUI 3 / Windows App SDK
- [ ] Extension VS Code en TS appelant le cœur (N-API ou WASM)
- [ ] Serveur MCP du monorepo (TS ou C#)

## Phase 3 : cloud et diffusion

- [ ] Aspire pour l'orchestration locale des services
- [ ] Déploiement Azure Container Apps via `azd` + Bicep
- [ ] Publication : crates.io, NuGet, npm, vcpkg registry privé
- [ ] Release automatisée (tags SemVer, changelog, artefacts signés)

## Veille

- Dépôts à suivre : [repos/stack.md](repos/stack.md), [repos/domains/](repos/domains/)
- Rafraîchir : `just msdex` ; sites : [sites/](sites/README.md) ; bun : [../bun/](../bun/README.md) ; skills : [../skills/](../skills/README.md)
