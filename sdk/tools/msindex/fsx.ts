// Parcours de fichiers triés (ordre déterministe), empreintes SHA-256 et état git des dépôts sources.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const isDir = (p: string) => Boolean(statSync(p, { throwIfNoEntry: false })?.isDirectory());
export const dirs = (p: string) =>
  isDir(p)
    ? readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];
export function files(dir: string, re: RegExp, skip?: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(d, e.name);
      if (skip?.test(p)) continue;
      if (e.isDirectory()) walk(p);
      else if (re.test(e.name)) out.push(p);
    }
  };
  if (isDir(dir)) walk(dir);
  return out;
}
export const sha256 = async (file: string) => new Bun.CryptoHasher("sha256").update(await Bun.file(file).bytes()).digest("hex");
export const slash = (p: string) => p.replaceAll("\\", "/");
export const git = (repo: string, ...a: string[]) =>
  Bun.spawnSync(["git", "-C", repo, ...a])
    .stdout.toString()
    .trim();
export const repoState = (repo: string) => ({
  remote: git(repo, "remote", "get-url", "origin").replace(/\.git$/, ""),
  commit: git(repo, "rev-parse", "HEAD"),
  date: git(repo, "log", "-1", "--format=%cs"),
  dirty: git(repo, "status", "--porcelain", "--untracked-files=no") !== "",
});
