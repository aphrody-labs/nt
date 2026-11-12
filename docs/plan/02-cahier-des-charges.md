# 02 — Cahier des charges

Projet : **nt** — environnement de bureau open source inspiré de l'architecture NT et de l'ergonomie de Windows 11, sans marque ni code Microsoft propriétaire. Un même noyau Rust s'exécute **dans le navigateur** (WebAssembly + WebGPU) et **en natif** (Direct3D 12), piloté par un shell .NET 11 et des composants C++23.

## 1. Périmètre

### Inclus (v1)
- F1 Noyau `nt-kernel` : gestionnaire d'objets (handles typés, comptage de références), ordonnanceur coopératif à priorités, mémoire à arènes fixes, ports IPC à messages de taille fixe, horloge monotone, file d'événements d'entrée, compositeur (arbre de surfaces, z-order, régions modifiées).
- F2 **nt in browser** : page servie par bun, charge `nt_kernel.wasm`, rend le bureau en WebGPU (barre des tâches, menu démarrer, fenêtres déplaçables/redimensionnables), entrée souris/clavier/tactile, overlay de mesure.
- F3 Hôte natif Windows : exécutable D3D12 qui charge le même noyau (rlib), même scène, mêmes mesures.
- F4 Shell .NET 11 NativeAOT : processus « explorer » en C# qui pilote le noyau via l'ABI C (lancement d'apps, gestion de fenêtres, paramètres).
- F5 Sonde GPU C++23 (`import std`, WIL, DirectX-Headers) : rapport des capacités D3D12 (SM max, work graphs, DXR, mesh shaders, VRS, tearing, Agility SDK chargé).
- F6 Outillage bun : serveur de dev, tests, régénération des faits datés et de l'index écosystème (msdex réactivé depuis l'archive).

### Exclu (v1)
Pilotes réels, boot sur matériel, compatibilité binaire Win32/PE, réseau, stockage persistant, GPU autre que NVIDIA pour la validation (le code reste agnostique).

### Phase ultérieure (v2+)
Guests `no_std` sous hyperlight, plateforme litebox-like (North/South), pilotes via windows-drivers-rs, UI déclarative via windows-reactor, flux d'assets DirectStorage, work graphs / SM 6.10 quand stables.

## 2. Exigences de performance (budgets)

Référence matérielle : i7-13700F, RTX 4070 (driver 621.14), Windows 11 build 28120, Edge ≥ 157 / Chrome ≥ 158.

| ID | Exigence | Cible | Mesure |
|---|---|---|---|
| P1 | Résolution de rendu | 3840x2160 interne (natif et navigateur) | taille swapchain / canvas `width,height` |
| P2 | Cadence | **≥ 120 fps soutenus, p99 frame time ≤ 8,33 ms**, scène de 10 000 surfaces animées | horodatage GPU (D3D12 timestamp queries / WebGPU `timestamp-query` si dispo) + CPU `QueryPerformanceCounter` / `performance.now()` ; 60 s de capture |
| P3 | Temps GPU par frame | ≤ 4 ms à 4K | timestamps GPU |
| P4 | Tick noyau | ≤ 0,5 ms pour 10 000 surfaces | compteur interne |
| P5 | Allocations | **0 allocation par frame** (natif et JS) | compteur d'allocation natif ; heap JS stable sur 60 s |
| P6 | Latence | ≤ 1 frame en file (waitable object DXGI, `SetMaximumFrameLatency(1)`) | stats DXGI |
| P7 | Repos | scène statique → aucune frame présentée, CPU < 1 % | gestionnaire des tâches / ETW ; boucle `run_with` qui renvoie `false` |
| P8 | Démarrage | natif < 100 ms jusqu'à la 1re frame ; navigateur < 300 ms après chargement | horodatages |

Écran actuel 2560x1440 @ 144 Hz : P1–P3 sont validés en rendu interne 4K (mise à l'échelle DXGI / canvas CSS). La validation « affichage 4K natif 120 Hz » exige un écran 4K ≥ 120 Hz (critère bloquant de recette finale, matériel à fournir).

## 3. Exigences d'économie

| ID | Exigence | Cible |
|---|---|---|
| E1 | `nt_kernel.wasm` | ≤ 64 KiB (non compressé) |
| E2 | Page web complète (HTML+JS+WGSL+wasm) | ≤ 150 KiB transférés |
| E3 | Hôte natif D3D12 | ≤ 1 MiB, sans `vcruntime140.dll` |
| E4 | Shell .NET NativeAOT | ≤ 8 MiB |
| E5 | RAM hôte natif | ≤ 64 MiB (hors VRAM) |
| E6 | VRAM | ≤ 256 MiB à 4K, 3 back buffers |
| E7 | Dépendances | Rust : crates windows-rs du fork + 0 autre au départ ; JS : `@types/bun` seul ; .NET : MSTest SDK seul |
| E8 | Vendor | ≤ 1,5 Go, sparse, SHA épinglés |
| E9 | Build | incrémental noyau ≤ 5 s ; complet froid ≤ 3 min avec sccache |

## 4. Exigences techniques

- T1 Rust nightly épinglé (`nightly-2026-11-11`), édition 2024, `#![no_std]` pour le noyau, `unsafe` confiné à l'ABI et aux bindings, chaque bloc commenté `// SAFETY:`, **miri** sur les tests du noyau.
- T2 Bindings Windows générés par `windows-bindgen` depuis le fork vendorisé ; aucun crate `windows`/`windows-sys`.
- T3 Shaders : HLSL 202x compilé par DXC (DXIL) ; WGSL pour le navigateur ; parité vérifiée par images de référence.
- T4 ABI C unique `nt.h`, générée ou vérifiée en CI, consommée par C++ (link statique), .NET (`LibraryImport`), TS (exports wasm).
- T5 Cross-compilation : x86_64 et aarch64 Windows msvc, wasm32-unknown-unknown, x86_64-unknown-linux-musl (noyau + tests).
- T6 Durcissement Windows : CFG, `/CETCOMPAT`, `/DYNAMICBASE`, CRT statique (modèle microsoft/sudo, microsoft/mxc).
- T7 LTO fat + `codegen-units = 1` + `panic = "immediate-abort"` + `build-std` en release (modèle microsoft/edit, microsoft/openvmm).
- T8 .NET : `PublishAot`, `OptimizationPreference=Speed`, `IlcInstructionSet=x86-64-v3`, `UseSystemResourceKeys=false`, `StackTraceSupport=true`, CPM, `.slnx`, MSTest/MTP.
- T9 C++ : C++23, `import std`, warnings en erreurs, CMake presets + Ninja + sccache.
- T10 JS/TS : bun uniquement (`bun check -b`, `bun fmt`, `bun test`, `Bun.serve`).

## 5. Qualité et traçabilité

- Q1 Tests : `cargo nextest` + miri, `bun test`, MSTest/MTP, ctest ; CI Windows x64 + Linux.
- Q2 Lints : clippy pedantic `-D warnings`, `bun check -b`, `dotnet format --verify-no-changes`, C++ `/W4 /WX` ou `-Wall -Wextra -Werror`.
- Q3 Chaque version épinglée a une entrée datée dans `docs/research/facts.json` ; `just facts` la régénère ; tout écart entre doc et fait = bug.
- Q4 Aucune affirmation de doc sans source (chemin vendor@SHA, URL Learn, API) — revue bloquante.

## 6. Contraintes légales

- L1 Nom « nt », aucun « Windows », aucun logo ou élément suggérant un parrainage Microsoft (clauses de marque des dépôts MS).
- L2 Assets autorisés : Fluent System Icons (MIT), Fluent Emoji (MIT), Selawik (OFL-1.1, remplaçant ouvert de Segoe), Cascadia Code (OFL-1.1, nom réservé). Segoe UI interdit.
- L3 Code tiers : licences MIT / Apache-2.0 (+ LLVM exception) uniquement, `NOTICE` maintenu.
- L4 Conception à partir de documentation publique uniquement (Learn, specs DirectX publiques, dépôts open source).

## 7. Recette

Une version est acceptée si P1–P8, E1–E9, T1–T10, Q1–Q4, L1–L4 sont tous verts dans le rapport généré par `just recette` (mesures + liens vers captures). Tout critère non mesurable sur le poste actuel (affichage 4K 120 Hz natif) est marqué « bloqué matériel » et non « vert ».
