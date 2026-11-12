// Lecture PE/COFF (Learn « PE Format ») : en-têtes, sections, répertoires de données, exports, imports, ressources.
// Partagé par pe-icon.ts (icônes) et ntmap.ts (carte du Windows NT de ce poste).

export type Pe = {
  view: DataView;
  machine: number;
  timestamp: number;
  subsystem: number;
  dir: (i: number) => { rva: number; size: number };
  off: (rva: number) => number;
  cstr: (rva: number) => string;
};

const ascii = new TextDecoder("latin1");

export function parsePe(buf: ArrayBuffer): Pe | null {
  const b = new DataView(buf);
  if (b.byteLength < 64 || b.getUint16(0, true) !== 0x5a4d) return null;
  const pe = b.getUint32(60, true);
  if (pe + 24 > b.byteLength || b.getUint32(pe, true) !== 0x4550) return null;
  const nsec = b.getUint16(pe + 6, true);
  const optSize = b.getUint16(pe + 20, true);
  const opt = pe + 24;
  const plus = b.getUint16(opt, true) === 0x20b;
  const dd = opt + (plus ? 112 : 96);
  const ndirs = b.getUint32(opt + (plus ? 108 : 92), true);
  const secs = opt + optSize;
  const off = (rva: number) => {
    for (let i = 0; i < nsec; i++) {
      const s = secs + i * 40;
      const va = b.getUint32(s + 12, true);
      const size = Math.max(b.getUint32(s + 8, true), b.getUint32(s + 16, true));
      if (rva >= va && rva < va + size) return rva - va + b.getUint32(s + 20, true);
    }
    return -1;
  };
  const cstr = (rva: number) => {
    const o = off(rva);
    if (o < 0) return "";
    let e = o;
    while (e < b.byteLength && b.getUint8(e)) e++;
    return ascii.decode(new Uint8Array(buf, o, e - o));
  };
  return {
    view: b,
    machine: b.getUint16(pe + 4, true),
    timestamp: b.getUint32(pe + 8, true),
    subsystem: b.getUint16(opt + 68, true),
    dir: (i) => (i < ndirs ? { rva: b.getUint32(dd + i * 8, true), size: b.getUint32(dd + i * 8 + 4, true) } : { rva: 0, size: 0 }),
    off,
    cstr,
  };
}

/** Noms exportés (IMAGE_EXPORT_DIRECTORY, répertoire 0). */
export function exportsOf(p: Pe): string[] {
  const d = p.dir(0);
  const o = d.rva ? p.off(d.rva) : -1;
  if (o < 0) return [];
  const b = p.view;
  const n = b.getUint32(o + 24, true);
  const names = p.off(b.getUint32(o + 32, true));
  if (names < 0) return [];
  return Array.from({ length: n }, (_, i) => p.cstr(b.getUint32(names + i * 4, true)));
}

/** DLL importées (IMAGE_IMPORT_DESCRIPTOR, répertoire 1, 20 octets par entrée, terminées par une entrée nulle). */
export function importsOf(p: Pe): string[] {
  const d = p.dir(1);
  let o = d.rva ? p.off(d.rva) : -1;
  const out: string[] = [];
  while (o >= 0 && o + 20 <= p.view.byteLength) {
    const name = p.view.getUint32(o + 12, true);
    if (!name) break;
    out.push(p.cstr(name).toLowerCase());
    o += 20;
  }
  return out;
}

/** Entrées d'un IMAGE_RESOURCE_DIRECTORY (répertoire 2) : id ou nom, décalage (bit 31 = sous-répertoire). */
export function resourceEntries(p: Pe, dirOff: number) {
  const b = p.view;
  const n = b.getUint16(dirOff + 12, true) + b.getUint16(dirOff + 14, true);
  return Array.from({ length: n }, (_, i) => ({ id: b.getUint32(dirOff + 16 + i * 8, true), off: b.getUint32(dirOff + 20 + i * 8, true) }));
}
