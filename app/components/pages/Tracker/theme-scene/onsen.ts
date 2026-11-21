import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Onsen: an open-air hot spring on a winter night, painted (public/themes/onsen): snowy rocks round the pool, cherry
// trees and a mountain behind, stone lanterns and shōji windows lit along the far side. The picture holds still; over
// it the lights breathe and flicker each on its own (the picture lit, less a share of its light: light.webp, the lit
// picture less its unlit twin), the water stirs their reflections, steam drifts up off it and snow falls through
//
// u_picture0: the picture, lit; u_picture1: its light alone; u_picture2: where the water is (water.png)
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm (vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

// one light across the picture (centred at cx, as wide as w): how bright it burns now, a little under full as a flame
// gutters (by up to amp), weighted by how near x is to it
void source (float x, float cx, float w, float amp, float speed, float seed, float t, inout vec2 acc) {
  float k = exp(-pow((x - cx) / w, 2.0));
  float n = noise(vec2(t * speed, seed * 7.1)) * 0.65 + noise(vec2(t * speed * 2.7, seed * 3.7 + 9.0)) * 0.35;
  acc += vec2(k * (1.0 - amp * n), k);
}

// the lights at x: the stone lanterns' flames quick and lively, the windows' lamps behind paper slow and slight.
// Reflections sit straight below what they reflect, so the pool's flicker with their lanterns
float flicker (float x, float t) {
  vec2 acc = vec2(0.0);
  source(x, 0.200, 0.050, 0.08, 0.40, 1.0, t, acc);
  source(x, 0.295, 0.020, 0.24, 1.50, 2.0, t, acc);
  source(x, 0.460, 0.014, 0.24, 1.70, 3.0, t, acc);
  source(x, 0.501, 0.014, 0.24, 1.40, 4.0, t, acc);
  source(x, 0.620, 0.020, 0.24, 1.80, 5.0, t, acc);
  source(x, 0.765, 0.050, 0.08, 0.35, 6.0, t, acc);
  source(x, 0.854, 0.025, 0.24, 1.60, 7.0, t, acc);
  return acc.y > 1e-4 ? acc.x / acc.y : 1.0;
}

// snow: three layers of flakes, the far ones small, slow and faint, the near larger; each drifting as it falls
float snow (vec2 px, float h, float t) {
  float a = 0.0;
  for (int l = 0; l < 3; l++) {
    float fl = float(l) / 2.0;
    float cells = mix(22.0, 8.0, fl);
    vec2 p = px / h * cells;
    p.y += t * mix(0.022, 0.06, fl) * cells;
    p.x += sin(t * 0.25 + p.y * 0.35 + fl * 4.0) * 0.35;
    vec2 c = floor(p);
    float r = hash(c + fl * 17.0);
    if (r < mix(0.5, 0.32, fl)) {
      vec2 at = vec2(hash(c + 3.1), hash(c + 7.7)) * 0.8 + 0.1;
      at.x += sin(t * (0.4 + r) + r * 6.28) * 0.08;
      float d = length(fract(p) - at) / cells * h;
      // soft flakes, not points of light: each falls off from its middle
      float radius = mix(1.2, 3.4, fl) * u_dpr;
      a += smoothstep(radius, 0.0, d) * mix(0.4, 0.75, fl);
    }
  }
  return min(a, 1.0);
}

void main () {
  if (u_loaded < 0.5) {
    gl_FragColor = vec4(0.04, 0.05, 0.09, 1.0);
    return;
  }
  float t = u_time;
  vec2 uv = gl_FragCoord.xy / u_res;
  // the same point on the picture, 0–1 from its top left
  vec2 iuv = u_crop.xy + vec2(uv.x, 1.0 - uv.y) * u_crop.zw;

  // the water stirring: bands across it, close together far off and wider nearer, pulling what it reflects side to
  // side; still where rocks stand in it
  float water = texture2D(u_picture2, uv).r;
  float near = smoothstep(0.58, 1.0, iuv.y);
  vec2 q = vec2(iuv.x * mix(16.0, 5.0, near), iuv.y * mix(170.0, 40.0, near) - t * 0.8);
  float n1 = noise(q) - 0.5;
  float n2 = noise(q * 1.9 + 3.1) - 0.5;
  vec2 stir = vec2(n1 + 0.5 * n2, n2 * 0.25) * mix(0.0012, 0.005, near) * water;

  vec3 col = texture2D(u_picture0, uv + stir).rgb;
  vec3 light = texture2D(u_picture1, uv + stir).rgb;
  col += light * (flicker(iuv.x, t) - 1.0);
  // and a glint now and then where it catches the light
  col += light * water * pow(noise(q * vec2(2.0, 0.6) + t * 0.3), 6.0) * 0.6;

  // steam rising off the pool, thickest along the far shore, warmed where the lanterns light it
  vec2 sp = vec2(iuv.x * 4.0 + t * 0.012, iuv.y * 7.0 + t * 0.06);
  sp += vec2(noise(sp * 0.6 + t * 0.05), noise(sp * 0.6 - t * 0.04)) * 0.8;
  float band = smoothstep(0.46, 0.6, iuv.y) * (1.0 - 0.6 * smoothstep(0.64, 1.0, iuv.y));
  float steam = smoothstep(0.42, 0.85, fbm(sp)) * band * 0.2;
  col = mix(col, vec3(0.5, 0.56, 0.66) + light * 1.4, steam);

  // and the snow over it all, lit warm near a light
  float s = snow(gl_FragCoord.xy, u_res.y, t);
  col = mix(col, vec3(0.86, 0.9, 0.98) + light * 1.2, s);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const onsenScene: SceneMaker = (canvas) => shaderScene(canvas, FRAGMENT, undefined, [
  // the lanterns and the near water kept in view as a wide window crops its top and bottom
  { src: '/themes/onsen/scene.webp', anchor: [0.5, 0.62] },
  { src: '/themes/onsen/light.webp', anchor: [0.5, 0.62] },
  { src: '/themes/onsen/water.png', anchor: [0.5, 0.62] },
]);
