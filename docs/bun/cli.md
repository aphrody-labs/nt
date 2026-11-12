# CLI bun 1.4.4

## `bun run`

./my-script.ts       Execute a file with Bun

| Option | Description |
|---|---|
| `--silent` | Don't print the script command |
| `--elide-lines` | Number of lines of script output shown when using --filter (default: 0, show all lines) |
| `-F` `--filter` | Run a script in all workspace packages matching the pattern |
| `-b` `--bun` | Force a script or package to use Bun's runtime instead of Node.js (via symlinking node) |
| `--no-orphans` | Exit when the parent process dies, and on exit kill every descendant. |
| `--shell` | Control the shell used for package.json scripts. Supports either 'bun' or 'system' |
| `--workspaces` | Run a script in all workspace packages (from the "workspaces" field in package.json) |
| `--parallel` | Run multiple scripts concurrently with Foreman-style output |
| `--sequential` | Run multiple scripts sequentially with Foreman-style output |
| `--no-exit-on-error` | Continue running other scripts when one fails (with --parallel/--sequential) |
| `--watch` | Automatically restart the process on file change |
| `--watch-kill-signal` | Signal whose handlers run when --watch restarts the process (default: "SIGTERM") |
| `--hot` | Enable auto reload in the Bun runtime, test runner, or bundler |
| `--no-clear-screen` | Disable clearing the terminal screen on reload when --hot or --watch is enabled |
| `--check` | Type check before running. Nothing runs if there are type errors. Alone: bun check |
| `--smol` | Use less memory, but run garbage collection more often |
| `--interactive` | Start a Node.js-compatible REPL, like node --interactive |
| `-r` `--preload` | Import a module before other modules are loaded |
| `--require` | Alias of --preload, for Node.js compatibility |
| `--import` | Alias of --preload, for Node.js compatibility |
| `--inspect` | Activate Bun's debugger |
| `--inspect-wait` | Activate Bun's debugger, wait for a connection before executing |
| `--inspect-brk` | Activate Bun's debugger, set breakpoint on first line of code and wait |
| `--cpu-prof` | Start CPU profiler and write profile to disk on exit |
| `--cpu-prof-name` | Specify the name of the CPU profile file |
| `--cpu-prof-dir` | Specify the directory where the CPU profile will be saved |
| `--cpu-prof-md` | Output CPU profile in markdown format (grep-friendly, designed for LLM analysis) |
| `--cpu-prof-interval` | Specify the sampling interval in microseconds for CPU profiling (default: 1000) |
| `--heap-prof` | Write a heap profile to disk on exit (.heapprofile) |
| `--heap-prof-name` | Specify the name of the heap profile file |
| `--heap-prof-dir` | Specify the directory where the heap profile will be saved |
| `--heap-prof-md` | Generate markdown heap profile on exit (for CLI analysis) |
| `--heap-prof-interval` | Specify the average sampling interval in bytes for heap profiling (default: 524288) |
| `--if-present` | Exit without an error if the entrypoint does not exist |
| `--no-install` | Disable auto install in the Bun runtime |
| `--install` | Configure auto-install behavior. One of "auto" (default, auto-installs when no node_modules), "fallback" (missing packages only), "force" (always). |
| `-e` `--eval` | Evaluate argument as a script |
| `-p` `--print` | Evaluate argument as a script and print the result |
| `--prefer-offline` | Skip staleness checks for packages in the Bun runtime and resolve from disk |
| `--prefer-latest` | Use the latest matching versions of packages in the Bun runtime, always checking npm |
| `--port` | Set the default port for Bun.serve |
| `--conditions` | Pass custom conditions to resolve |
| `--fetch-preconnect` | Preconnect to a URL while code is loading |
| `--experimental-http2-fetch` | Offer h2 in fetch() TLS ALPN. Same as BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP2_CLIENT=1 |
| `--experimental-http3-fetch` | Honor Alt-Svc: h3 in fetch() and upgrade to HTTP/3. Same as BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP3_CLIENT=1 |
| `--max-http-header-size` | Set the maximum size of HTTP headers in bytes. Default is 16KiB |
| `--insecure-http-parser` | Use an insecure HTTP parser that accepts invalid HTTP headers |
| `--dns-result-order` | Set the default order of DNS lookup results. Valid orders: verbatim (default), ipv4first, ipv6first |
| `--experimental-stream-iter` | Enable the experimental stream/iter API (node:stream/iter, node:zlib/iter). |
| `--expose-gc` | Expose gc() on the global object. Has no effect on Bun.gc(). |
| `--no-deprecation` | Suppress all reporting of the custom deprecation. |
| `--throw-deprecation` | Determine whether or not deprecation warnings result in errors. |
| `--no-warnings` | Silence all process warnings |
| `--trace-warnings` | Show stack traces on process warnings |
| `--trace-deprecation` | Show stack traces on deprecations |
| `--pending-deprecation` | Emit pending deprecation warnings |
| `--redirect-warnings` | Write process warnings to the given file instead of printing to stderr |
| `--disable-warning` | Silence specific process warnings by code or type |
| `--title` | Set the process title |
| `--zero-fill-buffers` | Boolean to force Buffer.allocUnsafe(size) to be zero-filled. |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `--redis-preconnect` | Preconnect to $REDIS_URL at startup |
| `--sql-preconnect` | Preconnect to PostgreSQL at startup |
| `--no-addons` | Throw an error if process.dlopen or bun:ffi cc() is called, and disable export condition "node-addons" |
| `--no-ffi-cc` | Throw an error if bun:ffi cc() is called (disables the C compiler) |
| `--unhandled-rejections` | One of "strict", "throw", "warn", "none", or "warn-with-error-code" |
| `--console-depth` | Set the default depth for console.log object inspection (default: 2) |
| `--user-agent` | Set the default User-Agent header for HTTP requests |
| `--cron-title` | Title for cron execution mode |
| `--cron-period` | Cron period for cron execution mode |
| `--main-fields` | Main fields to lookup in package.json. Defaults to --target dependent |
| `--preserve-symlinks` | Preserve symlinks when resolving files |
| `--preserve-symlinks-main` | Preserve symlinks when resolving the main entry point |
| `--extension-order` | Defaults to: .tsx,.ts,.jsx,.js,.json |
| `--tsconfig-override` | Specify custom tsconfig.json. Default $cwd/tsconfig.json |
| `-d` `--define` | Substitute K:V while parsing, e.g. --define process.env.NODE_ENV:"development". Values are parsed as JSON. |
| `--drop` | Remove function calls, e.g. --drop=console removes all console.* calls. |
| `--feature` | Enable a feature flag for dead-code elimination, e.g. --feature=SUPER_SECRET |
| `-l` `--loader` | Parse files with .ext:loader, e.g. --loader .js:jsx. Valid loaders: js, jsx, ts, tsx, json, toml, text, file, wasm, napi |
| `--no-macros` | Disable macros from being executed in the bundler, transpiler and runtime |
| `--jsx-factory` | Changes the function called when compiling JSX elements using the classic JSX runtime |
| `--jsx-fragment` | Changes the function called when compiling JSX fragments |
| `--jsx-import-source` | Declares the module specifier to be used for importing the jsx and jsxs factory functions. Default: "react" |
| `--jsx-runtime` | "automatic" (default) or "classic" |
| `--jsx-side-effects` | Treat JSX elements as having side effects (disable pure annotations) |
| `--ignore-dce-annotations` | Ignore tree-shaking annotations such as @__PURE__ |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--cwd` | Absolute path to resolve files & entry points from. This just changes the process' cwd. |
| `-c` `--config` | Specify path to Bun config file. Default $cwd/bunfig.toml |
| `-h` `--help` | Display this menu and exit |

## `bun test`

Run unit tests with Bun

| Option | Description |
|---|---|
| `--no-orphans` | Exit when the parent process dies, and on exit kill every descendant. |
| `--timeout` | Set the per-test timeout in milliseconds, default is 5000. |
| `-u` `--update-snapshots` | Update snapshot files |
| `--rerun-each` | Re-run each test file <NUMBER> times, helps catch certain bugs |
| `--retry` | Default retry count for all tests, overridden by per-test { retry: N } |
| `--todo` | Include tests that are marked with "test.todo()" |
| `--only` | Run only tests that are marked with "test.only()" or "describe.only()" |
| `--pass-with-no-tests` | Exit with code 0 when no tests are found |
| `--concurrent` | Treat all tests as `test.concurrent()` tests |
| `--randomize` | Run tests in random order |
| `--seed` | Set the random seed for test randomization |
| `--coverage` | Generate a coverage profile |
| `--coverage-reporter` | Report coverage in 'text' and/or 'lcov'. Defaults to 'text'. Implies --coverage. |
| `--coverage-dir` | Directory for coverage files. Defaults to 'coverage'. |
| `--bail` | Exit the test suite after <NUMBER> failures. If you do not specify a number, it defaults to 1. |
| `-t` `--test-name-pattern` | Run only tests with a name that matches the given regex. |
| `--reporter` | Test output reporter format. Available: 'junit' (requires --reporter-outfile), 'dots'. Default: console output. |
| `--reporter-outfile` | Output file path for the reporter format (required with --reporter). |
| `--dots` | Enable dots reporter. Shorthand for --reporter=dots. |
| `--only-failures` | Only display test failures, hiding passing tests. |
| `--max-concurrency` | Maximum number of concurrent tests to execute at once. Default is 20. |
| `--path-ignore-patterns` | Glob patterns for test file paths to ignore. |
| `--changed` | Only run test files affected by changed files according to git. Optionally pass a commit or branch to compare against. |
| `--isolate` | Run each test file in a fresh global object. Leaked handles from one file cannot affect another. |
| `--no-isolate` | With --parallel: let each worker keep one global and module registry across the files it runs (faster; files can see each other's leftovers). |
| `--parallel` | Run test files in parallel using N worker processes. Implies --isolate. Defaults to CPU core count. |
| `--parallel-delay` | Milliseconds the first --parallel worker must be busy before spawning the rest. 0 spawns all immediately. Default 5. |
| `--test-worker` | (internal) Run as a --parallel worker, receiving files over IPC. |
| `--shard` | Run a subset of test files, e.g. '--shard=1/3' runs the first of three shards. Useful for splitting tests across multiple CI jobs. |
| `--timings` | JSON file(s) of per-file durations (ms); several are merged, e.g. one per CI shard. Balances --shard by total time and makes --parallel start the slowest files  |
| `--update-timings` | After the run, write measured per-file durations to the first --timings file (only this shard's files under --shard; merged with what was read otherwise). |

## `bun check`

Type check a TypeScript project

| Option | Description |
|---|---|
| `-p` `--project` | Path to a tsconfig.json or its directory |
| `--pretty` | Show source code around each error (default in a terminal) |
| `-b` `--build` | Check the projects in references too, like tsc -b |
| `--no-pretty` | One line per error, like tsc --pretty false (default when piped) |
| `--all` | Show every error (above 50, identical errors are grouped) |
| `--threads` | Number of threads (default: one per CPU core) |
| `--timing` | Print load and check times |
| `--cwd` | Set the working directory |
| `--no-script` | Run the type checker even if the project has a check script |
| `-h` `--help` | Print this help menu |

## `bun fmt`

Format JavaScript and TypeScript, like Prettier

| Option | Description |
|---|---|
| `-c` `--check` | Do not write. Exit with 1 if a file needs formatting |
| `--staged` | Only format files that are staged in git, and stage them again |
| `--changed` | Only format files that differ from a branch or commit (default: the default branch) |
| `--stdin-filepath` | Format standard input as this file and print the result |
| `--print-width` | The line length to wrap at (default: 80) |
| `--use-tabs` | Indent with tabs |
| `--no-semi` | Only print semicolons where they are needed |
| `--single-quote` | Use single quotes |
| `--init` | Add a [fmt] section to bunfig.toml |
| `--doctor` | Show which files are formatted natively and which packages you can remove |
| `--no-script` | Run the formatter even if the project has a fmt script |

## `bun x`

bun-repl             Execute a package binary (CLI), installing if needed (bunx)


## `bun repl`

Start a REPL session with Bun

| Option | Description |
|---|---|
| `--silent` | Don't print the script command |
| `--elide-lines` | Number of lines of script output shown when using --filter (default: 0, show all lines) |
| `-F` `--filter` | Run a script in all workspace packages matching the pattern |
| `-b` `--bun` | Force a script or package to use Bun's runtime instead of Node.js (via symlinking node) |
| `--no-orphans` | Exit when the parent process dies, and on exit kill every descendant. |
| `--shell` | Control the shell used for package.json scripts. Supports either 'bun' or 'system' |
| `--workspaces` | Run a script in all workspace packages (from the "workspaces" field in package.json) |
| `--parallel` | Run multiple scripts concurrently with Foreman-style output |
| `--sequential` | Run multiple scripts sequentially with Foreman-style output |
| `--no-exit-on-error` | Continue running other scripts when one fails (with --parallel/--sequential) |
| `--watch` | Automatically restart the process on file change |
| `--watch-kill-signal` | Signal whose handlers run when --watch restarts the process (default: "SIGTERM") |
| `--hot` | Enable auto reload in the Bun runtime, test runner, or bundler |
| `--no-clear-screen` | Disable clearing the terminal screen on reload when --hot or --watch is enabled |
| `--check` | Type check before running. Nothing runs if there are type errors. Alone: bun check |
| `--smol` | Use less memory, but run garbage collection more often |
| `--interactive` | Start a Node.js-compatible REPL, like node --interactive |
| `-r` `--preload` | Import a module before other modules are loaded |
| `--require` | Alias of --preload, for Node.js compatibility |
| `--import` | Alias of --preload, for Node.js compatibility |
| `--inspect` | Activate Bun's debugger |
| `--inspect-wait` | Activate Bun's debugger, wait for a connection before executing |
| `--inspect-brk` | Activate Bun's debugger, set breakpoint on first line of code and wait |
| `--cpu-prof` | Start CPU profiler and write profile to disk on exit |
| `--cpu-prof-name` | Specify the name of the CPU profile file |
| `--cpu-prof-dir` | Specify the directory where the CPU profile will be saved |
| `--cpu-prof-md` | Output CPU profile in markdown format (grep-friendly, designed for LLM analysis) |
| `--cpu-prof-interval` | Specify the sampling interval in microseconds for CPU profiling (default: 1000) |
| `--heap-prof` | Write a heap profile to disk on exit (.heapprofile) |
| `--heap-prof-name` | Specify the name of the heap profile file |
| `--heap-prof-dir` | Specify the directory where the heap profile will be saved |
| `--heap-prof-md` | Generate markdown heap profile on exit (for CLI analysis) |
| `--heap-prof-interval` | Specify the average sampling interval in bytes for heap profiling (default: 524288) |
| `--if-present` | Exit without an error if the entrypoint does not exist |
| `--no-install` | Disable auto install in the Bun runtime |
| `--install` | Configure auto-install behavior. One of "auto" (default, auto-installs when no node_modules), "fallback" (missing packages only), "force" (always). |
| `-e` `--eval` | Evaluate argument as a script |
| `-p` `--print` | Evaluate argument as a script and print the result |
| `--prefer-offline` | Skip staleness checks for packages in the Bun runtime and resolve from disk |
| `--prefer-latest` | Use the latest matching versions of packages in the Bun runtime, always checking npm |
| `--port` | Set the default port for Bun.serve |
| `--conditions` | Pass custom conditions to resolve |
| `--fetch-preconnect` | Preconnect to a URL while code is loading |
| `--experimental-http2-fetch` | Offer h2 in fetch() TLS ALPN. Same as BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP2_CLIENT=1 |
| `--experimental-http3-fetch` | Honor Alt-Svc: h3 in fetch() and upgrade to HTTP/3. Same as BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP3_CLIENT=1 |
| `--max-http-header-size` | Set the maximum size of HTTP headers in bytes. Default is 16KiB |
| `--insecure-http-parser` | Use an insecure HTTP parser that accepts invalid HTTP headers |
| `--dns-result-order` | Set the default order of DNS lookup results. Valid orders: verbatim (default), ipv4first, ipv6first |
| `--experimental-stream-iter` | Enable the experimental stream/iter API (node:stream/iter, node:zlib/iter). |
| `--expose-gc` | Expose gc() on the global object. Has no effect on Bun.gc(). |
| `--no-deprecation` | Suppress all reporting of the custom deprecation. |
| `--throw-deprecation` | Determine whether or not deprecation warnings result in errors. |
| `--no-warnings` | Silence all process warnings |
| `--trace-warnings` | Show stack traces on process warnings |
| `--trace-deprecation` | Show stack traces on deprecations |
| `--pending-deprecation` | Emit pending deprecation warnings |
| `--redirect-warnings` | Write process warnings to the given file instead of printing to stderr |
| `--disable-warning` | Silence specific process warnings by code or type |
| `--title` | Set the process title |
| `--zero-fill-buffers` | Boolean to force Buffer.allocUnsafe(size) to be zero-filled. |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `--redis-preconnect` | Preconnect to $REDIS_URL at startup |
| `--sql-preconnect` | Preconnect to PostgreSQL at startup |
| `--no-addons` | Throw an error if process.dlopen or bun:ffi cc() is called, and disable export condition "node-addons" |
| `--no-ffi-cc` | Throw an error if bun:ffi cc() is called (disables the C compiler) |
| `--unhandled-rejections` | One of "strict", "throw", "warn", "none", or "warn-with-error-code" |
| `--console-depth` | Set the default depth for console.log object inspection (default: 2) |
| `--user-agent` | Set the default User-Agent header for HTTP requests |
| `--cron-title` | Title for cron execution mode |
| `--cron-period` | Cron period for cron execution mode |
| `--main-fields` | Main fields to lookup in package.json. Defaults to --target dependent |
| `--preserve-symlinks` | Preserve symlinks when resolving files |
| `--preserve-symlinks-main` | Preserve symlinks when resolving the main entry point |
| `--extension-order` | Defaults to: .tsx,.ts,.jsx,.js,.json |
| `--tsconfig-override` | Specify custom tsconfig.json. Default $cwd/tsconfig.json |
| `-d` `--define` | Substitute K:V while parsing, e.g. --define process.env.NODE_ENV:"development". Values are parsed as JSON. |
| `--drop` | Remove function calls, e.g. --drop=console removes all console.* calls. |
| `--feature` | Enable a feature flag for dead-code elimination, e.g. --feature=SUPER_SECRET |
| `-l` `--loader` | Parse files with .ext:loader, e.g. --loader .js:jsx. Valid loaders: js, jsx, ts, tsx, json, toml, text, file, wasm, napi |
| `--no-macros` | Disable macros from being executed in the bundler, transpiler and runtime |
| `--jsx-factory` | Changes the function called when compiling JSX elements using the classic JSX runtime |
| `--jsx-fragment` | Changes the function called when compiling JSX fragments |
| `--jsx-import-source` | Declares the module specifier to be used for importing the jsx and jsxs factory functions. Default: "react" |
| `--jsx-runtime` | "automatic" (default) or "classic" |
| `--jsx-side-effects` | Treat JSX elements as having side effects (disable pure annotations) |
| `--ignore-dce-annotations` | Ignore tree-shaking annotations such as @__PURE__ |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--cwd` | Absolute path to resolve files & entry points from. This just changes the process' cwd. |
| `-c` `--config` | Specify path to Bun config file. Default $cwd/bunfig.toml |
| `-h` `--help` | Display this menu and exit |

## `bun exec`

Run a shell script directly with Bun


## `bun install`

Install dependencies for a package.json (bun i)

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `-d` `--dev` | Add dependency to "devDependencies" |
| `--optional` | Add dependency to "optionalDependencies" |
| `--peer` | Add dependency to "peerDependencies" |
| `--save-prod` | Add dependency to "dependencies", also when another group lists it |
| `-E` `--exact` | Add the exact version instead of the ^range |
| `-F` `--filter` | Install packages for the matching workspaces |
| `-a` `--analyze` | Analyze & install all dependencies of files passed as arguments recursively (using Bun's bundler) |
| `--only-missing` | Only add dependencies to package.json if they are not already present |
| `--catalog` | Add the resolved version to the root package.json catalog and depend on it as "catalog:" (use --catalog=NAME for a named catalog) |

## `bun add`

react                Add a dependency to package.json (bun a)

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `-d` `--dev` | Add dependency to "devDependencies" |
| `--optional` | Add dependency to "optionalDependencies" |
| `--peer` | Add dependency to "peerDependencies" |
| `--save-prod` | Add dependency to "dependencies", also when another group lists it |
| `-E` `--exact` | Add the exact version instead of the ^range |
| `-F` `--filter` | Add the package(s) to the matching workspaces instead of the current package |
| `-a` `--analyze` | Recursively analyze & install dependencies of files passed as arguments (using Bun's bundler) |
| `--only-missing` | Only add dependencies to package.json if they are not already present |
| `--catalog` | Add the resolved version to the root package.json catalog and depend on it as "catalog:" (use --catalog=NAME for a named catalog) |

## `bun remove`

is-array             Remove a dependency from package.json (bun rm)

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `-F` `--filter` | Remove the package(s) from the matching workspaces instead of the current package |

## `bun update`

lyra                 Update outdated dependencies

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Only update dependencies and optionalDependencies (alias: --prod) |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `-L` `--latest` | Update packages to their latest versions, ignoring the ranges in package.json |
| `-i` `--interactive` | Show an interactive list of outdated packages to select for update |
| `-F` `--filter` | Update packages for the matching workspaces |
| `-r` `--recursive` | Update packages in all workspaces |
| `-d` `--dev` | Only update devDependencies |
| `--no-optional` | Don't update optionalDependencies |
| `--depth` | Only 0 is accepted: update direct dependencies and keep transitive dependencies at their locked versions |
| `-E` `--exact` | Write exact versions to package.json instead of ^ or ~ ranges |

## `bun audit`

Check installed packages for vulnerabilities

| Option | Description |
|---|---|
| `--audit-level` | Only print advisories with severity greater than or equal to <level> (low, moderate, high, critical) |
| `-p` `--production` | Skip packages that are only needed by devDependencies (alias: --prod) |
| `--omit` | Skip packages that are only needed by the given dependency types: dev, optional, or peer (repeatable) |
| `--ignore` | Ignore advisories by GHSA or numeric advisory ID (repeatable) |
| `--json` | Output in JSON format |
| `--dry-run` | Show what bun audit fix would change without changing anything |
| `-L` `--latest` | Also apply fixes your declared ranges exclude, rewriting package.json |
| `--cwd` | Set a specific cwd |
| `-h` `--help` | Print this help menu |

## `bun dedupe`

Remove duplicate versions from the lockfile

| Option | Description |
|---|---|
| `--check` | Exit with code 1 if the lockfile has duplicate versions that can be removed, without changing anything |
| `--dry-run` | Print the duplicate versions that would be removed without changing anything |
| `--lockfile-only` | Rewrite bun.lock without installing |
| `--frozen-lockfile` | Fail instead of rewriting bun.lock when duplicate versions can be removed |
| `--linker` | Install with the given linker (one of "isolated" or "hoisted") |
| `--silent` | Don't log anything |
| `--cwd` | Set a specific cwd |
| `-h` `--help` | Print this help menu |

## `bun prune`

Remove packages that are not in the lockfile from node_modules

| Option | Description |
|---|---|
| `-p` `--production` | Also remove packages that are only needed by devDependencies (alias: --prod) |
| `--omit` | Also remove packages that are only needed by the given dependency types |
| `--check` | Exit with code 1 if node_modules has packages that can be removed, without deleting anything |
| `--dry-run` | Print what would be removed without deleting anything |
| `--os` | Prune for a different operating system than the current one |
| `--cpu` | Prune for a different CPU architecture than the current one |
| `--libc` | Prune for a different libc than the current one |
| `--linker` | Linker to assume when node_modules mixes isolated and hoisted installs (one of "isolated" or "hoisted") |
| `-F` `--filter` | Only prune the node_modules folders of the matching workspaces |
| `--silent` | Don't log anything |
| `--cwd` | Set a specific cwd |
| `-h` `--help` | Print this help menu |

## `bun outdated`

Display latest versions of outdated dependencies

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `-F` `--filter` | Display outdated dependencies for each matching workspace |
| `-r` `--recursive` | Check outdated packages in all workspaces |

## `bun link`

[<package>]          Register or link a local npm package

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile (the default) |
| `--save` | Update package.json and save a lockfile (false by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |

## `bun unlink`

Unregister a local npm package

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile (the default) |
| `--save` | Update package.json and save a lockfile (false by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |

## `bun publish`

Publish a package to the npm registry

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `--access` | Set access level for scoped packages |
| `--tag` | Tag the release. Default is "latest" |
| `--otp` | Provide a one-time password for authentication |
| `--auth-type` | Specify the type of one-time password authentication (default is 'web') |
| `--gzip-level` | Specify a custom compression level for gzip. Default is 9. |
| `--tolerate-republish` | Don't exit with code 1 when republishing over an existing version number |
| `-F` `--filter` | Publish each matching workspace package |
| `-r` `--recursive` | Publish every workspace package whose version is not on the registry |

## `bun info`

@remix-run/dev       Display package metadata from the registry

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `--json` | Output in JSON format |

## `bun why`

@evan/duckdb         Explain why a package is installed

| Option | Description |
|---|---|
| `-c` `--config` | Specify path to config file (bunfig.toml) |
| `-y` `--yarn` | Write a yarn.lock file (yarn v1) |
| `-p` `--production` | Don't install devDependencies |
| `--no-save` | Don't update package.json or save a lockfile |
| `--save` | Save to package.json (true by default) |
| `--ca` | Provide a Certificate Authority signing certificate |
| `--cafile` | The same as `--ca`, but is a file path to the certificate |
| `--dry-run` | Perform a dry run without making changes |
| `--frozen-lockfile` | Disallow changes to lockfile |
| `-f` `--force` | Always request the latest versions from the registry & reinstall all dependencies |
| `--cache-dir` | Store & load cached data from a specific directory path |
| `--no-cache` | Ignore manifest cache entirely |
| `--silent` | Don't log anything |
| `--quiet` | Only show tarball name when packing |
| `--verbose` | Excessively verbose logging |
| `--no-progress` | Disable the progress bar |
| `--no-summary` | Don't print a summary |
| `--no-verify` | Skip verifying integrity of newly downloaded packages |
| `--offline` | Never touch the network: resolve and install only from the local cache |
| `--prefer-offline` | Use cached package metadata regardless of age; only fetch what is missing |
| `--ignore-scripts` | Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies |
| `--trust` | Add to trustedDependencies in the project's package.json and install the package(s) |
| `-g` `--global` | Install globally |
| `--cwd` | Set a specific cwd |
| `--env-file` | Load environment variables from the specified file(s) |
| `--no-env-file` | Disable automatic loading of .env files |
| `--backend` | Platform-specific optimizations for installing dependencies. Possible values: "hardlink" (default), "symlink", "copyfile" |
| `--registry` | Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables |
| `--concurrent-scripts` | Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores) |
| `--network-concurrency` | Maximum number of concurrent network requests (default 64) |
| `--save-text-lockfile` | Save a text-based lockfile |
| `--omit` | Exclude 'dev', 'optional', or 'peer' dependencies from install |
| `--lockfile-only` | Generate a lockfile without installing dependencies |
| `--linker` | Linker strategy (one of "isolated" or "hoisted") |
| `--minimum-release-age` | Only install packages published at least N seconds ago (security feature) |
| `--minimum-release-age-excludes` | Packages exempt from --minimum-release-age (comma-separated or repeated; replaces the bunfig.toml list) |
| `--cpu` | Override CPU architecture for optional dependencies (e.g., x64, arm64, * for all) |
| `--os` | Override operating system for optional dependencies (e.g., linux, darwin, * for all) |
| `--libc` | Override libc for optional dependencies (e.g., glibc, musl, * for all) |
| `--use-system-ca` | Use the system's trusted certificate authorities |
| `--use-openssl-ca` | Use OpenSSL's default CA store |
| `--use-bundled-ca` | Use bundled CA store |
| `-h` `--help` | Print this help menu |
| `--top` | Show only the top dependency tree instead of nested ones |
| `--depth` | Maximum depth of the dependency tree to display |

## `bun build`

./a.ts ./b.jsx       Bundle TypeScript & JavaScript into a single file

| Option | Description |
|---|---|
| `--production` | Set NODE_ENV=production and enable minification |
| `--compile` | Generate a standalone Bun executable containing your bundled code. Implies --production |
| `--compile-exec-argv` | Prepend arguments to the standalone executable's execArgv |
| `--bytecode-order` | With --compile --bytecode: lay the bytecode out by order file(s) a run of the executable wrote (BUN_BYTECODE_ORDER_OUT); comma-separated or repeated, most impor |
| `--compile-jit-policy` | JIT tier-up threshold scale the executable starts with (default 1 = normal; see Bun.unsafe.setJITPolicy) |
| `--compile-autoload-dotenv` | Enable autoloading of .env files in standalone executable (default: true) |
| `--no-compile-autoload-dotenv` | Disable autoloading of .env files in standalone executable |
| `--compile-autoload-bunfig` | Enable autoloading of bunfig.toml in standalone executable (default: true) |
| `--no-compile-autoload-bunfig` | Disable autoloading of bunfig.toml in standalone executable |
| `--compile-autoload-tsconfig` | Enable autoloading of tsconfig.json at runtime in standalone executable (default: false) |
| `--no-compile-autoload-tsconfig` | Disable autoloading of tsconfig.json at runtime in standalone executable |
| `--compile-autoload-package-json` | Enable autoloading of package.json at runtime in standalone executable (default: false) |
| `--no-compile-autoload-package-json` | Disable autoloading of package.json at runtime in standalone executable |
| `--compile-executable-path` | Path to a Bun executable to use for cross-compilation instead of downloading |
| `--asset` | Embed a file or directory into the compiled executable, preserving its relative path (requires --compile) |
| `--bytecode` | Use a bytecode cache |
| `--bytecode-depth` | How many levels of nested functions to compile to bytecode ahead of time. Defaults to all |
| `--no-optimize-bytecode` | With --bytecode: skip the build-time bytecode optimization passes |
| `--watch` | Automatically restart the process on file change |
| `--no-clear-screen` | Disable clearing the terminal screen on reload when --watch is enabled |
| `--target` | The intended execution environment for the bundle. "browser", "bun" or "node" |
| `--outdir` | Default to "dist" if multiple files |
| `--outfile` | Write to a file |
| `--metafile` | Write a JSON file with metadata about the build |
| `--metafile-md` | Write a markdown file with a visualization of the module graph (LLM-friendly) |
| `--sourcemap` | Build with sourcemaps - 'linked', 'inline', 'external', or 'none' |
| `--banner` | Add a banner to the bundled output such as "use client"; for a bundle being used with RSCs |
| `--footer` | Add a footer to the bundled output such as // built with bun! |
| `--format` | Specifies the module format to build to. "esm", "cjs" and "iife" are supported. Defaults to "esm", or "cjs" with --bytecode. |
| `--root` | Root directory used for multiple entry points |
| `--splitting` | Enable code splitting |
| `--no-split-require` | With --splitting and --target bun: keep a require()'d ESM file in the calling chunk instead of emitting a chunk loaded at the call |
| `--no-module-preload` | With --splitting and --target browser: don't emit for the chunks an entry or import() loads |
| `--min-chunk-size` | With --splitting, also fold side-effect-free chunks smaller than this many source bytes into a chunk more entry points load. Default: 0 (off); 16384 is a good v |
| `--public-path` | A prefix to be appended to any import paths in bundled code |
| `-e` `--external` | Exclude module from transpilation (can use * wildcards). ex: -e react |
| `--allow-unresolved` | Allow unresolved dynamic import()/require() specifiers matching these glob patterns. Use '<empty>' for opaque specifiers. Default is '*' (allow all). |
| `--reject-unresolved` | Fail the build on any dynamic import()/require() specifier that cannot be resolved at build time. |
| `--packages` | Add dependencies to bundle or keep them external. "external", "bundle" is supported. Defaults to "bundle". |
| `--entry-naming` | Customize entry point filenames. Defaults to "[dir]/[name].[ext]" |
| `--chunk-naming` | Customize chunk filenames. Defaults to "[name]-[hash].[ext]" |
| `--asset-naming` | Customize asset filenames. Defaults to "[name]-[hash].[ext]" |
| `--react-fast-refresh` | Enable React Fast Refresh transform (does not emit hot-module code, use this for testing) |
| `--react-compiler` | Enable the React Compiler optimizing transform |
| `--no-bundle` | Transpile file only, do not bundle |
| `--check` | Type check the entry points and what they import. Nothing is bundled if there are type errors |
| `--emit-dce-annotations` | Re-emit DCE annotations in bundles. Enabled by default unless --minify-whitespace is passed. |
| `--no-deprecated-namespace-object-setters` | Make bundled module namespace objects getter-only (the default in a future release) |
| `--minify` | Enable all minification flags |
| `--minify-syntax` | Minify syntax and inline data |
| `--minify-whitespace` | Minify whitespace |
| `--minify-identifiers` | Minify identifiers |
| `--keep-names` | Preserve original function and class names when minifying |
| `--css-chunking` | Chunk CSS files together to reduce duplicated CSS loaded in a browser. Only has an effect when multiple entrypoints import CSS |
| `--conditions` | Pass custom conditions to resolve |
| `--app` | (EXPERIMENTAL) Build a web app for production using Bun Bake. |
| `--env` | Inline environment variables into the bundle as process.env.${name}. Defaults to 'disable'. To inline environment variables matching a prefix, use my prefix lik |
| `--windows-hide-console` | When using --compile targeting Windows, prevent a Command prompt from opening alongside the executable |
| `--windows-icon` | When using --compile targeting Windows, assign an executable icon |
| `--windows-title` | When using --compile targeting Windows, set the executable product name |
| `--windows-publisher` | When using --compile targeting Windows, set the executable company name |
| `--windows-version` | When using --compile targeting Windows, set the executable version (e.g. 1.2.3.4) |
| `--windows-description` | When using --compile targeting Windows, set the executable description |
| `--windows-copyright` | When using --compile targeting Windows, set the executable copyright |

## `bun init`

Start an empty Bun project from a built-in template

| Option | Description |
|---|---|
| `--help` | Print this menu |
| `-y` `--yes` | Accept all default options |
| `-m` `--minimal` | Only initialize type definitions |
| `-r` `--react` | Initialize a React project |
| `--react` | Initialize a React project with TailwindCSS |
| `--react` | Initialize a React project with @shadcn/ui and TailwindCSS |

## `bun create`

next-app             Create a new project from a template (bun c)


## `bun upgrade`

Upgrade to latest version of Bun.
