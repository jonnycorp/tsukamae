// Wisteria's clouds (suyari-gasumi), traced from two reference sheets of them: nine from a black one and twenty from a
// red. Each is rows of round-ended bars, top down, a bar's thickness apart, every bar [left, right] in bar thicknesses;
// and joins [row, left, right] filling the gap under a row across that run, rounded into the bars above and below by
// half a thickness, so a slit beside a join ends in a half circle (two joins a thickness apart leave a round hole).
// Traced at the sheets' own sizes, they redraw them to within a pixel
interface Kumo {
  rows: [number, number][][];
  joins: [number, number, number][];
}

const KUMO: Kumo[] = [
  { rows: [[[3.6, 22.14]], [[0, 20.56]], [[4.12, 16.19], [17.59, 21.84]]], joins: [[0, 6.54, 7.81], [0, 12.11, 14.13], [1, 18.59, 19.57]] },
  { rows: [[[1.82, 9.28], [10.65, 19.25]], [[5.5, 18.67]], [[0, 9.87], [10.83, 15.79]]], joins: [[0, 6.5, 8.29], [1, 11.82, 14.8]] },
  { rows: [[[0, 8.78], [10.32, 18.51]], [[1.75, 19.42]], [[2.73, 7.23], [8.67, 15.36], [16.76, 20.55]]], joins: [[0, 13.88, 14.85], [1, 5.33, 6.24]] },
  { rows: [[[0.13, 2.25], [3.12, 18.13]], [[0, 17.96]], [[0.34, 8.57], [9.42, 12.57], [13.29, 18.89]]], joins: [[0, 6.1, 8.57], [1, 14.28, 16.96]] },
  { rows: [[[0.7, 4.44], [5.83, 16.4]], [[0.08, 17.66]], [[0, 8.9], [10.1, 15.61]]], joins: [[0, 6.82, 10.68], [1, 11.09, 13.41]] },
  { rows: [[[2.93, 10.83], [11.57, 19.95]], [[0, 15.25], [16.11, 20.32]], [[0, 7.77], [9.42, 18.55]]], joins: [[0, 12.56, 14.25], [1, 4.15, 6.79]] },
  { rows: [[[0, 5.55], [6.29, 20.21]], [[3.28, 22.09]], [[3.06, 14.11], [15.2, 19.38]]], joins: [[0, 10.26, 11.98], [1, 16.2, 18.39]] },
  { rows: [[[1.8, 5.97], [7.72, 19.67]], [[0, 14.54], [15.32, 17.88]], [[0.92, 3.48], [4.29, 10.49], [11.11, 15.92]]], joins: [[0, 10, 12.39], [1, 5.28, 8.11]] },
  { rows: [[[1.63, 10.11], [11.11, 15.82]], [[0, 16.81], [17.42, 19.51]], [[2.94, 18.83]]], joins: [[0, 4.42, 6.47], [1, 15.01, 15.81]] },
  { rows: [[[2.05, 14.37]], [[1.4, 3.09], [4.91, 17.56]], [[0, 14.25]]], joins: [[0, 10.21, 11.96], [1, 8.1, 10.82]] },
  { rows: [[[4.49, 14.7]], [[2.31, 12.64]], [[0, 15.3]]], joins: [[0, 6.76, 8.22], [1, 4.81, 5.84], [1, 8.77, 10.57]] },
  { rows: [[[5.15, 15.78]], [[0, 16.83]], [[2.83, 11.15]]], joins: [[0, 8.42, 10.1], [0, 11.97, 12.94], [1, 5.78, 8.15]] },
  { rows: [[[2.23, 12.15]], [[0, 15.91]]], joins: [[0, 6.97, 9.61]] },
  { rows: [[[0, 3.75], [6.73, 18.43]], [[1.5, 13.97]]], joins: [[0, 9.45, 11.47]] },
  { rows: [[[1.75, 17.17]], [[0, 12.11]]], joins: [[0, 3.83, 5.88]] },
  { rows: [[[3.97, 14.85]], [[2.01, 16.78]], [[0, 13.51]]], joins: [[0, 7.39, 8.87], [0, 11.35, 12.69], [1, 3.95, 5.94]] },
  { rows: [[[0, 13.83]], [[2.57, 15.9]], [[0.94, 3.04], [4.52, 12.95]]], joins: [[0, 5.42, 7.76], [1, 8.91, 10.43]] },
  { rows: [[[5.19, 14.66]], [[3.21, 17.7]], [[0, 15.42]]], joins: [[0, 9.33, 11.4], [1, 7.71, 9.14], [1, 12.01, 13.58]] },
  { rows: [[[0, 14.6]], [[1.93, 10.77], [12.01, 13.71]]], joins: [[0, 4.68, 7.76]] },
  { rows: [[[2.56, 5.41], [7.91, 15.89]], [[0, 17.38]], [[4.63, 13.07]]], joins: [[0, 10.56, 12.93], [1, 6.64, 7.91]] },
  { rows: [[[0, 14.42]], [[3.85, 17.27]]], joins: [[0, 6.52, 9.18]] },
  { rows: [[[1.63, 18.76]], [[0, 1.92], [3.15, 14.09]], [[2.18, 16.24]]], joins: [[0, 5.25, 7.44], [0, 10.12, 11.61], [1, 7.54, 9.37]] },
  { rows: [[[1.72, 12.74]], [[0, 9.27], [10.93, 14.89]]], joins: [[0, 4.32, 6.11]] },
  { rows: [[[2.76, 14.63]], [[0, 10.21], [11.23, 12.83]], [[4.23, 13.88]]], joins: [[0, 4.72, 6.23], [1, 6.14, 8.37]] },
  { rows: [[[0, 12.1]], [[1.48, 2.77], [3.83, 14.56]]], joins: [[0, 6.68, 9.32]] },
  { rows: [[[1.42, 13.72]], [[4.11, 16.56]], [[0, 11.46]]], joins: [[0, 9.56, 11.27], [1, 6.45, 8.82]] },
  { rows: [[[0, 2.69], [4.21, 17.23]], [[1.55, 13.1]]], joins: [[0, 8.53, 10.62]] },
  { rows: [[[1.15, 3.15], [5.37, 14.71]], [[1.8, 16.58]], [[0, 9.66], [12.68, 14.98]]], joins: [[0, 9.68, 12.49], [1, 5.18, 7.12]] },
  { rows: [[[0, 15.72]], [[2.39, 12.37]], [[3.69, 16.9]]], joins: [[0, 6.71, 9.54], [1, 5.79, 7.18]] },
];

export const KUMO_COUNT = KUMO.length;

// the widest cloud, in bar thicknesses
export const KUMO_WIDEST = Math.max(...KUMO.map(({ rows }) => Math.max(...rows.flat().map(([, right]) => right))));

// a number as GLSL writes a float
const glsl = (v: number) => {
  const text = v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0');
  return text === '-0.0' ? '0.0' : text;
};

// the clouds as GLSL: kumo(k, p), how far p lies outside cloud k's edge (inside, negative), in bar thicknesses, p from
// the cloud's middle, y down. Each built as it's drawn: its bars, then its joins rounded into them
export const KUMO_GLSL = `
// a bar half a thickness either side of its centre line y, its round ends' tips at x0 and x1
float kumoBar (vec2 p, float y, float x0, float x1) {
  return length(p - vec2(clamp(p.x, x0 + 0.5, x1 - 0.5), y)) - 0.5;
}

// a join across the gap whose middle line is y, from a to b, from the centre line of the bar above it to the one below,
// rounded into them by half a thickness
float kumoJoin (float d, vec2 p, float y, float a, float b) {
  vec2 q = abs(p - vec2(0.5 * (a + b), y)) - vec2(0.5 * (b - a), 1.0);
  float join = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return max(0.5, min(d, join)) - length(max(vec2(0.5 - d, 0.5 - join), 0.0));
}

float kumo (float k, vec2 p) {
  float d = 1e3;
${KUMO.map(({ rows, joins }, k) => {
    const middle = Math.max(...rows.flat().map(([, right]) => right)) / 2;
    const top = (2 * rows.length - 1) / 2;
    const bars = rows.flatMap((bars, i) => bars.map(([x0, x1]) => `d = min(d, kumoBar(p, ${glsl(2 * i + 0.5 - top)}, ${glsl(x0 - middle)}, ${glsl(x1 - middle)}));`));
    const fills = joins.map(([i, a, b]) => `d = kumoJoin(d, p, ${glsl(2 * i + 1.5 - top)}, ${glsl(a - middle)}, ${glsl(b - middle)});`);
    return `  if (k < ${glsl(k + 0.5)}) {\n    ${[...bars, ...fills].join('\n    ')}\n    return d;\n  }`;
  }).join('\n')}
  return d;
}
`;
