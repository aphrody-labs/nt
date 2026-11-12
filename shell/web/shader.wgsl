// Quads instanciés sans vertex buffer, SDF rectangle arrondi + ombre douce (docs/plan/03 §4).
struct Inst {
  rect: vec4f,   // x, y, w, h (pixels)
  color: u32,    // RGBA8, r = octet de poids faible
  radius: f32,
  shadow: f32,
  flags: u32,    // bit 0 : dégradé fond d'écran
};

struct U { scale: vec2f, size: vec2f };

@group(0) @binding(0) var<storage, read> insts: array<Inst>;
@group(0) @binding(1) var<uniform> u: U;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) id: u32,
};

@vertex
fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VOut {
  let it = insts[i];
  let corner = vec2f(f32(v & 1u), f32(v >> 1u));
  let pad = it.shadow;
  let p = it.rect.xy - vec2f(pad) + corner * (it.rect.zw + vec2f(2.0 * pad));
  var o: VOut;
  o.pos = vec4f(p.x * u.scale.x - 1.0, 1.0 - p.y * u.scale.y, 0.0, 1.0);
  o.local = p - (it.rect.xy + it.rect.zw * 0.5);
  o.id = i;
  return o;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let it = insts[in.id];
  var c = unpack4x8unorm(it.color);
  if ((it.flags & 1u) != 0u) {
    let t = clamp(in.local.y / it.rect.w + 0.5, 0.0, 1.0);
    c = vec4f(mix(c.rgb, vec3f(0.0, 0.32, 0.62), t * t), 1.0);
    return vec4f(c.rgb, 1.0);
  }
  let half = it.rect.zw * 0.5;
  let r = min(it.radius, min(half.x, half.y));
  let q = abs(in.local) - half + vec2f(r);
  let d = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
  var a: f32;
  if (it.shadow > 0.0) {
    a = 1.0 - smoothstep(-0.5 * it.shadow, it.shadow, d);
  } else {
    a = clamp(0.5 - d, 0.0, 1.0);
  }
  let alpha = c.a * a;
  return vec4f(c.rgb * alpha, alpha);
}
