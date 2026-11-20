import { shaderScene } from './scene';
import { canvas, rng, toProperty } from './texture';

import type { SceneMaker } from './scene';

// Wisteria 2's court night: deep violet lacquer, the gold waves of seigaiha laid faintly over it, and bands of gold-leaf
// cloud (suyari-gasumi) drifting across in two depths, the near ones slower than the far, the leaf catching a light that
// stands still as they pass under it, flecked where the leaf was laid in squares and broke
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// a band of cloud: two or three rounded slips of leaf stacked off one another, the stepped edge suyari-gasumi has
float band (vec2 p, float seed) {
  float d = 1.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 o = vec2((hash(vec2(seed, fi)) - 0.5) * 0.55, fi * 0.042 - 0.042);
    float w = 0.2 + 0.22 * hash(vec2(fi, seed + 3.0));
    vec2 q = p - o;
    float c = length(max(abs(q) - vec2(w, 0.0), 0.0)) - 0.024;
    // its upper edge rising in soft scallops, as a painter's cloud does
    c -= 0.012 * max(0.0, sin(q.x * 38.0 + seed * 5.0)) * smoothstep(-0.01, 0.02, q.y) * step(abs(q.x), w);
    d = min(d, c);
  }
  return d;
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;

  // the lacquer: violet near black, a soft sheen down from the top
  vec3 col = mix(vec3(0.05, 0.02, 0.07), vec3(0.13, 0.05, 0.17), smoothstep(0.0, 1.0, uv.y));
  col += vec3(0.25, 0.12, 0.3) * exp(-length(uv - vec2(-0.3, 1.1)) * 1.6) * 0.35;

  // the waves, faint gold, drifting right very slowly
  vec2 wp = (uv + vec2(t * 0.004, 0.0)) * 7.0;
  // scales a unit across in rows a quarter apart, each row half a scale over and lying over the row above it: the
  // nearest row down whose half-disc holds the point draws it
  float ring = 1.0;
  float j0 = floor(wp.y / 0.25);
  for (int k = 3; k >= 0; k--) {
    if (ring < 1.0) { break; }
    float j = j0 - float(k);
    float off = 0.5 * mod(j, 2.0);
    float cx = floor(wp.x - off) + 0.5 + off;
    for (int dx = -1; dx <= 1; dx++) {
      vec2 c = vec2(cx + float(dx), j * 0.25);
      vec2 v = wp - c;
      float r = length(v);
      if (v.y >= 0.0 && r < 0.5 && ring == 1.0) {
        ring = abs(fract(r * 8.0) - 0.5) / 8.0;
      }
    }
  }
  float pw = 1.1 * u_dpr / h * 7.0;
  col += vec3(0.85, 0.66, 0.3) * smoothstep(pw, 0.0, ring) * 0.1;

  // the clouds: bands in two depths, drifting left at their own pace, the near one larger
  vec3 leaf = vec3(0.0);
  float cover = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float scale = 1.0 + fl * 0.6;
    float speed = 0.006 - fl * 0.0025;
    for (int b = 0; b < 4; b++) {
      float fb = float(b);
      float y = 0.15 + fb * 0.24 + fl * 0.11;
      float period = 1.9 * scale;
      vec2 p = vec2(uv.x + t * speed + fb * 0.7 + fl * 0.37, uv.y - y) / scale;
      float idx = floor(p.x / (period / scale) + 0.5);
      p.x -= idx * (period / scale);
      float d = band(p, idx * 7.0 + fb * 3.0 + fl * 11.0);
      float a = smoothstep(0.0015 * u_dpr, -0.0015 * u_dpr, d * h / 600.0);
      if (a > 0.0) {
        // gold leaf: laid in squares, each a touch different, the light standing at the top left
        vec2 sq = floor((uv + vec2(t * speed, 0.0)) * 60.0);
        float tone = 0.88 + 0.12 * hash(sq + fl);
        float light = 0.75 + 0.45 * exp(-length(uv - vec2(-0.5, 0.95)) * 1.4);
        vec3 gold = mix(vec3(0.55, 0.38, 0.14), vec3(0.98, 0.82, 0.45), clamp((p.y * 20.0 + 0.5) * 0.6 + 0.3, 0.0, 1.0)) * tone * light;
        gold *= 0.85 + 0.15 * noise(uv * 300.0);
        // its edge a hair brighter where the leaf folds over
        gold += vec3(0.4, 0.3, 0.1) * smoothstep(0.004, 0.0, abs(d)) * 0.5;
        float depth = layer == 0 ? 0.45 : 0.92;
        leaf = mix(leaf, gold, a);
        cover = max(cover, a * depth);
      }
    }
  }
  col = mix(col, leaf, cover);

  vec2 q = px / u_res;
  col *= mix(0.7, 1.0, smoothstep(1.2, 0.4, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

// the lacquer's gold dust: flecks of three sizes scattered thin, an alpha mask (--kumo-nashiji)
function nashiji (): HTMLCanvasElement {
  const size = 256;
  const [c, ctx] = canvas(size);
  const random = rng(31);
  for (let i = 0; i < 260; i++) {
    const r = random() < 0.85 ? 0.4 + random() * 0.6 : 1 + random() * 0.8;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 + random() * 0.65})`;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export const kumoScene: SceneMaker = (back) => {
  const scene = shaderScene(back, FRAGMENT);
  const off = toProperty('--kumo-nashiji', nashiji());
  return {
    ...scene,
    dispose () {
      off();
      scene.dispose();
    },
  };
};
