// Héberge CoreCLR dans le processus bun via hostfxr, par bun:ffi seul (ni nethost ni node-api-dotnet).
// Contrat : dotnet/runtime release/11.0 @ 426561366bbf (2026-11-11), src/native/corehost/hostfxr.h et coreclr_delegates.h ;
// docs/design/features/native-hosting.md. char_t = UTF-16 sous Windows, UTF-8 ailleurs. Un seul runtime par processus.
import { CFunction, dlopen, type Pointer } from "bun:ffi";
import { readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const win = process.platform === "win32";
/** hostfxr_delegate_type::hdt_load_assembly_and_get_function_pointer (6e valeur de l'énumération). */
const HDT_LOAD_ASSEMBLY_AND_GET_FUNCTION_POINTER = 5;
/** UNMANAGEDCALLERSONLY_METHOD = (const char_t*)-1. */
const UNMANAGEDCALLERSONLY_METHOD = -1;

/** Chaîne char_t terminée par NUL. */
export const charT = (s: string) => Buffer.from(`${s}\0`, win ? "utf16le" : "utf8");

const fxrName = win ? "hostfxr.dll" : process.platform === "darwin" ? "libhostfxr.dylib" : "libhostfxr.so";

const versionKey = (v: string) => {
  const [core = "", pre] = v.split("-", 2);
  const n = core.split(".").map((x) => Number.parseInt(x, 10) || 0);
  return { n, pre };
};
const newer = (a: string, b: string) => {
  const x = versionKey(a);
  const y = versionKey(b);
  for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) {
    const d = (x.n[i] ?? 0) - (y.n[i] ?? 0);
    if (d) return d > 0;
  }
  if (!x.pre !== !y.pre) return !x.pre; // une version stable l'emporte sur sa préversion
  return (x.pre ?? "") > (y.pre ?? "");
};

/** Racines .NET candidates, sans chemin en dur : DOTNET_ROOT, puis dossier réel de `dotnet` trouvé dans le PATH. */
export function dotnetRoots(): string[] {
  const roots: string[] = [];
  if (process.env.DOTNET_ROOT) roots.push(process.env.DOTNET_ROOT);
  const exe = Bun.which("dotnet");
  if (exe) roots.push(dirname(realpathSync(exe)));
  return [...new Set(roots)];
}

/** Chemin de hostfxr : host/fxr/<version la plus récente>/ de la première racine qui en contient un. */
export function findHostfxr(): string {
  for (const root of dotnetRoots()) {
    let best = "";
    try {
      for (const v of readdirSync(join(root, "host", "fxr"))) if (!best || newer(v, best)) best = v;
    } catch {
      continue;
    }
    if (best) return join(root, "host", "fxr", best, fxrName);
  }
  throw new Error(`hostfxr introuvable (racines : ${dotnetRoots().join(", ")}) ; définir DOTNET_ROOT`);
}

const hex = (rc: number) => `0x${(rc >>> 0).toString(16).padStart(8, "0")}`;

export type Host = {
  hostfxr: string;
  /** Code de hostfxr_initialize_for_runtime_config : 0 premier contexte, 1 runtime déjà initialisé (contexte secondaire). */
  init: number;
  /** load_assembly_and_get_function_pointer(assembly, "Type, Assemblage", méthode, UNMANAGEDCALLERSONLY_METHOD). */
  functionPointer(assembly: string, typeName: string, method: string): Pointer;
};

let current: Host | undefined;

/**
 * Initialise le runtime depuis un .runtimeconfig.json (composant dépendant du framework, EnableDynamicLoading) et renvoie
 * le délégué de chargement. Appels suivants : même hôte (le runtime ne se décharge pas).
 */
export function hostDotnet(runtimeConfig: string, hostfxr = process.env.NT_HOSTFXR ?? findHostfxr()): Host {
  if (current) return current;
  const fxr = dlopen(hostfxr, {
    hostfxr_initialize_for_runtime_config: { args: ["ptr", "ptr", "ptr"], returns: "i32" },
    hostfxr_get_runtime_delegate: { args: ["ptr", "i32", "ptr"], returns: "i32" },
    hostfxr_close: { args: ["ptr"], returns: "i32" },
  }).symbols;
  const out = new BigUint64Array(1);
  const init = fxr.hostfxr_initialize_for_runtime_config(charT(runtimeConfig), null, out);
  if (init < 0 || init > 2) throw new Error(`hostfxr_initialize_for_runtime_config(${runtimeConfig}) : ${hex(init)}`);
  const handle = Number(out[0]) as Pointer;
  const rc = fxr.hostfxr_get_runtime_delegate(handle, HDT_LOAD_ASSEMBLY_AND_GET_FUNCTION_POINTER, out);
  fxr.hostfxr_close(handle); // le délégué reste valide : le runtime est chargé pour la vie du processus
  if (rc !== 0) throw new Error(`hostfxr_get_runtime_delegate : ${hex(rc)}`);
  const load = CFunction({ ptr: Number(out[0]) as Pointer, args: ["ptr", "ptr", "ptr", "ptr", "ptr", "ptr"], returns: "i32" });
  const fn = new BigUint64Array(1);
  current = {
    hostfxr,
    init,
    functionPointer(assembly, typeName, method) {
      const r = load(charT(assembly), charT(typeName), charT(method), UNMANAGEDCALLERSONLY_METHOD as Pointer, null, fn) as number;
      if (r !== 0) throw new Error(`load_assembly_and_get_function_pointer(${typeName}.${method}) : ${hex(r)}`);
      return Number(fn[0]) as Pointer;
    },
  };
  return current;
}

type Bindings<A> = {
  assembly: { readonly name: string };
  bindPointers(resolve: (m: { type: string; method: string }) => Pointer): A;
};

/** Liaisons générées (gen.ts) branchées sur CoreCLR : assemblage IL + .runtimeconfig.json voisin. */
export function openHosted<A>(
  bindings: Bindings<A>,
  assemblyPath: string,
  runtimeConfig = assemblyPath.replace(/\.dll$/i, ".runtimeconfig.json"),
): A {
  const host = hostDotnet(resolve(runtimeConfig));
  const full = resolve(assemblyPath);
  return bindings.bindPointers((m) => host.functionPointer(full, `${m.type}, ${bindings.assembly.name}`, m.method));
}
