import { paintMountains } from './midnight-mountains';
import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Midnight's night: a sky from indigo down to the sunset, stars, a striped sun low over the horizon, low-poly
// mountains either side of it, and a neon grid floor running slowly toward you into a haze. Every colour
// dithered, so the long gradients never band
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  // y up from the foot, in heights; x from the centre, in heights
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float horizon = 0.3;
  float t = u_time;

  // the sky
  float sy = clamp((uv.y - horizon) / (1.0 - horizon), 0.0, 1.0);
  vec3 top = vec3(0.018, 0.016, 0.085);
  vec3 mid = vec3(0.09, 0.04, 0.26);
  vec3 low = vec3(0.62, 0.12, 0.42);
  vec3 sky = mix(low, mid, smoothstep(0.0, 0.35, sy));
  sky = mix(sky, top, smoothstep(0.3, 1.0, sy));
  // a warm band of air along the horizon
  sky += vec3(0.55, 0.22, 0.2) * exp(-sy * 14.0) * 0.55;

  // stars, thinning toward the horizon, each breathing slowly at its own pace
  vec2 cell = floor(px / (26.0 * u_dpr));
  float r = hash(cell);
  vec2 spot = (cell + vec2(hash(cell + 1.3), hash(cell + 4.1))) * 26.0 * u_dpr;
  float d = length(px - spot) / u_dpr;
  float star = step(0.82, r) * smoothstep(1.6, 0.0, d) * smoothstep(0.08, 0.6, sy);
  star *= 0.45 + 0.55 * sin(t * (0.3 + r * 0.5) + r * 40.0) * 0.5 + 0.275;
  sky += vec3(0.85, 0.8, 1.0) * star * 0.9;

  // the sun: gold at its crown to rose at its foot, slats cut through its lower half that thicken as they sink and
  // drift down slowly, and its glow on the air
  vec2 sc = vec2(0.0, horizon + 0.13);
  float sr = 0.21;
  float sd = length(uv - sc);
  float sv = clamp((uv.y - (sc.y - sr)) / (2.0 * sr), 0.0, 1.0);
  vec3 sunCol = mix(vec3(1.0, 0.18, 0.52), vec3(1.0, 0.86, 0.38), smoothstep(0.1, 0.95, sv));
  float below = clamp((sc.y + 0.02 - uv.y) / (sr + 0.02), 0.0, 1.0);
  float slat = fract((uv.y - t * 0.0025) * 38.0);
  // each slat's edges a pixel soft, so they glide rather than step
  float aa = 38.0 * u_dpr / h;
  float cut = smoothstep(below * 0.62 + aa, below * 0.62 - aa, slat) * smoothstep(0.0, aa, slat) * step(0.001, below);
  float disc = smoothstep(sr + 0.0025, sr - 0.0025, sd) * (1.0 - cut);
  vec3 col = sky;
  col += sunCol * exp(-max(sd - sr, 0.0) * 9.0) * 0.32;
  col = mix(col, sunCol, disc);

  // the low-poly mountains either side of the sun (midnight-mountains.ts), painted once a size; the sun's light
  // faint on the faces nearest it
  vec4 range = texture2D(u_paint, px / u_res);
  vec3 lit = range.rgb + sunCol * exp(-abs(uv.x) * 3.5) * 0.05;
  col = mix(col, lit, range.a);

  // the floor: a grid in perspective, its rows running toward you, fading into the haze at the horizon
  if (uv.y < horizon) {
    float y = horizon - uv.y;
    float z = 0.09 / y;
    // the camera drifts slowly from side to side rather than driving on, so no row ever runs past a gap between the
    // boxes; the floor's lines only swing a little about the sun
    float drift = sin(t * 0.045) * 0.35 + sin(t * 0.017 + 1.3) * 0.2;
    float wx = (uv.x * z + drift) * 7.0;
    float wz = z;
    // each line's distance in screen pixels, measured across it, for a crisp core and a soft glow round it: the lines
    // running toward you lie ever flatter out to the sides, and measured only sideways they'd break into dashes there
    float dx = (0.5 - abs(fract(wx) - 0.5)) * h / (z * 7.0 * u_dpr * sqrt(1.0 + uv.x * uv.x / (y * y)));
    float dz = (0.5 - abs(fract(wz) - 0.5)) * h * y * y / (0.09 * u_dpr);
    float d = min(dx, dz);
    float grid = smoothstep(1.3, 0.2, d) + exp(-d / 3.5) * 0.35;
    float fog = smoothstep(0.0, 0.11, y);
    vec3 floorCol = mix(vec3(0.2, 0.04, 0.24), vec3(0.03, 0.01, 0.07), smoothstep(0.0, 0.25, y));
    vec3 line = mix(vec3(1.0, 0.3, 0.85), vec3(0.4, 0.58, 1.0), smoothstep(0.08, 0.3, y));
    col = floorCol + line * grid * fog * 0.85;
    // the sun's light on the floor, a long soft streak under it
    col += sunCol * exp(-abs(uv.x) * 9.0) * exp(-y * 9.0) * 0.28;
    // and the haze the grid sinks into
    col = mix(col, vec3(0.7, 0.2, 0.5), (1.0 - fog) * 0.55);
  }

  // a haze lying on the horizon itself
  col += vec3(0.95, 0.35, 0.65) * exp(-abs(uv.y - horizon) * 60.0) * 0.35;

  // vignette, and a dither under every gradient
  vec2 q = px / u_res;
  col *= mix(0.72, 1.0, smoothstep(1.15, 0.35, length((q - 0.5) * vec2(1.2, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const midnightScene: SceneMaker = (back) => shaderScene(back, FRAGMENT, undefined, [], paintMountains);
