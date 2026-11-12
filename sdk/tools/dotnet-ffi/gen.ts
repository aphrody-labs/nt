// Liaisons bun:ffi typées depuis un assemblage IL .NET : lit les métadonnées ECMA-335 (ecma335.ts), aucun .NET requis,
// aucune dépendance à node-api-dotnet. Deux chemins d'appel pour la même API :
//   openNative()   dlopen du binaire NativeAOT, symboles = [UnmanagedCallersOnly(EntryPoint = "...")]
//   bindPointers() pointeurs fournis par l'appelant (hôte CoreCLR via hostfxr : voir hostfxr.ts)
// Usage : bun sdk/tools/dotnet-ffi/gen.ts <assemblage-IL.dll> [--out <dossier>] [--native <binaire NativeAOT>]
//   écrit <dossier>/<Assemblage>.js (ESM, n'importe que bun:ffi), <Assemblage>.d.ts et <Assemblage>.model.json.
//   --native : vérifie chaque EntryPoint dans la table d'exports PE (Windows) ; ELF/Mach-O : vérifié au dlopen.
import { statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { exportsOf, parsePe } from "../host/pe.ts";
import { readAssembly } from "./ecma335.ts";
import { buildModel, type Export, type Ffi, type FnSig, type Model, type Param, type Struct, type Ty } from "./model.ts";

const RESERVED = new Set(
  "arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(
    " ",
  ),
);
const ident = (s: string) => {
  const c = s.replace(/[^A-Za-z0-9_$]/g, "_");
  return RESERVED.has(c) || /^\d/.test(c) ? `${c}_` : c;
};
const camel = (s: string) => ident(s.charAt(0).toLowerCase() + s.slice(1));
const q = (s: string) => JSON.stringify(s);

const ffiOf = (t: Ty, p?: Param): Ffi => {
  if (t.k === "prim" || t.k === "enum") return t.ffi;
  if (t.k === "fn") return "function";
  if (t.k === "ptr" && p?.marker === "Utf8") return "cstring";
  return "ptr";
};

const tsNum = (f: Ffi, arg: boolean) =>
  f === "bool" ? "boolean" : f === "void" ? "void" : f === "i64" || f === "u64" ? (arg ? "number | bigint" : "bigint") : "number";

function tsArg(t: Ty, p?: Param): string {
  if (t.k === "prim") return tsNum(t.ffi, true);
  if (t.k === "enum") return `${t.name} | number`;
  if (t.k === "fn") return `JSCallback | ((${t.sig.params.map((x, i) => `a${i}: ${tsRet(x)}`).join(", ")}) => ${tsArg(t.sig.ret)})`;
  if (p?.marker === "Utf8") return "string | NodeJS.TypedArray | Pointer | null";
  if (p?.marker === "Utf16") return "string";
  if (t.k === "struct") return t.name;
  return `${t.to ? `${t.to} | ` : ""}NodeJS.TypedArray | Pointer | bigint | null`;
}

function tsRet(t: Ty): string {
  if (t.k === "prim") return tsNum(t.ffi, false);
  if (t.k === "enum") return t.name;
  return "Pointer | bigint | null";
}

const defOf = (s: FnSig) => `{ args: [${s.params.map((x) => q(ffiOf(x))).join(", ")}], returns: ${q(ffiOf(s.ret))} }`;

/** Paramètres visibles côté JS : un tampon [Utf*Buffer] et sa capacité deviennent la valeur de retour. */
function visible(x: Export) {
  const hidden = new Set<number>();
  x.params.forEach((p, i) => {
    if (p.marker?.endsWith("Buffer")) hidden.add(i).add(i + 1);
  });
  return x.params.map((p, i) => ({ p, i, name: camel(p.name) })).filter(({ i }) => !hidden.has(i));
}

const needsWrapper = (x: Export) => x.params.some((p) => p.marker === "Utf16" || p.marker?.endsWith("Buffer") || p.ty.k === "fn");

function wrapper(x: Export): string {
  const buf = x.params.findIndex((p) => p.marker?.endsWith("Buffer"));
  const vis = visible(x);
  const args = x.params.map((p, i) => {
    if (i === buf) return "buf";
    if (buf >= 0 && i === buf + 1) return "cap";
    const n = camel(p.name);
    if (p.marker === "Utf16") return `utf16z(${n})`;
    if (p.ty.k === "fn") return `cb${i} ?? ${n}`;
    return n;
  });
  const cbs = x.params.flatMap((p, i) =>
    p.ty.k === "fn"
      ? [`const cb${i} = typeof ${camel(p.name)} === "function" ? new JSCallback(${camel(p.name)}, ${defOf(p.ty.sig)}) : null;`]
      : [],
  );
  const call = `raw.${x.js}(${args.join(", ")})`;
  let body: string;
  if (buf >= 0) {
    const wide = x.params[buf]!.marker === "Utf16Buffer";
    body = [
      "let cap = 256;",
      "for (;;) {",
      `  const buf = new ${wide ? "Uint16Array" : "Uint8Array"}(cap);`,
      `  const n = ${call};`,
      `  if (n < 0) throw new Error(${q(`${x.entryPoint ?? x.method} : code `)} + n);`,
      `  if (n < cap) return ${wide ? "u16" : "u8"}.decode(buf.subarray(0, n));`,
      "  cap = n + 1;",
      "}",
    ].join("\n      ");
  } else body = `return ${call};`;
  if (cbs.length) {
    const closes = x.params.flatMap((p, i) => (p.ty.k === "fn" ? [`cb${i}?.close();`] : [])).join(" ");
    body = `${cbs.join("\n      ")}\n      try {\n        ${body.replaceAll("\n      ", "\n        ")}\n      } finally {\n        ${closes}\n      }`;
  }
  return `function ${x.js}(${vis.map((v) => v.name).join(", ")}) {\n      ${body}\n    }`;
}

const getter: Record<string, [string, string]> = {
  i8: ["getInt8", ""],
  u8: ["getUint8", ""],
  bool: ["getUint8", " !== 0"],
  i16: ["getInt16", ", true"],
  u16: ["getUint16", ", true"],
  i32: ["getInt32", ", true"],
  u32: ["getUint32", ", true"],
  i64: ["getBigInt64", ", true"],
  u64: ["getBigUint64", ", true"],
  f32: ["getFloat32", ", true"],
  f64: ["getFloat64", ", true"],
};

function structJs(s: Struct): string {
  const lines = [
    `/** ${s.full} : ${s.size} octets, alignement ${s.align} (disposition calculée depuis ClassLayout/FieldLayout). */`,
    `export class ${s.name} {`,
    `  static size = ${s.size};`,
    `  static align = ${s.align};`,
    `  constructor(bytes = new Uint8Array(${s.size})) {`,
    `    if (bytes.byteLength < ${s.size}) throw new RangeError(${q(`${s.name} : ${s.size} octets requis`)});`,
    "    this.bytes = bytes;",
    "    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);",
    "    this.ptr = ptr(bytes);",
    "  }",
  ];
  const names: string[] = [];
  for (const f of s.fields) {
    let n = camel(f.name.replace(/^<(.+)>.*$/, "$1"));
    if (["bytes", "view", "ptr", "toJSON", "constructor"].includes(n)) n += "_";
    names.push(n);
    const o = f.offset;
    if (f.fixed) {
      const len =
        f.fixed.length *
        (f.fixed.elem === "u16" || f.fixed.elem === "i16" ? 2 : /64/.test(f.fixed.elem) ? 8 : /32/.test(f.fixed.elem) ? 4 : 1);
      if (f.marker === "Utf16" || f.marker === "Utf8") {
        const dec = f.marker === "Utf16" ? "u16" : "u8";
        lines.push(
          `  get ${n}() {`,
          `    const s = ${dec}.decode(this.bytes.subarray(${o}, ${o + len}));`,
          '    const z = s.indexOf("\\0");',
          "    return z < 0 ? s : s.slice(0, z);",
          "  }",
        );
      } else lines.push(`  get ${n}() {`, `    return this.bytes.subarray(${o}, ${o + len});`, "  }");
      continue;
    }
    const t = f.ty;
    if (t.k === "struct") {
      lines.push(`  get ${n}() {`, `    return new ${t.name}(this.bytes.subarray(${o}, ${o} + ${t.name}.size));`, "  }");
      continue;
    }
    if (t.k === "prim" || t.k === "enum") {
      const g = getter[t.ffi];
      if (g) {
        const set = g[0].replace("get", "set");
        const val = t.ffi === "bool" ? "v ? 1 : 0" : "v";
        lines.push(
          `  get ${n}() {`,
          `    return this.view.${g[0]}(${o}${g[1].startsWith(",") ? g[1] : ""})${g[1].startsWith(",") ? "" : g[1]};`,
          "  }",
        );
        lines.push(`  set ${n}(v) {`, `    this.view.${set}(${o}, ${val}${g[1].startsWith(",") ? ", true" : ""});`, "  }");
        continue;
      }
    }
    lines.push(
      `  get ${n}() {`,
      `    return pointerAt(this.view, ${o});`,
      "  }",
      `  set ${n}(v) {`,
      `    this.view.setBigUint64(${o}, BigInt(v ?? 0), true);`,
      "  }",
    );
  }
  lines.push("  toJSON() {", `    return { ${names.map((n) => `${n}: this.${n}`).join(", ")} };`, "  }", "}");
  return lines.join("\n");
}

function structDts(s: Struct): string {
  const out = [
    `/** ${s.full} (${s.size} octets). Passé par pointeur : bun:ffi lit sa propriété \`ptr\`. */`,
    `export declare class ${s.name} {`,
  ];
  out.push(
    "  static readonly size: number;",
    "  static readonly align: number;",
    "  readonly bytes: Uint8Array;",
    "  readonly view: DataView;",
    "  readonly ptr: Pointer;",
  );
  out.push("  constructor(bytes?: Uint8Array);");
  const json: string[] = [];
  for (const f of s.fields) {
    let n = camel(f.name.replace(/^<(.+)>.*$/, "$1"));
    if (["bytes", "view", "ptr", "toJSON", "constructor"].includes(n)) n += "_";
    let t: string;
    let ro = false;
    if (f.fixed) {
      t = f.marker ? "string" : "Uint8Array";
      ro = true;
    } else if (f.ty.k === "struct") {
      t = f.ty.name;
      ro = true;
    } else if (f.ty.k === "prim") t = tsNum(f.ty.ffi, false);
    else if (f.ty.k === "enum") t = f.ty.name;
    else t = "Pointer | bigint | null";
    out.push(`  ${ro ? "readonly " : ""}${n}: ${t};`);
    json.push(`${n}: ${f.ty.k === "struct" && !f.fixed ? `ReturnType<${t}["toJSON"]>` : t}`);
  }
  out.push(`  toJSON(): { ${json.join("; ")} };`, "}");
  return out.join("\n");
}

export function emit(m: Model): { js: string; dts: string } {
  const a = m.assembly;
  const head = [
    "// Généré par sdk/tools/dotnet-ffi/gen.ts depuis les métadonnées ECMA-335 — ne pas modifier.",
    `// Source : ${a.name} ${a.version}, MVID ${a.mvid}, métadonnées ${a.runtime}.`,
  ];
  const native = m.exports.filter((x) => x.entryPoint);
  const lib = `${a.name}`;
  const js: string[] = [
    ...head,
    'import { CFunction, JSCallback, dlopen, ptr, suffix, toArrayBuffer } from "bun:ffi";',
    "",
    `export const assembly = Object.freeze(${JSON.stringify(a)});`,
    "/** Nom du binaire NativeAOT : préfixe lib sous Unix (.NET 11, UseNativeLibPrefix). */",
    `export const nativeLibrary = process.platform === "win32" ? ${q(`${lib}.dll`)} : \`lib${lib}.\${suffix}\`;`,
    "",
    'const u16 = new TextDecoder("utf-16le");',
    "const u8 = new TextDecoder();",
    'const utf16z = (s) => Buffer.from(`${s}\\0`, "utf16le");',
    "const pointerAt = (view, o) => {",
    "  const v = view.getBigUint64(o, true);",
    "  return v === 0n ? null : v <= 9007199254740991n ? Number(v) : v;",
    "};",
    "/** Chaîne UTF-16 de `length` unités à l'adresse `p` (arguments de rappel char*). */",
    'export const readUtf16 = (p, length) => (length ? u16.decode(new Uint8Array(toArrayBuffer(p, 0, length * 2))) : "");',
    "/** Chaîne UTF-8 de `length` octets à l'adresse `p`. */",
    'export const readUtf8 = (p, length) => (length ? u8.decode(new Uint8Array(toArrayBuffer(p, 0, length))) : "");',
    "",
  ];
  for (const e of m.enums) {
    js.push(
      `/** ${e.full} (${e.ffi}). */`,
      `export const ${e.name} = Object.freeze({ ${e.members.map(([k, v]) => `${ident(k)}: ${typeof v === "bigint" ? `${v}n` : v}`).join(", ")} });`,
    );
  }
  for (const s of m.structs) js.push(structJs(s), "");
  js.push(
    "/** Définitions bun:ffi par point d'entrée natif (NativeAOT). */",
    `export const symbols = Object.freeze({\n${native.map((x) => `  ${ident(x.entryPoint!)}: { args: [${x.params.map((p) => q(ffiOf(p.ty, p))).join(", ")}], returns: ${q(ffiOf(x.ret))} },`).join("\n")}\n});`,
    "/** Méthodes [UnmanagedCallersOnly] : type et nom .NET (hôte CoreCLR), point d'entrée natif éventuel, signature bun:ffi. */",
    `export const methods = Object.freeze([\n${m.exports
      .map(
        (x) =>
          `  { js: ${q(x.js)}, type: ${q(x.type)}, method: ${q(x.method)}, entryPoint: ${x.entryPoint ? q(x.entryPoint) : "null"}, overloaded: ${x.overloaded}, args: [${x.params.map((p) => q(ffiOf(p.ty, p))).join(", ")}], returns: ${q(ffiOf(x.ret))} },`,
      )
      .join("\n")}\n]);`,
    "",
    "function wrap(raw) {",
    "  const api = {};",
  );
  for (const x of m.exports)
    js.push(`  if (raw.${x.js}) api.${x.js} = ${needsWrapper(x) ? wrapper(x).replaceAll("\n    ", "\n  ") : `raw.${x.js}`};`);
  js.push(
    "  return Object.freeze(api);",
    "}",
    "",
    "/** dlopen du binaire NativeAOT. Pas de close() : NativeAOT ne prend pas en charge le déchargement (Learn, « Building native libraries »). */",
    "export function openNative(path = nativeLibrary) {",
    "  const lib = dlopen(path, symbols);",
    "  const raw = {};",
    "  for (const m of methods) if (m.entryPoint) raw[m.js] = lib.symbols[m.entryPoint];",
    "  return wrap(raw);",
    "}",
    "",
    "/** Liaison sur des pointeurs natifs fournis par `resolve` (hostfxr : load_assembly_and_get_function_pointer). Surcharges exclues. */",
    "export function bindPointers(resolve) {",
    "  const raw = {};",
    "  for (const m of methods) if (!m.overloaded) raw[m.js] = CFunction({ ptr: resolve(m), args: m.args, returns: m.returns });",
    "  return wrap(raw);",
    "}",
    "",
  );

  const dts: string[] = [
    ...head,
    'import type { JSCallback, Pointer } from "bun:ffi";',
    "",
    "export declare const assembly: { readonly name: string; readonly version: string; readonly mvid: string; readonly runtime: string };",
    "export declare const nativeLibrary: string;",
    "export declare function readUtf16(p: Pointer | number | bigint, length: number): string;",
    "export declare function readUtf8(p: Pointer | number | bigint, length: number): string;",
    "",
  ];
  for (const e of m.enums) {
    dts.push(
      `/** ${e.full}. */`,
      `export declare const ${e.name}: { ${e.members.map(([k, v]) => `readonly ${ident(k)}: ${typeof v === "bigint" ? `${v}n` : v}`).join("; ")} };`,
      `export type ${e.name} = (typeof ${e.name})[keyof typeof ${e.name}];`,
    );
  }
  for (const s of m.structs) dts.push(structDts(s), "");
  dts.push(
    `export declare const symbols: {\n${native.map((x) => `  readonly ${ident(x.entryPoint!)}: { readonly args: readonly [${x.params.map((p) => q(ffiOf(p.ty, p))).join(", ")}]; readonly returns: ${q(ffiOf(x.ret))} };`).join("\n")}\n};`,
    "export type Method = {",
    "  readonly js: string;",
    "  readonly type: string;",
    "  readonly method: string;",
    "  readonly entryPoint: string | null;",
    "  readonly overloaded: boolean;",
    "  readonly args: readonly string[];",
    "  readonly returns: string;",
    "};",
    "export declare const methods: readonly Method[];",
    "",
    "export interface Api {",
  );
  for (const x of m.exports) {
    const buf = x.params.find((p) => p.marker?.endsWith("Buffer"));
    const ret = buf ? "string" : tsRet(x.ret);
    dts.push(
      `  /** ${x.type}.${x.method}${x.entryPoint ? ` — export natif \`${x.entryPoint}\`` : " — hôte CoreCLR uniquement (pas d'EntryPoint)"}${x.callConvs.length ? ` [${x.callConvs.join(", ")}]` : ""}. */`,
      `  ${x.js}(${visible(x)
        .map((v) => `${v.name}: ${tsArg(v.p.ty, v.p)}`)
        .join(", ")}): ${ret};`,
    );
  }
  dts.push(
    "}",
    `export type NativeApi = Pick<Api, ${native.map((x) => q(x.js)).join(" | ") || "never"}>;`,
    "export declare function openNative(path?: string): NativeApi;",
    "export declare function bindPointers(resolve: (m: Method) => Pointer | number | bigint): Api;",
    "",
  );
  return { js: js.join("\n"), dts: dts.join("\n") };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv.splice(i, 2)[1] : undefined;
  };
  const out = opt("--out") ?? join("target", "dotnet-ffi");
  const nativePath = opt("--native");
  const input = argv[0];
  if (!input) {
    console.error("usage : bun sdk/tools/dotnet-ffi/gen.ts <assemblage-IL.dll> [--out <dossier>] [--native <binaire>]");
    process.exit(2);
  }
  const model = buildModel(readAssembly(await Bun.file(input).arrayBuffer()));
  for (const r of model.rejected) console.warn(`ignorée : ${r.method} — ${r.reason}`);
  // --native : fichier, ou dossier de publication contenant <nom>.dll / lib<nom>.so / lib<nom>.dylib.
  let nativeFile = nativePath;
  if (nativePath && statSync(nativePath).isDirectory()) {
    const n = model.assembly.name;
    nativeFile = [`${n}.dll`, `lib${n}.so`, `lib${n}.dylib`]
      .map((f) => join(nativePath, f))
      .find((f) => statSync(f, { throwIfNoEntry: false }));
    if (!nativeFile) throw new Error(`${nativePath} : binaire NativeAOT de ${n} absent`);
  }
  if (nativeFile && !nativeFile.toLowerCase().endsWith(".dll"))
    console.log(`${basename(nativeFile)} : exports vérifiés au dlopen (non-PE)`);
  if (nativeFile && nativeFile.toLowerCase().endsWith(".dll")) {
    const pe = parsePe(await Bun.file(nativeFile).arrayBuffer());
    if (!pe) throw new Error(`${nativeFile} : pas un PE`);
    if (pe.dir(14).rva) throw new Error(`${nativeFile} : assemblage IL, pas un binaire NativeAOT`);
    const have = new Set(exportsOf(pe));
    const missing = model.exports.filter((x) => x.entryPoint && !have.has(x.entryPoint)).map((x) => x.entryPoint);
    if (missing.length) throw new Error(`${basename(nativeFile)} n'exporte pas : ${missing.join(", ")}`);
    console.log(`${basename(nativeFile)} : ${have.size} exports, ${model.exports.filter((x) => x.entryPoint).length} vérifiés`);
  }
  const { js, dts } = emit(model);
  await mkdir(out, { recursive: true });
  await Bun.write(join(out, `${model.assembly.name}.js`), js);
  await Bun.write(join(out, `${model.assembly.name}.d.ts`), dts);
  await Bun.write(
    join(out, `${model.assembly.name}.model.json`),
    `${JSON.stringify(model, (_, v) => (typeof v === "bigint" ? `${v}n` : v), 2)}\n`,
  );
  console.log(
    `${model.assembly.name} ${model.assembly.version} : ${model.exports.length} méthodes (${model.exports.filter((x) => x.entryPoint).length} exports natifs), ${model.structs.length} structures, ${model.enums.length} énumérations -> ${out}`,
  );
}
