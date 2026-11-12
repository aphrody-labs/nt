# node-api-dotnet : architecture au niveau code

Source : `microsoft/node-api-dotnet@0483aa01` (2026-10-30 ; https://github.com/microsoft/node-api-dotnet/tree/0483aa01a76e88ccb8f9de0b3a89202b538ae41e), identique au fork `aphrody-labs/node-api-dotnet`. Lecture seule, aucune compilation. Chemins relatifs à la racine du dépôt ; `JSValue.cs:18` = `src/NodeApi/JSValue.cs` ligne 18 quand le dossier est évident.

## 1. Couches

| Couche | Fichiers | Rôle |
|---|---|---|
| Liaison C | `src/NodeApi/Runtime/JSRuntime.cs:39` (classe abstraite, 152 `public virtual napi_status`, défaut `throw NS()` l.41-46) ; `NodeJSRuntime.cs:14` + `NodejsRuntime.JS.cs` / `.Node.cs` / `.Embedding.cs` | 140 fonctions `napi_*`/`node_api_*` distinctes importées (`.JS.cs` + `.Node.cs`, rg `Import(ref …)`), 27 `node_embedding_*` (`.Embedding.cs`) |
| Types handle | `src/NodeApi/Runtime/JSRuntime.Types.cs:19` (`record struct napi_env(nint)`), `:24` (`napi_value`), `:113` (`napi_callback`), `:129` (`napi_finalize`), `:189` (`c_bool` = 1 octet) | Tous blittables |
| Valeurs | `src/NodeApi/JSValue.cs:18`, `JSValueScope.cs:71`, `JSReference.cs:31`, `JSObject/JSArray/JSTypedArray/...` | API C# idiomatique |
| Contexte | `src/NodeApi/Interop/JSRuntimeContext.cs:30`, `JSModuleContext.cs`, `JSSynchronizationContext.cs:35`, `JSThreadSafeFunction.cs` | Identité objets, classes, threads |
| Marshalling | `src/NodeApi.DotNetHost/JSMarshaller.cs:32` (≈ 3 900 lignes d'arbres d'expressions), `JSInterfaceMarshaller.cs` (Reflection.Emit) | .NET ↔ JS par type |
| Hôte JIT | `src/NodeApi/DotNetHost/NativeHost.cs` (addon AOT `Microsoft.JavaScript.NodeApi.node`), `HostFxr.cs`, `MSCorEE.cs` ; `src/NodeApi.DotNetHost/ManagedHost.cs`, `TypeExporter.cs` | Chargement CoreCLR / .NET Framework dans Node |
| Générateur | `src/NodeApi.Generator/ModuleGenerator.cs:23` (Roslyn `ISourceGenerator`), `TypeDefinitionsGenerator.cs`, `ExpressionExtensions.cs:29` (`ToCS`) | Code C# AOT + `.d.ts` |
| Loader JS | `src/node-api-dotnet/init.js:33-78` | `require()` du `.node` par RID puis `nativeHost.initialize(tfm, managedHostPath, require, import)` |

Liaison C : chaque méthode garde un pointeur de fonction statique résolu paresseusement à la première utilisation (`NodeJSRuntime.cs:35-44`, nom capturé par `[CallerArgumentExpression]`) via `NativeLibrary.GetExport(_libraryHandle, name)` (`:27-28`). Le handle par défaut est `NativeLibrary.GetMainProgramHandle()` (`:18-21`) : **les symboles napi doivent être exportés par l'exécutable hôte** (node.exe, bun.exe) ; aucun lien d'import vers `node.lib`. `IsAvailable()` = `TryGetExport` (`:24-25`), utilisé pour détecter les fonctionnalités (ex. TSFN, `JSThreadSafeFunction.cs:32-33`). Shim netstandard/net472 : `Runtime/NativeLibrary.cs:25-33` (`GetModuleHandle(NULL)` / `dlopen(NULL)`).

Pointeurs de fonction vs délégués : `UNMANAGED_DELEGATES` est défini sauf pour la génération de doc (`Directory.Build.props:82`) ; les callbacks sont alors des `delegate* unmanaged[Cdecl]` vers des méthodes `[UnmanagedCallersOnly]` (`JSValue.cs:1230-1255`), sinon des délégués conservés en champs statiques (`:1216-1229`).

## 2. Modèle de valeurs

- `JSValue` = `readonly struct { napi_value _handle; JSValueScope? _scope; }` (`JSValue.cs:18-21`). `default` = `undefined` (`:31-35`, `:94`).
- Chaque accès à `Handle` vérifie la portée : `ThrowIfDisposed()` + `ThrowIfInvalidThreadAccess()` (`JSValue.cs:69-86`) ; ce dernier compare l'`env` de la portée courante thread-static (`JSValueScope.cs:95-96`, `[field: ThreadStatic] CurrentOrNull`) à celui de la valeur (`:442-448`).
- `JSValueScopeType` : `NoContext`, `Root`, `Module`, `Callback`, `Handle`, `Escapable` (`JSValueScope.cs:16-54`). Seuls `Handle`/`Escapable` ouvrent un `napi_handle_scope` (`:314-323`) ; `Callback` s'appuie sur la portée implicite de l'appel napi. `Root`/`Callback` installent le `SynchronizationContext` JS à l'entrée et le restaurent à la sortie (`:349-355`, `:399`).
- AOT : pas de portée `Root` ; chaque module a son `JSRuntimeContext` (`JSValueScope.cs:28-31`, `:250-262` : `Runtime = runtime ?? new NodejsRuntime()`).
- `JSRuntimeContext` est rangé comme *instance data* de l'env (`JSRuntimeContext.cs:152-161`, `JSValue.SetInstanceData`) ; il porte les maps de classes (`:58`, `:68`), structs (`:92`), imports (`:102`), proxies de collections (`:114`) et l'identité objet .NET→wrapper JS (`:81`, `ConditionalWeakTable<object, JSReference>`).
- Chaînes : création UTF-16 directe (`JSValue.cs:157-166`, conversion implicite `string`→`JSValue` `:1528`) ; lecture en 2 appels napi (longueur puis copie) dans `string.Create` (`:515-531`). La copie passe `span.Length + 1` pour écrire le NUL dans le terminateur interne de `string` (`:526-527`). Propriétés par nom : `value["x"]` (`JSValue.cs:114-118`) convertit d'abord `string` → nouvelle chaîne JS (`napi_create_string_utf16`) puis `napi_get_property` (`:560-562`) ; soit 2 appels napi et une chaîne JS par accès, sans cache de clés. `napi_get/set/has_named_property` sont liés (`NodejsRuntime.JS.cs:1429-1451`, UTF-8 via `PooledBuffer`) mais jamais appelés hors des classes runtime. Non importés : `node_api_create_external_string_*`, `node_api_create_property_key_*`.

## 3. Marshalling

Un seul moteur, deux back-ends :

- `JSMarshaller` construit des `LambdaExpression` par type/méthode : `BuildFromJSMethodExpression` (`JSMarshaller.cs:522`), `BuildFromJSConstructorExpression` (`:450`), `BuildToJSMethodExpression` (`:614`), propriétés (`:554`, `:584`, `:1129`, `:1197`), délégués (`:800`, `:938`), surcharges (`:1263`, `:1353`). Conversions : `BuildConvertFromJSValueExpression` (`:2075`), `BuildConvertToJSValueExpression` (`:2422`), Promise↔Task (`:2771`, `:2843`), tableaux (copie, `:2923`, `:2967`), structs (copie champ par champ, `:3000`, `:3040`), collections (proxies, `:3099-3520`).
- Types gérés (`:2077-2400`) : opérateurs explicites de `JSValue` (primitives, string), `Nullable<T>`, enums, tableaux, `Memory<T>`/`ReadOnlyMemory<T>` sur typed arrays (`:2157-2190`), `KeyValuePair`, tuples, `DateTime`, `TimeSpan`, `DateTimeOffset`, `Guid`, `BigInteger`, `CancellationToken`, `Stream`, délégués, `Task`, interfaces de collections, interfaces arbitraires.
- **JIT** : `LambdaExpression.Compile()` + cache `ConcurrentDictionary` (`:75-79`, `:304-359`) ; interfaces JS implémentées en .NET via `TypeBuilder`/`ILGenerator` (`JSInterfaceMarshaller.cs:52-512`) ; assembly dynamique (`JSMarshaller.cs:3938`).
- **AOT** : le générateur Roslyn convertit les symboles en `Type` symboliques (`SymbolExtensions.cs:34-86`, `AssemblyBuilder` en mémoire dans le compilateur), appelle le même `JSMarshaller` (`ModuleGenerator.cs:29-33`, `:610-805`) puis sérialise chaque arbre en C# via `ExpressionExtensions.ToCS` (`ExpressionExtensions.cs:29`, `ModuleGenerator.cs:1041-1055`). Le code AOT exécute donc la même logique de conversion, compilée statiquement.
- Typed arrays sans copie : `JSTypedArray<T>(Memory<T>)` réutilise le tableau JS d'origine si la mémoire en provient, sinon épingle la mémoire .NET (`Memory.Pin()`) et crée un `ArrayBuffer` externe (`JSTypedArray.cs:108-123`, `JSValue.cs:252-264`, `PinnedMemory` `:1462-1500`). Dans l'autre sens, `JSTypedArray<T>.Memory` expose la mémoire JS via un `MemoryManager<T>` qui suppose un tampon non déplaçable (`JSTypedArray.cs:286`, `:332-359`, commentaire `:355-356`).
- Classes .NET exportées : `napi_define_class` + `napi_wrap` d'un `GCHandle` (`JSValue.cs:788-860`) ; un .NET retourné à JS est rewrappé via le constructeur JS de la classe avec un `external` (`JSRuntimeContext.cs:343-367`).
- `.d.ts` : `TypeDefinitionsGenerator` lit l'assembly compilé via `MetadataLoadContext` (`TypeDefinitionsGenerator.cs:213`, `:261`, `:419`).

## 4. Threading

- Règle : toute API JS sur le thread JS, sinon `JSInvalidThreadAccessException` (`docs/features/js-threading-async.md:3-15`, `JSValueScope.cs:442-448`).
- `JSSynchronizationContext.Create()` choisit TSFN si `napi_create_threadsafe_function` est exporté, sinon `JSDispatcherQueue` (contexte d'embedding) (`JSSynchronizationContext.cs:42-55`).
- `JSTsfnSynchronizationContext` (`:252-400`) : une TSFN `maxQueueSize: 0`, `initialThreadCount: 1`, aussitôt `Unref()` pour ne pas bloquer la sortie (`:267-273`) ; hook `napi_add_env_cleanup_hook` enregistré après la TSFN pour la libérer avant la fermeture du handle libuv (`:274-284`). `Post` = `NonBlockingCall` (`:358-368`) ; `Send` = `NonBlockingCall` + `ManualResetEvent.WaitOne()` (`:372-400`). `TsfnCallGate` empêche un appel concurrent à la libération (`TsfnCallGate.cs:8-11`).
- `JSThreadSafeFunction` : chaque appel alloue un `GCHandle` (+ fermeture) libéré par le callback JS ou en cas d'échec (`JSThreadSafeFunction.cs:174-190`) ; `napi_queue_full` / `napi_closing` sont avalés (`:183-189`). `Ref/Unref/Release/Abort` (`:131-171`).
- Task↔Promise : `AsTask` (`TaskExtensions.cs:14-57`), `AsPromise` (`:95-137`) ; les continuations reviennent sur le thread JS via le contexte installé par chaque portée `Callback`.
- Workers : `NodeWorker` encapsule `node:worker_threads` (`NodeWorker.cs:20-25`, `:120`) ; plusieurs hôtes gérés possibles (une portée `Root` par worker, `JSValueScope.cs:205-214`).

## 5. Durée de vie / GC

- JS → .NET : `GCHandle` normal (fort) stocké en `napi_wrap`/`napi_create_external`/`data` de fonction ; libéré par finaliseur napi `FinalizeGCHandle` (`JSValue.cs:1380-1396`), variante `IDisposable` (`:1398-1421`) et mémoire épinglée (`:1423-1440`). Compteur et map de handles pour diagnostic (`JSRuntimeContext.cs:732-797`).
- .NET → JS : `JSReference` (`napi_ref`, fort ou faible ; `JSReference.cs:71-103`, `:181-198`). `Dispose()` explicite : suppression directe ou postée au thread JS (`:373-397`). Finaliseur .NET (`:530-537`) : jamais d'exception ; post vers le thread JS si contexte, sinon file `s_pendingFinalizerDeletions` vidée à la création de la prochaine portée sur ce thread (`:36-56`, `:400-460`, `:478`, `JSValueScope.cs:362-366`).
- Identité : `ConditionalWeakTable<object, JSReference faible>` (`JSRuntimeContext.cs:81`, `:304-341`). Un wrapper JS maintient l'objet .NET vivant (GCHandle fort) ; l'objet .NET ne garde qu'une référence faible au wrapper. **Aucun suivi de cycles inter-GC** : un objet .NET qui tient un `JSReference` fort vers un objet JS qui le référence fuit (rien dans le code ne relie les deux GC, ni `IReferenceTracker` ni équivalent).
- `CallFinalizeAction` crée encore une portée JS dans un finaliseur, marqué TODO car interdit à terme (`JSValue.cs:1442-1460`). Aucun module n'exporte `node_api_module_get_api_version_v1` (rg vide) : les finaliseurs suivent donc la sémantique « legacy » du runtime hôte.

## 6. Enregistrement du module

- AOT : le générateur émet `[UnmanagedCallersOnly(EntryPoint = "napi_register_module_v1")]` (`ModuleGenerator.cs:27`, `:294-298`) qui crée une portée `Module` non libérée (parent des callbacks, `:290-305`) puis exporte la classe `[JSModule]` ou les membres `[JSExport]` via `JSModuleBuilder<T>` (`:364-393`) ; erreur → `JSError.ThrowError` (`:339-346`).
- Hôte JIT : `NativeHost` exporte aussi `napi_register_module_v1` (`NativeHost.cs:184-187`) et ne fait qu'exposer `initialize()`.
- Packaging AOT : `PublishAot` ⇒ `PublishNodeModule`, `InvariantGlobalization`, `UseSystemResourceKeys` (`src/NodeApi/NodeApi.csproj:13-19`) ; `SelfContained` forcé (`NodeApi.targets:24-33`) ; renommage `.dll/.so` → `.node` (`:36-57`) ; le script JS du module est réécrit pour ne plus dépendre de `node-api-dotnet` (`:2-22`).

## 7. Chemin AOT vs chemin JIT

| | AOT (`[JSExport]` + NativeAOT) | JIT (ManagedHost) |
|---|---|---|
| Chargement | `require('x.node')` → `napi_register_module_v1` généré | `init.js` → `NativeHost.InitializeModule` → `hostfxr` → `ManagedHost.InitializeModule` (`ManagedHost.cs:181-200`) |
| Runtime | NativeAOT dans le `.node` | CoreCLR via `hostfxr_initialize_for_runtime_config` (`NativeHost.cs:484-492`) + `load_assembly_and_get_function_pointer` avec `UNMANAGEDCALLERSONLY_METHOD` (`:407-466`) ; .NET Framework via `ICLRRuntimeHost` (`:325-360`) |
| hostfxr | — | Résolution maison `DOTNET_ROOT/host/fxr/<max>` (`HostFxr.cs:56-70`, TODO de porter `nethost.cpp`) ; un seul runtime par processus (`NativeHost.cs:238-256`) |
| Marshalling | Code C# généré (§3) | Expressions compilées + Reflection.Emit |
| Exposition | Types/méthodes `[JSExport]` non génériques (`docs/features/dotnet-native-aot.md:25-36`) | Toute assembly, namespaces dynamiques (`ManagedHost.cs:351-426`, `:461-566`, `TypeExporter.cs`) |
| Taille | ≥ ~3 Mo par plateforme (`docs/features/dotnet-native-aot.md:14`) | assemblies IL seules |

TFMs : `net10.0;net9.0;net8.0;netstandard2.0` (+`net472` sous Windows), AOT = `net10.0` si SDK 10 (`Directory.Build.props:3-14`), `LangVersion 12` (`:14`), `global.json` SDK `10.0.303`. CI : `net472, net8.0, net9.0, net10.0` × Node `18.x, 22.x` (`.github/workflows/build.yml:15-16`). **Ni net11 ni Bun** dans la matrice. Signatures `[UnmanagedCallersOnly]` : uniquement `nint`/record structs `nint`/`c_bool` ; aucun `bool`/`char` (rg), donc non concernées par le rejet .NET 11 des signatures non blittables (cf. `dotnet-lowlevel.md` §1).

## 8. Embedding (libnode)

`NodeEmbeddingPlatform` / `NodeEmbeddingRuntime` / `NodeEmbeddingThreadRuntime` chargent `libnode` (`NodeEmbedding.cs:96-139`) et importent 27 fonctions `node_embedding_*` (`platform_create`, `runtime_create`, `runtime_event_loop_run[_once|_no_wait]`, `runtime_node_api_scope_open/close`, `runtime_config_set_task_runner`, ... ; `NodejsRuntime.Embedding.cs`). `NodeEmbeddingThreadRuntime` dédie un thread et pompe la boucle (`NodeEmbeddingThreadRuntime.cs:24`, `:70`). Le README des benchs exige une « special branch build of `libnode` » (`bench/README.md:7`). Côté Bun (`oven-sh/bun` fork @ `4b8463ee`), les listes d'export `src/symbols.def` et `src/symbols.txt` ne contiennent que Node-API, libuv, une partie de l'API C++ V8 (noms décorés) et `node_module_register` : aucune API d'embedding de type `node_embedding_*`. Ce chemin (`.NET` hôte de JS) ne s'applique donc pas à Bun sans patch.

## 9. Chemins critiques de performance (JS → .NET)

Par appel (`JSValue.cs:1259-1266`, `:1356-1376`, `JSCallbackArgs.cs:20-60`, `:75-84`) :
1. `new JSValueScope(Callback)` : **allocation d'une classe** + vérifications de parent + `SetSynchronizationContext` ×2 + `DrainPendingDeletions` (`JSValueScope.cs:71`, `:349-366`).
2. `napi_get_cb_info` ×2 (longueur + data, puis args + this) et `GCHandle.FromIntPtr(data).Target`.
3. `stackalloc napi_value[argc]` ; délégué `JSCallback` du descripteur ; conversions par argument (1+ appel napi chacune, ex. `napi_get_value_double`) ; résultat → 1+ appel napi.
4. Chaque appel napi = appel virtuel `JSRuntime` + pointeur de fonction + vérifications de portée/thread sur chaque `JSValue.Handle`.
5. Exceptions .NET → `JSError.ThrowError` (`JSError.cs:271`).

Chiffres éditeur (non mesurés ici) : appel « warm » 54 µs JIT / 47 µs AOT vs 23 µs JS pur, moyenne de 10 000 appels passant un objet moyen (`docs/features/performance.md:11-20` ; la l.11 dit « JS to .NET », la l.20 « .NET -> JS » : sens ambigu dans la source). Bancs BenchmarkDotNet dans `bench/Benchmarks.cs:151-269`, dépendants d'un libnode spécial.

## 10. Ce qui compte pour Bun

- Dépendance dure : symboles `napi_*` exportés par l'exe hôte (`NodeJSRuntime.cs:18-28`) et TSFN (`JSSynchronizationContext.cs:42-55`).
- Fonctions « Node » importées : `napi_get_uv_event_loop`, async work, hooks de nettoyage (async inclus), `napi_adjust_external_memory`, type tags, instance data, `node_api_get_module_file_name`, `node_api_symbol_for`, `node_api_create_syntax_error` (`NodejsRuntime.JS.cs` / `.Node.cs`). Mais `CreateAsyncWork`/`QueueAsyncWork`/`GetUVEventLoop`/`AdjustExternalMemory`/`AddAsyncCleanupHook` ne sont appelées nulle part hors des classes runtime (rg sur `src/` : seuls `JSRuntime.cs:442-450`, `NodejsRuntime.Node.cs:180`, `:499` et le pass-through `TracingJSRuntime.cs`) ; la liaison étant paresseuse (§1), leur absence éventuelle chez l'hôte ne casse rien. Les `Task` .NET tournent sur le pool .NET et reviennent par TSFN (§4).
- Surface effective : sur 138 méthodes `override` de `NodejsRuntime` (`.JS.cs` + `.Node.cs`), 110 sont appelées par le reste de la bibliothèque et 28 jamais (async work ×4, `AsyncInit/Destroy`, `MakeCallback`, `Open/CloseCallbackScope`, buffers Node ×5, `GetUVEventLoop`, `AdjustExternalMemory`, `Add/RemoveAsyncCleanupHook`, `GetModuleFileName`, `GetNodeVersion`, `FatalException`, `GetNewTarget`, `Get/Set/HasNamedProperty`, `ThrowTypeError/RangeError/SyntaxError`) — rg `\.<Méthode>(` hors `JSRuntime.cs`, `NodejsRuntime.*.cs`, `TracingJSRuntime.cs`.
- Couverture Bun des 140 symboles : tous définis dans `oven-sh/bun` (fork aphrody-labs @ `4b8463ee`), soit en C++ `extern "C"` sous `src/jsc/bindings/` (92 noms distincts), soit dans `src/symbols.def` (142 noms) ; diff vide (union vs liste importée). Sous Windows l'export passe par `NAPI_EXTERN` = `__declspec(dllexport)` (`src/runtime/napi/js_native_api.h:11-20`) plus `symbols.def`, vérifié par `scripts/build/binary-expectations.ts:590-612`.
- Hypothèses Node implicites : ordre inverse des cleanup hooks (`JSSynchronizationContext.cs:274-277`), tampons typed arrays non déplaçables (`JSTypedArray.cs:355-356`), `require`/`import` passés par `init.js` (`:74-78`), `node:worker_threads` (`NodeWorker.cs:25`).
