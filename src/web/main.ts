// Hôte navigateur : noyau nt (wasm) + rendu WebGPU. Aucune allocation propre par frame
// (descripteurs et tableaux réutilisés ; seuls les objets imposés par l'API WebGPU sont créés).
import shaderSrc from "./shader.wgsl" with { type: "text" };

type Exports = {
  memory: WebAssembly.Memory;
  nt_boot(w: number, h: number, seed: number, particles: number): void;
  nt_tick(nowMs: number): number;
  nt_instances(): number;
  nt_input(kind: number, x: number, y: number): void;
  nt_stats(): number;
};

const MAX_INSTANCES = 12_288;
const STRIDE = 32;
const q = new URLSearchParams(location.search);
const [W = 3840, H = 2160] = (q.get("res") ?? "3840x2160").split("x").map(Number);
const N = Number(q.get("n") ?? 10_000);
const overlay = document.getElementById("stats") as HTMLPreElement;
const canvas = document.querySelector("canvas") as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;

const fail = (m: string) => {
  overlay.textContent = m;
  throw new Error(m);
};
if (!navigator.gpu) fail("WebGPU indisponible (contexte sécurisé requis : localhost ou HTTPS)");
const adapter = (await navigator.gpu.requestAdapter({ powerPreference: "high-performance" })) ?? fail("aucun adaptateur WebGPU");
const hasTs = adapter.features.has("timestamp-query");
const device = await adapter.requestDevice({ requiredFeatures: hasTs ? ["timestamp-query"] : [] });
const format = navigator.gpu.getPreferredCanvasFormat();
const ctx = canvas.getContext("webgpu") as GPUCanvasContext;
ctx.configure({ device, format, alphaMode: "opaque" });

const { instance } = await WebAssembly.instantiateStreaming(fetch("/nt.wasm"), {});
const k = instance.exports as unknown as Exports;
k.nt_boot(W, H, 0x5eed, N);

const instBuf = device.createBuffer({ size: MAX_INSTANCES * STRIDE, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const uniBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(uniBuf, 0, new Float32Array([2 / W, 2 / H, W, H]));
const module = device.createShaderModule({ code: shaderSrc });
const blend: GPUBlendComponent = { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" };
const pipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: { module, entryPoint: "vs" },
  fragment: { module, entryPoint: "fs", targets: [{ format, blend: { color: blend, alpha: blend } }] },
  primitive: { topology: "triangle-strip" },
});
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: instBuf } },
    { binding: 1, resource: { buffer: uniBuf } },
  ],
});

// Horodatage GPU (si exposé) : 2 timestamps / frame, relecture asynchrone sur 2 tampons.
const qs = hasTs ? device.createQuerySet({ type: "timestamp", count: 2 }) : null;
const resolveBuf = hasTs ? device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : null;
const readBufs = hasTs ? [0, 1].map(() => device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })) : [];
const readBusy = [false, false];
let gpuMs = Number.NaN;
let gpuAcc = 0;
let gpuCount = 0;

const colorAttachment: GPURenderPassColorAttachment = {
  view: ctx.getCurrentTexture().createView(),
  loadOp: "clear",
  storeOp: "store",
  clearValue: { r: 0, g: 0, b: 0, a: 1 },
};
const passDesc: GPURenderPassDescriptor = {
  colorAttachments: [colorAttachment],
  ...(qs ? { timestampWrites: { querySet: qs, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {}),
};
const submitList: GPUCommandBuffer[] = [];

// Entrées : coordonnées écran → coordonnées noyau (backing store 4K).
const toKernel = (e: PointerEvent, kind: number) => {
  const r = canvas.getBoundingClientRect();
  k.nt_input(kind, ((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height);
};
canvas.addEventListener("pointermove", (e) => toKernel(e, 0));
canvas.addEventListener("pointerdown", (e) => toKernel(e, 1));
canvas.addEventListener("pointerup", (e) => toKernel(e, 2));

// Mesures : intervalles entre frames (rAF), coût du tick noyau.
const RING = 1024;
const intervals = new Float64Array(RING);
const sorted = new Float64Array(RING);
let ri = 0;
let filled = 0;
let last = 0;
let tickAcc = 0;
let frames = 0;
let presented = 0;
let lastInstances = 0;
const stats = {
  fps: 0,
  p50: 0,
  p99: 0,
  max: 0,
  gpuMs: Number.NaN,
  tickMs: 0,
  instances: 0,
  presented: 0,
  frames: 0,
  res: `${W}x${H}`,
  format,
  timestampQuery: hasTs,
  adapter: {
    vendor: adapter.info.vendor,
    architecture: adapter.info.architecture,
    device: adapter.info.device,
    description: adapter.info.description,
  },
};
(globalThis as Record<string, unknown>).__nt = stats;

function frame(now: number) {
  if (last > 0) {
    intervals[ri] = now - last;
    ri = (ri + 1) % RING;
    if (filled < RING) filled++;
  }
  last = now;
  frames++;
  const t0 = performance.now();
  const n = k.nt_tick(now);
  tickAcc += performance.now() - t0;
  if (n > 0) {
    lastInstances = n;
    device.queue.writeBuffer(instBuf, 0, k.memory.buffer, k.nt_instances(), n * STRIDE);
    colorAttachment.view = ctx.getCurrentTexture().createView();
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass(passDesc);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4, n);
    pass.end();
    const slot = presented & 1;
    const rb = readBufs[slot];
    const sample = qs && resolveBuf && rb && !readBusy[slot];
    if (sample) {
      enc.resolveQuerySet(qs, 0, 2, resolveBuf, 0);
      enc.copyBufferToBuffer(resolveBuf, 0, rb, 0, 16);
    }
    submitList[0] = enc.finish();
    device.queue.submit(submitList);
    if (sample) {
      readBusy[slot] = true;
      rb.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigUint64Array(rb.getMappedRange());
        const ns = Number((t[1] ?? 0n) - (t[0] ?? 0n));
        rb.unmap();
        readBusy[slot] = false;
        if (ns > 0 && ns < 1e9) {
          gpuAcc += ns / 1e6;
          gpuCount++;
        }
      });
    }
    presented++;
  }
  requestAnimationFrame(frame);
}

setInterval(() => {
  if (filled === 0) return;
  sorted.set(intervals);
  const view = sorted.subarray(0, filled).sort();
  const p = (x: number) => view[Math.min(filled - 1, Math.floor(x * filled))] ?? 0;
  stats.p50 = p(0.5);
  stats.p99 = p(0.99);
  stats.max = view[filled - 1] ?? 0;
  stats.fps = 1000 / stats.p50;
  stats.tickMs = tickAcc / Math.max(1, frames);
  gpuMs = gpuCount ? gpuAcc / gpuCount : Number.NaN;
  stats.gpuMs = gpuMs;
  stats.instances = lastInstances;
  stats.presented = presented;
  stats.frames = frames;
  tickAcc = 0;
  frames = 0;
  gpuAcc = 0;
  gpuCount = 0;
  overlay.textContent =
    `nt ${W}x${H} ${format} | ${stats.fps.toFixed(1)} fps | frame p50 ${stats.p50.toFixed(2)} ms p99 ${stats.p99.toFixed(2)} ms | ` +
    `GPU ${Number.isNaN(gpuMs) ? "n/a" : `${gpuMs.toFixed(3)} ms`} | tick ${stats.tickMs.toFixed(3)} ms | ${lastInstances} instances | ` +
    `${adapter.info.vendor} ${adapter.info.architecture}`;
}, 500);

// Banc d'essai `?bench=N` : N frames 4K enchaînées sur une texture hors écran (même noyau, même
// pipeline), indépendant de la vsync et de l'occultation de fenêtre. Timestamps GPU par frame.
async function bench(frames: number) {
  const target = device.createTexture({ size: [W, H], format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const count = Math.min(frames, 2048);
  const bqs = hasTs ? device.createQuerySet({ type: "timestamp", count: count * 2 }) : null;
  const bres = hasTs ? device.createBuffer({ size: count * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : null;
  const bread = hasTs ? device.createBuffer({ size: count * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) : null;
  const att: GPURenderPassColorAttachment = {
    view: target.createView(),
    loadOp: "clear",
    storeOp: "store",
    clearValue: { r: 0, g: 0, b: 0, a: 1 },
  };
  const desc: GPURenderPassDescriptor = { colorAttachments: [att] };
  const cpu = new Float64Array(count);
  let sim = 0;
  await device.queue.onSubmittedWorkDone();
  const t0 = performance.now();
  for (let f = 0; f < count; f++) {
    const c0 = performance.now();
    sim += 1000 / 120;
    const n = k.nt_tick(sim);
    device.queue.writeBuffer(instBuf, 0, k.memory.buffer, k.nt_instances(), n * STRIDE);
    const enc = device.createCommandEncoder();
    if (bqs) desc.timestampWrites = { querySet: bqs, beginningOfPassWriteIndex: f * 2, endOfPassWriteIndex: f * 2 + 1 };
    const pass = enc.beginRenderPass(desc);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4, n);
    pass.end();
    submitList[0] = enc.finish();
    device.queue.submit(submitList);
    cpu[f] = performance.now() - c0;
    if ((f & 7) === 7) await device.queue.onSubmittedWorkDone();
  }
  await device.queue.onSubmittedWorkDone();
  const wall = performance.now() - t0;
  const gpu = new Float64Array(count);
  if (bqs && bres && bread) {
    const enc = device.createCommandEncoder();
    enc.resolveQuerySet(bqs, 0, count * 2, bres, 0);
    enc.copyBufferToBuffer(bres, 0, bread, 0, count * 16);
    device.queue.submit([enc.finish()]);
    await bread.mapAsync(GPUMapMode.READ);
    const t = new BigUint64Array(bread.getMappedRange());
    for (let f = 0; f < count; f++) gpu[f] = Number((t[f * 2 + 1] ?? 0n) - (t[f * 2] ?? 0n)) / 1e6;
    bread.unmap();
  }
  const pct = (a: Float64Array, p: number) => {
    const s = a.slice().sort();
    return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  };
  target.destroy();
  return {
    frames: count,
    res: `${W}x${H}`,
    instances: k.nt_tick(sim + 1000 / 120),
    wallFps: (count * 1000) / wall,
    wallMsPerFrame: wall / count,
    cpuMsP50: pct(cpu, 0.5),
    cpuMsP99: pct(cpu, 0.99),
    gpuMsP50: hasTs ? pct(gpu, 0.5) : null,
    gpuMsP99: hasTs ? pct(gpu, 0.99) : null,
    gpuMsMax: hasTs ? pct(gpu, 1) : null,
    budget120HzMs: 1000 / 120,
  };
}

if (q.has("bench")) {
  const r = await bench(Number(q.get("bench") || 600));
  (globalThis as Record<string, unknown>).__ntBench = r;
  console.log("[nt-bench]", JSON.stringify(r));
}

requestAnimationFrame(frame);
