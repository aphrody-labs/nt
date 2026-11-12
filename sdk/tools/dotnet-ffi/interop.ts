// Chemins des artefacts Nt.Interop (produits par `just interop`, en CI) et type minimal des liaisons générées.
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const os = process.platform === "win32" ? "win" : process.platform === "darwin" ? "osx" : "linux";
export const rid = process.env.NT_RID ?? `${os}-${process.arch === "arm64" ? "arm64" : "x64"}`;
const native = process.platform === "win32" ? "Nt.Interop.dll" : `libNt.Interop.${process.platform === "darwin" ? "dylib" : "so"}`;

export const paths = {
  il: join(root, "target", "dotnet", "bin", "Nt.Interop", "release", "Nt.Interop.dll"),
  native: join(root, "target", "dotnet", "publish", "Nt.Interop", `release_${rid}`, native),
  bindings: join(root, "target", "dotnet-ffi", "Nt.Interop.js"),
};
/** Chemin hébergé : assemblage IL + liaisons ; chemin natif : en plus le binaire NativeAOT. */
export const builtHosted = existsSync(paths.il) && existsSync(paths.bindings);
export const built = builtHosted && existsSync(paths.native);

export type SystemInfo = {
  major: number;
  build: number;
  revision: number;
  platform: number;
  architecture: number;
  processorCount: number;
  pageSize: number;
  isAot: number;
  is64Bit: number;
  totalMemory: bigint;
  tickCount: bigint;
  displayVersion: string;
  toJSON(): Record<string, unknown>;
};
export type Api = {
  noop(): void;
  add(a: number, b: number): number;
  tickCount(): bigint;
  systemInfo(out: SystemInfo): number;
  machineName(): string;
  osDescription(): string;
  framework(): string;
  runtimeId(): string;
  utf8Length(s: string): number;
  utf16Length(s: string): number;
  upper(s: string): string;
  drives(visit: (name: number, length: number, kind: number, size: bigint) => number): number;
  sumCallbacks(cb: (i: number) => number, count: number): bigint;
  dynamicCode?(): number;
};
export type Bindings = {
  assembly: { name: string; version: string; mvid: string };
  nativeLibrary: string;
  methods: readonly { js: string; entryPoint: string | null }[];
  NtSystemInfo: { new (): SystemInfo; size: number; align: number };
  NtDriveKind: Record<string, number>;
  readUtf16(p: number, length: number): string;
  openNative(path?: string): Api;
  bindPointers(resolve: (m: { type: string; method: string }) => number): Api;
};

export const load = async (): Promise<Bindings> => (await import(paths.bindings)) as Bindings;
