# .NET : primitives natives d'interop C-ABI

Sources : `dotnet/runtime@42656136` (branche `release/11.0`, 2026-11-11 ; https://github.com/dotnet/runtime/tree/42656136) — chemins relatifs à la racine de ce dépôt, `CoreLib/...` = `src/libraries/System.Private.CoreLib/src/System/Runtime/InteropServices/...` ; `src/libraries/System.Runtime/ref/System.Runtime.cs` au même commit (noté `ref:<ligne>`) ; Microsoft Learn (MCP, consulté 2026-11-12). Lecture seule, aucune compilation.

## 0. Faits de version (sources live)

| Fait | Source |
|---|---|
| .NET 11.0.0 GA le 2026-11-10, STS, fin de support 2028-11-14, SDK 11.0.100 | `dotnet/core` `release-notes/11.0/releases.json` (gh api) |
| Tag GA posé dans le VMR : `dotnet/dotnet` release `v11.0.100` publiée 2026-11-10T13:50Z | gh api `repos/dotnet/dotnet/releases` |
| **Conflit apparent** : `dotnet/runtime` n'a pas de tag `v11.0.0` (dernier : `v11.0.0-rc.3.26522.148`) ; les GA se lisent dans `dotnet/dotnet` | gh api `git/matching-refs/tags/v11.0` |
| `release/11.0` = version 11.0 `rtm` ; `main` = 12.0 `alpha` | `eng/Versions.props:9-18` (deux checkouts) |
| .NET 10.0.15 (LTS) publié 2026-11-10 | gh api releases `dotnet/runtime` `v10.0.15` |

## 1. NativeAOT : exports C et liaison

- **Exports** : toute méthode `static` `[UnmanagedCallersOnly(EntryPoint = "...")]` (`CoreLib/.../UnmanagedCallersOnlyAttribute.cs:31-36`) de l'assembly publiée devient un symbole C public ; méthodes de références/NuGet non exportées sauf ajout explicite (Learn « Native code interop with Native AOT », section Native exports). Câblage MSBuild : `NativeLib=Shared` par défaut pour `OutputType=Library` (`src/coreclr/nativeaot/BuildIntegration/Microsoft.NETCore.Native.targets:20`), `IlcExportUnmanagedEntrypoints=true` si Shared (`:90`) → `--export-unmanaged-entrypoints` (`:284`), fichier `.def`/`.exports` généré (`:80-91`, `--exportsfile` `:280`) passé à l'éditeur de liens (`/DEF:` `:386`, `--version-script` `:390`). Assemblies supplémentaires : items `UnmanagedEntryPointsAssembly` → `--generateunmanagedentrypoints` (`:112`, `:324`).
- **.NET 11 (rupture)** : NativeAOT rejette désormais à l'exécution (InvalidProgramException ⇒ fail-fast) un appel natif vers un `[UnmanagedCallersOnly]` à signature non blittable (`bool`, `char`) quand le marshalling runtime est actif ; remèdes : `[assembly: DisableRuntimeMarshalling]` ou types blittables (Learn `core/compatibility/interop/11/unmanagedcallersonly-non-blittable`, PR dotnet/runtime#130160).
- **Statique** : `NativeLib=Static` produit `.lib`/`.a` (`Microsoft.NETCore.Native.targets:71-72`) ; l'hôte doit alors lier aussi les bibliothèques du runtime listées comme `NativeLibrary` (`Microsoft.NETCore.Native.Windows.targets:42-54` : `dllmain`, bootstrapper, `Runtime.WorkstationGC` ou `Runtime.ServerGC` (`:22-23`), eventpipe, vxsort, standalone GC, `aotminipal`, zlib, brotli, zstd) et les libs SDK Windows (`:71-86`). Learn (« Building native libraries ») : seules les bibliothèques partagées sont officiellement supportées, statique « not officially supported » ; **déchargement (`FreeLibrary`/`dlclose`) non supporté**.
- **DirectPInvoke** : items `DirectPInvoke` (`module` ou `module!entrypoint`) et `DirectPInvokeList` → `--directpinvoke[list]` (`Microsoft.NETCore.Native.targets:286-287`) : appel direct lié par le chargeur OS au démarrage, meilleur régime permanent, permet la liaison statique ; ignore `DefaultDllImportSearchPaths` (Learn, section Direct P/Invoke calls). Windows pré-remplit `WindowsAPIs.txt` (`Microsoft.NETCore.Native.Windows.targets:90`). Sans DirectPInvoke, liaison paresseuse à l'exécution.
- **Coût d'entrée inverse** : chaque appel natif → UCO passe par `RhpReversePInvoke` (`src/coreclr/nativeaot/Runtime/thread.cpp:1455-1462`) ; un thread inconnu est attaché à la volée et le runtime initialisé si besoin (`ReversePInvokeAttachOrTrapThread` / `EnsureRuntimeInitialized`, `:1251-1290`). Inférence : tout thread de Bun (JS principal, Worker, pool `napi_async_work`) qui entre dans une UCO est attaché au runtime .NET à son premier appel ; Bun exécute les finaliseurs Node-API sur le thread JS (`bun-lowlevel.md` §4), donc aucun thread de GC JSC n'entre dans .NET par cette voie.

## 2. Hébergement CoreCLR : nethost + hostfxr

- `nethost` : `get_hostfxr_path(buffer, size, const get_hostfxr_parameters*)` (`src/native/corehost/nethost/nethost.h:60`, `:91-94`) — résolution officielle de `hostfxr` (node-api-dotnet la réimplémente partiellement, `HostFxr.cs:56-70`).
- `hostfxr` (exports `src/native/corehost/fxr/hostfxr.cpp`) : `hostfxr_initialize_for_dotnet_command_line` (`:721`), `hostfxr_initialize_for_runtime_config` (`:764`), `hostfxr_get_runtime_delegate` (`:827`), `hostfxr_get/set_runtime_property_value` (`:872`, `:920`), `hostfxr_get_runtime_properties` (`:944`), `hostfxr_run_app` (`:787`), `hostfxr_close` (`:1003`), `hostfxr_set_error_writer` (`:551`), `hostfxr_get_dotnet_environment_info` (`:378`), `hostfxr_resolve_sdk2` (`:256`). Typedefs `hostfxr.h:40-295`.
- Délégués runtime : `hostfxr_delegate_type` = `hdt_com_activation`, `hdt_load_in_memory_assembly`, `hdt_winrt_activation`, `hdt_com_register`, `hdt_com_unregister`, `hdt_load_assembly_and_get_function_pointer`, `hdt_get_function_pointer`, `hdt_load_assembly`, `hdt_load_assembly_bytes` (`hostfxr.h:27-37`). Signatures `coreclr_delegates.h:30-58` ; `UNMANAGEDCALLERSONLY_METHOD ((const char_t*)-1)` (`:27`) pour obtenir directement un pointeur vers une méthode `[UnmanagedCallersOnly]`.
- Flux (design `docs/design/features/native-hosting.md:186-196`) : `get_hostfxr_path` → `hostfxr_initialize_for_runtime_config` → `hostfxr_get_runtime_delegate(hdt_load_assembly_and_get_function_pointer)` → pointeur natif → `hostfxr_close`.
- Contraintes : pas de runtimes côte à côte dans un processus (`native-hosting.md:103`) ; un `runtimeconfig.json` de composant doit être framework-dependent (`:284`) ; tout contexte initialisé après le premier est « secondaire » (`:513-518`).

## 3. P/Invoke source-généré, pointeurs de fonction, conventions

- `[LibraryImport]` : `LibraryName`, `EntryPoint`, `StringMarshalling`, `StringMarshallingCustomType`, `SetLastError` (`CoreLib/.../LibraryImportAttribute.cs:31-60`) ; le générateur émet un stub C# qui appelle un `DllImport` interne dérivé des champs de `LibraryImport` (`docs/design/libraries/LibraryImportGenerator/Pipeline.md:174-181`) ; marshallers fournis (`CoreLib/.../Marshalling/` : `Utf8StringMarshaller`, `Utf16StringMarshaller`, `SpanMarshaller`, `ReadOnlySpanMarshaller`, `ArrayMarshaller`, `SafeHandleMarshaller`, ...) ; marshallers utilisateur via `[CustomMarshaller]`/`[NativeMarshalling]`/`[MarshalUsing]`.
- `DisableRuntimeMarshallingAttribute` (ref:`14761`) : désactive le marshalling runtime de l'assembly ; `bool`/`char` deviennent 1/2 octets sans conversion (Learn, page de rupture .NET 11 citée §1) ; utilisé par LibraryImport pour les types valeur (`docs/design/libraries/LibraryImportGenerator/Compatibility.md:101`).
- Pointeurs `delegate* unmanaged[Cdecl|Stdcall|SuppressGCTransition|MemberFunction|Swift]<...>` ; types de convention publics `CallConvMemberFunction`, `CallConvSuppressGCTransition`, `CallConvSwift` (ref:`14509-14521`) ; `[SuppressGCTransition]` (`CoreLib/.../SuppressGCTransitionAttribute.cs:66`, ref:`15763`) pour appels natifs très courts sans transition GC.
- `Marshal.GetFunctionPointerForDelegate` / `GetDelegateForFunctionPointer` (`Marshal.cs:1194-1251`) ; `NativeLibrary.Load/TryLoad/GetExport/TryGetExport/SetDllImportResolver/GetMainProgramHandle` (`NativeLibrary.cs:40-251`).

## 4. Mémoire, épinglage, handles

- `NativeMemory.Alloc/AllocZeroed/AlignedAlloc/AlignedFree/Realloc/Free/Clear/Copy/Fill` (`NativeMemory.cs:22-76`, `NativeMemory.Windows.cs:25-163`).
- Handles typés (publics en 11.0) : `GCHandle<T>` (ref:`15582`, `GCHandle.T.cs:23-85`), `PinnedGCHandle<T>` avec `GetAddressOfObjectData()` (ref:`15684`, `:15692`), `WeakGCHandle<T>` (ref:`15821`) ; `GCHandleExtensions.GetAddressOfArrayData/GetAddressOfStringData` (`GCHandleExtensions.cs:28`, `:51`). `ToIntPtr/FromIntPtr` = jeton opaque passable en `void*` côté C.
- `ExtendedLayoutAttribute(ExtendedLayoutKind.CStruct | CUnion)` public (ref:`15536-15544`) : disposition C explicite pour structures partagées.
- `MemoryMarshal`, `CollectionsMarshal`, `Span<T>`/`Memory<T>`/`MemoryManager<T>` pour vues sans copie.

## 5. Projection d'objets et GC croisés

- `ComWrappers` : `GetOrCreateComInterfaceForObject` (`ComWrappers.cs:787`), `GetOrCreateObjectForComInstance` (`:922-943`), `RegisterForTrackerSupport` (`:1550-1565`, instance globale pour le « reference tracker », cf. `IReferenceTracker.cs`, `TrackerObjectManager.cs`), `RegisterForMarshalling` (`:1589`) ; base des générateurs COM (`docs/design/features/source-generator-com.md`).
- Pont GC croisé générique : `JavaMarshal` (`Initialize(delegate* unmanaged<MarkCrossReferencesArgs*, void>)`, `CreateReferenceTrackingHandle`, `FinishCrossReferenceProcessing` ; `CoreLib/.../Java/JavaMarshal.Unsupported.cs:20-91`) — **`[SupportedOSPlatform("android")]`**, activé seulement pour Android (ou debug/checked) dans NativeAOT (`src/coreclr/nativeaot/Directory.Build.props:74-76`, impl. `Runtime/interoplibinterface_java.cpp`). C'est le seul mécanisme du runtime qui résout des cycles .NET ↔ GC étranger ; pas d'équivalent pour JSC/V8.
- `ObjectiveCMarshal` (ref `System.Runtime.InteropServices.cs:2447`) : idem pour Objective-C.
- `TypeMapping.GetOrCreateExternalTypeMapping<TGroup>()` / `GetOrCreateProxyTypeMapping<TGroup>()` (`TypeMapping.cs:13-42`) : tables de projection de types résolues à la compilation, compatibles trimming/AOT ; motivation et prédécesseurs (C#/WinRT, Android) dans `docs/design/features/typemap.md:1-10`.

## 6. Interop JS déjà présente dans .NET (navigateur seulement)

`System.Runtime.InteropServices.JavaScript` (`[JSImport]`/`[JSExport]`) est `[SupportedOSPlatform("browser")]` (`src/libraries/System.Runtime.InteropServices.JavaScript/src/.../JSHost.cs:14`), avec implémentations Mono et CoreCLR (`JSHostImplementation.Mono.cs`, `JSHostImplementation.CoreCLR.cs`, `Interop/JavaScriptExports.CoreCLR.cs`). Inutilisable hors WASM, mais son ABI est le modèle à copier : cadre d'arguments `Span<JSMarshalerArgument>` à slots fixes de **32 octets** (`JSMarshalerArgument.cs:24`, `[StructLayout(Explicit, Size = 32)]`), un seul appel par invocation (`JSFunctionBinding.cs:157-230`), marshallers par type (`Marshaling/JSMarshalerArgument.*.cs`), générateur `gen/`.

## 7. Conséquences pour un pont Bun ↔ .NET sans node-api-dotnet

1. Le chemin naturel est **NativeAOT `NativeLib=Shared`** : exports C `[UnmanagedCallersOnly(EntryPoint)]`, signatures blittables (obligatoire en 11), consommés par `bun:ffi` `dlopen` ou chargés comme addon Node-API.
2. `hostfxr` reste utile seulement pour charger des assemblies IL arbitraires (scénario « dynamic ») ; un seul runtime par processus.
3. Les handles typés (`GCHandle<T>`, `PinnedGCHandle<T>`) et `NativeMemory` couvrent la durée de vie côté .NET ; il n'existe aucun pont GC croisé utilisable avec JSC (le pont `JavaMarshal` est limité à Android).
4. Un statique `.lib` lié dans `bun.exe` est possible techniquement (`NativeLib=Static`) mais hors support officiel et incompatible avec le budget « exe natif ≤ 1 Mio » ; à garder hors chemin principal.
