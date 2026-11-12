// Exécute une commande dans l'environnement développeur de Visual Studio 2026 (Build Tools ou IDE), sans vcvars manuel :
//   bun sdk/tools/vsdev.ts <commande> [arguments…]      ex. bun ../vsdev.ts cmake --workflow --preset windows
// 1. vswhere (%ProgramFiles(x86)%\Microsoft Visual Studio\Installer) trouve l'installation la plus récente avec MSVC ;
// 2. VsDevCmd.bat -arch=<x64|arm64> -host_arch=<x64|arm64> (Learn « Use the Microsoft C++ toolset from the command line »)
//    fournit cl, link, le SDK Windows, VCPKG_ROOT (composant Microsoft.VisualStudio.Component.Vcpkg) et VSCMD_ARG_TGT_ARCH ;
// 3. CMake 4.5.0 et Ninja 1.13.2 épinglés (sdk/tools/fetch-tools.ts) passent devant ceux de VS dans PATH.
// Cible : NT_ARCH=arm64|x64 (défaut : architecture de l'hôte). Repli VCPKG_ROOT : VCPKG_INSTALLATION_ROOT (runners GitHub).
import { join } from "node:path";

const [cmd, ...args] = Bun.argv.slice(2);
if (!cmd) throw new Error("usage : bun sdk/tools/vsdev.ts <commande> [arguments…]");
if (process.platform !== "win32") throw new Error("vsdev.ts : Windows uniquement");

const tools = import.meta.dir;
const host = process.arch === "arm64" ? "arm64" : "x64";
const target = process.env.NT_ARCH ?? host;
const vsArch = (a: string) => (a === "arm64" ? "arm64" : "amd64"); // valeurs de VsDevCmd -arch / -host_arch
const component = `Microsoft.VisualStudio.Component.VC.Tools.${target === "arm64" ? "ARM64" : "x86.x64"}`;

const vswhere = join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft Visual Studio", "Installer", "vswhere.exe");
const found = Bun.spawnSync([vswhere, "-latest", "-products", "*", "-requires", component, "-property", "installationPath"]);
const vs = found.stdout.toString().trim();
if (!vs) throw new Error(`vsdev.ts : aucune installation Visual Studio avec ${component} (winget configure .config/configuration.winget)`);

// cmd /s retire la première et la dernière guillemet : la ligne doit rester verbatim.
const bat = join(vs, "Common7", "Tools", "VsDevCmd.bat");
const dump = Bun.spawnSync(["cmd.exe", "/d", "/s", "/c", `""${bat}" -arch=${vsArch(target)} -host_arch=${vsArch(host)} -no_logo && set"`], {
  windowsVerbatimArguments: true,
});
if (dump.exitCode !== 0) throw new Error(`vsdev.ts : VsDevCmd.bat a échoué (${dump.exitCode})\n${dump.stderr}`);

const env: Record<string, string> = {};
for (const line of dump.stdout.toString().split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq)] = line.slice(eq + 1);
}
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "Path";
const cmakeBin = join(tools, "cmake", `cmake-4.5.0-windows-${target === "arm64" ? "arm64" : "x86_64"}`, "bin");
env[pathKey] = [cmakeBin, join(tools, "ninja"), env[pathKey]].join(";");
env.VCPKG_ROOT ??= process.env.VCPKG_ROOT ?? process.env.VCPKG_INSTALLATION_ROOT ?? "";
if (!env.VCPKG_ROOT) console.warn("vsdev.ts : VCPKG_ROOT absent (composant Microsoft.VisualStudio.Component.Vcpkg ou clone vcpkg)");

const exe = Bun.which(cmd, { PATH: env[pathKey] });
if (!exe) throw new Error(`vsdev.ts : ${cmd} introuvable dans PATH`);
const run = Bun.spawnSync([exe, ...args], { env, stdio: ["inherit", "inherit", "inherit"] });
process.exit(run.exitCode ?? 1);
