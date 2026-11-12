# 04 — Plan

Règle : aucune phase ne commence tant que la précédente n'a pas ses critères de sortie verts. Chaque inconnue est levée par un **spike mesuré** dont le résultat entre dans `docs/research/facts.json` et dans `docs/plan/decisions.md`.

## État au 2026-11-12

- Phase 0 : S0.1 partiel (vendor non réduit), S0.2 **fait** (sonde C++23), S0.3 **fait** (adapter nvidia/lovelace, timestamp-query), S0.4 **fait** (wasm 14,2 Kio, exe 123,5 Kio), S0.5 remplacé (D4), S0.6 **fait** (Agility depuis exe Rust et C++), S0.7 **fait** (NativeAOT 1,04 Mio), S0.8 **fait** (DXC 1.9.2609 au build), S0.9 **fait** (timestamps D3D12 + WebGPU).
- Phase 1 noyau : **fait** (tests, clippy pedantic propre ; miri à brancher).
- Phase 2 nt in browser : **fait** — 4K, GPU p99 2,42 ms (budget 8,33 ms).
- Phase 3 natif D3D12 : **fait** — 4K, GPU p99 0,32 ms, tearing + waitable.
- Phase 4 shell .NET 11 AOT : **socle fait** (ABI + lien statique + mesures), UI shell à faire.
- Phase 5 : CI écrite (`.github/workflows/ci.yml`), compilation croisée arm64/musl vérifiée (`just cross`), recette à automatiser.

Décisions et écarts : [decisions.md](decisions.md).

## Phase 0 — Levée de risques (spikes, sans code produit)

| ID | Spike | Question | Sortie attendue |
|---|---|---|---|
| S0.1 | Vendoring sparse | ramener `vendor/` de ≈ 7 Go à ≤ 1,5 Go | `vendor/manifest.toml` (repo, SHA, chemins), `just vendor` |
| S0.2 | Sonde GPU C++23 | capacités D3D12 réelles RTX 4070 / driver 621.14 (SM max, tearing, work graphs, mesh, DXR, VRS) | `facts.json#gpu` |
| S0.3 | Sonde WebGPU | `adapter.info/features/limits` sur Edge 157 et Chrome 158 ; contexte sécurisé `localhost` via `Bun.serve` ; nom réel de l'API immediates | `facts.json#webgpu_runtime` |
| S0.4 | Toolchain nightly | `build-std` + `panic = "immediate-abort"` sur wasm32 et x86_64-msvc : taille d'un noyau vide | tailles mesurées vs E1/E3 |
| S0.5 | Bindings | `windows-bindgen` du fork → bindings D3D12/DXGI minimaux, sans crate `windows` | compile + taille du fichier généré |
| S0.6 | Agility SDK | export `D3D12SDKVersion` depuis un exe Rust **et** depuis un exe NativeAOT ; vérifier la version chargée | décision : où vit l'export |
| S0.7 | .NET AOT + Rust | `DirectPInvoke` + `NativeLibrary` d'une staticlib Rust dans un exe .NET 11 | taille vs E4, temps de démarrage |
| S0.8 | Shaders | DXC (NuGet 101.7.2207.25) au build, HLSL 202x SM 6.6 → DXIL embarqué ; WGSL équivalent | pipeline de build shaders |
| S0.9 | Mesure | horodatage GPU fiable (D3D12 timestamps, WebGPU `timestamp-query`) | méthode de mesure P2/P3 figée |

Sortie : `decisions.md` rempli (une ADR par spike), budgets confirmés ou révisés **avec la mesure à l'appui**.

## Phase 1 — Noyau `nt-kernel`

- Modules `object`, `sched`, `mem`, `ipc`, `input`, `comp` (design §2), capacités fixes.
- ABI `nt.h` (§3) + tests de layout côté C++ (`static_assert`) et .NET (`sizeof`) pour figer l'ABI.
- Tests : nextest + **miri**, cible wasm32 compilée en CI, linux-musl testée.
- Sortie : P4, P5 (côté noyau), T1, T4, Q1–Q2 verts.

## Phase 2 — Livrable 1 : **nt in browser**

- `web/` : `index.html` + hôte TS (bun) + WGSL ; `Bun.serve` en dev, `bun build` en prod.
- Scène bureau : barre des tâches, menu démarrer, fenêtres, 10 000 surfaces en mode stress.
- Overlay mesure (fps, p50/p99, temps GPU si `timestamp-query`).
- Sortie : P1–P3, P5, P7, P8 (navigateur), E1, E2 verts sur Edge 157 et Chrome 158.

## Phase 3 — Livrable 2 : hôte natif Direct3D 12

- Hôte Rust : `windows-window::run_with`, swapchain 4K flip-discard + tearing + waitable, Agility 1.620.2, shaders DXIL embarqués.
- Parité d'image avec le navigateur (§4.3).
- Sortie : P1–P8 (natif), E3, E5, E6, T2, T3, T6, T7 verts.

## Phase 4 — Shell .NET 11 NativeAOT

- Exe unique : C# 15 + staticlib Rust (noyau + hôte), `LibraryImport`, CsWin32 pour l'annexe Win32.
- Libs partagées `net10.0;net11.0`, tests MSTest/MTP.
- Sortie : E4, T8, P8 verts.

## Phase 5 — C++23, cross-compilation, recette

- `nt-gpu-probe` durci (de S0.2), WIL, DirectX-Headers.
- CI : x86_64 + aarch64 Windows msvc, wasm32, x86_64-linux-musl ; sccache ; budgets E9.
- `just recette` : rapport P/E/T/Q/L avec mesures et captures.
- Sortie : tous les critères du cahier des charges, « bloqué matériel » si écran 4K120 absent.

## Phase 6 — v2 (après recette v1)

hyperlight guests `no_std`, plateforme North/South façon litebox, pilotes windows-drivers-rs, UI windows-reactor, DirectStorage, SM 6.10 / work graphs quand sortis de preview, mesure ZeroGC sur le shell.

## Décisions à prendre par l'utilisateur

1. Écran 4K ≥ 120 Hz disponible pour la recette finale ? (sinon P1–P3 validés en rendu interne seulement)
2. Appareil Windows ARM64 pour tester la cible aarch64 ?
3. Hébergement public de « nt in browser » (HTTPS requis hors `localhost`) ?
4. Accepter le build Insider 28120 comme référence, ou figer une version stable de Windows 11 ?

## Commandes `just` cibles (à créer en phase 0/1)

`just vendor`, `just facts`, `just probe-gpu`, `just probe-webgpu`, `just web`, `just native`, `just shell`, `just test`, `just lint`, `just recette`.
