// Code source du Windows App SDK relié à sa surface livrée : dépôts microsoft/WindowsAppSDK (composants dev/*, fonctionnalités
// TerminalVelocity dev/Common, specs/, test/) et microsoft/microsoft-ui-xaml (contrôles controls/dev/*, cœur dxaml/xcp/dxaml/idl).
// Analyse lexicale des IDL MIDL3 : espaces de noms imbriqués (macros #define résolues), déclarations, attributs feature().
import { basename, join, relative } from "node:path";
import { dirs, files, slash } from "./fsx.ts";
import type { Graph } from "./graph.ts";

const KINDS = /\b(runtimeclass|interface|enum|struct|delegate|apicontract)\s+(?:[\w.<>, ]+\s+)?([A-Za-z_]\w*)(?=\s*(?:[:{;(]|requires\b))/g;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function indexSources(g: Graph, wasdkNode: number, muxNode: number, wasdk: string, mux: string, shipped: Map<string, number>) {
  const features = new Map<string, number>();
  const sourceTypes = new Map<string, number>();

  const idl = async (comp: number, repo: string, file: string, macros: Map<string, string>) => {
    let text = await Bun.file(file).text();
    const local = new Map(macros);
    for (const m of text.matchAll(/^#define\s+(\w+)\s+([\w.]+)\s*$/gm)) local.set(m[1]!, m[2]!);
    text = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const node = g.add(comp, "idl", basename(file), slash(relative(repo, file)));
    const stack: { ns: string; depth: number }[] = [];
    const at: { pos: number; ns: string }[] = [];
    let depth = 0;
    let pending: string | null = null;
    for (const m of text.matchAll(/namespace\s+([\w.]+)|[{}]/g)) {
      if (m[1]) pending = local.get(m[1]) ?? m[1];
      else if (m[0] === "{") {
        depth++;
        if (pending) stack.push({ ns: [...stack.map((s) => s.ns), pending].join("."), depth });
        pending = null;
      } else {
        if (stack.at(-1)?.depth === depth) stack.pop();
        depth--;
      }
      at.push({ pos: m.index!, ns: stack.at(-1)?.ns ?? "" });
    }
    const nsOf = (pos: number) => {
      let lo = 0;
      let hi = at.length - 1;
      let ns = "";
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (at[mid]!.pos <= pos) ((ns = at[mid]!.ns), (lo = mid + 1));
        else hi = mid - 1;
      }
      return ns;
    };
    let count = 0;
    for (const m of text.matchAll(KINDS)) {
      const ns = nsOf(m.index!);
      if (!ns) continue;
      const head = text.slice(Math.max(0, m.index! - 400), m.index!);
      const tail = head.slice(head.lastIndexOf(";") + 1);
      const attrs = tail.slice(tail.lastIndexOf("}") + 1);
      const feat = [...attrs.matchAll(/feature\((\w+)\)/g)].map((x) => x[1]!);
      const full = `${ns}.${m[2]}`;
      const n = g.add(node, `idl-${m[1]}`, m[2]!, full, {
        feature: feat.length ? feat : undefined,
        preview: /MUX_PREVIEW|experimental/.test(attrs) || undefined,
        internal: /MUX_INTERNAL/.test(attrs) || undefined,
      });
      sourceTypes.set(full, n);
      for (const f of feat) g.edge(n, features.get(f) ?? 0, "gated-by");
      g.edge(shipped.get(full) ?? 0, n, "defined-in");
      count++;
    }
    for (const m of text.matchAll(/\[([^\]]*?\bfeature\((\w+)\)[^\]]*)\]\s*([^;{[]+)/g)) {
      const decl = m[3]!.replace(/\s+/g, " ").trim().slice(0, 120);
      g.edge(
        g.add(node, "idl-gated", decl, `${nsOf(m.index!)}:${decl}`, { feature: m[2], attributes: m[1]!.trim() }),
        features.get(m[2]!) ?? 0,
        "gated-by",
      );
    }
    g.node(node).data.types = count;
  };

  // WindowsAppSDK
  const area = new Map<string, string>();
  for (const x of files(join(wasdk, "dev", "Common"), /^TerminalVelocityFeatures-.*\.xml$/)) {
    const a = basename(x).replace(/^TerminalVelocityFeatures-|\.xml$/g, "");
    for (const f of (await Bun.file(x).text()).matchAll(/<feature>([\s\S]*?)<\/feature>/g)) {
      const get = (t: string) => new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(f[1]!)?.[1]?.trim();
      const name = get("name")!;
      const channels = [...f[1]!.matchAll(/<channelToken>(\w+)<\/channelToken>/g)].map((c) => c[1]!);
      features.set(
        name,
        g.add(wasdkNode, "feature", name, name, {
          area: a,
          state: get("state"),
          description: get("description"),
          disabledChannels: channels.length ? channels : undefined,
          file: slash(relative(wasdk, x)),
        }),
      );
      area.set(name, a);
    }
  }
  const specs = dirs(join(wasdk, "specs"));
  const tests = dirs(join(wasdk, "test"));
  for (const c of dirs(join(wasdk, "dev"))) {
    if (c === "Templates") continue; // gabarits de projets, pas d'API
    const all = files(join(wasdk, "dev", c), /.*/);
    const ext = Object.entries(Object.groupBy(all, (f) => (/\.([a-z0-9]+)$/i.exec(f)?.[1] ?? "").toLowerCase()))
      .map(([k, v]) => [k, v!.length] as const)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 6);
    const spec = specs.find((s) => norm(s) === norm(c));
    const test = tests.find((s) => norm(s) === norm(c));
    const comp = g.add(wasdkNode, "component", c, `dev/${c}`, {
      files: all.length,
      languages: Object.fromEntries(ext),
      spec: spec && `specs/${spec}`,
      test: test && `test/${test}`,
    });
    for (const [f, a] of area) if (norm(a).startsWith(norm(c)) || norm(c).startsWith(norm(a))) g.edge(features.get(f)!, comp, "feature-of");
    for (const f of all.filter((x) => /\.idl$/i.test(x))) await idl(comp, wasdk, f, new Map());
    const sites = new Map<string, string[]>();
    for (const src of all.filter((x) => /\.(cpp|h|hpp|cs)$/i.test(x)))
      for (const m of new Set((await Bun.file(src).text()).match(/\bFeature_\w+/g) ?? []))
        if (features.has(m)) (sites.get(m) ?? sites.set(m, []).get(m)!).push(slash(relative(wasdk, src)));
    for (const [name, list] of sites) {
      g.edge(features.get(name)!, comp, "checked-in");
      const d = g.node(features.get(name)!).data;
      d.codeSites = [...((d.codeSites as string[]) ?? []), ...list];
    }
  }

  // microsoft-ui-xaml
  const macros = new Map<string, string>();
  for (const m of (await Bun.file(join(mux, "controls", "idl", "Microsoft.UI.Xaml.Controls.idl")).text()).matchAll(
    /^#define\s+(\w+)\s+([\w.]+)\s*$/gm,
  ))
    macros.set(m[1]!, m[2]!);
  for (const c of dirs(join(mux, "controls", "dev"))) {
    const list = files(join(mux, "controls", "dev", c), /\.idl$/i, /[\\/](TestUI|APITests|InteractionTests)$/i);
    if (!list.length) continue;
    const comp = g.add(muxNode, "component", c, `controls/dev/${c}`, { idl: list.length });
    for (const f of list) await idl(comp, mux, f, macros);
  }
  const core = join(mux, "dxaml", "xcp", "dxaml", "idl");
  for (const c of dirs(core)) {
    const comp = g.add(muxNode, "component", `dxaml/${c}`, `dxaml/xcp/dxaml/idl/${c}`);
    for (const f of files(join(core, c), /\.idl$/i)) await idl(comp, mux, f, macros);
  }
  return { features, sourceTypes };
}
