import type { ScenePaint } from './scene';

// Midnight's mountains, cut as low-poly crystals: each peak a summit over two rings of shoulders and a ring of feet,
// every face flat and edged in a fine blue line, seen from a little above, so each slope is one plane and the shape
// reads from how the planes turn. Lit from the sun's side and from above in the night's blues; the far ones lost in
// the haze
type Vec3 = [number, number, number];

interface Peak {
  // across the window from the centre, in window heights, and how tall
  x: number;
  height: number;
  // its footprint's half-width across, in its own heights (its depth back is the same)
  width: number;
  // how far back it stands, 0 nearest: the order the range is painted in and how much haze it's in
  far: number;
  // its corners round each ring, where its summit leans across its footprint (-1 to 1), how its rings are turned
  // (radians) and how sharp it is, 0 a broad dome to 1 a spire
  corners: number;
  lean: number;
  turn: number;
  sharp: number;
}

// either side of the sun, framing it: a low foothill by it, the tallest a little out from it, a far range between, on
// past the window's edge for the widest screens. Left and right cut apart, a single tall peak on the left and a pair
// on the right
const RANGE: Peak[] = [
  { x: -0.35, height: 0.084, width: 1.3, far: 0, corners: 6, lean: -0.2, turn: 0.3, sharp: 0.5 },
  { x: -0.63, height: 0.186, width: 1.15, far: 0, corners: 6, lean: 0.15, turn: 1.1, sharp: 0.8 },
  { x: -0.48, height: 0.12, width: 1.25, far: 1, corners: 5, lean: -0.1, turn: 2.2, sharp: 0.5 },
  { x: -0.92, height: 0.12, width: 1.3, far: 0, corners: 6, lean: 0.2, turn: 0.7, sharp: 0.4 },
  { x: -0.79, height: 0.144, width: 1.2, far: 2, corners: 5, lean: 0, turn: 1.6, sharp: 0.6 },
  { x: -1.17, height: 0.156, width: 1.2, far: 1, corners: 6, lean: -0.15, turn: 2.8, sharp: 0.7 },
  { x: -1.46, height: 0.114, width: 1.35, far: 0, corners: 5, lean: 0.1, turn: 0.2, sharp: 0.4 },
  { x: -1.72, height: 0.144, width: 1.2, far: 1, corners: 6, lean: 0, turn: 1.9, sharp: 0.6 },
  { x: 0.33, height: 0.078, width: 1.35, far: 0, corners: 5, lean: 0.25, turn: 2.5, sharp: 0.4 },
  { x: 0.56, height: 0.156, width: 1.15, far: 0, corners: 6, lean: -0.1, turn: 0.9, sharp: 0.7 },
  { x: 0.73, height: 0.174, width: 1.15, far: 1, corners: 6, lean: 0.1, turn: 2.0, sharp: 0.8 },
  { x: 0.45, height: 0.108, width: 1.3, far: 2, corners: 5, lean: 0, turn: 1.2, sharp: 0.5 },
  { x: 0.93, height: 0.126, width: 1.3, far: 0, corners: 6, lean: -0.2, turn: 2.9, sharp: 0.5 },
  { x: 1.2, height: 0.144, width: 1.2, far: 1, corners: 5, lean: 0.15, turn: 0.5, sharp: 0.6 },
  { x: 1.5, height: 0.12, width: 1.3, far: 0, corners: 6, lean: -0.1, turn: 1.4, sharp: 0.5 },
  { x: 1.76, height: 0.138, width: 1.2, far: 2, corners: 5, lean: 0, turn: 2.4, sharp: 0.6 },
];

// the horizon, as the shader has it: 0.3 of the window's height up from its foot
const HORIZON = 0.3;
// how far the view looks down onto the peaks, in radians
const TILT = 0.15;
// the rings under the summit, each [how high it stands, how far out it reaches], for a dome and for a spire
const DOME: [number, number][] = [[0.72, 0.3], [0.42, 0.62], [0, 1]];
const SPIRE: [number, number][] = [[0.6, 0.2], [0.28, 0.5], [0, 1]];

// a fixed scatter for a peak's corners, so each is cut the same every time
function scatter (n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// a peak as a mesh, its corners and its faces' three corners each: the summit's fan to the first ring, then a band of
// faces between each ring and the next, each ring turned half a corner from the one above so the faces run down in
// triangles
function mesh (peak: Peak, index: number): { points: Vec3[]; faces: [number, number, number][] } {
  const n = peak.corners;
  const summit: Vec3 = [peak.lean * peak.width * 0.25, 1, 0];
  const points: Vec3[] = [summit];
  DOME.forEach(([domeLift, domeReach], level) => {
    const lift = domeLift + (SPIRE[level][0] - domeLift) * peak.sharp;
    const reach = domeReach + (SPIRE[level][1] - domeReach) * peak.sharp;
    for (let k = 0; k < n; k++) {
      const seed = index * 97 + level * 13 + k;
      const a = peak.turn + (level * Math.PI) / n + (2 * Math.PI * k) / n + (scatter(seed) - 0.5) * (2.4 / n);
      const r = reach * (0.86 + 0.28 * scatter(seed + 0.5));
      const v = lift === 0 ? 0 : lift + (scatter(seed + 0.25) - 0.5) * 0.12;
      points.push([Math.cos(a) * peak.width * r + summit[0] * (1 - reach), v, Math.sin(a) * peak.width * r]);
    }
  });
  const ring = (level: number, k: number) => 1 + level * n + (k % n);
  const faces: [number, number, number][] = [];
  for (let k = 0; k < n; k++) {
    faces.push([0, ring(0, k + 1), ring(0, k)]);
    for (let level = 0; level + 1 < DOME.length; level++) {
      faces.push([ring(level, k), ring(level, k + 1), ring(level + 1, k)]);
      faces.push([ring(level + 1, k), ring(level, k + 1), ring(level + 1, k + 1)]);
    }
  }
  return { points, faces };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = ([r, g, b]: number[]) => `rgb(${r} ${g} ${b})`;

// toward the eye, from a peak: up a little and out of the screen
const EYE: Vec3 = [0, Math.sin(TILT), -Math.cos(TILT)];

// the night's blues: a face turned from the light, one turned to it, the line along every edge, and the haze the far
// ones fade into
const SHADE = [12, 14, 44];
const LIGHT = [46, 60, 140];
const EDGE = [80, 120, 255];
const HAZE = [70, 40, 112];

export const paintMountains: ScenePaint = (ctx, width, height, dpr) => {
  const horizonY = height * (1 - HORIZON);
  ctx.lineJoin = 'round';
  ctx.lineWidth = dpr;
  // the far ones first, so the near stand over them
  RANGE.map((peak, i) => ({ peak, i })).sort((a, b) => b.peak.far - a.peak.far).forEach(({ peak, i }) => {
    const scale = peak.height * height;
    const centre = width / 2 + peak.x * height;
    const { points, faces } = mesh(peak, i);
    // stood so its farthest foot is on the horizon, and none of its feet hangs in the sky
    const foot = Math.max(...points.map(([, v, w]) => (v === 0 ? w : -Infinity))) * Math.sin(TILT);
    const at = ([u, v, w]: Vec3): [number, number] => [centre + u * scale, horizonY - (v * Math.cos(TILT) + w * Math.sin(TILT) - foot) * scale];
    // lit from the sun's side, from above, and a little from in front
    const light = unit([-Math.sign(peak.x) * 0.75, 0.55, -0.35]);
    const haze = peak.far * 0.22;
    const screen = points.map(at);
    const shapes = faces.map((face) => {
      const [a, b, c] = face.map((k) => points[k]);
      const normal = unit(cross(sub(b, a), sub(c, a)));
      return { face, normal, facing: dot(normal, EYE), depth: [a, b, c].reduce((d, [, v, w]) => d + w * Math.cos(TILT) - v * Math.sin(TILT), 0) };
    });
    // which faces meet along each edge
    const sides = new Map<string, number[]>();
    const edgeKey = (p: number, q: number) => (p < q ? `${p} ${q}` : `${q} ${p}`);
    faces.forEach((face, f) => face.forEach((p, k) => {
      const key = edgeKey(p, face[(k + 1) % 3]);
      sides.set(key, [...(sides.get(key) ?? []), f]);
    }));
    const edge = mix(EDGE, HAZE, haze * 1.5);
    // the faces turned to the eye, back to front: each filled and stroked in its own colour, so no seam opens between
    // two, then its edges lined in a colour mixed opaque over it, so a face nearer the eye drawn after covers the lines
    // it hides. The outline at full strength; an edge between two faces turned nearly side-on to the eye faded, as
    // they're squeezed thin there and their lines would bunch into hatching
    shapes
    .map((shape, f) => ({ ...shape, f }))
    .filter(({ facing }) => facing > 0)
    .sort((a, b) => b.depth - a.depth)
    .forEach(({ face, normal, facing, f }) => {
      const fill = mix(mix(SHADE, LIGHT, Math.max(0, dot(normal, light)) ** 1.3), HAZE, haze);
      const path = new Path2D();
      face.forEach((p, k) => (k ? path.lineTo(...screen[p]) : path.moveTo(...screen[p])));
      path.closePath();
      ctx.fillStyle = rgb(fill);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.fill(path);
      ctx.stroke(path);
      face.forEach((p, k) => {
        const q = face[(k + 1) % 3];
        const other = sides.get(edgeKey(p, q))!.find((g) => g !== f);
        const strength = other === undefined || shapes[other].facing <= 0 ? 1 : Math.min(1, Math.min(facing, shapes[other].facing) / 0.3);
        ctx.strokeStyle = rgb(mix(fill, edge, 0.55 * strength));
        ctx.beginPath();
        ctx.moveTo(...screen[p]);
        ctx.lineTo(...screen[q]);
        ctx.stroke();
      });
    });
  });
};
