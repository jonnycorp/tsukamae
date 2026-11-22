import type { ScenePaint } from './scene';

// Midnight's mountains, the wireframe of an 80s sunset: faceted, their faces the night's navy, their edges a dim blue.
// Each skyline is traced from a reference picture of the pair (its ridge's corners, in the picture's pixels, the foot at
// y 0 and up positive), and its face built as such a terrain is, its lines showing the slope under the outline: a line
// runs down the face from every traced corner (and between corners far apart), and rows cross it as the outline itself
// stepped down the slope, each row a step nearer and lower, so every facet follows the ridge above it. Rows reach the
// ground in front of the horizon, under the floor, which hides them
interface Skyline {
  points: [number, number][];
  height: number;
}

const TALL: Skyline = {
  points: [[0, 0], [56, 21], [99, 43], [122, 66], [158, 85], [208, 105], [227, 110], [263, 105], [282, 101], [295, 96],
    [323, 75], [345, 62], [390, 38], [440, 0]],
  height: 110,
};
const LOW: Skyline = {
  points: [[0, 0], [45, 64], [84, 85], [101, 89], [121, 84], [140, 80], [153, 74], [187, 49], [211, 25], [242, 0]],
  height: 89,
};

// in the reference's pixels: the widest a facet runs along the ridge, how far each row steps down the slope, and how
// far below the horizon the ground in front of the mountain falls with each row nearer
const MAX_SPAN = 52;
const ROW_STEP = 27;
const GROUND_STEP = 6;
// how much wider the foot's row is than the ridge, as a face seen from in front widens toward you
const SPREAD = 0.09;

// a mountain in a range: its skyline, where its left foot stands (across the window, in heights from the centre), how tall
// (in heights), how far back (0 nearest) and whether it's turned about
interface Peak {
  skyline: Skyline;
  x: number;
  height: number;
  depth: number;
  flip?: boolean;
}

// either side of the sun, the boxes' gap kept clear for it: on each side the pair as the reference has them, the lower
// before the taller, and a farther, lower range behind them, fainter
const RANGE: Peak[] = [
  { skyline: LOW, x: -1.02, height: 0.075, depth: 1, flip: true },
  { skyline: TALL, x: -0.64, height: 0.1, depth: 1 },
  { skyline: TALL, x: 0.24, height: 0.1, depth: 1, flip: true },
  { skyline: LOW, x: 0.82, height: 0.075, depth: 1 },
  { skyline: TALL, x: -0.88, height: 0.13, depth: 0 },
  { skyline: LOW, x: -0.5, height: 0.105, depth: 0, flip: true },
  { skyline: TALL, x: 0.36, height: 0.13, depth: 0, flip: true },
  { skyline: LOW, x: 0.215, height: 0.105, depth: 0 },
];

// the horizon, as the shader has it: 0.3 of the window's height up from its foot
const HORIZON = 0.3;

// the face's points, row by row from the ridge down: [x, y] in the reference's pixels
function face (skyline: Skyline): [number, number][][] {
  const pts = skyline.points;
  const tops: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / MAX_SPAN);
    for (let k = 1; k <= n; k++) {
      tops.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
  }
  const width = pts[pts.length - 1][0];
  const rows = Math.ceil(skyline.height / ROW_STEP) + 1;
  const face: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    const widen = 1 + (SPREAD * j) / rows;
    face.push(tops.map(([x, y]) => {
      const lowered = y - ROW_STEP * j;
      return [width / 2 + (x - width / 2) * widen, lowered > 0 ? lowered : -GROUND_STEP * j];
    }));
  }
  return face;
}

export const paintMountains: ScenePaint = (ctx, width, height, dpr) => {
  const horizonY = height * (1 - HORIZON);
  ctx.lineJoin = 'round';
  // the far range first, so the near one stands over it
  [...RANGE].sort((a, b) => b.depth - a.depth).forEach((peak) => {
    const { skyline } = peak;
    const span = skyline.points[skyline.points.length - 1][0];
    const scale = (peak.height * height) / skyline.height;
    const left = width / 2 + peak.x * height;
    const at = ([x, y]: [number, number]): [number, number] => [left + (peak.flip ? span - x : x) * scale, horizonY - y * scale];
    const rows = face(skyline).map((row) => row.map(at));
    const columns = rows[0].length - 1;
    // each quad split along the diagonal that leans down toward the summit's side, as the slope falls away from it
    const triangles: [number, number][][] = [];
    for (let j = 0; j < rows.length - 1; j++) {
      for (let c = 0; c < columns; c++) {
        const a = rows[j][c];
        const b = rows[j][c + 1];
        const d = rows[j + 1][c];
        const e = rows[j + 1][c + 1];
        const leftSide = (c < columns / 2) !== Boolean(peak.flip);
        triangles.push(...(leftSide ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]]));
      }
    }
    const far = peak.depth > 0;
    const path = new Path2D();
    triangles.forEach(([a, b, c]) => {
      path.moveTo(...a);
      path.lineTo(...b);
      path.lineTo(...c);
      path.closePath();
    });
    ctx.fillStyle = far ? 'rgb(18 12 50)' : 'rgb(12 8 40)';
    ctx.fill(path);
    ctx.lineWidth = (far ? 0.9 : 1.2) * dpr;
    ctx.strokeStyle = far ? 'rgb(76 104 215 / 45%)' : 'rgb(92 132 255 / 72%)';
    ctx.stroke(path);
  });
};
