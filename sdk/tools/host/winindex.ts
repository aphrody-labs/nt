// Index complet d'une arborescence Windows (défaut : %SystemRoot%) dans SQLite (bun:sqlite, FTS5 trigramme).
// Énumération : FindFirstFileExW(FindExInfoBasic, FIND_FIRST_EX_LARGE_FETCH) / FindNextFileW via bun:ffi — une seule
// passe, tailles et dates sans stat supplémentaire (WIN32_FIND_DATAW, Learn minwinbase.h). Points d'analyse
// (jonctions, liens) enregistrés sans être suivis. En-têtes PE (exe, dll, sys…) : machine, sous-système, horodatage.
// Usage : bun src/host/winindex.ts [racine] [--pe]      -> target/index/windows.sqlite
import { Database } from "bun:sqlite";
import { dlopen } from "bun:ffi";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const k32 = dlopen("kernel32.dll", {
  FindFirstFileExW: { args: ["ptr", "u32", "ptr", "u32", "ptr", "u32"], returns: "u64" },
  FindNextFileW: { args: ["u64", "ptr"], returns: "i32" },
  FindClose: { args: ["u64"], returns: "i32" },
  GetLastError: { args: [], returns: "u32" },
});
const INVALID = 0xffffffffffffffffn;
const ATTR_DIR = 0x10;
const ATTR_REPARSE = 0x400;
const utf16 = new TextDecoder("utf-16le");

export const DB_PATH = join(import.meta.dir, "..", "..", "..", "target", "index", "windows.sqlite");

export function openIndex(path = DB_PATH, create = false) {
  if (create) mkdirSync(join(path, ".."), { recursive: true });
  const db = new Database(path, { create });
  db.run("PRAGMA journal_mode = WAL");
  return db;
}

/** Indexe `root` (récursif). Renvoie les compteurs. */
export function build(root: string, dbPath = DB_PATH) {
  const db = openIndex(dbPath, true);
  db.run("PRAGMA synchronous = OFF");
  db.run("DROP TABLE IF EXISTS dirs");
  db.run("DROP TABLE IF EXISTS files");
  db.run("DROP TABLE IF EXISTS names");
  db.run("DROP TABLE IF EXISTS meta");
  db.run(
    "CREATE TABLE dirs (id INTEGER PRIMARY KEY, parent INTEGER, depth INTEGER, path TEXT, name TEXT, files INTEGER, bytes INTEGER, denied INTEGER, reparse INTEGER)",
  );
  db.run(
    "CREATE TABLE files (id INTEGER PRIMARY KEY, dir INTEGER, name TEXT, ext TEXT, size INTEGER, mtime INTEGER, attrs INTEGER, machine INTEGER, subsystem INTEGER, pe_time INTEGER, pe_dll INTEGER)",
  );
  db.run("CREATE VIRTUAL TABLE names USING fts5(name, path UNINDEXED, tokenize = 'trigram')");
  db.run("CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)");
  const insDir = db.prepare("INSERT INTO dirs VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)");
  const insFile = db.prepare("INSERT INTO files (id, dir, name, ext, size, mtime, attrs) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insName = db.prepare("INSERT INTO names (rowid, name, path) VALUES (?, ?, ?)");

  const data = new Uint8Array(600);
  const view = new DataView(data.buffer);
  const t0 = performance.now();
  let fileId = 0;
  let dirId = 0;
  let denied = 0;
  let bytes = 0;
  const stack: { id: number; path: string; depth: number }[] = [];
  const rootName = root.replace(/[\\/]+$/, "");
  insDir.run(++dirId, 0, 0, rootName, rootName, 0, 0);
  stack.push({ id: dirId, path: rootName, depth: 0 });

  db.transaction(() => {
    while (stack.length) {
      const d = stack.pop()!;
      const pattern = new Uint8Array(Buffer.from(`\\\\?\\${d.path}\\*\0`, "utf16le"));
      const h = k32.symbols.FindFirstFileExW(pattern, 1, data, 0, null, 2);
      if (h === INVALID) {
        denied++;
        db.run("UPDATE dirs SET denied = 1 WHERE id = ?", [d.id]);
        continue;
      }
      try {
        do {
          const attrs = view.getUint32(0, true);
          let end = 44;
          while (end < 564 && (data[end] || data[end + 1])) end += 2;
          const name = utf16.decode(data.subarray(44, end));
          if (name === "." || name === "..") continue;
          const full = `${d.path}\\${name}`;
          if (attrs & ATTR_DIR) {
            const reparse = attrs & ATTR_REPARSE ? view.getUint32(36, true) : 0;
            insDir.run(++dirId, d.id, d.depth + 1, full, name, 0, reparse);
            if (!reparse) stack.push({ id: dirId, path: full, depth: d.depth + 1 });
          } else {
            const size = view.getUint32(28, true) * 4294967296 + view.getUint32(32, true);
            const ft = view.getUint32(24, true) * 4294967296 + view.getUint32(20, true);
            const mtime = ft ? Math.round(ft / 10000 - 11644473600000) : 0;
            const dot = name.lastIndexOf(".");
            const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
            insFile.run(++fileId, d.id, name, ext, size, mtime, attrs);
            insName.run(fileId, name, full);
            bytes += size;
          }
        } while (k32.symbols.FindNextFileW(h, data));
      } finally {
        k32.symbols.FindClose(h);
      }
    }
  })();

  // Agrégats récursifs par dossier (fichiers et octets), du plus profond au moins profond.
  db.run("CREATE INDEX files_dir ON files(dir)");
  db.run("CREATE INDEX files_ext ON files(ext)");
  db.run("CREATE INDEX dirs_parent ON dirs(parent)");
  db.run(
    "UPDATE dirs SET files = (SELECT count(*) FROM files f WHERE f.dir = dirs.id), bytes = (SELECT coalesce(sum(size), 0) FROM files f WHERE f.dir = dirs.id)",
  );
  const maxDepth = (db.query("SELECT max(depth) m FROM dirs").get() as { m: number }).m;
  const roll = db.prepare(
    "UPDATE dirs SET files = files + (SELECT coalesce(sum(c.files), 0) FROM dirs c WHERE c.parent = dirs.id), bytes = bytes + (SELECT coalesce(sum(c.bytes), 0) FROM dirs c WHERE c.parent = dirs.id) WHERE depth = ?",
  );
  db.transaction(() => {
    for (let depth = maxDepth - 1; depth >= 0; depth--) roll.run(depth);
  })();
  const ms = performance.now() - t0;
  const stats = { root: rootName, files: fileId, dirs: dirId, denied, bytes, ms: Math.round(ms), date: new Date().toISOString() };
  db.run("INSERT INTO meta VALUES ('stats', ?)", [JSON.stringify(stats)]);
  db.close();
  return stats;
}

/** En-têtes PE (MZ -> PE\0\0 -> IMAGE_FILE_HEADER + champs optionnels) des binaires indexés. */
export async function peHeaders(dbPath = DB_PATH) {
  const db = openIndex(dbPath);
  const rows = db
    .query(
      "SELECT f.id, d.path || '\\' || f.name p FROM files f JOIN dirs d ON d.id = f.dir WHERE f.ext IN ('exe','dll','sys','efi','ocx','cpl','drv','scr','mui','winmd') AND f.size >= 512",
    )
    .all() as { id: number; p: string }[];
  const upd = db.prepare("UPDATE files SET machine = ?, subsystem = ?, pe_time = ?, pe_dll = ? WHERE id = ?");
  const results: [number, number, number, number, number][] = [];
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++]!;
      try {
        const b = new DataView(await Bun.file(r.p).slice(0, 1024).arrayBuffer());
        if (b.byteLength < 64 || b.getUint16(0, true) !== 0x5a4d) continue;
        const pe = b.getUint32(60, true);
        if (pe + 24 + 70 > b.byteLength || b.getUint32(pe, true) !== 0x4550) continue;
        const machine = b.getUint16(pe + 4, true);
        const time = b.getUint32(pe + 8, true);
        const opt = pe + 24;
        results.push([machine, b.getUint16(opt + 68, true), time, b.getUint16(opt + 70, true), r.id]);
      } catch {
        // fichier verrouillé ou refusé : ignoré
      }
    }
  };
  await Promise.all(Array.from({ length: 32 }, worker));
  db.transaction(() => {
    for (const x of results) upd.run(...x);
  })();
  db.close();
  return { candidates: rows.length, parsed: results.length };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const root = args.find((a) => !a.startsWith("--")) ?? process.env.SystemRoot ?? "C:\\Windows";
  const s = build(root);
  console.log(JSON.stringify(s));
  if (args.includes("--pe")) {
    const t = performance.now();
    const pe = await peHeaders();
    console.log(JSON.stringify({ ...pe, ms: Math.round(performance.now() - t) }));
  }
}
