// Copie l'Agility SDK (D3D12Core.dll, d3d12SDKLayers.dll) dans <dossier de l'exe>/D3D12/, chemin lu par l'exe
// via son export D3D12SDKPath = ".\D3D12\". Usage : bun sdk/tools/stage-native.ts <dossier-de-sortie-cargo> [x64|arm64]
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const [outDir, arch = process.arch === "arm64" ? "arm64" : "x64"] = process.argv.slice(2);
if (!outDir) throw new Error("usage : bun sdk/tools/stage-native.ts <dossier-de-sortie> [x64|arm64]");
const sdk = join(import.meta.dir, "dxc", "microsoft.direct3d.d3d12", "build", "native", "bin", arch);
const dest = join(outDir, "D3D12");
await mkdir(dest, { recursive: true });
let n = 0;
for (const f of ["D3D12Core.dll", "d3d12SDKLayers.dll"]) {
  if (await Bun.file(join(sdk, f)).exists()) {
    await copyFile(join(sdk, f), join(dest, f));
    n++;
  }
}
if (n === 0) throw new Error(`Agility SDK absent de ${sdk} : lancer \`just tools\``);
console.log(`Agility SDK (${arch}) -> ${dest} (${n} fichiers)`);
