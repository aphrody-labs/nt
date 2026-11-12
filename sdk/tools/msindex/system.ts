// Preuves sur le système en marche (Windows, bun:ffi), par les mécanismes mêmes de Windows :
//   - schéma API Set lu dans PEB->ApiSetMap (API_SET_NAMESPACE v6, winsiderss/phnt@53fbbdc5 ntpebteb.h), résolution
//     contrat -> DLL hôte comme le chargeur (comparaison sur HashedLength, valeur par défaut) ;
//   - présence des points d'entrée par le chargeur : LoadLibraryExW(DONT_RESOLVE_DLL_REFERENCES | LOAD_LIBRARY_SEARCH_SYSTEM32)
//     puis GetProcAddress (résout API Sets et redirections d'exports) ;
//   - classes WinRT du système : HKLM\SOFTWARE\Microsoft\WindowsRuntime\ActivatableClassId (DllPath, ActivationType), puis
//     RoGetActivationFactory(IID_IActivationFactory) pour les classes en processus ;
//   - noms C++ décorés : UnDecorateSymbolName (dbghelp).
// Mode enfant : `bun system.ts <requête.json> <réponse.json>` (chargement de DLL et activation isolés dans un processus jetable).
import { CFunction, dlopen, ptr, read, toArrayBuffer } from "bun:ffi";

const w = (s: string) => Buffer.from(`${s}\0`, "utf16le");
const a = (s: string) => Buffer.from(`${s}\0`, "latin1");
const k32 = dlopen("kernel32.dll", {
  LoadLibraryExW: { args: ["ptr", "ptr", "u32"], returns: "ptr" },
  GetProcAddress: { args: ["ptr", "ptr"], returns: "ptr" },
  GetLastError: { args: [], returns: "u32" },
});
const nt = dlopen("ntdll.dll", { NtQueryInformationProcess: { args: ["ptr", "u32", "ptr", "u32", "ptr"], returns: "i32" } });

export type ApiSet = { name: string; hashed: string; hosts: { importer: string; host: string }[]; sealed: boolean };

/** Schéma API Set du processus courant (copie du schéma chargé par le noyau au démarrage). */
export function apiSetSchema(): { version: number; count: number; sets: ApiSet[] } {
  const pbi = new BigUint64Array(6); // PROCESS_BASIC_INFORMATION (48 octets) : PebBaseAddress à +8
  const st = nt.symbols.NtQueryInformationProcess(-1 as never, 0, ptr(pbi), 48, null);
  if (st !== 0) throw new Error(`NtQueryInformationProcess 0x${(st >>> 0).toString(16)}`);
  const peb = Number(pbi[1]);
  const map = read.ptr(peb as never, 0x68); // PEB->ApiSetMap (x64)
  const head = new DataView(toArrayBuffer(map as never, 0, 28));
  const version = head.getUint32(0, true);
  if (version !== 6) throw new Error(`API_SET_NAMESPACE version ${version} (attendu 6)`);
  const v = new DataView(toArrayBuffer(map as never, 0, head.getUint32(4, true)));
  const str = (o: number, n: number) => Buffer.from(v.buffer, v.byteOffset + o, n).toString("utf16le");
  const count = v.getUint32(12, true);
  const entries = v.getUint32(16, true);
  const sets: ApiSet[] = [];
  for (let i = 0; i < count; i++) {
    const e = entries + i * 24;
    const name = str(v.getUint32(e + 4, true), v.getUint32(e + 8, true));
    const hosts: ApiSet["hosts"] = [];
    const vo = v.getUint32(e + 16, true);
    for (let j = 0; j < v.getUint32(e + 20, true); j++) {
      const x = vo + j * 20;
      hosts.push({
        importer: str(v.getUint32(x + 4, true), v.getUint32(x + 8, true)),
        host: str(v.getUint32(x + 12, true), v.getUint32(x + 16, true)),
      });
    }
    sets.push({ name, hashed: name.slice(0, v.getUint32(e + 12, true) / 2), hosts, sealed: Boolean(v.getUint32(e, true) & 1) });
  }
  return { version, count, sets };
}

/** Résolution d'un nom de DLL : contrat API Set -> hôte par défaut (chaîne vide = contrat sans hôte sur cette édition). */
export function apiSetResolver(sets: ApiSet[]) {
  const byHash = new Map(sets.map((s) => [s.hashed.toLowerCase(), s]));
  return (dll: string): { set?: string; host: string } => {
    const n = dll.toLowerCase().replace(/\.dll$/, "");
    if (!/^(api|ext)-/.test(n)) return { host: dll };
    const s = byHash.get(n.slice(0, n.lastIndexOf("-")));
    if (!s) return { set: n, host: "" };
    return { set: s.name, host: (s.hosts.find((h) => !h.importer) ?? s.hosts.at(-1))?.host ?? "" };
  };
}

// ---------------------------------------------------------------- processus enfant
const DONT_RESOLVE = 0x1;
const SEARCH_SYSTEM32 = 0x800;
export type LoaderReq =
  { kind: "loader"; items: [string, string][] } | { kind: "activate"; classes: string[] } | { kind: "undecorate"; names: string[] };

function loader(items: [string, string][]): [boolean, string][] {
  const mods = new Map<string, number>();
  return items.map(([dll, entry]) => {
    let h = mods.get(dll);
    if (h === undefined) {
      h = Number(k32.symbols.LoadLibraryExW(ptr(w(dll)), null, DONT_RESOLVE | SEARCH_SYSTEM32) ?? 0);
      if (!h) h = -Number(k32.symbols.GetLastError());
      mods.set(dll, h);
    }
    if (h <= 0) return [false, `LoadLibraryExW ${-h}`];
    const p = k32.symbols.GetProcAddress(h as never, ptr(a(entry)));
    return p ? [true, ""] : [false, `GetProcAddress ${k32.symbols.GetLastError()}`];
  });
}

function activate(classes: string[]): [boolean, string][] {
  const rt = dlopen("combase.dll", {
    RoInitialize: { args: ["u32"], returns: "i32" },
    WindowsCreateString: { args: ["ptr", "u32", "ptr"], returns: "i32" },
    WindowsDeleteString: { args: ["ptr"], returns: "i32" },
    RoGetActivationFactory: { args: ["ptr", "ptr", "ptr"], returns: "i32" },
  });
  rt.symbols.RoInitialize(1); // RO_INIT_MULTITHREADED
  // IID_IActivationFactory {00000035-0000-0000-C000-000000000046}
  const iid = new Uint8Array([0x35, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46]);
  const out = new BigUint64Array(1);
  const hs = new BigUint64Array(1);
  return classes.map((c) => {
    const s = Buffer.from(c, "utf16le");
    rt.symbols.WindowsCreateString(ptr(s), c.length, ptr(hs));
    const hr = rt.symbols.RoGetActivationFactory(Number(hs[0]) as never, ptr(iid), ptr(out)) >>> 0;
    rt.symbols.WindowsDeleteString(Number(hs[0]) as never);
    if (hr === 0 && out[0]) {
      const vtbl = read.ptr(Number(out[0]) as never, 0);
      CFunction({ ptr: read.ptr(vtbl as never, 16) as never, args: ["ptr"], returns: "u32" })(Number(out[0]));
      out[0] = 0n;
    }
    return [hr === 0, hr ? `0x${hr.toString(16)}` : ""];
  });
}

function undecorate(names: string[]): string[] {
  const dbg = dlopen("dbghelp.dll", { UnDecorateSymbolName: { args: ["ptr", "ptr", "u32", "u32"], returns: "u32" } });
  const buf = Buffer.alloc(4096);
  return names.map((n) => {
    const len = dbg.symbols.UnDecorateSymbolName(ptr(a(n)), ptr(buf), buf.length, 0); // UNDNAME_COMPLETE
    return len ? buf.toString("latin1", 0, len) : n;
  });
}

/** Exécute une requête dans un processus enfant (isolement des DllMain et fabriques) ; résultat JSON. */
export async function child<R>(req: LoaderReq): Promise<R> {
  const dir = `${process.env.TEMP ?? "."}`;
  const id = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  const qi = `${dir}/msindex-${id}.in.json`;
  const qo = `${dir}/msindex-${id}.out.json`;
  await Bun.write(qi, JSON.stringify(req));
  const p = Bun.spawn([process.execPath, import.meta.path, qi, qo], { stdout: "inherit", stderr: "pipe" });
  const code = await p.exited;
  const res = (await Bun.file(qo).exists()) ? await Bun.file(qo).json() : null;
  await Promise.all([
    Bun.file(qi).delete(),
    Bun.file(qo)
      .delete()
      .catch(() => {}),
  ]);
  if (code !== 0 || !res) throw new Error(`processus de preuve ${req.kind} : code ${code} ${await new Response(p.stderr).text()}`);
  return res as R;
}

if (import.meta.main) {
  const [qi, qo] = process.argv.slice(2);
  const req = (await Bun.file(qi!).json()) as LoaderReq;
  const res = req.kind === "loader" ? loader(req.items) : req.kind === "activate" ? activate(req.classes) : undecorate(req.names);
  await Bun.write(qo!, JSON.stringify(res));
}

/** Valeur REG_SZ de HKLM (chaîne vide si absente). */
export function hklmString(path: string, value: string): string {
  const adv = dlopen("advapi32.dll", { RegGetValueW: { args: ["ptr", "ptr", "ptr", "u32", "ptr", "ptr", "ptr"], returns: "i32" } });
  const data = Buffer.alloc(2048);
  const len = new Uint32Array([data.length]);
  const st = adv.symbols.RegGetValueW(0x80000002 as never, ptr(w(path)), ptr(w(value)), 0x2, null, ptr(data), ptr(len));
  return st === 0 ? data.toString("utf16le", 0, Math.max(0, len[0]! - 2)) : "";
}

/** Registre WinRT du système : classe -> { DllPath, ActivationType (0 = en processus, 1 = hors processus) }. */
export function winrtRegistry(): Map<string, { dll: string; type: number }> {
  const adv = dlopen("advapi32.dll", {
    RegOpenKeyExW: { args: ["ptr", "ptr", "u32", "u32", "ptr"], returns: "i32" },
    RegEnumKeyExW: { args: ["ptr", "u32", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr"], returns: "i32" },
    RegGetValueW: { args: ["ptr", "ptr", "ptr", "u32", "ptr", "ptr", "ptr"], returns: "i32" },
    RegCloseKey: { args: ["ptr"], returns: "i32" },
  });
  const HKLM = 0x80000002;
  const hk = new BigUint64Array(1);
  const out = new Map<string, { dll: string; type: number }>();
  if (
    adv.symbols.RegOpenKeyExW(HKLM as never, ptr(w("SOFTWARE\\Microsoft\\WindowsRuntime\\ActivatableClassId")), 0, 0x20019, ptr(hk)) !== 0
  )
    return out;
  const key = Number(hk[0]);
  const name = Buffer.alloc(1024);
  const len = new Uint32Array(1);
  const data = Buffer.alloc(2048);
  const dlen = new Uint32Array(1);
  const dw = new Uint32Array(1);
  for (let i = 0; ; i++) {
    len[0] = 512;
    if (adv.symbols.RegEnumKeyExW(key as never, i, ptr(name), ptr(len), null, null, null, null) !== 0) break;
    const cls = name.toString("utf16le", 0, len[0]! * 2);
    dlen[0] = data.length;
    const okPath = adv.symbols.RegGetValueW(key as never, ptr(w(cls)), ptr(w("DllPath")), 0x2, null, ptr(data), ptr(dlen)) === 0; // RRF_RT_REG_SZ (REG_EXPAND_SZ développé)
    dlen[0] = 4;
    adv.symbols.RegGetValueW(key as never, ptr(w(cls)), ptr(w("ActivationType")), 0x10, null, ptr(dw), ptr(dlen)); // REG_DWORD
    out.set(cls, { dll: okPath ? data.toString("utf16le").replace(/\0[\s\S]*$/, "") : "", type: dw[0]! });
    dw[0] = 0;
  }
  adv.symbols.RegCloseKey(key as never);
  return out;
}
