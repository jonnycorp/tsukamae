import { shaderScene } from './scene';

import type { FrameUniforms, SceneMaker } from './scene';

// Sky Pillar: the ancient tower off Hoenn's coast at night, its tiers rising out of a sea of cloud that fills the
// lower window, the moon high and the stars thick. Far off, Rayquaza winds slowly through the sky above the clouds,
// long and green, the yellow bands along it catching the moon, dipping into the cloud now and then and rising again.
// The cloud tops roll very slowly; the tower's high windows hold a faint glow
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2 (vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float segment (vec2 p, vec2 a, vec2 b, out float k) { vec2 pa = p - a; vec2 ba = b - a; k = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * k); }

// Rayquaza's spine this frame (below): head first; and the box it lies in
uniform vec2 u_spine[28];
uniform vec4 u_box;

// the sea of cloud's top at x: rounded billows, rank on rank, rolling slowly
float billows (float x, float base, float size, float t, float seed) {
  // big billows, each its own height, with smaller puffs heaped along their tops, so no two read alike
  float xx = x / size + t;
  float c = floor(xx);
  float f = fract(xx);
  float hgt = 0.35 + 0.65 * hash(vec2(c, seed));
  float top = size * 0.55 * hgt * sqrt(max(0.0, 1.0 - pow(f * 2.0 - 1.0, 2.0)));
  float sx = x / (size * 0.35) + t * 1.2 + 0.37;
  float sf = fract(sx);
  top += size * 0.12 * (0.4 + 0.6 * hash(vec2(floor(sx), seed + 5.0))) * sqrt(max(0.0, 1.0 - pow(sf * 2.0 - 1.0, 2.0))) * step(0.02, top);
  return base + top;
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float aspect = u_res.x / h;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;
  float half_ = aspect * 0.5;

  // the night: deep blue, lighter toward the cloud sea, thick with stars
  vec3 col = mix(vec3(0.06, 0.1, 0.2), vec3(0.01, 0.02, 0.06), smoothstep(0.3, 1.0, uv.y));
  vec2 cell = floor(px / (14.0 * u_dpr));
  vec2 spot = (cell + hash2(cell)) * 14.0 * u_dpr;
  float r = hash(cell + 2.0);
  float star = step(0.82, r) * smoothstep(1.3 * (0.6 + r), 0.0, length(px - spot) / u_dpr);
  col += vec3(0.8, 0.86, 1.0) * star * (0.45 + 0.3 * sin(t * (0.3 + r) + r * 50.0)) * smoothstep(0.35, 0.6, uv.y);
  vec2 moon = vec2(-half_ * 0.55, 0.84);
  float md = length(uv - moon);
  col += vec3(0.6, 0.7, 0.9) * exp(-md * 7.0) * 0.18;
  col = mix(col, vec3(0.96, 0.95, 0.88), smoothstep(0.03, 0.027, md) * (1.0 - smoothstep(0.03, 0.027, length(uv - moon - vec2(0.012, 0.006)))));

  // Rayquaza: a long body tapering to the tail, dark green lit by the moon along its upper edge, yellow bands set
  // along it, a pair of fins near the head and at the tail's end; far off, so a little lost in the night's haze
  if (uv.x > u_box.x && uv.y > u_box.y && uv.x < u_box.z && uv.y < u_box.w) {
    float best = 1e3;
    float along = 0.0;
    float side = 0.0;
    float fin = 1e3;
    for (int j = 1; j < 28; j++) {
      vec2 a = u_spine[j - 1];
      vec2 b = u_spine[j];
      float k;
      float d = segment(uv, a, b, k);
      float u = (float(j) - 1.0 + k) / 27.0;
      // the head broad and blunt, the body long and even, tapering only over its last third
      float w = 0.011 * (u < 0.05 ? 0.85 + u * 3.0 : 1.0 - 0.8 * smoothstep(0.6, 1.0, u));
      vec2 dir = normalize(b - a + 1e-6);
      vec2 nrm = vec2(-dir.y, dir.x);
      float sd = dot(uv - a, nrm);
      if (d - w < best) { best = d - w; along = u; side = sd / w; }
      // the fins: a pair swept back behind the head, more along the back, a broad pair at the tail's end
      if (j == 3 || j == 10 || j == 17 || j == 27) {
        float size = j == 3 ? 0.04 : j == 27 ? 0.034 : 0.022;
        for (int sgn = 0; sgn < 2; sgn++) {
          float sg = float(sgn) * 2.0 - 1.0;
          if (j != 3 && j != 27 && sg < 0.0) { continue; }
          vec2 root = b + nrm * sg * w * 0.8;
          vec2 tip = root - dir * size + nrm * sg * size * 0.6;
          float fk;
          float fd = segment(uv, root, tip, fk) - 0.006 * (1.0 - fk);
          fin = min(fin, fd);
        }
      }
    }
    float aa0 = 1.5 / h;
    if (fin < aa0) {
      col = mix(col, vec3(0.1, 0.3, 0.2), smoothstep(aa0, -aa0, fin) * 0.9);
    }
    float aa = 1.5 / h;
    if (best < aa) {
      vec3 body = mix(vec3(0.05, 0.2, 0.12), vec3(0.12, 0.42, 0.24), clamp(side * 0.5 + 0.5, 0.0, 1.0));
      // the yellow bands, rings round the body every so often
      float band = smoothstep(0.4, 0.44, abs(fract(along * 9.0) - 0.5)) * step(0.06, along) * step(along, 0.9);
      body = mix(body, vec3(0.9, 0.78, 0.25), band * 0.85);
      body = mix(body, vec3(0.12, 0.18, 0.3), 0.3);
      col = mix(col, body, smoothstep(aa, -aa, best));
    }
  }

  // the tower: tiers of old stone, each a little narrower, a ledge round each, dark doorways, the topmost broken; lit
  // on its moon side, a faint warm glow in its high windows
  float tx = half_ * 0.55;
  float x = uv.x - tx;
  float tier = floor((uv.y - 0.1) / 0.11);
  float ty = fract((uv.y - 0.1) / 0.11);
  float width = 0.085 - tier * 0.009;
  float top = 0.1 + 6.0 * 0.11 - 0.03 * step(0.0, x);
  if (uv.y > 0.1 && uv.y < top && abs(x) < width + 0.008 * step(ty, 0.12)) {
    float lit = smoothstep(width, -width, x);
    vec3 stone = mix(vec3(0.05, 0.07, 0.11), vec3(0.2, 0.24, 0.32), lit * 0.7);
    // the ledge at each tier's foot, its top edge catching the light
    stone += vec3(0.12) * step(ty, 0.12) * smoothstep(0.09, 0.12, ty);
    // doorways, arched, dark, one in each tier's face; a glow in the highest two
    vec2 dv = vec2(x, ty - 0.45) / vec2(0.016, 0.22);
    float door = step(length(vec2(dv.x, max(dv.y, 0.0))), 1.0) * step(-1.0, dv.y);
    vec3 inside = mix(vec3(0.01, 0.01, 0.02), vec3(0.9, 0.55, 0.25) * (0.8 + 0.2 * noise(vec2(t * 0.5, tier))), step(4.0, tier) * 0.6);
    col = mix(stone, inside, door);
  }

  // the sea of cloud below everything, three ranks of billows, the far pale with moonlight, the near darker
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float base = 0.3 - fk * 0.1;
    float size = 0.09 + fk * 0.06;
    float top2 = billows(uv.x, base, size, t * (0.004 + fk * 0.003), fk * 7.0);
    float edge = top2 - uv.y;
    vec3 cloud = mix(vec3(0.42, 0.5, 0.68), vec3(0.14, 0.18, 0.3), fk / 2.0);
    // each billow lit on its top, shading into its foot
    cloud *= 0.62 + 0.3 * smoothstep(base - size * 0.3, base + size * 0.5, uv.y) + 0.22 * smoothstep(size * 0.07, 0.0, edge);
    col = mix(col, cloud, smoothstep(-0.002, 0.003, edge));
  }

  vec2 q = px / u_res;
  col *= mix(0.7, 1.0, smoothstep(1.2, 0.35, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const LINKS = 28;

// where Rayquaza is along its long loop through the sky at moment s: a wide, slow figure across the upper window,
// sinking toward the cloud now and then
function path (s: number, aspect: number): [number, number] {
  return [Math.sin(s) * aspect * 0.42 + Math.sin(s * 2.3) * 0.06, 0.62 + Math.sin(s * 2 + 1) * 0.12 + Math.sin(s * 3.7) * 0.03];
}

const spine: FrameUniforms = (gl, program) => {
  const at = gl.getUniformLocation(program, 'u_spine');
  const boxAt = gl.getUniformLocation(program, 'u_box');
  const points = new Float32Array(LINKS * 2);
  return (t, aspect) => {
    const s = t * 0.022;
    let [x, y] = path(s, aspect);
    let [x0, y0, x1, y1] = [x, y, x, y];
    points.set([x, y], 0);
    for (let j = 1; j < LINKS; j++) {
      const [bx, by] = path(s - (j + 3) * 0.045, aspect);
      const len = Math.hypot(bx - x, by - y) || 1;
      x += ((bx - x) / len) * 0.02;
      y += ((by - y) / len) * 0.02;
      // its body swimming through the air, a slow wave passing down it
      const wave = Math.sin(j * 0.55 - t * 1.1) * 0.014 * Math.min(1, j / 4);
      const [nx, ny] = [-(by - y) / len, (bx - x) / len];
      points.set([x + nx * wave, y + ny * wave], j * 2);
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
    gl.uniform2fv(at, points);
    gl.uniform4f(boxAt, x0 - 0.07, y0 - 0.07, x1 + 0.07, y1 + 0.07);
  };
};

export const skyPillarScene: SceneMaker = (back) => shaderScene(back, FRAGMENT, spine);
