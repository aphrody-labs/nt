# .NET natif depuis bun, sans node-api-dotnet

Contexte : appeler du .NET 11 depuis bun sans la couche Node-API de node-api-dotnet. Ce document décrit le prototype livré, les mesures, puis les limites de bun relevées dans son source (fichier:ligne) avec les correctifs proposés pour le fork `aphrody-labs/bun`.

## Sources (relevées le 2026-11-12)

| Source | Révision |
|---|---|
| bun (fork aphrody-labs, amont oven-sh) | `4b8463ee11cb` (2026-11-12), bun 1.4.4 |
| JavaScriptCore FFI (oven-sh/WebKit, épinglé par bun `scripts/build/deps/webkit.ts:6`) | `6fc709c29840`, `Source/JavaScriptCore/ffi/` |
| dotnet/runtime | `release/11.0` @ `426561366bbf` (2026-11-11) : `src/native/corehost/hostfxr.h`, `coreclr_delegates.h`, `docs/design/features/native-hosting.md`, `ComponentActivator.cs` |
| Microsoft Learn | « Building native libraries », « Native code interop with Native AOT », « Disabled runtime marshalling », « NativeAOT uses lib prefix… (.NET 11) », « MSBuild reference : EnableDynamicLoading » |
| Mesures | locales et CI, `docs/research/bench/dotnet-ffi-*.json` (section 2) |

Point d'architecture établi dans le source : depuis cette version, `dlopen`, `CFunction` et `JSCallback` sont compilés par JavaScriptCore (`JSC::FFI`, invoke thunks JIT, intrinsèque DFG `FFIDFGCodegen.cpp:90-107`) ; TinyCC ne sert plus qu'à `cc()` (`src/runtime/ffi/ffi_body.rs:1019-1292`, `JSCFFIBridge.cpp:65-97`). Tout correctif de marshalling touche donc d'abord le fork WebKit, pas le dépôt bun.

## 1. Prototype livré

```
C# [UnmanagedCallersOnly(EntryPoint = "nt_x")]          sdk/dotnet/Nt.Interop
   ├─ dotnet publish -r <rid>  -> NativeAOT .dll/.so  ──> bun:ffi dlopen            (openNative)
   └─ dotnet build             -> IL + .runtimeconfig ──> hostfxr (bun:ffi) ──> CFunction  (openHosted)
IL .dll ──> sdk/tools/dotnet-ffi/gen.ts (ECMA-335 en TypeScript) ──> Nt.Interop.js + .d.ts + .model.json
```

- `sdk/tools/dotnet-ffi/ecma335.ts` : lecteur ECMA-335 pur TS (en-tête CLI = répertoire PE 14, flux `#~`, 45 tables, index codés, signatures §II.23.2, blobs d'attributs §II.23.3). Aucun .NET à la génération. Validé sur des assemblages réels : `System.Private.CoreLib` (47 791 méthodes, 30 719 attributs) lu en ~20 ms, 0 erreur de décodage d'attribut sur CoreLib R2R, CoreLib NativeAOT, `System.Runtime.InteropServices`, `System.Text.Json`.
- `model.ts` : méthodes `[UnmanagedCallersOnly]` (EntryPoint, CallConvs), types blittables, pointeurs de fonction (`delegate* unmanaged<…>` -> `JSCallback`), structures (disposition calculée depuis ClassLayout/FieldLayout, tampons `fixed` via `FixedBufferAttribute`), énumérations (table Constant). Rejets motivés (string, classes, génériques, structures par valeur).
- Marqueurs (attributs sans effet à l'exécution, `sdk/dotnet/Nt.Interop/Ffi.cs`) : `[Utf8] byte*` -> `cstring` (transcodage JSC), `[Utf16] char*` -> chaîne encodée côté JS, `[Utf8Buffer]`/`[Utf16Buffer]` + `int` capacité -> la liaison renvoie une `string` (réessai si la capacité initiale de 256 ne suffit pas).
- `gen.ts` : JS ESM n'important que `bun:ffi` (fonctions sans conversion exposées telles quelles : aucun enrobage JS sur le chemin chaud), `.d.ts` typé, vérification des exports dans la table PE du binaire NativeAOT.
- `hostfxr.ts` : `hostfxr_initialize_for_runtime_config` -> `hostfxr_get_runtime_delegate(hdt_load_assembly_and_get_function_pointer)` -> `load_assembly_and_get_function_pointer(…, UNMANAGEDCALLERSONLY_METHOD)` par `CFunction`, `char_t` UTF-16 (Windows) / UTF-8 (`coreclr_delegates.h:15-27`). Recherche de hostfxr par `DOTNET_ROOT` puis `dotnet` du PATH.
- `Nt.Interop` : faits réels (version Windows + UBR + DisplayVersion du registre, architecture, processeurs, mémoire, nom de machine, RID, lecteurs par rappel), `DisableRuntimeMarshalling`, aucune exception ne traverse la frontière.
- Tests (`native.test.ts`, `hosted.test.ts`, processus séparés) et banc (`bench.ts`) ; job CI `interop` (Windows + Linux). Recettes : `just interop`, `just test-interop`, `just bench-interop`.

Résultats : CI verte sur Windows et Linux (run 43280512366 : NativeAOT 6/6, CoreCLR hébergé 5/5, mêmes assertions contre `node:os`) et en local. Binaire NativeAOT win-x64 : 1 019 904 octets (sous le budget de 1 Mio du cahier des charges).

Constat .NET (SDK 11.0.100) : avec `PublishAot=true` inconditionnel, le `.runtimeconfig.json` du **build IL** reçoit les commutateurs AOT (`EnableConsumingManagedCodeFromNativeHosting=false`, `IsDynamicCodeSupported=false`) et hostfxr refuse le composant (`HostFeatureDisabled` 0x800080a7). Correctif : `PublishAot` conditionné à `RuntimeIdentifier` (`Nt.Interop.csproj`).

## 2. Mesures (ns par appel, médiane de 7 séries de 10⁶ appels)

Données brutes : `docs/research/bench/dotnet-ffi-*.json` (`just bench-interop`). Colonnes : L = local (i7-13700F, Windows 10.0.28120.3302 26H1) ; W = CI `windows-2025-vs2026` (Xeon Platinum 8573C) ; U = CI `ubuntu-latest` (EPYC 9V45). Tous : bun 1.4.4+38afee6c8, .NET 11.0.0, 2026-11-12. Les exécuteurs CI sont partagés : ordre de grandeur seulement.

| cas | L AOT | L CoreCLR | W AOT | W CoreCLR | U AOT | U CoreCLR |
|---|---:|---:|---:|---:|---:|---:|
| référence C sans appel système (L/W `kernel32!GetCurrentProcessId`, U `libc!abs`) | 2,2 | | 3,7 | | 1,7 | |
| référence JS `add` | 0,3 | | 0,6 | | 0,2 | |
| `noop()` | 3,3 | 5,1 | 4,9 | 7,1 | 6,6 | 5,5 |
| `add(i32, i32)` | 3,5 | 5,1 | 5,1 | 7,0 | 4,4 | 5,2 |
| retour i64 (BigInt) | 11,2 | 12,7 | 18,6 | 17,7 | 14,0 | 15,4 |
| entrée UTF-8 `cstring` (non ASCII) | 21,5 | 23,1 | 32,8 | 30,6 | 19,9 | 21,7 |
| entrée UTF-16 (`Buffer.from(…, "utf16le")`) | 51,3 | 51,1 | 72,8 | 72,6 | 49,4 | 49,5 |
| sortie UTF-16 `machineName()` (tampon + décodage + travail .NET) | 303,6 | 300,2 | 460,1 | 443,2 | 507,1 | 611,8 |
| rappel .NET -> JS (`JSCallback`, par rappel) | 59,1 | 59,1 | 87,4 | 87,5 | 62,5 | 68,3 |
| `systemInfo(struct*)` (registre Windows inclus) | 8 944 | 8 927 | 12 173 | 12 287 | 51 | 52 |
| ouverture, ms (dlopen / init CoreCLR + 14 pointeurs) | 2,63 | 29,13 | 3,91 | 39,94 | 0,55 | 26,08 |

Lecture : la transition bun -> .NET coûte 1 à 3 ns de plus qu'un appel C (stub de transition GC plus marqué sous CoreCLR) ; les coûts dominants sont côté bun : BigInt pour tout 64 bits (+8 à +14 ns), UTF-16 sans type natif (×2,3 à ×2,5 par rapport au `cstring` UTF-8), allocation et décodage des chaînes de sortie, rappels ~60-90 ns. `systemInfo` mesure surtout le travail .NET (lectures du registre sous Windows). Constat annexe : appeler une fonction bun:ffi avec un argument de trop fait passer `GetCurrentProcessId` de 2,2 à 8 ns (local) : l'intrinsèque DFG n'est pris qu'à arité exacte (`jsc:FFIDFG.cpp:63`) ; les enrobages générés respectent l'arité.

## 3. Limites de bun pour l'interop .NET et correctifs proposés

Notation : `bun:` = dépôt bun @ `4b8463ee11cb` ; `jsc:` = oven-sh/WebKit @ `6fc709c29840`, `Source/JavaScriptCore/ffi/`.

### L1. Aucun type agrégat : pas de structure par valeur

- `jsc:FFIType.h:40-63` : 22 étiquettes scalaires (entiers, flottants, `Pointer`, `CString`, `Function`, `JSValue`, `Buffer`, `BufferLength`) ; `bun:src/runtime/ffi/abi_type.rs:13-49` (miroir) ; `bun:src/js/bun/ffi.ts:1-63` (table `FFIType`).
- Conventions gérées : `jsc:FFICallingConvention.h:44-56` (`SysV64`, `AAPCS64`, `Win64`) sans classification d'agrégats.
- Effet .NET : `Guid`, `DateTime`, `Vector2`, `nint` enveloppés, `HRESULT`-struct, retours `(int, int)` impossibles ; `model.ts` les rejette, il faut passer par pointeur (fait pour `NtSystemInfo`).
- Correctif (WebKit) : `Type::Struct` + descripteur de disposition (taille, alignement, classes de champs) dans `FFISignature`, classification par convention dans `FFICallingConvention.cpp` (Win64 : 1/2/4/8 octets en registre sinon pointeur caché ; SysV : classes INTEGER/SSE par mot de 8 octets ; AAPCS64 : HFA/HVA), argument accepté depuis un objet `{ ptr }`/TypedArray, retour en `Uint8Array`. Côté bun : étiquette `"struct"` dans `abi_type.rs:56-101` et `ffi.ts:1-63`, champ `layout` dans la définition. Le générateur fournit déjà la disposition (`Struct.size/align/fields`).

### L2. Pas de chaîne UTF-16 (`char16_t`/`wchar_t`)

- Arguments : `jsc:FFIConversions.cpp:236-300` (`writeCStringSlot`) n'encode qu'en UTF-8 (cache UTF-8 par `StringImpl`, voie rapide ASCII 263-275) dans une arène par appel (`FFICallHost.cpp:57-65`) ; une chaîne JS passée à `ptr` est refusée (`FFIConversions.cpp:377-381`).
- Retours : `jsc:FFIConversions.cpp:482-487` + `75-78` (`strlen`, UTF-8 avec repli Latin-1).
- Effet .NET : `string`/`char*` .NET et `char_t` de hostfxr sous Windows sont UTF-16 ; il faut `Buffer.from(s + "\0", "utf16le")` à chaque appel (51 ns mesurés contre 21,5 ns en `cstring`) et un tampon + `TextDecoder` en sortie.
- Correctif (WebKit) : `Type::U16String` : argument = copie de `span16()` (ou élargissement de `span8()`) + NUL dans la même arène ; retour = recherche du NUL 16 bits puis `String(std::span<const char16_t>)`. Côté bun : étiquettes `"u16string"`/`"wstring"` (`abi_type.rs`, `ffi.ts`, `packages/bun-types/ffi.d.ts`). Variante sans copie : passer `impl->span16().data()` quand la chaîne est déjà 16 bits et suivie d'un NUL (rare) — non recommandé.

### L3. Entiers 64 bits : BigInt systématique

- `jsc:FFIConversions.cpp:461-465` : `i64`/`u64` -> `JSBigInt::createFrom` ; `i64_fast`/`u64_fast` (466-476) renvoient un `number` si |v| ≤ 2⁵³.
- Effet : +8 ns et une allocation par retour 64 bits (`long`, `ulong`, `TimeSpan.Ticks`, tailles).
- Correctif : aucun dans bun ; option du générateur `--i64 fast` à ajouter (choix par méthode via un marqueur `[Fast64]`).

### L4. Rappels et threads .NET

- Non `threadsafe` : `jsc:FFICallbackThunk.cpp:436-441` prend `JSLockHolder` sur le thread appelant : un rappel venant d'un thread du ThreadPool, d'un `Task` ou d'un finaliseur exécute du JS hors de la boucle d'événements ; si le thread JS attend ce thread dans un appel FFI synchrone, interblocage.
- `threadsafe: true` : `jsc:FFICallbackThunk.cpp:419-433` met l'appel en file (`bun:src/jsc/bindings/JSCFFIBridge.cpp:99-104`, `postTaskTo`) et force le retour à 0 (432) : pas de résultat synchrone ; les `cstring` sont recopiées (`JSFFICallback.cpp:144`).
- Durée de vie : `bun:src/runtime/ffi/ffi_body.rs:1334` (`// TODO: WeakRefHandle that automatically frees it?`) ; un `JSCallback` doit être fermé à la main, et un pointeur gardé par .NET après `close()` plante.
- Correctifs : (a) WebKit : mode `threadsafe: "blocking"` (file + attente sur condition, appel direct si déjà sur le thread JS, erreur si la boucle est arrêtée) ; (b) bun : fermeture automatique par `FinalizationRegistry` dans `src/js/bun/ffi.ts:87-111` + `ref()/unref()` pour la boucle ; (c) côté nt dès maintenant : rappels synchrones uniquement (le générateur crée et ferme le `JSCallback` autour de l'appel), événements .NET asynchrones via `threadsafe: true` sans valeur de retour.

### L5. Pas d'épinglage ni de durée de vie pour les tampons

- `jsc:FFIConversions.cpp:316-371` : un TypedArray/ArrayBuffer passé en `ptr`/`buffer` donne `view->vector()`/`impl()->data()` sans référence conservée ; `bun:src/runtime/ffi/FFIObject.rs:420-470` : `ptr()` renvoie un nombre nu.
- Effet .NET : sûr pour un appel synchrone (l'argument reste vivant pendant l'appel) ; dangereux dès que .NET garde le pointeur (I/O asynchrone, `Task`, file de travail) : le tampon peut être collecté, détaché (`transfer()`) ou redimensionné.
- Correctif (bun) : `Bun.FFI.pin(view) -> { ptr, release() }` (référence forte + refus de détacher/redimensionner tant qu'épinglé) dans `FFIObject.rs` et `FFIObject.bind.ts`. Sens inverse déjà disponible : mémoire .NET (`NativeMemory.Alloc`) exposée sans copie par `toArrayBuffer(ptr, off, len, ctx, deallocator)` (`FFIObject.rs:590-640`), le désallocateur étant un export .NET.

### L6. `napi_env`/`napi_value` refusés hors `cc()`

- `bun:src/runtime/ffi/ffi_body.rs:2373-2380` rejette `napi_env`/`napi_value` pour `dlopen`/`linkSymbols`/`CFunction`/`JSCallback`, alors que JSC gère `Type::JSValue` (`jsc:FFIType.h:60`, `FFIConversions.cpp:492-493`) ; seul `cc()` fabrique un `napi_env` (`ffi_body.rs:1237`, `2748`).
- Effet .NET : une fonction .NET ne peut ni recevoir ni renvoyer d'objet JS ; c'est précisément ce que node-api-dotnet obtient via Node-API.
- Correctif (bun, sans WebKit) : accepter `"jsvalue"` (= `napi_value`, étiquette 19) dans `dlopen`/`CFunction`/`JSCallback` en limitant le rejet à `napi_env`, plus `Bun.FFI.protect(value)/unprotect` pour les valeurs gardées par .NET ; puis `napi_env` par bibliothèque `dlopen` en réutilisant `make_napi_env_if_needed` : .NET appellerait alors directement les exports Node-API de bun.exe par pointeurs de fonction, sans node-api-dotnet.

### L7. Déchargement incompatible avec NativeAOT

- `lib.close()` -> `bun:src/runtime/ffi/ffi_body.rs:1362-1390` -> `bun:src/sys/lib.rs:6141-6150` : `dlclose` sous Unix, sans effet sous Windows. Learn : « Unloading Native AOT libraries (via dlclose or FreeLibrary) is not supported ».
- Correctif (bun) : option `dlopen(path, symbols, { unload: false })` (ou détection de l'export `DotNetRuntimeContractDescriptor`, présent dans le binaire NativeAOT .NET 11 de Nt.Interop) qui fait de `close()` une libération des seules fonctions JS. Le générateur n'expose pas `close()`.

### L8. Autres contraintes vérifiées

- 32 arguments au plus : `jsc:FFISignature.h:65`.
- Chemin rapide DFG à arité exacte seulement : `jsc:FFIDFG.cpp:63` (argument en trop : 2,2 -> 8 ns, section 2).
- JIT obligatoire, x64/arm64 seulement : `jsc:JSFFIFunction.cpp:104-108` ; bun:ffi indisponible si la fonctionnalité `Ffi` est retirée (`bun:src/trim/features/trim-features.def:62` `native-code`, `:128` `ffi`) : un exécutable `bun build --compile` de nt doit la garder.
- Pointeurs renvoyés : `null` pour 0, BigInt au-delà de 2⁵³ (`jsc:FFIConversions.cpp:66-73`) ; le `.d.ts` généré l'expose (`Pointer | bigint | null`).
- Booléens renvoyés : normalisés sur 8 bits (`jsc:FFIInvokeThunk.cpp:114-141`) : `bool` .NET (1 octet, marshalling désactivé) est sûr.
- Recherche des DLL : chemin absolu -> `LoadLibraryExW(LOAD_WITH_ALTERED_SEARCH_PATH)` (`bun:src/sys/lib.rs:6168-6200`) : dépendances natives d'une bibliothèque NativeAOT résolues à côté d'elle.
- Pas de WebGPU dans ce runtime : `bun:scripts/build/deps/webkit.ts:450` (`ENABLE_WEBGPU 0`) ; voir `feature-graph.md`.

### L9. Côté hôte CoreCLR (hostfxr)

- Un seul runtime par processus (`native-hosting.md:249`, `:271`) ; composant dépendant du framework obligatoire (`:284`) ; contexte de chargement isolé par chemin d'assemblage, mis en cache (`ComponentActivator.cs:24`, `284-292`).
- Surcharges ambiguës : `GetMethod(name, Static | Public | NonPublic)` (`ComponentActivator.cs:337-343`) ; le générateur marque `overloaded` et `bindPointers` les exclut.
- Commutateur `EnableConsumingManagedCodeFromNativeHosting` (`ComponentActivator.cs:33`) : voir le constat .NET de la section 1.

## 4. Plan de correctifs pour aphrody-labs/bun

| Ordre | Correctif | Dépôt | Taille | Gain .NET |
|---|---|---|---|---|
| 1 | L6 : `jsvalue` dans dlopen/CFunction/JSCallback + `protect/unprotect` | bun (`ffi_body.rs`, `abi_type.rs`, `ffi.ts`, `ffi.d.ts`) | petite | objets JS passés à .NET sans Node-API |
| 2 | L7 : `dlopen(…, { unload: false })` | bun (`ffi_body.rs`, `ffi.ts`) | petite | `close()` sûr avec NativeAOT |
| 3 | L5 : `Bun.FFI.pin()` | bun (`FFIObject.rs`, `FFIObject.bind.ts`) | moyenne | E/S asynchrones .NET sur tampons JS |
| 4 | L4b : fermeture auto des `JSCallback` | bun (`src/js/bun/ffi.ts`) | petite | fin des fuites/plantages de rappels |
| 5 | L2 : type `u16string` | WebKit (`FFIType.h`, `FFIConversions.cpp`) + bun | moyenne | chaînes .NET ×2,4 plus rapides en entrée |
| 6 | L4a : `threadsafe: "blocking"` | WebKit (`FFICallbackThunk.cpp`, `FFIContext`) + bun (`JSCFFIBridge.cpp`) | moyenne | rappels avec résultat depuis le ThreadPool |
| 7 | L1 : structures par valeur | WebKit (`FFISignature`, `FFICallingConvention`, thunks) + bun | grande | signatures .NET idiomatiques |
| 8 | L6b : `napi_env` pour `dlopen` | bun (`ffi_body.rs:2748`) | moyenne | Node-API de bun.exe appelé directement par .NET |

Les correctifs 5 à 7 exigent de construire WebKit : bun télécharge par défaut une archive précompilée d'oven-sh/WebKit (`scripts/build/deps/webkit.ts:93`) ; un clone local est pris en charge (`webkit.ts:761`, `vendor/WebKit` ou `BUN_WEBKIT_PATH`). Les correctifs 1 à 4 et 8 se limitent au dépôt bun.
