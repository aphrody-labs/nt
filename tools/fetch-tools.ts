// Récupère les binaires épinglés (docs/plan/01-stack.md), selon l'OS hôte :
//   DXC 1.9.2609 (release GitHub microsoft/DirectXShaderCompiler) -> tools/dxc/<windows|linux>/
//   Agility SDK 1.620.2 (NuGet Microsoft.Direct3D.D3D12)          -> tools/dxc/microsoft.direct3d.d3d12/
// Usage : bun tools/fetch-tools.ts
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const root = join(import.meta.dir, "..");
const dir = join(root, "tools", "dxc");
await mkdir(dir, { recursive: true });

const DXC_TAG = "v1.9.2609";
const dxc =
  process.platform === "win32"
    ? { os: "windows", asset: "dxc_2026_09_29.zip", bin: join("bin", "x64", "dxc.exe") }
    : { os: "linux", asset: "linux_dxc_2026_09_28.x86_x64.tar.gz", bin: join("bin", "dxc") };
const dxcDir = join(dir, dxc.os);
if (!(await Bun.file(join(dxcDir, dxc.bin)).exists())) {
  await $`gh release download ${DXC_TAG} -R microsoft/DirectXShaderCompiler -p ${dxc.asset} -D ${dir} --clobber`;
  await mkdir(dxcDir, { recursive: true });
  const archive = join(dir, dxc.asset);
  if (dxc.asset.endsWith(".zip")) await $`unzip -o -q ${archive} -d ${dxcDir}`;
  else await $`tar -xzf ${archive} -C ${dxcDir}`;
  await rm(archive);
}

const AGILITY = "1.620.2";
const agilityDir = join(dir, "microsoft.direct3d.d3d12");
if (!(await Bun.file(join(agilityDir, "build", "native", "bin", "x64", "D3D12Core.dll")).exists())) {
  const pkg = join(dir, "agility.nupkg");
  const url = `https://api.nuget.org/v3-flatcontainer/microsoft.direct3d.d3d12/${AGILITY}/microsoft.direct3d.d3d12.${AGILITY}.nupkg`;
  await Bun.write(pkg, await fetch(url));
  await $`unzip -o -q ${pkg} -d ${agilityDir}`;
  await rm(pkg);
}
console.log(`outils prêts : DXC ${DXC_TAG} (${dxc.os}), Agility SDK ${AGILITY} -> ${dir}`);
