// Serveur bun : HTML + TS bundlés par Bun.serve, noyau wasm servi tel quel (localhost = contexte sécurisé).
import index from "./index.html";

const wasmPath = new URL("../../target/wasm32-unknown-unknown/wasm/nt_web.wasm", import.meta.url);
const statsPath = new URL("../../target/web-live-stats.json", import.meta.url);
const port = Number(process.env.PORT ?? 8787);

Bun.serve({
  port,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/stats": {
      POST: async (req) => {
        await Bun.write(statsPath, await req.text());
        return new Response(null, { status: 204 });
      },
      GET: () => new Response(Bun.file(statsPath)),
    },
    "/nt.wasm": () => new Response(Bun.file(wasmPath), { headers: { "content-type": "application/wasm", "cache-control": "no-store" } }),
  },
});
console.log(`nt in browser : http://localhost:${port}/?res=3840x2160&n=10000`);
