> **Obsolète (2026-11-12)** : rédigé de mémoire, non sourcé. Remplacé par [docs/plan/](../plan/README.md).

# Produits dev Microsoft par stack

## Rust

- `windows-rs` (crates `windows`, `windows-sys`, `windows-core`, `windows-bindgen`) : API Windows/WinRT.
- Azure SDK for Rust (`azure_core`, `azure_identity`, `azure_storage_*`) : `Azure/azure-sdk-for-rust`.
- `microsoft/edit`, `microsoft/openvmm`, Hyperlight (`hyperlight-dev`) : références Rust système.
- Débogage : WinDbg, extension VS Code `rust-analyzer` + `cppvsdbg`.

## .NET

- SDK .NET 11, C# 15, F#, MSBuild, NuGet (CPM, source mapping, audit).
- `.slnx`, `dotnet test` en mode Microsoft.Testing.Platform, MSTest SDK.
- ASP.NET Core, Blazor, MAUI, WinUI 3 / Windows App SDK, Aspire.
- Native AOT, `LibraryImport` (P/Invoke généré), `System.CommandLine`.
- Analyse : Roslyn analyzers, `dotnet format`, Code Coverage.

## C++

- MSVC (Build Tools), Clang-cl, CMake + presets, Ninja, vcpkg (manifest + baseline).
- GSL (`microsoft/GSL`), WIL (`microsoft/wil`), C++/WinRT, `microsoft/STL`, `microsoft/mimalloc`, `microsoft/proxy`.
- Outils : Address Sanitizer MSVC, C++ Insights VS, `cppcorecheck`.

## TypeScript / JS

- TypeScript 6 (JS) et TypeScript 7 natif (`@typescript/native-preview`, binaire `tsgo`).
- VS Code API, Playwright, Fluent UI (`@fluentui/react-components`), Rush/Lage/rnx-kit (monorepo).
- Node sur Windows : `winget install OpenJS.NodeJS`, Dev Drive.

## Transverse

- VS Code, Visual Studio 2026, Windows Terminal, WSL, Dev Home, Dev Drive, WinGet, PowerToys.
- GitHub : Actions, Copilot (agent, code review), Codespaces, Advanced Security (CodeQL, secret scanning, Dependabot).
- Azure : Container Apps, Functions, AKS, Cosmos DB, Key Vault, Monitor, AI Foundry, Azure Developer CLI (`azd`), Bicep.
- MCP : serveurs Microsoft Learn, GitHub, Azure, Playwright.
- Office/M365 : Microsoft Graph SDK (.NET, TS), Teams Toolkit / M365 Agents Toolkit.
