// Évaluation statique des CMakeLists.txt de LiberNT : modules (add_library / add_executable), sources, type de module
// (set_module_type), exports (spec2def), dépendances (add_importlibs, add_delay_importlibs, target_link_libraries).
// Langage CMake (cmake-language(7)) : commandes « nom(arguments) », arguments entre guillemets, crochets ou nus, ${VAR}.
// Conditions : if/elseif/else évalués pour la configuration cible (ARCH, définitions connues) ; une condition inconnue est
// considérée vraie et le module est marqué « conditional ».
import { join, relative } from "node:path";
import { slash } from "../msindex/fsx.ts";

export type Module = {
  name: string;
  kind: "library" | "executable";
  dir: string; // relatif à la racine LiberNT
  sources: string[]; // relatifs à la racine LiberNT
  type?: string; // win32dll, kernelmodedriver, nativecui…
  spec?: string;
  imports: string[];
  delayImports: string[];
  links: string[];
  conditional: boolean;
};

type Cmd = { name: string; args: string[]; line: number };

function tokenize(text: string): Cmd[] {
  const out: Cmd[] = [];
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    if (c === "\n") (line++, i++);
    else if (c === "#") {
      if (text.startsWith("#[[", i) || /^#\[=*\[/.test(text.slice(i, i + 10))) {
        const eq = /^#\[(=*)\[/.exec(text.slice(i))![1]!;
        const end = text.indexOf(`]${eq}]`, i);
        line += (text.slice(i, end).match(/\n/g) ?? []).length;
        i = end < 0 ? n : end + eq.length + 2;
      } else while (i < n && text[i] !== "\n") i++;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i, i + 128))!;
      const name = m[0].toLowerCase();
      let j = i + m[0].length;
      while (j < n && /[ \t]/.test(text[j]!)) j++;
      if (text[j] !== "(") {
        i = j;
        continue;
      }
      const start = line;
      j++;
      const args: string[] = [];
      let depth = 1;
      while (j < n && depth > 0) {
        const d = text[j]!;
        if (d === "\n") (line++, j++);
        else if (/\s/.test(d)) j++;
        else if (d === "#") while (j < n && text[j] !== "\n") j++;
        else if (d === "(") (depth++, j++);
        else if (d === ")") (depth--, j++);
        else if (d === '"') {
          let s = "";
          j++;
          while (j < n && text[j] !== '"') {
            if (text[j] === "\\" && j + 1 < n) ((s += text[j + 1]), (j += 2));
            else {
              if (text[j] === "\n") line++;
              s += text[j++];
            }
          }
          j++;
          args.push(s);
        } else if (d === "[" && /^\[=*\[/.test(text.slice(j, j + 10))) {
          const eq = /^\[(=*)\[/.exec(text.slice(j))![1]!;
          const end = text.indexOf(`]${eq}]`, j);
          args.push(text.slice(j + eq.length + 2, end));
          j = end + eq.length + 2;
        } else {
          let s = "";
          while (j < n && !/[\s()#"]/.test(text[j]!)) s += text[j++];
          args.push(s);
        }
      }
      out.push({ name, args, line: start });
      i = j;
    } else i++;
  }
  return out;
}

export async function evaluate(root: string, defs: Record<string, string>) {
  const modules = new Map<string, Module>();
  const vars = new Map<string, string>(Object.entries(defs));
  const files: string[] = [];
  const expand = (s: string, local: Map<string, string>): string =>
    s
      .replace(/\$\{([^${}]+)\}/g, (_, v: string) => local.get(v) ?? vars.get(v) ?? "")
      .replace(/\$\{([^${}]+)\}/g, (_, v: string) => local.get(v) ?? vars.get(v) ?? "");
  const list = (args: string[], local: Map<string, string>) => args.flatMap((a) => expand(a, local).split(";")).filter(Boolean);

  const truthy = (args: string[], local: Map<string, string>): boolean | null => {
    const a = args.map((x) => expand(x, local));
    if (a.length === 1) {
      const v = a[0]!.toUpperCase();
      if (["1", "ON", "YES", "TRUE", "Y"].includes(v)) return true;
      if (["0", "OFF", "NO", "FALSE", "N", "", "IGNORE", "NOTFOUND"].includes(v) || v.endsWith("-NOTFOUND")) return false;
      const val = local.get(a[0]!) ?? vars.get(a[0]!);
      return val === undefined ? null : truthy([val], local);
    }
    if (a[0] === "NOT") {
      const r = truthy(a.slice(1), local);
      return r === null ? null : !r;
    }
    const and = a.indexOf("AND");
    if (and > 0) {
      const l = truthy(a.slice(0, and), local);
      const r = truthy(a.slice(and + 1), local);
      return l === false || r === false ? false : l === null || r === null ? null : true;
    }
    const or = a.indexOf("OR");
    if (or > 0) {
      const l = truthy(a.slice(0, or), local);
      const r = truthy(a.slice(or + 1), local);
      return l === true || r === true ? true : l === null || r === null ? null : false;
    }
    if (a.length === 3 && ["STREQUAL", "EQUAL", "MATCHES"].includes(a[1]!)) {
      const lhs = local.get(a[0]!) ?? vars.get(a[0]!) ?? (/^[A-Z_]+$/.test(a[0]!) ? undefined : a[0]);
      if (lhs === undefined) return null;
      if (a[1] === "MATCHES") return new RegExp(a[2]!).test(lhs);
      return lhs === a[2];
    }
    if (a[0] === "DEFINED") return vars.has(a[1]!) || local.has(a[1]!);
    if (a[0] === "MSVC") return defs.MSVC === "1";
    return null;
  };

  const run = async (dir: string, local: Map<string, string>) => {
    const file = join(dir, "CMakeLists.txt");
    const f = Bun.file(file);
    if (!(await f.exists())) return;
    files.push(slash(relative(root, file)));
    const cmds = tokenize(await f.text());
    // Pile des conditions : [actif, déjà pris, inconnu].
    const stack: { on: boolean; taken: boolean; unknown: boolean }[] = [];
    const active = () => stack.every((s) => s.on);
    const unknown = () => stack.some((s) => s.unknown);
    const mod = (name: string) => modules.get(name);
    for (const c of cmds) {
      if (c.name === "if") {
        const r = truthy(c.args, local);
        stack.push({ on: r !== false, taken: r === true, unknown: r === null });
        continue;
      }
      if (c.name === "elseif") {
        const s = stack.at(-1)!;
        const r = s.taken ? false : truthy(c.args, local);
        s.on = r !== false;
        s.taken ||= r === true;
        s.unknown = r === null;
        continue;
      }
      if (c.name === "else") {
        const s = stack.at(-1)!;
        s.on = !s.taken;
        continue;
      }
      if (c.name === "endif") {
        stack.pop();
        continue;
      }
      if (!active()) continue;
      const a = c.args;
      switch (c.name) {
        case "set":
          if (a[0])
            local.set(
              a[0],
              list(
                a.slice(1).filter((x) => !["CACHE", "PARENT_SCOPE", "FORCE", "INTERNAL", "STRING", "BOOL", "PATH"].includes(x)),
                local,
              ).join(";"),
            );
          break;
        case "list":
          if (a[0] === "APPEND" && a[1])
            local.set(
              a[1],
              [...(local.get(a[1]) ?? vars.get(a[1]) ?? "").split(";").filter(Boolean), ...list(a.slice(2), local)].join(";"),
            );
          else if (a[0] === "REMOVE_ITEM" && a[1]) {
            const rm = new Set(list(a.slice(2), local));
            local.set(
              a[1],
              (local.get(a[1]) ?? "")
                .split(";")
                .filter((x) => x && !rm.has(x))
                .join(";"),
            );
          }
          break;
        case "add_subdirectory":
          if (a[0]) await run(join(dir, expand(a[0], local)), new Map(local));
          break;
        case "add_library":
        case "add_executable": {
          const name = expand(a[0] ?? "", local);
          const srcs = list(a.slice(1), local).filter(
            (x) => !["MODULE", "SHARED", "STATIC", "OBJECT", "INTERFACE", "WIN32", "EXCLUDE_FROM_ALL", "IMPORTED", "ALIAS"].includes(x),
          );
          const resolved = srcs
            .filter((s) => /\.(c|cc|cpp|cxx|s|asm|rc|h|hpp|idl|spec)$/i.test(s) || !s.includes("."))
            .filter((s) => /\.\w+$/.test(s))
            .map((s) => slash(relative(root, s.startsWith("/") || /^[A-Za-z]:/.test(s) ? s : join(dir, s))));
          const prev = mod(name);
          modules.set(name, {
            name,
            kind: c.name === "add_library" ? "library" : "executable",
            dir: slash(relative(root, dir)),
            sources: [...new Set([...(prev?.sources ?? []), ...resolved])],
            type: prev?.type,
            spec: prev?.spec ?? local.get(`__spec_${name}`),
            imports: prev?.imports ?? [],
            delayImports: prev?.delayImports ?? [],
            links: prev?.links ?? [],
            conditional: unknown(),
          });
          break;
        }
        case "spec2def": {
          // spec2def(<module>.dll <fichier>.spec …) : le module porte le nom du binaire sans extension.
          const bin = expand(a[0] ?? "", local);
          const spec = slash(relative(root, join(dir, expand(a[1] ?? "", local))));
          const name = bin.replace(/\.[^.]+$/, "");
          local.set(`__spec_${name}`, spec);
          const m = mod(name);
          if (m) m.spec = spec;
          break;
        }
        case "set_module_type": {
          const m = mod(expand(a[0] ?? "", local));
          if (m) m.type = a[1];
          break;
        }
        case "add_importlibs":
        case "add_delay_importlibs":
        case "target_link_libraries": {
          const m = mod(expand(a[0] ?? "", local));
          if (!m) break;
          const libs = list(a.slice(c.name === "add_delay_importlibs" ? 1 : 1), local).filter(
            (x) => !["PRIVATE", "PUBLIC", "INTERFACE"].includes(x),
          );
          const into = c.name === "add_importlibs" ? m.imports : c.name === "add_delay_importlibs" ? m.delayImports : m.links;
          for (const l of libs) if (!into.includes(l)) into.push(l);
          break;
        }
      }
    }
  };
  await run(root, new Map());
  // Nom de module -> spec : spec2def appelé avant add_library est rattaché ici.
  return { modules: [...modules.values()].sort((x, y) => (x.dir + x.name < y.dir + y.name ? -1 : 1)), files };
}
