// Échantillonneur du noyau Windows NT en direct (bun:ffi -> ntdll). Aucune compilation : appels natifs depuis bun.
// Structures et classes d'information : winsiderss/phnt @53fbbdc5 (2026-03-26), ntexapi.h / ntkeapi.h / ntldr.h /
// ntobapi.h ; décalages x64 recalculés depuis ces définitions (tailles connues : SYSTEM_PROCESS_INFORMATION 0x100,
// SYSTEM_THREAD_INFORMATION 0x50, RTL_PROCESS_MODULE_INFORMATION 0x128).
// Trame binaire « rapide » (processeurs, compteurs, processus, threads) + objet « lent » (pilotes, pool, espace de noms).
import { dlopen, ptr } from "bun:ffi";
export { FRAME, MAGIC, THREAD_STATE, WAIT_REASON, type Slow } from "../../../modules/web/ntsys-format.ts";
import { FRAME, MAGIC, type Slow } from "../../../modules/web/ntsys-format.ts";

const STATUS_INFO_LENGTH_MISMATCH = 0xc0000004 | 0;
const STATUS_BUFFER_TOO_SMALL = 0xc0000023 | 0;
const STATUS_MORE_ENTRIES = 0x00000105;

const nt = dlopen("ntdll.dll", {
  NtQuerySystemInformation: { args: ["u32", "ptr", "u32", "ptr"], returns: "i32" },
  NtOpenDirectoryObject: { args: ["ptr", "u32", "ptr"], returns: "i32" },
  NtQueryDirectoryObject: { args: ["u64", "ptr", "u32", "u8", "u8", "ptr", "ptr"], returns: "i32" },
  NtQueryObject: { args: ["u64", "u32", "ptr", "u32", "ptr"], returns: "i32" },
  NtClose: { args: ["u64"], returns: "i32" },
});

const Class = { Basic: 0, Performance: 2, Process: 5, ProcessorPerformance: 8, Module: 11, PoolTag: 22, Interrupt: 23 } as const;
const retLen = new Uint32Array(1);
const bufs = new Map<number, Uint8Array>();

/** NtQuerySystemInformation avec tampon réutilisé (agrandi si STATUS_INFO_LENGTH_MISMATCH). */
function query(cls: number, initial: number): DataView {
  let b = bufs.get(cls) ?? new Uint8Array(initial);
  for (let i = 0; i < 8; i++) {
    const st = nt.symbols.NtQuerySystemInformation(cls, b, b.byteLength, retLen);
    if (st === 0) {
      bufs.set(cls, b);
      return new DataView(b.buffer, b.byteOffset, retLen[0] || b.byteLength);
    }
    if (st !== STATUS_INFO_LENGTH_MISMATCH && st !== STATUS_BUFFER_TOO_SMALL)
      throw new Error(`NtQuerySystemInformation(${cls}) = 0x${(st >>> 0).toString(16)}`);
    b = new Uint8Array(Math.max(b.byteLength * 2, (retLen[0] ?? 0) + 65536));
  }
  throw new Error(`NtQuerySystemInformation(${cls}) : tampon insuffisant`);
}

const utf16 = new TextDecoder("utf-16le");
/** UNICODE_STRING dont le tampon pointe dans `view` (le noyau recopie les chaînes dans le tampon de sortie). */
function ustr(view: DataView, at: number, base: number): string {
  const len = view.getUint16(at, true);
  const p = Number(view.getBigUint64(at + 8, true));
  if (!len || !p) return "";
  const off = p - base;
  if (off < 0 || off + len > view.byteLength) return "";
  return utf16.decode(new Uint8Array(view.buffer, view.byteOffset + off, len));
}
const addr = (v: DataView) => ptr(new Uint8Array(v.buffer, v.byteOffset, 1));

export function createSampler() {
  const basic = query(Class.Basic, 64);
  const pageSize = basic.getUint32(8, true);
  const physPages = basic.getUint32(12, true);
  const timerRes = basic.getUint32(4, true);
  const ncpu = basic.getUint8(56) || navigator.hardwareConcurrency;

  let prevT = 0;
  const prevCpu = new Float64Array(ncpu * 6); // idle, kernel, user, dpc, isr, interrupts
  const prevIntr = new Float64Array(ncpu * 2); // ctxsw, dpc count
  let prevPerf: number[] = [];
  const prevProc = new Map<number, number[]>(); // pid -> [cpu100ns, ioBytes, faults]
  const prevThread = new Map<number, number[]>(); // tid -> [cpu100ns, ctxsw]
  const names: string[] = [];
  const nameIds = new Map<string, number>();
  let namesVersion = 0;
  let out = new ArrayBuffer(1 << 20);

  const nameId = (n: string) => {
    let id = nameIds.get(n);
    if (id === undefined) {
      id = names.length;
      names.push(n);
      nameIds.set(n, id);
      namesVersion++;
    }
    return id;
  };

  function fast(): ArrayBuffer {
    const now = performance.now();
    const dt = prevT ? (now - prevT) / 1000 : 0;
    const dt100 = dt * 1e7;
    prevT = now;

    const pp = query(Class.ProcessorPerformance, 48 * ncpu);
    const ii = query(Class.Interrupt, 24 * ncpu);
    const perf = query(Class.Performance, 512);
    const pv = query(Class.Process, 1 << 22);

    // Processus et threads : premier passage pour compter.
    let nproc = 0;
    let nthread = 0;
    for (let off = 0; ;) {
      nproc++;
      nthread += pv.getUint32(off + 4, true);
      const next = pv.getUint32(off, true);
      if (!next) break;
      off += next;
    }
    const bytes = 4 * (FRAME.header + FRAME.globals + ncpu * FRAME.cpu + nproc * FRAME.proc + nthread * FRAME.thread);
    if (bytes > out.byteLength) out = new ArrayBuffer(bytes * 2);
    const u = new Uint32Array(out, 0, bytes / 4);
    const f = new Float32Array(out, 0, bytes / 4);
    const d = new DataView(out);

    // Processeurs (KPRCB) : temps idle / noyau / utilisateur / DPC / interruptions, en fraction de l'intervalle.
    const g = FRAME.header;
    let c = g + FRAME.globals;
    const sum = [0, 0, 0, 0, 0];
    for (let i = 0; i < ncpu; i++) {
      const o = i * 48;
      const idle = Number(pp.getBigInt64(o, true));
      const kernel = Number(pp.getBigInt64(o + 8, true)); // inclut idle, DPC et ISR
      const user = Number(pp.getBigInt64(o + 16, true));
      const dpc = Number(pp.getBigInt64(o + 24, true));
      const isr = Number(pp.getBigInt64(o + 32, true));
      const ints = pp.getUint32(o + 40, true);
      const p = prevCpu.subarray(i * 6, i * 6 + 6);
      const dI = idle - p[0]!;
      const dK = kernel - p[1]!;
      const dU = user - p[2]!;
      const dD = dpc - p[3]!;
      const dS = isr - p[4]!;
      const total = dK + dU || 1;
      const fr = dt ? [dU / total, Math.max(0, dK - dI - dD - dS) / total, dD / total, dS / total, dI / total] : [0, 0, 0, 0, 1];
      for (let k = 0; k < 5; k++) {
        f[c + k] = fr[k]!;
        sum[k]! += fr[k]!;
      }
      f[c + 5] = dt ? (ints - p[5]!) / dt : 0;
      const ctx = ii.getUint32(i * 24, true);
      const dpcCount = ii.getUint32(i * 24 + 4, true);
      f[c + 6] = dt ? (dpcCount - prevIntr[i * 2 + 1]!) / dt : 0;
      f[c + 7] = dt ? (ctx - prevIntr[i * 2]!) / dt : 0;
      p.set([idle, kernel, user, dpc, isr, ints]);
      prevIntr[i * 2] = ctx;
      prevIntr[i * 2 + 1] = dpcCount;
      c += FRAME.cpu;
    }

    // Compteurs globaux (SYSTEM_PERFORMANCE_INFORMATION).
    const P = {
      ioRead: Number(perf.getBigInt64(8, true)),
      ioWrite: Number(perf.getBigInt64(16, true)),
      ioOps: perf.getUint32(32, true) + perf.getUint32(36, true) + perf.getUint32(40, true),
      avail: perf.getUint32(44, true),
      commit: perf.getUint32(48, true),
      limit: perf.getUint32(52, true),
      faults: perf.getUint32(60, true),
      paged: perf.getUint32(112, true),
      nonPaged: perf.getUint32(116, true),
      ctx: perf.getUint32(296, true),
      syscalls: perf.getUint32(308, true),
    };
    const cur = [P.syscalls, P.ctx, P.faults, P.ioRead, P.ioWrite, P.ioOps];
    // Compteurs ULONG : rebouclage à 2^32 corrigé ; compteurs 64 bits (octets d'E/S) : différence directe.
    const rate = (k: number) => {
      if (!dt || !prevPerf.length) return 0;
      const delta = cur[k]! - prevPerf[k]!;
      return (delta < 0 ? delta + 2 ** 32 : delta) / dt;
    };
    const mb = (pages: number) => (pages * pageSize) / 1048576;
    const gl = [
      sum[0]! / ncpu,
      sum[1]! / ncpu,
      sum[2]! / ncpu,
      sum[3]! / ncpu,
      sum[4]! / ncpu,
      rate(0),
      rate(1),
      rate(2),
      rate(3),
      rate(4),
      rate(5),
      mb(P.avail),
      mb(P.commit),
      mb(P.limit),
      mb(P.paged),
      mb(P.nonPaged),
    ];
    for (let k = 0; k < 16; k++) f[g + k] = gl[k]!;
    prevPerf = cur;

    // Processus (EPROCESS) et threads (ETHREAD).
    const base = addr(pv);
    let pi = c;
    let ti = c + nproc * FRAME.proc;
    let tIndex = 0;
    const seenP = new Set<number>();
    const seenT = new Set<number>();
    for (let off = 0; ;) {
      const nth = pv.getUint32(off + 4, true);
      const pid = Number(pv.getBigUint64(off + 80, true));
      const ppid = Number(pv.getBigUint64(off + 88, true));
      const name = pid === 0 ? "Idle" : ustr(pv, off + 56, base) || (pid === 4 ? "System" : `pid ${pid}`);
      const cpu = Number(pv.getBigInt64(off + 40, true)) + Number(pv.getBigInt64(off + 48, true));
      const io =
        Number(pv.getBigInt64(off + 232, true)) + Number(pv.getBigInt64(off + 240, true)) + Number(pv.getBigInt64(off + 248, true));
      const faults = pv.getUint32(off + 128, true);
      const prev = prevProc.get(pid);
      u[pi] = pid;
      u[pi + 1] = ppid;
      u[pi + 2] = nth;
      u[pi + 3] = pv.getUint32(off + 96, true);
      u[pi + 4] = tIndex;
      f[pi + 5] = Number(pv.getBigUint64(off + 144, true)) / 1048576;
      f[pi + 6] = Number(pv.getBigUint64(off + 200, true)) / 1048576;
      f[pi + 7] = prev && dt100 ? Math.max(0, cpu - prev[0]!) / (dt100 * ncpu) : 0;
      f[pi + 8] = prev && dt ? Math.max(0, io - prev[1]!) / dt : 0;
      f[pi + 9] = prev && dt ? Math.max(0, (faults - prev[2]!) >>> 0) / dt : 0;
      u[pi + 10] = nameId(name);
      u[pi + 11] = pv.getUint32(off + 100, true);
      prevProc.set(pid, [cpu, io, faults]);
      seenP.add(pid);
      for (let t = 0; t < nth; t++) {
        const to = off + 256 + t * 80;
        const tid = Number(pv.getBigUint64(to + 48, true));
        const tcpu = Number(pv.getBigInt64(to, true)) + Number(pv.getBigInt64(to + 8, true));
        const tctx = pv.getUint32(to + 64, true);
        const tp = prevThread.get(tid);
        u[ti] = tid;
        u[ti + 1] =
          (pv.getUint32(to + 68, true) & 0xff) |
          ((pv.getUint32(to + 72, true) & 0xff) << 8) |
          ((pv.getInt32(to + 56, true) & 0xff) << 16) |
          ((pv.getInt32(to + 60, true) & 0xff) << 24);
        f[ti + 2] = tp && dt100 ? Math.max(0, tcpu - tp[0]!) / dt100 : 0;
        f[ti + 3] = tp && dt ? Math.max(0, (tctx - tp[1]!) >>> 0) / dt : 0;
        prevThread.set(tid, [tcpu, tctx]);
        seenT.add(tid);
        ti += FRAME.thread;
        tIndex++;
      }
      pi += FRAME.proc;
      const next = pv.getUint32(off, true);
      if (!next) break;
      off += next;
    }
    for (const k of prevProc.keys()) if (!seenP.has(k)) prevProc.delete(k);
    for (const k of prevThread.keys()) if (!seenT.has(k)) prevThread.delete(k);

    u[0] = MAGIC;
    u[1] = ncpu;
    u[2] = nproc;
    u[3] = nthread;
    u[4] = namesVersion;
    u[5] = 0;
    d.setFloat64(24, now, true);
    return out.slice(0, bytes);
  }

  // --- Lent : pilotes, pool, espace de noms du gestionnaire d'objets ---------------------------------------
  let prevPool = new Map<string, number>();
  let prevPoolT = 0;
  function slow(): Slow {
    const mods = query(Class.Module, 1 << 16);
    const n = mods.getUint32(0, true);
    const modules: Slow["modules"] = [];
    const ascii = new TextDecoder("latin1");
    for (let i = 0; i < n; i++) {
      const o = 8 + i * 0x128;
      const size = mods.getUint32(o + 24, true);
      const order = mods.getUint16(o + 32, true);
      const nameOff = mods.getUint16(o + 38, true);
      const raw = new Uint8Array(mods.buffer, mods.byteOffset + o + 40, 256);
      const end = raw.indexOf(0);
      const path = ascii.decode(raw.subarray(0, end < 0 ? 256 : end));
      modules.push({ name: path.slice(nameOff), path, size, order });
    }

    const now = performance.now();
    const dt = prevPoolT ? (now - prevPoolT) / 1000 : 0;
    prevPoolT = now;
    let pool: Slow["pool"] = [];
    try {
      const pt = query(Class.PoolTag, 1 << 20);
      const cnt = pt.getUint32(0, true);
      const next = new Map<string, number>();
      for (let i = 0; i < cnt; i++) {
        const o = 8 + i * 40;
        const tag = ascii.decode(new Uint8Array(pt.buffer, pt.byteOffset + o, 4)).replace(/[^\x20-\x7e]/g, "?");
        const allocs = pt.getUint32(o + 4, true) + pt.getUint32(o + 24, true);
        const paged = Number(pt.getBigUint64(o + 16, true)) / 1048576;
        const nonPaged = Number(pt.getBigUint64(o + 32, true)) / 1048576;
        const prev = prevPool.get(tag);
        next.set(tag, allocs);
        pool.push({
          tag,
          pagedMB: paged,
          nonPagedMB: nonPaged,
          allocsPerSec: prev !== undefined && dt ? Math.max(0, allocs - prev) / dt : 0,
        });
      }
      prevPool = next;
      pool = pool.sort((a, b) => b.pagedMB + b.nonPagedMB - (a.pagedMB + a.nonPagedMB)).slice(0, 40);
    } catch {
      pool = [];
    }

    return {
      t: new Date().toISOString(),
      basic: { pageSize, physicalMB: (physPages * pageSize) / 1048576, processors: ncpu, timerResolution: timerRes },
      modules,
      pool,
      objectTypes: objectTypes(),
      objects: listDirectory("\\").map((e) => ({ ...e, count: e.type === "Directory" ? listDirectory(`\\${e.name}`).length : 0 })),
    };
  }

  return { ncpu, fast, slow, names: () => names, namesVersion: () => namesVersion };
}

/** Types d'objets du noyau (NtQueryObject(NULL, ObjectTypesInformation = 3)) : OBJECT_TYPE_INFORMATION x64 = 104 octets,
 * nom à la suite, entrées alignées sur 8 ; première entrée à 8 (phnt ntobapi.h). */
let typesBuf = new Uint8Array(1 << 16);
export function objectTypes(): Slow["objectTypes"] {
  const len = new Uint32Array(1);
  for (let i = 0; i < 6; i++) {
    const st = nt.symbols.NtQueryObject(0n, 3, typesBuf, typesBuf.byteLength, len);
    if (st === 0) break;
    if (st !== STATUS_INFO_LENGTH_MISMATCH) return [];
    typesBuf = new Uint8Array(Math.max(typesBuf.byteLength * 2, (len[0] ?? 0) + 4096));
  }
  const v = new DataView(typesBuf.buffer);
  const base = ptr(typesBuf);
  const count = v.getUint32(0, true);
  const out: Slow["objectTypes"] = [];
  let o = 8;
  for (let i = 0; i < count && o + 104 <= typesBuf.byteLength; i++) {
    const maxLen = v.getUint16(o + 2, true);
    out.push({
      name: ustr(v, o, base),
      index: v.getUint8(o + 90),
      objects: v.getUint32(o + 16, true),
      handles: v.getUint32(o + 20, true),
      pagedKB: v.getUint32(o + 24, true) / 1024,
      nonPagedKB: v.getUint32(o + 28, true) / 1024,
    });
    o += 104 + ((maxLen + 7) & ~7);
  }
  return out.sort((a, b) => b.objects - a.objects);
}

/** Contenu d'un répertoire du gestionnaire d'objets (NtOpenDirectoryObject + NtQueryDirectoryObject). */
export function listDirectory(path: string): { name: string; type: string }[] {
  const name = new Uint8Array(Buffer.from(path, "utf16le"));
  const us = new DataView(new ArrayBuffer(16));
  us.setUint16(0, name.byteLength, true);
  us.setUint16(2, name.byteLength, true);
  us.setBigUint64(8, BigInt(ptr(name)), true);
  const oa = new DataView(new ArrayBuffer(48));
  oa.setUint32(0, 48, true);
  oa.setBigUint64(16, BigInt(ptr(new Uint8Array(us.buffer))), true);
  oa.setUint32(24, 0x40, true); // OBJ_CASE_INSENSITIVE
  const h = new BigUint64Array(1);
  if (nt.symbols.NtOpenDirectoryObject(h, 0x0001, new Uint8Array(oa.buffer)) !== 0) return [];
  const out: { name: string; type: string }[] = [];
  const buf = new Uint8Array(1 << 16);
  const ctx = new Uint32Array(1);
  const len = new Uint32Array(1);
  try {
    for (let restart = 1; ; restart = 0) {
      const st = nt.symbols.NtQueryDirectoryObject(h[0]!, buf, buf.byteLength, 0, restart, ctx, len);
      if (st !== 0 && st !== STATUS_MORE_ENTRIES) break;
      const v = new DataView(buf.buffer);
      const base = ptr(buf);
      for (let o = 0; o + 32 <= buf.byteLength; o += 32) {
        if (!v.getUint16(o, true)) break;
        out.push({ name: ustr(v, o, base), type: ustr(v, o + 16, base) });
      }
      if (st !== STATUS_MORE_ENTRIES) break;
    }
  } finally {
    nt.symbols.NtClose(h[0]!);
  }
  return out;
}
