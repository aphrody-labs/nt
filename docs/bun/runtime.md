# API runtime bun 1.4.4

Introspection des modules intégrés, JSDoc depuis `vendor/bun/packages/bun-types`.

## `bun` (117)

| Symbole | Type | Description |
|---|---|---|
| `$` | class | Runs a shell command with the [Bun Shell](https://bun.com/docs/runtime/shell). |
| `Archive` | class | Glob pattern(s) to filter which entries are extracted. |
| `ArrayBufferSink` | class | Fast incremental writer that becomes an {@link ArrayBuffer} on end(). |
| `CSRF` | object | Offset any operation on the file starting at `begin` and ending at `end`. <br>membres : `generate` `verify` |
| `Cookie` | class | npm */ \| [pkg: string, registry: string, info: BunLockFilePackageInfo, integrity: string] /** symlink, folder, tarball */ \| [pkg: string, info: BunLockFilePac |
| `CookieMap` | class | Creates a cookie from a name, value, and optional attributes / constructor(name: string, value: string, options?: CookieInit); /** Creates a cookie by parsing a |
| `CryptoHasher` | class | This class only exists in types / abstract class CryptoHashInterface<T> { /** The number of bytes the hash produces / readonly byteLength: number; /** Update th |
| `FFI` | object |  <br>membres : `CString` `callback` `cfunction` `closeCallback` `dlopen` `linkSymbols` `ptr` `read` `toArrayBuffer` `toBuffer` `viewSource` |
| `FetchSession` | class | The proxy URL, as a string or a `URL`. |
| `FileSystemRouter` | class | The root directory containing the files to route / dir: string; style: "nextjs"; /** The base path to use when routing */ assetPrefix?: string; origin?: string; |
| `Glob` | class | The root directory to start matching from. |
| `Image` | class | Reject inputs whose `width × height` exceeds this many pixels. |
| `JSON5` | object | JSON5 related APIs <br>membres : `parse` `stringify` |
| `JSONC` | object | JSONC related APIs <br>membres : `parse` |
| `JSONL` | object | JSONL (JSON Lines) related APIs. <br>membres : `parse` `parseChunk` |
| `MD4` | class |  |
| `MD5` | class |  |
| `ModuleGraph` | class | Values for free identifiers in all of the graph's module code (e.g. |
| `RedisClient` | class |  |
| `S3Client` | class | The size of the file in bytes. |
| `SHA1` | class | This is not the default because it's not cryptographically secure and it's slower than {@link SHA512} Consider {@link SHA512_256} instead |
| `SHA224` | class |  |
| `SHA256` | class |  |
| `SHA384` | class |  |
| `SHA512` | class |  |
| `SHA512_256` | class | The number of bytes the hash produces / static readonly byteLength: 20; } class MD5 extends CryptoHashInterface<MD5> { constructor(); /** The number of bytes th |
| `SQL` | class | Executes a SQL query using template literals ```ts const [user] = await sql<Users[]>`select * from users where id = ${1}`; ``` / <T = any>(strings: TemplateStri |
| `TOML` | object | The string to wrap / input: string, /** The maximum column width / columns: number, /** Wrapping options / options?: WrapAnsiOptions, ): string; /** TOML relate <br>membres : `parse` `stringify` |
| `Terminal` | class | Number of columns for the terminal. |
| `Transpiler` | class | "preserve" is not supported yet */ jsx?: "preserve" \| "react" \| "react-jsx" \| "react-jsxdev"; jsxFactory?: string; jsxFragmentFactory?: string; jsxImportSour |
| `WebView` | class | Viewport width in pixels. |
| `XML` | object | XML related APIs <br>membres : `parse` `stringify` |
| `YAML` | object | YAML related APIs <br>membres : `parse` `stringify` |
| `allocUnsafe` | function | Allocate a new [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) without zeroing the bytes. |
| `argv` | object | The raw arguments passed to the process, including flags passed to Bun. <br>membres : `0` `1` `2` `3` `length` |
| `build` | function | Input source files, keyed by path */ inputs: { [path: string]: { /** Size of the input file in bytes */ bytes: number; /** List of imports from this file */ imp |
| `color` | function | Converts a color to a different format |
| `concatArrayBuffers` | function | Concatenate an array of typed arrays into a single `ArrayBuffer`. |
| `connect` | function | Writes `data` to the socket. |
| `cron` | function | IANA time-zone name to interpret the schedule in (e.g. |
| `cwd` | string | Change the default working directory for shells created by this instance. |
| `deepEquals` | function | Fast deep-equality check two objects. |
| `deepMatch` | function | @default false */ strict?: boolean, ): boolean; /** Returns true if all properties in the subset exist in the other and have equal values. |
| `deflateSync` | function | The compression level to use. |
| `dns` | object | Preallocate an internal buffer of this size. <br>membres : `ADDRCONFIG` `ALL` `V4MAPPED` `getCacheStats` `getServers` `lookup` `lookupService` `prefetch` `resolve` `resolveAny` `resolveCaa` `resolveCname` `resolveMx` `resolveNaptr` `resolveNs` `resolvePtr` `resolveSoa` `resolveSrv` `resolveTxt` `reverse` |
| `embeddedFiles` | object | A list of files embedded into the standalone executable, lexicographically sorted by name. <br>membres : `length` |
| `enableANSIColors` | boolean | Whether ANSI colors are enabled for stdin and stdout Used for {@link console.log} |
| `env` | object | An identifying name for the worker's `DedicatedWorkerGlobalScope`, mainly useful for debugging. <br>membres : `ACSetupSvcPort` `ACSvcPort` `ADB_BURST_MODE` `ADB_MDNS_OPENSCREEN` `AGY_USE_POWERSHELL_TOOL` `AI_AGENT` `ALLUSERSPROFILE` `ANDROID_HOME` `ANDROID_NDK_HOME` `ANDROID_NDK_ROOT` `ANDROID_SDK_ROOT` `ANTHROPIC_API_KEY` `ANTHROPIC_CUSTOM_HEADERS` `ANTHROPIC_SERVICE_ACCOUNT_ID` `ANTHROPIC_WORKSPACE_ID` `ANTIGRAVITY_MIC` `APPDATA` `BASH_MAX_OUTPUT_LENGTH` `BUN_INSTALL` `BUN_INSTALL_CACHE_DIR` |
| `escapeHTML` | function | Escape the following characters in a string: - `"` becomes `"&quot;"` - `&` becomes `"&amp;"` - `'` becomes `"&#x27;"` - `<` becomes `"&lt;"` - `>` becomes `"&g |
| `fetch` | function | Override the default TLS options / tls?: BunFetchRequestInitTLS; /** Log the raw HTTP request and response to stdout, as a debugging aid. |
| `file` | function | Passphrase for the TLS key / passphrase?: string; /** File path to a `.pem` file containing custom Diffie-Hellman parameters / dhParamsFile?: string; /** Explic |
| `fileURLToPath` | function | Convert a {@link URL} to a filesystem path. |
| `gc` | function | Manually trigger the garbage collector This does two things: 1. |
| `generateHeapSnapshot` | function | Generates a heap snapshot in JavaScriptCore's format. |
| `gunzipSync` | function | Decompresses a chunk of data with the `zlib` GUNZIP algorithm. |
| `gzipSync` | function | Compresses a chunk of data with the `zlib` GZIP algorithm. |
| `hash` | function | Hash a string or array buffer using Wyhash This is not a cryptographic hash function. |
| `indexOfLine` | function | Find the index of a newline character in potentially ill-formed UTF-8 text. |
| `inflateSync` | function | Decompresses a chunk of data with the `zlib` INFLATE algorithm. |
| `inspect` | function | The URL of the WebSocket connection / readonly url: string; /** Legacy URL property (same as url) / readonly URL: string; /** The current state of the connectio |
| `isMainThread` | boolean | Deactivate all plugins This prevents registered plugins from being applied to future builds. |
| `isStandaloneExecutable` | boolean | `true` when the current process is a standalone executable produced by `bun build --compile`, `false` otherwise. |
| `jest` | function |  |
| `listen` | function | Create a TCP server that listens on a port |
| `main` | string | Absolute path of the script that launched Bun |
| `markdown` | object | Markdown related APIs. <br>membres : `ansi` `html` `react` `render` |
| `mmap` | function | Sets MAP_SYNC flag on Linux. |
| `nanoseconds` | function | 2 */ version: number; /** "Inspector" */ type: string; nodes: number[]; nodeClassNames: string[]; edges: number[]; edgeTypes: string[]; edgeNames: string[]; } / |
| `openInEditor` | function | Open a file in your local editor. |
| `origin` | string |  |
| `password` | object | Memory usage, in kibibytes. <br>membres : `hash` `hashSync` `verify` `verifySync` |
| `pathToFileURL` | function | Convert a filesystem path to a file:// URL. |
| `peek` | function | Extract the value from the Promise in the same tick of the event loop |
| `plugin` | function |  |
| `postgres` | function | SQL client for PostgreSQL |
| `randomUUIDv5` | function | / timestamp?: number \| Date, ): Buffer; /** Generate a UUIDv5, a name-based UUID derived from the SHA-1 hash of a namespace UUID and a name. |
| `randomUUIDv7` | function | Create an `Archive` instance from input data. |
| `readableStreamToArray` | function | Consume all data from a {@link ReadableStream} until it closes or errors. |
| `readableStreamToArrayBuffer` | function | Consume all data from a {@link ReadableStream} until it closes or errors, concatenating the chunks into a single {@link ArrayBuffer}. |
| `readableStreamToBlob` | function | Consumes all data from a {@link ReadableStream} until it closes or errors. |
| `readableStreamToBytes` | function | Consumes all data from a {@link ReadableStream} until it closes or errors. |
| `readableStreamToFormData` | function | Consume all data from a {@link ReadableStream} until it closes or errors. |
| `readableStreamToJSON` | function | Consumes all data from a {@link ReadableStream} until it closes or errors. |
| `readableStreamToText` | function | Consumes all data from a {@link ReadableStream} until it closes or errors. |
| `redis` | object | Connection timeout in milliseconds / connectionTimeout?: number; /** Idle timeout in milliseconds. |
| `registerMacro` | function |  |
| `resolve` | function | Resolve a `moduleId` as though it were imported from `parent` On failure, throws a `ResolveMessage` Use {@link resolveSync} instead. |
| `resolveSync` | function | Synchronously resolve a `moduleId` as though it were imported from `parent` On failure, throws a `ResolveMessage` |
| `revision` | string | The git sha at the time the currently-running version of Bun was compiled "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2" |
| `s3` | object | Create a new instance of an S3 bucket so that credentials can be managed from a single instance instead of being passed to every method. |
| `secrets` | object | Verify a password against a previously hashed password. <br>membres : `delete` `get` `set` |
| `semver` | object | The graph whose context the calling code is running in (what it opens now would belong to that graph), or `undefined` in the host's context. <br>membres : `order` `satisfies` |
| `serve` | function | Stop listening to prevent new connections from being accepted. |
| `sha` | function | Hash `input` using [SHA-2 512/256](https://en.wikipedia.org/wiki/SHA-2#Comparison_of_SHA_functions) This hashing function balances speed with cryptographic stre |
| `shrink` | function | The next time JavaScriptCore is idle, clear unused memory and attempt to reduce the heap size. |
| `sleep` | function | The algorithm chosen to hash the data / readonly algorithm: SupportedCryptoAlgorithms; /** The length of the output hash in bytes / readonly byteLength: number; |
| `sleepSync` | function | Block the thread for a given number of milliseconds. |
| `sliceAnsi` | function | If set, and content was cut at either edge of the requested range, insert this string at the cut edge(s). |
| `spawn` | function | Resource usage of the process, such as max RSS and CPU time / resourceUsage: ResourceUsage; signalCode?: NodeJS.Signals \| number; exitedDueToTimeout?: boolean; |
| `spawnSync` | function | The command to run The first argument is resolved to an absolute executable path. |
| `sql` | function | Creates a new SQL client instance ```ts const sql = new SQL("postgres://localhost:5432/mydb"); const sql = new SQL(new URL("postgres://localhost:5432/mydb")); ` |
| `stderr` | object | Write to stderr |
| `stdin` | object | Read from stdin This is a read-only BunFile |
| `stdout` | object | Write to stdout |
| `stringWidth` | function | If `true`, count ANSI escape codes as part of the string width. |
| `stripANSI` | function | The string to measure / input: string, options?: StringWidthOptions, ): number; /** Remove ANSI escape codes from a string. |
| `udpSocket` | function | `true` if the datagram was larger than the receive buffer and was truncated by the kernel (MSG_TRUNC). |
| `unsafe` | object |  <br>membres : `arrayBufferToString` `gcAggressionLevel` `memoryFootprint` `mimallocDump` `setJITPolicy` |
| `version` | string | Create a new {@link FileSystemRouter}. |
| `version_with_sha` | string | The current version of Bun with the shortened commit sha of the build |
| `which` | function | Overrides the `PATH` environment variable / PATH?: string; /** When `command` is a relative path, resolve it against this directory. |
| `wrapAnsi` | function | Shorthand for common options (avoids `{}` allocation): - `string` → ellipsis (equivalent to `{ ellipsis: string }`) - `boolean` → ambiguousIsNarrow (equivalent  |
| `write` | function | Use the fastest syscalls available to copy from `input` into `destination`. |
| `zstdCompress` | function | Compresses a chunk of data with the Zstandard (zstd) compression algorithm. |
| `zstdCompressSync` | function | Compresses a chunk of data with the Zstandard (zstd) compression algorithm. |
| `zstdDecompress` | function | Decompresses a chunk of data with the Zstandard (zstd) decompression algorithm. |
| `zstdDecompressSync` | function | Decompresses a chunk of data with the Zstandard (zstd) decompression algorithm. |

## `bun:sqlite` (4)

| Symbole | Type | Description |
|---|---|---|
| `Database` | class | Open the database as read-only (no write operations, no create). |
| `SQLiteError` | class | An error from SQLite. |
| `Statement` | class | Open or create a SQLite3 database / constructor(filename?: string, options?: number \| DatabaseOptions); /** Open or create a SQLite3 database This is an alias  |
| `constants` | object | Creates a new prepared statement from native code. <br>membres : `SQLITE_DESERIALIZE_READONLY` `SQLITE_FCNTL_BEGIN_ATOMIC_WRITE` `SQLITE_FCNTL_BUSYHANDLER` `SQLITE_FCNTL_CHUNK_SIZE` `SQLITE_FCNTL_CKPT_DONE` `SQLITE_FCNTL_CKPT_START` `SQLITE_FCNTL_CKSM_FILE` `SQLITE_FCNTL_COMMIT_ATOMIC_WRITE` `SQLITE_FCNTL_COMMIT_PHASETWO` `SQLITE_FCNTL_DATA_VERSION` `SQLITE_FCNTL_EXTERNAL_READER` `SQLITE_FCNTL_FILE_POINTER` `SQLITE_FCNTL_GET_LOCKPROXYFILE` `SQLITE_FCNTL_HAS_MOVED` `SQLITE_FCNTL_JOURNAL_POINTER` `SQLITE_FCNTL_LAST_ERRNO` `SQLITE_FCNTL_LOCKSTATE` `SQLITE_FCNTL_LOCK_TIMEOUT` `SQLITE_FCNTL_MMAP_SIZE` `SQLITE_FCNTL_OVERWRITE` |

## `bun:ffi` (14)

| Symbole | Type | Description |
|---|---|---|
| `CFunction` | class | File path to an ISO C11 source file to compile and link / source: string \| import("bun").BunFile \| URL; /** Library names to link against Equivalent to `-l` o |
| `CString` | class | A JavaScript string decoded from a UTF-8 encoded C string. |
| `FFIType` | object |  <br>membres : `0` `1` `10` `11` `12` `13` `14` `15` `16` `17` `2` `3` `4` `5` `6` `7` `8` `9` `bool` `buffer` |
| `JSCallback` | class | Pass a JavaScript function to FFI (Foreign Function Interface) |
| `cc` | function | **Experimental:** Compile ISO C11 source code using TinyCC, and make {@link symbols} available as functions to JavaScript. |
| `dlopen` | function | `bun:ffi` calls C functions from JavaScript without requiring you to write bindings. |
| `linkSymbols` | function | Free the memory allocated by the wrapping function / close(): void; }; /** Link a map of symbols to JavaScript functions Use this for native libraries that are  |
| `native` | object |  <br>membres : `callback` `dlopen` |
| `ptr` | function | Read a pointer at `ptr + byteOffset` Behaves like `DataView`, but is usually faster because it doesn't create a `DataView` or `ArrayBuffer`. |
| `read` | object | Read a value directly from a memory address, without creating a `DataView` or `ArrayBuffer` <br>membres : `f32` `f64` `i16` `i32` `i64` `i8` `intptr` `ptr` `u16` `u32` `u64` `u8` |
| `suffix` | string | Platform-specific file extension for dynamic libraries, without the leading "." ```js "dylib" // macOS ``` ```js "so" // linux ``` |
| `toArrayBuffer` | function | Read a pointer as an {@link ArrayBuffer} If `byteLength` is not provided, the pointer is assumed to be 0-terminated. |
| `toBuffer` | function | Read a pointer as a {@link Buffer} If `byteLength` is not provided, the pointer is assumed to be 0-terminated. |
| `viewSource` | function | Wrap a JavaScript function so it can be passed to C with `bun:ffi` / constructor(callback: (...args: any[]) => any, definition: FFIFunction); /** The pointer to |

## `bun:test` (19)

| Symbole | Type | Description |
|---|---|---|
| `afterAll` | function | Runs a function, once, after all the tests. |
| `afterEach` | function | Runs a function after each test. |
| `beforeAll` | function | Runs a function, once, before all the tests. |
| `beforeEach` | function | Runs a function before each test. |
| `describe` | function | Skips all other tests, except this group of tests. |
| `expect` | class | Asserts that a value matches some criteria. |
| `expectTypeOf` | class |  |
| `it` | function |  |
| `jest` | object |  <br>membres : `advanceTimersByTime` `advanceTimersToNextTimer` `clearAllMocks` `clearAllTimers` `fn` `getTimerCount` `isFakeTimers` `mock` `now` `resetAllMocks` `restoreAllMocks` `runAllTimers` `runOnlyPendingTimers` `setSystemTime` `setTimeout` `spyOn` `useFakeTimers` `useRealTimers` |
| `mock` | function | Replace the module `id` with the return value of `factory`. |
| `onTestFinished` | function | Runs a function after the test finishes, once all `afterEach` hooks have completed. |
| `setDefaultTimeout` | function | Sets the default timeout for all tests in the current file. |
| `setSystemTime` | function | Keep each exported function's real implementation and record its calls. |
| `spyOn` | function | Create a spy on a property's getter. |
| `test` | function | Each row is spread over the callback's parameters, so the callback doesn't receive the context. |
| `vi` | object | Vitest-compatible mocking utilities, for migrating tests from Vitest to Bun. <br>membres : `advanceTimersByTime` `advanceTimersToNextTimer` `clearAllMocks` `clearAllTimers` `fn` `getTimerCount` `isFakeTimers` `mock` `resetAllMocks` `restoreAllMocks` `runAllTimers` `runOnlyPendingTimers` `spyOn` `useFakeTimers` `useRealTimers` |
| `xdescribe` | function | Skips a group of related tests. |
| `xit` | function |  |
| `xtest` | function | Skips a test. |

## `bun:jsc` (37)

| Symbole | Type | Description |
|---|---|---|
| `bytecodeOrderStats` | function | For an executable built with `bun build --compile --bytecode --bytecode-order`: how many functions this thread has loaded from each part of the bytecode the ord |
| `callerSourceOrigin` | function | Returns the URL of the source file containing the code that called this function, such as `"file:///home/me/app/index.ts"`. |
| `codeCoverageForFile` | function |  |
| `describe` | function | Skips all other tests, except this group of tests. |
| `describeArray` | function |  |
| `deserialize` | function | Converts an ArrayBuffer or Buffer to a JavaScript value compatible with the HTML Structured Clone Algorithm. |
| `drainMicrotasks` | function | Runs every pending microtask right now: promise reactions, `queueMicrotask()` callbacks, and `process.nextTick()` callbacks. |
| `edenGC` | function | Runs an eden (young generation) garbage collection synchronously. |
| `estimateShallowMemoryUsageOf` | function | Non-recursively estimates the memory usage of an object, excluding the memory usage of properties or other objects it references. |
| `fullGC` | function | Runs a full garbage collection synchronously: every object in the heap is visited, and everything unreachable becomes garbage. |
| `gcAndSweep` | function | Runs a full garbage collection and then sweeps the heap, all synchronously, so the memory of every unreachable object has been freed by the time this returns. |
| `generateHeapSnapshotForDebugging` | function |  |
| `getProtectedObjects` | function | Returns objects that native code has explicitly protected from being garbage collected. |
| `getRandomSeed` | function | Returns the seed of the pseudo-random number generator behind `Math.random()`. |
| `heapSize` | function | Returns the size of the JavaScript heap in bytes: the objects that survived the most recent garbage collection, plus the memory they own outside the heap (strin |
| `heapStats` | function | Returns statistics about the JavaScript heap, including a count of the live objects of each type. |
| `isRope` | function | Returns whether a string is currently stored as a "rope". |
| `jscDescribe` | function | Low-level access to JavaScriptCore, the engine Bun runs JavaScript on: garbage collection, heap and memory statistics, JIT controls, a sampling profiler, and st |
| `jscDescribeArray` | function | Describes the storage behind an object's indexed elements: the address of its "butterfly" (the out-of-line buffer JavaScriptCore keeps elements in), the public  |
| `memoryUsage` | function | Returns memory statistics for the whole Bun process: resident set size, committed memory, and page faults. |
| `noFTL` | function | Prevents a function from ever being compiled by the FTL JIT, JavaScriptCore's highest optimization tier. |
| `noInline` | function |  |
| `noOSRExitFuzzing` | function | Excludes a function from OSR exit fuzzing. |
| `numberOfDFGCompiles` | function | Returns how many times a function has been optimized: `1` if the function currently has DFG- or FTL-compiled code, plus one for each time its optimized code has |
| `optimizeNextInvocation` | function | Makes JavaScriptCore start optimizing a function (compiling it with the DFG JIT) the next time it is called, instead of waiting for the function to become hot o |
| `percentAvailableMemoryInUse` | function |  |
| `profile` | function | A formatted summary of the functions that were most often at the top of the stack when a sample was taken (that is, ranked by self time). |
| `releaseWeakRefs` | function | Releases the targets of `WeakRef`s so that a garbage collection can collect them immediately. |
| `reoptimizationRetryCount` | function | Returns how many times JavaScriptCore has thrown away a function's optimized code because the assumptions it was compiled with turned out to be wrong (for examp |
| `samplingProfilerStackTraces` | function |  |
| `serialize` | function | Serializes a JavaScript value into a binary representation that can be sent to another Bun instance. |
| `setRandomSeed` | function | Reseeds the pseudo-random number generator behind `Math.random()`, making the values it returns reproducible: after setting the same seed, `Math.random()` retur |
| `setTimeZone` | function | Sets the time zone used by `Intl`, `Date`, and other date and time APIs. |
| `setTimezone` | function |  |
| `startRemoteDebugger` | function | Starts a remote debugging socket server on the given port. |
| `startSamplingProfiler` | function | Starts JavaScriptCore's sampling profiler and leaves it running for the rest of the process. |
| `totalCompileTime` | function | Returns the total time in milliseconds this process has spent JIT-compiling JavaScript, across the baseline, DFG, and FTL tiers. |

## `bun:wrap` (1)

| Symbole | Type | Description |
|---|---|---|
| `$$typeof` | symbol |  |
