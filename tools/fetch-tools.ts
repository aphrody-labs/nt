// Récupère les binaires épinglés (docs/plan/01-stack.md), selon l'OS hôte :
//   DXC 1.9.2609 (release GitHub microsoft/DirectXShaderCompiler) -> tools/dxc/<windows|linux>/
//   Agility SDK 1.620.2 (NuGet Microsoft.Direct3D.D3D12)          -> tools/dxc/microsoft.direct3d.d3d12/
//   niubash 1.5.0 (Windows : shell des recettes just, SHA256SUMS)  -> tools/niubash/ (ajouté à GITHUB_PATH en CI)
// Usage : bun tools/fetch-tools.ts
// Extraction : bsdtar de Windows (System32\tar.exe, lit les zip) ; unzip/tar sous Unix.
import { appendFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const root = join(import.meta.dir, "..");
const win = process.platform === "win32";
const dir = join(root, "tools", "dxc");
await mkdir(dir, { recursive: true });
const extract = async (archive: string, dest: string) => {
  await mkdir(dest, { recursive: true });
  if (win) await $`${join(process.env.SystemRoot!, "System32", "tar.exe")} -xf ${archive} -C ${dest}`;
  else if (archive.endsWith(".tar.gz")) await $`tar -xzf ${archive} -C ${dest}`;
  else await $`unzip -o -q ${archive} -d ${dest}`;
  await rm(archive);
};

const DXC_TAG = "v1.9.2609";
const dxc = win
  ? { os: "windows", asset: "dxc_2026_09_29.zip", bin: join("bin", "x64", "dxc.exe") }
  : { os: "linux", asset: "linux_dxc_2026_09_28.x86_x64.tar.gz", bin: join("bin", "dxc") };
const dxcDir = join(dir, dxc.os);
if (!(await Bun.file(join(dxcDir, dxc.bin)).exists())) {
  await $`gh release download ${DXC_TAG} -R microsoft/DirectXShaderCompiler -p ${dxc.asset} -D ${dir} --clobber`;
  await extract(join(dir, dxc.asset), dxcDir);
  if (!win) await $`chmod +x ${join(dxcDir, dxc.bin)}`;
}

const AGILITY = "1.620.2";
const agilityDir = join(dir, "microsoft.direct3d.d3d12");
if (!(await Bun.file(join(agilityDir, "build", "native", "bin", "x64", "D3D12Core.dll")).exists())) {
  const pkg = join(dir, "agility.nupkg.zip");
  const url = `https://api.nuget.org/v3-flatcontainer/microsoft.direct3d.d3d12/${AGILITY}/microsoft.direct3d.d3d12.${AGILITY}.nupkg`;
  await Bun.write(pkg, await fetch(url));
  await extract(pkg, agilityDir);
}

let shell = "";
if (win) {
  const NIUBASH = "1.5.0";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const asset = `niubash-v${NIUBASH}-win-${arch}.zip`;
  const sha: Record<string, string> = {
    x64: "bb2e142ec617e91cb48bde8c0fa2b9cce2dc95bfc00857c82cef6a7ad4e12bcc", // SHA256SUMS de la release v1.5.0
    arm64: "f4b0fab55bd2f3e894bd2aea2f2bf8e02b6661d3d67aa15483ed5cc865d49bb3",
  };
  const nbDir = join(root, "tools", "niubash");
  const bin = join(nbDir, `niubash-v${NIUBASH}-win-${arch}`);
  if (!(await Bun.file(join(bin, "niu.exe")).exists())) {
    await mkdir(nbDir, { recursive: true });
    await $`gh release download v${NIUBASH} -R unixwin/niubash -p ${asset} -D ${nbDir} --clobber`;
    const got = new Bun.CryptoHasher("sha256").update(await Bun.file(join(nbDir, asset)).bytes()).digest("hex");
    if (got !== sha[arch]) throw new Error(`niubash : SHA256 ${got} != ${sha[arch]}`);
    await extract(join(nbDir, asset), nbDir);
  }
  if (process.env.GITHUB_PATH) await appendFile(process.env.GITHUB_PATH, `${bin}\n`);
  shell = `, niubash ${NIUBASH} -> ${bin}`;
}
console.log(`outils prêts : DXC ${DXC_TAG} (${dxc.os}), Agility SDK ${AGILITY}${shell}`);
