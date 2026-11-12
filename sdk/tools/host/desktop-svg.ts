// Vectorisation SVG de tout le bureau Windows : chaque fenêtre de premier niveau et chacun de ses éléments UI
// Automation (rôle, nom, rectangle) deviennent des nœuds SVG — rendu vectoriel fidèle, interrogeable, sans capture.
// Source : agent-desktop (UIA, `snapshot --include-bounds`), installé dans ~/.local/bin (MCP du poste).
// Usage : bun src/host/desktop-svg.ts [sortie.svg]   ou   GET /desktop.svg (server.ts)
import { homedir } from "node:os";
import { join } from "node:path";

type Bounds = { x: number; y: number; width: number; height: number };
type Node = { role?: string; name?: string; bounds?: Bounds; children?: Node[]; native_id?: { value?: string } };
type Win = { id: string; app_name: string; title: string; minimized: boolean; bounds: Bounds };

const exe =
  Bun.which("agent-desktop") ?? join(homedir(), ".local", "bin", process.platform === "win32" ? "agent-desktop.exe" : "agent-desktop");
async function ad(...args: string[]) {
  const p = Bun.spawn([exe, ...args], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
  const out = await new Response(p.stdout).text();
  await p.exited;
  const j = JSON.parse(out) as { ok: boolean; data: unknown };
  if (!j.ok) throw new Error(`agent-desktop ${args[0]} a échoué`);
  return j.data;
}

const ROLE_STYLE: Record<string, string> = {
  window: "fill:#0d1320;stroke:#3a5a8c;stroke-width:2",
  pane: "fill:#111a29;stroke:#22324a",
  group: "fill:none;stroke:#2a3a55;stroke-dasharray:4 3",
  button: "fill:#1f3b63;stroke:#4a7fc1",
  tab: "fill:#1b2f4d;stroke:#3d6aa8",
  edit: "fill:#0a0f18;stroke:#5fa8d3",
  document: "fill:#0a0f18;stroke:#4f6d8f",
  text: "fill:none;stroke:none",
  statictext: "fill:none;stroke:none",
  list: "fill:#101827;stroke:#2f4566",
  listitem: "fill:#152238;stroke:#2b3f5f",
  menu: "fill:#1a1f2e;stroke:#6c5b9e",
  menuitem: "fill:#221d38;stroke:#6c5b9e",
  menubar: "fill:#1a1f2e;stroke:#6c5b9e",
  toolbar: "fill:#14202f;stroke:#2f5d62",
  image: "fill:#2a2440;stroke:#8e6fd1",
  checkbox: "fill:#1f3b2f;stroke:#4caf7d",
  combobox: "fill:#2f2a1f;stroke:#c9a14a",
  scrollbar: "fill:#0f141d;stroke:#2a3346",
  hyperlink: "fill:none;stroke:#4cc9f0",
  tree: "fill:#101827;stroke:#2f4566",
  treeitem: "fill:#152238;stroke:#2b3f5f",
  titlebar: "fill:#172235;stroke:#3a5a8c",
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function emit(n: Node, out: string[], depth: number, stats: { nodes: number }) {
  const b = n.bounds;
  const role = (n.role ?? "node").toLowerCase();
  const name = n.name ?? "";
  if (b && b.width > 0 && b.height > 0) {
    stats.nodes++;
    out.push(`<g class="${esc(role)}" data-depth="${depth}"${name ? ` data-name="${esc(name.slice(0, 200))}"` : ""}>`);
    out.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${role === "button" ? 4 : 2}" style="${ROLE_STYLE[role] ?? "fill:none;stroke:#26303f"}"/>`,
    );
    if (name && b.height >= 12 && b.width >= 24) {
      const fs = Math.max(9, Math.min(16, b.height * 0.55));
      out.push(
        `<text x="${b.x + 4}" y="${b.y + Math.min(b.height - 3, fs + 2)}" font-size="${fs.toFixed(1)}" textLength="${Math.max(0, Math.min(b.width - 8, name.length * fs * 0.6)).toFixed(0)}" lengthAdjust="spacingAndGlyphs">${esc(name.slice(0, 120))}</text>`,
      );
    }
  }
  for (const c of n.children ?? []) emit(c, out, depth + 1, stats);
  if (b && b.width > 0 && b.height > 0) out.push("</g>");
}

/** SVG du bureau entier (écrans, fenêtres visibles dans l'ordre Z, barre des tâches). */
export async function desktopSvg(maxDepth = 14) {
  const t0 = performance.now();
  const displays = (await ad("list-displays")) as { bounds: Bounds; scale: number }[];
  const wins = ((await ad("list-windows")) as Win[]).filter((w) => !w.minimized && w.bounds.width > 0);
  const minX = Math.min(...displays.map((d) => d.bounds.x));
  const minY = Math.min(...displays.map((d) => d.bounds.y));
  const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
  const stats = { nodes: 0, windows: 0 };
  const body: string[] = [];
  const trees = await Promise.all(
    wins.map((w) =>
      ad("snapshot", "--window-id", w.id, "--include-bounds", "--max-depth", String(maxDepth))
        .then((d) => ({ w, tree: (d as { tree: Node }).tree }))
        .catch(() => ({ w, tree: null })),
    ),
  );
  const taskbar = await ad("snapshot", "--surface", "taskbar", "--include-bounds", "--max-depth", "6").catch(() => null);
  // list-windows renvoie l'ordre Z du haut vers le bas : on dessine du bas vers le haut.
  for (const { w, tree } of trees.reverse()) {
    stats.windows++;
    body.push(`<g class="toplevel" data-app="${esc(w.app_name)}" data-title="${esc(w.title)}">`);
    if (tree) emit(tree, body, 0, stats);
    else
      body.push(
        `<rect x="${w.bounds.x}" y="${w.bounds.y}" width="${w.bounds.width}" height="${w.bounds.height}" style="${ROLE_STYLE.window}"/>`,
      );
    body.push("</g>");
  }
  if (taskbar) emit((taskbar as { tree: Node }).tree, body, 0, stats);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="${maxX - minX}" height="${maxY - minY}" font-family="Segoe UI Variable, Segoe UI, sans-serif">`,
    `<title>Bureau Windows vectorisé (UI Automation) — ${new Date().toISOString()}</title>`,
    `<style>text{fill:#dfe7f2;pointer-events:none} g:hover>rect{stroke:#ffd166;stroke-width:2}</style>`,
    `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#05070b"/>`,
    ...displays.map(
      (d) =>
        `<rect x="${d.bounds.x}" y="${d.bounds.y}" width="${d.bounds.width}" height="${d.bounds.height}" fill="#070a10" stroke="#1b2638"/>`,
    ),
    ...body,
    "</svg>",
  ].join("\n");
  return { svg, stats: { ...stats, ms: Math.round(performance.now() - t0) } };
}

if (import.meta.main) {
  const out = process.argv[2] ?? join(import.meta.dir, "..", "..", "..", "target", "desktop.svg");
  const { svg, stats } = await desktopSvg();
  await Bun.write(out, svg);
  console.log(JSON.stringify({ out, bytes: svg.length, ...stats }));
}
