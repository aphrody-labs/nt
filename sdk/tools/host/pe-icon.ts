// Icônes réelles des binaires Windows : ressource RT_GROUP_ICON (14) + RT_ICON (3) d'un PE (exe, dll, cpl…),
// réassemblées en fichier .ico (une image, la plus proche de 48 px) que le navigateur décode en ImageBitmap (GPU).
// Format : PE/COFF (Learn « PE Format » : répertoire de ressources = entrée de données 2), GRPICONDIR / ICONDIR.
// Chemins de processus : OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION) + QueryFullProcessImageNameW (kernel32).
import { dlopen } from "bun:ffi";
import { parsePe, resourceEntries } from "./pe.ts";

const k32 = dlopen("kernel32.dll", {
  OpenProcess: { args: ["u32", "i32", "u32"], returns: "u64" },
  QueryFullProcessImageNameW: { args: ["u64", "u32", "ptr", "ptr"], returns: "i32" },
  CloseHandle: { args: ["u64"], returns: "i32" },
  CreateFileW: { args: ["ptr", "u32", "u32", "ptr", "u32", "u32", "u64"], returns: "u64" },
  DeviceIoControl: { args: ["u64", "u32", "ptr", "u32", "ptr", "u32", "ptr", "ptr"], returns: "i32" },
});
const utf16 = new TextDecoder("utf-16le");
const wide = (s: string) => new Uint8Array(Buffer.from(`${s}\0`, "utf16le"));

const pathBuf = new Uint8Array(2 * 1024);
const pathLen = new Uint32Array(1);
/** Chemin Win32 complet de l'image d'un processus (vide si refusé : processus protégés, Idle, System). */
export function processPath(pid: number): string {
  if (pid <= 4) return "";
  const h = k32.symbols.OpenProcess(0x1000, 0, pid);
  if (!h) return "";
  try {
    pathLen[0] = pathBuf.byteLength / 2;
    if (!k32.symbols.QueryFullProcessImageNameW(h, 0, pathBuf, pathLen)) return "";
    return utf16.decode(pathBuf.subarray(0, pathLen[0]! * 2));
  } finally {
    k32.symbols.CloseHandle(h);
  }
}

/** FSCTL_GET_NTFS_VOLUME_DATA (0x90064) : géométrie réelle du volume NTFS et de sa MFT (Learn winioctl.h). */
export function ntfsVolume(letter = (process.env.SystemDrive ?? "C:").slice(0, 1)) {
  const h = k32.symbols.CreateFileW(wide(`\\\\.\\${letter}:`), 0x80000000, 3, null, 3, 0, 0n);
  if (h === 0xffffffffffffffffn) return null;
  try {
    const out = new Uint8Array(104);
    const ret = new Uint32Array(1);
    if (!k32.symbols.DeviceIoControl(h, 0x90064, null, 0, out, out.byteLength, ret, null)) return null;
    const v = new DataView(out.buffer);
    const n = (o: number) => Number(v.getBigInt64(o, true));
    const cluster = v.getUint32(44, true);
    return {
      volume: `${letter}:`,
      totalBytes: n(16) * cluster,
      freeBytes: n(24) * cluster,
      reservedBytes: n(32) * cluster,
      bytesPerSector: v.getUint32(40, true),
      bytesPerCluster: cluster,
      bytesPerFileRecord: v.getUint32(48, true),
      mftBytes: n(56),
      mftRecords: Math.floor(n(56) / Math.max(1, v.getUint32(48, true))),
      mftStartLcn: n(64),
      mftMirrorLcn: n(72),
      mftZoneStart: n(80),
      mftZoneEnd: n(88),
      version: ret[0]! >= 104 ? `${v.getUint16(100, true)}.${v.getUint16(102, true)}` : "",
    };
  } finally {
    k32.symbols.CloseHandle(h);
  }
}

/** Extrait l'icône (la plus proche de `want` px, profondeur maximale) d'un PE et la renvoie au format .ico. */
export async function iconOf(path: string, want = 48): Promise<Uint8Array<ArrayBuffer> | null> {
  let buf: ArrayBuffer;
  try {
    buf = await Bun.file(path).arrayBuffer();
  } catch {
    return null;
  }
  const pe = parsePe(buf);
  const rd = pe?.dir(2);
  const res = pe && rd?.rva ? pe.off(rd.rva) : -1;
  if (!pe || res < 0) return null;
  const b = pe.view;
  const sub = (off: number) => res + (off & 0x7fffffff);
  // Descend jusqu'à la première feuille (nom -> langue -> IMAGE_RESOURCE_DATA_ENTRY).
  const leaf = (dirOff: number): { at: number; size: number } | null => {
    let e = resourceEntries(pe, dirOff)[0];
    while (e && e.off & 0x80000000) e = resourceEntries(pe, sub(e.off))[0];
    if (!e) return null;
    const at = pe.off(b.getUint32(res + e.off, true));
    return at < 0 ? null : { at, size: b.getUint32(res + e.off + 4, true) };
  };
  const top = resourceEntries(pe, res);
  const grp = top.find((e) => e.id === 14 && e.off & 0x80000000);
  const icons = top.find((e) => e.id === 3 && e.off & 0x80000000);
  if (!grp || !icons) return null;
  const g = leaf(sub(grp.off));
  if (!g || g.at + 6 > b.byteLength) return null;
  let best = -1;
  let bestScore = -1e9;
  for (let i = 0; i < b.getUint16(g.at + 4, true); i++) {
    const e = g.at + 6 + i * 14;
    const score = -Math.abs((b.getUint8(e) || 256) - want) * 4 + b.getUint16(e + 6, true);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  if (best < 0) return null;
  const iconDir = resourceEntries(pe, sub(icons.off)).find((e) => e.id === b.getUint16(best + 12, true));
  const img = iconDir && iconDir.off & 0x80000000 ? leaf(sub(iconDir.off)) : null;
  if (!img || img.at + img.size > b.byteLength) return null;
  const ico = new Uint8Array(22 + img.size);
  const v = new DataView(ico.buffer);
  v.setUint16(2, 1, true);
  v.setUint16(4, 1, true);
  ico.set(new Uint8Array(buf, best, 8), 6); // largeur, hauteur, couleurs, réservé, plans, bits
  v.setUint32(14, img.size, true);
  v.setUint32(18, 22, true);
  ico.set(new Uint8Array(buf, img.at, img.size), 22);
  return ico;
}

if (import.meta.main) {
  console.log(JSON.stringify(ntfsVolume()));
  for (const p of [
    `${process.env.SystemRoot}\\explorer.exe`,
    `${process.env.SystemRoot}\\System32\\notepad.exe`,
    `${process.env.SystemRoot}\\System32\\shell32.dll`,
  ]) {
    const ico = await iconOf(p);
    console.log(p, ico ? `${ico.byteLength} octets, ${ico[6] || 256}px ${ico[12]}bpp` : "aucune icône");
  }
  console.log("pid courant :", processPath(process.pid));
}
