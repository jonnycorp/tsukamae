import { shaderScene } from './scene';
import { canvas, rng, toProperty } from './texture';

import type { SceneMaker } from './scene';

// Wisteria 3's night, tsukimi: an indigo sky, the full moon in its halo with thin clouds crossing it slowly, lit at
// their edges where they pass it; far hills in mist; and pampas grass (susuki) along the foot of the window, its
// plumes silvered by the moon, leaning in a wind that runs across it in slow waves
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1 (float n) { return fract(sin(n * 91.345) * 47453.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm (vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float aspect = u_res.x / h;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;

  // the sky, deepest overhead, a little lighter and warmer low down
  vec3 col = mix(vec3(0.09, 0.13, 0.25), vec3(0.015, 0.025, 0.07), smoothstep(0.05, 1.0, uv.y));

  // stars, few, faint, still
  vec2 cell = floor(px / (30.0 * u_dpr));
  float r = hash(cell);
  vec2 spot = (cell + vec2(hash(cell + 2.1), hash(cell + 5.3))) * 30.0 * u_dpr;
  col += vec3(0.75, 0.8, 1.0) * step(0.86, r) * smoothstep(1.3, 0.0, length(px - spot) / u_dpr) * 0.5 * smoothstep(0.35, 0.8, uv.y);

  // the moon and its light on the air
  vec2 mc = vec2(aspect * 0.28, 0.76);
  float mr = 0.085;
  float md = length(uv - mc);
  col += vec3(0.55, 0.62, 0.8) * exp(-md * 3.2) * 0.22;
  col += vec3(0.75, 0.78, 0.9) * exp(-max(md - mr, 0.0) * 22.0) * 0.25;
  // a faint corona, a ring a little out from it
  col += vec3(0.7, 0.75, 0.95) * exp(-pow((md - mr * 2.6) / 0.03, 2.0)) * 0.035;
  vec2 mp = (uv - mc) / mr;
  float maria = fbm(mp * 1.6 + 3.0);
  float limb = sqrt(max(0.0, 1.0 - dot(mp, mp)));
  vec3 moon = vec3(0.98, 0.95, 0.85) * (0.82 + 0.18 * limb) * (1.0 - smoothstep(0.45, 0.75, maria) * 0.16);
  col = mix(col, moon, smoothstep(mr + 0.0015, mr - 0.0015, md));

  // thin clouds drifting across, drawn out along the wind, silvered where they pass near the moon
  vec2 cp = vec2(uv.x * 1.3 + t * 0.006, uv.y * 4.2);
  float cloud = fbm(cp * 2.0 + vec2(0.0, fbm(cp * 1.4 - t * 0.003) * 0.8));
  float band = smoothstep(0.42, 0.95, uv.y) * (1.0 - smoothstep(0.95, 1.05, uv.y));
  float c = smoothstep(0.52, 0.78, cloud) * band;
  vec3 cloudCol = mix(vec3(0.16, 0.2, 0.32), vec3(0.85, 0.86, 0.92), exp(-md * 4.5));
  col = mix(col, cloudCol, c * 0.55);

  // far hills in mist, two ranges
  float hill1 = 0.24 + 0.05 * fbm(vec2(uv.x * 1.2 + 4.0, 0.0)) + 0.03 * sin(uv.x * 1.7);
  float hill2 = 0.17 + 0.06 * fbm(vec2(uv.x * 2.1 + 9.0, 1.0));
  col = mix(col, vec3(0.11, 0.15, 0.26), step(uv.y, hill1) * 0.85);
  col = mix(col, vec3(0.06, 0.08, 0.16), step(uv.y, hill2) * 0.92);
  // mist pooled low, lit faintly by the moon
  col += vec3(0.35, 0.4, 0.55) * exp(-abs(uv.y - 0.15) * 12.0) * 0.1;

  // the susuki: blades rising from the foot, their plumes at the tips, leaning with the wind's slow waves
  if (uv.y < 0.42) {
    float blade = 0.0;
    float plume = 0.0;
    for (int i = 0; i < 64; i++) {
      float fi = float(i);
      float x0 = (hash1(fi) - 0.5) * aspect * 1.15;
      // densest at the window's two sides, thinner through the middle
      float side = abs(x0) / (aspect * 0.5);
      float tall = (0.13 + 0.16 * hash1(fi + 3.0)) * (0.55 + 0.6 * side);
      float s = uv.y / tall;
      if (s > 1.12) { continue; }
      float wind = 0.035 * sin(t * 0.45 - x0 * 1.6 + hash1(fi + 7.0)) + 0.012 * sin(t * 1.1 + fi);
      float lean = (hash1(fi + 5.0) - 0.35) * 0.06 + wind;
      float xb = x0 + lean * s * s * 2.2;
      float w = mix(0.0026, 0.0007, s);
      float d = abs(uv.x - xb);
      blade = max(blade, smoothstep(w + 1.5 * u_dpr / h, w, d) * step(s, 1.0));
      // the plume: a feathery spray along the last quarter, wider in the middle, tossed downwind
      float ps = (s - 0.72) / 0.36;
      if (ps > 0.0 && ps < 1.0) {
        float pw = 0.011 * sin(3.1416 * ps) * (0.7 + 0.3 * hash1(fi + 9.0));
        float px2 = xb + lean * 0.25 * ps;
        float fd = abs(uv.x - px2) / max(pw, 0.0001);
        float feather = noise(vec2(uv.x * 900.0, uv.y * 140.0) + fi) * 0.6 + 0.4;
        plume = max(plume, smoothstep(1.0, 0.2, fd) * feather);
      }
    }
    col = mix(col, vec3(0.02, 0.025, 0.05), blade);
    col = mix(col, vec3(0.7, 0.72, 0.8), plume * 0.55);
  }

  vec2 q = px / u_res;
  col *= mix(0.78, 1.0, smoothstep(1.2, 0.4, length((q - vec2(0.6, 0.55)) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

// a shōji's paper, its fibres alone (--tsukimi-fibres), laid over a pane's light so the lamp shows them
function fibres (): HTMLCanvasElement {
  const size = 384;
  const [c, ctx] = canvas(size);
  const random = rng(13);
  for (let n = 0; n < 700; n++) {
    const x = random() * size;
    const y = random() * size;
    const len = 5 + random() * 30;
    const a = random() * Math.PI * 2;
    ctx.strokeStyle = random() < 0.3 ? `rgba(80, 50, 20, ${0.1 + random() * 0.12})` : `rgba(255, 240, 210, ${0.12 + random() * 0.2})`;
    ctx.lineWidth = 0.4 + random() * 0.6;
    for (const [ox, oy] of [[0, 0], [-size, 0], [0, -size], [-size, -size]]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + Math.cos(a + 0.4) * len * 0.5, y + oy + Math.sin(a + 0.4) * len * 0.5, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  return c;
}

export const tsukimiScene: SceneMaker = (back) => {
  const scene = shaderScene(back, FRAGMENT);
  const off = toProperty('--tsukimi-fibres', fibres());
  return {
    ...scene,
    dispose () {
      off();
      scene.dispose();
    },
  };
};
