# Rust dans Windows — enquête (2026-11-12)

Méthode : preuves sur le poste (Windows 11 Insider Dev, build 28120.3302, branche `br_release_flt`), doc Microsoft Learn, API GitHub live (`gh api`). Aucune information issue de la mémoire du modèle.

## 1. Position officielle

- Windows Security Book (Learn, « System security › Rust for Windows ») : *« We're expanding the integration of Rust into the Windows kernel to enhance the safety and reliability of Windows' codebase. »* — https://learn.microsoft.com/windows/security/book/operating-system-security-system-security
- Learn « Overview of developing on Windows with Rust » : Microsoft membre fondateur de la Rust Foundation.
- Learn « Direct3D 12 programming environment setup » : C++ reste le seul langage *supporté* pour D3D12 (pas de statut officiel Rust/C# pour D3D12).

## 2. Preuves sur le build 28120.3302

Détection : marqueurs du runtime Rust dans les binaires (`/rustc/<commit>/`, `RUST_BACKTRACE`, messages de panique `core`). **Borne basse** : un binaire `no_std`/`panic=immediate-abort`/strippé ne laisse pas ces marqueurs (ex. `win32kbase_rs.sys` détecté par son nom, pas par marqueur rustc).

Descriptions = champ `FileDescription` / `ProductName` des binaires ; tous signés **CN=Microsoft Windows** (Authenticode vérifié).

| Fichier | FileDescription (version) | Mode |
|---|---|---|
| `System32\win32kbase_rs.sys` (172 KiB) | Base Win32k Kernel Driver (10.0.28000.3302) | noyau |
| `drivers\wesp.sys` | Windows Endpoint Security Platform Driver (0.1.0.158348131) | noyau |
| `drivers\wesp_elam.sys` | Windows Endpoint Security Platform ELAM Driver (0.1.0.158348131) | noyau |
| `SenseTVM.exe` (WinSxS senseclient-service) | Windows Defender Advanced Threat Protection Sense TVM module (1.7.1-0) | user |
| `SenseIdentity.exe` (idem, + SenseAP, SenseAPToast) | … Sense Identity module (3.0.10-445) | user |
| `DWriteCore.dll` (WinAppRuntime 1.1→2, CBS, WebView `undocked_copilot`) | Microsoft DirectX Typography Services (2.1.1.2605), Windows App SDK | user |
| `NarratorMCAT\NarratorMCAT.dll` | (vide) — rustc `a7727ddedd79…` **absent de rust-lang/rust** → toolchain hors upstream (hypothèse) | user |
| `plutonfw_hspv2_AuthenticAMD.dll` | (vide) | user |
| `CloudRecoveryDownloadTool.dll` | Microsoft Cloud Recovery Download Tool (0.3.28.0) | user |
| `UdiApiClient.dll` | Microsoft Universal Download and Install (0.4.74.0) | user |
| `sudo.exe` | sudo (1.0.1) — dépôt microsoft/sudo (Rust) | user |
| Apps Store | Paint `c2pa_c.dll`, WinDbg `symsrv.dll` + `winext\{CLR,ELFBin,MachOBin}Composition.dll`, Windows 365 `msrdc\skypert.dll`, `wcioprotection_display_presenter.dll` | user |

Hors Microsoft : `System32\comm.exe` = **uutils coreutils** (Rust, rustc `574ff7d98bd6` = rust-lang/rust master du 2026-09-14), 11 Mo, daté 2026-11-03, **signé « CN=Bun OS Test Signing »** (certificat de test, pas Microsoft) — installation locale de l'utilisateur.

Reproduire : `bun ~/.claude/skills/windows-machine/scripts/inventory.ts --rust-scan`.

## 3. Écosystème Rust bas niveau Microsoft (GitHub, actifs)

145 dépôts Rust actifs non-fork, 106 poussés < 30 jours. Bas niveau :

| Domaine | Dépôts |
|---|---|
| Bindings / métadonnées | windows-rs (core, link, bindgen, window, reactor, canvas, composition, webview, rdl, clang), win32metadata |
| Pilotes | windows-drivers-rs (`wdk` 0.5.0, `wdk-sys`, `wdk-build`, `wdk-alloc`, `wdk-panic`), Windows-rust-driver-samples, `cargo-wdk` (installé localement) |
| Virtualisation | openvmm / OpenHCL (paravisor), hyperlight (micro-VM, guests `no_std`), **nvx** (micro-VM multiplateforme), mxc (conteneurs à politiques), Azure aci-edge-sandbox |
| OS / isolation | litebox (library OS North/South), demikernel (kernel-bypass libOS), wassette (composants WASM) |
| Observabilité | rust_win_etw, tracelogging, tracing-etw |
| Crypto / matériel | rustls-symcrypt (SymCrypt), ms-tcg-tpm-sys (TPM), TEE-Attestation-Verification |
| Stockage / perf | verified-storage, bf-tree, DiskANN, kimojio-rs (io_uring) |
| Outils | edit, sudo, coreutils, tgrep, pave |
| .NET ↔ Rust | dotnet/runtimelab `feature/ZeroGC.rs` (GC CoreCLR standalone en Rust) |

## 4. Conséquences pour nt

- Le modèle de Microsoft lui-même = **réécriture ciblée** (composants à risque : parsing de polices/texte, win32k, sécurité, firmware), pas de réécriture totale : nt adopte la même stratégie incrémentale.
- Toolchain : Microsoft expédie au moins un binaire bâti sur une rustc master récente (septembre 2026) et un sur une rustc hors upstream → épingler une nightly datée est cohérent avec la pratique observée.
- Pilotes Rust : chaîne disponible localement (WDK présent, `cargo-wdk` installé) → phase pilotes du plan réalisable sans installation.
