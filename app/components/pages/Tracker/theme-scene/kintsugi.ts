import { shaderScene } from './scene';
import { canvas, rng, toProperty } from './texture';

import type { SceneMaker } from './scene';

// Kintsugi's bowl, seen close: dark raku glaze, mottled where it pooled and thinned, broken into pieces and mended
// along every crack with gold. The glaze holds still; a light moves very slowly over it, a soft highlight drifting on
// the glaze and the gold brightening where it passes. Also makes the cracks a sealed tile is mended along
// (--kintsugi-cracks), every tile its own part of them
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2 (vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm (vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

// the distance to the nearest crack: the edges between pieces, wobbled as a real break is
float crack (vec2 p) {
  p += (vec2(fbm(p * 1.7), fbm(p * 1.7 + 5.0)) - 0.5) * 0.35;
  vec2 g = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 r = o + hash2(g + o) - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;

  // the glaze: near black brown, mottled, a little lighter where it ran thin
  float m = fbm(uv * 3.0);
  float m2 = fbm(uv * 14.0 + 3.0);
  vec3 col = mix(vec3(0.05, 0.04, 0.035), vec3(0.16, 0.11, 0.08), smoothstep(0.35, 0.75, m));
  col = mix(col, vec3(0.2, 0.17, 0.15), smoothstep(0.62, 0.8, m2) * 0.35);
  // pinholes in it
  col *= 1.0 - 0.5 * step(0.985, hash(floor(px / (3.0 * u_dpr))));

  // the light, wandering slowly
  vec2 light = vec2(sin(t * 0.03) * 0.6, 0.55 + cos(t * 0.021) * 0.25);
  float ld = length(uv - light);
  col += vec3(0.55, 0.45, 0.38) * exp(-ld * 3.5) * 0.12 * (0.6 + 0.4 * m2);

  // the gold in the cracks, wider in places as the lacquer was laid
  float c = crack(uv * 2.4);
  float width = (0.018 + 0.03 * noise(uv * 6.0)) ;
  float fine = crack(uv * 7.0 + 11.0);
  float gold = smoothstep(width, width * 0.4, c) + smoothstep(0.012, 0.004, fine) * 0.6 * step(0.55, noise(uv * 3.0 + 2.0));
  gold = clamp(gold, 0.0, 1.0);
  vec3 g = mix(vec3(0.55, 0.38, 0.12), vec3(1.0, 0.85, 0.5), 0.35 + 0.65 * exp(-ld * 2.2));
  g *= 0.85 + 0.25 * noise(uv * 220.0);
  col = mix(col, g, gold);

  vec2 q = px / u_res;
  col *= mix(0.6, 1.0, smoothstep(1.25, 0.3, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

// cracks across a tile's worth of glaze for the stylesheet: a few lines branching across, an alpha mask
function cracks (): HTMLCanvasElement {
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const run = (random: () => number, x: number, y: number, a: number, len: number, w: number, depth: number) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let cx = x;
    let cy = y;
    for (let i = 0; i < len; i++) {
      a += (random() - 0.5) * 0.7;
      cx += Math.cos(a) * 9;
      cy += Math.sin(a) * 9;
      ctx.lineTo(cx, cy);
      if (depth < 2 && random() < 0.08) {
        ctx.stroke();
        run(random, cx, cy, a + (random() < 0.5 ? 1 : -1) * (0.6 + random() * 0.6), len / 2, w * 0.6, depth + 1);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
      }
    }
    ctx.stroke();
  };
  for (let n = 0; n < 5; n++) {
    for (const [ox, oy] of [[0, 0], [-size, 0], [0, -size], [-size, -size], [size, 0], [0, size]]) {
      // the same crack laid at each neighbouring copy, so the mask tiles
      const r = rng(100 + n);
      run(r, r() * size + ox, r() * size + oy, r() * Math.PI * 2, 40, 1 + r() * 0.9, 0);
    }
  }
  return c;
}

export const kintsugiScene: SceneMaker = (back) => {
  const scene = shaderScene(back, FRAGMENT);
  const off = toProperty('--kintsugi-cracks', cracks());
  return {
    ...scene,
    dispose () {
      off();
      scene.dispose();
    },
  };
};
