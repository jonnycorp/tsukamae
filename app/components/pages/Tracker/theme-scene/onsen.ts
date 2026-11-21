import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Onsen: an open-air hot spring on a winter night, painted (public/themes/onsen): snowy rocks round the pool, cherry
// trees and a mountain behind, stone lanterns and shōji windows lit along the far side. The painting holds still; the
// scene lives in it: the pool's surface moves in perspective, passing between three states of its water and bending
// what it reflects, each snowflake that lands on it leaving a ring; steam rises off it in sheets, near and far, lit by
// the lanterns where it passes them; snow falls through all of it at every depth, behind the gazebo's pillar and the
// rocks as well as in front; one wind moves the snow and the steam together; the lights flicker each on its own
//
// u_picture0 the painting, its air clear; u_picture1, 2 the same pool in two other states of ripple; u_picture3 the
// lights alone (the lit painting less its unlit twin); u_picture4 maps: R where the water is, G depth (1 nearest),
// B the lights' glow, wide and soft; u_picture5 steam on black, its sheet rising from the bottom
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

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

// the pool's surface on its own plane (P: across and away, in the water's own units): long swells crossing, a finer
// chop over them, all drifting with the wind
float swell (vec2 p, float t, float wind) {
  return noise(p * vec2(0.9, 1.6) + vec2(t * 0.12 + wind * t * 0.05, -t * 0.32)) * 0.55
    + noise(p * vec2(2.1, 2.6) + vec2(-t * 0.22, t * 0.18)) * 0.3
    + noise(p * vec2(4.7, 5.3) + vec2(t * 0.45, -t * 0.4)) * 0.15;
}

// where a snowflake landed: a ring spreading from it and dying away, its slope (on P) to bend the surface by
vec2 rings (vec2 p, float t) {
  vec2 cell = floor(p);
  float r = hash(cell + 5.0);
  float period = 3.0 + 7.0 * r;
  float age = fract(t / period + r * 7.0) * period;
  vec2 at = 0.3 + 0.4 * vec2(hash(cell + 1.0), hash(cell + 2.0));
  vec2 d = p - cell - at;
  float dist = length(d) + 1e-4;
  float w = (dist - age * 0.16) * 38.0;
  float env = exp(-age * 1.3) * smoothstep(0.45, 0.25, dist);
  return d / dist * sin(clamp(w, -9.42, 9.42)) * exp(-w * w / 24.0) * env;
}

// a sheet of steam rising from bottom (on the painting, 0 top to 1 bottom) up to height, stood at depth: shown only
// in front of what's farther off than it. Its wisps rise and curl (the sheet's own shapes pulled upward through a
// rising noise) and drift with the wind; its texture mirrored end to end, so it repeats with no seam
float steamSheet (vec2 iuv, float bottom, float height, float across, float seed, float t, float wind, float depth, float at) {
  float y = (bottom - iuv.y) / height;
  if (y < -0.05 || y > 1.0) {
    return 0.0;
  }
  vec2 q = vec2(iuv.x * across + seed + t * (0.006 + 0.02 * wind), y);
  vec2 curl = vec2(noise(q * vec2(3.0, 2.5) + vec2(seed, -t * 0.22)), noise(q * vec2(2.5, 3.0) + vec2(-seed, -t * 0.18))) - 0.5;
  q += curl * vec2(0.12, 0.1);
  float x = 1.0 - abs(fract(q.x * 0.5) * 2.0 - 1.0);
  float s = texture2D(u_picture5, vec2(x, clamp(q.y, 0.0, 1.0))).r;
  // breathing: the sheet thickens and thins along its length, slowly
  s *= 0.65 + 0.7 * noise(vec2(iuv.x * 3.0 + seed - t * 0.03, t * 0.05 + seed));
  return s * smoothstep(-0.05, 0.12, y) * smoothstep(at + 0.06, at - 0.02, depth);
}

// snow: three layers of flakes, far ones small, slow and faint, near ones larger; each at its own depth, so hidden
// behind whatever stands nearer (the pillar, the rocks, the pool's own surface where it's fallen in). All drift with
// the wind
float snow (vec2 px, float h, float t, float wind, float depth) {
  float a = 0.0;
  for (int l = 0; l < 3; l++) {
    float fl = float(l) / 2.0;
    float at = mix(0.3, 0.97, fl);
    if (depth > at + 0.02) {
      continue;
    }
    float cells = mix(22.0, 8.0, fl);
    vec2 p = px / h * cells;
    float fall = t * mix(0.022, 0.06, fl) * cells;
    p.y += fall;
    p.x -= wind * fall * 0.6;
    p.x += sin(t * 0.25 + p.y * 0.35 + fl * 4.0) * 0.35;
    vec2 c = floor(p);
    float r = hash(c + fl * 17.0);
    if (r < mix(0.5, 0.32, fl)) {
      vec2 o = vec2(hash(c + 3.1), hash(c + 7.7)) * 0.8 + 0.1;
      o.x += sin(t * (0.4 + r) + r * 6.28) * 0.08;
      float d = length(fract(p) - o) / cells * h;
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
  // the same point on the painting, 0–1 from its top left
  vec2 iuv = u_crop.xy + vec2(uv.x, 1.0 - uv.y) * u_crop.zw;
  vec3 maps = texture2D(u_picture4, uv).rgb;
  float water = maps.r;
  float depth = maps.g;
  float glow = maps.b;
  // one wind for the snow and the steam: mostly a light breeze, now and then a slow gust
  float wind = 0.2 + 0.8 * smoothstep(0.55, 0.9, noise(vec2(t * 0.05, 3.0)));

  // the pool: its surface on its own plane, nearer water larger, so its swells widen toward you
  float near = smoothstep(0.57, 1.0, iuv.y);
  vec2 stir = vec2(0.0);
  vec2 slope = vec2(0.0);
  if (water > 0.0) {
    float z = 1.0 / max(iuv.y - 0.47, 0.03);
    vec2 P = vec2((iuv.x - 0.5) * z * 1.6, z * 2.0);
    float h0 = swell(P, t, wind);
    slope = vec2(swell(P + vec2(0.04, 0.0), t, wind) - h0, swell(P + vec2(0.0, 0.04), t, wind) - h0) / 0.04;
    slope += rings(P * 1.2, t) * 2.2;
    stir = vec2(slope.x, slope.y * 0.4) * mix(0.0016, 0.0075, near) * water;
  }

  vec3 calm = texture2D(u_picture0, uv + stir).rgb;
  vec3 col = calm;
  if (water > 0.0) {
    // the water passing between its states: patches of it calm, patches stirred, drifting
    float k1 = smoothstep(0.3, 0.75, noise(iuv * vec2(4.0, 9.0) + vec2(t * 0.04, -t * 0.07)));
    float k2 = smoothstep(0.35, 0.8, noise(iuv * vec2(5.0, 10.0) + vec2(-t * 0.05, t * 0.04) + 7.0));
    vec3 w = mix(calm, texture2D(u_picture1, uv + stir * 1.3).rgb, k1);
    w = mix(w, texture2D(u_picture2, uv + stir * 1.3).rgb, k2 * (1.0 - 0.5 * k1));
    col = mix(calm, w, water);
  }
  vec3 light = texture2D(u_picture3, uv + stir).rgb;
  float flame = flicker(iuv.x, t);
  col += light * (flame - 1.0);
  // the surface catching the lanterns where it tilts toward you
  vec3 warm = vec3(1.0, 0.72, 0.42);
  col += warm * glow * water * pow(clamp(0.5 - slope.y * 0.6, 0.0, 1.0), 6.0) * 0.35 * flame;

  // the sky: the clouds' moonlit edges brightening and dimming as they pass
  float sky = (1.0 - smoothstep(0.02, 0.08, depth)) * (1.0 - smoothstep(0.3, 0.45, iuv.y));
  if (sky > 0.0) {
    float c = noise(iuv * vec2(3.0, 7.0) + vec2(t * 0.012, 0.0)) * 0.6 + noise(iuv * vec2(7.0, 14.0) + vec2(t * 0.02, 1.0)) * 0.4;
    col *= mix(1.0, 0.8 + 0.4 * c, sky);
  }

  // steam: a sheet off the far water, one mid-pool and one close by; the far behind the pillar and the near rocks
  vec3 vapour = vec3(0.42, 0.47, 0.56) + warm * glow * 0.9 + light * 0.6;
  float far = steamSheet(iuv, 0.66, 0.3, 1.3, 0.0, t, wind, depth, 0.62);
  float mid = steamSheet(iuv, 0.9, 0.38, 0.95, 3.7, t, wind, depth, 0.8);
  col = mix(col, vapour, clamp(far * 0.85 + mid * 0.6, 0.0, 0.85));

  // the snow, among it all, lit warm near a light
  float s = snow(gl_FragCoord.xy, u_res.y, t, wind, depth);
  col = mix(col, vec3(0.82, 0.87, 0.96) + light * 1.2 + warm * glow * 0.5, s);

  // and the nearest steam, thin, in front of everything
  float close = steamSheet(iuv, 1.12, 0.45, 0.7, 8.1, t, wind, depth, 1.1);
  col = mix(col, vapour, close * 0.4);

  gl_FragColor = vec4(col, 1.0);
}
`;

// the top of the painting kept in view as a wide window crops it, for its sky and mountain over the boxes
const ANCHOR: [number, number] = [0.5, 0.3];

export const onsenScene: SceneMaker = (canvas) => shaderScene(canvas, FRAGMENT, undefined, [
  { src: '/themes/onsen/scene.webp', anchor: ANCHOR },
  { src: '/themes/onsen/ripple-1.webp', anchor: ANCHOR },
  { src: '/themes/onsen/ripple-2.webp', anchor: ANCHOR },
  { src: '/themes/onsen/light.webp', anchor: ANCHOR },
  { src: '/themes/onsen/maps.webp', anchor: ANCHOR },
  { src: '/themes/onsen/steam.webp', anchor: ANCHOR },
]);
