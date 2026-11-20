import { shaderScene } from './scene';

import type { SceneMaker } from './scene';

// Ukiyo's print: a cream sky graded into Prussian blue at its top (bokashi), a far mountain with snow on its peak, a
// red sun low beside it, and ranks of waves in the print's blues rolling slowly toward you, their faces lined with the
// carver's parallel strokes, their crests breaking into white claws of foam. Every edge has the key block's dark line,
// and the paper's grain shows through the colour as an impression does
const FRAGMENT = `
float hash (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise (vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// a wave's surface height at x: a long swell, sharpened toward its crest, the crest leaning forward
float wave (float x, float t, float k, float amp, float phase) {
  float s = x * k + phase + t;
  float base = 0.5 + 0.5 * sin(s);
  float crest = pow(base, 3.0);
  return amp * (crest + 0.25 * sin(s * 2.3 + 1.0) * base);
}

void main () {
  vec2 px = gl_FragCoord.xy;
  float h = u_res.y;
  vec2 uv = vec2((px.x - 0.5 * u_res.x) / h, px.y / h);
  float t = u_time;
  float line = 1.4 * u_dpr / h;

  vec3 cream = vec3(0.93, 0.88, 0.76);
  vec3 prussian = vec3(0.09, 0.2, 0.42);
  vec3 indigo = vec3(0.06, 0.1, 0.22);
  vec3 key = vec3(0.12, 0.12, 0.18);

  // the sky: cream, the blue printed in at the top and wiped away down the block
  vec3 col = mix(cream, prussian * 1.2, smoothstep(0.62, 1.0, uv.y) * 0.85);
  col = mix(col, vec3(0.86, 0.62, 0.5), smoothstep(0.55, 0.36, uv.y) * 0.25);

  // the sun, a flat red disc
  float sd = length(uv - vec2(0.55, 0.5));
  col = mix(col, vec3(0.8, 0.22, 0.16), smoothstep(0.052, 0.05, sd));

  // the mountain, small and far: blue with a white peak, its snow's edge ragged
  float mx = uv.x + 0.35;
  float peak = 0.53 - abs(mx) * 0.55 - 0.012 * noise(vec2(mx * 40.0, 0.0));
  if (uv.y < peak && uv.y > 0.3) {
    float snow = smoothstep(0.0, 0.002, uv.y - (0.475 + 0.01 * sin(mx * 120.0)));
    col = mix(mix(prussian * 1.3, vec3(0.3, 0.42, 0.6), 0.4), vec3(0.96, 0.94, 0.88), snow);
  }
  col = mix(col, key, smoothstep(line, 0.0, abs(uv.y - peak)) * step(0.3, uv.y) * step(abs(mx), 0.42));

  // the waves, far to near, each rank larger, lower and slower
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float base = 0.32 - fi * 0.075;
    float amp = 0.05 + fi * 0.035;
    float k = 9.0 - fi * 1.8;
    float speed = 0.05 + fi * 0.02;
    float y = base + wave(uv.x, t * speed, k, amp, fi * 1.7);
    if (uv.y < y) {
      float depth = y - uv.y;
      // the face: the light blue at the crest deepening down, lined in parallel strokes that follow the surface
      vec3 face = mix(vec3(0.38, 0.56, 0.74), prussian, smoothstep(0.0, amp * 1.4, depth));
      float strokes = abs(fract((uv.y - y) * 160.0 / (1.0 + fi * 0.5)) - 0.5);
      face = mix(face, indigo, smoothstep(0.12, 0.0, strokes) * 0.35 * smoothstep(0.004, 0.03, depth));
      // the crest's foam: white along the top, broken below into claws
      float claws = 0.5 + 0.5 * sin(uv.x * (140.0 - fi * 20.0) + fi);
      float foamDepth = 0.008 + 0.018 * claws * (0.6 + 0.4 * noise(vec2(uv.x * 30.0, fi)));
      float foam = smoothstep(foamDepth + line, foamDepth, depth) * smoothstep(0.35, 1.0, (y - base) / amp + 0.2);
      face = mix(face, vec3(0.97, 0.95, 0.9), foam);
      col = face;
      // spray: white dots flung above the highest crests
    }
    col = mix(col, key, smoothstep(line, 0.0, abs(uv.y - y)));
  }

  // the paper under the print: its grain, and the impression a little uneven
  float grain = noise(px / u_dpr * 0.8) * 0.5 + noise(px / u_dpr * 3.0) * 0.5;
  col *= 0.94 + 0.08 * grain;
  col *= 0.97 + 0.03 * noise(uv * 6.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const ukiyoScene: SceneMaker = (back) => shaderScene(back, FRAGMENT);
