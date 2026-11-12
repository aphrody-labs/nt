// Graphe des fonctionnalités de bun (amont), extrait de l'arbre source sans rien compiler.
// Usage : bun sdk/tools/bun-graph.ts <racine-bun> [--out docs/bun] -> feature-graph.json + feature-graph.md
// Sources lues : src/trim/features/*.def (modèle trim), src/codegen/builtins/host/features-*.builtins.ts (built-in -> fonctionnalité),
// Cargo.toml (crates), scripts/build/deps (vendeurs), BunObject.cpp (Bun.*), packages/bun-types, src/js, *.bind.ts, C++, scripts de build.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const rootArg = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--out");
if (!rootArg) {
  console.error("usage : bun sdk/tools/bun-graph.ts <racine-bun> [--out docs/bun]");
  process.exit(2);
}
const root = resolve(rootArg);
const outIdx = argv.indexOf("--out");
const outDir = resolve(outIdx >= 0 ? (argv[outIdx + 1] ?? "docs/bun") : "docs/bun");

// ---------- Tables de regroupement (seule donnée écrite à la main ; reprise dans le .md) ----------

type DomainSpec = { id: string; label: string; dirs: string[]; files?: string[]; features: string[]; apis: string[] };

/** Domaines : répertoires/fichiers (vérifiés), fonctionnalités trim et préfixes d'API rattachés. */
const DOMAINS: DomainSpec[] = [
  {
    id: "bun-apis",
    label: "Bun.* (API runtime)",
    dirs: ["src/runtime/api"],
    files: ["src/jsc/bindings/BunObject*"],
    features: ["BunUtilities", "BunInfo"],
    apis: ["Bun"],
  },
  {
    id: "ffi",
    label: "bun:ffi",
    dirs: ["src/runtime/ffi", "src/tcc_sys"],
    files: [
      "src/jsc/FFI.rs",
      "src/jsc/bindings/ffi.cpp",
      "src/jsc/bindings/JSFFI*",
      "src/jsc/bindings/JSCFFIBridge.cpp",
      "src/js/bun/ffi.ts",
      "src/js/ahead-of-time/bun/ffi.ts",
      "packages/bun-types/ffi.d.ts",
    ],
    features: ["Ffi"],
    apis: ["bun:ffi", "Bun.FFI", "%FFI"],
  },
  {
    id: "napi",
    label: "Node-API / addons natifs",
    dirs: ["src/runtime/napi", "src/jsc/bindings/v8"],
    files: ["src/jsc/bindings/napi*", "src/jsc/bindings/Napi*"],
    features: ["NativeAddons"],
    apis: ["process.dlopen"],
  },
  {
    id: "sqlite",
    label: "bun:sqlite",
    dirs: ["src/jsc/bindings/sqlite"],
    files: ["src/js/bun/sqlite.ts", "packages/bun-types/sqlite.d.ts"],
    features: ["Sqlite", "SqliteExtensions"],
    apis: ["bun:sqlite", "node:sqlite"],
  },
  {
    id: "sql",
    label: "Bun.sql (Postgres/MySQL)",
    dirs: ["src/sql", "src/sql_jsc"],
    files: ["src/js/bun/sql.ts", "packages/bun-types/sql.d.ts"],
    features: ["Sql"],
    apis: ["Bun.sql", "Bun.SQL", "bun:sql"],
  },
  {
    id: "serve",
    label: "Bun.serve / HTTP",
    dirs: ["src/runtime/server", "src/http", "src/http_types", "src/http_jsc", "src/uws", "src/uws_sys", "src/picohttp"],
    files: ["packages/bun-types/serve.d.ts"],
    features: ["Serve", "ServeHttp2", "Http3", "HttpClient", "Fetch"],
    apis: ["Bun.serve", "fetch"],
  },
  {
    id: "sockets",
    label: "Sockets / TLS / DNS",
    dirs: ["src/runtime/socket", "src/dns", "src/cares_sys", "src/lsquic_sys", "src/boringssl", "src/boringssl_sys"],
    features: ["Sockets", "TlsSockets", "Tls", "Dns", "Udp"],
    apis: ["Bun.connect", "Bun.listen", "Bun.udpSocket", "Bun.dns"],
  },
  {
    id: "shell",
    label: "Bun.$ (shell)",
    dirs: ["src/runtime/shell", "src/shell_parser"],
    files: ["packages/bun-types/shell.d.ts"],
    features: ["Shell"],
    apis: ["Bun.$"],
  },
  {
    id: "spawn",
    label: "Bun.spawn / processus",
    dirs: ["src/spawn", "src/spawn_sys"],
    features: ["Spawn", "BunSpawn", "BunSpawnSync", "ChildProcess", "Terminal"],
    apis: ["Bun.spawn", "Bun.spawnSync", "node:child_process"],
  },
  {
    id: "test-runner",
    label: "bun test",
    dirs: ["src/runtime/test_runner"],
    files: ["packages/bun-types/test.d.ts"],
    features: ["Test", "TestCommand"],
    apis: ["bun:test", "node:test"],
  },
  {
    id: "install",
    label: "bun install (gestionnaire de paquets)",
    dirs: [
      "src/install",
      "src/install_jsc",
      "src/install_types",
      "src/semver",
      "src/semver_jsc",
      "src/patch",
      "src/patch_jsc",
      "src/tar",
      "src/archive",
    ],
    features: ["Install", "Semver", "Archive"],
    apis: ["Bun.semver", "Bun.Archive"],
  },
  {
    id: "bundler",
    label: "Bundler (bun build, Bun.build)",
    dirs: [
      "src/bundler",
      "src/bundler_jsc",
      "src/css",
      "src/css_jsc",
      "src/css_derive",
      "src/sourcemap",
      "src/sourcemap_jsc",
      "src/runtime/bake",
      "src/standalone_graph",
      "src/router",
    ],
    files: ["packages/bun-types/bundle.d.ts", "packages/bun-types/devserver.d.ts"],
    features: ["Bundler", "BuildCommand", "CssParser", "ReactCompiler", "SourceMaps"],
    apis: ["Bun.build", "bun:bundle"],
  },
  {
    id: "transpiler",
    label: "Transpileur (parseur, printer, résolveur)",
    dirs: [
      "src/transpiler",
      "src/js_parser",
      "src/js_parser_jsc",
      "src/js_printer",
      "src/ast",
      "src/ast_jsc",
      "src/resolver",
      "src/resolve_builtins",
      "src/react_compiler",
      "src/parsers",
    ],
    features: ["RuntimeTranspiler", "DataFileLoaders"],
    apis: ["Bun.Transpiler"],
  },
  {
    id: "lint-check-fmt",
    label: "bun lint / check / fmt",
    dirs: ["src/lint", "src/format", "src/sema"],
    features: ["Lint", "Check", "Fmt"],
    apis: [],
  },
  {
    id: "aot",
    label: "Compilateur AOT (bun compile --aot)",
    dirs: ["src/aot", "src/executable", "src/exe_format"],
    features: ["AotCompiler", "ImageCompiler"],
    apis: [],
  },
  {
    id: "node-compat",
    label: "Compatibilité Node (node:*)",
    dirs: ["src/js/node", "src/runtime/node", "src/jsc/bindings/node", "src/node_path"],
    features: ["NodeFs", "NodeOs", "NodePath", "NodeHttp", "NodeCrypto", "NodeUtil", "NodeVm"],
    apis: ["node:"],
  },
  {
    id: "web-apis",
    label: "API Web (WebCore)",
    dirs: ["src/runtime/webcore", "src/jsc/bindings/webcore", "src/jsc/bindings/webcrypto", "src/js/builtins"],
    features: ["WebStreams", "Bodies", "Headers", "Url", "WebCrypto", "TextEncoder", "TextDecoder", "WebSocket", "Worker"],
    apis: ["Response", "Request", "ReadableStream", "WebSocket", "crypto"],
  },
  {
    id: "wasm",
    label: "WebAssembly / WASI",
    dirs: [],
    files: [
      "src/js/builtins/WasmStreaming.ts",
      "src/jsc/bindings/webcore/JSWasmStreamingCompiler.*",
      "src/runtime/webcore/wasm_streaming.rs",
      "src/js/wasi-runner.js",
      "packages/bun-types/wasm.d.ts",
    ],
    features: ["WebAssembly"],
    apis: ["WebAssembly", "node:wasi"],
  },
  { id: "webview", label: "Bun.WebView", dirs: ["src/runtime/webview"], features: ["WebView"], apis: ["Bun.WebView"] },
  {
    id: "valkey",
    label: "Bun.redis (Valkey)",
    dirs: ["src/valkey", "src/runtime/valkey_jsc"],
    files: ["packages/bun-types/redis.d.ts"],
    features: ["Valkey"],
    apis: ["Bun.redis", "Bun.RedisClient"],
  },
  {
    id: "s3",
    label: "Bun.s3",
    dirs: ["src/s3_signing"],
    files: ["packages/bun-types/s3.d.ts"],
    features: ["S3Client", "S3Responses"],
    apis: ["Bun.s3", "Bun.S3Client"],
  },
  { id: "image", label: "Bun.Image", dirs: ["src/runtime/image", "src/png"], features: ["Image"], apis: ["Bun.Image"] },
  {
    id: "engine",
    label: "Liaison JavaScriptCore",
    dirs: ["src/jsc", "src/jsc_macros", "src/yarr"],
    features: ["BunJsc"],
    apis: ["bun:jsc"],
  },
  {
    id: "event-loop-io",
    label: "Boucle d'événements, E/S, système",
    dirs: [
      "src/event_loop",
      "src/io",
      "src/threading",
      "src/sys",
      "src/sys_jsc",
      "src/libuv_sys",
      "src/windows_sys",
      "src/platform",
      "src/watcher",
      "src/runtime/timer",
    ],
    features: [],
    apis: [],
  },
  {
    id: "cli",
    label: "Ligne de commande bun",
    dirs: ["src/runtime/cli", "src/clap", "src/clap_macros", "src/bunfig"],
    features: ["Tools", "Repl", "Create", "Upgrade", "Bunfig"],
    apis: [],
  },
  {
    id: "core",
    label: "Socle (alloc, collections, chaînes)",
    dirs: [
      "src/bun_core",
      "src/bun_core_macros",
      "src/bun_alloc",
      "src/collections",
      "src/ptr",
      "src/safety",
      "src/mimalloc_sys",
      "src/simdutf_sys",
      "src/highway",
      "src/errno",
      "src/paths",
      "src/opaque",
      "src/pod",
    ],
    features: [],
    apis: [],
  },
  { id: "trim", label: "Modèle trim (fonctionnalités retirables)", dirs: ["src/trim"], features: [], apis: [] },
  {
    id: "build-system",
    label: "Système de build et codegen",
    dirs: ["scripts/build", "src/codegen"],
    files: ["Cargo.toml", "package.json"],
    features: [],
    apis: [],
  },
];

/** Crate *_sys -> nom de dépendance vendue quand ils diffèrent. */
const VENDOR_ALIASES: Record<string, string> = { tcc: "tinycc" };

/** Recherche d'absence : termes WebGPU dans les sources. */
const WEBGPU_TERMS = /webgpu|navigator\.gpu|GPUAdapter|GPUDevice|wgpu|dawn/i;

// ---------- Graphe ----------

type Kind = "feature" | "trim-feature" | "api" | "module" | "binding" | "native" | "crate" | "vendor" | "cpp" | "build" | "domain";
type GNode = { id: string; kind: Kind; label: string; paths?: string[]; loc?: number; api?: string[]; attrs?: Record<string, unknown> };
type GEdge = { from: string; to: string; kind: string; conditional?: boolean; weight?: number };

const nodes = new Map<string, GNode>();
const edges = new Map<string, GEdge>();
const notes: string[] = [];

function node(id: string, kind: Kind, label = id.slice(id.indexOf(":") + 1)): GNode {
  let n = nodes.get(id);
  if (!n) nodes.set(id, (n = { id, kind, label }));
  return n;
}
function edge(from: string, to: string, kind: string, opt: { conditional?: boolean; count?: boolean } = {}) {
  if (from === to) return;
  const key = `${from}\u0000${kind}\u0000${to}`;
  const e = edges.get(key);
  if (e) {
    if (opt.count) e.weight = (e.weight ?? 1) + 1;
    if (e.conditional && !opt.conditional) delete e.conditional;
    return;
  }
  const n: GEdge = { from, to, kind };
  if (opt.conditional) n.conditional = true;
  if (opt.count) n.weight = 1;
  edges.set(key, n);
}
const attrs = (n: GNode) => (n.attrs ??= {});
const addPath = (n: GNode, p: string) => {
  n.paths ??= [];
  if (!n.paths.includes(p)) n.paths.push(p);
};
const addApi = (n: GNode, a: string) => {
  n.api ??= [];
  if (!n.api.includes(a)) n.api.push(a);
};

// ---------- Index des fichiers ----------

const CODE = /\.(rs|cpp|cc|c|h|hpp|mm|ts|tsx|js|mjs|cjs|toml|idl|def)$/;
const rel = (p: string) => p.replaceAll("\\", "/");
const files = ["src", "scripts/build", "packages/bun-types"]
  .flatMap((d) => [...new Bun.Glob(`${d}/**/*`).scanSync({ cwd: root, onlyFiles: true, followSymlinks: false })])
  .map(rel)
  .filter((f) => !f.includes("/node_modules/"))
  .sort();
const textCache = new Map<string, string>();
const read = (f: string) => {
  let t = textCache.get(f);
  if (t === undefined) textCache.set(f, (t = existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : ""));
  return t;
};
const locOf = new Map<string, number>();
const webgpuHits: string[] = [];
const webgpuLines: string[] = [];
for (const f of files) {
  if (!CODE.test(f)) continue;
  const buf = readFileSync(join(root, f));
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  if (buf.length && buf[buf.length - 1] !== 10) n++;
  locOf.set(f, n);
  if (/\.(rs|cpp|h|c|mm|ts|js)$/.test(f) && WEBGPU_TERMS.test(buf.toString("latin1"))) {
    webgpuHits.push(f);
    buf
      .toString("latin1")
      .split("\n")
      .flatMap((l, i) => (WEBGPU_TERMS.test(l) ? [`${f}:${i + 1}: ${l.trim().slice(0, 80)}`] : []))
      .slice(0, 3)
      .forEach((l) => webgpuLines.push(l));
  }
}
const filesUnder = (dir: string) => files.filter((f) => f.startsWith(`${dir}/`));
const sumLoc = (fs: Iterable<string>) => {
  let s = 0;
  for (const f of fs) s += locOf.get(f) ?? 0;
  return s;
};
const byBase = new Map<string, string[]>();
for (const f of files) {
  const b = posix.basename(f);
  byBase.set(b, [...(byBase.get(b) ?? []), f]);
}
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;
const filesNamed = (file: string) => (byBase.get(posix.basename(file)) ?? []).filter((f) => f === file || f.endsWith(`/${file}`));

// ---------- Provenance ----------

const git = (...a: string[]) => {
  const r = Bun.spawnSync(["git", "-C", root, ...a], { stdout: "pipe", stderr: "ignore" });
  return r.success ? r.stdout.toString().trim() : "";
};
const [commit = "", commitDate = ""] = git("log", "-1", "--format=%H%n%cI").split("\n");
const pkg = JSON.parse(read("package.json") || readFileSync(join(root, "package.json"), "utf8")) as { version?: string };

// ---------- 1. Modèle trim (src/trim/features/*.def) ----------

type FeatureRec = {
  name: string;
  text: string;
  index: number;
  enteredFrom: string;
  isEngine: boolean;
  exports: boolean;
  minimumBytes: Record<string, number>;
  cFunctions?: string[];
  cxxFunctions?: { hint: string; pattern: string }[];
};
type TrimRec = { name: string; features: string[]; about: string; also: string[]; saves?: { linux: number; macos: number } };

const trimModule = pathToFileURL(join(root, "scripts/build/trim/features.ts")).href;
const trimApi: { loadFeatures?: (r: string) => { features?: unknown; trimFeatures?: unknown } } = await import(trimModule);
if (typeof trimApi.loadFeatures !== "function") throw new Error("scripts/build/trim/features.ts : loadFeatures absent");
const model = trimApi.loadFeatures(root);
if (!Array.isArray(model.features) || !Array.isArray(model.trimFeatures)) throw new Error("modèle trim : forme inattendue");
const featureDefs = new Bun.Glob("src/trim/features/*.def").scanSync({ cwd: root });
const featureWhere = new Map<string, string>();
for (const f of [...featureDefs].map(rel).sort()) {
  const t = read(f);
  for (const m of t.matchAll(/^(feature|trim-feature) ([A-Za-z0-9-]+)/gm))
    featureWhere.set(`${m[1]}:${m[2]}`, `${f}:${lineOf(t, m.index)}`);
}
for (const f of model.features as FeatureRec[]) {
  const n = node(`feature:${f.name}`, "feature");
  const w = featureWhere.get(`feature:${f.name}`);
  if (w) addPath(n, w);
  Object.assign(attrs(n), {
    text: f.text,
    index: f.index,
    enteredFrom: f.enteredFrom,
    isEngine: f.isEngine,
    exports: f.exports,
    ...(Object.keys(f.minimumBytes).length ? { minimumBytes: f.minimumBytes } : {}),
    ...(f.cFunctions?.length ? { cFunctions: f.cFunctions } : {}),
    ...(f.cxxFunctions?.length ? { cxxFunctions: f.cxxFunctions.map((c) => c.pattern) } : {}),
  });
}
for (const t of model.trimFeatures as TrimRec[]) {
  const n = node(`trim:${t.name}`, "trim-feature");
  const w = featureWhere.get(`trim-feature:${t.name}`);
  if (w) addPath(n, w);
  Object.assign(attrs(n), { about: t.about, ...(t.also.length ? { also: t.also } : {}), ...(t.saves ? { savesMB: t.saves } : {}) });
  for (const f of t.features) edge(n.id, `feature:${f}`, "includes");
}

// ---------- 2. Built-ins -> fonctionnalités (cale de bun-builtins-table) ----------

// Les fichiers features-*.builtins.ts importent la bibliothèque du moteur (WebKit, absente) : on la remplace par un
// enregistreur. b.extend(chemin, { usesFeature }) est capté ; tout le reste rend un mandataire inerte.
type Use = { feature: string; conditional: boolean };
const builtinUses = new Map<string, { uses: Use[]; from: Set<string> }>();
const nativeKinds = new Map<string, string>();
const shimDir = mkdtempSync(join(tmpdir(), "nt-bun-graph-"));
try {
  const gen = join(shimDir, "builtins", "generator");
  mkdirSync(gen, { recursive: true });
  const namesOf = (file: string) => {
    const t = read(`src/codegen/builtins/${file}`);
    const s = new Set<string>();
    for (const m of t.matchAll(/export const \{([^}]*)\} = engineModule/g))
      for (const part of (m[1] ?? "").split(",")) {
        const k = part.split(":")[0]?.trim();
        if (k) s.add(k);
      }
    for (const m of t.matchAll(/engineModule\.([A-Za-z_$][\w$]*)/g)) if (m[1]) s.add(m[1]);
    return [...s].sort();
  };
  const recorder = `const mk = (name, args) => {
  const p = new Proxy(function () {}, {
    apply: (_t, _s, a) => mk(name, a),
    construct: (_t, a) => mk(name, a),
    get: (_t, k) => k === "__b" ? name : k === "args" ? args ?? [] : k === Symbol.iterator ? function* () { yield p; } :
      typeof k === "symbol" || k === "then" ? undefined : mk(name + "." + String(k)),
  });
  return p;
};`;
  const pathImpl: Record<string, string> = {
    pathOfNativeBinding: `(kind, file, symbol) => "native:" + kind + ":" + file + "#" + symbol`,
    pathOfNativeFunction: `(...a) => "native:Function:" + a.join("#")`,
    joinPath: `(...a) => a.join(".")`,
    memberPathOf: `(h, n) => h + "." + n`,
    pathOfClassMember: `(...a) => a.join(".")`,
    textOfPath: `(p) => String(p)`,
  };
  const emit = (file: string, body: (n: string) => string) =>
    writeFileSync(
      join(gen, file),
      `${recorder}\n${namesOf(file)
        .map((n, i) => `const v${i} = ${body(n)};\nexport { v${i} as ${n} };`)
        .join("\n")}\n`,
    );
  emit("lib.ts", (n) => `mk(${JSON.stringify(n)})`);
  emit("vocabulary.ts", () => "[]");
  emit("paths.ts", (n) => pathImpl[n] ?? `mk(${JSON.stringify(n)})`);
  process.env.AOT_ENGINE_DIRECTORY = shimDir;
  type Rec = { __b: string; args: unknown[] };
  const isRec = (x: unknown): x is Rec => typeof x === "function" && typeof (x as unknown as Rec).__b === "string";
  for (const part of ["bun", "node", "web", "process"]) {
    const file = `src/codegen/builtins/host/features-${part}.builtins.ts`;
    const found: [unknown, unknown][] = [];
    try {
      const mod: { default?: unknown } = await import(pathToFileURL(join(root, file)).href);
      const walk = (x: unknown) => {
        if (Array.isArray(x)) x.forEach(walk);
        else if (isRec(x)) {
          if (x.__b === "extend") found.push([x.args[0], x.args[1]]);
          else x.args.forEach(walk);
        }
      };
      walk(mod.default);
    } catch (e) {
      // Repli : lecture textuelle des appels extendAll([...], "chemin", ...) aux littéraux seuls.
      notes.push(`${file} : import impossible (${String(e).split("\n")[0]}), repli textuel`);
      const t = read(file);
      for (const m of t.matchAll(/extendAll\(\s*\[([^\]]*)\]\s*,((?:\s*"[^"]*"\s*,?)+)/g)) {
        const feats = [...(m[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]);
        for (const p of (m[2] ?? "").matchAll(/"([^"]+)"/g)) found.push([p[1], { usesFeature: feats }]);
      }
    }
    for (const [path, spec] of found) {
      const p = isRec(path) ? `${path.__b}(…)` : String(path);
      const raw = (spec as { usesFeature?: unknown } | undefined)?.usesFeature;
      if (!Array.isArray(raw)) continue;
      const entry = builtinUses.get(p) ?? { uses: [], from: new Set<string>() };
      entry.from.add(file);
      for (const u of raw) {
        const feature = typeof u === "string" ? u : (u as { feature?: unknown })?.feature;
        if (typeof feature !== "string") continue;
        entry.uses.push({ feature, conditional: typeof u === "object" && u !== null && "when" in u });
      }
      builtinUses.set(p, entry);
    }
  }
} finally {
  rmSync(shimDir, { recursive: true, force: true });
}

// ---------- 3. Crates Rust (Cargo.toml) ----------

type Toml = Record<string, unknown>;
const tomlOf = (f: string): Toml => (read(f) ? (Bun.TOML.parse(read(f)) as Toml) : {});
const rootToml = tomlOf("Cargo.toml") as { workspace?: { members?: string[]; dependencies?: Record<string, unknown> } };
const members = (rootToml.workspace?.members ?? []).slice().sort();
const wsDeps = rootToml.workspace?.dependencies ?? {};
const crateByDir = new Map<string, string>();
const crateDirs: [string, string][] = [];
for (const dir of members) {
  const t = tomlOf(`${dir}/Cargo.toml`) as { package?: { name?: string } };
  const name = t.package?.name ?? posix.basename(dir);
  crateByDir.set(dir, name);
  crateDirs.push([dir, name]);
}
crateDirs.sort((a, b) => b[0].length - a[0].length);
const crateOfFile = (f: string) => crateDirs.find(([d]) => f.startsWith(`${d}/`))?.[1];
const crateNames = new Set(crateByDir.values());
const rsByCrate = new Map<string, string[]>();
for (const f of files)
  if (f.endsWith(".rs")) {
    const c = crateOfFile(f);
    if (c) rsByCrate.set(c, [...(rsByCrate.get(c) ?? []), f]);
  }
const vendorOfPath = (p: string) => {
  // Crate de l'arbre hors workspace (ex. proc-macro) : nœud crate ; sinon source récupérée au build.
  const inTree = (tomlOf(`${p}/Cargo.toml`) as { package?: { name?: string } }).package?.name;
  if (inTree) {
    const c = node(`crate:${inTree}`, "crate", inTree);
    addPath(c, p);
    c.loc = sumLoc(files.filter((f) => f.startsWith(`${p}/`) && f.endsWith(".rs")));
    attrs(c).workspaceMember = false;
    return c.id;
  }
  const n = node(`vendor:${posix.basename(p)}`, "vendor");
  addPath(n, p);
  attrs(n).source ??= "chemin Cargo (récupéré au build)";
  return n.id;
};
for (const dir of members) {
  const name = crateByDir.get(dir) ?? dir;
  const t = tomlOf(`${dir}/Cargo.toml`) as {
    lib?: { path?: string };
    features?: Record<string, unknown>;
    dependencies?: Record<string, unknown>;
    "build-dependencies"?: Record<string, unknown>;
    "dev-dependencies"?: Record<string, unknown>;
    target?: Record<string, { dependencies?: Record<string, unknown> }>;
  };
  const n = node(`crate:${name}`, "crate", name);
  addPath(n, dir);
  n.loc = sumLoc(rsByCrate.get(name) ?? []);
  const a = attrs(n);
  a.rsFiles = rsByCrate.get(name)?.length ?? 0;
  if (t.features && Object.keys(t.features).length) a.cargoFeatures = Object.keys(t.features).sort();
  if (name.endsWith("_sys")) a.sys = true;
  if (existsSync(join(root, dir, "build.rs"))) a.buildRs = true;
  const external = new Set<string>();
  const scan = (deps: Record<string, unknown> | undefined, scope: string) => {
    for (const [key, spec0] of Object.entries(deps ?? {})) {
      let spec = spec0 as { path?: string; workspace?: boolean; package?: string } | string;
      let base = dir;
      if (typeof spec === "object" && spec.workspace) {
        spec = (wsDeps[key] ?? {}) as typeof spec;
        base = "";
      }
      if (typeof spec === "object" && spec.path) {
        const p = posix.normalize(base ? `${base}/${spec.path}` : spec.path);
        const target = crateByDir.get(p);
        if (target) edge(n.id, `crate:${target}`, scope === "dev" ? "dev-depends" : "depends");
        else if (scope !== "dev") edge(n.id, vendorOfPath(p), "depends");
      } else if (scope !== "dev") external.add(typeof spec === "object" && spec.package ? spec.package : key);
    }
  };
  scan(t.dependencies, "normal");
  scan(t["build-dependencies"], "build");
  scan(t["dev-dependencies"], "dev");
  for (const v of Object.values(t.target ?? {})) scan(v.dependencies, "target");
  if (external.size) a.externalCrates = [...external].sort();
}

// Dépendances vendues (scripts/build/deps/*.ts) et rattachement aux crates *_sys.
const depFiles = [...new Bun.Glob("scripts/build/deps/*.ts").scanSync({ cwd: root })].map(rel).filter((f) => !f.endsWith("/index.ts"));
const vendorByNorm = new Map<string, string>();
const vendorsOfFile = new Map<string, string[]>();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const patchesOf = (body: string) => [...(/patches:\s*\[([^\]]*)\]/.exec(body)?.[1]?.matchAll(/"([^"]+)"/g) ?? [])].map((m) => m[1] ?? "");
for (const f of depFiles.sort()) {
  const t = read(f);
  const consts = new Map<string, string>();
  for (const m of t.matchAll(/const ([A-Z0-9_]+)\s*=\s*"([^"]+)"/g)) if (m[1] && m[2]) consts.set(m[1], m[2]);
  for (const m of t.matchAll(/export const \w+: Dependency = \{/g)) {
    const next = t.indexOf("\nexport const ", m.index + 1);
    const body = t.slice(m.index, next < 0 ? undefined : next);
    const name = /name:\s*"([^"]+)"/.exec(body)?.[1];
    if (!name) continue;
    const n = node(`vendor:${name}`, "vendor", name);
    addPath(n, f);
    const a = attrs(n);
    const repo = /repo:\s*"([^"]+)"/.exec(body)?.[1];
    const c = /commit:\s*("([^"]+)"|([A-Za-z0-9_.]+))/.exec(body);
    const kind = /kind:\s*"(in-tree|github-archive|git|[a-z-]+)"/.exec(body)?.[1];
    const inTree = /kind:\s*"in-tree",\s*path:\s*"([^"]+)"/.exec(body)?.[1];
    let commitValue = c?.[2] ?? (c?.[3] ? consts.get(c[3]) : undefined);
    if (!commitValue && c?.[3]?.includes("Version")) commitValue = [...consts.entries()].find(([k]) => k.endsWith("_VERSION"))?.[1];
    // Premier paragraphe du commentaire d'en-tête.
    const head = /^\/\*\*\s*\n((?:\s*\*[^\n]*\n)+?)\s*\*\s*\n/.exec(t)?.[1];
    const about = head
      ?.split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 300);
    Object.assign(a, {
      source: inTree ? "dans l'arbre" : (kind ?? "inconnu"),
      ...(repo ? { repo } : {}),
      ...(commitValue ? { commit: commitValue } : {}),
      ...(patchesOf(body).length ? { patches: patchesOf(body) } : {}),
      ...(about ? { about } : {}),
    });
    if (inTree) addPath(n, inTree);
    for (const d of [...(/fetchDeps:\s*\[([^\]]*)\]/.exec(body)?.[1]?.matchAll(/"([^"]+)"/g) ?? [])])
      if (d[1]) edge(n.id, `vendor:${d[1]}`, "fetch-depends");
    vendorByNorm.set(norm(name), n.id);
    vendorsOfFile.set(f, [...(vendorsOfFile.get(f) ?? []), n.id]);
  }
}
for (const [, name] of crateDirs) {
  const short = name.replace(/^bun_/, "").replace(/_sys$/, "");
  const v = vendorByNorm.get(norm(VENDOR_ALIASES[short] ?? short));
  if (v) edge(`crate:${name}`, v, "links");
}
for (const pkgDir of ["packages/bun-usockets", "packages/bun-uws"])
  if (existsSync(join(root, pkgDir))) {
    const n = node(`vendor:${posix.basename(pkgDir)}`, "vendor");
    addPath(n, pkgDir);
    attrs(n).source = "dans l'arbre (packages/)";
    edge("crate:bun_uws_sys", n.id, "links");
  }

// ---------- 4. Surface publique ----------

// 4a. Table de l'objet Bun (BunObject.cpp).
const bunObjectCpp = "src/jsc/bindings/BunObject.cpp";
{
  const t = read(bunObjectCpp);
  const begin = t.indexOf("@begin bunObjectTable");
  const end = t.indexOf("@end", begin);
  if (begin < 0 || end < 0) notes.push(`${bunObjectCpp} : table bunObjectTable introuvable`);
  else {
    const startLine = lineOf(t, begin);
    t.slice(begin, end)
      .split("\n")
      .slice(1)
      .forEach((line, i) => {
        const cols = line.trim().split(/\s+/);
        const [prop, symbol, ...flags] = cols;
        if (!prop || !symbol || prop.startsWith("#") || prop.startsWith("//")) return;
        const n = node(`api:Bun.${prop}`, "api", `Bun.${prop}`);
        addPath(n, `${bunObjectCpp}:${startLine + i + 1}`);
        Object.assign(attrs(n), { bunObject: true, symbol, flags: flags.join(" ") });
        edge(n.id, "module:bun", "member-of");
      });
  }
}

// 4b. Déclarations de types (packages/bun-types).
function stripComments(t: string) {
  return t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
}
function declaredModules(t: string) {
  const out: { spec: string; names: string[]; at: number }[] = [];
  const src = stripComments(t);
  for (const m of src.matchAll(/declare module "([^"]+)"\s*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    let lineStart = i;
    const names = new Set<string>();
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        const q = ch;
        i++;
        while (i < src.length && src[i] !== q) i += src[i] === "\\" ? 2 : 1;
      } else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === "\n") {
        lineStart = i + 1;
        if (depth === 1) {
          const d =
            /^\s*(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:function|const|let|var|class|interface|type|namespace|enum)\s+([A-Za-z_$][\w$]*)/.exec(
              src.slice(lineStart, src.indexOf("\n", lineStart)),
            );
          if (d?.[1]) names.add(d[1]);
        }
      }
      i++;
    }
    out.push({ spec: m[1] ?? "", names: [...names].sort(), at: m.index });
  }
  return out;
}
const typedBun = new Set<string>();
for (const f of files.filter((f) => f.startsWith("packages/bun-types/") && f.endsWith(".d.ts") && !f.includes("/vendor/"))) {
  const t = read(f);
  for (const d of declaredModules(t)) {
    if (d.spec.startsWith("*")) continue;
    const n = node(`module:${d.spec}`, "module", d.spec);
    addPath(n, `${f}:${lineOf(t, d.at)}`);
    const a = attrs(n);
    a.typedExports = [...new Set([...((a.typedExports as string[] | undefined) ?? []), ...d.names])].sort();
    if (d.spec === "bun") for (const x of d.names) typedBun.add(x);
  }
}
for (const n of nodes.values()) if (n.attrs?.bunObject) n.attrs.typed = typedBun.has(n.label.slice(4));

// 4c. Fichiers *.bind.ts (bindgen) : modules Rust, fonctions exportées, symboles C, fonctionnalité.
const bindFiles = files.filter((f) => f.endsWith(".bind.ts"));
const bindByBase = new Map<string, string>();
for (const f of bindFiles) {
  const t = read(f);
  const n = node(`binding:${f}`, "binding", posix.basename(f));
  addPath(n, f);
  n.loc = locOf.get(f) ?? 0;
  bindByBase.set(posix.basename(f), n.id);
  const a = attrs(n);
  const rustPaths = [...new Set([...t.matchAll(/rustPath:\s*"([^"]+)"/g)].map((m) => m[1] ?? ""))].sort();
  if (rustPaths.length) a.rustPaths = rustPaths;
  const exportsByKind: Record<string, string[]> = {};
  for (const m of t.matchAll(/^export const (\w+) = b\.(\w+)/gm)) if (m[1] && m[2]) (exportsByKind[m[2]] ??= []).push(m[1]);
  for (const k of Object.keys(exportsByKind)) exportsByKind[k]?.sort();
  if (Object.keys(exportsByKind).length) a.exports = exportsByKind;
  const cSymbols = [...new Set([...t.matchAll(/export:\s*"([^"]+)"/g)].map((m) => m[1] ?? ""))].sort();
  if (cSymbols.length) a.cSymbols = cSymbols;
  for (const x of Object.values(exportsByKind).flat()) addApi(n, x);
  for (const m of t.matchAll(/feature:\s*"([A-Za-z0-9]+)"/g)) edge(n.id, `feature:${m[1]}`, "uses");
  const own = crateOfFile(f);
  if (own) edge(n.id, `crate:${own}`, "implemented-in");
  for (const rp of rustPaths) {
    const c = rp.split("::")[0];
    if (c && c !== "crate" && crateNames.has(c)) edge(n.id, `crate:${c}`, "implemented-in");
  }
}

// 4d. Modules JS intégrés (src/js) : spécificateur, exports, imports, appels natifs.
const moduleFiles = new Map<string, string>();
const specOf = (f: string): string | undefined => {
  const m = /^src\/js\/(bun|node|internal|thirdparty)\/(.+)\.(ts|js)$/.exec(f);
  if (f === "src/js/internal-for-testing.ts") return "bun:internal-for-testing";
  if (!m) return undefined;
  const [, dir, name = ""] = m;
  if (dir === "bun") return `bun:${name}`;
  if (dir === "node") return `node:${name.replaceAll(".", "/")}`;
  if (dir === "thirdparty") return name;
  return `internal/${name}`;
};
for (const f of files) {
  const s = specOf(f);
  if (s) moduleFiles.set(s, f);
}
const objectKeys = (body: string) => {
  const keys: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") {
      if (depth === 0) {
        const k = /^\s*(?:\.\.\.)?\s*(?:get\s+|set\s+|async\s+)?\[?["']?([A-Za-z_$][\w$]*)/.exec(body.slice(start, i))?.[1];
        if (k) keys.push(k);
        break;
      }
      depth--;
    } else if (ch === "," && depth === 0) {
      const k = /^\s*(?:get\s+|set\s+|async\s+)?["']?([A-Za-z_$][\w$]*)/.exec(body.slice(start, i))?.[1];
      if (k) keys.push(k);
      start = i + 1;
    }
  }
  return [...new Set(keys)].sort();
};
for (const [spec, f] of [...moduleFiles].sort()) {
  const raw = read(f);
  const t = stripComments(raw);
  const n = node(`module:${spec}`, "module", spec);
  addPath(n, f);
  n.loc = locOf.get(f) ?? 0;
  const a = attrs(n);
  if (spec.startsWith("internal/")) a.internal = true;
  let exp: string[] = [];
  const def = /export default (\{|([A-Za-z_$][\w$]*)\s*;)/.exec(t);
  if (def?.[1] === "{") exp = objectKeys(t.slice(def.index + def[0].length));
  else if (def?.[2]) {
    const decl = new RegExp(`(?:const|let|var) ${def[2]}\\s*(?::[^=]+)?=\\s*\\{`).exec(t);
    if (decl) exp = objectKeys(t.slice(decl.index + decl[0].length));
  }
  for (const m of t.matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)) if (m[1]) exp.push(m[1]);
  for (const x of [...new Set(exp)].sort()) addApi(n, x);
  for (const m of t.matchAll(/(?:require\(|from\s+|import\()\s*["']([^"']+)["']/g)) {
    const target = m[1] ?? "";
    const s = moduleFiles.has(target) ? target : moduleFiles.has(`node:${target}`) ? `node:${target}` : undefined;
    if (s) edge(n.id, `module:${s}`, "imports");
  }
  for (const m of t.matchAll(/\$(bindgen|newCppFunction|newRustFunction|newZigFunction|cpp|rust|zig)\(\s*["']([^"']+)["']/g)) {
    const file = m[2] ?? "";
    const b = bindByBase.get(file);
    if (b) edge(n.id, b, "calls-native");
    else {
      const nn = node(`native:${file}`, "native", file);
      for (const p of filesNamed(file)) addPath(nn, p);
      edge(n.id, nn.id, "calls-native");
    }
  }
}
{
  const builtinsDir = "src/js/builtins";
  const n = node("module:(js builtins)", "module", "src/js/builtins (WebCore JS builtins)");
  addPath(n, builtinsDir);
  n.loc = sumLoc(filesUnder(builtinsDir));
  attrs(n).files = filesUnder(builtinsDir).length;
}

// 4e. Built-ins (étape 2) -> nœuds api/module/natifs et arêtes « uses ».
const isModuleSpec = (p: string) => moduleFiles.has(p) || nodes.has(`module:${p}`);
const topModuleOf = (p: string) => {
  const m = /^((?:bun|node):[^.]+|bun)\.(.+)$/.exec(p);
  return m?.[1] && isModuleSpec(m[1]) ? m[1] : undefined;
};
for (const [p, { uses, from }] of [...builtinUses].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
  let id: string;
  const nat = /^native:([A-Za-z]+):([^#]+)#(.+)$/.exec(p);
  if (nat) {
    const [, kind = "", file = "", symbol = ""] = nat;
    nativeKinds.set(file, kind);
    const b = bindByBase.get(file);
    const n = b ? node(b, "binding") : node(`native:${file}`, "native", file);
    if (!b) for (const f of filesNamed(file)) addPath(n, f);
    addApi(n, symbol);
    attrs(n).nativeCallKind = kind;
    id = n.id;
  } else if (isModuleSpec(p)) id = node(`module:${p}`, "module", p).id;
  else {
    const n = node(`api:${p}`, "api", p);
    id = n.id;
    const mod = topModuleOf(p);
    if (mod) edge(id, `module:${mod}`, "member-of");
    else if (p.startsWith("Bun.")) edge(id, "module:bun", "member-of");
  }
  const n = nodes.get(id);
  if (n) attrs(n).declaredIn = [...new Set([...((n.attrs?.declaredIn as string[] | undefined) ?? []), ...from])].sort();
  for (const u of uses) edge(id, `feature:${u.feature}`, "uses", { conditional: u.conditional });
}

// ---------- 5. C/C++, codegen et build ----------

const cppFiles = files.filter((f) => /\.(cpp|cc|c|h|hpp|mm)$/.test(f) && f.startsWith("src/"));
const cppGroups = new Map<string, string[]>();
for (const f of cppFiles) {
  const dir = posix.dirname(f);
  cppGroups.set(dir, [...(cppGroups.get(dir) ?? []), f]);
}
for (const [dir, fs] of [...cppGroups].sort()) {
  const n = node(`cpp:${dir}`, "cpp", dir);
  addPath(n, dir);
  n.loc = sumLoc(fs);
  attrs(n).files = fs.length;
  const vendored = fs.filter((f) => /\/sqlite3\.[ch]$/.test(f));
  if (vendored.length) {
    attrs(n).vendoredFiles = vendored;
    edge(n.id, "vendor:sqlite", "contains");
  }
}
for (const n of [...nodes.values()].filter((x) => x.kind === "native"))
  for (const p of n.paths ?? []) if (cppGroups.has(posix.dirname(p))) edge(n.id, `cpp:${posix.dirname(p)}`, "in");

const buildFiles = files.filter((f) => /^(scripts\/build|src\/codegen)\/[^/]+\.ts$/.test(f));
const buildSubdirs = new Set(
  files.filter((f) => /^(scripts\/build|src\/codegen)\/[^/]+\/./.test(f)).map((f) => f.split("/").slice(0, 3).join("/")),
);
const buildNodeOf = (f: string) => {
  if (buildFiles.includes(f)) return `build:${f}`;
  const sub = f.split("/").slice(0, 3).join("/");
  return buildSubdirs.has(sub) ? `build:${sub}` : undefined;
};
for (const f of buildFiles) {
  const n = node(`build:${f}`, "build", f);
  addPath(n, f);
  n.loc = locOf.get(f) ?? 0;
  const doc = /^(?:\/\*\*?\s*\n?\s*\*?\s*|\/\/\s*)(.+)/.exec(read(f))?.[1]?.trim();
  if (doc) attrs(n).about = doc.slice(0, 200);
}
for (const d of [...buildSubdirs].sort()) {
  const n = node(`build:${d}`, "build", `${d}/`);
  addPath(n, d);
  n.loc = sumLoc(filesUnder(d));
  attrs(n).files = filesUnder(d).length;
}
for (const f of files.filter((x) => /^(scripts\/build|src\/codegen)\/.+\.ts$/.test(x))) {
  const from = buildNodeOf(f);
  if (!from) continue;
  for (const m of read(f).matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = posix.normalize(posix.join(posix.dirname(f), m[1] ?? ""));
    const to = buildNodeOf(target.endsWith(".ts") ? target : `${target}.ts`);
    if (to) edge(from, to, "imports");
  }
}
for (const ids of vendorsOfFile.values())
  for (const id of ids) if (nodes.has("build:scripts/build/deps")) edge("build:scripts/build/deps", id, "declares");

// ---------- 6. Domaines (regroupement heuristique) ----------

const missing: string[] = [];
const domainOfDir: [string, string][] = [];
const domainFiles = new Map<string, Set<string>>();
for (const d of DOMAINS) {
  const set = new Set<string>();
  for (const dir of d.dirs) {
    if (!existsSync(join(root, dir))) missing.push(`${d.id}: ${dir}`);
    else {
      for (const f of filesUnder(dir)) set.add(f);
      domainOfDir.push([dir, d.id]);
    }
  }
  for (const g of d.files ?? []) {
    const glob = new Bun.Glob(g);
    const hit = files.filter((f) => glob.match(f));
    if (!hit.length && !existsSync(join(root, g))) missing.push(`${d.id}: ${g}`);
    for (const f of hit) set.add(f);
    if (!hit.length && existsSync(join(root, g))) set.add(g);
  }
  domainFiles.set(d.id, set);
}
domainOfDir.sort((a, b) => b[0].length - a[0].length);
const domainOf = (f: string) =>
  domainOfDir.find(([d]) => f === d || f.startsWith(`${d}/`))?.[1] ?? DOMAINS.find((d) => domainFiles.get(d.id)?.has(f))?.id;
const crateDir = new Map([...crateByDir].map(([d, c]) => [c, d]));
for (const d of DOMAINS) {
  const n = node(`domain:${d.id}`, "domain", d.label);
  const fs = domainFiles.get(d.id) ?? new Set<string>();
  for (const p of [...d.dirs, ...(d.files ?? [])]) if (!missing.includes(`${d.id}: ${p}`)) addPath(n, p);
  n.loc = sumLoc(fs);
  const a = attrs(n);
  a.files = fs.size;
  const langs: Record<string, number> = {};
  for (const f of fs) {
    const ext = /\.([a-z]+)$/.exec(f)?.[1];
    if (ext && locOf.has(f)) langs[ext] = (langs[ext] ?? 0) + (locOf.get(f) ?? 0);
  }
  a.locByExt = langs;
  const vendored = sumLoc([...fs].filter((f) => /\/sqlite3\.[ch]$/.test(f)));
  if (vendored) a.vendoredLoc = vendored;
  for (const [dir, c] of crateByDir) if (domainOf(dir) === d.id) edge(n.id, `crate:${c}`, "contains");
  const hosts = new Set<string>();
  for (const dir of d.dirs) {
    const host = crateOfFile(`${dir}/x`);
    if (host && crateDir.get(host) !== dir && domainOf(crateDir.get(host) ?? "") !== d.id) hosts.add(host);
  }
  for (const f of d.files ?? []) {
    const host = crateOfFile(f);
    if (host && domainOf(crateDir.get(host) ?? "") !== d.id) hosts.add(host);
  }
  for (const h of hosts) edge(n.id, `crate:${h}`, "part-of");
  for (const f of d.features) {
    if (!nodes.has(`feature:${f}`)) missing.push(`${d.id}: fonctionnalité ${f}`);
    else edge(n.id, `feature:${f}`, "implements");
  }
  for (const x of nodes.values()) {
    if (x.kind === "binding" || x.kind === "cpp" || x.kind === "module" || x.kind === "build" || x.kind === "native") {
      const p = x.paths?.[0]?.replace(/:\d+$/, "");
      if (p && domainOf(p) === d.id) edge(n.id, x.id, "contains");
    }
    if (
      (x.kind === "api" || x.kind === "module") &&
      d.apis.some(
        (pre) =>
          x.label === pre ||
          x.label.startsWith(`${pre}.`) ||
          (pre.endsWith(":") && x.label.startsWith(pre)) ||
          (pre.startsWith("%") && x.label.startsWith(pre)),
      )
    )
      edge(n.id, x.id, "exposes");
  }
}
// Arêtes domaine -> domaine : dépendances Cargo des crates contenues + références `bun_x::` / `crate::m` du code Rust.
for (const d of DOMAINS) {
  const from = `domain:${d.id}`;
  for (const f of domainFiles.get(d.id) ?? []) {
    if (!f.endsWith(".rs")) continue;
    const t = read(f);
    const host = crateOfFile(f);
    const hostDir = host ? crateDir.get(host) : undefined;
    const seen = new Set<string>();
    for (const m of t.matchAll(/\b(bun_[a-z0-9_]+)::/g)) {
      const c = m[1] ?? "";
      if (!crateNames.has(c) || c === host || seen.has(`c:${c}`)) continue;
      seen.add(`c:${c}`);
      edge(from, `crate:${c}`, "references", { count: true });
      const td = domainOf(crateDir.get(c) ?? "");
      if (td && td !== d.id && !seen.has(`d:${td}`)) {
        seen.add(`d:${td}`);
        edge(from, `domain:${td}`, "depends", { count: true });
      }
    }
    if (hostDir)
      for (const m of t.matchAll(/\bcrate::([a-z0-9_]+)/g)) {
        const mod = m[1] ?? "";
        const td = domainOf(`${hostDir}/${mod}`) ?? domainOf(`${hostDir}/${mod}.rs`);
        if (td && td !== d.id && !seen.has(`d:${td}`)) {
          seen.add(`d:${td}`);
          edge(from, `domain:${td}`, "depends", { count: true });
        }
      }
  }
}
for (const e of [...edges.values()].filter((x) => x.kind === "depends" && x.from.startsWith("crate:"))) {
  const a = domainOf(crateDir.get(e.from.slice(6)) ?? "");
  const b = domainOf(crateDir.get(e.to.slice(6)) ?? "");
  if (a && b && a !== b) edge(`domain:${a}`, `domain:${b}`, "depends", { count: true });
}
const webgpu = node("domain:webgpu", "domain", "WebGPU");
Object.assign(attrs(webgpu), {
  absent: webgpuHits.length === 0,
  searched: String(WEBGPU_TERMS),
  hits: webgpuLines.slice(0, 20),
  hitCount: webgpuHits.length,
});

// Fonctionnalités référencées mais non déclarées dans le modèle trim.
const undeclared = [...edges.values()].filter((e) => e.to.startsWith("feature:") && !nodes.has(e.to)).map((e) => e.to);
for (const id of new Set(undeclared)) attrs(node(id, "feature")).undeclared = true;
const dangling = [...edges.values()].filter((e) => !nodes.has(e.to) || !nodes.has(e.from));
for (const e of dangling) edges.delete(`${e.from}\u0000${e.kind}\u0000${e.to}`);
if (dangling.length)
  notes.push(
    `${dangling.length} arête(s) vers un nœud inconnu retirée(s) : ${[...new Set(dangling.map((e) => e.to))].slice(0, 8).join(", ")}`,
  );
if (missing.length) notes.push(`chemins/fonctionnalités de la table DOMAINS introuvables : ${missing.join(" ; ")}`);

// ---------- Sortie ----------

const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  return v;
};
const nodeList = [...nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
for (const n of nodeList) {
  n.paths?.sort();
  n.api?.sort();
}
const edgeList = [...edges.values()].sort((a, b) => (a.from + a.kind + a.to < b.from + b.kind + b.to ? -1 : 1));
const count = <T>(xs: T[], key: (x: T) => string) => {
  const r: Record<string, number> = {};
  for (const x of xs) r[key(x)] = (r[key(x)] ?? 0) + 1;
  return r;
};
const generatedAt = new Date().toISOString().slice(0, 10);
const graph = {
  schema: "nt/bun-feature-graph@1",
  source: {
    repository: "oven-sh/bun (fork aphrody-labs/bun)",
    commit,
    commitDate,
    version: pkg.version ?? "",
    generatedAt,
    generator: "sdk/tools/bun-graph.ts",
  },
  counts: { nodes: count(nodeList, (n) => n.kind), edges: count(edgeList, (e) => e.kind) },
  notes,
  nodes: nodeList,
  edges: edgeList,
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "feature-graph.json"), `${JSON.stringify(sortKeys(graph), null, 1)}\n`);

// ---------- Markdown ----------

const md: string[] = [];
const esc = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
const out = (from: string, kind: string) => edgeList.filter((e) => e.from === from && e.kind === kind).map((e) => e.to);
const short = (id: string) => id.slice(id.indexOf(":") + 1);
const list = (xs: string[], max: number) => (xs.length > max ? `${xs.slice(0, max).join(", ")} … (+${xs.length - max})` : xs.join(", "));
md.push("# Graphe des fonctionnalités de bun (amont)");
md.push("");
md.push(
  `Généré par \`sdk/tools/bun-graph.ts\` le ${generatedAt} depuis bun ${pkg.version ?? "?"} @ \`${commit.slice(0, 12)}\` (${commitDate}). Ne pas éditer : \`bun sdk/tools/bun-graph.ts <racine-bun>\`. Données complètes : [feature-graph.json](feature-graph.json).`,
);
md.push("");
md.push("## Comptes");
md.push("");
md.push("| Nœuds | n | | Arêtes | n |");
md.push("|---|---|---|---|---|");
const nk = Object.entries(graph.counts.nodes).sort();
const ek = Object.entries(graph.counts.edges).sort();
for (let i = 0; i < Math.max(nk.length, ek.length); i++)
  md.push(`| ${nk[i]?.[0] ?? ""} | ${nk[i]?.[1] ?? ""} | | ${ek[i]?.[0] ?? ""} | ${ek[i]?.[1] ?? ""} |`);
md.push("");
md.push(
  "Sources : modèle trim `src/trim/features/*.def` (fonctionnalités, trim-features) ; `src/codegen/builtins/host/features-*.builtins.ts` (built-in -> fonctionnalité) ; `Cargo.toml` (crates, dépendances `path`) ; `scripts/build/deps/*.ts` (vendeurs, `fetchDeps`) ; `src/jsc/bindings/BunObject.cpp` (`bunObjectTable`) ; `packages/bun-types/*.d.ts` ; `src/js/**` (modules, `require`, `$bindgen`/`$newCppFunction`) ; `*.bind.ts` (bindgen) ; C/C++ par répertoire ; imports relatifs de `scripts/build` et `src/codegen`.",
);
md.push("");
md.push("## Domaines");
md.push("");
const locText = (n: GNode | undefined) => {
  const by = Object.entries((n?.attrs?.locByExt as Record<string, number> | undefined) ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const v = Number(n?.attrs?.vendoredLoc ?? 0);
  return `${n?.loc ?? 0} (${by.map(([e, k]) => `${e} ${k}`).join(", ")}${v ? `; dont ${v} vendu` : ""})`;
};
md.push("| Domaine | Chemins | LOC | Crates | API exposées (extrait) | Fonctionnalités trim |");
md.push("|---|---|---|---|---|---|");
for (const d of DOMAINS) {
  const id = `domain:${d.id}`;
  const n = nodes.get(id);
  const crates = [...out(id, "contains").filter((x) => x.startsWith("crate:")), ...out(id, "part-of").map((x) => `${x} (hôte)`)].map(short);
  const apis = out(id, "exposes").map(short);
  md.push(
    `| **${esc(d.label)}** (\`${d.id}\`) | ${esc(
      list(
        (n?.paths ?? []).map((p) => `\`${p}\``),
        4,
      ),
    )} | ${locText(n)} | ${esc(list(crates, 6))} | ${esc(list(apis, 8))} | ${out(id, "implements").map(short).join(", ")} |`,
  );
}
md.push("| **WebGPU** (`webgpu`) | — | 0 | — | — | voir ci-dessous |");
md.push("");
md.push(
  `WebGPU : recherche de \`${String(WEBGPU_TERMS)}\` dans src/, scripts/build et packages/bun-types (.rs .cpp .h .c .mm .ts .js) : ${webgpuHits.length} fichier(s).`,
);
for (const l of webgpuLines) md.push(`- \`${esc(l)}\``);
md.push("");
md.push("## Dépendances entre domaines");
md.push("");
md.push(
  "Poids = nombre de fichiers Rust du domaine source qui nomment une crate (`bun_x::`) ou un module (`crate::m`) du domaine cible, plus les dépendances Cargo entre crates. Les 60 plus fortes :",
);
md.push("");
md.push("```mermaid");
md.push("flowchart LR");
for (const d of DOMAINS) md.push(`  ${d.id.replaceAll("-", "_")}["${d.label.replaceAll('"', "'")}"]`);
for (const e of edgeList
  .filter((x) => x.kind === "depends" && x.from.startsWith("domain:"))
  .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1) || (a.from + a.to < b.from + b.to ? -1 : 1))
  .slice(0, 60))
  md.push(`  ${short(e.from).replaceAll("-", "_")} -->|${e.weight ?? 1}| ${short(e.to).replaceAll("-", "_")}`);
md.push("```");
md.push("");
md.push("## Interop native (bun:ffi, Node-API)");
md.push("");
for (const f of ["Ffi", "NativeAddons"]) {
  const fid = `feature:${f}`;
  const fn = nodes.get(fid);
  const users = edgeList.filter((e) => e.to === fid && e.kind === "uses").map((e) => `${short(e.from)}${e.conditional ? " (cond.)" : ""}`);
  const trims = edgeList.filter((e) => e.to === fid && e.kind === "includes").map((e) => short(e.from));
  md.push(
    `- **${f}** — ${esc(String(fn?.attrs?.text ?? ""))} (${(fn?.paths ?? []).join(", ")}) ; trim-features : ${trims.join(", ")} ; utilisé par : ${esc(list(users, 30))}`,
  );
}
for (const id of [
  "binding:src/runtime/ffi/ffi.bind.ts",
  "binding:src/runtime/ffi/FFIObject.bind.ts",
  "binding:src/runtime/napi/napi_body.bind.ts",
  "module:bun:ffi",
]) {
  const n = nodes.get(id);
  if (!n) continue;
  const syms = (n.attrs?.cSymbols as string[] | undefined) ?? [];
  md.push(`- \`${short(id)}\` : ${esc(list(n.api ?? [], 40))}${syms.length ? ` ; symboles C : ${esc(list(syms, 20))}` : ""}`);
}
const featureUsers = (f: string) => [...new Set(edgeList.filter((e) => e.kind === "uses" && e.to === `feature:${f}`).map((e) => e.from))];
const nativeDeps = edgeList.filter((e) => e.kind === "uses" && featureUsers("Ffi").includes(e.from)).map((e) => short(e.to));
md.push(`- Fonctionnalités tirées par les API FFI : ${[...new Set(nativeDeps)].sort().join(", ")}`);
md.push("");
md.push("## Trim-features (src/trim/features/trim-features.def)");
md.push("");
md.push("| Trim-feature | Fonctionnalités | Économie Linux / macOS (Mo) | Description |");
md.push("|---|---|---|---|");
for (const t of nodeList.filter((n) => n.kind === "trim-feature")) {
  const s = t.attrs?.savesMB as { linux: number; macos: number } | undefined;
  const about = String(t.attrs?.about ?? "");
  md.push(
    `| \`${t.label}\` | ${out(t.id, "includes").map(short).join(", ")} | ${s ? `${s.linux} / ${s.macos}` : "—"} | ${esc(about.length > 160 ? `${about.slice(0, 157)}…` : about)} |`,
  );
}
md.push("");
md.push(`## Propriétés de l'objet Bun (${bunObjectCpp})`);
md.push("");
md.push("| Propriété | Symbole C++ | Typée (bun-types) | Fonctionnalités (built-ins) |");
md.push("|---|---|---|---|");
for (const n of nodeList.filter((x) => x.attrs?.bunObject))
  md.push(
    `| \`${n.label}\` | \`${String(n.attrs?.symbol)}\` | ${n.attrs?.typed ? "oui" : "non"} | ${out(n.id, "uses").map(short).join(", ")} |`,
  );
md.push("");
md.push("## Heuristiques de regroupement");
md.push("");
md.push("Seules données écrites à la main dans le script ; tout le reste est lu dans l'arbre.");
md.push("");
md.push(
  "- `DOMAINS` : chaque domaine = répertoires + motifs de fichiers (vérifiés à l'exécution), noms de fonctionnalités trim (vérifiés contre le modèle) et préfixes d'API rattachés. Une crate appartient au domaine dont un répertoire contient son `Cargo.toml` (le plus long préfixe gagne) ; un domaine logé dans une crate plus large (ex. `src/runtime/ffi` dans `bun_runtime`) la reçoit en `part-of`.",
);
md.push(
  `- \`VENDOR_ALIASES\` : ${Object.entries(VENDOR_ALIASES)
    .map(([k, v]) => `\`${k}\` -> \`${v}\``)
    .join(
      ", ",
    )} ; sinon crate \`bun_<x>[_sys]\` <-> dépendance \`<x>\` par nom normalisé. \`packages/bun-usockets\` et \`packages/bun-uws\` rattachés à \`bun_uws_sys\`.`,
);
md.push(
  "- Spécificateurs de modules : `src/js/bun/x.ts` -> `bun:x`, `src/js/node/a.b.ts` -> `node:a/b`, `src/js/internal/**` -> `internal/**`, `src/js/thirdparty/x.ts` -> `x`.",
);
md.push(`- \`WEBGPU_TERMS\` : \`${String(WEBGPU_TERMS)}\` (recherche d'absence du domaine WebGPU).`);
md.push(
  "- LOC : lignes des fichiers .rs .cpp .cc .c .h .hpp .mm .ts .tsx .js .mjs .cjs .toml .idl .def (fixtures de tests comprises) ; `sqlite3.[ch]` comptés comme vendus.",
);
md.push(
  "- Built-ins : `b.extend(chemin, { usesFeature })` capté via une cale de `bun-builtins-table` (bibliothèque du moteur WebKit absente) ; `pathOfNativeBinding(kind, fichier, symbole)` rendu `native:<kind>:<fichier>#<symbole>`, rattaché au `.bind.ts` ou au fichier C++ du même nom.",
);
md.push("");
md.push("## Remarques de génération");
md.push("");
md.push(notes.length ? notes.map((x) => `- ${x}`).join("\n") : "- aucune");
md.push("");
writeFileSync(join(outDir, "feature-graph.md"), md.join("\n"));
console.log(`${nodeList.length} nœuds, ${edgeList.length} arêtes -> ${outDir}`);
console.log(JSON.stringify(graph.counts));
for (const x of notes) console.log(`note : ${x}`);
