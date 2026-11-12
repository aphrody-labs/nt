// Rendu GPU pur du modèle nt : boîtes 3D instanciées (éclairage directionnel + brouillard) et sprites texturés
// (glyphes et icônes d'un atlas RGBA unique), en monde (billboards) ou en espace écran. Aucun vertex buffer.

struct Cam {
  vp: mat4x4f,
  eye: vec4f,       // xyz : position caméra
  right: vec4f,     // xyz : axe droit de la caméra (billboards)
  up: vec4f,        // xyz : axe haut de la caméra
  screen: vec4f,    // largeur, hauteur (px), 1/largeur, 1/hauteur
};
@group(0) @binding(0) var<uniform> cam: Cam;

// --- Boîtes ---------------------------------------------------------------------------------------------------------
struct Box { pos: vec4f, size: vec4f, color: vec4f };   // pos.xyz = centre de la base ; size.xyz ; color rgba
@group(0) @binding(1) var<storage, read> boxes: array<Box>;

struct BoxOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) n: vec3f,
  @location(2) world: vec3f,
};

// 6 faces x 2 triangles ; coins dans [0,1]^3.
const FACE_N = array<vec3f, 6>(vec3f(1, 0, 0), vec3f(-1, 0, 0), vec3f(0, 1, 0), vec3f(0, -1, 0), vec3f(0, 0, 1), vec3f(0, 0, -1));
const QUAD = array<vec2f, 6>(vec2f(0, 0), vec2f(1, 0), vec2f(1, 1), vec2f(0, 0), vec2f(1, 1), vec2f(0, 1));

fn corner(face: u32, uv: vec2f) -> vec3f {
  switch face {
    case 0u: { return vec3f(1.0, uv.x, uv.y); }
    case 1u: { return vec3f(0.0, uv.y, uv.x); }
    case 2u: { return vec3f(uv.y, 1.0, uv.x); }
    case 3u: { return vec3f(uv.x, 0.0, uv.y); }
    case 4u: { return vec3f(uv.y, uv.x, 1.0); }
    default: { return vec3f(uv.x, uv.y, 0.0); }
  }
}

@vertex
fn vs_box(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> BoxOut {
  let b = boxes[i];
  let face = v / 6u;
  let c = corner(face, QUAD[v % 6u]);
  let p = b.pos.xyz + (c - vec3f(0.5, 0.0, 0.5)) * b.size.xyz;
  var o: BoxOut;
  o.pos = cam.vp * vec4f(p, 1.0);
  o.color = b.color;
  o.n = FACE_N[face];
  o.world = p;
  return o;
}

@fragment
fn fs_box(in: BoxOut) -> @location(0) vec4f {
  let l = normalize(vec3f(0.35, 1.0, 0.45));
  let diff = max(dot(in.n, l), 0.0);
  let sky = 0.5 + 0.5 * in.n.y;
  var rgb = in.color.rgb * (0.28 + 0.62 * diff + 0.22 * sky);
  // Arêtes : légère émission des faces supérieures, brouillard exponentiel avec la distance.
  let d = distance(cam.eye.xyz, in.world);
  let fog = 1.0 - exp(-d * 0.0022);
  rgb = mix(rgb, vec3f(0.02, 0.027, 0.043), clamp(fog, 0.0, 0.85));
  return vec4f(rgb, in.color.a);
}

// --- Sprites (glyphes, icônes) -----------------------------------------------------------------------------------------
struct Sprite {
  pos: vec4f,     // xyz monde (w = 0) ou x, y pixels écran (w = 1)
  size: vec4f,    // largeur, hauteur (px), décalage x, y (px) depuis l'ancre
  uv: vec4f,      // u0, v0, u1, v1 dans l'atlas
  color: vec4f,
};
@group(0) @binding(2) var<storage, read> sprites: array<Sprite>;
@group(0) @binding(3) var atlas: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;

struct SpriteOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
};

@vertex
fn vs_sprite(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> SpriteOut {
  let s = sprites[i];
  let q = QUAD[v];
  let px = s.size.zw + vec2f(q.x, 1.0 - q.y) * s.size.xy;   // pixels relatifs à l'ancre, y vers le bas
  var o: SpriteOut;
  if (s.pos.w > 0.5) {
    let p = s.pos.xy + px;
    o.pos = vec4f(p.x * 2.0 * cam.screen.z - 1.0, 1.0 - p.y * 2.0 * cam.screen.w, 0.0, 1.0);
  } else {
    let c = cam.vp * vec4f(s.pos.xyz, 1.0);
    o.pos = vec4f(c.xy + vec2f(px.x, -px.y) * 2.0 * cam.screen.zw * c.w, c.z, c.w);
  }
  o.uv = mix(s.uv.xy, s.uv.zw, vec2f(q.x, 1.0 - q.y));
  o.color = s.color;
  return o;
}

@fragment
fn fs_sprite(in: SpriteOut) -> @location(0) vec4f {
  let t = textureSample(atlas, samp, in.uv);
  let c = t * in.color;
  if (c.a < 0.02) { discard; }
  return vec4f(c.rgb * c.a, c.a);
}
