// nt — modèle 3D du noyau Windows NT en direct, rendu GPU pur (WebGPU, 3840 x 2160, MSAA 4x) : aucun texte DOM.
// Couches : %SystemRoot% réel (index NTFS, treemap) · matériel (KPRCB, mémoire physique, volume NTFS/MFT) ·
// noyau et exécutif (ntoskrnl, 75 types d'objets, pool par tag, pilotes chargés) · processus et threads réels,
// icônes extraites des PE réels, chemins réels. Textes : atlas de glyphes ; icônes : atlas RGBA ; tout est GPU.
import { FRAME, MAGIC, type Slow, THREAD_STATE, WAIT_REASON } from "./ntsys-format.ts";
import shaderSrc from "./scene.wgsl" with { type: "text" };

const W = 3840;
const H = 2160;
const SAMPLES = 4;
const canvas = document.querySelector("canvas") as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
if (!adapter) throw new Error("WebGPU indisponible");
const device = await adapter.requestDevice();
const format = navigator.gpu.getPreferredCanvasFormat();
const ctx = canvas.getContext("webgpu") as GPUCanvasContext;
ctx.configure({ device, format, alphaMode: "opaque" });

// --- Atlas : glyphes (haut) + icônes 64 px (dessous) + pavé blanc pour les aplats ---------------------------------------
const ATLAS = 4096;
const atlas = device.createTexture({
  size: [ATLAS, ATLAS],
  format: "rgba8unorm",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
});
const GW = 32;
const GH = 48;
const CHARS = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  ..."àâäçéèêëîïôöùûüÿœæÀÂÇÉÈÊÎÔÙÛ·×—–…→←↑↓«»’°%µ±≤≥█▲▼●○■□",
];
const glyph = new Map<string, number>();
{
  const off = new OffscreenCanvas(ATLAS, 256);
  const g = off.getContext("2d") as OffscreenCanvasRenderingContext2D;
  g.font = "38px 'Cascadia Code', 'Cascadia Mono', Consolas, monospace";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  CHARS.forEach((ch, i) => {
    glyph.set(ch, i);
    g.fillText(ch, (i % 128) * GW + 2, Math.floor(i / 128) * GH + GH / 2);
  });
  g.fillRect(ATLAS - 8, 248, 8, 8); // aplat blanc
  device.queue.copyExternalImageToTexture({ source: off }, { texture: atlas }, [ATLAS, 256]);
}
const SOLID: [number, number, number, number] = [(ATLAS - 6) / ATLAS, 250 / ATLAS, (ATLAS - 2) / ATLAS, 254 / ATLAS];
const ICON = 64;
const ICON_COLS = ATLAS / ICON;
const icons = new Map<string, number>(); // chemin -> case (>= 0 prête, -1 en cours, -2 absente)
let iconNext = 0;
let iconsDirty = false;
function iconSlot(path: string): number {
  if (!path) return -2;
  const s = icons.get(path);
  if (s !== undefined) return s;
  icons.set(path, -1);
  fetch(`/api/icon?path=${encodeURIComponent(path)}`)
    .then(async (r) => {
      if (!r.ok) throw new Error();
      const bmp = await createImageBitmap(await r.blob(), { resizeWidth: 56, resizeHeight: 56, resizeQuality: "high" });
      const slot = iconNext++;
      device.queue.copyExternalImageToTexture(
        { source: bmp },
        { texture: atlas, origin: [(slot % ICON_COLS) * ICON + 4, 256 + Math.floor(slot / ICON_COLS) * ICON + 4] },
        [56, 56],
      );
      icons.set(path, slot);
      iconsDirty = true;
    })
    .catch(() => icons.set(path, -2));
  return -1;
}
const iconUv = (slot: number): [number, number, number, number] => {
  const x = (slot % ICON_COLS) * ICON + 4;
  const y = 256 + Math.floor(slot / ICON_COLS) * ICON + 4;
  return [x / ATLAS, y / ATLAS, (x + 56) / ATLAS, (y + 56) / ATLAS];
};

// --- Pipelines -----------------------------------------------------------------------------------------------------------
const module = device.createShaderModule({ code: shaderSrc });
const blend: GPUBlendComponent = { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" };
const multisample = { count: SAMPLES };
const boxPipe = device.createRenderPipeline({
  layout: "auto",
  vertex: { module, entryPoint: "vs_box" },
  fragment: { module, entryPoint: "fs_box", targets: [{ format }] },
  primitive: { topology: "triangle-list", cullMode: "none" },
  depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
  multisample,
});
const spriteDesc = (depthCompare: GPUCompareFunction): GPURenderPipelineDescriptor => ({
  layout: "auto",
  vertex: { module, entryPoint: "vs_sprite" },
  fragment: { module, entryPoint: "fs_sprite", targets: [{ format, blend: { color: blend, alpha: blend } }] },
  primitive: { topology: "triangle-list" },
  depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare },
  multisample,
});
const worldSpritePipe = device.createRenderPipeline(spriteDesc("less-equal"));
const screenSpritePipe = device.createRenderPipeline(spriteDesc("always"));
const camBuf = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const MAX_BOX = 32768;
const MAX_SPRITE = 32768;
const boxBuf = device.createBuffer({ size: MAX_BOX * 48, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const spriteBuf = device.createBuffer({ size: MAX_SPRITE * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" });
const boxGroup = device.createBindGroup({
  layout: boxPipe.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: camBuf } },
    { binding: 1, resource: { buffer: boxBuf } },
  ],
});
const spriteGroup = (pipe: GPURenderPipeline) =>
  device.createBindGroup({
    layout: pipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: camBuf } },
      { binding: 2, resource: { buffer: spriteBuf } },
      { binding: 3, resource: atlas.createView() },
      { binding: 4, resource: sampler },
    ],
  });
const worldSpriteGroup = spriteGroup(worldSpritePipe);
const screenSpriteGroup = spriteGroup(screenSpritePipe);
const msaa = device.createTexture({ size: [W, H], format, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
const depth = device.createTexture({ size: [W, H], format: "depth24plus", sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
const colorAtt: GPURenderPassColorAttachment = {
  view: msaa.createView(),
  resolveTarget: undefined,
  loadOp: "clear",
  storeOp: "discard",
  clearValue: { r: 0.02, g: 0.027, b: 0.043, a: 1 },
};
const passDesc: GPURenderPassDescriptor = {
  colorAttachments: [colorAtt],
  depthStencilAttachment: { view: depth.createView(), depthLoadOp: "clear", depthClearValue: 1, depthStoreOp: "discard" },
};

// --- Tampons CPU (aucune allocation par frame) ------------------------------------------------------------------------------
type RGB = [number, number, number];
const BOX = new Float32Array(MAX_BOX * 12);
const SPR = new Float32Array(MAX_SPRITE * 16);
let nBox = 0;
let nStaticBox = 0;
let nWorldSpr = 0;
let nScreenSpr = 0;
const boxRef: { kind: string; ref: number }[] = [];
function box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: RGB, kind: string, ref: number, a = 1) {
  if (nBox >= MAX_BOX) return;
  const o = nBox * 12;
  BOX[o] = x;
  BOX[o + 1] = y;
  BOX[o + 2] = z;
  BOX[o + 4] = sx;
  BOX[o + 5] = Math.max(0.01, sy);
  BOX[o + 6] = sz;
  BOX[o + 8] = c[0];
  BOX[o + 9] = c[1];
  BOX[o + 10] = c[2];
  BOX[o + 11] = a;
  boxRef[nBox] = { kind, ref };
  nBox++;
}
/** Sprite : monde (screen = false, ancre xyz) ou écran (pixels). Les sprites monde sont rangés en tête du tampon. */
function sprite(
  screen: boolean,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
  uv: readonly number[],
  c: RGB,
  a = 1,
) {
  const i = screen ? MAX_SPRITE / 2 + nScreenSpr : nWorldSpr;
  if (screen ? nScreenSpr >= MAX_SPRITE / 2 : nWorldSpr >= MAX_SPRITE / 2) return;
  const o = i * 16;
  SPR[o] = x;
  SPR[o + 1] = y;
  SPR[o + 2] = z;
  SPR[o + 3] = screen ? 1 : 0;
  SPR[o + 4] = w;
  SPR[o + 5] = h;
  SPR[o + 6] = ox;
  SPR[o + 7] = oy;
  SPR[o + 8] = uv[0]!;
  SPR[o + 9] = uv[1]!;
  SPR[o + 10] = uv[2]!;
  SPR[o + 11] = uv[3]!;
  SPR[o + 12] = c[0];
  SPR[o + 13] = c[1];
  SPR[o + 14] = c[2];
  SPR[o + 15] = a;
  if (screen) nScreenSpr++;
  else nWorldSpr++;
}
const glyphUv = (i: number): [number, number, number, number] => {
  const x = (i % 128) * GW;
  const y = Math.floor(i / 128) * GH;
  return [x / ATLAS, y / ATLAS, (x + GW) / ATLAS, (y + GH) / ATLAS];
};
/** Texte GPU : ancre (monde ou écran), taille de glyphe en px, centrage horizontal optionnel. */
function text(s: string, screen: boolean, x: number, y: number, z: number, px: number, c: RGB, center = false, a = 1) {
  // Atlas rastérisé à 38 px (chasse 0,6 em) dans des cases de 32 x 48 : mise à l'échelle k.
  const k = px / 38;
  const adv = 22.8 * k;
  let ox = center ? (-s.length * adv) / 2 : 0;
  for (const ch of s) {
    const gi = glyph.get(ch) ?? glyph.get("?")!;
    if (ch !== " ") sprite(screen, x, y, z, GW * k, GH * k, ox - 2 * k, -GH * k * 0.8, glyphUv(gi), c, a);
    ox += adv;
  }
  return s.length * adv;
}
const panel = (x: number, y: number, w: number, h: number, c: RGB, a = 0.85) => sprite(true, x, y, 0, w, h, 0, 0, SOLID, c, a);

// --- Couleurs ------------------------------------------------------------------------------------------------------------
const hex = (h: string): RGB => [
  Number.parseInt(h.slice(1, 3), 16) / 255,
  Number.parseInt(h.slice(3, 5), 16) / 255,
  Number.parseInt(h.slice(5, 7), 16) / 255,
];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const C = {
  text: hex("#dfe7f2"),
  dim: hex("#8a9ab5"),
  title: hex("#ffd166"),
  bg: hex("#0b1220"),
  user: hex("#4895ef"),
  kernel: hex("#f4a261"),
  dpc: hex("#9d4edd"),
  isr: hex("#e63946"),
  idle: hex("#1a2333"),
  plate: hex("#0c121c"),
  tile: hex("#1a2740"),
  hot: hex("#ff6b35"),
  used: hex("#2f6db5"),
  free: hex("#121a28"),
  paged: hex("#2a9d8f"),
  core: hex("#c0392b"),
  white: hex("#ffffff"),
  fs: hex("#26405f"),
  fs2: hex("#5c86c0"),
  mft: hex("#e9c46a"),
};
const STATE: RGB[] = ["#f1f5f9", "#ffd166", "#3ddc84", "#4cc9f0", "#e63946", "#3a4660", "#b5179e", "#f8961e", "#8d99ae", "#6c757d"].map(
  hex,
);
const WAIT_FAMILY: [string, RGB, number[]][] = [
  ["requête utilisateur", hex("#3b5480"), [6, 13]],
  ["WrQueue", hex("#23707f"), [15]],
  ["délai", hex("#5b4a91"), [4, 11]],
  ["exécutif", hex("#7a6040"), [0, 7]],
  ["ALPC", hex("#3a76ad"), [16, 17]],
  ["alerte", hex("#44587a"), [37]],
  ["suspendu", hex("#9a3a4a"), [5, 12]],
  ["mémoire", hex("#8a7440"), [1, 2, 8, 9, 18, 19, 39]],
  ["verrous", hex("#8a3a76"), [27, 28, 29, 34, 35]],
];
const WAIT: RGB[] = WAIT_REASON.map(() => STATE[5]!);
for (const [, c, rs] of WAIT_FAMILY) for (const r of rs) WAIT[r] = c;
const MODULE_FAMILY: [string, RGB, RegExp][] = [
  ["noyau / HAL", hex("#c0392b"), /^(ntoskrnl|hal|kd|ci|cng|clfs|tm|pshed|bootvid|werkernel|skci|msrpc|ksecdd|ksecpkg)\./i],
  [
    "fichiers",
    hex("#2f6db5"),
    /^(ntfs|refs|fastfat|exfat|udfs|cdfs|fltmgr|wof|cldflt|bindflt|wcifs|npfs|msfs|fileinfo|luafv|storqosflt|bfs|dfsc|mup|rdbss|csc|afunix)/i,
  ],
  [
    "réseau",
    hex("#2e8b57"),
    /^(tcpip|ndis|netio|afd|http|nwifi|wfplwfs|netbt|mrxsmb|srv|tdx|vwifi|pacer|ndu|nsiproxy|wanarp|ras|bowser|fwpkclnt|vmswitch|winnat)/i,
  ],
  [
    "stockage",
    hex("#b8860b"),
    /^(storport|stornvme|storahci|disk|partmgr|volmgr|volsnap|volume|iastor|classpnp|spaceport|ehstor|fvevol|rdyboost|mountmgr|acpiex|pci|acpi)/i,
  ],
  ["graphique", hex("#a33ea1"), /^(dxgkrnl|dxgmms|nvlddmkm|watchdog|basicdisplay|basicrender|monitor|cdd|win32k|nvvad|nvhda)/i],
  ["USB / HID / audio", hex("#1b9aaa"), /^(usb|hid|kbd|mou|i8042|ks|portcls|hdaudio|audio|bth|ucx|wudf)/i],
  [
    "sécurité / hyperviseur",
    hex("#e07a1f"),
    /^(wdfilter|wdnisdrv|wd|peauth|tpm|mssecflt|mpsdrv|bam|appid|vmgid|hvsocket|vid|hvservice|winhv)/i,
  ],
];
const moduleColor = (n: string): RGB => MODULE_FAMILY.find(([, , re]) => re.test(n))?.[1] ?? hex("#56617a");
const fmt = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}G` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0);
const bytes = (v: number) =>
  v >= 2 ** 40
    ? `${(v / 2 ** 40).toFixed(2)} Tio`
    : v >= 2 ** 30
      ? `${(v / 2 ** 30).toFixed(1)} Gio`
      : v >= 2 ** 20
        ? `${(v / 2 ** 20).toFixed(0)} Mio`
        : `${(v / 1024).toFixed(0)} Kio`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// --- Caméra orbitale ----------------------------------------------------------------------------------------------------
const cam = { yaw: -Math.PI / 4, pitch: 0.62, dist: 150, tx: 0, ty: 12, tz: 0, fov: 0.85 };
const camData = new Float32Array(32);
const eye = [0, 0, 0];
const fwd = [0, 0, 0];
const right = [0, 0, 0];
const up = [0, 0, 0];
function updateCamera() {
  const cp = Math.cos(cam.pitch);
  eye[0] = cam.tx + cam.dist * cp * Math.cos(cam.yaw);
  eye[1] = cam.ty + cam.dist * Math.sin(cam.pitch);
  eye[2] = cam.tz + cam.dist * cp * Math.sin(cam.yaw);
  const fx = cam.tx - eye[0]!;
  const fy = cam.ty - eye[1]!;
  const fz = cam.tz - eye[2]!;
  const fl = Math.hypot(fx, fy, fz);
  fwd[0] = fx / fl;
  fwd[1] = fy / fl;
  fwd[2] = fz / fl;
  // right = fwd x worldUp ; up = right x fwd
  const rx = -fwd[2]!;
  const rz = fwd[0]!;
  const rl = Math.hypot(rx, rz) || 1;
  right[0] = rx / rl;
  right[1] = 0;
  right[2] = rz / rl;
  up[0] = right[1]! * fwd[2]! - right[2]! * fwd[1]!;
  up[1] = right[2]! * fwd[0]! - right[0]! * fwd[2]!;
  up[2] = right[0]! * fwd[1]! - right[1]! * fwd[0]!;
  const f = 1 / Math.tan(cam.fov / 2);
  const aspect = W / H;
  const near = 0.5;
  const far = 3000;
  // Vue (colonnes) puis projection perspective WebGPU (profondeur 0..1).
  const v = [right[0]!, up[0]!, -fwd[0]!, 0, right[1]!, up[1]!, -fwd[1]!, 0, right[2]!, up[2]!, -fwd[2]!, 0, 0, 0, 0, 1];
  v[12] = -(right[0]! * eye[0]! + right[1]! * eye[1]! + right[2]! * eye[2]!);
  v[13] = -(up[0]! * eye[0]! + up[1]! * eye[1]! + up[2]! * eye[2]!);
  v[14] = fwd[0]! * eye[0]! + fwd[1]! * eye[1]! + fwd[2]! * eye[2]!;
  const p = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, (near * far) / (near - far), 0];
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += p[k * 4 + r]! * v[c * 4 + k]!;
      camData[c * 4 + r] = s;
    }
  camData.set([eye[0]!, eye[1]!, eye[2]!, 0, right[0]!, right[1]!, right[2]!, 0, up[0]!, up[1]!, up[2]!, 0, W, H, 1 / W, 1 / H], 16);
  device.queue.writeBuffer(camBuf, 0, camData);
}
let drag: { x: number; y: number; pan: boolean } | null = null;
let auto = true;
const scale = () => W / canvas.clientWidth;
canvas.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey };
  auto = false;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => {
  drag = null;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
let mouse = { x: -1, y: -1 };
canvas.addEventListener("pointermove", (e) => {
  mouse = { x: e.clientX * scale(), y: e.clientY * scale() };
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (drag.pan) {
    const k = cam.dist * 0.0016;
    cam.tx -= (right[0]! * dx - up[0]! * dy) * k;
    cam.ty += up[1]! * dy * k;
    cam.tz -= (right[2]! * dx - up[2]! * dy) * k;
  } else {
    cam.yaw += dx * 0.005;
    cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + dy * 0.004));
  }
});
canvas.addEventListener(
  "wheel",
  (e) => {
    cam.dist = Math.max(8, Math.min(900, cam.dist * Math.exp(e.deltaY * 0.0012)));
    auto = false;
    e.preventDefault();
  },
  { passive: false },
);

// --- Modèle reçu ----------------------------------------------------------------------------------------------------------
let names: string[] = [];
const paths = new Map<number, string>();
let slow: (Slow & { ntfs?: Ntfs | null }) | null = null;
type Ntfs = {
  volume: string;
  totalBytes: number;
  freeBytes: number;
  mftBytes: number;
  mftRecords: number;
  bytesPerCluster: number;
  bytesPerFileRecord: number;
  version: string;
};
let ncpu = 0;
let nproc = 0;
let nthread = 0;
let U = new Uint32Array(0);
let F = new Float32Array(0);
let cpuBase = 0;
let procBase = 0;
let threadBase = 0;
let hz = 15;
const g0 = FRAME.header;
const sched = new Uint32Array(10);
const cpuCur = new Float32Array(1024);
const cpuTgt = new Float32Array(1024);
type Box = { x: number; y: number; w: number; h: number };
type Dir = { id: number; name: string; files: number; bytes: number; exe?: string; children: Dir[] };
let tree: Dir | null = null;
let indexStats: { files: number; dirs: number; bytes: number; root: string } | null = null;
const Y = { fs: -18, hw: 0, ex: 16, pr: 32 };
let dirty = true;

function squarify(vals: number[], b: Box, out: Box[]) {
  let { x, y, w, h } = b;
  const total = vals.reduce((a, v) => a + v, 0) || 1;
  const sc = (w * h) / total;
  const worst = (sum: number, mn: number, mx: number, side: number) =>
    Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn));
  let i = 0;
  while (i < vals.length) {
    const side = Math.min(w, h);
    let sum = vals[i]! * sc;
    let mn = sum;
    let mx = sum;
    let j = i + 1;
    while (j < vals.length) {
      const a = vals[j]! * sc;
      if (worst(sum + a, Math.min(mn, a), Math.max(mx, a), side) > worst(sum, mn, mx, side)) break;
      sum += a;
      mn = Math.min(mn, a);
      mx = Math.max(mx, a);
      j++;
    }
    const thick = sum / side;
    let off = 0;
    for (let k = i; k < j; k++) {
      const len = (vals[k]! * sc) / thick;
      out[k] = w >= h ? { x, y: y + off, w: thick, h: len } : { x: x + off, y, w: len, h: thick };
      off += len;
    }
    if (w >= h) {
      x += thick;
      w -= thick;
    } else {
      y += thick;
      h -= thick;
    }
    i = j;
  }
}

// --- Construction de la scène (à chaque échantillon) ------------------------------------------------------------------------
const procGroups: { name: string; path: string; box: Box; total: number; count: number }[] = [];
function buildStatic() {
  nBox = 0;
  nWorldSpr = 0;
  // Plaques des couches.
  box(0, Y.fs - 0.5, 0, 74, 0.3, 74, C.plate, "plate", 0);
  box(0, Y.hw - 1.6, 0, 74, 0.3, 74, C.plate, "plate", 1);
  box(0, Y.ex - 0.5, 0, 80, 0.3, 80, C.plate, "plate", 2);
  box(0, Y.pr - 0.5, 0, 74, 0.3, 74, C.plate, "plate", 3);
  const layer = (s: string, y: number) => text(s, false, -37, y, -37, 30, C.title);
  layer("C:\\Windows — index NTFS réel", Y.fs + 1);
  layer("matériel — KPRCB · mémoire physique · volume NTFS", Y.hw + 1);
  layer("noyau & exécutif — ntoskrnl · Ob · Mm · Io", Y.ex + 1);
  layer("processus (EPROCESS) · threads (ETHREAD)", Y.pr + 1);

  // %SystemRoot% : dossiers niveau 1 (socles) et 2 (tours), icône de l'exécutable principal.
  if (tree) {
    const lv1 = tree.children.filter((d) => d.bytes > 0);
    const b1: Box[] = [];
    squarify(
      lv1.map((d) => d.bytes),
      { x: -35, y: -35, w: 70, h: 70 },
      b1,
    );
    lv1.forEach((d, i) => {
      const b = b1[i]!;
      box(b.x + b.w / 2, Y.fs, b.y + b.h / 2, b.w - 0.25, 0.45, b.h - 0.25, C.fs, "fs1", i);
      const kids = d.children.filter((c) => c.bytes > 0);
      const b2: Box[] = [];
      squarify(
        kids.map((c) => c.bytes),
        { x: b.x + 0.3, y: b.y + 0.3, w: b.w - 0.6, h: b.h - 0.6 },
        b2,
      );
      kids.forEach((c, k) => {
        const r = b2[k]!;
        box(
          r.x + r.w / 2,
          Y.fs + 0.45,
          r.y + r.h / 2,
          r.w - 0.15,
          Math.log10(1 + c.bytes / 1024) * 1.5,
          r.h - 0.15,
          mix(C.fs, C.fs2, Math.min(1, Math.log10(1 + c.files) / 4)),
          "fs2",
          i * 1000 + k,
        );
      });
      if (i < 14) {
        const slot = d.exe ? iconSlot(d.exe) : -2;
        const yy = Y.fs + 8;
        if (slot >= 0) sprite(false, b.x + b.w / 2, yy, b.y + b.h / 2, 56, 56, -28, -80, iconUv(slot), C.white);
        text(`${d.name}  ${bytes(d.bytes)}`, false, b.x + b.w / 2, yy, b.y + b.h / 2, 22, C.text, true);
      }
    });
  }

  if (!ncpu) return;
  // Mémoire physique : 48 x 48 cellules (utilisée / disponible).
  if (slow) {
    const phys = slow.basic.physicalMB;
    const used = (phys - F[g0 + 11]!) / phys;
    const N = 48;
    for (let i = 0; i < N * N; i++)
      box(
        ((i % N) - N / 2 + 0.5) * 1.2,
        Y.hw - 1.3,
        (Math.floor(i / N) - N / 2 + 0.5) * 1.2,
        1.05,
        0.25,
        1.05,
        i / (N * N) < used ? C.used : C.free,
        "mem",
        i,
      );
    // Volume NTFS : disque (anneau extérieur) + MFT (tour) à côté de la mémoire.
    const n = slow.ntfs;
    if (n) {
      const usedV = 1 - n.freeBytes / n.totalBytes;
      const segs = 96;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        box(
          Math.cos(a) * 36,
          Y.hw - 1.5,
          Math.sin(a) * 36,
          2.2,
          0.6 + (i / segs < usedV ? 1.2 : 0),
          2.2,
          i / segs < usedV ? hex("#3d5a80") : C.free,
          "ntfs",
          i,
        );
      }
      box(-36, Y.hw - 1.5, 36, 3, (n.mftBytes / 2 ** 30) * 1.2, 3, C.mft, "mft", 0);
      text(
        `$MFT ${bytes(n.mftBytes)} · ${fmt(n.mftRecords)} enregistrements`,
        false,
        -36,
        Y.hw + (n.mftBytes / 2 ** 30) * 1.2,
        36,
        22,
        C.mft,
        true,
      );
      text(
        `NTFS ${n.version} ${n.volume} ${bytes(n.totalBytes - n.freeBytes)} / ${bytes(n.totalBytes)}`,
        false,
        36,
        Y.hw + 3,
        -36,
        22,
        C.text,
        true,
      );
    }
    // Exécutif : ntoskrnl, types d'objets, pool, pilotes.
    const nt = slow.modules.find((m) => /^ntoskrnl/i.test(m.name));
    box(0, Y.ex, 0, 7, 4 + Math.log2(1 + (nt?.size ?? 1) / 1048576) * 2, 7, C.core, "core", 0);
    text(`${nt?.path ?? "ntoskrnl.exe"}  ${bytes(nt?.size ?? 0)}`, false, 0, Y.ex + 13, 0, 24, hex("#ff9f8a"), true);
    const arc = (a0: number, a1: number, i: number, n: number, r: number) => {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
      return [Math.cos(a) * r, Math.sin(a) * r] as const;
    };
    slow.objectTypes.forEach((t, i) => {
      const [x, z] = arc(0, (Math.PI * 2) / 3, i, slow!.objectTypes.length, 30);
      const h = 0.3 + Math.log10(1 + t.objects) * 2.6;
      box(x, Y.ex, z, 1.4, h, 1.4, mix(hex("#2f6db5"), hex("#4cc9f0"), Math.min(1, t.handles / Math.max(1, t.objects))), "type", i);
      if (i < 10) text(`${t.name} ${fmt(t.objects)}`, false, x, Y.ex + h + 1, z, 20, hex("#9fd3ff"), true);
    });
    const pmax = Math.max(1e-6, ...slow.pool.map((p) => p.pagedMB + p.nonPagedMB));
    slow.pool.forEach((p, i) => {
      const [x, z] = arc((Math.PI * 2) / 3, (Math.PI * 4) / 3, i, slow!.pool.length, 30);
      const hp = (p.pagedMB / pmax) * 15;
      const hn = (p.nonPagedMB / pmax) * 15;
      box(x, Y.ex, z, 1.6, hp, 1.6, C.paged, "pool", i);
      box(x, Y.ex + hp, z, 1.6, hn, 1.6, C.isr, "pool", i);
      if (i < 8) text(`${p.tag} ${bytes((p.pagedMB + p.nonPagedMB) * 2 ** 20)}`, false, x, Y.ex + hp + hn + 1, z, 20, hex("#9fe8d8"), true);
    });
    const mods = [...slow.modules].sort((a, b) => a.order - b.order);
    const per = Math.ceil(mods.length / 4);
    mods.forEach((m, i) => {
      const row = Math.floor(i / per);
      const [x, z] = arc((Math.PI * 4) / 3, Math.PI * 2, i % per, per, 25 + row * 3.4);
      const s = 0.5 + Math.log2(1 + m.size / 65536) * 0.5;
      box(x, Y.ex, z, s, s * 1.4, s, moduleColor(m.name), "drv", i);
      if (m.size > 3 * 2 ** 20) text(m.name, false, x, Y.ex + s * 1.4 + 0.6, z, 18, C.text, true);
    });
  }

  // Processus groupés par image ; threads posés sur chaque tuile ; icône réelle du binaire.
  const byName = new Map<string, number[]>();
  for (let i = 0; i < nproc; i++) {
    const o = procBase + i * FRAME.proc;
    if (U[o] === 0) continue;
    const n = names[U[o + 10]!] ?? "?";
    let l = byName.get(n);
    if (!l) {
      l = [];
      byName.set(n, l);
    }
    l.push(i);
  }
  const ws = (i: number) => Math.max(1, F[procBase + i * FRAME.proc + 5]!);
  const groups = [...byName]
    .map(([name, idx]) => ({ name, idx, total: idx.reduce((s, i) => s + ws(i), 0) }))
    .sort((a, b) => b.total - a.total);
  const gb: Box[] = [];
  squarify(
    groups.map((g) => g.total),
    { x: -35, y: -35, w: 70, h: 70 },
    gb,
  );
  procGroups.length = 0;
  groups.forEach((g, gi) => {
    const b = gb[gi]!;
    const pb: Box[] = [];
    squarify(g.idx.map(ws), { x: b.x + 0.2, y: b.y + 0.2, w: b.w - 0.4, h: b.h - 0.4 }, pb);
    let path = "";
    g.idx.forEach((pi, k) => {
      const r = pb[k]!;
      const o = procBase + pi * FRAME.proc;
      path ||= paths.get(U[o]!) ?? "";
      const heat = Math.min(1, F[o + 7]! * ncpu);
      const ph = 0.3 + heat * 5;
      box(
        r.x + r.w / 2,
        Y.pr,
        r.y + r.h / 2,
        Math.max(0.05, r.w - 0.14),
        ph,
        Math.max(0.05, r.h - 0.14),
        mix(C.tile, C.hot, heat),
        "proc",
        pi,
      );
      const nth = U[o + 2]!;
      const first = U[o + 4]!;
      const s = Math.max(0.1, Math.min(1.2, Math.sqrt((r.w * r.h * 0.8) / Math.max(1, nth))));
      const cols = Math.max(1, Math.floor((r.w - 0.1) / s));
      const rows = Math.max(1, Math.floor((r.h - 0.1) / s));
      for (let t = 0; t < nth; t++) {
        const ti = threadBase + (first + t) * FRAME.thread;
        const p = U[ti + 1]!;
        const st = p & 0xff;
        const cpu = F[ti + 2]!;
        const layerIdx = Math.floor(t / (cols * rows));
        const cell = t % (cols * rows);
        const base = st === 5 ? WAIT[(p >>> 8) & 0xff]! : STATE[st]!;
        box(
          r.x + 0.05 + ((cell % cols) + 0.5) * s,
          Y.pr + ph + layerIdx * s * 0.8,
          r.y + 0.05 + (Math.floor(cell / cols) + 0.5) * s,
          s * 0.8,
          s * (st === 2 ? 3 : 0.7) + cpu * 6,
          s * 0.8,
          cpu > 0.002 ? mix(base, C.white, Math.min(0.6, cpu)) : base,
          "thr",
          first + t,
        );
      }
    });
    procGroups.push({ name: g.name, path, box: b, total: g.total, count: g.idx.length });
    if (gi < 18) {
      const slot = iconSlot(path);
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      if (slot >= 0) sprite(false, cx, Y.pr + 7, cz, 56, 56, -28, -84, iconUv(slot), C.white);
      text(
        `${g.name}${g.idx.length > 1 ? ` ×${g.idx.length}` : ""}  ${bytes(g.total * 2 ** 20)}`,
        false,
        cx,
        Y.pr + 7,
        cz,
        22,
        C.text,
        true,
      );
    }
  });
  nStaticBox = nBox;
  device.queue.writeBuffer(boxBuf, 0, BOX, 0, nBox * 12);
  device.queue.writeBuffer(spriteBuf, 0, SPR, 0, nWorldSpr * 16);
}

// --- Par frame : processeurs interpolés, HUD et survol en sprites écran --------------------------------------------------------
function cpuBoxes() {
  nBox = nStaticBox;
  const R = 30;
  for (let c = 0; c < ncpu; c++) {
    const a = (c / ncpu) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    let y = Y.hw;
    const segs = [C.user, C.kernel, C.dpc, C.isr];
    for (let k = 0; k < 4; k++) {
      const i = c * 5 + k;
      cpuCur[i]! += (cpuTgt[i]! - cpuCur[i]!) * 0.15;
      const h = cpuCur[i]! * 13;
      if (h > 0.01) box(x, y, z, 2.3, h, 2.3, segs[k]!, "cpu", c);
      y += h;
    }
    box(x, y, z, 2.3, Math.max(0.05, Y.hw + 13 - y), 2.3, C.idle, "cpu", c);
  }
  device.queue.writeBuffer(boxBuf, nStaticBox * 48, BOX, nStaticBox * 12, (nBox - nStaticBox) * 12);
}

function hit(): { kind: string; ref: number } | null {
  if (mouse.x < 0) return null;
  const f = 1 / Math.tan(cam.fov / 2);
  const nx = ((mouse.x / W) * 2 - 1) * (W / H);
  const ny = 1 - (mouse.y / H) * 2;
  const d = [
    fwd[0]! * f + right[0]! * nx + up[0]! * ny,
    fwd[1]! * f + right[1]! * nx + up[1]! * ny,
    fwd[2]! * f + right[2]! * nx + up[2]! * ny,
  ];
  let best = Number.POSITIVE_INFINITY;
  let found: { kind: string; ref: number } | null = null;
  for (let i = 0; i < nBox; i++) {
    const r = boxRef[i]!;
    if (r.kind === "plate") continue;
    const o = i * 12;
    const mn = [BOX[o]! - BOX[o + 4]! / 2, BOX[o + 1]!, BOX[o + 2]! - BOX[o + 6]! / 2];
    const mx = [BOX[o]! + BOX[o + 4]! / 2, BOX[o + 1]! + BOX[o + 5]!, BOX[o + 2]! + BOX[o + 6]! / 2];
    let t0 = 0;
    let t1 = best;
    let ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const inv = 1 / d[k]!;
      let ta = (mn[k]! - eye[k]!) * inv;
      let tb = (mx[k]! - eye[k]!) * inv;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      ok = t0 <= t1;
    }
    if (ok && t0 < best) {
      best = t0;
      found = r;
    }
  }
  return found;
}

function describe(h: { kind: string; ref: number }): string[] {
  const r = h.ref;
  switch (h.kind) {
    case "cpu": {
      const o = cpuBase + r * FRAME.cpu;
      return [
        `processeur logique ${r} (KPRCB)`,
        `user ${pct(F[o]!)} · noyau ${pct(F[o + 1]!)} · DPC ${pct(F[o + 2]!)} · ISR ${pct(F[o + 3]!)} · idle ${pct(F[o + 4]!)}`,
        `interruptions ${fmt(F[o + 5]!)}/s · DPC ${fmt(F[o + 6]!)}/s · commutations ${fmt(F[o + 7]!)}/s`,
      ];
    }
    case "proc": {
      const o = procBase + r * FRAME.proc;
      return [
        `${names[U[o + 10]!]}  pid ${U[o]}  ppid ${U[o + 1]}  session ${U[o + 11]}`,
        paths.get(U[o]!) || "(chemin protégé)",
        `threads ${U[o + 2]} · handles ${U[o + 3]} · working set ${bytes(F[o + 5]! * 2 ** 20)} · privé ${bytes(F[o + 6]! * 2 ** 20)}`,
        `CPU ${(F[o + 7]! * ncpu * 100).toFixed(1)}% d'un cœur · E/S ${fmt(F[o + 8]!)}o/s · défauts ${fmt(F[o + 9]!)}/s`,
      ];
    }
    case "thr": {
      const ti = threadBase + r * FRAME.thread;
      const p = U[ti + 1]!;
      const st = p & 0xff;
      let owner = "";
      for (let i = 0; i < nproc; i++) {
        const o = procBase + i * FRAME.proc;
        if (r >= U[o + 4]! && r < U[o + 4]! + U[o + 2]!) owner = `${names[U[o + 10]!]} (${U[o]})`;
      }
      return [
        `thread ${U[ti]} — ${owner}`,
        `${THREAD_STATE[st]}${st === 5 ? ` · ${WAIT_REASON[(p >>> 8) & 0xff]}` : ""}`,
        `priorité ${(p >>> 16) & 0xff} (base ${(p >>> 24) & 0xff}) · CPU ${pct(F[ti + 2]!)} · commutations ${fmt(F[ti + 3]!)}/s`,
      ];
    }
    case "type": {
      const t = slow!.objectTypes[r]!;
      return [
        `type d'objet ${t.name} (index ${t.index})`,
        `${t.objects.toLocaleString("fr")} objets · ${t.handles.toLocaleString("fr")} handles`,
      ];
    }
    case "pool": {
      const p = slow!.pool[r]!;
      return [
        `tag de pool « ${p.tag} »`,
        `paginé ${bytes(p.pagedMB * 2 ** 20)} · non paginé ${bytes(p.nonPagedMB * 2 ** 20)} · ${fmt(p.allocsPerSec)} alloc/s`,
      ];
    }
    case "drv": {
      const m = [...slow!.modules].sort((a, b) => a.order - b.order)[r]!;
      return [m.name, m.path, `${bytes(m.size)} · ordre de chargement ${m.order}`];
    }
    case "fs1":
    case "fs2": {
      const d1 = tree?.children.filter((d) => d.bytes > 0)[h.kind === "fs1" ? r : Math.floor(r / 1000)];
      const d = h.kind === "fs1" ? d1 : d1?.children.filter((c) => c.bytes > 0)[r % 1000];
      return d
        ? [
            `${tree!.name}\\${h.kind === "fs2" ? `${d1!.name}\\` : ""}${d.name}`,
            `${bytes(d.bytes)} · ${d.files.toLocaleString("fr")} fichiers`,
          ]
        : [];
    }
    case "mem":
      return [
        `mémoire physique ${bytes(slow!.basic.physicalMB * 2 ** 20)} · disponible ${bytes(F[g0 + 11]! * 2 ** 20)}`,
        `page ${slow!.basic.pageSize} o`,
      ];
    case "ntfs":
    case "mft": {
      const n = slow!.ntfs!;
      return [
        `volume NTFS ${n.version} ${n.volume}`,
        `utilisé ${bytes(n.totalBytes - n.freeBytes)} / ${bytes(n.totalBytes)} · cluster ${n.bytesPerCluster} o`,
        `$MFT ${bytes(n.mftBytes)} · ${n.mftRecords.toLocaleString("fr")} enregistrements de ${n.bytesPerFileRecord} o`,
      ];
    }
    case "core":
      return ["ntoskrnl.exe — noyau (Ke) et exécutif (Ob, Mm, Ps, Io, Se, Cm)"];
    default:
      return [];
  }
}

function screenLayer() {
  nScreenSpr = 0;
  if (ncpu) {
    const lines = [
      `${ncpu} CPU · ${nproc} processus · ${nthread} threads · Running ${sched[2]} · Ready ${sched[1]} · Waiting ${sched[5]}`,
      `syscalls ${fmt(F[g0 + 5]!)}/s · commutations ${fmt(F[g0 + 6]!)}/s · défauts ${fmt(F[g0 + 7]!)}/s · E/S ${fmt(F[g0 + 8]! + F[g0 + 9]!)}o/s`,
      `commit ${bytes(F[g0 + 12]! * 2 ** 20)}/${bytes(F[g0 + 13]! * 2 ** 20)} · pool ${bytes(F[g0 + 14]! * 2 ** 20)} + ${bytes(F[g0 + 15]! * 2 ** 20)}${indexStats ? ` · index ${indexStats.files.toLocaleString("fr")} fichiers ${bytes(indexStats.bytes)}` : ""}`,
      `${fps.toFixed(0)} i/s · ${W}x${H} MSAA ${SAMPLES}x`,
    ];
    panel(24, 24, 1500, 30 + lines.length * 40, C.bg, 0.78);
    lines.forEach((l, i) => text(l, true, 40, 64 + i * 40, 0, 28, i === 3 ? C.dim : C.text));
  }
  // Légende des états de threads.
  let lx = 40;
  const ly = H - 44;
  const leg: [string, RGB][] = [
    ["Running", STATE[2]!],
    ["Ready", STATE[1]!],
    ["Standby", STATE[3]!],
    ["Transition", STATE[6]!],
    ...WAIT_FAMILY.map(([n, c]) => [n, c] as [string, RGB]),
  ];
  panel(24, ly - 34, W - 48, 50, C.bg, 0.7);
  for (const [n, c] of leg) {
    sprite(true, lx, ly - 22, 0, 22, 22, 0, 0, SOLID, c);
    lx += 30 + text(n, true, lx + 30, ly, 0, 22, C.dim) + 34;
  }
  // Survol.
  const h = drag ? null : hit();
  const info = h ? describe(h) : [];
  if (info.length) {
    const w = Math.max(...info.map((s) => s.length)) * 26 * 0.6 + 32;
    const x = Math.min(W - w - 16, mouse.x + 28);
    const y = Math.min(H - info.length * 34 - 40, mouse.y + 28);
    panel(x, y, w, info.length * 34 + 22, hex("#0d1528"), 0.92);
    info.forEach((s, i) => text(s, true, x + 16, y + 40 + i * 34, 0, 26, i === 0 ? C.title : C.text));
  }
  device.queue.writeBuffer(spriteBuf, (MAX_SPRITE / 2) * 64, SPR, (MAX_SPRITE / 2) * 16, nScreenSpr * 16);
}

// --- Boucle de rendu ---------------------------------------------------------------------------------------------------------
let fps = 0;
let last = performance.now();
const RING = 512;
const intervals = new Float64Array(RING);
let ri = 0;
let filled = 0;
const submit: GPUCommandBuffer[] = [];
function frame(now: number) {
  const dt = now - last;
  last = now;
  intervals[ri] = dt;
  ri = (ri + 1) % RING;
  filled = Math.min(RING, filled + 1);
  fps = fps * 0.95 + (1000 / Math.max(0.1, dt)) * 0.05;
  if (auto) cam.yaw += dt * 0.00004;
  updateCamera();
  if (dirty || iconsDirty) {
    dirty = false;
    iconsDirty = false;
    buildStatic();
  }
  if (ncpu) cpuBoxes();
  screenLayer();
  colorAtt.resolveTarget = ctx.getCurrentTexture().createView();
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass(passDesc);
  pass.setPipeline(boxPipe);
  pass.setBindGroup(0, boxGroup);
  pass.draw(36, nBox);
  pass.setPipeline(worldSpritePipe);
  pass.setBindGroup(0, worldSpriteGroup);
  pass.draw(6, nWorldSpr);
  pass.setPipeline(screenSpritePipe);
  pass.setBindGroup(0, screenSpriteGroup);
  pass.draw(6, nScreenSpr, 0, MAX_SPRITE / 2);
  pass.end();
  submit[0] = enc.finish();
  device.queue.submit(submit);
  requestAnimationFrame(frame);
}

// Mesure (?report=1) : intervalles d'images réellement affichées, publiés vers le serveur.
if (new URLSearchParams(location.search).has("report"))
  setInterval(() => {
    const v = Array.from(intervals.subarray(0, filled)).sort((a, b) => a - b);
    const p = (x: number) => v[Math.min(v.length - 1, Math.floor(x * v.length))] ?? 0;
    navigator.sendBeacon(
      "/stats",
      JSON.stringify({
        t: new Date().toISOString(),
        res: `${W}x${H}`,
        msaa: SAMPLES,
        boxes: nBox,
        sprites: nWorldSpr + nScreenSpr,
        fps: 1000 / p(0.5),
        p50: p(0.5),
        p99: p(0.99),
        max: v[v.length - 1] ?? 0,
        visible: document.visibilityState,
      }),
    );
  }, 1000);

// --- Flux ------------------------------------------------------------------------------------------------------------------
function onFrame(buf: ArrayBuffer) {
  const u = new Uint32Array(buf);
  if (u[0] !== MAGIC) return;
  U = u;
  F = new Float32Array(buf);
  ncpu = u[1]!;
  nproc = u[2]!;
  nthread = u[3]!;
  cpuBase = FRAME.header + FRAME.globals;
  procBase = cpuBase + ncpu * FRAME.cpu;
  threadBase = procBase + nproc * FRAME.proc;
  for (let c = 0; c < ncpu; c++) for (let k = 0; k < 5; k++) cpuTgt[c * 5 + k] = F[cpuBase + c * FRAME.cpu + k]!;
  sched.fill(0);
  for (let i = 0; i < nthread; i++) sched[U[threadBase + i * FRAME.thread + 1]! & 0xff]!++;
  dirty = true;
}
function connect() {
  const ws = new WebSocket(`ws://${location.host}/kernel`);
  ws.binaryType = "arraybuffer";
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) return onFrame(e.data);
    const m = JSON.parse(e.data as string);
    if (m.type === "names") names = m.names;
    else if (m.type === "paths") for (const [pid, p] of Object.entries(m.paths as Record<string, string>)) paths.set(Number(pid), p);
    else if (m.type === "slow") slow = m;
    else if (m.type === "hello") hz = m.hz;
    dirty = true;
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();
fetch("/api/index/stats")
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => {
    indexStats = s;
  });
fetch("/api/index/tree?depth=2&top=24")
  .then((r) => (r.ok ? r.json() : null))
  .then((t) => {
    tree = t;
    dirty = true;
  });
void hz;
requestAnimationFrame(frame);
