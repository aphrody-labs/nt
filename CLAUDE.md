# nt

- Source de vérité : docs/plan/ (plan, stack, cahier des charges, design, decisions.md). Mesures : docs/research/bench/.
- Aucune affirmation sans source datée (vendor + commit, Learn, API live, mesure). On est fin 2026.
- Entrée unique : `just` (tools, test, lint, build, serve, bench-native, cross). Rust : nightly-2026-11-11 (rust-toolchain.toml), sccache.
- Releases minimales : `--config .cargo/release.toml` (wasm/no_std, build-std core) ; `--config .cargo/release-native.toml` (exe, build-std std).
- windows-rs = fork aphrody-labs en dépendance git épinglée par commit (pas de chemin local). DXC et Agility SDK par OS hôte dans tools/dxc (`just tools`).
- JS/TS : bun uniquement (bun check, bun fmt, Bun.serve, bun build). .NET 11 NativeAOT (RID -> triplet Rust). C++23 en-têtes standard via CMake presets (import std expérimental dans CMake 4.4 : exclu).
- Portable et stable uniquement : aucun chemin absolu, lien ou jonction ; recettes `[windows]`/`[unix]` dans le justfile ; shell Windows = niubash.
- Budgets (cahier des charges §2-3) : frame p99 ≤ 8,33 ms à 4K, wasm ≤ 64 Kio, exe natif ≤ 1 Mio, shell AOT ≤ 8 Mio, 0 alloc/frame.
