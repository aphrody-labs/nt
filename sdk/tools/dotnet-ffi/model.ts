// Modèle d'interop extrait des métadonnées : méthodes [UnmanagedCallersOnly], structures blittables, énumérations.
// Conventions (attributs marqueurs lus par nom simple, sans effet à l'exécution .NET) :
//   [Utf8] byte* / [Utf16] char*            paramètre chaîne d'entrée (JS string)
//   [Utf8Buffer] byte* / [Utf16Buffer] char* suivi d'un int capacité, retour int = longueur -> la liaison renvoie une string
//   [Utf8] / [Utf16] sur un tampon fixe      champ chaîne d'une structure
import { type Assembly, E, type MethodSig, readFieldSig, readMethodSig, Reader, type Ref, type Sig, T } from "./ecma335.ts";

const UCO = "System.Runtime.InteropServices.UnmanagedCallersOnlyAttribute";
const FIXED = "System.Runtime.CompilerServices.FixedBufferAttribute";

/** Type d'interop : primitif bun:ffi, pointeur, rappel, structure (par pointeur) ou énumération. */
export type Ty =
  | { k: "prim"; ffi: Ffi; size: number }
  | { k: "ptr"; to?: string; elem?: Ffi }
  | { k: "fn"; sig: FnSig }
  | { k: "struct"; name: string; full: string }
  | { k: "enum"; name: string; ffi: Ffi; size: number };
export type Ffi =
  "void" | "bool" | "i8" | "u8" | "i16" | "u16" | "i32" | "u32" | "i64" | "u64" | "f32" | "f64" | "ptr" | "cstring" | "function";
export type FnSig = { conv: string; ret: Ty; params: Ty[] };
export type Marker = "Utf8" | "Utf16" | "Utf8Buffer" | "Utf16Buffer";
export type Param = { name: string; ty: Ty; marker?: Marker };
export type Export = {
  js: string;
  type: string;
  method: string;
  entryPoint: string | null;
  callConvs: string[];
  params: Param[];
  ret: Ty;
  overloaded: boolean;
};
export type Field = { name: string; offset: number; ty: Ty; fixed?: { elem: Ffi; length: number }; marker?: Marker };
export type Struct = { name: string; full: string; size: number; align: number; fields: Field[] };
export type Enum = { name: string; full: string; ffi: Ffi; members: [string, number | bigint][] };
export type Model = {
  assembly: { name: string; version: string; mvid: string; runtime: string };
  exports: Export[];
  structs: Struct[];
  enums: Enum[];
  rejected: { method: string; reason: string }[];
};

const PRIM: Record<number, [Ffi, number]> = {
  [E.VOID]: ["void", 0],
  [E.BOOLEAN]: ["bool", 1],
  [E.CHAR]: ["u16", 2],
  [E.I1]: ["i8", 1],
  [E.U1]: ["u8", 1],
  [E.I2]: ["i16", 2],
  [E.U2]: ["u16", 2],
  [E.I4]: ["i32", 4],
  [E.U4]: ["u32", 4],
  [E.I8]: ["i64", 8],
  [E.U8]: ["u64", 8],
  [E.R4]: ["f32", 4],
  [E.R8]: ["f64", 8],
  // nint/nuint : poignées et pointeurs (bun:ffi ne cible que des processus 64 bits : x64, arm64).
  [E.I]: ["ptr", 8],
  [E.U]: ["ptr", 8],
};

const simple = (full: string) => full.slice(Math.max(full.lastIndexOf("."), full.lastIndexOf("+")) + 1);
const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const marker = (types: string[]): Marker | undefined => {
  for (const t of types) {
    const m = /(?:^|[.+])(Utf8|Utf16|Utf8Buffer|Utf16Buffer)Attribute$/.exec(t);
    if (m) return m[1] as Marker;
  }
  return undefined;
};

export function buildModel(asm: Assembly): Model {
  const md = asm.md;
  const structs = new Map<number, Struct>();
  const enums = new Map<number, Enum>();
  const rejected: Model["rejected"] = [];

  const resolveLocal = (ref: Ref): number => {
    if (ref.table === T.TypeDef) return ref.row;
    if (ref.table === T.TypeRef) return asm.findTypeDef(asm.typeName(ref));
    return 0;
  };

  const ty = (s: Sig, where: string): Ty => {
    if (s.k === "prim") {
      const p = PRIM[s.e];
      if (!p) throw new Error(`${where} : type ${s.e === E.STRING ? "string" : `0x${s.e.toString(16)}`} non blittable`);
      return { k: "prim", ffi: p[0], size: p[1] };
    }
    if (s.k === "ptr") {
      const to = s.to;
      if (to.k === "prim") return { k: "ptr", elem: PRIM[to.e]?.[0] };
      if (to.k === "valuetype") {
        const t = ty(to, where);
        if (t.k === "struct") return { k: "ptr", to: t.name };
        if (t.k === "enum") return { k: "ptr", elem: t.ffi };
      }
      return { k: "ptr" };
    }
    if (s.k === "fnptr") return { k: "fn", sig: fnSig(s.sig, `${where} (pointeur de fonction)`) };
    if (s.k === "valuetype") {
      const td = resolveLocal(s.ref);
      const full = asm.typeName(s.ref);
      if (!td) throw new Error(`${where} : structure externe ${full} (définir les structures d'interop dans l'assemblage)`);
      if (asm.baseName(td) === "System.Enum") return enumOf(td);
      const st = structOf(td);
      return { k: "struct", name: st.name, full: st.full };
    }
    throw new Error(`${where} : ${s.k} non blittable (UnmanagedCallersOnly exige des types blittables)`);
  };

  const fnSig = (m: MethodSig, where: string): FnSig => {
    if (m.generic) throw new Error(`${where} : méthode générique`);
    const conv =
      m.conv === 9
        ? m.retMods.map((r) => simple(asm.typeName(r)).replace(/^CallConv/, "")).join("+") || "unmanaged"
        : (["managed", "cdecl", "stdcall", "thiscall", "fastcall", "vararg"][m.conv] ?? `conv${m.conv}`);
    if (m.conv === 5) throw new Error(`${where} : varargs`);
    return { conv, ret: ty(m.ret, `${where} retour`), params: m.params.map((p, i) => ty(p, `${where} paramètre ${i}`)) };
  };

  const enumOf = (td: number): Ty => {
    let en = enums.get(td);
    if (!en) {
      const full = asm.typeName({ table: T.TypeDef, row: td });
      const under = asm.enumUnderlying({ table: T.TypeDef, row: td }) ?? E.I4;
      const members: [string, number | bigint][] = [];
      const f0 = md.raw(T.TypeDef, td, "FieldList");
      const f1 = md.listEnd(T.TypeDef, td, "FieldList", T.Field);
      for (let f = f0; f < f1; f++) {
        if (!(md.raw(T.Field, f, "Flags") & 0x40)) continue; // Literal
        const v = asm.constant({ table: T.Field, row: f });
        if (typeof v === "number" || typeof v === "bigint") members.push([md.str(T.Field, f, "Name"), v]);
      }
      en = { name: simple(full), full, ffi: PRIM[under]?.[0] ?? "i32", members };
      enums.set(td, en);
    }
    const p = PRIM[asm.enumUnderlying({ table: T.TypeDef, row: td }) ?? E.I4] ?? ["i32", 4];
    return { k: "enum", name: en.name, ffi: p[0], size: p[1] };
  };

  /** Disposition (§II.10.1.2, ClassLayout/FieldLayout) : séquentielle (Pack, ClassSize) ou explicite ; 64 bits. */
  const structOf = (td: number): Struct => {
    const cached = structs.get(td);
    if (cached) return cached;
    const full = asm.typeName({ table: T.TypeDef, row: td });
    const flags = md.raw(T.TypeDef, td, "Flags");
    const layoutKind = flags & 0x18; // 0 Auto, 0x08 Sequential, 0x10 Explicit
    if (layoutKind === 0) throw new Error(`${full} : LayoutKind.Auto non blittable`);
    const lay = asm.layout(td);
    const pack = lay?.pack || 8;
    const st: Struct = { name: simple(full).replace(/[<>]/g, "_"), full, size: 0, align: 1, fields: [] };
    structs.set(td, st);
    let end = 0;
    const f0 = md.raw(T.TypeDef, td, "FieldList");
    const f1 = md.listEnd(T.TypeDef, td, "FieldList", T.Field);
    for (let f = f0; f < f1; f++) {
      if (md.raw(T.Field, f, "Flags") & 0x10) continue; // Static
      const name = md.str(T.Field, f, "Name");
      const sig = readFieldSig(md.blob(T.Field, f, "Signature"));
      const attrs = asm.attributes({ table: T.Field, row: f });
      const fixedAttr = attrs.find((a) => a.type === FIXED);
      const t = ty(sig, `${full}.${name}`);
      let size: number;
      let align: number;
      let fixed: Field["fixed"];
      if (t.k === "struct") {
        const inner = [...structs.values()].find((s) => s.full === t.full)!;
        size = inner.size;
        align = inner.align;
        if (fixedAttr) {
          const elemName = String(fixedAttr.fixed[0] ?? "")
            .split(",")[0]!
            .trim();
          const elem = (
            {
              "System.Char": "u16",
              "System.Byte": "u8",
              "System.SByte": "i8",
              "System.Int16": "i16",
              "System.UInt16": "u16",
              "System.Int32": "i32",
              "System.UInt32": "u32",
              "System.Int64": "i64",
              "System.UInt64": "u64",
              "System.Single": "f32",
              "System.Double": "f64",
              "System.Boolean": "u8",
            } as Record<string, Ffi>
          )[elemName];
          if (!elem) throw new Error(`${full}.${name} : tampon fixe de ${elemName}`);
          fixed = { elem, length: Number(fixedAttr.fixed[1] ?? 0) };
        }
      } else if (t.k === "prim" || t.k === "enum") {
        size = t.size;
        align = t.size;
      } else {
        size = 8;
        align = 8;
      }
      align = Math.min(align || 1, pack);
      const explicit = asm.fieldOffset(f);
      const offset = layoutKind === 0x10 ? (explicit ?? 0) : Math.ceil(end / align) * align;
      end = Math.max(end, offset + size);
      st.align = Math.max(st.align, align);
      st.fields.push({ name, offset, ty: t, fixed, marker: marker(attrs.map((a) => a.type)) });
    }
    st.size = Math.max(lay?.size ?? 0, Math.ceil(Math.max(end, 1) / st.align) * st.align);
    return st;
  };

  const exports: Export[] = [];
  for (let m = 1; m <= md.rows(T.MethodDef); m++) {
    const attrs = asm.attributes({ table: T.MethodDef, row: m });
    const uco = attrs.find((a) => a.type === UCO);
    if (!uco) continue;
    const owner = asm.ownerOfMethod(m);
    const type = asm.typeName({ table: T.TypeDef, row: owner });
    const method = md.str(T.MethodDef, m, "Name");
    const where = `${type}.${method}`;
    try {
      if (!(md.raw(T.MethodDef, m, "Flags") & 0x10)) throw new Error("méthode d'instance");
      const sig = readMethodSig(new Reader(md.blob(T.MethodDef, m, "Signature")));
      if (sig.generic) throw new Error("méthode générique");
      const names: string[] = [];
      const markers: (Marker | undefined)[] = [];
      let retMarker: Marker | undefined;
      const p0 = md.raw(T.MethodDef, m, "ParamList");
      const p1 = md.listEnd(T.MethodDef, m, "ParamList", T.Param);
      for (let p = p0; p < p1; p++) {
        const seq = md.raw(T.Param, p, "Sequence");
        const mk = marker(asm.attributes({ table: T.Param, row: p }).map((a) => a.type));
        if (seq === 0) retMarker = mk;
        else {
          names[seq - 1] = md.str(T.Param, p, "Name");
          markers[seq - 1] = mk;
        }
      }
      if (retMarker) throw new Error(`marqueur ${retMarker} sur le retour (utiliser un paramètre ${retMarker}Buffer)`);
      const params = sig.params.map((s, i) => ({ name: names[i] || `arg${i}`, ty: ty(s, `${where} paramètre ${i}`), marker: markers[i] }));
      for (const [i, p] of params.entries()) {
        if (!p.marker) continue;
        const want = p.marker.startsWith("Utf8") ? ["u8", "i8"] : ["u16"];
        if (p.ty.k !== "ptr" || !want.includes(p.ty.elem ?? ""))
          throw new Error(`${p.name} : [${p.marker}] exige ${p.marker.startsWith("Utf8") ? "byte*" : "char*"}`);
        if (p.marker.endsWith("Buffer")) {
          const cap = params[i + 1];
          if (!cap || cap.ty.k !== "prim" || cap.ty.ffi !== "i32")
            throw new Error(`${p.name} : [${p.marker}] doit être suivi d'un int capacité`);
        }
      }
      const ret = ty(sig.ret, `${where} retour`);
      if (params.some((p) => p.marker?.endsWith("Buffer")) && !(ret.k === "prim" && ret.ffi === "i32")) {
        throw new Error("tampon de chaîne : le retour doit être un int (longueur)");
      }
      const callConvs = Array.isArray(uco.named.CallConvs) ? uco.named.CallConvs.map((c) => simple(String(c).split(",")[0]!)) : [];
      exports.push({
        js: camel(method),
        type,
        method,
        entryPoint: typeof uco.named.EntryPoint === "string" ? uco.named.EntryPoint : null,
        callConvs,
        params,
        ret,
        overloaded: false,
      });
    } catch (e) {
      rejected.push({ method: where, reason: (e as Error).message });
    }
  }
  // Collisions de noms JS (même méthode dans deux types, surcharges) : préfixe du type, puis point d'entrée.
  const count = (k: (x: Export) => string) => exports.reduce((m, x) => m.set(k(x), (m.get(k(x)) ?? 0) + 1), new Map<string, number>());
  const byMethod = count((x) => `${x.type}::${x.method}`);
  for (const x of exports) x.overloaded = (byMethod.get(`${x.type}::${x.method}`) ?? 0) > 1;
  const byJs = count((x) => x.js);
  for (const x of exports) if ((byJs.get(x.js) ?? 0) > 1) x.js = camel(simple(x.type)) + x.method;
  for (const x of exports) if (x.overloaded) x.js += `_${x.entryPoint ?? exports.indexOf(x)}`;

  return {
    assembly: { name: asm.name, version: asm.version, mvid: md.guid(md.raw(T.Module, 1, "Mvid")), runtime: md.version },
    exports,
    structs: [...structs.values()].filter((s) => !/e__FixedBuffer$/.test(s.full)),
    enums: [...enums.values()],
    rejected,
  };
}
