// Index et graphe récursif de fonctionnalités du Windows App SDK, relevés uniquement sur ses artefacts réels :
//   1. surface livrée : métadonnées WinRT (.winmd, ECMA-335) des paquets NuGet Microsoft.WindowsAppSDK.* de la version
//      épinglée par Directory.Packages.props, plus leur documentation XML (résumés) et leurs nuspec (dépendances) ;
//   2. code source : dépôts microsoft/WindowsAppSDK et microsoft/microsoft-ui-xaml (IDL, fonctionnalités TerminalVelocity,
//      specs, tests), reliés aux types livrés par nom complet.
// Arbre : sdk > paquet > winmd > espace de noms > type > membre ; dépôt > composant > idl > type ; fonctionnalité > composant.
// Sorties : target/index/winappsdk.sqlite (nœuds, arêtes, FTS5 trigramme), docs/winappsdk/feature-graph.{json,md}.
// Usage : bun sdk/tools/winappsdk-graph.ts <dépôt WindowsAppSDK> <dépôt microsoft-ui-xaml>
//         (NuGet : $NUGET_PACKAGES, sinon ~/.nuget/packages ; restaurer d'abord la coque : just app ou dotnet restore)
import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import {
  type Assembly,
  readAssembly,
  readFieldSig,
  readMethodSig,
  readType,
  Reader,
  type Ref,
  type Sig,
  T,
  E,
} from "./dotnet-ffi/ecma335.ts";

const [wasdkRepo, muxRepo] = process.argv.slice(2);
if (!wasdkRepo || !muxRepo) throw new Error("usage : bun sdk/tools/winappsdk-graph.ts <WindowsAppSDK> <microsoft-ui-xaml>");
const root = join(import.meta.dir, "..", "..");
const props = await Bun.file(join(root, "Directory.Packages.props")).text();
const version = /Include="Microsoft\.WindowsAppSDK" Version="([^"]+)"/.exec(props)?.[1];
if (!version) throw new Error("Microsoft.WindowsAppSDK absent de Directory.Packages.props");
const nuget = process.env.NUGET_PACKAGES ?? join(homedir(), ".nuget", "packages");

// ---------------------------------------------------------------- graphe
type Node = { id: number; parent: number; kind: string; name: string; full: string; data: Record<string, unknown> };
const nodes: Node[] = [];
const edges: [number, number, string][] = [];
const byFull = new Map<string, number>(); // type livré : nom complet -> nœud
const add = (parent: number, kind: string, name: string, full: string, data: Record<string, unknown> = {}) => {
  const n = { id: nodes.length + 1, parent, kind, name, full, data };
  nodes.push(n);
  return n.id;
};
const sdk = add(0, "sdk", "Windows App SDK", `Microsoft.WindowsAppSDK ${version}`, { version, source: "Directory.Packages.props" });

// ---------------------------------------------------------------- 1. surface livrée (winmd)
const files = (dir: string, re: RegExp): string[] => {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (re.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
};

/** Documentation XML (§ doc comments) : clé « T:/M:/P:/E:/F:nom » (paramètres de méthode retirés) -> résumé. */
const docs = async (winmd: string) => {
  const m = new Map<string, string>();
  const f = Bun.file(winmd.replace(/\.winmd$/i, ".xml"));
  if (!(await f.exists())) return m;
  const xml = await f.text();
  for (const x of xml.matchAll(/<member name="([^"]+)">([\s\S]*?)<\/member>/g)) {
    const key = x[1]!.replace(/\(.*$/, "");
    const s = /<summary>([\s\S]*?)<\/summary>/.exec(x[2]!)?.[1];
    if (s && !m.has(key))
      m.set(
        key,
        s
          .replace(/<see cref="\w:([^"]+)"\s*\/>/g, "$1")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
  }
  return m;
};

const PRIM: Record<number, string> = {
  [E.VOID]: "void",
  [E.BOOLEAN]: "Boolean",
  [E.CHAR]: "Char16",
  [E.I1]: "Int8",
  [E.U1]: "UInt8",
  [E.I2]: "Int16",
  [E.U2]: "UInt16",
  [E.I4]: "Int32",
  [E.U4]: "UInt32",
  [E.I8]: "Int64",
  [E.U8]: "UInt64",
  [E.R4]: "Single",
  [E.R8]: "Double",
  [E.STRING]: "String",
  [E.OBJECT]: "Object",
  [E.I]: "IntPtr",
  [E.U]: "UIntPtr",
};
const sigText = (a: Assembly, s: Sig, gp: string[] = []): string => {
  switch (s.k) {
    case "prim":
      return PRIM[s.e] ?? `e${s.e}`;
    case "ptr":
      return `${sigText(a, s.to, gp)}*`;
    case "byref":
      return `ref ${sigText(a, s.to, gp)}`;
    case "valuetype":
    case "class":
      return a.typeName(s.ref);
    case "szarray":
      return `${sigText(a, s.of, gp)}[]`;
    case "array":
      return `${sigText(a, s.of, gp)}[${",".repeat(s.rank - 1)}]`;
    case "generic":
      return `${sigText(a, s.base, gp).replace(/`\d+$/, "")}<${s.args.map((x) => sigText(a, x, gp)).join(", ")}>`;
    case "var":
      return gp[s.n] ?? `T${s.n}`;
    case "mvar":
      return `M${s.n}`;
    case "fnptr":
      return "fnptr";
    default:
      return "?";
  }
};

const attrFlags = (a: Assembly, ref: Ref) => {
  const out: Record<string, unknown> = {};
  for (const at of a.attributes(ref)) {
    const n = at.type.slice(at.type.lastIndexOf(".") + 1).replace(/Attribute$/, "");
    if (n === "Contract") out.contract = `${at.fixed[0]} v${Number(at.fixed[1]) >>> 16}`;
    else if (n === "ContractVersion") out.contractVersion = at.fixed.map(String).join(" ");
    else if (n === "Experimental") out.experimental = true;
    else if (n === "Deprecated") out.deprecated = String(at.fixed[0] ?? true);
    else if (n === "Activatable") out.activatable = ((out.activatable as number) ?? 0) + 1;
    else if (n === "Static") out.statics = [...((out.statics as string[]) ?? []), String(at.fixed[0])];
    else if (n === "Composable") out.composable = true;
    else if (n === "ExclusiveTo") out.exclusiveTo = String(at.fixed[0]);
    else if (n === "Guid") out.guid = true;
    else if (n === "Threading") out.threading = at.fixed[0];
    else if (n === "MarshalingBehavior") out.marshaling = at.fixed[0];
    else if (n === "Version") out.version = Number(at.fixed[0]) >>> 16;
  }
  return out;
};

const kindOf = (a: Assembly, td: number) => {
  const flags = a.md.raw(T.TypeDef, td, "Flags");
  if (flags & 0x20) return "interface";
  const base = a.baseName(td);
  if (base === "System.Enum") return "enum";
  if (base === "System.ValueType") return "struct";
  if (base === "System.MulticastDelegate") return "delegate";
  if (base === "System.Attribute") return "attribute";
  if (a.attributes({ table: T.TypeDef, row: td }).some((x) => x.type.endsWith(".ApiContractAttribute"))) return "contract";
  return "class";
};

const range = (a: Assembly, mapTable: number, listCol: string, target: number, td: number): [number, number] => {
  const md = a.md;
  for (let i = 1; i <= md.rows(mapTable); i++) {
    if (md.raw(mapTable, i, "Parent") === td) return [md.raw(mapTable, i, listCol), md.listEnd(mapTable, i, listCol, target)];
  }
  return [0, 0];
};

const shipped = { packages: 0, winmds: 0, namespaces: new Set<string>(), types: 0, members: 0, documented: 0 };
const pkgs = readdirSync(nuget)
  .filter((d) => /^microsoft\.windowsappsdk(\.|$)/.test(d))
  .sort();
for (const id of pkgs) {
  const dir = join(nuget, id, version);
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
  const spec = await Bun.file(join(dir, `${id}.nuspec`)).text();
  const pid = /<id>([^<]+)<\/id>/.exec(spec)?.[1] ?? id;
  const deps = [...spec.matchAll(/<dependency id="([^"]+)" version="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`);
  const pkg = add(sdk, "package", pid, `${pid} ${version}`, {
    description: /<description>([\s\S]*?)<\/description>/.exec(spec)?.[1]?.trim(),
    dependencies: [...new Set(deps)],
  });
  shipped.packages++;
  // Surface publique : metadata/ et lib/ (les winmd de runtimes-framework/ sont des implémentations internes par architecture).
  const winmds = ["metadata", "lib"].flatMap((d) =>
    statSync(join(dir, d), { throwIfNoEntry: false }) ? files(join(dir, d), /\.winmd$/i) : [],
  );
  for (const w of [...new Map(winmds.map((p) => [basename(p).toLowerCase(), p])).values()]) {
    const a = readAssembly(await Bun.file(w).arrayBuffer());
    const doc = await docs(w);
    const wm = add(pkg, "winmd", basename(w), relative(dir, w).replaceAll("\\", "/"), { assembly: a.name, version: a.version });
    shipped.winmds++;
    const nsNode = new Map<string, number>();
    const md = a.md;
    for (let td = 2; td <= md.rows(T.TypeDef); td++) {
      const flags = md.raw(T.TypeDef, td, "Flags");
      if ((flags & 0x7) === 0 && md.str(T.TypeDef, td, "TypeNamespace") === "") continue; // <Module>
      const full = a.typeName({ table: T.TypeDef, row: td });
      const ns = md.str(T.TypeDef, td, "TypeNamespace");
      let nn = nsNode.get(ns);
      if (!nn) nsNode.set(ns, (nn = add(wm, "namespace", ns, ns)));
      shipped.namespaces.add(ns);
      const kind = kindOf(a, td);
      const gp: string[] = [];
      for (let g = 1; g <= md.rows(T.GenericParam); g++) {
        const o = md.ref(T.GenericParam, g, "Owner");
        if (o.table === T.TypeDef && o.row === td) gp[md.raw(T.GenericParam, g, "Number")] = md.str(T.GenericParam, g, "Name");
      }
      const ifaces: string[] = [];
      for (let i = 1; i <= md.rows(T.InterfaceImpl); i++) {
        if (md.raw(T.InterfaceImpl, i, "Class") === td) ifaces.push(a.typeName(md.ref(T.InterfaceImpl, i, "Interface")));
      }
      const tdoc = doc.get(`T:${full}`);
      const t = add(nn, kind, md.str(T.TypeDef, td, "TypeName"), full, {
        base: ["class"].includes(kind) && a.baseName(td) !== "System.Object" ? a.baseName(td) : undefined,
        interfaces: ifaces.length ? ifaces : undefined,
        sealed: kind === "class" ? Boolean(flags & 0x100) : undefined,
        ...attrFlags(a, { table: T.TypeDef, row: td }),
        doc: tdoc,
      });
      byFull.set(full, t);
      shipped.types++;
      if (tdoc) shipped.documented++;
      const member = (k: string, name: string, sig: string, ref: Ref, docKey: string) => {
        const d = doc.get(docKey);
        add(t, k, name, `${full}.${name}`, { sig, ...attrFlags(a, ref), doc: d });
        shipped.members++;
        if (d) shipped.documented++;
      };
      // Champs (valeurs d'énumération, champs de structure).
      const f0 = md.raw(T.TypeDef, td, "FieldList");
      for (let f = f0; f < md.listEnd(T.TypeDef, td, "FieldList", T.Field); f++) {
        if (!(md.raw(T.Field, f, "Flags") & 0x6) || md.str(T.Field, f, "Name") === "value__") continue;
        const ref = { table: T.Field, row: f };
        const c = a.constant(ref);
        const name = md.str(T.Field, f, "Name");
        member(
          "field",
          name,
          c !== undefined ? String(c) : sigText(a, readFieldSig(md.blob(T.Field, f, "Signature")), gp),
          ref,
          `F:${full}.${name}`,
        );
      }
      // Méthodes (accesseurs specialname exclus : couverts par propriétés et événements).
      const m0 = md.raw(T.TypeDef, td, "MethodList");
      for (let m = m0; m < md.listEnd(T.TypeDef, td, "MethodList", T.MethodDef); m++) {
        const mf = md.raw(T.MethodDef, m, "Flags");
        const name = md.str(T.MethodDef, m, "Name");
        if (mf & 0x800 && name !== ".ctor") continue;
        const s = readMethodSig(new Reader(md.blob(T.MethodDef, m, "Signature")));
        const p0 = md.raw(T.MethodDef, m, "ParamList");
        const p1 = md.listEnd(T.MethodDef, m, "ParamList", T.Param);
        const pn: string[] = [];
        for (let p = p0; p < p1; p++)
          if (md.raw(T.Param, p, "Sequence") > 0) pn[md.raw(T.Param, p, "Sequence") - 1] = md.str(T.Param, p, "Name");
        const sig = `${mf & 0x10 ? "static " : ""}${sigText(a, s.ret, gp)} ${name}(${s.params.map((x, i) => `${sigText(a, x, gp)} ${pn[i] ?? `p${i}`}`).join(", ")})`;
        member(
          name === ".ctor" ? "constructor" : "method",
          name,
          sig,
          { table: T.MethodDef, row: m },
          `M:${full}.${name === ".ctor" ? "#ctor" : name}`,
        );
      }
      const [q0, q1] = range(a, T.PropertyMap, "PropertyList", T.Property, td);
      for (let p = q0; p < q1; p++) {
        const name = md.str(T.Property, p, "Name");
        const r = new Reader(md.blob(T.Property, p, "Type"));
        r.u8();
        r.compressed();
        member("property", name, sigText(a, readType(r), gp), { table: T.Property, row: p }, `P:${full}.${name}`);
      }
      const [e0, e1] = range(a, T.EventMap, "EventList", T.Event, td);
      for (let e = e0; e < e1; e++) {
        const name = md.str(T.Event, e, "Name");
        member("event", name, a.typeName(md.ref(T.Event, e, "EventType")), { table: T.Event, row: e }, `E:${full}.${name}`);
      }
    }
  }
}
if (!shipped.packages) throw new Error(`aucun paquet Microsoft.WindowsAppSDK.* ${version} dans ${nuget} : restaurer la coque d'abord`);

// ---------------------------------------------------------------- 2. code source
const git = (repo: string, ...a: string[]) =>
  Bun.spawnSync(["git", "-C", repo, ...a])
    .stdout.toString()
    .trim();
const sourceTypes = new Map<string, number>(); // nom complet -> nœud idl-type
const features = new Map<string, number>();
const idlKinds =
  /\b(runtimeclass|interface|enum|struct|delegate|apicontract)\s+(?:[\w.<>, ]+\s+)?([A-Za-z_]\w*)(?=\s*(?:[:{;(]|requires\b))/g;
const indexIdl = async (comp: number, repoRoot: string, file: string, macros: Map<string, string>) => {
  let text = await Bun.file(file).text();
  for (const m of text.matchAll(/^#define\s+(\w+)\s+([\w.]+)\s*$/gm)) macros = new Map(macros).set(m[1]!, m[2]!);
  text = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const idl = add(comp, "idl", basename(file), relative(repoRoot, file).replaceAll("\\", "/"));
  // Espaces de noms imbriqués : pile de profondeurs d'accolades.
  const stack: { ns: string; depth: number }[] = [];
  let depth = 0;
  let pendingNs: string | null = null;
  let last = 0;
  const tokens = /namespace\s+([\w.]+)|[{}]/g;
  const nsAt: { pos: number; ns: string }[] = [];
  for (const m of text.matchAll(tokens)) {
    if (m[1]) pendingNs = macros.get(m[1]) ?? m[1];
    else if (m[0] === "{") {
      depth++;
      if (pendingNs) (stack.push({ ns: [...stack.map((s) => s.ns), pendingNs].join("."), depth }), (pendingNs = null));
    } else {
      if (stack.at(-1)?.depth === depth) stack.pop();
      depth--;
    }
    nsAt.push({ pos: m.index!, ns: stack.at(-1)?.ns ?? "" });
    last = m.index!;
  }
  void last;
  const nsOf = (pos: number) => {
    let ns = "";
    for (const x of nsAt) if (x.pos <= pos) ns = x.ns;
    return ns;
  };
  let count = 0;
  for (const m of text.matchAll(idlKinds)) {
    const ns = nsOf(m.index!);
    if (!ns) continue;
    const head = text.slice(Math.max(0, m.index! - 400), m.index!);
    const attrs = head.slice(head.lastIndexOf(";") + 1).slice(head.slice(head.lastIndexOf(";") + 1).lastIndexOf("}") + 1);
    const feat = [...attrs.matchAll(/feature\((\w+)\)/g)].map((x) => x[1]!);
    const full = `${ns}.${m[2]}`;
    const n = add(idl, `idl-${m[1]}`, m[2]!, full, {
      feature: feat.length ? feat : undefined,
      preview: /MUX_PREVIEW|experimental/.test(attrs) || undefined,
      internal: /MUX_INTERNAL/.test(attrs) || undefined,
    });
    sourceTypes.set(full, n);
    for (const f of feat) edges.push([n, features.get(f) ?? 0, "gated-by"]);
    const shippedNode = byFull.get(full);
    if (shippedNode) edges.push([shippedNode, n, "defined-in"]);
    count++;
  }
  // Membres conditionnés par une fonctionnalité : [..., feature(Feature_X)] suivi de la déclaration.
  for (const m of text.matchAll(/\[([^\]]*?\bfeature\((\w+)\)[^\]]*)\]\s*([^;{[]+)/g)) {
    const decl = m[3]!.replace(/\s+/g, " ").trim().slice(0, 120);
    const g = add(idl, "idl-gated", decl, `${nsOf(m.index!)}:${decl}`, { feature: m[2], attributes: m[1]!.trim() });
    edges.push([g, features.get(m[2]!) ?? 0, "gated-by"]);
  }
  nodes[idl - 1]!.data.types = count;
};

const repoNode = (path: string, name: string) =>
  add(sdk, "repo", name, git(path, "remote", "get-url", "origin").replace(/\.git$/, ""), {
    commit: git(path, "rev-parse", "--short", "HEAD"),
    date: git(path, "log", "-1", "--format=%cs"),
  });

// WindowsAppSDK : composants dev/*, fonctionnalités TerminalVelocity dev/Common/*.xml, specs/*, test/*.
const wr = repoNode(wasdkRepo, "WindowsAppSDK");
const featComp = new Map<string, string>();
for (const x of files(join(wasdkRepo, "dev", "Common"), /^TerminalVelocityFeatures-.*\.xml$/)) {
  const area = basename(x).replace(/^TerminalVelocityFeatures-|\.xml$/g, "");
  const xml = await Bun.file(x).text();
  for (const f of xml.matchAll(/<feature>([\s\S]*?)<\/feature>/g)) {
    const g = (t: string) => new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(f[1]!)?.[1]?.trim();
    const name = g("name")!;
    features.set(
      name,
      add(wr, "feature", name, name, {
        area,
        state: g("state"),
        description: g("description"),
        alwaysDisabledChannels: [...f[1]!.matchAll(/<channelToken>(\w+)<\/channelToken>/g)].map((c) => c[1]) || undefined,
        file: relative(wasdkRepo, x).replaceAll("\\", "/"),
      }),
    );
    featComp.set(name, area);
  }
}
const dirs = (p: string) =>
  statSync(p, { throwIfNoEntry: false })
    ? readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];
const specs = dirs(join(wasdkRepo, "specs"));
const tests = dirs(join(wasdkRepo, "test"));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
for (const c of dirs(join(wasdkRepo, "dev"))) {
  if (c === "Templates") continue; // gabarits d'application, pas d'API du SDK
  const p = join(wasdkRepo, "dev", c);
  const all = files(p, /.*/);
  const comp = add(wr, "component", c, `dev/${c}`, {
    files: all.length,
    languages: Object.fromEntries(
      Object.entries(Object.groupBy(all, (f) => (/\.([a-z]+)$/i.exec(f)?.[1] ?? "").toLowerCase()))
        .map(([k, v]) => [k, v!.length] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    ),
    spec: specs.find((s) => norm(s) === norm(c)) ? `specs/${specs.find((s) => norm(s) === norm(c))}` : undefined,
    test: tests.find((s) => norm(s) === norm(c)) ? `test/${tests.find((s) => norm(s) === norm(c))}` : undefined,
  });
  for (const [f, area] of featComp)
    if (norm(area).startsWith(norm(c)) || norm(c).startsWith(norm(area))) edges.push([features.get(f)!, comp, "feature-of"]);
  for (const idl of all.filter((f) => /\.idl$/i.test(f))) await indexIdl(comp, wasdkRepo, idl, new Map());
  // Points de contrôle dans le code (Feature_X::IsEnabled(), etc.) : fonctionnalité -> composant, avec les fichiers.
  const sites = new Map<string, string[]>();
  for (const src of all.filter((f) => /\.(cpp|h|hpp|cs)$/i.test(f))) {
    for (const m of new Set((await Bun.file(src).text()).match(/\bFeature_\w+/g) ?? [])) {
      if (features.has(m)) (sites.get(m) ?? sites.set(m, []).get(m)!).push(relative(wasdkRepo, src).replaceAll("\\", "/"));
    }
  }
  for (const [name, list] of sites) {
    edges.push([features.get(name)!, comp, "checked-in"]);
    const fd = nodes[features.get(name)! - 1]!.data;
    fd.codeSites = [...((fd.codeSites as string[]) ?? []), ...list];
  }
}
for (const e of edges) if (e[2] === "gated-by" && e[1] === 0) e[1] = -1;

// microsoft-ui-xaml (WinUI 3) : contrôles controls/dev/*, cœur dxaml/xcp/dxaml/idl.
const mr = repoNode(muxRepo, "microsoft-ui-xaml");
const macros = new Map<string, string>();
const muxIdl = join(muxRepo, "controls", "idl", "Microsoft.UI.Xaml.Controls.idl");
for (const m of (await Bun.file(muxIdl).text()).matchAll(/^#define\s+(\w+)\s+([\w.]+)\s*$/gm)) macros.set(m[1]!, m[2]!);
for (const c of dirs(join(muxRepo, "controls", "dev"))) {
  const idls = files(join(muxRepo, "controls", "dev", c), /\.idl$/i).filter(
    (f) => !/[\\/](TestUI|APITests|InteractionTests)[\\/]/i.test(f),
  );
  if (!idls.length) continue;
  const comp = add(mr, "component", c, `controls/dev/${c}`, { idl: idls.length });
  for (const f of idls) await indexIdl(comp, muxRepo, f, macros);
}
const core = join(muxRepo, "dxaml", "xcp", "dxaml", "idl");
for (const c of dirs(core)) {
  const comp = add(mr, "component", `dxaml/${c}`, `dxaml/xcp/dxaml/idl/${c}`);
  for (const f of files(join(core, c), /\.idl$/i)) await indexIdl(comp, muxRepo, f, macros);
}

// ---------------------------------------------------------------- liens et bilan
const linked = edges.filter((e) => e[2] === "defined-in").length;
const unlinkedShipped = [...byFull.entries()].filter(([f, id]) => !sourceTypes.has(f) && !nodes[id - 1]!.data.exclusiveTo).map(([f]) => f);
const ungatedFeatures = edges.filter((e) => e[2] === "gated-by" && e[1] === -1).map((e) => nodes[e[0] - 1]!.data.feature);
void ungatedFeatures;

const outDb = join(root, "target", "index", "winappsdk.sqlite");
mkdirSync(dirname(outDb), { recursive: true });
await Bun.file(outDb)
  .delete()
  .catch(() => {});
const db = new Database(outDb);
db.run("PRAGMA journal_mode=OFF");
db.run("PRAGMA synchronous=OFF");
db.run("CREATE TABLE node(id INTEGER PRIMARY KEY, parent INTEGER, kind TEXT, name TEXT, full TEXT, data TEXT)");
db.run("CREATE TABLE edge(src INTEGER, dst INTEGER, kind TEXT)");
db.run("CREATE VIRTUAL TABLE fts USING fts5(full, doc, content='', tokenize='trigram')");
const ins = db.prepare("INSERT INTO node VALUES (?,?,?,?,?,?)");
const fts = db.prepare("INSERT INTO fts(rowid, full, doc) VALUES (?,?,?)");
const ine = db.prepare("INSERT INTO edge VALUES (?,?,?)");
db.transaction(() => {
  for (const n of nodes) {
    ins.run(n.id, n.parent, n.kind, n.name, n.full, JSON.stringify(n.data));
    fts.run(n.id, n.full, (n.data.doc as string) ?? "");
  }
  for (const e of edges) if (e[1] > 0) ine.run(...e);
})();
db.run("CREATE INDEX node_parent ON node(parent)");
db.run("CREATE INDEX node_full ON node(full)");
db.close();

// Graphe récursif compact pour docs/ : jusqu'au type (membres comptés), fonctionnalités et composants complets.
type Tree = { kind: string; name: string; data?: Record<string, unknown>; members?: Record<string, number>; children?: Tree[] };
const kids = new Map<number, Node[]>();
for (const n of nodes) (kids.get(n.parent) ?? kids.set(n.parent, []).get(n.parent)!).push(n);
const MEMBER = new Set(["method", "constructor", "property", "event", "field"]);
const tree = (n: Node): Tree => {
  const c = kids.get(n.id) ?? [];
  const members = c.filter((x) => MEMBER.has(x.kind));
  const rest = c.filter((x) => !MEMBER.has(x.kind));
  const { doc, ...data } = n.data;
  void doc;
  return {
    kind: n.kind,
    name: n.name,
    ...(Object.keys(data).length ? { data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) } : {}),
    ...(members.length
      ? { members: Object.fromEntries(Object.entries(Object.groupBy(members, (m) => m.kind)).map(([k, v]) => [k, v!.length])) }
      : {}),
    ...(rest.length ? { children: rest.map(tree) } : {}),
  };
};
const count = (k: string) => nodes.filter((n) => n.kind === k).length;
const summary = {
  date: new Date().toISOString().slice(0, 10),
  source: "sdk/tools/winappsdk-graph.ts",
  version,
  counts: {
    packages: shipped.packages,
    winmds: shipped.winmds,
    namespaces: shipped.namespaces.size,
    types: shipped.types,
    members: shipped.members,
    documented: shipped.documented,
    features: features.size,
    components: count("component"),
    idl: count("idl"),
    idlTypes: sourceTypes.size,
    shippedTypesLinkedToSource: linked,
    nodes: nodes.length,
    edges: edges.length,
  },
};
const outDir = join(root, "docs", "winappsdk");
mkdirSync(outDir, { recursive: true });
await Bun.write(join(outDir, "feature-graph.json"), JSON.stringify({ ...summary, graph: tree(nodes[0]!) }));

// Markdown : paquets > winmd > espaces de noms (comptes), fonctionnalités par état, composants et liaison au code.
const L: string[] = [
  `# Windows App SDK ${version} : index et graphe de fonctionnalités`,
  "",
  `Relevé le ${summary.date} par \`sdk/tools/winappsdk-graph.ts\` sur les métadonnées WinRT livrées (NuGet) et le code source`,
  "(dépôts ci-dessous). Index complet interrogeable : `target/index/winappsdk.sqlite` (tables node, edge, fts).",
  "",
  ...Object.entries(summary.counts).map(([k, v]) => `- ${k} : ${v}`),
  "",
  "## Dépôts",
  "",
  ...nodes.filter((n) => n.kind === "repo").map((n) => `- ${n.name} : ${n.full} @ ${n.data.commit} (${n.data.date})`),
  "",
  "## Paquets livrés",
  "",
];
for (const p of nodes.filter((n) => n.kind === "package")) {
  L.push(`### ${p.name}`, "", `${((p.data.description as string) ?? "").replace(/\s+/g, " ")}`, "");
  if ((p.data.dependencies as string[]).length) L.push(`Dépendances : ${(p.data.dependencies as string[]).join(", ")}`, "");
  for (const w of kids.get(p.id) ?? []) {
    L.push(`- **${w.name}** (${w.full})`);
    for (const ns of kids.get(w.id) ?? []) {
      const ts = kids.get(ns.id) ?? [];
      const by = Object.entries(Object.groupBy(ts, (t) => t.kind))
        .map(([k, v]) => `${v!.length} ${k}`)
        .join(", ");
      const mem = ts.reduce((s, t) => s + (kids.get(t.id)?.length ?? 0), 0);
      const exp = ts.filter((t) => t.data.experimental).length;
      L.push(`  - ${ns.name} : ${by} ; ${mem} membres${exp ? ` ; ${exp} expérimentaux` : ""}`);
    }
  }
  L.push("");
}
L.push(
  "## Fonctionnalités (TerminalVelocity, dev/Common)",
  "",
  "| fonctionnalité | état | domaine | description | API IDL conditionnées | fichiers de code |",
  "|---|---|---|---|---|---|",
);
for (const f of nodes.filter((n) => n.kind === "feature")) {
  const gated = edges.filter((e) => e[2] === "gated-by" && e[1] === f.id).length;
  L.push(
    `| ${f.name} | ${f.data.state} | ${f.data.area} | ${((f.data.description as string) ?? "").replace(/\|/g, "/")} | ${gated} | ${(f.data.codeSites as string[] | undefined)?.length ?? 0} |`,
  );
}
L.push(
  "",
  "## Composants source",
  "",
  "| dépôt | composant | idl | types IDL | livrés reliés | spec | test |",
  "|---|---|---|---|---|---|---|",
);
for (const c of nodes.filter((n) => n.kind === "component")) {
  const idls = kids.get(c.id) ?? [];
  const types = idls.flatMap((i) => kids.get(i.id) ?? []).filter((t) => t.kind !== "idl-gated");
  const linkedHere = types.filter((t) => byFull.has(t.full)).length;
  L.push(
    `| ${nodes[c.parent - 1]!.name} | ${c.name} | ${idls.length} | ${types.length} | ${linkedHere} | ${c.data.spec ?? ""} | ${c.data.test ?? ""} |`,
  );
}
const outsideRepos = Object.entries(Object.groupBy(unlinkedShipped, (f) => f.split(".").slice(0, 3).join(".")))
  .map(([k, v]) => [k, v!.length] as const)
  .sort((a, b) => b[1] - a[1]);
L.push(
  "",
  "## Types livrés sans source publique",
  "",
  "Types publics (hors interfaces exclusiveTo) absents des IDL des deux dépôts : composants livrés en binaire uniquement",
  "(Composition, Input, Windowing, Content, Text, IA, Widgets, Search…) ou types du cœur XAML générés à la compilation (modèle XamlOM de dxaml).",
  "",
  ...outsideRepos.map(([k, v]) => `- ${k} : ${v}`),
  "",
);
await Bun.write(join(outDir, "feature-graph.md"), L.join("\n"));
console.log(JSON.stringify({ db: relative(root, outDb), ...summary.counts }));
