# nt sur la pile Microsoft — décisions du 2026-11-12

Sources : cinq relevés en lecture seule (forks aphrody-labs dans `third_party/`, `gh api`, NuGet, npm), tous datés du 2026-11-12.

## Faits relevés

**windows-rs** (8ca69fd, identique à upstream master)
- Organisation : `crates/{libs,tools,samples,tests}`.
- Métadonnées générées à partir des en-têtes du SDK et du WDK 10.0.28000 ; on n'utilise plus win32metadata.
- Bindings : chaque crate génère les siens, privés, via `windows-bindgen --flat --minimal|--sys` et un fichier filtre `.txt`. Le `bindings.rs` produit est commité ; la CI `gen` vérifie qu'il n'a pas dérivé.
- Liaison : `windows-link` (`raw-dylib`).
- `windows-sys` et `windows-link` sont `no_std` sans allocation. `windows-core`, `-result` et `-strings` ont besoin d'`alloc`.
- Exports du noyau (ntoskrnl) : non publiés. Il faut des RDL maison ou `--sys --extern`.
- Pas de CI wasm.

**webui** (v3.1.1, fork identique à upstream)
- Gabarits HTML compilés en `protocol.bin`, rendus côté serveur en Rust (axum, hyper) ou en JS (Bun.serve documenté), puis activés par îlots côté client.
- Pas de WebSocket ni de WebGPU : la scène GPU et le flux du noyau restent dans un composant `<nt-scene>`.
- Fluent UI web components 3.2.1 n'a pas de `.template-webui.html` : pas de rendu serveur en l'état.

**node-api-dotnet** (0.9.36)
- Addon NativeAOT exposant `[JSExport]` en `.node`. `bun.exe` 1.4.4 exporte les 140 fonctions Node-API utilisées, mais rien n'est testé sous Bun.
- Cible maximale : net10.0. Il faudra patcher pour net11.

**LiberNT** (fork de ReactOS, cible NT 10)
- Arborescence : `boot/`, `bootloader/`, `hal/`, `ntos/{ke,mm,ob,ps,io,se,config,po,ex,alpc,cc,fsrtl,rtl,tm,wmi,kd…}`, `drivers/`, `dll/{ntdll,win32}`, `subsystems/{csr,win/win32k,linux}`, `base/{system,services,shell}`, `sdk/`.
- 407 services système. Sources de vérité, dans l'ordre : en-têtes SDK/WDK, symboles Windows 11, documentation Microsoft.

**Écosystème OS Microsoft en Rust** (dix projets prioritaires)
- openvmm : `minimal_rt`, `openhcl_boot`, `whp`, `tmk`.
- litebox : ses traits Platform servent de modèle de HAL.
- windows-drivers-rs ; win32metadata et wdkmetadata ; DirectX-Headers ; terminal (condrv, Atlas) ; ebpf-for-windows et ntosebpfext ; DXC ; WindowsAppSDK et WinUI 2.6.5 ; mxc (FFI vers SDK .NET et Node).

**Ce poste**
- `System32\win32kbase_rs.sys` existe sur ce build (Rust dans le sous-système graphique du noyau).

## Décisions

1. Le cœur de nt est un monorepo à plat dont la base est le fork aphrody-labs/windows-rs (branche master ; tout le travail nt est sur la branche par défaut des forks).
   - Les crates de nt rejoignent `crates/libs/nt-*`.
   - Les projets Rust OS de Microsoft sont importés en sous-arbres compressés (squash), avec leur provenance dans un manifeste.
   - On unifie dans le workspace ce qui se résout ensemble ; le reste est exclu, avec ses blocages listés.
2. windows-rs passe sur wasm32 (master du fork, docs/wasm.md) : une fonction Win32 ou NT devient une importation wasm (module = DLL, nom = symbole), fournie par l'hôte « NT dans le navigateur ».
3. L'outillage JS de webui passe entièrement sur bun (main du fork) : workspaces et catalogues bun, Bun.build, bun test.
4. Fluent UI web components est converti au format de gabarits webui (master du fork fluentui), et Fluent UI React v9 passe sur bun (scripts/bun).
5. Coques :
   - WinUI 3 (Windows App SDK 2.6.5) pour la coque native ;
   - webui + Fluent pour la coque web ;
   - la scène noyau est en rendu GPU pur (Direct3D 12 natif, WebGPU dans le navigateur) ;
   - la passerelle .NET ↔ bun est directe : bun:ffi sur NativeAOT ou CoreCLR hébergé via hostfxr, sans node-api-dotnet (docs/bun/dotnet-native.md).
6. Aucune compilation sur le poste : la compilation se fait sur GitHub Actions (forks aphrody-labs) ou sur prd.

## Chaîne d'outils native — décisions du 2026-11-12

Sources consultées le jour même : Kitware/CMake `v4.5.0` (Help/release/4.5.rst, cmake-cxxmodules(7)), Learn (vcpkg binary caching,
single-project MSIX, Windows App SDK 1.6/2.x, Native AOT, WinGet Configuration v3, MSVC 14.52 / VS 18.12), microsoft/vcpkg@177e8175,
nuget.org, PowerShell/DSC, PSGallery, `winget show`, actions/runner-images (windows-2025-vs2026 20261103 : VS 18.11, CMake 4.4.5).

7. C++23 `import std;` par CMake 4.5 (stable, tag du 2026-11-12) avec Ninja et MSVC ; les générateurs Visual Studio ne le
   prennent pas en charge (pas de BMI pour les cibles importées). CMake 4.5.0 et Ninja 1.13.2 sont épinglés par
   `sdk/tools/fetch-tools.ts` (SHA-256), l'environnement VS est chargé par `sdk/tools/vsdev.ts` (vswhere + VsDevCmd).
   MSVC 19.52.37029+ reçoit `-std:c++23` (stable), les versions antérieures `-std:c++latest`.
8. vcpkg en mode manifeste : registre par défaut microsoft/vcpkg épinglé par commit, ports aphrody-labs en overlay
   (`sdk/vcpkg/ports` : directx-headers 1.620.2 = Agility SDK 1.620.2, absent du registre ; wil abb1bd35). Cache binaire CI :
   fournisseur NuGet sur GitHub Packages (recommandé par Learn ; `x-gha` est retiré de vcpkg).
9. Coque : NativeAOT (exe 3,5 Mo mesuré) ; deux sorties, non empaquetée autonome et MSIX projet unique, Windows App SDK 2.6.5
   embarqué dans les deux cas ; certificat de test généré par la CI, jamais versionné.
10. WinUI depuis Rust : windows-reactor (windows-rs) en dépendance git épinglée, échantillon `sdk/rust/winui-hello`.
11. Poste : `.config/configuration.winget` (WinGet Configuration v3, processeur dscv3) ; module PSGallery
    Microsoft.VisualStudio.DSC pour les composants C++ de Visual Studio Build Tools 2026.
12. .NET : applications net11.0 ; bibliothèques consommées par d'autres hôtes .NET en net10.0;net11.0
    (`$(NtLibraryTargetFrameworks)`), IsAotCompatible par défaut.
