// Graphe de l'index : nœuds arborescents (parent), arêtes typées, preuves machine. Identifiants séquentiels dans l'ordre de
// parcours ; tous les parcours sont triés, donc deux exécutions sur les mêmes entrées donnent les mêmes identifiants.
// Empreinte : SHA-256 de la sérialisation canonique (une ligne JSON par nœud, arête, preuve), indépendante du fichier SQLite.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Data = Record<string, unknown>;
export type Node = { id: number; parent: number; kind: string; name: string; full: string; data: Data };
export type Proof = { node: number; check: string; ok: boolean; detail: string };

export class Graph {
  readonly nodes: Node[] = [];
  readonly edges: [number, number, string][] = [];
  readonly proofs: Proof[] = [];
  private readonly children = new Map<number, number[]>();

  add(parent: number, kind: string, name: string, full: string, data: Data = {}): number {
    const id = this.nodes.length + 1;
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    this.nodes.push({ id, parent, kind, name, full, data });
    (this.children.get(parent) ?? this.children.set(parent, []).get(parent)!).push(id);
    return id;
  }
  node(id: number): Node {
    return this.nodes[id - 1]!;
  }
  kids(id: number): Node[] {
    return (this.children.get(id) ?? []).map((i) => this.nodes[i - 1]!);
  }
  edge(src: number, dst: number, kind: string) {
    if (src > 0 && dst > 0) this.edges.push([src, dst, kind]);
  }
  prove(node: number, check: string, ok: boolean, detail = "") {
    this.proofs.push({ node, check, ok, detail });
  }
  /** Descendants (récursif) d'un nœud, lui compris. */
  *walk(id: number): Generator<Node> {
    yield this.node(id);
    for (const c of this.children.get(id) ?? []) yield* this.walk(c);
  }

  digest(part: "graph" | "proofs"): string {
    const h = new Bun.CryptoHasher("sha256");
    if (part === "graph") {
      for (const n of this.nodes) h.update(`${JSON.stringify([n.id, n.parent, n.kind, n.full, n.data])}\n`);
      for (const e of this.edges) h.update(`${JSON.stringify(e)}\n`);
    } else for (const p of this.proofs) h.update(`${JSON.stringify([p.node, p.check, p.ok, p.detail])}\n`);
    return h.digest("hex");
  }

  write(file: string) {
    mkdirSync(dirname(file), { recursive: true });
    const db = new Database(file, { create: true });
    db.run("PRAGMA journal_mode=OFF");
    db.run("PRAGMA synchronous=OFF");
    for (const t of ["node", "edge", "proof", "fts"]) db.run(`DROP TABLE IF EXISTS ${t}`);
    db.run("CREATE TABLE node(id INTEGER PRIMARY KEY, parent INTEGER, kind TEXT, name TEXT, full TEXT, data TEXT)");
    db.run("CREATE TABLE edge(src INTEGER, dst INTEGER, kind TEXT)");
    db.run("CREATE TABLE proof(node INTEGER, check_ TEXT, ok INTEGER, detail TEXT)");
    db.run("CREATE VIRTUAL TABLE fts USING fts5(full, doc, content='', tokenize='trigram')");
    const n = db.prepare("INSERT INTO node VALUES (?,?,?,?,?,?)");
    const f = db.prepare("INSERT INTO fts(rowid, full, doc) VALUES (?,?,?)");
    const e = db.prepare("INSERT INTO edge VALUES (?,?,?)");
    const p = db.prepare("INSERT INTO proof VALUES (?,?,?,?)");
    db.transaction(() => {
      for (const x of this.nodes) {
        n.run(x.id, x.parent, x.kind, x.name, x.full, JSON.stringify(x.data));
        f.run(x.id, x.full, typeof x.data.doc === "string" ? x.data.doc : "");
      }
      for (const x of this.edges) e.run(...x);
      for (const x of this.proofs) p.run(x.node, x.check, x.ok ? 1 : 0, x.detail);
    })();
    db.run("CREATE INDEX node_parent ON node(parent)");
    db.run("CREATE INDEX node_full ON node(full)");
    db.run("CREATE INDEX edge_src ON edge(src)");
    db.run("CREATE INDEX edge_dst ON edge(dst)");
    db.run("CREATE INDEX proof_node ON proof(node)");
    db.close();
  }
}
