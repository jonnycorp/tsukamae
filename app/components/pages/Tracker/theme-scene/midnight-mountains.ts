import type { ScenePaint } from './scene';

// Midnight's mountains, the wireframe of an 80s sunset: faceted, their faces the night's navy, their edges a dim blue.
// Not drawn by hand: each skyline is traced from a reference picture of the pair (its ridge's points, in the picture's
// pixels, the foot at y 0 and up positive), and each mountain is that outline filled with even facets as the
// reference's are, a jittered lattice inside it triangulated (Delaunay) along with the traced points, worked out once
// offline and kept here as points (x, y pairs) and triangles (index triples)
const TALL_POINTS = [0, 0, 56, 21, 99, 43, 122, 66, 158, 85, 208, 105, 227, 110, 263, 105, 282, 101, 295, 96, 323, 75, 345, 62, 390, 38, 415, 19, 440, 0, 40, 0, 80, 0, 120, 0, 160, 0, 200, 0, 240, 0, 280, 0, 320, 0, 360, 0, 400, 0, 119.5, 18.6, 165.3, 18, 197.6, 23.2, 238.4, 24.1, 285.3, 28.9, 315.2, 24.9, 364.4, 20.3, 129.5, 48.7, 177.2, 40.7, 223.6, 51.6, 253.4, 47.7, 295.5, 49.1, 345, 42.4, 164.4, 66.3, 208.3, 66.1, 241.4, 67.7, 282.5, 65.1];
const TALL_TRIANGLES = [5, 39, 6, 5, 4, 39, 33, 27, 39, 31, 22, 23, 24, 31, 23, 31, 24, 12, 15, 1, 0, 1, 15, 16, 3, 2, 32, 2, 1, 16, 39, 40, 6, 40, 35, 41, 21, 28, 20, 10, 9, 41, 28, 19, 20, 19, 28, 27, 18, 25, 17, 2, 25, 32, 25, 16, 17, 25, 2, 16, 4, 38, 39, 38, 33, 39, 33, 38, 32, 38, 3, 32, 38, 4, 3, 13, 24, 14, 24, 13, 12, 37, 12, 11, 37, 31, 12, 10, 37, 11, 27, 34, 39, 28, 34, 27, 34, 40, 39, 34, 28, 35, 40, 34, 35, 7, 40, 41, 40, 7, 6, 28, 29, 35, 21, 29, 28, 35, 29, 41, 25, 26, 32, 26, 25, 18, 26, 33, 32, 33, 26, 27, 19, 26, 18, 26, 19, 27, 9, 8, 41, 8, 7, 41, 30, 21, 22, 30, 29, 21, 31, 30, 22, 37, 30, 31, 29, 36, 41, 30, 36, 29, 36, 10, 41, 36, 37, 10, 36, 30, 37];
const LOW_POINTS = [0, 0, 22.5, 32, 45, 64, 84, 85, 101, 89, 121, 84, 140, 80, 153, 74, 187, 49, 211, 25, 242, 0, 40.3, 0, 80.7, 0, 121, 0, 161.3, 0, 201.7, 0, 42.3, 16.9, 72.1, 28.5, 110.4, 18.2, 170, 24.6, 63.8, 46.2, 107.1, 46.6, 150.8, 42.2, 79.3, 66.1];
const LOW_TRIANGLES = [14, 22, 13, 12, 16, 11, 16, 12, 17, 3, 23, 4, 23, 3, 2, 23, 20, 17, 20, 23, 2, 20, 16, 17, 7, 22, 8, 23, 21, 4, 21, 23, 17, 22, 19, 8, 19, 22, 14, 15, 19, 14, 11, 1, 0, 16, 1, 11, 1, 20, 2, 20, 1, 16, 9, 15, 10, 19, 9, 8, 9, 19, 15, 7, 6, 22, 6, 21, 22, 22, 18, 13, 21, 18, 22, 18, 12, 13, 12, 18, 17, 18, 21, 17, 21, 5, 4, 6, 5, 21];

interface Mesh {
  points: number[];
  triangles: number[];
  // the traced width and height, for placing and sizing it
  width: number;
  height: number;
}

const TALL: Mesh = { points: TALL_POINTS, triangles: TALL_TRIANGLES, width: 440, height: 110 };
const LOW: Mesh = { points: LOW_POINTS, triangles: LOW_TRIANGLES, width: 242, height: 89 };

// a mountain in a range: its mesh, where its left foot stands (across the window, in heights from the centre), how tall
// (in heights), how far back (0 nearest) and whether it's turned about
interface Peak {
  mesh: Mesh;
  x: number;
  height: number;
  depth: number;
  flip?: boolean;
}

// either side of the sun, the boxes' gap kept clear for it: on each side the pair as the reference has them, the lower
// before the taller, and a farther, lower range behind them, fainter
const RANGE: Peak[] = [
  { mesh: LOW, x: -1.02, height: 0.075, depth: 1, flip: true },
  { mesh: TALL, x: -0.64, height: 0.1, depth: 1 },
  { mesh: TALL, x: 0.24, height: 0.1, depth: 1, flip: true },
  { mesh: LOW, x: 0.82, height: 0.075, depth: 1 },
  { mesh: TALL, x: -0.88, height: 0.13, depth: 0 },
  { mesh: LOW, x: -0.5, height: 0.105, depth: 0, flip: true },
  { mesh: TALL, x: 0.36, height: 0.13, depth: 0, flip: true },
  { mesh: LOW, x: 0.215, height: 0.105, depth: 0 },
];

// the horizon, as the shader has it: 0.3 of the window's height up from its foot
const HORIZON = 0.3;

export const paintMountains: ScenePaint = (ctx, width, height, dpr) => {
  const horizonY = height * (1 - HORIZON);
  ctx.lineJoin = 'round';
  // the far range first, so the near one stands over it
  [...RANGE].sort((a, b) => b.depth - a.depth).forEach((peak) => {
    const { mesh } = peak;
    const scale = (peak.height * height) / mesh.height;
    const left = width / 2 + peak.x * height;
    const at = (i: number): [number, number] => {
      const x = mesh.points[2 * i];
      return [left + (peak.flip ? mesh.width - x : x) * scale, horizonY - mesh.points[2 * i + 1] * scale];
    };
    const far = peak.depth > 0;
    // the faces, then every edge once over them
    ctx.fillStyle = far ? 'rgb(18 12 50)' : 'rgb(12 8 40)';
    ctx.beginPath();
    const edges = new Set<string>();
    for (let t = 0; t < mesh.triangles.length; t += 3) {
      const tri = [mesh.triangles[t], mesh.triangles[t + 1], mesh.triangles[t + 2]];
      const [a, b, c] = tri.map(at);
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.closePath();
      for (let k = 0; k < 3; k++) {
        const i = tri[k];
        const j = tri[(k + 1) % 3];
        edges.add(i < j ? `${i} ${j}` : `${j} ${i}`);
      }
    }
    ctx.fill();
    ctx.beginPath();
    edges.forEach((edge) => {
      const [i, j] = edge.split(' ').map(Number);
      ctx.moveTo(...at(i));
      ctx.lineTo(...at(j));
    });
    ctx.lineWidth = (far ? 0.9 : 1.2) * dpr;
    ctx.strokeStyle = far ? 'rgb(76 104 215 / 45%)' : 'rgb(92 132 255 / 72%)';
    ctx.stroke();
  });
};
