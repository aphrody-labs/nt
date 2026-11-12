// Worker d'analyse syntaxique (tree-sitter C/C++, grammaires wasm) : un fichier source -> fonctions, état d'implémentation,
// appels, types, inclusions. L'arbre est concret et tolérant aux erreurs : les macros non développées (WINAPI, NTAPI…)
// produisent des nœuds ERROR locaux sans empêcher l'extraction des définitions.
import { Language, type Node, Parser } from "web-tree-sitter";

declare const self: Worker;
export type FnInfo = {
  name: string;
  line: number;
  end: number;
  static: boolean;
  statements: number;
  status: "real" | "stub" | "partial";
  markers: string[];
  calls: string[];
};
export type FileInfo = { file: string; error?: string; hasError: boolean; functions: FnInfo[]; types: string[]; includes: string[] };

const root = new URL("../../../node_modules/", import.meta.url);
await Parser.init();
const C = await Language.load(Bun.fileURLToPath(new URL("tree-sitter-c/tree-sitter-c.wasm", root)));
const CPP = await Language.load(Bun.fileURLToPath(new URL("tree-sitter-cpp/tree-sitter-cpp.wasm", root)));
const pc = new Parser();
pc.setLanguage(C);
const pcpp = new Parser();
pcpp.setLanguage(CPP);

const STUB_IDS = new Set(["UNIMPLEMENTED", "UNIMPLEMENTED_ONCE", "UNIMPLEMENTED_DBGBREAK", "STUB", "UNIMPLEMENTED_ONCE_DBGBREAK"]);
const NOT_IMPL = /^(STATUS_NOT_IMPLEMENTED|E_NOTIMPL|ERROR_CALL_NOT_IMPLEMENTED|STATUS_NOT_SUPPORTED)$/;

const declName = (d: Node | null): string => {
  // function_declarator -> declarator (identifier, field_identifier, qualified_identifier, pointer_declarator…)
  let n: Node | null = d;
  for (let i = 0; n && i < 8; i++) {
    if (n.type === "function_declarator") return declName(n.childForFieldName("declarator"));
    if (["identifier", "field_identifier", "qualified_identifier", "destructor_name", "operator_name"].includes(n.type)) return n.text;
    n = n.childForFieldName("declarator") ?? n.namedChildren.find((c) => c && /declarator|identifier/.test(c.type)) ?? null;
  }
  return "";
};

function analyze(file: string, text: string): FileInfo {
  const parser = /\.(cpp|cc|cxx|hpp)$/i.test(file) ? pcpp : pc;
  const tree = parser.parse(text);
  if (!tree) return { file, error: "parse", hasError: true, functions: [], types: [], includes: [] };
  const r = tree.rootNode;
  const functions: FnInfo[] = [];
  for (const f of r.descendantsOfType("function_definition")) {
    if (!f) continue;
    const name = declName(f.childForFieldName("declarator"));
    if (!name) continue;
    const body = f.childForFieldName("body");
    const markers = new Set<string>();
    const calls = new Set<string>();
    let statements = 0;
    if (body) {
      statements = body.descendantsOfType([
        "expression_statement",
        "return_statement",
        "if_statement",
        "for_statement",
        "while_statement",
        "switch_statement",
        "declaration",
      ]).length;
      for (const id of body.descendantsOfType("identifier")) {
        if (!id) continue;
        if (STUB_IDS.has(id.text) && id.parent && ["expression_statement", "call_expression"].includes(id.parent.type))
          markers.add(id.text);
        if (NOT_IMPL.test(id.text)) {
          let p = id.parent;
          while (p && p.type !== "return_statement" && p.type !== "call_expression" && p !== body) p = p.parent;
          if (
            p?.type === "return_statement" ||
            (p?.type === "call_expression" && /SetLastError|BaseSetLastNTError/.test(p.childForFieldName("function")?.text ?? ""))
          )
            markers.add(id.text);
        }
      }
      for (const c of body.descendantsOfType("call_expression")) {
        const fn = c?.childForFieldName("function");
        if (!fn) continue;
        if (fn.type === "identifier") calls.add(fn.text);
        // Wine : FIXME("… stub …") marque une fonction non implémentée.
        if (fn.text === "FIXME" && /stub/i.test(c!.childForFieldName("arguments")?.text ?? "")) markers.add("FIXME(stub)");
      }
    }
    const status: FnInfo["status"] = markers.size === 0 ? "real" : statements <= markers.size + 3 ? "stub" : "partial";
    const spec = f.childForFieldName("type")?.parent?.children.find((c) => c?.type === "storage_class_specifier");
    functions.push({
      name,
      line: f.startPosition.row + 1,
      end: f.endPosition.row + 1,
      static: spec?.text === "static",
      statements,
      status,
      markers: [...markers],
      calls: [...calls].sort(),
    });
  }
  const types = new Set<string>();
  for (const t of r.descendantsOfType(["struct_specifier", "union_specifier", "enum_specifier", "type_definition"])) {
    if (!t) continue;
    if (t.type === "type_definition") {
      const d = t.childForFieldName("declarator");
      if (d?.type === "type_identifier") types.add(d.text);
    } else if (t.childForFieldName("body")) {
      const n = t.childForFieldName("name");
      if (n) types.add(n.text);
    }
  }
  const includes = r
    .descendantsOfType("preproc_include")
    .map((i) => i?.childForFieldName("path")?.text.replace(/^[<"]|[>"]$/g, "") ?? "")
    .filter(Boolean);
  const out = { file, hasError: r.hasError, functions, types: [...types].sort(), includes };
  tree.delete();
  return out;
}

self.onmessage = async (e: MessageEvent<{ root: string; files: string[] }>) => {
  const res: FileInfo[] = [];
  for (const f of e.data.files) {
    try {
      res.push(analyze(f, await Bun.file(`${e.data.root}/${f}`).text()));
    } catch (err) {
      res.push({ file: f, error: String(err).slice(0, 200), hasError: true, functions: [], types: [], includes: [] });
    }
  }
  postMessage(res);
};
