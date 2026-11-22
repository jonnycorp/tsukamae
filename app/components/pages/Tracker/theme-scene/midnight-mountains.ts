import type { ScenePaint } from './scene';

// Midnight's mountains: flat, sharp peaks of a few straight edges each, as an 80s poster cuts them. Each is two flat
// faces split from its summit straight down, the one turned toward the sun a shade lighter, the near range edged along
// its ridge in one crisp blue line; the far range behind it flatter still, a paler blue, unedged, as distance lifts it
// into the haze. A skyline's corners are in its own units, the foot at y 0 and up positive
interface Skyline {
  points: [number, number][];
  height: number;
}

const TALL: Skyline = {
  points: [[0, 0], [120, 62], [150, 58], [215, 110], [300, 44], [335, 36], [400, 0]],
  height: 110,
};
const LOW: Skyline = {
  points: [[0, 0], [62, 42], [112, 82], [152, 56], [176, 63], [240, 0]],
  height: 82,
};

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

export const paintMountains: ScenePaint = (ctx, width, height, dpr) => {
  const horizonY = height * (1 - HORIZON);
  ctx.lineJoin = 'miter';
  // the far range first, so the near one stands over it
  [...RANGE].sort((a, b) => b.depth - a.depth).forEach((peak) => {
    const { skyline } = peak;
    const span = skyline.points[skyline.points.length - 1][0];
    const scale = (peak.height * height) / skyline.height;
    const left = width / 2 + peak.x * height;
    const at = ([x, y]: [number, number]): [number, number] => [left + (peak.flip ? span - x : x) * scale, horizonY - y * scale];
    const ridge = skyline.points.map(at);
    const far = peak.depth > 0;

    // the whole silhouette, then its face toward the sun over it: from the summit down to the foot on the sun's side
    const summit = skyline.points.reduce((top, p, i) => (p[1] > skyline.points[top][1] ? i : top), 0);
    const [summitX] = ridge[summit];
    const towardSun = Math.sign(width / 2 - summitX);
    const outline = new Path2D();
    ridge.forEach((p, i) => (i ? outline.lineTo(...p) : outline.moveTo(...p)));
    outline.closePath();
    const lit = new Path2D();
    // the ridge from the summit down to the foot on the sun's side (the ridge runs across in order, so the summit ends it
    // or starts it)
    const sunward = ridge.filter(([x]) => (x - summitX) * towardSun >= 0);
    const side = sunward[0] === ridge[summit] ? sunward : sunward.reverse();
    side.forEach((p, i) => (i ? lit.lineTo(...p) : lit.moveTo(...p)));
    lit.lineTo(summitX, horizonY);
    lit.closePath();

    ctx.fillStyle = far ? 'rgb(44 36 104)' : 'rgb(14 10 44)';
    ctx.fill(outline);
    ctx.fillStyle = far ? 'rgb(54 46 122)' : 'rgb(24 20 70)';
    ctx.fill(lit);
    if (!far) {
      const edge = new Path2D();
      ridge.forEach((p, i) => (i ? edge.lineTo(...p) : edge.moveTo(...p)));
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = 'rgb(96 140 255 / 85%)';
      ctx.stroke(edge);
    }
  });
};
