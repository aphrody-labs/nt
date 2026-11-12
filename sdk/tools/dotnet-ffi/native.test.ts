// NativeAOT : dlopen du binaire publié + modèle lu dans l'assemblage IL. Ignoré sans artefacts (`just interop`, CI).
import { beforeAll, describe, expect, test } from "bun:test";
import { sharedChecks } from "./checks.ts";
import { readAssembly } from "./ecma335.ts";
import { type Api, type Bindings, built, load, paths } from "./interop.ts";
import { buildModel } from "./model.ts";

describe.skipIf(!built)("Nt.Interop NativeAOT", () => {
  let ctx: { b: Bindings; api: Api };
  beforeAll(async () => {
    const b = await load();
    ctx = { b, api: b.openNative(paths.native) };
  });

  test("modèle ECMA-335 : exports, disposition, énumérations", async () => {
    const m = buildModel(readAssembly(await Bun.file(paths.il).arrayBuffer()));
    expect(m.rejected).toEqual([]);
    const byEntry = new Map(m.exports.map((x) => [x.entryPoint, x]));
    expect(byEntry.get("nt_add")?.params.map((p) => p.ty)).toEqual([
      { k: "prim", ffi: "i32", size: 4 },
      { k: "prim", ffi: "i32", size: 4 },
    ]);
    expect(byEntry.get("nt_machine_name")?.params[0]?.marker).toBe("Utf16Buffer");
    expect(byEntry.get("nt_utf8_length")?.params[0]?.marker).toBe("Utf8");
    expect(byEntry.get("nt_drives")?.params[0]?.ty.k).toBe("fn");
    expect(m.exports.find((x) => x.method === "DynamicCode")?.entryPoint).toBeNull();
    const info = m.structs.find((s) => s.name === "NtSystemInfo")!;
    expect([info.size, info.align]).toEqual([88, 8]);
    expect(Object.fromEntries(info.fields.map((f) => [f.name, f.offset]))).toMatchObject({
      IsAot: 32,
      TotalMemory: 40,
      DisplayVersion: 56,
    });
    expect(Object.fromEntries(m.enums.find((e) => e.name === "NtDriveKind")!.members)).toMatchObject({ Fixed: 3, Ram: 6 });
  });

  test("API native : méthode sans EntryPoint absente", () => {
    expect(ctx.api.dynamicCode).toBeUndefined();
    expect(ctx.b.methods.filter((x) => x.entryPoint).length).toBe(Object.keys(ctx.api).length);
  });

  sharedChecks("NativeAOT", () => ctx, true);
});
