// Lecteur ECMA-335 (métadonnées CLI) en TypeScript pur : aucun .NET requis à la génération.
// ECMA-335 6e éd., partition II : §24.3.3 (CLI header = répertoire PE 14), §24.2 (racine, flux #~ #Strings #US #GUID #Blob),
// §22 (tables), §24.2.6 (index codés), §23.2 (signatures), §23.3 (blobs d'attributs).
import { parsePe } from "../host/pe.ts";

/** Numéros de table (§22). */
export const T = {
  Module: 0x00,
  TypeRef: 0x01,
  TypeDef: 0x02,
  FieldPtr: 0x03,
  Field: 0x04,
  MethodPtr: 0x05,
  MethodDef: 0x06,
  ParamPtr: 0x07,
  Param: 0x08,
  InterfaceImpl: 0x09,
  MemberRef: 0x0a,
  Constant: 0x0b,
  CustomAttribute: 0x0c,
  FieldMarshal: 0x0d,
  DeclSecurity: 0x0e,
  ClassLayout: 0x0f,
  FieldLayout: 0x10,
  StandAloneSig: 0x11,
  EventMap: 0x12,
  EventPtr: 0x13,
  Event: 0x14,
  PropertyMap: 0x15,
  PropertyPtr: 0x16,
  Property: 0x17,
  MethodSemantics: 0x18,
  MethodImpl: 0x19,
  ModuleRef: 0x1a,
  TypeSpec: 0x1b,
  ImplMap: 0x1c,
  FieldRVA: 0x1d,
  EncLog: 0x1e,
  EncMap: 0x1f,
  Assembly: 0x20,
  AssemblyProcessor: 0x21,
  AssemblyOS: 0x22,
  AssemblyRef: 0x23,
  AssemblyRefProcessor: 0x24,
  AssemblyRefOS: 0x25,
  File: 0x26,
  ExportedType: 0x27,
  ManifestResource: 0x28,
  NestedClass: 0x29,
  GenericParam: 0x2a,
  MethodSpec: 0x2b,
  GenericParamConstraint: 0x2c,
} as const;

/** Index codés (§24.2.6) : bits d'étiquette, tables (-1 = inutilisée). */
const CODED = {
  TypeDefOrRef: [2, [T.TypeDef, T.TypeRef, T.TypeSpec]],
  HasConstant: [2, [T.Field, T.Param, T.Property]],
  HasCustomAttribute: [
    5,
    [
      T.MethodDef,
      T.Field,
      T.TypeRef,
      T.TypeDef,
      T.Param,
      T.InterfaceImpl,
      T.MemberRef,
      T.Module,
      T.DeclSecurity,
      T.Property,
      T.Event,
      T.StandAloneSig,
      T.ModuleRef,
      T.TypeSpec,
      T.Assembly,
      T.AssemblyRef,
      T.File,
      T.ExportedType,
      T.ManifestResource,
      T.GenericParam,
      T.GenericParamConstraint,
      T.MethodSpec,
    ],
  ],
  HasFieldMarshal: [1, [T.Field, T.Param]],
  HasDeclSecurity: [2, [T.TypeDef, T.MethodDef, T.Assembly]],
  MemberRefParent: [3, [T.TypeDef, T.TypeRef, T.ModuleRef, T.MethodDef, T.TypeSpec]],
  HasSemantics: [1, [T.Event, T.Property]],
  MethodDefOrRef: [1, [T.MethodDef, T.MemberRef]],
  MemberForwarded: [1, [T.Field, T.MethodDef]],
  Implementation: [2, [T.File, T.AssemblyRef, T.ExportedType]],
  CustomAttributeType: [3, [-1, -1, T.MethodDef, T.MemberRef, -1]],
  ResolutionScope: [2, [T.Module, T.ModuleRef, T.AssemblyRef, T.TypeRef]],
  TypeOrMethodDef: [1, [T.TypeDef, T.MethodDef]],
} as const satisfies Record<string, readonly [number, readonly number[]]>;
type Coded = keyof typeof CODED;

/** Colonne : entier fixe (2/4 octets), index de tas, index de table (numéro) ou index codé. */
type Col = 2 | 4 | "str" | "guid" | "blob" | { t: number } | Coded;
const t = (n: number) => ({ t: n });

/** Schéma des 45 tables (§22.2-22.39), dans l'ordre des numéros. */
const SCHEMA: Record<number, [string, Col][]> = {
  [T.Module]: [
    ["Generation", 2],
    ["Name", "str"],
    ["Mvid", "guid"],
    ["EncId", "guid"],
    ["EncBaseId", "guid"],
  ],
  [T.TypeRef]: [
    ["ResolutionScope", "ResolutionScope"],
    ["TypeName", "str"],
    ["TypeNamespace", "str"],
  ],
  [T.TypeDef]: [
    ["Flags", 4],
    ["TypeName", "str"],
    ["TypeNamespace", "str"],
    ["Extends", "TypeDefOrRef"],
    ["FieldList", t(T.Field)],
    ["MethodList", t(T.MethodDef)],
  ],
  [T.FieldPtr]: [["Field", t(T.Field)]],
  [T.Field]: [
    ["Flags", 2],
    ["Name", "str"],
    ["Signature", "blob"],
  ],
  [T.MethodPtr]: [["Method", t(T.MethodDef)]],
  [T.MethodDef]: [
    ["RVA", 4],
    ["ImplFlags", 2],
    ["Flags", 2],
    ["Name", "str"],
    ["Signature", "blob"],
    ["ParamList", t(T.Param)],
  ],
  [T.ParamPtr]: [["Param", t(T.Param)]],
  [T.Param]: [
    ["Flags", 2],
    ["Sequence", 2],
    ["Name", "str"],
  ],
  [T.InterfaceImpl]: [
    ["Class", t(T.TypeDef)],
    ["Interface", "TypeDefOrRef"],
  ],
  [T.MemberRef]: [
    ["Class", "MemberRefParent"],
    ["Name", "str"],
    ["Signature", "blob"],
  ],
  // Type : 1 octet + 1 octet de remplissage (§22.9).
  [T.Constant]: [
    ["Type", 2],
    ["Parent", "HasConstant"],
    ["Value", "blob"],
  ],
  [T.CustomAttribute]: [
    ["Parent", "HasCustomAttribute"],
    ["Type", "CustomAttributeType"],
    ["Value", "blob"],
  ],
  [T.FieldMarshal]: [
    ["Parent", "HasFieldMarshal"],
    ["NativeType", "blob"],
  ],
  [T.DeclSecurity]: [
    ["Action", 2],
    ["Parent", "HasDeclSecurity"],
    ["PermissionSet", "blob"],
  ],
  [T.ClassLayout]: [
    ["PackingSize", 2],
    ["ClassSize", 4],
    ["Parent", t(T.TypeDef)],
  ],
  [T.FieldLayout]: [
    ["Offset", 4],
    ["Field", t(T.Field)],
  ],
  [T.StandAloneSig]: [["Signature", "blob"]],
  [T.EventMap]: [
    ["Parent", t(T.TypeDef)],
    ["EventList", t(T.Event)],
  ],
  [T.EventPtr]: [["Event", t(T.Event)]],
  [T.Event]: [
    ["EventFlags", 2],
    ["Name", "str"],
    ["EventType", "TypeDefOrRef"],
  ],
  [T.PropertyMap]: [
    ["Parent", t(T.TypeDef)],
    ["PropertyList", t(T.Property)],
  ],
  [T.PropertyPtr]: [["Property", t(T.Property)]],
  [T.Property]: [
    ["Flags", 2],
    ["Name", "str"],
    ["Type", "blob"],
  ],
  [T.MethodSemantics]: [
    ["Semantics", 2],
    ["Method", t(T.MethodDef)],
    ["Association", "HasSemantics"],
  ],
  [T.MethodImpl]: [
    ["Class", t(T.TypeDef)],
    ["MethodBody", "MethodDefOrRef"],
    ["MethodDeclaration", "MethodDefOrRef"],
  ],
  [T.ModuleRef]: [["Name", "str"]],
  [T.TypeSpec]: [["Signature", "blob"]],
  [T.ImplMap]: [
    ["MappingFlags", 2],
    ["MemberForwarded", "MemberForwarded"],
    ["ImportName", "str"],
    ["ImportScope", t(T.ModuleRef)],
  ],
  [T.FieldRVA]: [
    ["RVA", 4],
    ["Field", t(T.Field)],
  ],
  [T.EncLog]: [
    ["Token", 4],
    ["FuncCode", 4],
  ],
  [T.EncMap]: [["Token", 4]],
  [T.Assembly]: [
    ["HashAlgId", 4],
    ["MajorVersion", 2],
    ["MinorVersion", 2],
    ["BuildNumber", 2],
    ["RevisionNumber", 2],
    ["Flags", 4],
    ["PublicKey", "blob"],
    ["Name", "str"],
    ["Culture", "str"],
  ],
  [T.AssemblyProcessor]: [["Processor", 4]],
  [T.AssemblyOS]: [
    ["OSPlatformID", 4],
    ["OSMajorVersion", 4],
    ["OSMinorVersion", 4],
  ],
  [T.AssemblyRef]: [
    ["MajorVersion", 2],
    ["MinorVersion", 2],
    ["BuildNumber", 2],
    ["RevisionNumber", 2],
    ["Flags", 4],
    ["PublicKeyOrToken", "blob"],
    ["Name", "str"],
    ["Culture", "str"],
    ["HashValue", "blob"],
  ],
  [T.AssemblyRefProcessor]: [
    ["Processor", 4],
    ["AssemblyRef", t(T.AssemblyRef)],
  ],
  [T.AssemblyRefOS]: [
    ["OSPlatformId", 4],
    ["OSMajorVersion", 4],
    ["OSMinorVersion", 4],
    ["AssemblyRef", t(T.AssemblyRef)],
  ],
  [T.File]: [
    ["Flags", 4],
    ["Name", "str"],
    ["HashValue", "blob"],
  ],
  [T.ExportedType]: [
    ["Flags", 4],
    ["TypeDefId", 4],
    ["TypeName", "str"],
    ["TypeNamespace", "str"],
    ["Implementation", "Implementation"],
  ],
  [T.ManifestResource]: [
    ["Offset", 4],
    ["Flags", 4],
    ["Name", "str"],
    ["Implementation", "Implementation"],
  ],
  [T.NestedClass]: [
    ["NestedClass", t(T.TypeDef)],
    ["EnclosingClass", t(T.TypeDef)],
  ],
  [T.GenericParam]: [
    ["Number", 2],
    ["Flags", 2],
    ["Owner", "TypeOrMethodDef"],
    ["Name", "str"],
  ],
  [T.MethodSpec]: [
    ["Method", "MethodDefOrRef"],
    ["Instantiation", "blob"],
  ],
  [T.GenericParamConstraint]: [
    ["Owner", t(T.GenericParam)],
    ["Constraint", "TypeDefOrRef"],
  ],
};

/** Référence décodée d'un index codé ou d'un jeton : table + ligne (1-based, 0 = nulle). */
export type Ref = { table: number; row: number };

type Table = { rows: number; size: number; base: number; cols: Map<string, { off: number; size: number; col: Col }> };

const utf8 = new TextDecoder("utf-8");
const utf16 = new TextDecoder("utf-16le");

/** Métadonnées brutes : tables + tas. Lignes 1-based comme dans la spécification. */
export class Metadata {
  readonly version: string;
  readonly tables: Table[] = [];
  private readonly b: DataView;
  private readonly strings: number;
  private readonly blobs: number;
  private readonly guids: number;
  private readonly us: number;
  private readonly bytes: Uint8Array;
  private readonly strCache = new Map<number, string>();

  constructor(buf: ArrayBuffer, root: number) {
    const b = new DataView(buf);
    this.b = b;
    this.bytes = new Uint8Array(buf);
    if (b.getUint32(root, true) !== 0x424a5342) throw new Error("signature BSJB absente (§24.2.1)");
    const vlen = b.getUint32(root + 12, true);
    this.version = utf8.decode(this.bytes.subarray(root + 16, root + 16 + vlen)).replace(/\0+$/, "");
    let p = root + 16 + vlen + 2;
    const nstreams = b.getUint16(p, true);
    p += 2;
    const streams = new Map<string, { off: number; size: number }>();
    for (let i = 0; i < nstreams; i++) {
      const off = b.getUint32(p, true);
      const size = b.getUint32(p + 4, true);
      let e = p + 8;
      while (this.bytes[e]) e++;
      streams.set(utf8.decode(this.bytes.subarray(p + 8, e)), { off: root + off, size });
      p += 8 + ((e - (p + 8) + 4) & ~3); // nom + NUL, aligné sur 4 octets
    }
    const tilde = streams.get("#~") ?? streams.get("#-");
    if (!tilde) throw new Error("flux de tables #~ absent");
    this.strings = streams.get("#Strings")?.off ?? 0;
    this.blobs = streams.get("#Blob")?.off ?? 0;
    this.guids = streams.get("#GUID")?.off ?? 0;
    this.us = streams.get("#US")?.off ?? 0;

    const tp = tilde.off;
    const heap = b.getUint8(tp + 6);
    const validLo = b.getUint32(tp + 8, true);
    const validHi = b.getUint32(tp + 12, true);
    const rows: number[] = new Array(64).fill(0);
    let q = tp + 24;
    for (let i = 0; i < 64; i++) {
      const bit = i < 32 ? (validLo >>> i) & 1 : (validHi >>> (i - 32)) & 1;
      if (bit) {
        rows[i] = b.getUint32(q, true);
        q += 4;
      }
    }
    // Bit 0x40 des tailles de tas : 4 octets supplémentaires après les compteurs (flux #- d'EnC).
    if (heap & 0x40) q += 4;
    for (const ptr of [T.FieldPtr, T.MethodPtr, T.ParamPtr, T.EventPtr, T.PropertyPtr]) {
      if (rows[ptr]) throw new Error("tables d'indirection (#- non optimisé) non prises en charge");
    }
    const strW = heap & 0x01 ? 4 : 2;
    const guidW = heap & 0x02 ? 4 : 2;
    const blobW = heap & 0x04 ? 4 : 2;
    const width = (c: Col): number => {
      if (c === 2 || c === 4) return c;
      if (c === "str") return strW;
      if (c === "guid") return guidW;
      if (c === "blob") return blobW;
      if (typeof c === "object") return (rows[c.t] ?? 0) < 0x10000 ? 2 : 4;
      const [bits, tabs] = CODED[c];
      const max = Math.max(...tabs.map((x) => (x < 0 ? 0 : (rows[x] ?? 0))));
      return max < 1 << (16 - bits) ? 2 : 4;
    };
    for (let i = 0; i <= T.GenericParamConstraint; i++) {
      const cols = new Map<string, { off: number; size: number; col: Col }>();
      let size = 0;
      for (const [name, col] of SCHEMA[i] ?? []) {
        const w = width(col);
        cols.set(name, { off: size, size: w, col });
        size += w;
      }
      this.tables[i] = { rows: rows[i] ?? 0, size, base: q, cols };
      q += size * (rows[i] ?? 0);
    }
  }

  rows(table: number): number {
    return this.tables[table]?.rows ?? 0;
  }

  /** Valeur brute d'une colonne (ligne 1-based). */
  raw(table: number, row: number, col: string): number {
    const tb = this.tables[table];
    const c = tb?.cols.get(col);
    if (!tb || !c || row < 1 || row > tb.rows) throw new Error(`table ${table} ligne ${row} colonne ${col} invalide`);
    const o = tb.base + (row - 1) * tb.size + c.off;
    return c.size === 2 ? this.b.getUint16(o, true) : this.b.getUint32(o, true);
  }

  /** Index codé ou index de table décodé. */
  ref(table: number, row: number, col: string): Ref {
    const c = this.tables[table]?.cols.get(col)?.col;
    const v = this.raw(table, row, col);
    if (typeof c === "object") return { table: c.t, row: v };
    if (typeof c !== "string" || !(c in CODED)) throw new Error(`colonne ${col} non indexée`);
    const [bits, tabs] = CODED[c as Coded];
    return { table: tabs[v & ((1 << bits) - 1)] ?? -1, row: v >>> bits };
  }

  str(table: number, row: number, col: string): string {
    return this.string(this.raw(table, row, col));
  }

  string(idx: number): string {
    let s = this.strCache.get(idx);
    if (s === undefined) {
      const o = this.strings + idx;
      let e = o;
      while (this.bytes[e]) e++;
      s = utf8.decode(this.bytes.subarray(o, e));
      this.strCache.set(idx, s);
    }
    return s;
  }

  blob(table: number, row: number, col: string): Uint8Array {
    return this.blobAt(this.raw(table, row, col));
  }

  blobAt(idx: number): Uint8Array {
    const r = new Reader(this.bytes, this.blobs + idx);
    const n = r.compressed();
    return this.bytes.subarray(r.pos, r.pos + n);
  }

  /** Littéral utilisateur (#US) : UTF-16LE + octet final (§24.2.4). */
  userString(idx: number): string {
    const r = new Reader(this.bytes, this.us + idx);
    const n = r.compressed();
    return utf16.decode(this.bytes.subarray(r.pos, r.pos + (n & ~1)));
  }

  guid(idx: number): string {
    if (!idx) return "";
    const g = this.bytes.subarray(this.guids + (idx - 1) * 16, this.guids + idx * 16);
    const h = [...g].map((x) => x.toString(16).padStart(2, "0"));
    const le = (a: number, n: number) =>
      h
        .slice(a, a + n)
        .reverse()
        .join("");
    return `${le(0, 4)}-${le(4, 2)}-${le(6, 2)}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
  }

  /** Fin (exclusive) d'une liste de lignes (FieldList, MethodList, ParamList) : début de la ligne suivante. */
  listEnd(table: number, row: number, col: string, target: number): number {
    return row < this.rows(table) ? this.raw(table, row + 1, col) : this.rows(target) + 1;
  }
}

/** Lecture séquentielle d'un blob (entiers compressés §23.2). */
export class Reader {
  constructor(
    readonly bytes: Uint8Array,
    public pos = 0,
    readonly end = bytes.length,
  ) {}
  get done() {
    return this.pos >= this.end;
  }
  u8(): number {
    if (this.pos >= this.end) throw new Error("blob tronqué");
    return this.bytes[this.pos++]!;
  }
  peek(): number {
    return this.bytes[this.pos] ?? 0;
  }
  compressed(): number {
    const a = this.u8();
    if ((a & 0x80) === 0) return a;
    if ((a & 0xc0) === 0x80) return ((a & 0x3f) << 8) | this.u8();
    return (((a & 0x1f) << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }
  view(n: number): DataView {
    if (this.pos + n > this.end) throw new Error("blob tronqué");
    const v = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, n);
    this.pos += n;
    return v;
  }
  /** SerString (§23.3) : longueur compressée, 0xFF = null, UTF-8. */
  serString(): string | null {
    if (this.peek() === 0xff) {
      this.pos++;
      return null;
    }
    const n = this.compressed();
    const s = utf8.decode(this.bytes.subarray(this.pos, this.pos + n));
    this.pos += n;
    return s;
  }
}

/** Types d'éléments (§23.1.16). */
export const E = {
  END: 0x00,
  VOID: 0x01,
  BOOLEAN: 0x02,
  CHAR: 0x03,
  I1: 0x04,
  U1: 0x05,
  I2: 0x06,
  U2: 0x07,
  I4: 0x08,
  U4: 0x09,
  I8: 0x0a,
  U8: 0x0b,
  R4: 0x0c,
  R8: 0x0d,
  STRING: 0x0e,
  PTR: 0x0f,
  BYREF: 0x10,
  VALUETYPE: 0x11,
  CLASS: 0x12,
  VAR: 0x13,
  ARRAY: 0x14,
  GENERICINST: 0x15,
  TYPEDBYREF: 0x16,
  I: 0x18,
  U: 0x19,
  FNPTR: 0x1b,
  OBJECT: 0x1c,
  SZARRAY: 0x1d,
  MVAR: 0x1e,
  CMOD_REQD: 0x1f,
  CMOD_OPT: 0x20,
  SENTINEL: 0x41,
  PINNED: 0x45,
  // Blobs d'attributs (§23.3).
  TYPE: 0x50,
  BOXED: 0x51,
  FIELD: 0x53,
  PROPERTY: 0x54,
  ENUM: 0x55,
} as const;

/** Conventions d'appel (§23.2.1, §23.2.3 ; 0x09 = « unmanaged » étendu, C# `delegate* unmanaged`). */
export const CallConv = { DEFAULT: 0, C: 1, STDCALL: 2, THISCALL: 3, FASTCALL: 4, VARARG: 5, UNMANAGED: 9 } as const;

export type Sig =
  | { k: "prim"; e: number }
  | { k: "ptr"; to: Sig }
  | { k: "byref"; to: Sig }
  | { k: "valuetype" | "class"; ref: Ref }
  | { k: "fnptr"; sig: MethodSig }
  | { k: "szarray"; of: Sig }
  | { k: "generic"; base: Sig; args: Sig[] }
  | { k: "var" | "mvar"; n: number }
  | { k: "array"; of: Sig; rank: number }
  | { k: "other"; e: number };

export type MethodSig = { conv: number; hasThis: boolean; generic: number; ret: Sig; params: Sig[]; retMods: Ref[] };

/** TypeDefOrRefOrSpecEncoded (§23.2.8). */
function typeToken(r: Reader): Ref {
  const v = r.compressed();
  return { table: [T.TypeDef, T.TypeRef, T.TypeSpec][v & 3] ?? -1, row: v >>> 2 };
}

/** Modificateurs (modreq/modopt) en tête de type : retournés à part. */
function mods(r: Reader): Ref[] {
  const out: Ref[] = [];
  while (r.peek() === E.CMOD_OPT || r.peek() === E.CMOD_REQD) {
    r.u8();
    out.push(typeToken(r));
  }
  return out;
}

export function readType(r: Reader): Sig {
  mods(r);
  const e = r.u8();
  switch (e) {
    case E.PTR:
      return { k: "ptr", to: readType(r) };
    case E.BYREF:
      return { k: "byref", to: readType(r) };
    case E.VALUETYPE:
      return { k: "valuetype", ref: typeToken(r) };
    case E.CLASS:
      return { k: "class", ref: typeToken(r) };
    case E.FNPTR:
      return { k: "fnptr", sig: readMethodSig(r) };
    case E.SZARRAY:
      return { k: "szarray", of: readType(r) };
    case E.VAR:
    case E.MVAR:
      return { k: e === E.VAR ? "var" : "mvar", n: r.compressed() };
    case E.GENERICINST: {
      const base = readType(r);
      const n = r.compressed();
      const args: Sig[] = [];
      for (let i = 0; i < n; i++) args.push(readType(r));
      return { k: "generic", base, args };
    }
    case E.ARRAY: {
      const of = readType(r);
      const rank = r.compressed();
      const ns = r.compressed();
      for (let i = 0; i < ns; i++) r.compressed();
      const nl = r.compressed();
      for (let i = 0; i < nl; i++) r.compressed();
      return { k: "array", of, rank };
    }
    case E.PINNED:
      return readType(r);
    default:
      if ((e >= E.VOID && e <= E.STRING) || e === E.I || e === E.U || e === E.OBJECT || e === E.TYPEDBYREF) return { k: "prim", e };
      return { k: "other", e };
  }
}

/** MethodDefSig / MethodRefSig / signature de pointeur de fonction (§23.2.1-23.2.3). */
export function readMethodSig(r: Reader): MethodSig {
  const head = r.u8();
  const generic = head & 0x10 ? r.compressed() : 0;
  const n = r.compressed();
  const retMods = mods(r);
  const ret = readType(r);
  const params: Sig[] = [];
  for (let i = 0; i < n; i++) {
    if (r.peek() === E.SENTINEL) r.u8();
    params.push(readType(r));
  }
  return { conv: head & 0x0f, hasThis: (head & 0x20) !== 0, generic, ret, params, retMods };
}

/** FieldSig (§23.2.4). */
export function readFieldSig(blob: Uint8Array): Sig {
  const r = new Reader(blob);
  if (r.u8() !== 0x06) throw new Error("FieldSig attendu");
  return readType(r);
}

export type AttrValue = string | number | bigint | boolean | null | AttrValue[];
export type Attribute = { type: string; fixed: AttrValue[]; named: Record<string, AttrValue>; error?: string };

/** Assemblage lu : noms, types, méthodes, attributs. */
export class Assembly {
  readonly md: Metadata;
  readonly name: string;
  readonly version: string;
  private readonly methodOwner: Int32Array;
  private readonly fieldOwner: Int32Array;
  private readonly enclosing = new Map<number, number>();
  private readonly attrs = new Map<string, number[]>();
  private readonly constants = new Map<string, number>();
  private readonly layouts = new Map<number, { pack: number; size: number }>();
  private readonly fieldOffsets = new Map<number, number>();

  constructor(md: Metadata) {
    this.md = md;
    const a = md.rows(T.Assembly);
    this.name = a ? md.str(T.Assembly, 1, "Name") : md.str(T.Module, 1, "Name").replace(/\.dll$/i, "");
    this.version = a
      ? ["MajorVersion", "MinorVersion", "BuildNumber", "RevisionNumber"].map((c) => md.raw(T.Assembly, 1, c)).join(".")
      : "0.0.0.0";
    this.methodOwner = new Int32Array(md.rows(T.MethodDef) + 1);
    this.fieldOwner = new Int32Array(md.rows(T.Field) + 1);
    for (let td = 1; td <= md.rows(T.TypeDef); td++) {
      const m0 = md.raw(T.TypeDef, td, "MethodList");
      const m1 = md.listEnd(T.TypeDef, td, "MethodList", T.MethodDef);
      for (let m = m0; m < m1; m++) this.methodOwner[m] = td;
      const f0 = md.raw(T.TypeDef, td, "FieldList");
      const f1 = md.listEnd(T.TypeDef, td, "FieldList", T.Field);
      for (let f = f0; f < f1; f++) this.fieldOwner[f] = td;
    }
    for (let i = 1; i <= md.rows(T.NestedClass); i++) {
      this.enclosing.set(md.raw(T.NestedClass, i, "NestedClass"), md.raw(T.NestedClass, i, "EnclosingClass"));
    }
    for (let i = 1; i <= md.rows(T.CustomAttribute); i++) {
      const p = md.ref(T.CustomAttribute, i, "Parent");
      const key = `${p.table}:${p.row}`;
      const list = this.attrs.get(key);
      if (list) list.push(i);
      else this.attrs.set(key, [i]);
    }
    for (let i = 1; i <= md.rows(T.Constant); i++) {
      const p = md.ref(T.Constant, i, "Parent");
      this.constants.set(`${p.table}:${p.row}`, i);
    }
    for (let i = 1; i <= md.rows(T.ClassLayout); i++) {
      this.layouts.set(md.raw(T.ClassLayout, i, "Parent"), {
        pack: md.raw(T.ClassLayout, i, "PackingSize"),
        size: md.raw(T.ClassLayout, i, "ClassSize"),
      });
    }
    for (let i = 1; i <= md.rows(T.FieldLayout); i++) {
      this.fieldOffsets.set(md.raw(T.FieldLayout, i, "Field"), md.raw(T.FieldLayout, i, "Offset"));
    }
  }

  /** Nom complet d'un TypeDef/TypeRef/TypeSpec (types imbriqués séparés par « + », comme Type.GetType). */
  typeName(ref: Ref): string {
    const md = this.md;
    if (ref.table === T.TypeDef) {
      const n = md.str(T.TypeDef, ref.row, "TypeName");
      const ns = md.str(T.TypeDef, ref.row, "TypeNamespace");
      const outer = this.enclosing.get(ref.row);
      if (outer) return `${this.typeName({ table: T.TypeDef, row: outer })}+${n}`;
      return ns ? `${ns}.${n}` : n;
    }
    if (ref.table === T.TypeRef) {
      const n = md.str(T.TypeRef, ref.row, "TypeName");
      const ns = md.str(T.TypeRef, ref.row, "TypeNamespace");
      const scope = md.ref(T.TypeRef, ref.row, "ResolutionScope");
      if (scope.table === T.TypeRef && scope.row) return `${this.typeName(scope)}+${n}`;
      return ns ? `${ns}.${n}` : n;
    }
    if (ref.table === T.TypeSpec) return `typespec#${ref.row}`;
    return `?${ref.table}:${ref.row}`;
  }

  /** TypeDef de base (Extends) en nom complet, ou "". */
  baseName(td: number): string {
    const e = this.md.ref(T.TypeDef, td, "Extends");
    return e.row ? this.typeName(e) : "";
  }

  /** TypeDef local d'un nom complet (pour suivre un TypeRef vers ce même assemblage, cas rare). */
  findTypeDef(full: string): number {
    if (!this.byName) {
      this.byName = new Map();
      for (let td = 1; td <= this.md.rows(T.TypeDef); td++) this.byName.set(this.typeName({ table: T.TypeDef, row: td }), td);
    }
    return this.byName.get(full) ?? 0;
  }
  private byName: Map<string, number> | undefined;

  ownerOfMethod(m: number): number {
    return this.methodOwner[m] ?? 0;
  }

  ownerOfField(f: number): number {
    return this.fieldOwner[f] ?? 0;
  }

  layout(td: number) {
    return this.layouts.get(td);
  }

  fieldOffset(f: number) {
    return this.fieldOffsets.get(f);
  }

  /** Valeur de la table Constant pour un champ/paramètre/propriété. */
  constant(parent: Ref): AttrValue | undefined {
    const i = this.constants.get(`${parent.table}:${parent.row}`);
    if (!i) return undefined;
    const type = this.md.raw(T.Constant, i, "Type") & 0xff;
    const blob = this.md.blob(T.Constant, i, "Value");
    if (type === E.STRING) return utf16.decode(blob);
    if (type === E.CLASS) return null;
    return readPrim(new Reader(blob), type);
  }

  /** Attributs personnalisés d'un élément (Parent = HasCustomAttribute), décodés. */
  attributes(parent: Ref): Attribute[] {
    const md = this.md;
    return (this.attrs.get(`${parent.table}:${parent.row}`) ?? []).map((i) => {
      const ctor = md.ref(T.CustomAttribute, i, "Type");
      let type = "";
      let sig: MethodSig;
      if (ctor.table === T.MethodDef) {
        type = this.typeName({ table: T.TypeDef, row: this.ownerOfMethod(ctor.row) });
        sig = readMethodSig(new Reader(md.blob(T.MethodDef, ctor.row, "Signature")));
      } else {
        const cls = md.ref(T.MemberRef, ctor.row, "Class");
        type = this.typeName(cls);
        sig = readMethodSig(new Reader(md.blob(T.MemberRef, ctor.row, "Signature")));
      }
      try {
        return { type, ...this.decodeAttribute(md.blob(T.CustomAttribute, i, "Value"), sig) };
      } catch (e) {
        return { type, fixed: [], named: {}, error: (e as Error).message };
      }
    });
  }

  /** Blob d'attribut (§23.3) : prologue 0x0001, arguments fixes, arguments nommés. */
  private decodeAttribute(blob: Uint8Array, ctor: MethodSig): { fixed: AttrValue[]; named: Record<string, AttrValue> } {
    const r = new Reader(blob);
    const fixed: AttrValue[] = [];
    const named: Record<string, AttrValue> = {};
    if (blob.length < 2) return { fixed, named };
    if (r.u8() !== 0x01 || r.u8() !== 0x00) throw new Error("prologue d'attribut invalide");
    for (const p of ctor.params) fixed.push(this.readFixed(r, p));
    if (r.end - r.pos < 2) return { fixed, named };
    const n = r.view(2).getUint16(0, true);
    for (let i = 0; i < n; i++) {
      r.u8(); // FIELD (0x53) ou PROPERTY (0x54)
      const ft = readFieldOrPropType(r);
      const name = r.serString() ?? "";
      named[name] = this.readElem(r, ft);
    }
    return { fixed, named };
  }

  private readFixed(r: Reader, s: Sig): AttrValue {
    if (s.k === "prim")
      return s.e === E.STRING ? r.serString() : s.e === E.OBJECT ? this.readElem(r, readFieldOrPropType(r)) : readPrim(r, s.e);
    if (s.k === "class") return r.serString(); // System.Type
    if (s.k === "valuetype") return readPrim(r, this.enumUnderlying(s.ref) ?? E.I4);
    if (s.k === "szarray") {
      const n = r.view(4).getUint32(0, true);
      if (n === 0xffffffff) return null;
      const out: AttrValue[] = [];
      for (let i = 0; i < n; i++) out.push(this.readFixed(r, s.of));
      return out;
    }
    throw new Error(`argument d'attribut non pris en charge (${s.k})`);
  }

  private readonly enumByName = new Map<string, number>();

  /** Élément d'argument nommé ou d'object encadré (§23.3). */
  private readElem(r: Reader, ft: FieldOrProp): AttrValue {
    switch (ft.e) {
      case E.STRING:
      case E.TYPE:
        return r.serString();
      case E.BOXED:
        return this.readElem(r, readFieldOrPropType(r));
      case E.ENUM: {
        // Énumération : type sous-jacent résolu si elle est définie ici, sinon Int32 (énumérations d'interop externes).
        const name = (ft.enumType ?? "").split(",")[0]!.trim();
        let e = this.enumByName.get(name);
        if (e === undefined) {
          const td = this.findTypeDef(name);
          e = (td && this.enumUnderlying({ table: T.TypeDef, row: td })) || E.I4;
          this.enumByName.set(name, e);
        }
        return readPrim(r, e);
      }
      case E.SZARRAY: {
        const n = r.view(4).getUint32(0, true);
        if (n === 0xffffffff) return null;
        const out: AttrValue[] = [];
        for (let i = 0; i < n; i++) out.push(this.readElem(r, ft.of ?? { e: E.I4 }));
        return out;
      }
      default:
        return readPrim(r, ft.e);
    }
  }

  /** Type sous-jacent d'une énumération locale (champ d'instance value__) ; undefined si externe. */
  enumUnderlying(ref: Ref): number | undefined {
    if (ref.table !== T.TypeDef) return undefined;
    const md = this.md;
    const f0 = md.raw(T.TypeDef, ref.row, "FieldList");
    const f1 = md.listEnd(T.TypeDef, ref.row, "FieldList", T.Field);
    for (let f = f0; f < f1; f++) {
      if (md.raw(T.Field, f, "Flags") & 0x10) continue;
      const s = readFieldSig(md.blob(T.Field, f, "Signature"));
      if (s.k === "prim") return s.e;
    }
    return undefined;
  }
}

/** FieldOrPropType (§23.3) : code + précisions éventuelles. */
type FieldOrProp = { e: number; of?: FieldOrProp; enumType?: string };
function readFieldOrPropType(r: Reader): FieldOrProp {
  const e = r.u8();
  if (e === E.SZARRAY) return { e, of: readFieldOrPropType(r) };
  if (e === E.ENUM) return { e, enumType: r.serString() ?? "" };
  return { e };
}

function readPrim(r: Reader, e: number): number | bigint | boolean {
  switch (e) {
    case E.BOOLEAN:
      return r.u8() !== 0;
    case E.I1:
      return r.view(1).getInt8(0);
    case E.U1:
      return r.u8();
    case E.CHAR:
    case E.U2:
      return r.view(2).getUint16(0, true);
    case E.I2:
      return r.view(2).getInt16(0, true);
    case E.I4:
      return r.view(4).getInt32(0, true);
    case E.U4:
      return r.view(4).getUint32(0, true);
    case E.I8:
      return r.view(8).getBigInt64(0, true);
    case E.U8:
      return r.view(8).getBigUint64(0, true);
    case E.R4:
      return r.view(4).getFloat32(0, true);
    case E.R8:
      return r.view(8).getFloat64(0, true);
    default:
      throw new Error(`élément 0x${e.toString(16)} non primitif`);
  }
}

/** Ouvre un assemblage IL (PE + en-tête CLI). Un binaire NativeAOT n'a pas de métadonnées : erreur explicite. */
export function readAssembly(buf: ArrayBuffer): Assembly {
  const pe = parsePe(buf);
  if (!pe) throw new Error("pas un fichier PE");
  const cli = pe.dir(14);
  if (!cli.rva) throw new Error("pas d'en-tête CLI (répertoire 14) : binaire natif (NativeAOT ?) et non assemblage IL");
  const o = pe.off(cli.rva);
  const mdRva = pe.view.getUint32(o + 8, true);
  return new Assembly(new Metadata(buf, pe.off(mdRva)));
}
