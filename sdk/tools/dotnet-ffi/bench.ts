// Coût d'appel bun -> .NET sans node-api-dotnet (CI, après `just interop`) -> target/bench/dotnet-ffi-<rid>.json.
// Modes, chacun dans son propre processus : c (fonction de l'OS via bun:ffi), js (fonction JS), aot (NativeAOT, dlopen),
// coreclr (CoreCLR hébergé par hostfxr, pointeurs liés par CFunction). Médiane de 7 séries, ns par appel.
import { dlopen } from "bun:ffi";
import { mkdir } from "node:fs/promises";
import { cpus } from "node:os";
import { join } from "node:path";
import { openHosted } from "./hostfxr.ts";
import { type Api, built, load, paths, rid } from "./interop.ts";

const N = 1_000_000;
const RUNS = 7;
const CALLBACKS = 200_000;

const median = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1]!;
function measure(n: number, body: (n: number) => void): number {
  body(Math.min(n, 20_000)); // échauffement (JIT de JavaScriptCore, liaison paresseuse)
  const out: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    const t0 = Bun.nanoseconds();
    body(n);
    out.push((Bun.nanoseconds() - t0) / n);
  }
  return Math.round(median(out) * 10) / 10;
}

async function child(mode: string): Promise<Record<string, number | string>> {
  const r: Record<string, number | string> = {};
  if (mode === "js") {
    const add = (a: number, b: number) => (a + b) | 0;
    r.add = measure(N, (n) => {
      let s = 0;
      for (let i = 0; i < n; i++) s = add(i, s);
      if (s === 0.5) console.log(s);
    });
    return r;
  }
  if (mode === "c") {
    const win = process.platform === "win32";
    const t0 = performance.now();
    // Fonctions C sans appel système : coût de la seule transition bun:ffi (getpid est un appel système sous Linux).
    const lib = win
      ? dlopen("kernel32.dll", { GetCurrentProcessId: { args: [], returns: "u32" } })
      : dlopen(process.platform === "darwin" ? "libSystem.B.dylib" : "libc.so.6", { abs: { args: ["i32"], returns: "i32" } });
    r.openMs = Math.round((performance.now() - t0) * 100) / 100;
    const s = lib.symbols as Record<string, (x?: number) => number>;
    const f = (win ? s.GetCurrentProcessId : s.abs)!;
    // Arité exacte : un argument en trop fait quitter le chemin rapide du DFG (8 ns au lieu de 2,2 ns constatés).
    r.noop = win
      ? measure(N, (n) => {
          for (let i = 0; i < n; i++) f();
        })
      : measure(N, (n) => {
          for (let i = 0; i < n; i++) f(i);
        });
    r.label = win ? "kernel32!GetCurrentProcessId" : "libc!abs";
    return r;
  }
  const b = await load();
  const t0 = performance.now();
  const api: Api = mode === "aot" ? b.openNative(paths.native) : openHosted(b, paths.il);
  r.openMs = Math.round((performance.now() - t0) * 100) / 100;
  r.framework = api.framework();
  r.noop = measure(N, (n) => {
    for (let i = 0; i < n; i++) api.noop();
  });
  r.add = measure(N, (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s = api.add(i, s);
    if (s === 0.5) console.log(s);
  });
  r.tickCountI64 = measure(N, (n) => {
    for (let i = 0; i < n; i++) api.tickCount();
  });
  const info = new b.NtSystemInfo();
  r.systemInfoStruct = measure(N / 10, (n) => {
    for (let i = 0; i < n; i++) api.systemInfo(info);
  });
  const text = "héllo wörld ✓";
  r.utf8InCstring = measure(N, (n) => {
    for (let i = 0; i < n; i++) api.utf8Length(text);
  });
  r.utf16InBuffer = measure(N, (n) => {
    for (let i = 0; i < n; i++) api.utf16Length(text);
  });
  r.utf16OutString = measure(N / 10, (n) => {
    for (let i = 0; i < n; i++) api.machineName();
  });
  // Rappel .NET -> JS : JSCallback créé une fois, coût par rappel.
  const t1 = Bun.nanoseconds();
  for (let r2 = 0; r2 < 3; r2++) api.sumCallbacks((i) => i, CALLBACKS);
  r.callbackPerCall = Math.round(((Bun.nanoseconds() - t1) / (3 * CALLBACKS)) * 10) / 10;
  return r;
}

const modeArg = process.argv.indexOf("--mode");
if (modeArg >= 0) {
  console.log(JSON.stringify(await child(process.argv[modeArg + 1]!)));
} else {
  if (!built) {
    console.error(`artefacts absents (${paths.native}) : lancer \`just interop\` (CI)`);
    process.exit(1);
  }
  const results: Record<string, Record<string, number | string>> = {};
  for (const mode of ["js", "c", "aot", "coreclr"]) {
    const p = Bun.spawnSync([process.execPath, import.meta.path, "--mode", mode], { stderr: "inherit" });
    if (p.exitCode !== 0) throw new Error(`mode ${mode} : code ${p.exitCode}`);
    results[mode] = JSON.parse(p.stdout.toString().trim().split("\n").pop()!);
  }
  const report = {
    date: new Date().toISOString(),
    rid,
    cpu: cpus()[0]?.model ?? "",
    bun: `${Bun.version}+${Bun.revision.slice(0, 9)}`,
    iterations: N,
    unit: "ns/appel (médiane de 7)",
    results,
  };
  const dir = join(import.meta.dir, "..", "..", "..", "target", "bench");
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, `dotnet-ffi-${rid}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const cases = [...new Set(Object.values(results).flatMap((r) => Object.keys(r)))].filter((k) => !["label", "framework"].includes(k));
  const md = [
    `### bun -> .NET (${rid}, ${report.cpu}, bun ${report.bun})`,
    "",
    `| cas | ${Object.keys(results).join(" | ")} |`,
    `|---|${Object.keys(results)
      .map(() => "---:")
      .join("|")}|`,
    ...cases.map(
      (c) =>
        `| ${c} | ${Object.values(results)
          .map((r) => r[c] ?? "")
          .join(" | ")} |`,
    ),
    "",
    `aot : ${results.aot?.framework} ; coreclr : ${results.coreclr?.framework} ; c : ${results.c?.label}`,
  ].join("\n");
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) await Bun.write(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}
