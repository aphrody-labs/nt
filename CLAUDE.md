# nt

- Source de vérité : docs/plan/architecture-microsoft.md (faits relevés et décisions du 2026-11-12). Faits du poste : docs/research/.
- Aucune affirmation sans source datée (fork + commit, Learn, API live, mesure). On est fin 2026.
- Ce que nt montre est **réel** : le noyau Windows de ce poste lu par ntdll, son NTFS, ses PE (icônes, chemins), son bureau (UI Automation). Pas de démo synthétique.
- Rendu GPU pur (WebGPU, Direct3D 12) : aucun texte DOM dans la scène ; 4K, frame p99 ≤ 8,33 ms (120 Hz), mesuré sur l'écran réel avec `?report=1`.
- Pile : coque WinUI 3 (Windows App SDK 2.6.5), webui + Fluent UI (forks aphrody-labs), .NET ↔ bun direct (bun:ffi sur NativeAOT ou hostfxr, sans node-api-dotnet), cœur Rust = monorepo windows-rs (fork aphrody-labs, master).
- Git : aucune worktree ni branche ; tout sur main (nt) et sur la branche par défaut des forks aphrody-labs. Jamais vers l'amont.
- Entrée unique : `just` (tools, lint, web, serve, index, desktop-svg, probe, app). JS/TS : bun uniquement. .NET 11. C++23 via CMake presets.
- Aucune compilation sur le poste : CI GitHub (`.github/workflows/ci.yml`) ou prd.
- Portable : aucun chemin absolu, lien ou jonction ; recettes `[windows]`/`[unix]` ; shell Windows = niubash.
