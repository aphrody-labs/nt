// Serveur bun de nt : modèle 3D du noyau Windows en direct (rendu GPU pur), index NTFS de %SystemRoot%, icônes réelles
// des PE, bureau vectorisé en SVG.
//   /                noyau NT en 3D (WebGPU, aucun texte DOM)   WebSocket /kernel : échantillons ntdll (ntsys.ts)
//   /api/icon?path=  icône réelle d'un PE (.ico)                /api/index/{stats,tree,search} : SQLite (winindex.ts)
//   /desktop.svg     bureau entier (UI Automation)              /stats : mesures d'affichage (?report=1)
//   /api/msindex/{stats,search,node/:id} : pile Microsoft indexée et prouvée (sdk/tools/msindex)
// Usage : bun src/host/server.ts   [PORT=8787] [NT_HZ=15]
import { Database } from "bun:sqlite";
import app from "../../../modules/web/nt.html";
import { desktopSvg } from "./desktop-svg.ts";
import { createSampler, type Slow } from "./ntsys.ts";
import { iconOf, ntfsVolume, processPath } from "./pe-icon.ts";
import { DB_PATH, openIndex } from "./winindex.ts";

const root = new URL("../../../", import.meta.url);
const statsPath = new URL("target/web-live-stats.json", root);
const port = Number(process.env.PORT ?? 8787);
const hz = Math.min(60, Math.max(1, Number(process.env.NT_HZ ?? 15)));
const win = process.platform === "win32";
const sampler = win ? createSampler() : null;
const index = (await Bun.file(DB_PATH).exists()) ? openIndex(DB_PATH) : null;

let names = 0;
let slow: Slow | null = null;
let ntfs = win ? ntfsVolume() : null;
const procPaths = new Map<number, string>();
const icons = new Map<string, Uint8Array<ArrayBuffer> | null>();
const namesMsg = () => JSON.stringify({ type: "names", version: sampler!.namesVersion(), names: sampler!.names() });
const slowMsg = () => JSON.stringify({ type: "slow", ...slow, ntfs });
const pathsMsg = (pids: number[]) =>
  JSON.stringify({ type: "paths", paths: Object.fromEntries(pids.map((pid) => [pid, procPaths.get(pid) ?? ""])) });
let svgCache: { at: number; svg: string } | null = null;
const json = (v: unknown) => Response.json(v, { headers: { "cache-control": "no-store" } });
const noIndex = () => new Response("index absent : just index", { status: 404 });
const msindexPath = new URL("target/index/msindex.sqlite", root);
const msindex = (await Bun.file(msindexPath).exists()) ? new Database(Bun.fileURLToPath(msindexPath), { readonly: true }) : null;
const noMsindex = () => new Response("msindex absent : just msindex <src>", { status: 404 });

const server = Bun.serve({
  port,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": app,
    "/kernel": (req, srv) => (srv.upgrade(req) ? undefined : new Response("WebSocket attendu", { status: 426 })),
    "/api/icon": async (req) => {
      const path = new URL(req.url).searchParams.get("path") ?? "";
      let ico = icons.get(path);
      if (ico === undefined) {
        ico = /\.(exe|dll|cpl|ocx|scr)$/i.test(path) ? await iconOf(path) : null;
        icons.set(path, ico);
      }
      return ico
        ? new Response(ico, { headers: { "content-type": "image/x-icon", "cache-control": "max-age=3600" } })
        : new Response(null, { status: 404 });
    },
    "/desktop.svg": async () => {
      if (!svgCache || performance.now() - svgCache.at > 3000) svgCache = { at: performance.now(), svg: (await desktopSvg()).svg };
      return new Response(svgCache.svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" } });
    },
    "/api/index/stats": () => {
      if (!index) return noIndex();
      const meta = index.query("SELECT v FROM meta WHERE k = 'stats'").get() as { v: string } | null;
      const ext = index.query("SELECT ext, count(*) n, sum(size) bytes FROM files GROUP BY ext ORDER BY bytes DESC LIMIT 24").all();
      const machines = index
        .query("SELECT machine, count(*) n FROM files WHERE machine IS NOT NULL GROUP BY machine ORDER BY n DESC")
        .all();
      return json({ ...(meta ? JSON.parse(meta.v) : {}), ext, machines });
    },
    "/api/index/tree": (req) => {
      if (!index) return noIndex();
      const u = new URL(req.url);
      const depth = Math.min(3, Number(u.searchParams.get("depth") ?? 2));
      const top = Math.min(400, Number(u.searchParams.get("top") ?? 24));
      const rootRow = index.query("SELECT id, path name, files, bytes FROM dirs WHERE parent = 0").get() as {
        id: number;
        name: string;
        files: number;
        bytes: number;
      };
      const children = index.query("SELECT id, name, path, files, bytes FROM dirs WHERE parent = ? ORDER BY bytes DESC LIMIT ?");
      // Exécutable le plus volumineux de chaque dossier de premier niveau : son icône réelle représente le dossier.
      const exe = index.query(
        "SELECT d.path || '\\' || f.name p FROM files f JOIN dirs d ON d.id = f.dir WHERE f.ext = 'exe' AND (d.path = ?1 OR d.path LIKE ?1 || '\\%') ORDER BY f.size DESC LIMIT 1",
      );
      const walk = (id: number, d: number): unknown[] =>
        (children.all(id, top) as { id: number; name: string; path: string; files: number; bytes: number }[]).map((c) => ({
          ...c,
          exe: d === 1 ? ((exe.get(c.path) as { p: string } | null)?.p ?? "") : undefined,
          children: d < depth ? walk(c.id, d + 1) : [],
        }));
      return json({ ...rootRow, children: walk(rootRow.id, 1) });
    },
    "/api/index/search": (req) => {
      if (!index) return noIndex();
      const q = new URL(req.url).searchParams.get("q") ?? "";
      if (q.length < 3) return json([]);
      return json(
        index
          .query(
            "SELECT n.path, f.size, f.mtime, f.machine, f.subsystem, f.pe_time FROM names n JOIN files f ON f.id = n.rowid WHERE names MATCH ? ORDER BY f.size DESC LIMIT 200",
          )
          .all(`"${q.replace(/"/g, '""')}"`),
      );
    },
    // Pile Microsoft indexée et prouvée (sdk/tools/msindex, just msindex <src>) : bilan, recherche, nœud avec enfants et preuves.
    "/api/msindex/stats": async () => {
      const lock = Bun.file(new URL("docs/msindex/lock.json", root));
      if (!(await lock.exists())) return new Response("msindex absent : just msindex <src>", { status: 404 });
      const l = await lock.json();
      return json({ date: l.date, machine: l.machine, versions: l.versions, digests: l.digests, counts: l.counts, proofs: l.proofs });
    },
    "/api/msindex/search": (req) => {
      if (!msindex) return noMsindex();
      const q = new URL(req.url).searchParams.get("q") ?? "";
      if (q.length < 3) return json([]);
      return json(
        msindex
          .query("SELECT n.id, n.kind, n.full, n.data FROM fts JOIN node n ON n.id = fts.rowid WHERE fts MATCH ? LIMIT 200")
          .all(`"${q.replace(/"/g, '""')}"`),
      );
    },
    "/api/msindex/node/:id": (req) => {
      if (!msindex) return noMsindex();
      const id = Number(req.params.id);
      return json({
        node: msindex.query("SELECT * FROM node WHERE id = ?").get(id),
        children: msindex.query("SELECT id, kind, name, full FROM node WHERE parent = ? LIMIT 2000").all(id),
        proofs: msindex.query('SELECT check_ AS "check", ok, detail FROM proof WHERE node = ?').all(id),
        edges: msindex.query("SELECT src, dst, kind FROM edge WHERE src = ?1 OR dst = ?1 LIMIT 2000").all(id),
      });
    },
    "/stats": {
      POST: async (req) => {
        await Bun.write(statsPath, await req.text());
        return new Response(null, { status: 204 });
      },
      GET: () => new Response(Bun.file(statsPath)),
    },
  },
  websocket: {
    open(ws) {
      if (!sampler) {
        ws.send(JSON.stringify({ type: "error", message: "échantillonneur NT disponible sous Windows uniquement" }));
        return;
      }
      ws.subscribe("kernel");
      ws.send(JSON.stringify({ type: "hello", hz }));
      ws.send(namesMsg());
      ws.send(pathsMsg([...procPaths.keys()]));
      if (slow) ws.send(slowMsg());
    },
    message() {},
    close(ws) {
      ws.unsubscribe("kernel");
    },
  },
});

if (sampler) {
  setInterval(() => {
    if (server.subscriberCount("kernel") === 0) return;
    const frame = sampler.fast();
    // Nouveaux pid : chemin Win32 réel de l'image (QueryFullProcessImageNameW), une fois par pid.
    const u = new Uint32Array(frame);
    const base = 8 + 16 + u[1]! * 8;
    const fresh: number[] = [];
    for (let i = 0; i < u[2]!; i++) {
      const pid = u[base + i * 12]!;
      if (!procPaths.has(pid)) {
        procPaths.set(pid, processPath(pid));
        fresh.push(pid);
      }
    }
    if (fresh.length) server.publish("kernel", pathsMsg(fresh));
    if (sampler.namesVersion() !== names) {
      names = sampler.namesVersion();
      server.publish("kernel", namesMsg());
    }
    server.publish("kernel", frame);
  }, 1000 / hz);
  const refreshSlow = () => {
    if (server.subscriberCount("kernel") === 0 && slow) return;
    slow = sampler.slow();
    ntfs = ntfsVolume();
    server.publish("kernel", slowMsg());
  };
  refreshSlow();
  setInterval(refreshSlow, 2000);
}
console.log(
  `nt http://localhost:${port}/ (noyau 3D, rendu GPU, ${hz} Hz) · /desktop.svg · /api/index/stats${index ? "" : " (index absent)"}`,
);
