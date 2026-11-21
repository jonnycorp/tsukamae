import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Ukiyo, redrawn as a game's painted island: flat, clean colour in two or three tones a shape, no texture. A dusk sky
// from violet down to a warm rose, rounded clouds drifting slowly across it; a far island with a pagoda on its crest; a
// vermilion torii standing in the sea; a sakura leaning in from the right edge, its petals drifting down. The sea is
// ranks of stylized waves, each a rolling body with its crest curled over into a white hook and a dark eye inside the
// curl, foam beads along it; the ranks sway slowly side to side, each its own way, bobbing a little as they go
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float box (vec2 p, vec2 c, vec2 s) { vec2 d = abs(p - c) - s; return max(d.x, d.y); }

// a rank of waves: what of it covers p (x), the white of its crests (y), the dark of the curls' eyes (z), and how far
// below its crest p is (w), for its shading
vec4 waves (vec2 p, float base, float w, float amp, float shift) {
  float x = p.x / w + shift;
  float c = floor(x);
  float f = fract(x);
  float hgt = amp * (0.75 + 0.25 * hash(vec2(c, base)));
  // the body: a long back rising to the crest at 0.62, falling steeply in front of it
  float rise = smoothstep(0.0, 0.62, f);
  float fall = 1.0 - smoothstep(0.62, 0.9, f);
  float top = base + hgt * (f < 0.62 ? rise * rise * (3.0 - 2.0 * rise) : fall * fall);
  // the curl: a circle at the crest, its front half over the trough
  vec2 cc = vec2((c + 0.66) * w - shift * w, base + hgt * 0.72);
  float r = hgt * 0.32;
  float dc = length(p - cc);
  float body = step(p.y, top) + step(dc, r);
  // the crest's white: a band along the back's top and round the curl's outer edge, a hook
  float ang = atan(p.y - cc.y, p.x - cc.x);
  float rim = step(abs(dc - r * 0.82), r * 0.2) * step(-1.2, ang);
  float back = step(top - hgt * 0.07, p.y) * step(p.y, top) * step(0.25, f) * step(f, 0.66);
  float white = clamp(rim + back, 0.0, 1.0);
  float eye = step(dc, r * 0.38);
  // foam beads strung along the back
  vec2 bead = vec2(fract(x * 6.0) - 0.5, (p.y - top + hgt * 0.12) / (hgt * 0.07));
  white = max(white, step(length(bead * vec2(1.0, 0.6)), 0.25) * step(0.1, f) * step(f, 0.55));
  return vec4(clamp(body, 0.0, 1.0), white, eye, top - p.y);
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  float aspect = u_res.x / h;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;
  float half_ = aspect * 0.5;

  // the dusk: violet above, rose toward the sea, in three soft bands
  vec3 col = mix(vec3(0.97, 0.7, 0.66), vec3(0.62, 0.46, 0.78), smoothstep(0.35, 0.7, uv.y));
  col = mix(col, vec3(0.3, 0.24, 0.52), smoothstep(0.7, 1.0, uv.y));
  // a pale low sun
  float sd = length(uv - vec2(-half_ * 0.25, 0.46));
  col = mix(col, vec3(1.0, 0.93, 0.82), smoothstep(0.075, 0.07, sd));
  col += vec3(1.0, 0.8, 0.7) * exp(-sd * 8.0) * 0.12;

  // clouds: rounded heaps with flat undersides, lit on top in a lighter tone, drifting slowly
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float cy = 0.62 + 0.3 * hash(vec2(fk, 1.0));
    float cx = mod(hash(vec2(fk, 2.0)) * aspect + t * (0.004 + 0.002 * fk), aspect + 0.6) - half_ - 0.3;
    float cw = 0.1 + 0.08 * hash(vec2(fk, 3.0));
    vec2 v = uv - vec2(cx, cy);
    float heap = 1e3;
    for (int b = 0; b < 4; b++) {
      float fb = float(b);
      vec2 bc = vec2((fb / 3.0 - 0.5) * cw * 1.6, cw * (0.15 + 0.25 * hash(vec2(fk, fb + 5.0))));
      heap = min(heap, length(v - bc) - cw * (0.28 + 0.12 * hash(vec2(fb, fk))));
    }
    heap = max(heap, -v.y);
    if (heap < 0.0) {
      col = mix(vec3(0.92, 0.72, 0.82), vec3(1.0, 0.92, 0.9), step(cw * 0.25, v.y));
    }
  }

  // the far island and its pagoda, flat violet against the sky
  float isl = 0.36 + 0.07 * exp(-pow((uv.x - half_ * 0.45) / 0.18, 2.0));
  float pag = box(uv, vec2(half_ * 0.45, 0.45), vec2(0.008, 0.04));
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    pag = min(pag, box(uv, vec2(half_ * 0.45, 0.42 + fk * 0.022), vec2(0.03 - fk * 0.005, 0.003)));
  }
  col = mix(col, vec3(0.42, 0.32, 0.56), max(step(uv.y, isl), step(pag, 0.0)));

  // the sea, a deep blue under the waves, and its ranks of waves, far to near
  if (uv.y < 0.36) { col = vec3(0.16, 0.26, 0.55); }
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float base = 0.3 - fk * 0.085;
    float w = 0.16 + fk * 0.07;
    float shift = sin(t * 0.08 + fk * 1.7) * 0.35 + fk * 0.3;
    vec2 p = uv + vec2(0.0, sin(t * 0.25 + fk) * 0.004);
    vec4 wv = waves(p, base, w, 0.05 + fk * 0.025, shift);
    if (wv.x > 0.0) {
      vec3 sea = mix(vec3(0.26, 0.44, 0.78), vec3(0.12, 0.2, 0.46), fk / 3.0);
      // two tones: lighter along the wave's upper face
      sea = mix(sea * 0.78, sea, step(wv.w, (0.05 + fk * 0.025) * 0.35));
      col = sea;
      col = mix(col, vec3(0.98, 0.97, 0.94), wv.y);
      col = mix(col, sea * 0.55, wv.z);
    }
  }

  // the torii standing in the sea, between the far ranks and the near, its feet hidden by the swell
  vec2 tc = vec2(-half_ * 0.6, 0.18);
  float torii = min(box(uv, tc + vec2(-0.045, 0.06), vec2(0.007, 0.07)), box(uv, tc + vec2(0.045, 0.06), vec2(0.007, 0.07)));
  torii = min(torii, box(uv, tc + vec2(0.0, 0.138), vec2(0.075, 0.009)));
  torii = min(torii, box(uv, tc + vec2(0.0, 0.112), vec2(0.06, 0.005)));
  col = mix(col, vec3(0.86, 0.22, 0.16), step(torii, 0.0));
  col = mix(col, vec3(0.16, 0.12, 0.14), step(box(uv, tc + vec2(0.0, 0.15), vec2(0.082, 0.004)), 0.0));

  for (int k = 2; k < 4; k++) {
    float fk = float(k);
    float base = 0.3 - fk * 0.085;
    float w = 0.16 + fk * 0.07;
    float shift = sin(t * 0.08 + fk * 1.7) * 0.35 + fk * 0.3;
    vec2 p = uv + vec2(0.0, sin(t * 0.25 + fk) * 0.004);
    vec4 wv = waves(p, base, w, 0.05 + fk * 0.025, shift);
    if (wv.x > 0.0) {
      vec3 sea = mix(vec3(0.26, 0.44, 0.78), vec3(0.12, 0.2, 0.46), fk / 3.0);
      // two tones: lighter along the wave's upper face
      sea = mix(sea * 0.78, sea, step(wv.w, (0.05 + fk * 0.025) * 0.35));
      col = sea;
      col = mix(col, vec3(0.98, 0.97, 0.94), wv.y);
      col = mix(col, sea * 0.55, wv.z);
    }
  }

  // the sakura at the right edge: a dark trunk leaning in, its crown heaps of pink in two tones
  vec2 sv = uv - vec2(half_, 0.0);
  float trunk = abs(sv.x + 0.035 + (uv.y - 0.1) * 0.12 + 0.05 * sin(uv.y * 3.2)) - 0.024 * (1.3 - uv.y);
  col = mix(col, vec3(0.32, 0.18, 0.2), step(trunk, 0.0) * step(uv.y, 0.85));
  float crown = 1e3;
  for (int b = 0; b < 7; b++) {
    float fb = float(b);
    vec2 bc = vec2(-0.05 - 0.12 * hash(vec2(fb, 11.0)), 0.7 + 0.25 * hash(vec2(fb, 12.0)));
    crown = min(crown, length(sv - bc) - 0.07 - 0.04 * hash(vec2(fb, 13.0)));
  }
  if (crown < 0.0) {
    // three tones: a deep rose underside, the body, a pale lit top
    col = mix(vec3(0.82, 0.42, 0.58), vec3(0.95, 0.6, 0.72), step(0.7, sv.y));
    col = mix(col, vec3(1.0, 0.84, 0.89), step(0.86, sv.y) * step(-0.035, crown));
  }

  // petals drifting down and across from it
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    vec2 p = uv * (12.0 + fl * 6.0) + vec2(t * (0.3 + fl * 0.1), t * (0.25 + fl * 0.1) + sin(t * 0.3 + uv.x * 4.0) * 0.4);
    vec2 c = floor(p);
    vec2 f = fract(p) - 0.5;
    float a = t * (0.5 + hash(c)) + hash(c + 4.0) * 6.28;
    vec2 r = vec2(cos(a) * f.x - sin(a) * f.y, sin(a) * f.x + cos(a) * f.y);
    float petal = step(length(r * vec2(1.0 / 0.1, 1.0 / 0.06)), 1.0) * step(0.95, hash(c + fl * 9.0));
    col = mix(col, vec3(1.0, 0.82, 0.88), petal);
  }

  col += (hash(px + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const ukiyoScene: SceneMaker = (back) => shaderScene(back, FRAGMENT);
