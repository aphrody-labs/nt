// Bibliothèques C/C++ de base de Microsoft :
//   - UCRT : déclarations _ACRTIMP/_DCRTIMP des en-têtes Windows Kits\10\Include\<sdk>\ucrt, reliées aux exports de ucrtbase.dll ;
//   - CRT/STL MSVC livrés dans System32 (vcruntime140*, msvcp140*, concrt140, vccorlib140) : exports, noms C++ dédécorés
//     par UnDecorateSymbolName (dbghelp), regroupés par portée (std::, Concurrency::…) ;
//   - module `import std` : déclarations marquées _EXPORT_STD dans les en-têtes MSVC (ce que std.ixx exporte).
import { basename, join } from "node:path";
import { exportsOf, parsePe } from "../host/pe.ts";
import { files, slash } from "./fsx.ts";
import type { Graph } from "./graph.ts";
import { child } from "./system.ts";

export const CRT_DLLS = [
  "ucrtbase.dll",
  "vcruntime140.dll",
  "vcruntime140_1.dll",
  "vcruntime140_threads.dll",
  "msvcp140.dll",
  "msvcp140_1.dll",
  "msvcp140_2.dll",
  "msvcp140_atomic_wait.dll",
  "msvcp140_codecvt_ids.dll",
  "concrt140.dll",
  "vccorlib140.dll",
];

export async function indexCrt(g: Graph, parent: number, ucrtInclude: string, system32: string, msvc: string) {
  const exports = new Map<string, number>(); // nom exporté (ucrtbase) -> nœud
  const dllNodes = new Map<string, number>();
  for (const dll of CRT_DLLS) {
    const p = join(system32, dll);
    const f = Bun.file(p);
    if (!(await f.exists())) continue;
    const pe = parsePe(await f.arrayBuffer());
    const names = pe ? [...new Set(exportsOf(pe))].sort() : [];
    const decorated = names.filter((n) => n.startsWith("?"));
    const plain = decorated.length ? await child<string[]>({ kind: "undecorate", names: decorated }) : [];
    const und = new Map(decorated.map((n, i) => [n, plain[i]!]));
    const d = g.add(parent, "dll", dll, slash(p), { exports: names.length, decorated: decorated.length, timestamp: pe?.timestamp });
    dllNodes.set(dll, d);
    const scopes = new Map<string, number>();
    for (const n of names) {
      const u = und.get(n);
      // Portée : « std::vector<…>::push_back » -> std ; nom C : préfixe jusqu'au premier « _ » significatif, sinon « (C) ».
      const scope = u ? (/(?:\s|^)((?:[A-Za-z_]\w*::)+)/.exec(u)?.[1]?.split("::")[0] ?? "(global)") : "(C)";
      let s = scopes.get(scope);
      if (!s) scopes.set(scope, (s = g.add(d, "scope", scope, `${dll}!${scope}`)));
      const id = g.add(s, "export", u ?? n, `${dll}!${n}`, { decorated: u ? n : undefined });
      if (dll === "ucrtbase.dll") exports.set(n, id);
    }
  }

  // En-têtes UCRT.
  const hdr = g.add(parent, "headers", "ucrt", slash(ucrtInclude));
  let declared = 0;
  let linked = 0;
  for (const h of files(ucrtInclude, /\.h$/i)) {
    const text = (await Bun.file(h).text()).replace(/\/\/.*$/gm, "");
    const names = new Set<string>();
    for (const m of text.matchAll(/\b_[AD]CRTIMP\b[^;{()]*?\b([A-Za-z_]\w*)\s*\(/g)) names.add(m[1]!);
    if (!names.size) continue;
    const hn = g.add(hdr, "header", basename(h), slash(h.slice(ucrtInclude.length + 1)), { declarations: names.size });
    for (const n of [...names].sort()) {
      const id = g.add(hn, "c-function", n, `ucrt!${n}`);
      declared++;
      const e = exports.get(n);
      if (e) (g.edge(id, e, "exported-as"), linked++);
      g.prove(id, "ucrtbase-export", Boolean(e), e ? "" : "absent des exports de ucrtbase.dll (inline, macro ou bibliothèque statique)");
    }
  }

  // Module `import std` : déclarations _EXPORT_STD des en-têtes MSVC.
  const inc = join(msvc, "include");
  const mod = g.add(parent, "module", "std", slash(join(msvc, "modules", "std.ixx")));
  let exported = 0;
  for (const h of files(inc, /^[a-z_0-9]+(\.h)?$/)) {
    const text = await Bun.file(h).text();
    const names = new Set<string>();
    for (const m of text.matchAll(/_EXPORT_STD\s+([^;{]*?)(?:[;{]|$)/gm)) {
      const decl = m[1]!
        .replace(/template\s*<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const n =
        /^(?:using|namespace)\s+([A-Za-z_]\w*)/.exec(decl)?.[1] ??
        /\b(?:class|struct|union|enum(?: class)?|concept)\s+([A-Za-z_]\w*)/.exec(decl)?.[1] ??
        /(operator\s*[^\s(]+|[A-Za-z_]\w*)\s*\(/.exec(decl)?.[1] ??
        /([A-Za-z_]\w*)\s*(?:=|$)/.exec(decl)?.[1];
      if (n) names.add(n);
    }
    if (!names.size) continue;
    const hn = g.add(mod, "header", basename(h), slash(h.slice(inc.length + 1)), { exports: names.size });
    for (const n of [...names].sort()) (g.add(hn, "std-export", n, `std::${n}@${basename(h)}`), exported++);
  }
  return { dlls: dllNodes.size, declared, linked, exported };
}
