import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Onsen: an open-air bath (rotenburo) at an inn on a winter night, seen from under its eaves. The moon over snowy
// mountains, mist lying in their valleys, a lakeside town's lights across the water and their reflections trembling in
// it; nearer, the bath itself, its rim of dark wet stones and the hot water lit gold by the inn's lanterns, steam
// rising off it and drifting. Lanterns hang from the posts either side, their light pooled warm round them and
// breathing a little; snow falls slowly through all of it
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2 (vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm (vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
// a range's skyline: sharp crests where the noise folds, softer shoulders between
float peaks (float x) {
  float v = 0.0; float a = 0.55; float f = 1.0;
  for (int i = 0; i < 4; i++) { v += a * (1.0 - abs(noise(vec2(x * f, float(i) * 3.0)) * 2.0 - 1.0)); f *= 2.1; a *= 0.45; }
  return v;
}
float ridge (float x) { return noise(vec2(x, 0.0)) * 0.6 + noise(vec2(x * 2.3, 4.0)) * 0.28 + noise(vec2(x * 5.7, 9.0)) * 0.12; }

// the town's lights across the lake: warm points along the shore, a few climbing the hill behind
float town (vec2 p, float aspect) {
  vec2 c = floor(p / 0.011);
  vec2 o = hash2(c);
  vec2 at = (c + 0.25 + 0.5 * o) * 0.011;
  float shore = 0.405 + 0.03 * ridge(at.x * 3.0 + 5.0);
  float there = step(0.55, hash(c + 3.0)) * step(0.393, at.y) * step(at.y, shore + 0.012 * hash(c + 5.0));
  there *= smoothstep(0.05, 0.25, abs(at.x / aspect + 0.12));
  return there * smoothstep(0.0028, 0.0008, length(p - at)) * (0.6 + 0.4 * hash(c + 7.0));
}

// a lantern hung at c: a wooden frame round lit paper, its light breathing a little; the light it gives at p (x) and
// how much of p is the lantern itself (y), its paper (z)
vec3 lantern (vec2 p, vec2 c, float s, float t, float k) {
  vec2 v = (p - c) / s;
  float flick = 0.9 + 0.1 * noise(vec2(t * 0.8, k * 7.0));
  float body = step(abs(v.x), 0.5) * step(abs(v.y), 0.72);
  float paper = step(abs(v.x), 0.4) * step(abs(v.y), 0.6) * step(0.06, abs(v.y)) ;
  float cap = step(abs(v.x), 0.62) * step(abs(v.y - 0.8), 0.1) + step(abs(v.x), 0.62) * step(abs(v.y + 0.8), 0.08);
  float glow = exp(-length(v) * 0.55) * flick;
  return vec3(glow, clamp(body + cap, 0.0, 1.0), paper * flick);
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float aspect = u_res.x / h;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;
  float half_ = aspect * 0.5;

  // the night sky, deep at the top, a little lighter over the mountains; stars, few near the moon
  vec3 col = mix(vec3(0.09, 0.12, 0.22), vec3(0.015, 0.02, 0.06), smoothstep(0.45, 1.0, uv.y));
  vec2 cell = floor(px / (22.0 * u_dpr));
  vec2 spot = (cell + hash2(cell)) * 22.0 * u_dpr;
  float star = step(0.86, hash(cell + 9.0)) * smoothstep(1.4, 0.0, length(px - spot) / u_dpr) * smoothstep(0.55, 0.75, uv.y);
  col += vec3(0.85, 0.88, 1.0) * star * (0.5 + 0.35 * sin(t * (0.4 + hash(cell)) + hash(cell + 1.0) * 30.0));
  vec2 moon = vec2(half_ * 0.42, 0.82);
  float md = length(uv - moon);
  col += vec3(0.75, 0.78, 0.9) * exp(-md * 9.0) * 0.22;
  col = mix(col, vec3(1.0, 0.96, 0.84), smoothstep(0.034, 0.031, md));

  // the far range, its peaks catching snow and the moon, mist lying along its foot
  float far = 0.4 + 0.22 * peaks(uv.x * 1.1 + 2.0);
  if (uv.y < far) {
    // snow lying down from each crest, bluer and darker toward the valleys
    float snow = smoothstep(far - 0.09, far - 0.012, uv.y) * smoothstep(0.55, 0.66, far);
    vec3 rock = mix(vec3(0.06, 0.08, 0.15), vec3(0.11, 0.14, 0.24), smoothstep(0.4, far, uv.y));
    col = mix(rock, vec3(0.5, 0.55, 0.7), snow * (0.55 + 0.45 * noise(vec2(uv.x * 40.0, uv.y * 25.0))));
  }
  float near = 0.43 + 0.08 * ridge(uv.x * 2.6 + 11.0);
  col = mix(col, vec3(0.05, 0.07, 0.13), step(uv.y, near));
  col += vec3(0.5, 0.56, 0.72) * exp(-abs(uv.y - 0.47) * 30.0) * 0.16 * (0.6 + 0.4 * noise(vec2(uv.x * 2.0 + t * 0.01, 1.0)));

  // the town at the foot of the hill and the lake before it, the lights trembling in the water below them
  col += vec3(1.0, 0.74, 0.42) * town(uv, aspect) * 1.3;
  float lake = step(uv.y, 0.395) * step(0.26, uv.y);
  if (lake > 0.0) {
    float wob = sin(uv.y * 900.0 + t * 1.2 + noise(uv * vec2(4.0, 80.0)) * 6.0) * 0.0015;
    vec2 m = vec2(uv.x + wob, 0.79 - uv.y);
    float refl = 0.0;
    for (int k = 0; k < 4; k++) { refl += town(m + vec2(0.0, float(k) * 0.004), aspect); }
    col = vec3(0.03, 0.05, 0.1) + vec3(1.0, 0.7, 0.4) * refl * 0.35;
    // the moon's path across it, broken by the ripples
    float path = exp(-abs(uv.x - moon.x) * 30.0) * step(0.5, noise(vec2(uv.x * 60.0, uv.y * 300.0 + t * 0.6)));
    col += vec3(0.8, 0.82, 0.9) * path * 0.25 * smoothstep(0.26, 0.39, uv.y);
  }

  // snow-laden shrubs along the far side of the bath, rounded mounds of white over dark leaves
  float shrub = 0.27 + 0.035 * (noise(vec2(uv.x * 9.0, 2.0)) * 0.7 + noise(vec2(uv.x * 23.0, 5.0)) * 0.3);
  if (uv.y < shrub && uv.y > 0.19) {
    float top = smoothstep(shrub - 0.02, shrub - 0.004, uv.y);
    col = mix(vec3(0.04, 0.07, 0.06), vec3(0.72, 0.76, 0.86), top);
  }

  // the bath: hot water under the lanterns, gold where their light falls on it and dark between, rippling slowly; its
  // rim a row of dark wet stones, each rounded and catching the light along its top
  float rim = 0.2 + 0.012 * noise(vec2(uv.x * 7.0, 1.0));
  if (uv.y < rim) {
    vec2 sp = vec2(uv.x * 9.0, (uv.y - rim) * 13.0);
    vec2 sc = floor(sp);
    float row = step(rim - 0.07, uv.y);
    if (row > 0.0) {
      // stones of all sizes: each column of the rim its own width, its stone's height and lean its own
      float w = 0.7 + 0.6 * hash(vec2(sc.x, 8.0));
      vec2 f = vec2(fract(sp.x) - 0.5, fract(sp.y) - 0.5 - 0.15 * (hash(vec2(sc.x, 4.0)) - 0.5));
      float r = length(f * vec2(1.0 / w, 1.5 - 0.4 * hash(vec2(sc.x, 6.0))));
      float stone = smoothstep(0.55, 0.4, r);
      vec3 rock = mix(vec3(0.03, 0.03, 0.04), vec3(0.16, 0.14, 0.13), stone * smoothstep(-0.3, 0.35, f.y));
      // wet: a bright line of the lanterns' light along each stone's crown
      rock += vec3(0.5, 0.3, 0.14) * stone * smoothstep(0.05, 0.3, f.y) * 0.45;
      col = rock;
    } else {
      // milky hot water, darker near you, the sky's light on it toward the far rim
      col = mix(vec3(0.05, 0.08, 0.1), vec3(0.16, 0.2, 0.24), smoothstep(0.0, 0.13, uv.y));
    }
  }

  // the inn's posts at either side of the view, and the eave across the top with its bamboo blind half let down
  float post = step(half_ - 0.05, abs(uv.x)) * step(abs(uv.x), half_ - 0.012);
  vec3 wood = vec3(0.13, 0.08, 0.05) * (0.8 + 0.3 * noise(vec2(uv.x * 40.0, uv.y * 2.0)));
  col = mix(col, wood, post);
  if (uv.y > 0.955) { col = wood * 0.8; }
  float blind = step(0.9, uv.y) * step(uv.y, 0.955);
  col = mix(col, vec3(0.32, 0.22, 0.12) * (0.75 + 0.25 * step(0.4, fract(uv.y * 260.0))), blind * 0.92);

  // the lanterns: on the posts, on the far railing, and low by the bath; their light over everything near them
  vec3 warm = vec3(1.0, 0.62, 0.28);
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    vec2 c; float s;
    if (k == 0) { c = vec2(-half_ + 0.1, 0.7); s = 0.03; }
    else if (k == 1) { c = vec2(half_ - 0.1, 0.66); s = 0.03; }
    else if (k == 2) { c = vec2(-half_ * 0.35, 0.3); s = 0.016; }
    else if (k == 3) { c = vec2(half_ * 0.3, 0.31); s = 0.016; }
    else if (k == 4) { c = vec2(-half_ + 0.2, 0.17); s = 0.026; }
    else { c = vec2(half_ - 0.22, 0.165); s = 0.026; }
    vec3 l = lantern(uv, c, s, t, fk);
    // the light it throws: a bright core round it and a broad warm pool on everything near
    float dl = length((uv - c) / s);
    col += warm * (exp(-dl * 0.9) * 0.45 + exp(-dl * 0.18) * 0.22) * (0.9 + 0.1 * noise(vec2(t * 0.8, fk * 7.0)));
    col = mix(col, vec3(0.1, 0.06, 0.03), l.y);
    col = mix(col, vec3(1.0, 0.82, 0.55) * (0.85 + 0.25 * l.z), l.z);
    // its light on the water below it, a broken gold column
    float below = step(uv.y, min(c.y - s, 0.13)) * exp(-abs(uv.x - c.x + sin(uv.y * 160.0 + t * 0.8) * 0.004) / (s * 1.6));
    col += warm * below * (0.5 + 0.5 * smoothstep(-0.2, 0.8, sin(uv.y * 420.0 - t * 1.4))) * 0.4;
  }

  // steam off the water, rising and curling slowly, thinning as it climbs
  vec2 sp = vec2(uv.x * 2.5, uv.y * 2.0 - t * 0.04);
  float steam = fbm(sp + vec2(fbm(sp + t * 0.02), 0.0) * 0.8);
  // the inn's own warmth on the air low down, where the bath and its lanterns are
  col += vec3(0.35, 0.18, 0.07) * smoothstep(0.45, 0.05, uv.y) * 0.25;
  col += vec3(0.8, 0.76, 0.72) * smoothstep(0.38, 0.62, steam) * smoothstep(0.5, 0.12, uv.y) * smoothstep(0.04, 0.14, uv.y) * 0.55;

  // snow, two depths falling slowly and swaying
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float n = 34.0 - fl * 12.0;
    vec2 p = uv * n + vec2(sin(t * 0.3 + uv.y * 4.0 + fl * 2.0) * 0.4, t * (0.5 + fl * 0.3));
    vec2 c = floor(p);
    vec2 f = fract(p) - 0.5 - (hash2(c + fl * 7.0) - 0.5) * 0.6;
    float flake = smoothstep(0.06 + fl * 0.03, 0.0, length(f)) * step(0.9, hash(c + fl * 19.0));
    col = mix(col, vec3(0.92, 0.94, 1.0), flake * (0.5 + fl * 0.3));
  }

  vec2 q = px / u_res;
  col *= mix(0.7, 1.0, smoothstep(1.2, 0.35, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const onsenScene: SceneMaker = (back) => shaderScene(back, FRAGMENT);
