// Assertions communes aux deux chemins (NativeAOT, CoreCLR hébergé) : faits réels de l'hôte comparés à node:os.
import { expect, test } from "bun:test";
import { hostname } from "node:os";
import type { Api, Bindings } from "./interop.ts";

export function sharedChecks(name: string, get: () => { b: Bindings; api: Api }, aot: boolean) {
  test(`${name} : arithmétique et entiers 64 bits`, () => {
    const { api } = get();
    expect(api.add(2, 3)).toBe(5);
    expect(api.add(2 ** 31 - 1, 1)).toBe(-(2 ** 31)); // débordement int32 de C#
    expect(api.noop()).toBeUndefined();
    expect(typeof api.tickCount()).toBe("bigint");
    expect(api.tickCount()).toBeGreaterThan(0n);
  });

  test(`${name} : structure NtSystemInfo par pointeur`, () => {
    const { b, api } = get();
    expect(b.NtSystemInfo.size).toBe(88);
    const info = new b.NtSystemInfo();
    expect(api.systemInfo(info)).toBe(0);
    expect(info.isAot).toBe(aot ? 1 : 0);
    expect(info.is64Bit).toBe(1);
    expect(info.platform).toBe(process.platform === "win32" ? 1 : process.platform === "linux" ? 2 : 3);
    expect(info.architecture).toBe(process.arch === "arm64" ? 3 : 1);
    expect(info.processorCount).toBeGreaterThan(0);
    expect(info.pageSize).toBeGreaterThanOrEqual(4096);
    expect(info.major).toBeGreaterThan(0);
    if (process.platform === "win32") expect(info.build).toBeGreaterThan(0);
    expect(info.totalMemory).toBeGreaterThan(0n);
    if (process.platform === "win32") expect(info.displayVersion.length).toBeGreaterThan(0);
    console.log(
      name,
      JSON.stringify(info.toJSON(), (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    );
  });

  test(`${name} : chaînes UTF-16/UTF-8 (entrée, tampons de sortie, agrandissement)`, () => {
    const { api } = get();
    expect(hostname().toLowerCase().startsWith(api.machineName().toLowerCase())).toBe(true);
    expect(api.framework()).toStartWith(".NET 11");
    expect(api.runtimeId()).toEndWith(process.arch === "arm64" ? "arm64" : "x64");
    expect(api.osDescription().length).toBeGreaterThan(0);
    const s = "héllo wörld ✓ 𝄞";
    expect(api.utf8Length(s)).toBe(Buffer.byteLength(s, "utf8"));
    expect(api.utf16Length(s)).toBe(s.length);
    expect(api.upper("abc-xyz")).toBe("ABC-XYZ");
    const long = "x".repeat(1000); // > capacité initiale (256) : deuxième appel
    expect(api.upper(long)).toBe(long.toUpperCase());
  });

  test(`${name} : rappels .NET -> JS (JSCallback)`, () => {
    const { b, api } = get();
    const seen: string[] = [];
    const n = api.drives((p, len, kind, size) => {
      seen.push(`${b.readUtf16(p, len)}:${kind}:${size}`);
      return 1;
    });
    expect(n).toBeGreaterThan(0);
    expect(seen.length).toBe(n);
    expect(seen.some((d) => d.startsWith(process.platform === "win32" ? "C:\\" : "/:"))).toBe(true);
    expect(api.sumCallbacks((i) => i * 2, 1000)).toBe(999000n);
  });
}
