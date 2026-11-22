import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Onsen: an open-air hot spring on a winter night, painted (public/themes/onsen): snowy rocks round the pool, cherry
// trees and a mountain behind, stone lanterns and shōji windows lit along the far side. The painting holds still; the
// scene lives in it. The pool is a surface in perspective, its waves running with the breeze and gathering where a gust
// brushes it, a slow boil under them and rings where snow lights on it; the lights mirror in it about the far shore,
// broken by its waves into glints and streaks as real reflections are, the painting's own reflections moving with it.
// Steam rises off it at every depth: a low bank along the far shore, plumes born across the water that lift, swell,
// curl and thin away, and wisps drifting over the near water, each lit by the lanterns it passes and hidden behind
// whatever stands nearer than it. Snow falls through all of it at every depth, behind the gazebo's pillar and the rocks
// as well as in front. One wind carries the snow and the steam together; the lights flicker each on its own
//
// u_picture0 the painting, its water clear of the lights' reflections; u_picture1 the lights alone (the lit painting
// less its unlit twin); u_picture2 maps: R where the water is, G the painting's y (0 top, 1 bottom) of the water's edge
// at or below each point, how near what stands there is, B the lights' glow, wide and soft; u_picture3, 4, 5 sheets
// of steam on black, a low bank, rising plumes and thin wisps, each rising off its bottom edge
const FRAGMENT = `
const float TAU = 6.2831853;
// the painting's horizon, where the pool's plane would meet the sky (0–1 down it), and its width over its height
const float HORIZON = 0.48;
const float ASPECT = 1.7769;

// a hash by multiplication alone (no sine), so it stays sound however far the clock has run
float hash (vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// a point on the painting as the window shows it, to read a picture fitted over the window there
vec2 shown (vec2 p) {
  vec2 s = (p - u_crop.xy) / u_crop.zw;
  return vec2(s.x, 1.0 - s.y);
}

// the far shore, where the water meets the rocks and lanterns along it: the line their reflections mirror about
float shore (float x) { return 0.548 + 0.17 * (x - 0.52) * (x - 0.52); }

// how far the wind has carried things by t: 0.3 of a unit a second on average, faster in a gust, never back
float carried (float t) { return t * 0.3 + 2.65 * noise(vec2(t * 0.06, 3.0)); }

// one light across the painting (centred at cx, as wide as w): how bright it burns now, a little under full as a flame
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

// The pool's surface, on its own plane: P across and away from the eye, in heights of the eye above the water (about
// 1.2 m); fp a pixel's footprint there, across and away; dxv how far off to the side it's seen. Each part gives its
// slope there, leaving out waves too fine for a pixel to show, so they don't flicker

// wave trains from long low swells to short ripples, most running with the breeze (to the right and away), the short
// ones gathered where a gust brushes the water; each at its own speed, as deep water's waves run. Of the waves left
// out, the spread of slopes they'd give (spread: its square, across and up the reflection); and the slope of the
// broad waves alone (broad), to move what's soft by
vec2 waves (vec2 P, vec2 fp, float dxv, float t, float gust, inout vec2 spread, inout vec2 broad) {
  vec2 slope = vec2(0.0);
  for (int i = 0; i < 24; i++) {
    float fi = float(i) / 23.0;
    float k = TAU / (0.75 * pow(0.05 / 0.75, fi));
    // spread about the breeze by the golden angle, the short ones wider
    float a = 0.5 + sin(float(i) * 2.39996) * mix(0.7, 1.6, fi);
    vec2 dir = vec2(cos(a), sin(a));
    float km = k / 1.2;
    float omega = sqrt(9.81 * km + 7.4e-5 * km * km * km) * 0.5;
    float steep = 0.015 * (1.0 + 0.3 * sin(float(i) * 1.7)) * mix(1.0, mix(0.25, 1.1, gust), smoothstep(0.2, 0.6, fi));
    float ph = k * dot(dir, P) - mod(omega * t, TAU) + float(i) * 2.1;
    float up = dir.x * dxv + dir.y;
    float span = k * max(abs(dir.x) * fp.x, abs(up) * fp.y) / TAU;
    float seen = 1.0 - smoothstep(0.12, 0.35, span);
    slope += dir * (steep * cos(ph) * seen);
    broad += dir * (steep * cos(ph) * (1.0 - smoothstep(0.03, 0.08, span)));
    spread += steep * steep * 0.5 * (1.0 - seen) * vec2(dir.x * dir.x, up * up);
  }
  return slope;
}

// gradient noise's gradient at a lattice point, turning with t
vec2 turn (vec2 c, float t) {
  float a = hash(c) * TAU + t * (hash(c + 9.7) - 0.5) * 1.2;
  return vec2(cos(a), sin(a));
}

// the boil where the spring wells up: gradient noise whose gradients turn, so the surface heaves and settles in place
// rather than running anywhere; its slope
vec2 boil (vec2 P, vec2 fp, float dxv, float t) {
  vec2 p = P * 1.4;
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = turn(i, t);
  vec2 gb = turn(i + vec2(1.0, 0.0), t);
  vec2 gc = turn(i + vec2(0.0, 1.0), t);
  vec2 gd = turn(i + vec2(1.0, 1.0), t);
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  vec2 g = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va);
  float span = 1.4 * max(fp.x, fp.y * (1.0 + abs(dxv)));
  return g * 0.014 * (1.0 - smoothstep(0.15, 0.4, span));
}

// where snowflakes light on the water: a ring spreading from each and dying away within its cell (half an eye height
// across), its slope
vec2 rings (vec2 P, vec2 fp, float t) {
  vec2 q = P * 2.0;
  vec2 cell = floor(q);
  float r = hash(cell + 5.0);
  float period = 2.5 + 6.0 * r;
  float age = fract(t / period + r * 7.0) * period;
  vec2 at = 0.3 + 0.4 * vec2(hash(cell + 1.0), hash(cell + 2.0));
  vec2 d = q - cell - at;
  float dist = length(d) + 1e-4;
  float w = (dist - 0.02 - age * 0.16) * 45.0;
  float env = exp(-age * 2.2) * smoothstep(0.28, 0.12, dist);
  float span = 2.0 * 45.0 * max(fp.x, fp.y) / TAU;
  return d / dist * sin(clamp(w, -9.42, 9.42)) * exp(-w * w / 20.0) * env * 0.05 * (1.0 - smoothstep(0.2, 0.45, span));
}

// how much of the lights shines back off the water at ip (P on its plane): the lights mirrored about the far shore,
// the mirror moved by the surface's tilt (dx across, dy up the painting) as far as the reflection has to reach (the
// nearer the water, the farther), and spread up and down by the slopes too fine to see (blur, on the painting): half
// as a soft column, half as glints, the fine ripples catching the light here and there in narrow bands across the
// water, a little higher or lower up the mirror in each, changing as they run. Only what stands along the far side
// reflects: not the water's own lights, nor the gazebo's roof over the near water. Grazing water mirrors most
vec3 reflection (vec2 ip, vec2 P, float y0, float dx, float dy, float blur, float t) {
  float x = ip.x + dx;
  float y = 2.0 * y0 - ip.y - dy;
  float glint = noise(P * vec2(5.0, 28.0) + vec2(t * 0.9, -t * 2.3)) * 2.0 - 1.0;
  vec3 soft = vec3(0.0);
  vec3 sharp = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float o = float(i) / 4.0 - 1.0;
    float ys = y + o * blur * 2.0;
    float from = smoothstep(0.3, 0.36, ys) * (1.0 - smoothstep(y0 - 0.005, y0 + 0.01, ys));
    soft += texture2D(u_picture1, shown(vec2(x, ys))).rgb * from * exp(-o * o * 2.0) / 4.9;
  }
  for (int i = 0; i < 3; i++) {
    float ys = y + (glint * 1.6 + float(i - 1) * 0.15) * blur;
    float from = smoothstep(0.3, 0.36, ys) * (1.0 - smoothstep(y0 - 0.005, y0 + 0.01, ys));
    sharp += texture2D(u_picture1, shown(vec2(x, ys))).rgb * from / 3.0;
  }
  return (soft + sharp) * 0.5 * flicker(x, t) * mix(0.9, 0.35, smoothstep(0.58, 1.0, ip.y));
}

// a sheet of steam at q: across it (mirrored end to end, so it tiles with no seam) and up it from its bottom edge (0)
// to its top (1), read at a level of its mipmaps (lod)
float sheet (sampler2D s, vec2 q, float lod) {
  return texture2DLodEXT(s, vec2(1.0 - abs(fract(q.x * 0.5) * 2.0 - 1.0), clamp(q.y, 0.0, 1.0)), lod).r;
}

// a row of plumes rising off the water where it lies at yb on the painting, in perspective (tall: how tall they grow,
// in eye heights), the row carried as far as the wind has carried things (drift): each born at its own place and time,
// lifting and swelling as it rises, its top leaning downwind (wind: how hard it blows now) and its steam curling,
// thinning away after 18–28 s. d: a pixel's height on the painting. At ip, the steam's density
float plumes (vec2 ip, float yb, float tall, float seed, float t, float drift, float wind, float d) {
  float h = (yb - HORIZON) * tall;
  float w = h * 0.8;
  float gap = w * 0.75;
  float x = ip.x * ASPECT - drift * (yb - HORIZON) * 0.6;
  float c0 = floor(x / gap);
  float lod = log2(1024.0 * d / h) + 1.0;
  float acc = 0.0;
  // the plumes whose places are near enough to reach here, as far as one leaning downwind
  for (int i = -2; i <= 1; i++) {
    float c = c0 + float(i);
    float life = 18.0 + 10.0 * hash(vec2(c, seed));
    float clock = t / life + hash(vec2(c, seed + 1.0));
    float f = fract(clock);
    // this life's own draw: where in its place it stands and what part of the sheet it shows
    float g = hash(vec2(c + floor(clock) * 7.31, seed + 2.0));
    float ly = (yb - ip.y) / (h * mix(0.7, 1.15, f)) - f * 0.18;
    float lx = (x - (c + 0.5 + (g - 0.5) * 0.4) * gap) / (w * mix(0.85, 1.2, f));
    lx -= wind * 0.35 * ly * ly;
    // eddies rising through it
    vec2 eddy = vec2(noise(vec2(ly * 2.5 - t * 0.16, g * 17.0)), noise(vec2(lx * 2.5 + g * 5.0, ly * 2.0 - t * 0.14))) - 0.5;
    lx += eddy.x * 0.25 * ly;
    ly += eddy.y * 0.06;
    float s = sheet(u_picture4, vec2(0.15 + 0.7 * g + lx * 0.45, ly * 0.9), lod);
    float env = smoothstep(0.52, 0.2, abs(lx)) * smoothstep(-0.05, 0.15, ly) * smoothstep(1.0, 0.5, ly);
    acc += s * env * smoothstep(0.0, 0.3, f) * smoothstep(1.0, 0.6, f);
  }
  return acc;
}

// a band of steam along the water at yb, in perspective (tall: how high it stands, in eye heights; wide: how much wider
// than its own shape the sheet's drawn): carried downwind and rising through itself, renewed by two phases each
// fading in and out half a period (in seconds) apart, the phases offset along the band so it never renews all at once.
// At ip, the steam's density
float band (sampler2D s, vec2 ip, float yb, float tall, float wide, float period, float seed, float t, float drift, float d) {
  float h = (yb - HORIZON) * tall;
  float y = (yb - ip.y) / h;
  float x = (ip.x * ASPECT - drift * (yb - HORIZON) * 0.6) / (h * ASPECT * wide);
  float lod = log2(1024.0 * d / h) + 1.0;
  float lag = noise(vec2(x * 1.2, seed)) * 0.6;
  float acc = 0.0;
  for (int k = 0; k < 2; k++) {
    float clock = t / period + float(k) * 0.5 + lag;
    float ph = fract(clock);
    vec2 q = vec2(x + hash(vec2(floor(clock), seed + float(k))) * 3.0, y - (ph - 0.5) * 0.18);
    acc += sheet(s, q, lod) * (1.0 - abs(ph * 2.0 - 1.0));
  }
  return acc * smoothstep(-0.08, 0.1, y) * smoothstep(1.0, 0.6, y);
}

// steam standing at yb is shown only before what's farther off than it (contact: how near what's at a pixel stands),
// give or take a margin where the shore's edge is ragged
float before (float contact, float yb, float margin) {
  return smoothstep(yb + margin + 0.012, yb + margin, contact);
}

// one layer of snow, a flake in some of a grid's cells (cells: its rows to the window's height), falling (speed: in
// window heights a second) and carried across by the wind (sway: as far as it's carried things), each so many pixels
// across (size) and so bright; each lands on the painting between near and far, shown only above where it lands and
// before what stands nearer than that
float flakes (vec2 px, float h, float iy, float contact, float t, float drift, float cells, float speed, float sway, float size, float bright, float near, float far, float seed) {
  vec2 p = px / h * cells;
  p.y += t * speed * cells;
  p.x -= drift * sway * cells;
  p.x += sin(t * 0.25 + p.y * 0.35 + seed) * 0.35;
  vec2 c = floor(p);
  float r = hash(c + seed);
  if (r > 0.42) {
    return 0.0;
  }
  vec2 o = vec2(hash(c + 3.1 + seed), hash(c + 7.7 + seed)) * 0.8 + 0.1;
  o.x += sin(t * (0.4 + r) + r * 6.28) * 0.08;
  float dist = length(fract(p) - o) / cells * h;
  float land = mix(far, near, hash(c + 11.3 + seed));
  return smoothstep(size * u_dpr, 0.0, dist) * bright * step(iy, land) * step(contact, land + 0.03);
}

void main () {
  if (u_loaded < 0.5) {
    gl_FragColor = vec4(0.04, 0.05, 0.09, 1.0);
    return;
  }
  float t = u_time;
  vec2 uv = gl_FragCoord.xy / u_res;
  // the same point on the painting, 0–1 from its top left, and a pixel's height there
  vec2 ip = u_crop.xy + vec2(uv.x, 1.0 - uv.y) * u_crop.zw;
  float d = u_crop.w / u_res.y;
  vec3 maps = texture2D(u_picture2, uv).rgb;
  float water = maps.r;
  // on the water, its own place (the map's blurred at the edges of what stands in it)
  float contact = mix(maps.g, ip.y, water);
  float glow = maps.b;
  float drift = carried(t);
  float wind = carried(t + 0.5) - carried(t - 0.5);

  vec3 light = texture2D(u_picture1, uv).rgb;
  float flame = flicker(ip.x, t);
  vec3 col = texture2D(u_picture0, uv).rgb + light * (flame - 1.0) * (1.0 - water);

  if (water > 0.0) {
    // the surface here: P on its plane, nearer water larger
    float z = 1.0 / max(ip.y - HORIZON, 0.02);
    vec2 P = vec2((ip.x - 0.5) * ASPECT * z, z);
    vec2 fp = vec2(z * d, z * z * d);
    float dxv = (ip.x - 0.5) * ASPECT;
    float gust = smoothstep(0.45, 0.85, noise(P * vec2(0.12, 0.2) - vec2(0.88, 0.48) * drift * 0.3));
    vec2 spread = vec2(0.0);
    vec2 heave = boil(P, fp, dxv, t);
    vec2 broad = heave;
    vec2 slope = waves(P, fp, dxv, t, gust, spread, broad) + heave + rings(P, fp, t);
    // the mirror's move: up and down by the tilt toward and away, across by the tilt sideways (much less, seen
    // grazing), as far as the reflection reaches from here to the far shore
    float y0 = shore(ip.x);
    float reach = clamp(1.0 - (y0 - HORIZON) / (ip.y - HORIZON), 0.0, 1.0);
    float dy = 2.0 * dot(slope, vec2(dxv, 1.0)) * reach;
    float dx = -2.0 * (ip.y - HORIZON) * slope.x * reach / ASPECT;
    // the painting's own reflections moving with it, by its broader waves only (they're soft, and the finer would
    // fold them into grain); never reading off the water
    vec2 bs = shown(ip + vec2(-(ip.y - HORIZON) * broad.x / ASPECT, dot(broad, vec2(dxv, 1.0))) * 2.0 * reach * 0.5);
    vec3 base = mix(col, texture2D(u_picture0, bs).rgb, texture2D(u_picture2, bs).r);
    vec3 pool = base + reflection(ip, P, y0, dx, dy, 2.0 * sqrt(spread.y) * reach, t);
    col = mix(col, pool, water);
  }

  // the steam, lit cool by the night and warm where it passes the lanterns and windows
  vec3 warm = vec3(1.0, 0.72, 0.42);
  vec3 vapour = vec3(0.42, 0.47, 0.56) + warm * glow * 0.9 * flame + light * 0.5;
  float edge = shore(ip.x) + 0.012;
  float far = band(u_picture3, ip, edge, 0.9, 2.0, 22.0, 1.0, t, drift, d) * 0.45 * before(contact, edge, 0.04)
    + plumes(ip, 0.615, 1.3, 2.0, t, drift, wind, d) * 0.6 * before(contact, 0.615, 0.03)
    + plumes(ip, 0.69, 1.6, 3.0, t, drift, wind, d) * 1.3 * before(contact, 0.69, 0.015)
    + band(u_picture5, ip, 0.78, 1.4, 1.5, 24.0, 4.0, t, drift, d) * 0.3 * before(contact, 0.78, 0.015);
  col = mix(col, vapour, 1.0 - exp(-far * 1.2));

  // the snow among it all, lit warm near a light: far flakes landing by the far shore, near ones past the window
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float s = flakes(px, h, ip.y, contact, t, drift, 34.0, 0.012, 0.012, 1.0, 0.35, 0.555, 0.6, 1.0)
    + flakes(px, h, ip.y, contact, t, drift, 24.0, 0.022, 0.02, 1.4, 0.45, 0.6, 0.7, 2.0)
    + flakes(px, h, ip.y, contact, t, drift, 15.0, 0.038, 0.035, 2.0, 0.55, 0.7, 0.95, 3.0)
    + flakes(px, h, ip.y, contact, t, drift, 9.0, 0.065, 0.06, 3.2, 0.7, 1.0, 2.0, 4.0);
  col = mix(col, vec3(0.82, 0.87, 0.96) + light * 1.2 + warm * glow * 0.5, min(s, 1.0));

  // and the nearest steam, thin, before everything
  float near = plumes(ip, 0.86, 1.2, 5.0, t, drift, wind, d) * 0.35 * before(contact, 0.86, 0.015)
    + band(u_picture5, ip, 1.15, 0.8, 1.6, 28.0, 6.0, t, drift, d) * 0.3;
  col = mix(col, vapour, 1.0 - exp(-near * 1.2));

  gl_FragColor = vec4(col, 1.0);
}
`;

// the top of the painting kept in view as a wide window crops it, for its sky and mountain over the boxes
const ANCHOR: [number, number] = [0.5, 0.3];

export const onsenScene: SceneMaker = (canvas) => shaderScene(canvas, FRAGMENT, undefined, [
  { src: '/themes/onsen/scene.webp', anchor: ANCHOR },
  { src: '/themes/onsen/light.webp', anchor: ANCHOR },
  { src: '/themes/onsen/maps.webp', anchor: ANCHOR },
  { src: '/themes/onsen/steam-bank.webp', fit: 'texture' },
  { src: '/themes/onsen/steam-plumes.webp', fit: 'texture' },
  { src: '/themes/onsen/steam-wisps.webp', fit: 'texture' },
]);
