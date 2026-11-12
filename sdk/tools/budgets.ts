// Budgets de taille du cahier des charges (§2-3) vérifiés sur les artefacts de `just build`.
// Usage : bun tools/budgets.ts [--json out.json]   (code 1 si un budget est dépassé ; artefact absent = échec)
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const win = process.platform === "win32";
const rid = `${win ? "win" : process.platform === "darwin" ? "osx" : "linux"}-${process.arch === "arm64" ? "arm64" : "x64"}`;
const target = process.env.NT_TARGET ?? (win ? `${process.arch === "arm64" ? "aarch64" : "x86_64"}-pc-windows-msvc` : "");
const KiB = 1024;
const MiB = 1024 * KiB;
const items = [
  { name: "noyau wasm (target/web/nt.wasm)", path: "target/web/nt.wasm", max: 64 * KiB },
  ...(win ? [{ name: "hôte natif D3D12", path: `target/${target}/release/nt-d3d12.exe`, max: 1 * MiB }] : []),
  { name: "shell .NET NativeAOT", path: `target/dotnet/publish/Nt.Shell/release_${rid}/Nt.Shell${win ? ".exe" : ""}`, max: 8 * MiB },
];

let ok = true;
const rows = [];
for (const it of items) {
  const f = Bun.file(join(root, it.path));
  const size = (await f.exists()) ? f.size : -1;
  const pass = size >= 0 && size <= it.max;
  ok &&= pass;
  rows.push({ ...it, size, pass });
  console.log(
    `${pass ? "OK " : "KO "} ${it.name} : ${size < 0 ? "absent" : `${(size / KiB).toFixed(1)} Kio`} / ${(it.max / KiB).toFixed(0)} Kio`,
  );
}
const i = process.argv.indexOf("--json");
if (i > 0) await Bun.write(process.argv[i + 1]!, JSON.stringify({ date: new Date().toISOString(), rid, rows }, null, 1));
process.exit(ok ? 0 : 1);
