// HLSL 202x, SM 6.6 — même géométrie et même SDF que src/web/shader.wgsl (parité, docs/plan/03 §4.3).
#define NT_RS "RootConstants(num32BitConstants=4, b0), SRV(t0, visibility=SHADER_VISIBILITY_ALL)"

struct Inst { float4 rect; uint color; float radius; float shadow; uint flags; };
StructuredBuffer<Inst> insts : register(t0);
cbuffer U : register(b0) { float2 scale; float2 size; };

struct VOut {
  float4 pos : SV_Position;
  float2 local : LOCAL;
  nointerpolation uint id : INSTANCE;
};

[RootSignature(NT_RS)]
VOut vs(uint v : SV_VertexID, uint i : SV_InstanceID) {
  Inst it = insts[i];
  float2 corner = float2(float(v & 1u), float(v >> 1u));
  float pad = it.shadow;
  float2 p = it.rect.xy - pad + corner * (it.rect.zw + 2.0 * pad);
  VOut o;
  o.pos = float4(p.x * scale.x - 1.0, 1.0 - p.y * scale.y, 0.0, 1.0);
  o.local = p - (it.rect.xy + it.rect.zw * 0.5);
  o.id = i;
  return o;
}

[RootSignature(NT_RS)]
float4 ps(VOut o) : SV_Target {
  Inst it = insts[o.id];
  float4 c = float4(it.color & 0xFFu, (it.color >> 8) & 0xFFu, (it.color >> 16) & 0xFFu, it.color >> 24) / 255.0;
  if ((it.flags & 1u) != 0u) {
    float t = saturate(o.local.y / it.rect.w + 0.5);
    return float4(lerp(c.rgb, float3(0.0, 0.32, 0.62), t * t), 1.0);
  }
  float2 half_ = it.rect.zw * 0.5;
  float r = min(it.radius, min(half_.x, half_.y));
  float2 q = abs(o.local) - half_ + r;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float a = it.shadow > 0.0 ? 1.0 - smoothstep(-0.5 * it.shadow, it.shadow, d) : saturate(0.5 - d);
  float alpha = c.a * a;
  return float4(c.rgb * alpha, alpha);
}
