import { shaderScene } from './scene';

import type { FrameUniforms, SceneMaker } from './scene';

// Koi's pond under a glass floor: dark green water over a bed of river stones, the light on it swelling slowly, lily pads
// resting on the surface, and koi gliding below in long slow loops, each bending along its own path, its shadow on
// the bed under it. Kohaku, sanke, yamabuki, a black karasu and an ochiba; every body built from its spine each frame
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 hash2 (vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }

// the pond's bed: river stones packed together, each rounded and lit from above, its own grey, slate or ochre; the
// colour of the stone (rgb) and how far in from its edge (a)
vec4 pebbles (vec2 p) {
  vec2 g = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 near = vec2(0.0);
  vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 c = g + o;
      // stones longer one way than the other
      vec2 r = (o + 0.15 + 0.7 * hash2(c) - f) * vec2(1.0, 1.0 + 0.5 * hash(c + 2.0));
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; near = r; id = c; } else if (d < f2) { f2 = d; }
    }
  }
  float edge = sqrt(f2) - sqrt(f1);
  float h = hash(id + 4.0);
  vec3 stone = h < 0.45 ? vec3(0.42, 0.42, 0.4) : h < 0.75 ? vec3(0.32, 0.35, 0.36) : h < 0.92 ? vec3(0.5, 0.42, 0.3) : vec3(0.58, 0.55, 0.5);
  stone *= 0.8 + 0.35 * hash(id + 6.0);
  // rounded: lit on the side toward the light, its crown brighter, sinking dark into the gaps between
  float rad = 0.42 + 0.14 * hash(id + 8.0);
  float dome = smoothstep(0.0, 0.3, edge) * smoothstep(rad, rad * 0.45, sqrt(f1));
  float lit = clamp(0.55 + 0.9 * dot(-near, normalize(vec2(-0.5, 0.7))), 0.0, 1.0);
  stone *= (0.22 + 0.78 * dome) * (0.65 + 0.5 * lit * dome);
  return vec4(stone, dome);
}

float segment (vec2 p, vec2 a, vec2 b) { vec2 pa = p - a; vec2 ba = b - a; float k = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * k); }

// each koi's spine, worked out once a frame (below): 16 points from the head back, its size, and the box it and its
// shadow lie within, so a pixel outside it skips the fish
uniform vec2 u_spine[112];
uniform vec4 u_box[7];
uniform float u_size[7];

// the nearest koi to p: its distance (x, negative inside), how far along from the head (y), which side (z), and how
// much of it is fin rather than body (w); which koi it is in which. Every koi is walked here, as WebGL 1 reads a
// uniform array only at a loop's own count
vec4 koi (vec2 p, out float which) {
  float best = 1e3;
  float along = 0.0;
  float side = 0.0;
  float fin = 0.0;
  which = 0.0;
  for (int k = 0; k < 7; k++) {
    vec4 box = u_box[k];
    if (p.x < box.x || p.y < box.y || p.x > box.z || p.y > box.w) { continue; }
    float size = u_size[k];
    for (int j = 1; j < 16; j++) {
      vec2 prev = u_spine[k * 16 + j - 1];
      vec2 cur = u_spine[k * 16 + j];
      float u = (float(j) - 0.5) / 15.0;
      // the body: a rounded snout, fullest a third back, narrowing to the tail's root
      float w = size * (0.006 + 0.018 * sin(3.1416 * pow(clamp(u * 1.25, 0.0, 1.0), 0.75)));
      float d = segment(p, prev, cur) - w;
      float finHere = 0.0;
      vec2 dir = normalize(cur - prev + 1e-6);
      vec2 nrm = vec2(-dir.y, dir.x);
      // the tail fin past the last link: a fan opening behind the root, forked at its trailing edge
      if (j == 15) {
        vec2 v = p - cur;
        float behind = dot(v, dir);
        float across = abs(dot(v, nrm));
        float fork = 0.03 * size * (1.0 - 0.35 * smoothstep(0.0, 0.016 * size, across));
        float td = max(max(-behind, behind - fork), across - (0.003 * size + behind * 0.75));
        if (td < d) { d = td; finHere = 1.0; }
      }
      // the pectoral fins, a pair swept back a quarter of the way down
      if (j == 4) {
        for (int s = 0; s < 2; s++) {
          float sgn = float(s) * 2.0 - 1.0;
          vec2 v = p - (cur + nrm * sgn * size * 0.026 + dir * size * 0.006);
          float fd = length(vec2(dot(v, dir) / 1.7, dot(v, nrm))) - size * 0.009;
          if (fd < d) { d = fd; finHere = 1.0; }
        }
      }
      if (d < best) {
        best = d;
        along = u;
        side = dot(p - prev, nrm) / max(w, 1e-4);
        fin = finHere;
        which = float(k);
      }
    }
  }
  return vec4(best, along, side, fin);
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float aspect = u_res.x / h;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;
  float aa = 1.2 * u_dpr / h;

  // the bed under the water: stones seen through it, the deeper water greener and darker over them, the light on it
  // swelling and fading in broad soft patches as the surface moves
  vec4 bed = pebbles(uv * 16.0);
  float swell = noise(uv * 2.5 + vec2(t * 0.03, -t * 0.02)) * 0.6 + noise(uv * 5.0 - vec2(t * 0.02, t * 0.025)) * 0.4;
  vec3 water = mix(vec3(0.02, 0.08, 0.08), vec3(0.04, 0.15, 0.14), smoothstep(0.0, 1.0, uv.y));
  vec3 col = mix(water, bed.rgb * vec3(0.34, 0.52, 0.46), 0.5) * (0.8 + 0.45 * swell);

  // the koi, their shadows on the bed first, then their bodies
  float which;
  vec4 sh = koi(uv - vec2(0.013, -0.02), which);
  col *= 1.0 - 0.45 * smoothstep(0.012, -0.004, sh.x);
  {
    vec4 f = koi(uv, which);
    float i = which;
    if (f.x < aa) {
      float kind = mod(i, 5.0);
      vec3 white = vec3(0.92, 0.9, 0.86);
      vec3 red = vec3(0.86, 0.22, 0.1);
      vec3 black = vec3(0.06, 0.06, 0.07);
      vec3 gold = vec3(0.95, 0.68, 0.2);
      vec3 grey = vec3(0.45, 0.47, 0.5);
      // patches laid along the body and across it
      float patch = noise(vec2(f.y * 5.0 + i * 3.0, clamp(f.z, -1.0, 1.0) * 0.8 + i));
      float spot = noise(vec2(f.y * 9.0 + i * 5.0, clamp(f.z, -1.0, 1.0) * 1.5 - i));
      vec3 body = white;
      if (kind < 0.5) { body = mix(white, red, smoothstep(0.45, 0.5, patch) * step(0.08, f.y)); }
      else if (kind < 1.5) { body = mix(mix(white, red, smoothstep(0.45, 0.5, patch) * step(0.08, f.y)), black, smoothstep(0.68, 0.72, spot)); }
      else if (kind < 2.5) { body = gold; }
      else if (kind < 3.5) { body = mix(black, vec3(0.2, 0.2, 0.22), smoothstep(0.5, 0.9, abs(f.z))); }
      else { body = mix(grey, vec3(0.75, 0.55, 0.32), smoothstep(0.4, 0.6, patch)); }
      // rounded: lit along its back, darker at its flanks; its fins thin, the water showing through them
      body *= 0.62 + 0.38 * (1.0 - min(1.0, f.z * f.z));
      body = mix(body, col, 0.25 + f.w * 0.45);
      col = mix(col, body, smoothstep(aa, -aa, f.x));
    }
  }

  // lily pads resting on the surface, each with its notch
  for (int k = 0; k < 6; k++) {
    float i = float(k);
    vec2 c = vec2((hash(vec2(i, 21.0)) - 0.5) * aspect * 0.95, 0.08 + hash(vec2(i, 22.0)) * 0.85);
    float r = 0.035 + 0.03 * hash(vec2(i, 23.0));
    c += vec2(sin(t * 0.03 + i), cos(t * 0.025 + i)) * 0.004;
    vec2 v = uv - c;
    float ang = atan(v.y, v.x) - hash(vec2(i, 24.0)) * 6.28;
    float notch = smoothstep(0.12, 0.0, abs(mod(ang + 3.1416, 6.2832) - 3.1416));
    float d = length(v) - r * (1.0 - notch);
    col *= 1.0 - 0.4 * smoothstep(0.01, -0.005, length(v - vec2(0.006, -0.009)) - r);
    vec3 pad = mix(vec3(0.12, 0.3, 0.14), vec3(0.22, 0.42, 0.2), noise(v * 120.0) * 0.5 + 0.25 + 0.4 * v.y / r);
    pad += vec3(0.05) * smoothstep(0.003, 0.0, abs(fract(atan(v.y, v.x) * 2.0) - 0.5) * length(v));
    col = mix(col, pad, smoothstep(aa, -aa, d));
  }

  // the surface: a soft sheen of the sky across it, shifting
  float sheen = noise(uv * vec2(2.0, 5.0) + vec2(t * 0.02, 0.0));
  col += vec3(0.5, 0.6, 0.6) * smoothstep(0.55, 0.9, sheen) * 0.05;

  vec2 q = px / u_res;
  col *= mix(0.65, 1.0, smoothstep(1.2, 0.35, length((q - 0.5) * vec2(1.1, 1.0))));
  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const KOI = 7;
const LINKS = 16;
const fract = (v: number) => v - Math.floor(v);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);

// where koi i is along its loop at moment s, in the shader's units (the window's height 1, x from its centre)
function path (i: number, s: number, aspect: number): [number, number] {
  const a = hash(i, 1) * 6.28;
  const b = hash(i, 2) * 6.28;
  const cx = (hash(i, 3) - 0.5) * aspect * 0.7;
  const cy = 0.25 + hash(i, 4) * 0.5;
  const rx = aspect * (0.18 + 0.15 * hash(i, 5));
  const ry = 0.14 + 0.12 * hash(i, 6);
  return [cx + rx * Math.sin(s + a), cy + ry * Math.sin(s * 2 + b)];
}

// every koi's spine this frame: each link an even length, pulled toward a point further back along its loop, so the
// body trails its head as a rope would however fast the loop runs there
const spines: FrameUniforms = (gl, program) => {
  const spine = gl.getUniformLocation(program, 'u_spine');
  const box = gl.getUniformLocation(program, 'u_box');
  const sizeAt = gl.getUniformLocation(program, 'u_size');
  const points = new Float32Array(KOI * LINKS * 2);
  const boxes = new Float32Array(KOI * 4);
  const sizes = new Float32Array(KOI).map((_, i) => 0.8 + 0.6 * hash(i, 9));
  gl.uniform1fv(sizeAt, sizes);
  return (t, aspect) => {
    for (let i = 0; i < KOI; i++) {
      const size = sizes[i];
      const s = t * (0.045 + 0.02 * hash(i, 7)) + i * 10;
      let [x, y] = path(i, s, aspect);
      let [x0, y0, x1, y1] = [x, y, x, y];
      points.set([x, y], i * LINKS * 2);
      for (let j = 1; j < LINKS; j++) {
        const [bx, by] = path(i, s - (j + 3) * 0.03, aspect);
        const len = Math.hypot(bx - x, by - y) || 1;
        x += (bx - x) / len * 0.0105 * size;
        y += (by - y) / len * 0.0105 * size;
        points.set([x, y], (i * LINKS + j) * 2);
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
      // room for the body's width, the fins and tail, and the shadow cast down and to the right of it
      const m = 0.06 * size;
      boxes.set([x0 - m, y0 - m, x1 + m, y1 + m], i * 4);
    }
    gl.uniform2fv(spine, points);
    gl.uniform4fv(box, boxes);
  };
};

export const koiScene: SceneMaker = (back) => shaderScene(back, FRAGMENT, spines);
