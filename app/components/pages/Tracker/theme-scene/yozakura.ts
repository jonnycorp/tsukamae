import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Yozakura: cherry trees in full bloom at night, their canopy filling the top of the window, branches dark through it,
// the blossom lit warm from below by paper lanterns (bonbori) along the path at the foot; petals falling slowly through
// the dark between, turning as they fall
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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

  // the night: plum toward the top, a deep blue below, a haze of the lanterns' light low down
  vec3 col = mix(vec3(0.05, 0.04, 0.09), vec3(0.09, 0.04, 0.1), smoothstep(0.0, 1.0, uv.y));
  col += vec3(0.5, 0.25, 0.12) * exp(-uv.y * 5.0) * 0.18;

  // branches: dark limbs reaching in from either side, wobbling as boughs do
  float limbs = 1.0;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float side = mod(fk, 2.0) * 2.0 - 1.0;
    float y0 = 0.62 + 0.3 * hash(vec2(fk, 1.0));
    float x = uv.x * side;
    float reach = aspect * (0.2 + 0.25 * hash(vec2(fk, 2.0)));
    float along = (aspect * 0.5 - x) / reach;
    float yb = y0 + (along * along) * 0.08 * (hash(vec2(fk, 3.0)) - 0.3) + (fbm(vec2(x * 3.0, fk)) - 0.5) * 0.08;
    float w = mix(0.012, 0.002, clamp(along, 0.0, 1.0));
    float d = abs(uv.y - yb) - w;
    limbs = min(limbs, along < 1.0 ? d : 1.0);
  }

  // the canopy: blossom gathered in clusters along the boughs, thickest at the top and the sides; each cluster a puff of
  // small flowers, lit warm and bright on its underside by the lanterns, deeper mauve where it's shaded
  vec2 fp = px / (11.0 * u_dpr);
  vec2 fc = floor(fp);
  float bloom = 0.0;
  float shade = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = fc + vec2(float(x), float(y));
      vec2 centre = c + vec2(hash(c + 1.7), hash(c + 3.1));
      vec2 cuv = vec2((centre.x * 11.0 * u_dpr - 0.5 * u_res.x) / h, centre.y * 11.0 * u_dpr / h);
      float dens = fbm(cuv * vec2(2.2, 3.0) + 2.0) + smoothstep(0.45, 1.0, cuv.y) * 0.6 + abs(cuv.x) / (aspect * 0.5) * 0.3 - 0.62;
      if (hash(c) < dens * 2.2 * smoothstep(0.18, 0.5, cuv.y)) {
        float r = 0.55 + 0.5 * hash(c + 5.0);
        // a flower: five petals round its centre, a notch at each petal's tip
        vec2 v = fp - centre;
        float ang = atan(v.y, v.x) + hash(c + 7.0) * 6.28;
        float petals = 0.82 + 0.18 * abs(cos(ang * 2.5));
        float d = length(v) / (r * petals);
        float a = smoothstep(1.0, 0.82, d) * (0.75 + 0.25 * hash(c + 2.0));
        if (a > bloom) {
          bloom = a;
          // lit from below and from the front of the puff
          shade = clamp(0.5 - (fp.y - centre.y) / r * 0.5, 0.0, 1.0) * 0.6 + hash(c + 9.0) * 0.4;
        }
      }
    }
  }
  vec3 pink = mix(vec3(0.45, 0.24, 0.36), vec3(1.0, 0.8, 0.86), shade);
  float under = smoothstep(0.6, 0.25, uv.y);
  pink = mix(pink, vec3(1.0, 0.85, 0.72), under * 0.35);
  pink *= 0.6 + 0.4 * smoothstep(1.0, 0.4, uv.y);
  col = mix(col, vec3(0.03, 0.02, 0.03), smoothstep(0.002, 0.0, limbs));
  col = mix(col, pink, bloom * 0.95);

  // the lanterns along the path: paper boxes on posts, glowing, their light on the haze
  for (int k = 0; k < 9; k++) {
    float fk = float(k);
    float lx = (fk / 8.0 - 0.5) * aspect * 0.95 + (hash(vec2(fk, 9.0)) - 0.5) * 0.08;
    float depth = 0.5 + 0.5 * hash(vec2(fk, 7.0));
    vec2 c = vec2(lx, 0.06 + 0.05 * (1.0 - depth));
    vec2 v = (uv - c) / depth;
    float box = step(abs(v.x), 0.014) * step(abs(v.y), 0.022);
    float cap = step(abs(v.x), 0.018) * step(abs(v.y - 0.025), 0.004);
    float post = step(abs(v.x), 0.002) * step(v.y, -0.022);
    float flicker = 0.92 + 0.08 * noise(vec2(t * 0.6, fk));
    col += vec3(1.0, 0.6, 0.3) * exp(-length(v) * 22.0) * 0.35 * flicker;
    col = mix(col, vec3(0.06, 0.04, 0.04), post);
    col = mix(col, vec3(1.0, 0.86, 0.62) * flicker * (0.9 + 0.1 * step(0.5, fract(v.y * 90.0))), box);
    col = mix(col, vec3(0.1, 0.05, 0.04), cap);
  }

  // petals falling, drifting side to side, turning
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float n = 14.0 + fl * 8.0;
    vec2 p = uv * n + vec2(sin(t * 0.2 + uv.y * 3.0 + fl) * 0.6, t * (0.35 + fl * 0.15));
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    float there = step(0.9, hash(cell + fl * 13.0));
    float a = t * (0.6 + hash(cell)) + hash(cell + 3.0) * 6.28;
    vec2 r = vec2(cos(a) * f.x - sin(a) * f.y, sin(a) * f.x + cos(a) * f.y) + (hash(cell + 5.0) - 0.5) * 0.4;
    float petal = smoothstep(1.0, 0.7, length(r * vec2(1.0 / 0.16, 1.0 / (0.09 * (0.5 + 0.5 * abs(sin(a)))))));
    col = mix(col, vec3(1.0, 0.82, 0.88), petal * there * (0.55 - fl * 0.2));
  }

  vec2 q = px / u_res;
  col *= mix(0.7, 1.0, smoothstep(1.2, 0.4, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const yozakuraScene: SceneMaker = (back) => shaderScene(back, FRAGMENT);
