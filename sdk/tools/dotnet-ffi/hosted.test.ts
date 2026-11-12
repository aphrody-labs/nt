// CoreCLR hébergé dans bun par hostfxr (assemblage IL + .runtimeconfig.json). Processus distinct du test NativeAOT.
import { beforeAll, describe, expect, test } from "bun:test";
import { sharedChecks } from "./checks.ts";
import { hostDotnet, openHosted } from "./hostfxr.ts";
import { type Api, type Bindings, builtHosted, load, paths } from "./interop.ts";

describe.skipIf(!builtHosted)("Nt.Interop CoreCLR (hostfxr)", () => {
  let ctx: { b: Bindings; api: Api };
  beforeAll(async () => {
    const b = await load();
    ctx = { b, api: openHosted(b, paths.il) };
  });

  test("méthode sans EntryPoint joignable, code dynamique actif", () => {
    expect(ctx.api.dynamicCode?.()).toBe(1);
    expect(hostDotnet("").init).toBeGreaterThanOrEqual(0); // même hôte : pas de réinitialisation
  });

  sharedChecks("CoreCLR", () => ctx, false);
});
