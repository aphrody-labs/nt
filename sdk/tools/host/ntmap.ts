// Carte du Windows NT de CE poste, relevée sur les binaires installés et le système en marche (aucune donnée
// inventée) : exports de ntoskrnl / hal / ntdll groupés par composant (préfixe NT), couches Win32 (imports),
// win32k, chaîne de démarrage, pilotes chargés, processus système. Sortie : docs/research/windows-nt-map.json.
// Usage : bun sdk/tools/host/ntmap.ts   (Windows uniquement)
import { join } from "node:path";
import { createSampler } from "./ntsys.ts";
import { exportsOf, importsOf, parsePe } from "./pe.ts";
import { processPath } from "./pe-icon.ts";

const sys = process.env.SystemRoot ?? "C:\\Windows";
const s32 = join(sys, "System32");
const pe = async (p: string) => {
  try {
    const f = Bun.file(p);
    return { size: f.size, pe: parsePe(await f.arrayBuffer()) };
  } catch {
    return null;
  }
};

/** Préfixes de composants NT (le plus long d'abord). */
const PREFIXES = [
  "Alpc",
  "Cc",
  "Cm",
  "Dbgk",
  "Dbg",
  "Etw",
  "Ex",
  "FsRtl",
  "Hal",
  "Hv",
  "Inbv",
  "Io",
  "Kd",
  "Ke",
  "Ki",
  "Ldr",
  "Lsa",
  "Mm",
  "Nls",
  "Nt",
  "Ob",
  "Pf",
  "Po",
  "Ps",
  "Rtl",
  "Se",
  "Tm",
  "Tp",
  "Vf",
  "Wmi",
  "Wnf",
  "Zw",
  "Csr",
  "Pss",
  "Sbs",
].sort((a, b) => b.length - a.length);
const component = (name: string) => PREFIXES.find((p) => name.startsWith(p) && /[A-Z_]/.test(name[p.length] ?? "")) ?? "(autre)";
const group = (names: string[]) => {
  const g: Record<string, { count: number; sample: string[] }> = {};
  for (const n of names) {
    const c = component(n);
    g[c] ??= { count: 0, sample: [] };
    g[c].count++;
    if (g[c].sample.length < 6) g[c].sample.push(n);
  }
  return Object.fromEntries(Object.entries(g).sort((a, b) => b[1].count - a[1].count));
};
const image = async (p: string, withImports = false) => {
  const r = await pe(p);
  if (!r?.pe) return { path: p, present: false };
  const ex = exportsOf(r.pe);
  return {
    path: p,
    present: true,
    size: r.size,
    machine: r.pe.machine,
    timestamp: r.pe.timestamp,
    exports: ex.length,
    ...(withImports ? { imports: [...new Set(importsOf(r.pe))].sort() } : {}),
    components: group(ex),
  };
};

const sampler = createSampler();
sampler.fast();
const slow = sampler.slow();
const u = new Uint32Array(sampler.fast());
const names = sampler.names();
const procs: { pid: number; ppid: number; name: string; session: number; path: string }[] = [];
const base = 8 + 16 + u[1]! * 8;
for (let i = 0; i < u[2]!; i++) {
  const o = base + i * 12;
  procs.push({ pid: u[o]!, ppid: u[o + 1]!, name: names[u[o + 10]!] ?? "?", session: u[o + 11]!, path: processPath(u[o]!) });
}
const SYSTEM = [
  "System",
  "Registry",
  "smss.exe",
  "csrss.exe",
  "wininit.exe",
  "services.exe",
  "lsass.exe",
  "winlogon.exe",
  "fontdrvhost.exe",
  "dwm.exe",
  "explorer.exe",
  "svchost.exe",
  "LsaIso.exe",
  "Secure System",
  "MemCompression",
];

const map = {
  date: new Date().toISOString(),
  source: "binaires de %SystemRoot% et système en marche (ntdll via bun:ffi), relevé par sdk/tools/host/ntmap.ts",
  boot: await Promise.all(
    [join(sys, "Boot", "EFI", "bootmgfw.efi"), join(s32, "winload.efi"), join(s32, "winresume.efi")].map((p) => image(p)),
  ),
  kernel: { ntoskrnl: await image(join(s32, "ntoskrnl.exe"), true), hal: await image(join(s32, "hal.dll"), true) },
  win32k: await Promise.all(["win32k.sys", "win32kbase.sys", "win32kfull.sys", "win32kbase_rs.sys"].map((f) => image(join(s32, f), true))),
  native: { ntdll: await image(join(s32, "ntdll.dll")) },
  win32: await Promise.all(
    [
      "kernelbase.dll",
      "kernel32.dll",
      "user32.dll",
      "gdi32.dll",
      "advapi32.dll",
      "combase.dll",
      "dxgi.dll",
      "d3d12.dll",
      "dwmapi.dll",
      "dcomp.dll",
    ].map((f) => image(join(s32, f), true)),
  ),
  drivers: slow.modules.map((m) => ({ order: m.order, name: m.name, path: m.path, size: m.size })),
  objectTypes: slow.objectTypes.map((t) => ({ name: t.name, index: t.index, objects: t.objects })),
  systemProcesses: procs
    .filter((p) => SYSTEM.includes(p.name))
    .map((p) => ({ ...p, children: procs.filter((c) => c.ppid === p.pid).length })),
  counts: {
    processors: slow.basic.processors,
    processes: procs.length,
    drivers: slow.modules.length,
    objectTypes: slow.objectTypes.length,
  },
};
const out = join(import.meta.dir, "..", "..", "..", "docs", "research", "windows-nt-map.json");
// Les composants : résumé compact (pas d'échantillons pour les binaires win32, trop volumineux).
await Bun.write(
  out,
  JSON.stringify(map, (k, v) => (k === "sample" && Array.isArray(v) ? v.slice(0, 4) : v), 1),
);
const k = map.kernel.ntoskrnl as { exports?: number; components?: Record<string, { count: number }> };
console.log(
  JSON.stringify({
    out,
    ntoskrnlExports: k.exports,
    components: Object.entries(k.components ?? {})
      .slice(0, 14)
      .map(([c, v]) => `${c}:${v.count}`)
      .join(" "),
    ...map.counts,
  }),
);
