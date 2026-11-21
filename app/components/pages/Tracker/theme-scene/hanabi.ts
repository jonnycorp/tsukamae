import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Hanabi: a summer matsuri on a river at night. The far bank's town low and dark, a taiko bridge arched over the water
// hung with chōchin, the near bank's stone edge lined with andon on posts and a few people sat in yukata watching; the
// lanterns' light pooling round them and laid in long columns on the water. Fireworks, two ways:
// - Hanabi: on screen, but few and slow: a shell now and then climbs, opens into a wide chrysanthemum, its stars
//   drooping as they fade; mirrored, broken, in the river
// - Hanabi 2: off screen, as anime shows them: the bursts are above the top edge, only their light seen, flaring in
//   their colour over the sky, catching the tops of the roofs and the bridge and the watchers, laid on the water, and
//   dying away, the smoke they leave drifting lit
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm (vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float segment (vec2 p, vec2 a, vec2 b) { vec2 pa = p - a; vec2 ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float box (vec2 p, vec2 c, vec2 s) { vec2 d = abs(p - c) - s; return max(d.x, d.y); }

const float PERIOD = 8.0;

vec3 shellColour (float n) {
  float k = floor(hash(vec2(n, 7.0)) * 4.0);
  return k < 1.0 ? vec3(1.0, 0.78, 0.4) : k < 2.0 ? vec3(1.0, 0.38, 0.32) : k < 3.0 ? vec3(0.45, 0.95, 0.75) : vec3(1.0, 0.55, 0.85);
}

// shell s's state now: its cycle (x), its age since the burst (y, below zero while it climbs), and where it bursts (zw)
vec4 shell (float s, float t, float half_) {
  float tt = t + s * PERIOD * 0.5 + 3.0;
  float n = floor(tt / PERIOD) * 2.0 + s;
  float age = mod(tt, PERIOD) - 1.4;
  vec2 at = vec2((hash(vec2(n, 1.0)) - 0.5) * half_ * 1.5, 0.66 + 0.2 * hash(vec2(n, 2.0)));
  return vec4(n, age, at);
}

// the fireworks' light at p: the shells' stars and trails
vec3 fireworks (vec2 p, float t, float half_) {
  vec3 c = vec3(0.0);
  for (int s = 0; s < 2; s++) {
    vec4 sh = shell(float(s), t, half_);
    float n = sh.x;
    float age = sh.y;
    vec2 at = sh.zw;
    vec3 tint = shellColour(n);
    // climbing: a thin wavering spark rising to the burst
    if (age < 0.0) {
      float k = clamp(1.0 + age / 1.4, 0.0, 1.0);
      vec2 head = vec2(at.x + sin(k * 9.0) * 0.004, 0.42 + (at.y - 0.42) * (1.0 - (1.0 - k) * (1.0 - k)));
      float d = segment(p, head, head - vec2(0.0, 0.05));
      c += vec3(1.0, 0.85, 0.6) * (exp(-d * 400.0) * 0.8 + exp(-length(p - head) * 120.0));
      continue;
    }
    float r = 0.13 + 0.07 * hash(vec2(n, 3.0));
    // the burst's flash, and the sky lit round it
    c += tint * exp(-length(p - at) * 9.0) * exp(-age * 2.5) * 0.5;
    if (age > 4.5 || length(p - at) > r * 1.25 + 0.06 + age * age * 0.025) { continue; }
    float fade = exp(-age * 0.75) * smoothstep(4.5, 3.0, age);
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float a = fi / 32.0 * 6.2832 + hash(vec2(n, fi)) * 0.12;
      float sp = r * (0.88 + 0.12 * hash(vec2(fi, n)));
      vec2 dir = vec2(cos(a), sin(a));
      float out_ = 1.0 - exp(-age * 2.2);
      float out0 = 1.0 - exp(-max(age - 0.2, 0.0) * 2.2);
      vec2 star = at + dir * sp * out_ - vec2(0.0, 0.025 * age * age);
      vec2 tail = at + dir * sp * out0 - vec2(0.0, 0.025 * max(age - 0.2, 0.0) * max(age - 0.2, 0.0));
      float d = segment(p, tail, star);
      // the stars twinkle as they go out
      float tw = mix(1.0, step(0.5, hash(vec2(fi, floor(t * 14.0)))), smoothstep(2.4, 3.2, age));
      c += mix(tint, vec3(1.0, 0.95, 0.85), exp(-age * 1.5)) * (exp(-d * 700.0) * 0.55 + exp(-length(p - star) * 260.0) * 0.9) * fade * tw;
    }
  }
  return c;
}

// the off-screen bursts' light at p: each a flare from above the top edge in its colour, rising fast, dying slowly
vec3 flashes (vec2 p, float t, float half_) {
  vec3 c = vec3(0.0);
  for (int s = 0; s < 2; s++) {
    vec4 sh = shell(float(s), t, half_);
    float age = sh.y;
    if (age < 0.0) { continue; }
    vec2 src = vec2(sh.z, 1.25);
    float glow = smoothstep(0.0, 0.08, age) * exp(-age * 1.1);
    // a burst's crackle: the light stutters a little as its stars go out
    glow *= mix(1.0, 0.75 + 0.5 * hash(vec2(floor(t * 12.0), sh.x)), smoothstep(1.5, 2.2, age));
    c += shellColour(sh.x) * glow * (0.75 * exp(-length(p - src) * 1.6) + 0.08);
  }
  return c;
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float aspect = u_res.x / h;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;
  float half_ = aspect * 0.5;
  float horizon = 0.4;

#ifdef OFFSCREEN
  vec3 flash = flashes(uv, t, half_);
#else
  vec3 flash = vec3(0.0);
  // the on-screen shells light the night a little round them
  for (int s = 0; s < 2; s++) {
    vec4 sh = shell(float(s), t, half_);
    if (sh.y > 0.0) { flash += shellColour(sh.x) * exp(-sh.y * 1.6) * 0.18 * exp(-length(uv - sh.zw) * 1.5); }
  }
#endif

  // the summer night: deep indigo, warmer toward the town's glow on the horizon; a few stars
  vec3 col = mix(vec3(0.16, 0.1, 0.2), vec3(0.03, 0.04, 0.12), smoothstep(horizon, 1.0, uv.y));
  col += vec3(0.5, 0.25, 0.15) * exp(-(uv.y - horizon) * 9.0) * 0.18;
  vec2 cell = floor(px / (18.0 * u_dpr));
  vec2 spot = (cell + vec2(hash(cell), hash(cell + 3.0))) * 18.0 * u_dpr;
  float rs = hash(cell + 2.0);
  col += vec3(0.85, 0.85, 1.0) * step(0.9, rs) * smoothstep(1.4, 0.0, length(px - spot) / u_dpr) * 0.5 * smoothstep(0.55, 0.8, uv.y);
  col += flash;

  // drifting smoke, lit by whatever burst is up
  float smoke = fbm(vec2(uv.x * 2.5 - t * 0.02, uv.y * 4.0)) * smoothstep(0.5, 0.75, uv.y);
  col += (vec3(0.05, 0.05, 0.08) + flash * 1.6) * smoke * 0.35;

#ifndef OFFSCREEN
  col += fireworks(uv, t, half_);
#endif

  // the far bank's town: tiled roofs in a ragged line, a fire-watch tower, a few windows warm
  float bx = uv.x * 14.0;
  float bc = floor(bx);
  float bf = fract(bx);
  float roof = horizon + 0.02 + 0.03 * hash(vec2(bc, 4.0)) - 0.025 * abs(bf - 0.5) * step(0.4, hash(vec2(bc, 5.0)));
  float tower = box(uv, vec2(half_ * 0.35, horizon + 0.07), vec2(0.006, 0.07));
  tower = min(tower, box(uv, vec2(half_ * 0.35, horizon + 0.14), vec2(0.016, 0.008)));
  if (uv.y < roof || tower < 0.0) {
    col = vec3(0.05, 0.045, 0.08) + flash * (0.12 + 0.5 * smoothstep(roof - 0.012, roof, uv.y));
    vec2 wc = floor(vec2(uv.x * 90.0, uv.y * 120.0));
    col += vec3(1.0, 0.7, 0.35) * step(0.93, hash(wc)) * step(uv.y, roof - 0.01) * 0.6;
  }

  // the river: dark water, the sky mirrored in it broken by ripples, the lights laid on it in columns
  if (uv.y < horizon) {
    float depth = horizon - uv.y;
    vec2 ripple = vec2(sin(uv.y * 160.0 + t * 0.8 + noise(uv * 30.0) * 4.0) * 0.006 * (0.3 + depth * 4.0), 0.0);
    vec2 m = vec2(uv.x, 2.0 * horizon - uv.y) + ripple;
    col = vec3(0.03, 0.04, 0.09) + flash * 0.3;
#ifndef OFFSCREEN
    col += fireworks(m, t, half_) * 0.45 * smoothstep(0.0, 0.25, depth + 0.1);
#endif
  }

  // the taiko bridge: a high arch, its rail and posts, chōchin hung along it, all in silhouette
  vec2 bv = uv - vec2(-half_ * 0.5, horizon);
  float span = 0.38;
  float arch = 0.07 * (1.0 - pow(bv.x / span, 2.0));
  float deck = abs(bv.y - arch) - 0.008;
  float rail = abs(bv.y - arch - 0.03) - 0.003;
  float post = abs(fract(bv.x / 0.04) - 0.5) * 0.04 - 0.0025;
  float legs = max(abs(fract(bv.x / 0.12 + 0.5) - 0.5) * 0.12 - 0.004, bv.y - arch);
  float bridge = min(min(deck, rail), max(post, max(bv.y - arch - 0.03, arch - bv.y)));
  bridge = min(bridge, max(legs, -bv.y - 0.02));
  bridge = max(bridge, abs(bv.x) - span);
  if (bridge < 0.0) {
    col = vec3(0.07, 0.04, 0.06) + flash * (0.1 + 0.5 * step(arch + 0.025, bv.y));
  }

  // the lanterns: the bridge's string of chōchin and the near bank's andon on posts; each lit, its light pooled round
  // it and laid on the water below
  vec3 light = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float lx = -span + 0.04 + fi * (span * 2.0 - 0.08) / 8.0;
    vec2 lp = vec2(-half_ * 0.5 + lx, horizon + 0.07 * (1.0 - pow(lx / span, 2.0)) + 0.012);
    float fl = 0.85 + 0.15 * noise(vec2(t * 2.0, fi));
    vec3 lc = mod(fi, 2.0) < 1.0 ? vec3(1.0, 0.35, 0.2) : vec3(1.0, 0.85, 0.6);
    vec2 e = (uv - lp) / vec2(0.007, 0.01);
    if (dot(e, e) < 1.0) { col = lc * (0.8 + 0.25 * (1.0 - dot(e, e))) * fl; }
    float d = length(uv - lp);
    light += lc * fl * (exp(-d * 30.0) * 0.35);
    // its column on the water
    float cdx = abs(uv.x - lp.x + sin(uv.y * 120.0 + t) * 0.003);
    light += lc * fl * exp(-cdx * 260.0) * step(uv.y, horizon) * smoothstep(0.2, 0.0, horizon - uv.y) * 0.3 * (0.6 + 0.4 * sin(uv.y * 240.0 + t * 1.3 + fi));
  }
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 lp = vec2(-half_ + 0.1 + fi * (aspect - 0.2) / 6.0, 0.16);
    float fl = 0.88 + 0.12 * noise(vec2(t * 1.5, fi + 20.0));
    vec3 lc = vec3(1.0, 0.72, 0.42);
    // the post and the paper box on it
    float pst = box(uv, lp - vec2(0.0, 0.07), vec2(0.003, 0.05));
    float shade = box(uv, lp, vec2(0.014, 0.022));
    if (pst < 0.0) { col = vec3(0.06, 0.04, 0.04); }
    if (shade < 0.0) {
      vec2 q = (uv - lp) / vec2(0.014, 0.022);
      col = lc * fl * (0.75 + 0.25 * (1.0 - q.y * q.y));
      col *= 1.0 - 0.45 * step(abs(abs(q.y) - 0.85), 0.15) - 0.3 * step(abs(q.x), 0.05);
    }
    float d = length((uv - lp) * vec2(1.0, 1.3));
    light += lc * fl * (exp(-d * 14.0) * 0.4 + exp(-d * 40.0) * 0.25);
    float cdx = abs(uv.x - lp.x + sin(uv.y * 90.0 + t * 0.9) * 0.004);
    light += lc * fl * exp(-cdx * 120.0) * step(0.12, uv.y) * step(uv.y, horizon) * smoothstep(0.25, 0.0, uv.y - 0.12) * 0.28 * (0.6 + 0.4 * sin(uv.y * 180.0 + t * 1.1 + fi * 2.0));
  }

  // the near bank: a stone edge along the water, the grass behind it, lit by the andon
  if (uv.y < 0.12) {
    vec3 bank = mix(vec3(0.04, 0.05, 0.05), vec3(0.08, 0.07, 0.07), step(0.08, uv.y));
    float stone = step(0.08, uv.y) * step(0.004, abs(fract(uv.x * 22.0 + floor(uv.y * 50.0) * 0.5) - 0.5) * 0.045);
    bank *= 0.8 + 0.3 * stone;
    col = bank + flash * 0.18 * step(0.11, uv.y);
  }

  col += light;

  // the watchers on the bank, sat in yukata, a fan in one hand: silhouettes, their edges lit by the lanterns and the sky
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 base = vec2(half_ * (0.28 + fi * 0.1) + fi * fi * 0.01, 0.12);
    vec2 v = uv - base;
    float s = 0.9 + 0.12 * hash(vec2(fi, 30.0));
    // sat on the bank: a broad lap narrowing to the shoulders, the head above, some with their hair up
    float body = max(abs(v.x) - (0.026 - v.y * 0.17) * s, max(-v.y, v.y - 0.066 * s));
    body = min(body, length((v - vec2(0.0, 0.058 * s)) / vec2(0.016, 0.01) / s) - 1.0);
    float head = length(v - vec2(0.002, 0.08 * s)) - 0.011 * s;
    float bun = length(v - vec2(-0.006, 0.093 * s)) - 0.006 * s * step(0.5, hash(vec2(fi, 31.0)));
    float fig = min(min(body, head), bun);
    float obi = step(abs(v.y - 0.034 * s), 0.005 * s) * step(body, 0.0);
    if (fig < 0.0) {
      vec3 yukata = mod(fi, 2.0) < 1.0 ? vec3(0.08, 0.08, 0.16) : vec3(0.14, 0.06, 0.08);
      yukata = mix(yukata, vec3(0.35, 0.12, 0.1), obi);
      col = yukata + light * 0.25 + (light * 1.2 + flash * 0.4) * smoothstep(-0.006, 0.0, fig) * step(base.y + 0.04, uv.y);
    }
  }

  vec2 q = px / u_res;
  col *= mix(0.72, 1.0, smoothstep(1.2, 0.35, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const hanabiScene: SceneMaker = (back) => shaderScene(back, FRAGMENT);
export const hanabiFarScene: SceneMaker = (back) => shaderScene(back, `#define OFFSCREEN\n${FRAGMENT}`);
