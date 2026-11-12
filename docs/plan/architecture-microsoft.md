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

1. Le cœur de nt est un monorepo à plat dont la base est le fork aphrody-labs/windows-rs (branche `nt/monorepo`).
   - Les crates de nt rejoignent `crates/libs/nt-*`.
   - Les projets Rust OS de Microsoft sont importés en sous-arbres compressés (squash), avec leur provenance dans un manifeste.
   - On unifie dans le workspace ce qui se résout ensemble ; le reste est exclu, avec ses blocages listés.
2. windows-rs passe sur wasm32 (branche `nt/wasm`) : une fonction Win32 ou NT devient une importation wasm (module = DLL, nom = symbole), fournie par l'hôte « NT dans le navigateur ».
3. L'outillage JS de webui passe entièrement sur bun (branche `nt/bun`) : workspaces et catalogues bun, Bun.build, bun test.
4. Fluent UI web components est converti au format de gabarits webui (branche `nt/webui-templates` du fork fluentui).
5. Coques :
   - WinUI 3 (Windows App SDK 2.6.5) pour la coque native ;
   - webui + Fluent pour la coque web ;
   - la scène noyau est en rendu GPU pur (Direct3D 12 natif, WebGPU dans le navigateur) ;
   - la passerelle .NET ↔ bun passe par node-api-dotnet (addon NativeAOT).
6. Aucune compilation sur le poste : la compilation se fait sur GitHub Actions (forks aphrody-labs) ou sur prd.
