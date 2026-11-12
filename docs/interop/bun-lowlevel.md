# Bun : Node-API et bun:ffi au niveau code

Source : `aphrody-labs/bun@4b8463ee` (branche `aphrody/main`, 2026-11-12) = `bun-v1.4.4` + 105 commits, 3 commits devant `oven-sh/bun@ccb3611f` (`git describe`, `rev-list`). Chemins relatifs à la racine du dépôt. Lecture seule, rien compilé ni exécuté. Le moteur JSC/WebKit est un binaire précompilé épinglé (`scripts/build/deps/webkit.ts:4-6`) : tout ce qui est dans `JSC::FFI` est **hors de ce dépôt** et non audité. « Inférence » = lecture du code, pas un énoncé du code.

## 1. Chargement d'un addon

- Le noyau Bun est désormais majoritairement en Rust : ~100 points d'entrée Node-API en C++ (`src/jsc/bindings/napi.cpp:413-3366`), 53 en Rust `#[no_mangle]` (`src/runtime/napi/napi_body.rs:628-3525` : chaînes/entiers, tableaux, handle scopes, async work, TSFN, promesses, dates, infos typedarray/arraybuffer, uv loop, `napi_fatal_error`).
- En-têtes vendus dans `src/runtime/napi/` ; deux écarts : type env `struct NapiEnv*`, `NAPI_VERSION` par défaut 10 (`src/runtime/napi/README.md:12-22`, `js_native_api_types.h:15`, `src/jsc/bindings/napi.h:59`). `napi_get_version` → 10 (`napi_body.rs:1671-1678`) ; `NAPI_EXPERIMENTAL` ⇒ version `INT_MAX` (`js_native_api_types.h:5-8`).
- `require("x.node")` = `process.dlopen` (`src/jsc/bindings/JSCommonJSExtensions.cpp:29`, `BunProcess.cpp:500-858`) ; `--no-addons` (`:507-509`) ; drapeaux ignorés, POSIX `dlopen(RTLD_LAZY)` (`:649`), Windows `LoadLibraryExW(LOAD_WITH_ALTERED_SEARCH_PATH)` (`src/sys/windows/mod.rs:1775-1779`).
- Enregistrement : `napi_register_module_v1` + `node_api_module_get_api_version_v1` (`BunProcess.cpp:781-783`) ; **sans export de version, `module_version = 8`** (`:798-802`). Une valeur de retour différente de `exports` remplace `module.exports` (`:851-855`) ; `nm_filename` = URI `file://` (`:808-823`). `napi_module_register` (legacy) est mis en file puis rejoué après `dlopen` (`napi.cpp:792-806`, `BunProcess.cpp:697-773`).
- Exports Windows : `napi_*`/`node_api_*` exportés par `__declspec(dllexport)` (`NAPI_EXTERN`, `src/runtime/napi/js_native_api.h:11-20`), `src/symbols.def` ajoute libuv et des noms Rust ; contrôlé par `scripts/build/binary-expectations.ts:589-616`, `/DEF:` via `scripts/build/flags.ts:1604-1608`. `symbols.def` est maintenu à la main et incomplet seul (ex. pas `napi_create_function`) — sans conséquence puisque le C++ s'exporte lui-même.
- Imports « node.exe » (Windows) : `NodeExeImports::Scope` autour du `LoadLibrary` (`BunProcess.cpp:624-627`) + hook `LdrRegisterDllNotification` (`src/jsc/bindings/NodeExeImportsWindows.cpp:282-294`) qui réécrit la table d'import `node.exe` de chaque module chargé **pendant** `process.dlopen` vers les exports de `bun.exe` (`:156-209`, `:272-280`) ; delay-load : seul le handle en cache est posé (`:211-226`) ; module déjà chargé : redirection a posteriori (`:326-338`) ; symbole absent ⇒ échec « imports 'X' from node.exe, which Bun does not provide » (`:344`, tests `test/napi/napi.test.ts:2180-2220`).
- Fonctions expérimentales / v9-v10 présentes : `node_api_create_object_with_properties` (`napi.cpp:1619`), `node_api_set_prototype` (`:1595`), SharedArrayBuffer (`:1664`, `:1677`, `:1749`), `node_api_post_finalizer` (`:1173`), `node_api_symbol_for` (`:1389`), syntax error (`:1414`, `:1424`), chaînes externes (`:1486`, `:1506`), `node_api_create_property_key_*` (`:1525-1550`), `node_api_create_buffer_from_arraybuffer` (`:1552`), `node_api_get_module_file_name` (`:1586`).
- Trim : `bun build --compile` peut retirer `Ffi` (« bun:ffi and its C compiler ») et `NativeAddons` (« native addons, process.dlopen and N-API ») (`src/trim/features/bun.def:13`, `:115`) ; un exécutable compilé qui charge un addon .NET doit garder la fonctionnalité correspondante.

## 2. Env, valeurs, portées, GC

- `NapiEnv` = struct C++ `RefCounted` (`napi.h:174-724`) ; **un env par chargement de module** ajouté à `m_napiEnvs` du global (`src/jsc/bindings/ZigGlobalObject.cpp:5197-5201`, `ZigGlobalObject.h:707`) ; un jeu par Worker.
- `napi_value` = bits bruts d'`EncodedJSValue` (`napi.h:764-782`, `napi_body.rs:384-400`, static_assert `BunProcess.cpp:820`).
- Racines : `toNapi` ajoute les cellules (pas les primitives) au `HandleScopeImpl` courant **du global** (pas de l'env), seulement si une portée est ouverte (`napi.h:774-782`). `HandleScopeImpl` = cellule GC avec `Vector<WriteBarrier,16>` (`src/jsc/bindings/napi_handle_scope.h:17-84`), `append` sous verrou de cellule (`napi_handle_scope.cpp:67-71`), `close` libère et vérifie l'équilibre (`:102-119`, `:144-159`), pas d'ouverture pendant le sweep (`:121-142`).
- Une portée est ouverte autour de chaque appel Bun → addon (`napi_handle_scope.h:86-95`, `NapiClass.cpp:67`, `napi.cpp:759`). Inférence : une `napi_value` créée hors portée (thread étranger) n'est protégée que par le scan conservatif de pile de JSC.

## 3. Callbacks JS → natif

- `napi_create_function` crée un `NapiClass` (sous-classe de `JSFunction`, host function `NapiClass_ConstructorFunction<false|true>`) avec `prototype` même pour une fonction simple (`napi.cpp:944-967`, `NapiClass.cpp:83-140`) ; chaque méthode/getter/setter de `napi_define_properties` est son propre `NapiClass` (`napi.cpp:370-392`) ; `napi_define_class` (`:2145-2181`).
- Chemin par appel (`NapiClass.cpp:17-81`) : downcast du callee, (construct : `get("prototype")`), `NAPICallFrame` avec `toThis` sloppy (`napi.h:1057-1067`), **`NapiHandleScope` qui alloue une cellule GC à chaque appel** (`napi_handle_scope.cpp:136-141`), appel, `napi_set_last_error`, `throwPendingException`. Aucun intrinsic ni DOMJIT.
- `napi_get_cb_info` : préambule sans vérification d'exception (`napi.cpp:969-986`) ; `toNapi` par argument (append verrouillé par cellule), padding `undefined` (`:314-338`).
- `napi_call_function` via `AsyncContextFrame::call` (`napi.cpp:3220-3268`) ; `napi_new_instance` (`:3155-3190`).
- `napi_wrap` : `NapiRef` inline sur une instance `NapiPrototype`, sinon `NapiExternal` en propriété privée (`napi.cpp:817-885`) ; `unwrap` (`:923-942`), `remove_wrap` (`:887-921`).

## 4. Durée de vie, finaliseurs

- `NapiRef` : `Strong` tant que `refCount > 0` + valeur faible (`napi.h:841-934`) ; primitives acceptées seulement si `nm_version >= 10` (`napi.cpp:1113-1118`) ; `unref` à 0 → `generic_failure` (`:1192-1194`) ; `napi_delete_reference` sûr depuis un finaliseur GC (`:1233-1247`).
- Mort faible → `callFinalizerFromGC`, mis en file `m_pendingRefFinalizers` si différé (`napi.cpp:298-312`, `NapiRef.cpp:49-60`, `napi.h:356-363`).
- **Quand** : `doFinalizer` diffère si en GC et (`mustDeferFinalizers()` ou thread GC), sinon exécute (`napi.h:455-468`) ; `mustDeferFinalizers()` = vrai pour tout module non `NAPI_EXPERIMENTAL` (`:528-539`) ; contrôle « finaliseur a touché le GC » réservé aux modules expérimentaux (`:439-453`). Exécution différée : `NapiFinalizerTask::schedule` (`napi_body.rs:5443-5490`) — hors thread JS : posté via le VM handle ; à l'arrêt : hook de nettoyage ou abandon ; sinon `enqueue_task`. `Finalizer::run` ouvre une portée (`:2529-2537`).
- `napi_add_finalizer` (`napi.cpp:1138-1171`) ; `node_api_post_finalizer` → `Bun__napi_enqueue_finalizer` (`:1173-1181`) ; `napi_create_external` → `NapiExternal` dont le destructeur n'exécute le finaliseur immédiatement que pour les modules expérimentaux (`napi_external.cpp:6-10`).
- Type tags : weak map globale (`napi.cpp:3270-3308`, `napi_type_tag.h:11-49`) ; instance data par env (`napi.cpp:3014-3066`).
- Hooks de nettoyage : doublon ⇒ abort (`napi.h:372-415`), exécution en ordre inverse (`:687-723`). Démontage d'env (`napi.h:203-291`) : hooks → abort des TSFN → hooks → finaliseurs liés en ordre inverse → finaliseur d'instance data ; enregistré comme hook VM (`napi_body.rs:2470-2477`) et attend la fin des async works (`napi.h:244-247`, `napi_body.rs:2480-2493`).

## 5. Threads

- TSFN : struct `napi_body.rs:2579-2637`, file `LinearFifo`, `max_queue_size == 0` = illimité (`:2668-2687`). `napi_call_threadsafe_function` (`:3012-3044`) : bloquant = condvar, non bloquant = `queue_full`, fermeture = `closing` ; pas de null-check de `func` (`:3449-3460`).
- Dispatch : `schedule_dispatch` poste un `ConcurrentTask` via `VmHandle` faible (`:3048-3079`) ; `on_dispatch` vide **toute** la file sans plafond par tick (Node : 1000) (`:2721-2791`) ; microtâches drainées entre appels, pas avant le premier (`:2836-2894`) ; `call_js` sous portée + `complete_in_context` (`:2938-2953`) ; abort rend les éléments restants à `call_js` avec env nul (`:2968-2985`).
- Ref/unref : TSFN créée « ref » (garde la boucle vivante, `:3425-3427`) ; `ref`/`unref` thread JS uniquement (`:3232-3247`) ; TSFN enregistrée sur l'env pour neutralisation au démontage (`:3410-3423`) ; après démontage d'un Worker → `napi_closing` (`:2603-2607`, `:3026-3038`). `napi_would_deadlock` absent (`:475`).
- Async work : struct `:1916-1934`, `WorkPool::schedule` (`:1974-1993`), annulation si VM s'arrête (`:2001-2030`), `complete` sur le thread JS (`:2037-2086`) ; taille du pool `UV_THREADPOOL_SIZE`/`GOMAXPROCS`/CPU, bornée 2..1024 (`src/threading/work_pool.rs:125-131`, `src/bun_core/util.rs:2697-2742`).
- Contexte async : `napi_async_init` renvoie le pointeur d'env, `napi_async_destroy` no-op (`napi_body.rs:1275-1296`) ; `napi_make_callback` = appel simple sans drain de microtâches (`:1298-1349`) ; `napi_open/close_callback_scope` no-op sans écrire le résultat (`:1413-1432`).
- libuv : Windows = vrai libuv, exporté via `symbols.def` ; `napi_get_uv_event_loop` renvoie la boucle du **thread appelant**, pas de l'env (`napi_body.rs:2395-2413`). POSIX : émulation partielle (`src/runtime/napi/uv_posix.rs:1-22`), le reste crash (`src/jsc/bindings/uv-posix-stubs.c:1337`, `:1468`).
- Réveil de boucle : `ConcurrentTask` en `UnboundedQueue` (`src/event_loop/ConcurrentTask.rs:286-335`) → `el.post` + `el.wakeup()` (`src/jsc/event_loop.rs:847-853`, `src/jsc/VmHandle.rs:180-188`) → `us_wakeup_loop` (`event_loop.rs:1315-1320`, `packages/bun-usockets/src/loop.c:175-180`) ; Windows : `uv_async_send` (`packages/bun-usockets/src/eventing/libuv.c:627-633`) ; au plus 8 recharges de la file concurrente par tick (`event_loop.rs:830-836`).

## 6. Chaînes et tampons

- Création latin1/utf16 : copie dans une nouvelle `WTF::String` (`napi_body.rs:757-807`, `:850-900`) ; utf8 transcodée (`:841-845`) ; longueur > `INT32_MAX` → `invalid_arg` (`:772`).
- **Chaînes externes zéro-copie** (`WTF::ExternalStringImpl`, `*copied = false`) (`napi.cpp:1449-1523`).
- `node_api_create_property_key_*` = `napi_create_string_*`, pas d'atome (TODO `jsAtomString`, `napi.cpp:1525-1550`).
- `napi_get_value_string_*` copie toujours ; `buf == NULL` → longueur (octets utf8 ou unités) (`napi.cpp:2614-2635`) ; écrit au plus `bufsize-1` + NUL (`:2650-2697`).
- Tampons : `napi_create_buffer` non initialisé, pointeur stable (`napi.cpp:2274-2308`) ; `create_external_buffer` zéro-copie, non transférable (`:2412-2466`) ; `create_external_arraybuffer` zéro-copie, finaliseur une seule fois (GC ou nettoyage d'env) (`:2353-2400`, `:2468-2501`) ; `node_api_create_buffer_from_arraybuffer` partage le stockage (`:1552-1584`) ; `napi_detach_arraybuffer` (`:1265-1288`). Les getters `*_info` matérialisent le tampon pour un pointeur stable (`napi_body.rs:1575`, `:2226`).

## 7. Erreurs

- Dernière erreur par env (`napi.h:575-582`) ; `napi_get_last_error_info` : `engine_*` toujours 0 (`napi.cpp:243-296`).
- `napi_throw*` range l'exception sur l'env (`napi.h:470-477`, `napi.cpp:1028-1043`) ; préambules suivants → `pending_exception` (`napi.h:561-563`) ; relancée au retour du callback (`NapiClass.cpp:69-72`).
- `napi_fatal_error` → `Output::panic` (`napi_body.rs:2161-2185`) ; `napi_fatal_exception` → `Bun__reportUnhandledError` (`napi.cpp:1367-1378`) ; JS non exécutable : `napi_cannot_run_js` si `nm_version >= 10`, sinon `pending_exception` (`napi.h:550-554`).

## 8. Écarts connus vs Node

- Pas de page de statut Node-API (`docs/runtime/node-api.mdx:1-19`) ; aucun marqueur « not implemented » ; TODO : `napi.cpp:777`, `:1158`, `:1529`, `:1538`, `:1547`, `:1823`, `:2429`, `:3013` ; `napi_body.rs:1042`, `:1593`, `:2411`.
- No-op : contexte async, callback scopes, `make_callback` (§5).
- Tests Node `todoIf` (`test/napi/node-napi-tests/test/node-api/*/do.test.ts`) : `test_async`, `test_threadsafe_function`, `test_instance_data` (stubs uv POSIX), `test_uv_loop`, `test_fatal`, `test_buffer`, `test_async_context`, `test_async_cleanup_hook`, `test_make_callback[_recurse]`, `test_uv_threadpool_size`, `test_callback_scope` (Windows), `test_reference_by_node_api_version` (macOS). Aucun test `js-native-api` en todo.
- Windows : skips `test/napi/napi.test.ts:533`, `:2026`, `:2067`, `:2114-2116` ; la CI Windows ne compile pas d'addons node-gyp (`test/expectations.txt:20-24`), build rapide du harness désactivé sur win32 (`test/napi/node-napi-tests/harness.ts:91`) ; tests `cc()`+napi `todoIf(isWindows)` (`test/napi/napi-value-ffi.test.ts:76-97`, `:160`).

## 9. bun:ffi

- `dlopen`/`linkSymbols`/`CFunction`/`JSCallback` **n'utilisent pas TinyCC** : `dlopen` (`src/js/bun/ffi.ts:200-210`) → `FFI::dlopen` (`src/runtime/ffi/ffi_body.rs:1531-1710`) : `DynLib::open` (nom puis chemin absolu, `:1602-1635`), `dlsym`, `Bun__CreateJSCFFIFunction` → `JSC::FFI::Signature::tryCreate` + `JSC::JSFFIFunction::create` (`src/jsc/bindings/JSCFFIBridge.cpp:65-97`). Le code d'appel est dans le WebKit précompilé ; la doc affirme un appel direct depuis DFG/FTL (`docs/runtime/ffi.mdx:52`) — non vérifiable ici.
- TinyCC sert seulement à `cc()` (`ffi_body.rs:1019-1290`) : wrapper C généré (`:2186-2357`) préfixé par `FFI.h` (`:2064-2066`), arguments lus dans la CallFrame (`src/runtime/ffi/FFI.h:147-151`), `-std=c11 -nostdlib` (`:2104-2108`), trampoline SysV→MS sur Windows x64 (`src/jsc/bindings/JSFFIFunction.cpp:72-87`, `:157-185`). `viewSource` montre ce wrapper même pour des symboles `dlopen`, ce qui est trompeur (`ffi_body.rs:1451-1466`).
- `FFIType` (`src/runtime/ffi/abi_type.rs:15-49`, `ffi.ts:1-63`) : char, i8, u8, i16, u16, i32, u32, i64, u64, f64, f32, bool, ptr, void, cstring, i64_fast, u64_fast, function, napi_env, napi_value, buffer, buffer_length. Ids numériques > 19 refusés (`abi_type.rs:169`) ; retours `napi_env`/`buffer`/`buffer_length` refusés (`ffi_body.rs:1925-1941`) ; types napi seulement dans `cc()` (`:2373-2380`).
- Pointeurs : `ptr()` sur ArrayBufferView non vide, adresses ≤ 2^56-1 (`src/runtime/ffi/FFIObject.rs:420-470`, `:731-735`) ; `read.*` non alignés (`:128-410`) ; `toArrayBuffer`/`toBuffer` zéro-copie avec désallocateur optionnel (`:590-713`) ; `CString` copie (`:48-58`) ; `ptr`/`read.*` = host functions `NoIntrinsic`, pas de DOMJIT (`src/jsc/bindings/ZigGeneratedCode.cpp:9-28`).
- `JSCallback` (`ffi.ts:87-111`) → `FFI::callback` (`ffi_body.rs:1303-1360`) → `JSC::FFI::createCallback` ; `threadsafe: true` : appel depuis un thread étranger posté par `ScriptExecutionContext::postTaskTo` (verrou d'une map globale puis VM handle) et exécuté par `runThreadsafeInvocation` (`JSCFFIBridge.cpp:99-156`, `src/jsc/bindings/ScriptExecutionContext.cpp:286-304`) ; valeur rendue au C non spécifiée en mode threadsafe (`ffi.mdx:344`) ; `close()` (`JSCFFIBridge.cpp:158-162`).
- Plates-formes : TinyCC désactivé seulement sur Android et FreeBSD (`scripts/build/config.ts:1190-1192`) donc actif sur Windows x64/arm64 ; build `--ffi=off` possible (`JSCFFIBridge.cpp:21-49`, `config.ts:244-249`). Windows : `DynLib::close` no-op, les DLL ne sont jamais déchargées (`src/sys/lib.rs:6141-6149`).
- Limites : pas de type struct ⇒ pas de struct par valeur (`abi_type.rs:15-49`) ; pas de varargs (options lues : `args`, `returns`, `threadsafe`, `ptr` — `ffi_body.rs:1844-1963`) ; signature non supportée ⇒ exception (`JSCFFIBridge.cpp:82-86`) ; i64/u64 en BigInt sauf `*_fast` (nombre si ≤ 52 bits, `FFI.h:371-393`) ; i64/u64 de callback en BigInt (`ffi.mdx:344`).
- Bancs (non exécutés) : `bench/ffi/bun.js:1-46` compare bun:ffi et napi-rs sur une cdylib Rust (`bench/ffi/src/src/lib.rs:1-50`) ; `bench/snippets/ffi-overhead.mjs:227-229` cible un `.dylib` macOS.

## 10. .NET dans Bun

Aucune trace de hostfxr, coreclr, nethost ou CLR (seules occurrences : « C# » dans `docs/runtime/ffi.mdx:11`, noms de paquets npm, MIME `application/clr`).

## 11. Risques pour un addon .NET NativeAOT

1. Sans `node_api_module_get_api_version_v1`, l'addon tourne en sémantique 8 (`BunProcess.cpp:798-802`) : pas de `napi_ref` sur primitives, pas de `napi_cannot_run_js`.
2. Finaliseurs toujours différés au thread JS hors mode expérimental (`napi.h:528-539`) : libération des `GCHandle` un tour de boucle plus tard.
3. Coût par appel : une cellule GC (portée) + un append verrouillé par argument objet (`napi_handle_scope.cpp:67-71`, `:136-141`).
4. TSFN : file illimitée par défaut et vidage sans plafond par tick (`napi_body.rs:2721-2791`) : une rafale de `Post` .NET peut monopoliser un tick.
5. Imports `node.exe` réécrits seulement pendant `process.dlopen` (`NodeExeImportsWindows.cpp:272-280`) : un addon qui résout Node-API par `GetModuleHandle(NULL)` + `GetProcAddress` (cas de node-api-dotnet) n'est pas concerné ; une `DllImport("node")` paresseuse le serait (inférence).
6. `napi_get_uv_event_loop` lié au thread appelant (`napi_body.rs:2412`).
