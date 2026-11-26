import { KUMO_COUNT, KUMO_GLSL, KUMO_WIDEST } from './kumo-clouds';
import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

const glsl = (v: number) => v.toFixed(2);

// the clouds' lanes, px tall, and the room kept clear inside a lane's edges; along a lane, cells this many bar
// thicknesses across, and at least this many between two clouds
const LANE = 84;
const MARGIN = 6;
const CELL = 38;
const GAP = 6;

// Wisteria's court night: deep violet lacquer, the gold waves of seigaiha laid faintly over it, and gold clouds
// (suyari-gasumi, kumo-clouds.ts) drifting left over them, near and far by turns down the window, the far ones smaller,
// dimmer and slower, none ever crossing another. Each cloud is flat gold leaf, deeper at its top bar and paler at its
// foot, and catches a light that stands still at the top left as it passes
const FRAGMENT = `
${KUMO_GLSL}

float hash (vec2 p) {
  vec3 q = fract(p.xyx * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// the cloud over a point: lanes ${LANE}px tall down the window, near (bars 9px thick, drifting 5px a second) and far (6px,
// 3px a second) by turns, each lane slid along by its own amount and cut into cells ${CELL} thicknesses across. Most
// cells hold a cloud, set off the cell's middle by some of the room round it, so it keeps ${GAP} thicknesses from the
// next and ${MARGIN}px inside its lane; along a lane the clouds come in turn, each 5 on from the last, so two alike never
// stand side by side, some turned the other way round. How much of the point it covers, how far down a three-row cloud
// the point lies (0 its top, 1 its foot), and whether it's near
vec3 cloud (vec2 px, float time) {
  vec2 at = vec2(px.x, u_res.y - px.y) / u_dpr;
  float lane = floor(at.y / ${glsl(LANE)});
  float near = mod(lane, 2.0);
  float size = mix(6.0, 9.0, near);
  vec2 p = vec2(at.x + time * mix(3.0, 5.0, near), at.y - (lane + 0.5) * ${glsl(LANE)}) / size;
  float x = p.x + hash(vec2(lane, 3.0)) * ${glsl(CELL)};
  float cell = floor(x / ${glsl(CELL)});
  float roll = hash(vec2(cell, lane));
  vec2 q = vec2(x - (cell + 0.5) * ${glsl(CELL)}, p.y);
  q -= (vec2(hash(vec2(cell + 7.0, lane)), hash(vec2(cell, lane + 7.0))) - 0.5) * vec2(${glsl(CELL - GAP - KUMO_WIDEST)}, ${glsl(LANE - 2 * MARGIN)} / size - 5.0);
  if (roll < 0.2 || abs(q.x) > ${glsl(KUMO_WIDEST / 2 + 1)} || abs(q.y) > 3.5) {
    return vec3(0.0);
  }
  float k = mod(floor(hash(vec2(lane, 9.0)) * ${glsl(KUMO_COUNT)}) + cell * 5.0, ${glsl(KUMO_COUNT)});
  q.x *= roll < 0.6 ? -1.0 : 1.0;
  return vec3(clamp(0.5 - kumo(k, q) * size * u_dpr, 0.0, 1.0), clamp(q.y / 5.0 + 0.5, 0.0, 1.0), near);
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;

  // the lacquer: violet near black, a soft sheen down from the top
  vec3 col = mix(vec3(0.05, 0.02, 0.07), vec3(0.13, 0.05, 0.17), smoothstep(0.0, 1.0, uv.y));
  col += vec3(0.25, 0.12, 0.3) * exp(-length(uv - vec2(-0.3, 1.1)) * 1.6) * 0.35;

  // the waves, faint gold, drifting left behind the clouds, slower than the farthest of them
  vec2 wp = (uv + vec2(t * 1.5 * u_dpr / h, 0.0)) * 7.0;
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

  // the clouds: gold leaf, deep at the top bar, pale at the foot, under a light standing at the top left; the far ones
  // laid thinner over the night
  vec3 c = cloud(px, t);
  float light = 0.85 + 0.3 * exp(-length(uv - vec2(-0.5, 0.95)) * 1.4);
  col = mix(col, mix(vec3(0.6, 0.43, 0.16), vec3(0.96, 0.82, 0.5), c.y) * light, c.x * mix(0.5, 0.92, c.z));

  vec2 q = px / u_res;
  col *= mix(0.7, 1.0, smoothstep(1.2, 0.4, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const kumoScene: SceneMaker = (back) => shaderScene(back, FRAGMENT);
