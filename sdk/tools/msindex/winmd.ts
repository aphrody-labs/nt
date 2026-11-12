// Lecture générique d'un fichier de métadonnées ECMA-335 (winmd WinRT, Windows.Win32.winmd, assemblage de référence .NET)
// vers le graphe : espace de noms > type > membre, signatures, attributs WinRT/Win32, documentation XML voisine.
// Fonctions Win32 : table ImplMap (DLL et point d'entrée), relevées pour la preuve par le chargeur.
import {
  type Assembly,
  E,
  readAssembly,
  readFieldSig,
  readMethodSig,
  Reader,
  readType,
  type Ref,
  type Sig,
  T,
} from "../dotnet-ffi/ecma335.ts";
import type { Data, Graph } from "./graph.ts";

export type Import = { node: number; dll: string; entry: string };
export type WinmdResult = { asm: Assembly; types: Map<string, number>; imports: Import[]; members: number; documented: number };

/** Documentation XML (fichier .xml voisin) : « T:/M:/P:/E:/F:nom » (paramètres retirés) -> résumé. */
export async function readDocs(file: string): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const f = Bun.file(file.replace(/\.(winmd|dll)$/i, ".xml"));
  if (!(await f.exists())) return m;
  for (const x of (await f.text()).matchAll(/<member name="([^"]+)">([\s\S]*?)<\/member>/g)) {
    const key = x[1]!.replace(/\(.*$/, "");
    const s = /<summary>([\s\S]*?)<\/summary>/.exec(x[2]!)?.[1];
    if (s && !m.has(key))
      m.set(
        key,
        s
          .replace(/<see (?:c|lang)ref="(?:\w:)?([^"]+)"\s*\/>/g, "$1")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
  }
  return m;
}

const PRIM: Record<number, string> = {
  [E.VOID]: "void",
  [E.BOOLEAN]: "Boolean",
  [E.CHAR]: "Char",
  [E.I1]: "SByte",
  [E.U1]: "Byte",
  [E.I2]: "Int16",
  [E.U2]: "UInt16",
  [E.I4]: "Int32",
  [E.U4]: "UInt32",
  [E.I8]: "Int64",
  [E.U8]: "UInt64",
  [E.R4]: "Single",
  [E.R8]: "Double",
  [E.STRING]: "String",
  [E.OBJECT]: "Object",
  [E.I]: "IntPtr",
  [E.U]: "UIntPtr",
};
export const sigText = (a: Assembly, s: Sig, gp: string[] = []): string => {
  switch (s.k) {
    case "prim":
      return PRIM[s.e] ?? `e${s.e}`;
    case "ptr":
      return `${sigText(a, s.to, gp)}*`;
    case "byref":
      return `ref ${sigText(a, s.to, gp)}`;
    case "valuetype":
    case "class":
      return a.typeName(s.ref);
    case "szarray":
      return `${sigText(a, s.of, gp)}[]`;
    case "array":
      return `${sigText(a, s.of, gp)}[${",".repeat(s.rank - 1)}]`;
    case "generic":
      return `${sigText(a, s.base, gp).replace(/`\d+$/, "")}<${s.args.map((x) => sigText(a, x, gp)).join(", ")}>`;
    case "var":
      return gp[s.n] ?? `T${s.n}`;
    case "mvar":
      return `M${s.n}`;
    case "fnptr":
      return "fnptr";
    default:
      return "?";
  }
};

const attrData = (a: Assembly, ref: Ref): Data => {
  const out: Data = {};
  for (const at of a.attributes(ref)) {
    const n = at.type.slice(at.type.lastIndexOf(".") + 1).replace(/Attribute$/, "");
    const v = at.fixed;
    if (n === "Contract") out.contract = `${v[0]} v${Number(v[1]) >>> 16}`;
    else if (n === "ContractVersion" && v.length) out.contractVersion = v.map(String).join(" ");
    else if (n === "Experimental") out.experimental = true;
    else if (n === "Deprecated" || n === "Obsolete") out.deprecated = String(v[0] ?? true);
    else if (n === "Activatable") out.activatable = Number(out.activatable ?? 0) + 1;
    else if (n === "Static") out.statics = [...((out.statics as string[]) ?? []), String(v[0])];
    else if (n === "Composable") out.composable = true;
    else if (n === "ExclusiveTo") out.exclusiveTo = String(v[0]);
    else if (n === "Threading") out.threading = v[0];
    else if (n === "MarshalingBehavior") out.marshaling = v[0];
    else if (n === "SupportedOSPlatform") out.platform = String(v[0]);
    else if (n === "SupportedArchitecture") out.arch = v[0];
    else if (n === "NativeTypedef") out.typedef = true;
    else if (n === "RAIIFree") out.free = String(v[0]);
    else if (n === "Documentation") out.docUrl = String(v[0]);
    else if (n === "Ansi" || n === "Unicode") out.charset = n;
    else if (n === "SetLastError") out.setLastError = true;
  }
  return out;
};

const kindOf = (a: Assembly, td: number) => {
  if (a.md.raw(T.TypeDef, td, "Flags") & 0x20) return "interface";
  const base = a.baseName(td);
  if (base === "System.Enum") return "enum";
  if (base === "System.ValueType") return "struct";
  if (base === "System.MulticastDelegate") return "delegate";
  if (base === "System.Attribute") return "attribute";
  if (a.attributes({ table: T.TypeDef, row: td }).some((x) => x.type.endsWith(".ApiContractAttribute"))) return "contract";
  return "class";
};

/** Indexe un fichier de métadonnées sous `parent`. `publicOnly` : types et membres non publics ignorés (assemblages .NET). */
export async function indexWinmd(g: Graph, parent: number, file: string, publicOnly = false): Promise<WinmdResult> {
  const a = readAssembly(await Bun.file(file).arrayBuffer());
  const doc = await readDocs(file);
  const md = a.md;
  const types = new Map<string, number>();
  const imports: Import[] = [];
  let members = 0;
  let documented = 0;

  // Tables d'association précalculées (une passe chacune).
  const genericParams = new Map<number, string[]>();
  for (let i = 1; i <= md.rows(T.GenericParam); i++) {
    const o = md.ref(T.GenericParam, i, "Owner");
    if (o.table !== T.TypeDef) continue;
    const list = genericParams.get(o.row) ?? genericParams.set(o.row, []).get(o.row)!;
    list[md.raw(T.GenericParam, i, "Number")] = md.str(T.GenericParam, i, "Name");
  }
  const ifaces = new Map<number, string[]>();
  for (let i = 1; i <= md.rows(T.InterfaceImpl); i++) {
    const c = md.raw(T.InterfaceImpl, i, "Class");
    (ifaces.get(c) ?? ifaces.set(c, []).get(c)!).push(a.typeName(md.ref(T.InterfaceImpl, i, "Interface")));
  }
  const ranges = (map: number, col: string, target: number) => {
    const r = new Map<number, [number, number]>();
    for (let i = 1; i <= md.rows(map); i++) r.set(md.raw(map, i, "Parent"), [md.raw(map, i, col), md.listEnd(map, i, col, target)]);
    return r;
  };
  const props = ranges(T.PropertyMap, "PropertyList", T.Property);
  const events = ranges(T.EventMap, "EventList", T.Event);
  const implMap = new Map<number, { dll: string; entry: string }>();
  for (let i = 1; i <= md.rows(T.ImplMap); i++) {
    const m = md.ref(T.ImplMap, i, "MemberForwarded");
    if (m.table !== T.MethodDef) continue;
    implMap.set(m.row, {
      dll: md.str(T.ModuleRef, md.raw(T.ImplMap, i, "ImportScope"), "Name"),
      entry: md.str(T.ImplMap, i, "ImportName"),
    });
  }

  const nsNode = new Map<string, number>();
  for (let td = 2; td <= md.rows(T.TypeDef); td++) {
    const flags = md.raw(T.TypeDef, td, "Flags");
    const vis = flags & 0x7;
    if (publicOnly && vis !== 1 && vis !== 2) continue; // Public ou NestedPublic
    const full = a.typeName({ table: T.TypeDef, row: td });
    const ns = md.str(T.TypeDef, td, "TypeNamespace") || full.slice(0, Math.max(0, full.lastIndexOf(".")));
    let nn = nsNode.get(ns);
    if (!nn) nsNode.set(ns, (nn = g.add(parent, "namespace", ns, ns)));
    const kind = kindOf(a, td);
    const gp = genericParams.get(td) ?? [];
    const base = a.baseName(td);
    const tdoc = doc.get(`T:${full.replace("+", ".")}`);
    const t = g.add(nn, kind, full.slice(full.lastIndexOf(".") + 1), full, {
      base: kind === "class" && base && base !== "System.Object" ? base : undefined,
      interfaces: ifaces.get(td),
      sealed: kind === "class" ? Boolean(flags & 0x100) || undefined : undefined,
      abstract: kind === "class" ? Boolean(flags & 0x80) || undefined : undefined,
      ...attrData(a, { table: T.TypeDef, row: td }),
      doc: tdoc,
    });
    types.set(full, t);
    if (tdoc) documented++;
    const member = (k: string, name: string, data: Data, ref: Ref, docKey: string) => {
      const d = doc.get(docKey);
      const id = g.add(t, k, name, `${full}.${name}`, { ...data, ...attrData(a, ref), doc: d });
      members++;
      if (d) documented++;
      return id;
    };
    for (let f = md.raw(T.TypeDef, td, "FieldList"); f < md.listEnd(T.TypeDef, td, "FieldList", T.Field); f++) {
      const ff = md.raw(T.Field, f, "Flags");
      const name = md.str(T.Field, f, "Name");
      if (name === "value__" || (publicOnly && (ff & 0x7) !== 6 && (ff & 0x7) !== 4)) continue;
      const ref = { table: T.Field, row: f };
      const c = a.constant(ref);
      const type = sigText(a, readFieldSig(md.blob(T.Field, f, "Signature")), gp);
      member(
        ff & 0x40 && c !== undefined ? "constant" : "field",
        name,
        { type, value: c === undefined ? undefined : String(c) },
        ref,
        `F:${full}.${name}`,
      );
    }
    for (let m = md.raw(T.TypeDef, td, "MethodList"); m < md.listEnd(T.TypeDef, td, "MethodList", T.MethodDef); m++) {
      const mf = md.raw(T.MethodDef, m, "Flags");
      const name = md.str(T.MethodDef, m, "Name");
      if (mf & 0x800 && name !== ".ctor") continue; // accesseurs : couverts par propriétés et événements
      if (publicOnly && (mf & 0x7) !== 6 && (mf & 0x7) !== 4) continue;
      const s = readMethodSig(new Reader(md.blob(T.MethodDef, m, "Signature")));
      const pn: string[] = [];
      for (let p = md.raw(T.MethodDef, m, "ParamList"); p < md.listEnd(T.MethodDef, m, "ParamList", T.Param); p++) {
        const seq = md.raw(T.Param, p, "Sequence");
        if (seq > 0) pn[seq - 1] = md.str(T.Param, p, "Name");
      }
      const sig = `${mf & 0x10 ? "static " : ""}${sigText(a, s.ret, gp)} ${name}(${s.params.map((x, i) => `${sigText(a, x, gp)} ${pn[i] ?? `p${i}`}`).join(", ")})`;
      const im = implMap.get(m);
      const kindM = im ? "function" : name === ".ctor" ? "constructor" : "method";
      const id = member(
        kindM,
        name,
        { sig, dll: im?.dll, entry: im && im.entry !== name ? im.entry : undefined },
        { table: T.MethodDef, row: m },
        `M:${full}.${name === ".ctor" ? "#ctor" : name}`,
      );
      if (im) imports.push({ node: id, dll: im.dll, entry: im.entry || name });
    }
    const [p0, p1] = props.get(td) ?? [0, 0];
    for (let p = p0; p < p1; p++) {
      const name = md.str(T.Property, p, "Name");
      const r = new Reader(md.blob(T.Property, p, "Type"));
      r.u8();
      r.compressed();
      member("property", name, { type: sigText(a, readType(r), gp) }, { table: T.Property, row: p }, `P:${full}.${name}`);
    }
    const [e0, e1] = events.get(td) ?? [0, 0];
    for (let e = e0; e < e1; e++) {
      const name = md.str(T.Event, e, "Name");
      member("event", name, { type: a.typeName(md.ref(T.Event, e, "EventType")) }, { table: T.Event, row: e }, `E:${full}.${name}`);
    }
  }
  return { asm: a, types, imports, members, documented };
}

/** Types exposés par un assemblage d'implémentation : TypeDef publics et redirections ExportedType (type forwarding). */
export function exposedTypes(a: Assembly): Map<string, string> {
  const md = a.md;
  const out = new Map<string, string>();
  for (let td = 2; td <= md.rows(T.TypeDef); td++) {
    const vis = md.raw(T.TypeDef, td, "Flags") & 0x7;
    if (vis === 1 || vis === 2) out.set(a.typeName({ table: T.TypeDef, row: td }), "typedef");
  }
  for (let i = 1; i <= md.rows(T.ExportedType); i++) {
    const ns = md.str(T.ExportedType, i, "TypeNamespace");
    const n = md.str(T.ExportedType, i, "TypeName");
    const impl = md.ref(T.ExportedType, i, "Implementation");
    const target = impl.table === T.AssemblyRef ? md.str(T.AssemblyRef, impl.row, "Name") : "";
    if (ns) out.set(`${ns}.${n}`, `forward:${target}`);
  }
  return out;
}
