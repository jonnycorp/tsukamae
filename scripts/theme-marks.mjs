'use strict';

// dev-only: the marks the themes draw with, into public/themes/<slug>/.
// - Ink's brush: each stroke simulated bristle by bristle, a sumi brush's teardrop footprint held at 45°, every hair
//   carrying its own ink and laying it where the paper's tooth takes it, so the wet run of a stroke comes out solid and
//   its dry end breaks into streaks (kasure); its seals.
// - Wisteria's waves (seigaiha), drawn exactly, each pixel's coverage sampled 4 by 4; its clouds (suyari-gasumi), flat,
//   drawn exactly as vectors: round-ended bars, bridges, fillets.
// - Midnight's neon mountains, low-poly meshes of straight edges, as vectors; its meter's neon floor.
// - Ink's pond: koi and a droplet's ripples, in clean brush lines, in their colours.
// Most are alpha masks, coloured from the theme's own tones in styles/themes.scss; the unobtainable stroke and the art
// behind the rows come out in their colours. Seeded, so a run draws the same marks every time (yarn marks:themes)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encode } from './png.mjs';

const THEMES = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'themes');

// ---- chance: a seeded random (mulberry32), and smooth noise from it

function random (seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// value noise along a line, -1 to 1: a random value every `cell`, eased between
function noise1 (rand, cell) {
  const values = [];
  return (s) => {
    const i = Math.floor(s / cell);
    while (values.length <= i + 1) {
      values.push(rand() * 2 - 1);
    }
    const f = ease(s / cell - i);
    return values[i] * (1 - f) + values[i + 1] * f;
  };
}

// value noise over a field, 0 to 1, its cells `cellX` by `cellY`, wrapping at the field's edges so a tile repeats
function noise2 (rand, width, height, cellX, cellY = cellX) {
  const cols = Math.max(1, Math.round(width / cellX));
  const rows = Math.max(1, Math.round(height / cellY));
  const lattice = Float32Array.from({ length: cols * rows }, rand);
  const at = (i, j) => lattice[(((j % rows) + rows) % rows) * cols + (((i % cols) + cols) % cols)];
  return (x, y) => {
    const gx = (x / width) * cols;
    const gy = (y / height) * rows;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = ease(gx - x0);
    const fy = ease(gy - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

// the paper's tooth: three scales of noise, the finest weighed most, stretched along the strokes' run where `grain`
// says and scaled by `scale`; then ranked so it's even from 0 to 1, and a hair that takes ink below 0.6 inks six pixels
// in ten
function paperTooth (width, height, seed, grain = 1, scale = 1) {
  const rand = random(seed);
  const octaves = [[0.26, 9], [0.4, 3.2], [0.34, 1.3]].map(([weight, cell]) => [weight, noise2(rand, width, height, cell * grain * scale, cell * scale)]);
  const tooth = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tooth[y * width + x] = octaves.reduce((sum, [weight, field]) => sum + weight * field(x, y), 0);
    }
  }
  const order = Uint32Array.from(tooth.keys()).sort((a, b) => tooth[a] - tooth[b]);
  order.forEach((i, rank) => {
    tooth[i] = rank / order.length;
  });
  return tooth;
}

// ---- a sheet the marks are laid on: alpha alone, the darkest ink at a pixel staying

class Sheet {
  constructor (width, height, tooth) {
    this.width = width;
    this.height = height;
    this.alpha = new Float32Array(width * height);
    this.tooth = tooth;
  }

  // one touch: a disc of `radius` laying `amount` of ink where the paper takes it (its tooth under `take`), the disc's
  // rim and the paper's threshold both soft
  dab (x, y, radius, amount, take = 2) {
    const { width, height, alpha, tooth } = this;
    const x0 = Math.max(0, Math.floor(x - radius - 1));
    const x1 = Math.min(width - 1, Math.ceil(x + radius + 1));
    const y0 = Math.max(0, Math.floor(y - radius - 1));
    const y1 = Math.min(height - 1, Math.ceil(y + radius + 1));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const rim = radius + 0.5 - Math.hypot(px + 0.5 - x, py + 0.5 - y);
        if (rim <= 0) {
          continue;
        }
        const i = py * width + px;
        const caught = tooth ? (take - tooth[i]) * 14 + 0.5 : 1;
        if (caught <= 0) {
          continue;
        }
        const a = amount * Math.min(1, rim) * Math.min(1, caught);
        if (a > alpha[i]) {
          alpha[i] = a;
        }
      }
    }
  }

  // a cut of the sheet, `x` to `x + width`, as a mask: black, its alpha the ink; or in `rgb`, a colour or a colour for
  // each point
  mask (x = 0, width = this.width, strength = 1, rgb = [0, 0, 0]) {
    const pixels = Buffer.alloc(width * this.height * 4);
    for (let y = 0; y < this.height; y++) {
      for (let dx = 0; dx < width; dx++) {
        const o = (y * width + dx) * 4;
        [pixels[o], pixels[o + 1], pixels[o + 2]] = typeof rgb === 'function' ? rgb(x + dx, y) : rgb;
        pixels[o + 3] = Math.round(clamp(this.alpha[y * this.width + x + dx] * strength) * 255);
      }
    }
    return encode({ width, height: this.height, pixels });
  }
}

// ---- strokes

// a path through `points` ([x, y, pressure]) by Catmull-Rom, sampled every `step` along its length: [x, y, pressure,
// how far along, 0 to 1]
function along (points, step) {
  const dense = [];
  const at = (i) => points[Math.min(points.length - 1, Math.max(0, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < 120; k++) {
      const t = k / 120;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  dense.push(points[points.length - 1].slice());
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  const samples = [];
  for (let s = 0, j = 1; s <= total; s += step) {
    while (lengths[j] < s) {
      j++;
    }
    const f = (s - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1);
    const [a, b] = [dense[j - 1], dense[j]];
    samples.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, clamp(a[2] + (b[2] - a[2]) * f, 0, 1.5), s / total, s]);
  }
  return samples;
}

// a brush drawn along `points`: its footprint `size` long at full press and `body` as thick, held at `angle` (tip to
// belly, down and to the right); its hairs start with `ink`, each loaded up to `streak` short of it, and run dry from
// `dryFrom` of the way along by as much as `dryness`, a little all the way. A drying hair skips in its own rhythm, so
// the gaps run along the stroke as streaks rather than blots
function stroke (sheet, points, { size, angle = 45, body = 0.36, hairs = 180, ink = 1, streak = 0.18, dryFrom = 0.7, dryness = 0.8, seed }) {
  const rand = random(seed);
  const ax = Math.cos((angle * Math.PI) / 180);
  const ay = Math.sin((angle * Math.PI) / 180);
  const brush = Array.from({ length: hairs }, () => {
    const tau = Math.pow(rand(), 0.75);
    const v = rand() * 2 - 1;
    const half = body * Math.pow(tau, 0.7) * Math.sqrt(Math.max(0, 1 - Math.pow(tau, 3)));
    return {
      along: tau - 0.35,
      across: v * half,
      ink: ink * (1 - streak * rand()) * (1 - 0.3 * v * v),
      rate: 0.6 + 0.8 * rand(),
      wobble: noise1(rand, 24 + 40 * rand()),
      skip: noise1(rand, 5 + 14 * rand()),
      radius: 0.8 + 0.7 * rand(),
    };
  });
  for (const [x, y, p, t, s] of along(points, 0.45)) {
    const dry = dryness * Math.pow(clamp((t - dryFrom) / (1 - dryFrom)), 1.3) + 0.1 * t;
    const reach = size * p;
    for (const hair of brush) {
      const wet = hair.ink - hair.rate * dry;
      if (wet <= 0.03 || p <= 0.01) {
        continue;
      }
      const sideways = hair.across * reach + hair.wobble(s) * 0.7;
      const hx = x + ax * hair.along * reach - ay * sideways;
      const hy = y + ay * hair.along * reach + ax * sideways;
      const skipping = clamp(1 - wet) * hair.skip(s) * 0.55;
      const take = (wet * 1.55 - 0.18 + skipping) * (0.6 + 0.4 * Math.min(1, p));
      sheet.dab(hx, hy, hair.radius * (0.55 + 0.45 * Math.min(1, p)), Math.min(1, 0.55 + wet * 0.6), take);
    }
  }
}

// ink flicked off the brush: a few drops, each two or three overlapping discs, around (x, y) within `spread`
function spatter (sheet, rand, x, y, spread, count) {
  for (let i = 0; i < count; i++) {
    const dx = x + (rand() * 2 - 1) * spread[0];
    const dy = y + (rand() * 2 - 1) * spread[1];
    const r = 0.8 + rand() * rand() * 4;
    for (let k = 0; k < 3; k++) {
      sheet.dab(dx + (rand() - 0.5) * r, dy + (rand() - 0.5) * r, r * (0.6 + 0.4 * rand()), 1);
    }
  }
}

// ---- a seal's impression: a block with a worn rim, pressed a little unevenly, so the ink thins toward one corner and
// misses the paper's highest points

function seal (width, height, { inset, seed }) {
  const rand = random(seed);
  const sheet = new Sheet(width, height, paperTooth(width, height, seed + 1, 1, 0.55));
  const rims = [noise1(rand, 9), noise1(rand, 9), noise1(rand, 9), noise1(rand, 9)];
  const fine = [noise1(rand, 2.5), noise1(rand, 2.5), noise1(rand, 2.5), noise1(rand, 2.5)];
  const rim = (k, s) => inset + rims[k](s) * 2.2 + fine[k](s) * 0.7;
  const corner = inset * 0.9;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const left = x + 0.5 - rim(0, y);
      const right = width - x - 0.5 - rim(1, y);
      const top = y + 0.5 - rim(2, x);
      const bottom = height - y - 0.5 - rim(3, x);
      // the corners worn round: inside both edges by less than `corner`, measured as a circle's
      const cx = Math.min(left, right);
      const cy = Math.min(top, bottom);
      const inside = cx < corner && cy < corner ? corner - Math.hypot(corner - cx, corner - cy) : Math.min(cx, cy);
      // pressed harder at the lower left, so only the paper's highest points miss the ink, a few more toward the
      // upper right
      const press = 0.993 - 0.06 * clamp((x / width + (1 - y / height)) / 2 - 0.3);
      const i = y * width + x;
      const missed = clamp((sheet.tooth[i] - press) * 40 + 0.5);
      sheet.alpha[i] = clamp(inside + 0.5) * (1 - missed);
    }
  }
  return sheet;
}

// ---- Wisteria's gold: shapes drawn exactly

// a sheet from `coverage(x, y)`, how much of a point is inked (0 to 1), averaged over 16 points in each pixel; or, where
// `near(x, y)` says the pixel's centre is well clear of every edge, from that one point
function paint (width, height, coverage, near = () => true) {
  const sheet = new Sheet(width, height, null);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      if (near(x + 0.5, y + 0.5)) {
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 4; sx++) {
            sum += coverage(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4);
          }
        }
        sum /= 16;
      } else {
        sum = coverage(x + 0.5, y + 0.5);
      }
      sheet.alpha[y * width + x] = sum;
    }
  }
  return sheet;
}

// seigaiha, the blue sea's waves: scales of radius `r` in rows half a scale apart, each row laid over the one above,
// every scale ringed `rings` deep in lines `line` wide; a tile two scales wide and one high repeats seamlessly
function seigaiha (r, rings, line) {
  return paint(2 * r, r, (x, y) => {
    const row = Math.floor((2 * y) / r);
    for (let j = row + 2; j >= row - 2; j--) {
      const offset = ((j % 2) + 2) % 2 ? r : 0;
      const cx = Math.round((x - offset) / (2 * r)) * 2 * r + offset;
      const d = Math.hypot(x - cx, y - (j * r) / 2);
      if (d <= r) {
        for (let k = 1; k <= rings; k++) {
          if (Math.abs(d - (r * k) / rings + line / 2) < line / 2) {
            return 1;
          }
        }
        return 0;
      }
    }
    return 0;
  });
}

// suyari-gasumi, the mist a court's scrolls part their scenes with, drawn flat as a crest is: bars `t` thick with round
// ends, on tiers a bar's thickness apart, each tier's bars [left, right] in `tiers`, top to bottom; `bridges` [tier, a, b]
// join a tier to the next across a to b, every inside corner where a bridge meets a bar rounded by a fillet half a bar
// thick. Exact pieces (stadiums, rectangles, a square less a quarter circle at each corner) in one flat fill, laid at
// (x, y)
function kasumi ({ tiers, bridges }, x, y, t) {
  const f = t / 2;
  const num = (v) => Number(v.toFixed(2));
  const top = (i) => y + i * 2 * t;
  let pieces = '';
  tiers.forEach((bars, i) => {
    for (const [x0, x1] of bars) {
      pieces += `<rect x="${num(x + x0)}" y="${num(top(i))}" width="${num(x1 - x0)}" height="${t}" rx="${f}"/>`;
    }
  });
  for (const [i, a, b] of bridges) {
    const [left, right] = [x + a, x + b];
    // a bridge's run must lie in both bars' straight runs, a fillet clear of their round ends
    const clear = (bars) => bars.some(([x0, x1]) => a - f >= x0 + f && b + f <= x1 - f);
    if (!clear(tiers[i]) || !clear(tiers[i + 1])) {
      throw new Error(`kasumi: a bridge at ${a}..${b} from tier ${i} leaves its bars' straight runs`);
    }
    const under = top(i) + t;
    const over = top(i + 1);
    pieces += `<rect x="${num(left)}" y="${num(top(i) + f)}" width="${num(b - a)}" height="${num(over - top(i))}"/>`
      + `<path d="M${num(left - f)} ${num(under)}H${num(left)}V${num(under + f)}A${f} ${f} 0 0 0 ${num(left - f)} ${num(under)}Z`
      + `M${num(right + f)} ${num(under)}H${num(right)}V${num(under + f)}A${f} ${f} 0 0 1 ${num(right + f)} ${num(under)}Z`
      + `M${num(left - f)} ${num(over)}H${num(left)}V${num(over - f)}A${f} ${f} 0 0 1 ${num(left - f)} ${num(over)}Z`
      + `M${num(right + f)} ${num(over)}H${num(right)}V${num(over - f)}A${f} ${f} 0 0 0 ${num(right + f)} ${num(over)}Z"/>`;
  }
  return pieces;
}

// a strip of Wisteria's clouds, which the theme lays down its box grid anchored to the grid's left, right or centre
// (`side`, styles/themes.scss), `width` across and three rows of boxes (`row` each, top to top) tall, in one flat gold
// at `opacity`. Each cloud sits in the band under a row (`band` of the three), `y` from the band's top, the foot of the
// row's grid (`foot`, from the row's top): above it the cloud tucks behind that row, its foot past the next row's grid it
// tucks behind that. `inset` keeps a cloud anchored to a side clear of it, so none ever reaches the window's edge
function cloudStrip (clouds, side, { gold, opacity }, { width, row, foot, t, inset }) {
  const pieces = clouds.map(({ band, y, shape }) => {
    const long = Math.max(...shape.tiers.flat().map(([, right]) => right));
    const x = side === 'left' ? inset : side === 'right' ? width - inset - long : (width - long) / 2;
    return kasumi(shape, x, band * row + foot + y, t);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${3 * row}" viewBox="0 0 ${width} ${3 * row}"><g fill="rgb(${gold})" opacity="${opacity}">${pieces.join('')}</g></svg>\n`;
}

// ---- Midnight's mountains: neon wireframes, as a vaporwave horizon draws them

const fixed = (v) => Number(v.toFixed(2));
const point = ([x, y]) => `${fixed(x)} ${fixed(y)}`;
const shade = (a, b, t) => `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;

// a range's ridge, from its foot at x0 up through each peak ([x, height over `base`]) and down to its foot at x1, a
// saddle between each two, nearer the lower
function ridgeLine (x0, x1, base, foot, peaks, rand) {
  const ridge = [[x0, foot]];
  peaks.forEach(([px, h], i) => {
    if (i > 0) {
      const [qx, qh] = peaks[i - 1];
      ridge.push([qx + (px - qx) * (0.42 + 0.16 * rand()), base - Math.min(qh, h) * (0.3 + 0.25 * rand())]);
    }
    ridge.push([px, base - h]);
  });
  ridge.push([x1, foot]);
  return ridge;
}

// a low-poly range under its ridge: a contour halfway down and the foot below it, joined in triangles, each face flat
// and shaded from `light` (high) to `dark` (low), a little apart from its neighbours (`spread`)
function lowPoly (ridge, foot, rand, { light, dark, spread }) {
  const inner = ridge.slice(1, -1);
  const mid = inner.map(([x, y]) => [x + (rand() - 0.5) * 16, y + (foot - y) * (0.42 + 0.16 * rand())]);
  const low = mid.map(([x]) => [x + (rand() - 0.5) * 18, foot]);
  const ends = (row) => [ridge[0], ...row, ridge[ridge.length - 1]];
  const rows = [ends(inner), ends(mid), ends(low)];
  const top = Math.min(...ridge.map(([, y]) => y));
  const faces = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i + 1 < rows[r].length; i++) {
      faces.push([rows[r][i], rows[r][i + 1], rows[r + 1][i + 1]], [rows[r][i], rows[r + 1][i + 1], rows[r + 1][i]]);
    }
  }
  return faces
    .filter(([a, b, c]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) > 1)
    .map((face) => {
      const cy = face.reduce((sum, [, y]) => sum + y, 0) / 3;
      return { d: `M${face.map(point).join('L')}Z`, fill: shade(light, dark, clamp((cy - top) / (foot - top) + (rand() - 0.5) * spread)) };
    });
}

// a strip of them, three rows tall from `origin` down the grid: each range in the band under a row (`band` of the
// three), standing on the next row's tiles and sunk `sink` behind them, its foot fading out there, so under a short last
// row it fades into the page rather than standing on nothing; a lilac range behind the cyan one
function mountainStrip (ranges, tone, seed, { width, row, title, origin, sink }) {
  const rand = random(seed);
  let defs = '';
  let body = '';
  ranges.forEach(({ band, x0, x1, peaks, back }, i) => {
    const base = (band + 1) * row + title - origin;
    const foot = base + sink;
    const top = base - 100;
    defs += `<linearGradient id="f${i}" x1="0" y1="${fixed(top)}" x2="0" y2="${fixed(foot)}" gradientUnits="userSpaceOnUse"><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`
      + `<mask id="m${i}"><rect x="0" y="${fixed(top)}" width="${width}" height="${fixed(foot - top)}" fill="url(#f${i})"/></mask>`;
    const behind = ridgeLine(x0 + 14, x1 - 14, base, foot, back, rand);
    const front = ridgeLine(x0, x1, base, foot, peaks, rand);
    const ridge = `M${front.map(point).join('L')}`;
    const backFaces = lowPoly(behind, foot, rand, tone.back).map(({ d, fill }) => `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width=".4"/>`).join('');
    const frontFaces = lowPoly(front, foot, rand, tone.front).map(({ d, fill }) => `<path d="${d}" fill="${fill}" stroke="${tone.edge}" stroke-opacity="${tone.facet}" stroke-width=".7" stroke-linejoin="round"/>`).join('');
    body += `<g mask="url(#m${i})">${backFaces}`
      + `<path d="M${behind.map(point).join('L')}" fill="none" stroke="${tone.backEdge}" stroke-opacity=".55"/>${frontFaces}`
      + `<path d="${ridge}" fill="none" stroke="${tone.edge}" stroke-opacity="${tone.glow}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`
      + `<path d="${ridge}" fill="none" stroke="${tone.edge}" stroke-opacity="${tone.line}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${fixed(3 * row)}" viewBox="0 0 ${width} ${fixed(3 * row)}"><defs>${defs}</defs>${body}</svg>\n`;
}

// ---- Ink's pond: koi and a droplet's ripples, in clean brush lines, at `scale` times the size they're shown

// a point given along a koi or round a ripple, turned by `angle` (degrees) about (cx, cy), at `scale`
const placed = (cx, cy, angle, scale) => {
  const a = (angle * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return ([x, y, p]) => [(cx + x * c - y * s) * scale, (cy + x * s + y * c) * scale, p];
};

// a shape swept along `points` ([x, y, breadth]), a disc `size` wide at breadth 1, so it swells and tapers as they say
// and its edge is clean
function swept (sheet, points, size, amount = 1) {
  for (const [x, y, breadth] of along(points, 0.5)) {
    sheet.dab(x, y, Math.max(0.3, breadth * size), amount);
  }
}

// a patch of colour on a koi: an ellipse `rx` by `ry` at (x, y), turned by `angle`, its rim wandering with noise, laid
// on `sheet` where `body` has ink, so it stops at the fish's edge
function patch (sheet, body, { x, y, rx, ry, angle, seed }) {
  const { width, height } = sheet;
  const wander = noise2(random(seed), width, height, Math.max(rx, ry) * 0.55);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const reach = Math.max(rx, ry) * 1.5;
  for (let py = Math.max(0, Math.floor(y - reach)); py <= Math.min(height - 1, Math.ceil(y + reach)); py++) {
    for (let px = Math.max(0, Math.floor(x - reach)); px <= Math.min(width - 1, Math.ceil(x + reach)); px++) {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const forward = (dx * c + dy * s) / rx;
      const across = (dy * c - dx * s) / ry;
      const rim = (1 + (wander(px, py) - 0.5) * 0.9 - Math.hypot(forward, across)) * Math.min(rx, ry);
      const i = py * width + px;
      const ink = clamp(rim + 0.5) * body.alpha[i];
      if (ink > sheet.alpha[i]) {
        sheet.alpha[i] = ink;
      }
    }
  }
}

// a koi from above, as sumi-e paints one, swimming toward `heading` (degrees, 0 to the right), `length` nose to tail
// tip: a body swept nose to tail root, widest at the shoulders, edged in a line a little heavier on one side; a forked
// tail and pectoral and pelvic fins in a dilute wash, ribbed with fine lines; eyes and gills in the line's sumi.
// `patches` are where the colour lies along it (0 the nose, 1 the tail root), or none for a koi all of its `body`
function koi (parts, { cx, cy, heading, length, curve = 0.05, patches = [], gills = true, seed }, scale) {
  const at = placed(cx, cy, heading, scale);
  const reach = length * 0.78;
  const nose = length / 2;
  const breadth = length * 0.105 * scale;
  const bend = (t) => Math.sin(t * Math.PI) * curve * length;
  const point = (t, side = 0) => [nose - t * reach, bend(t) + side];
  const profile = [[0, 0.3], [0.03, 0.58], [0.09, 0.82], [0.2, 0.97], [0.32, 1], [0.5, 0.86], [0.7, 0.56], [0.88, 0.27], [1, 0.14]];
  const width = (t) => {
    const k = profile.findIndex(([stop]) => stop >= t);
    const [t0, w0] = profile[Math.max(0, k - 1)];
    const [t1, w1] = profile[k];
    return t1 === t0 ? w1 : w0 + (w1 - w0) * ease((t - t0) / (t1 - t0));
  };
  const spine = profile.map(([t, w]) => [...point(t), w]);

  // the fins under the body: each a fan of rays off its root, `spread` degrees either side of `angle` (off the heading,
  // 180 straight back) and `long` at the middle, shorter toward its edges, each ray bowed back as a fin trails in the
  // water; a wash of them laid close, ribbed with `ribs` fine lines
  const fin = (root, angle, spread, long, ribs, bow) => {
    const ray = (f) => {
      const a = ((angle + f * spread) * Math.PI) / 180;
      const r = long * (1 - 0.22 * f * f);
      const b = a + (bow * Math.PI) / 180;
      return [root, [root[0] + Math.cos(b) * r * 0.55, root[1] + Math.sin(b) * r * 0.55], [root[0] + Math.cos(a) * r, root[1] + Math.sin(a) * r]];
    };
    for (let f = -1; f <= 1.0001; f += 0.03) {
      const [a, b, c] = ray(f);
      swept(parts.fins, [[...a, 0.25], [...b, 0.7], [...c, 1]].map(at), length * 0.012 * scale);
    }
    for (let k = 0; k < ribs; k++) {
      const [a, b, c] = ray(ribs > 1 ? (2 * k) / (ribs - 1) - 1 : 0);
      swept(parts.ribs, [[...a, 0.8], [...b, 0.6], [...c, 0.15]].map(at), 0.7 * scale);
    }
  };
  [-1, 1].forEach((side) => {
    fin(point(0.21, side * length * 0.08), side * 118, 30, length * 0.19, 6, side * 14);
    fin(point(0.62, side * length * 0.04), side * 142, 22, length * 0.11, 4, side * 10);
    fin(point(0.985), 180 - side * 19, 17, length * 0.3, 6, -side * 9);
  });

  // the body, its edge a line a touch heavier on the side away from the light
  swept(parts.line, spine.map(([x, y, w]) => [x - 0.2, y + 0.35, w + 0.05]).map(at), breadth);
  swept(parts.body, spine.map(at), breadth);

  // the colour, in the body's shape
  const onBody = (t, side) => {
    const [x, y] = at([...point(t, side), 0]);
    return { x, y };
  };
  patches.forEach(({ t, side = 0, long, wide, tilt = 0 }, k) => {
    patch(parts.colour, parts.body, { ...onBody(t, side * length), rx: long * length * scale, ry: wide * length * scale, angle: ((heading + tilt) * Math.PI) / 180, seed: seed + 7 * k });
  });

  // the eyes, a gill's short arc on a koi that shows one, and a dorsal line down the back
  [-1, 1].forEach((side) => {
    const eye = at([...point(0.075, side * width(0.075) * length * 0.078), 1]);
    parts.marks.dab(eye[0], eye[1], length * 0.0058 * scale, 1);
    if (gills) {
      const gill = [0.15, 0.165, 0.15].map((t, k) => [...point(t, side * width(t) * length * [0.46, 0.68, 0.9][k] * 0.105), 0.5]);
      swept(parts.marks, gill.map(at), 0.7 * scale, 0.6);
    }
  });
  swept(parts.marks, [[...point(0.36), 0.05], [...point(0.5), 0.5], [...point(0.66), 0.05]].map(at), 1 * scale, 0.42);
}

// a droplet's ripples on water seen at a slant (rings `squash` as tall as wide): each ring an open line that swells and
// tapers, fainter outward, the drop itself a touch at the middle
function ripples (sheet, { cx, cy, radii, squash = 0.34, seed }, scale) {
  const rand = random(seed);
  radii.forEach((r, i) => {
    const start = rand() * Math.PI * 2;
    const sweep = Math.PI * (1.45 + 0.4 * rand());
    const ring = Array.from({ length: 49 }, (_, k) => {
      const t = start + (sweep * k) / 48;
      return [(cx + Math.cos(t) * r) * scale, (cy + Math.sin(t) * r * squash) * scale, Math.sin((k / 48) * Math.PI) ** 0.8];
    });
    swept(sheet, ring, (1.5 - i * 0.2) * scale, 1 - i * 0.17);
  });
  sheet.dab(cx * scale, cy * scale, 2 * scale, 1);
}

// sheets laid one over another in their colours (`strength` how much of the ink holds), lowest first: an RGBA PNG
function layered (width, height, layers) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let [r, g, b, a] = [0, 0, 0, 0];
    for (const { sheet, rgb, strength = 1 } of layers) {
      const ink = clamp(sheet.alpha[i] * strength);
      if (ink > 0) {
        const under = a * (1 - ink);
        const out = ink + under;
        [r, g, b] = [r, g, b].map((v, c) => (rgb[c] * ink + v * under) / out);
        a = out;
      }
    }
    pixels.set([Math.round(r), Math.round(g), Math.round(b), Math.round(a * 255)], i * 4);
  }
  return encode({ width, height, pixels });
}

// a koi alone, swimming right as the dex reads, in a sheet just large enough for it and its fins: a kohaku's white body
// with vermilion on it, a sumi koi all ink, their fins a dilute sumi. At `scale` times the size it's shown
function koiAlone (kind, { length, ...item }, seed, scale) {
  const [w, h] = [Math.round(length * 1.26), Math.round(length * 0.7)];
  const sheet = () => new Sheet(w * scale, h * scale, null);
  const parts = { fins: sheet(), ribs: sheet(), line: sheet(), body: sheet(), colour: sheet(), marks: sheet() };
  koi(parts, { cx: length * 0.63, cy: h / 2, heading: 0, length, ...item, seed }, scale);
  const [sumi, vermilion, shell] = [[38, 32, 30], [208, 66, 34], [249, 245, 238]];
  const kohaku = kind === 'kohaku';
  return layered(w * scale, h * scale, [
    { sheet: parts.fins, rgb: sumi, strength: kohaku ? 0.13 : 0.2 },
    { sheet: parts.ribs, rgb: sumi, strength: kohaku ? 0.4 : 0.5 },
    { sheet: parts.line, rgb: sumi },
    { sheet: parts.body, rgb: kohaku ? shell : sumi, strength: kohaku ? 1 : 0.94 },
    { sheet: parts.colour, rgb: vermilion },
    { sheet: parts.marks, rgb: kohaku ? sumi : shell, strength: kohaku ? 1 : 0.7 },
  ]);
}

// a droplet's rings alone, `squash` as tall as wide (the pond's seen at a slant, a tile from above), in a sheet just
// large enough for the outer one: a mask, coloured by the theme. At `scale` times the size it's shown
function rings (radii, squash, seed, scale) {
  const reach = radii[radii.length - 1] + 4;
  const [w, h] = [Math.ceil(2 * reach), Math.ceil(2 * reach * squash + 8)];
  const sheet = new Sheet(w * scale, h * scale, null);
  ripples(sheet, { cx: w / 2, cy: h / 2, radii, squash, seed }, scale);
  return sheet.mask();
}

// ---- seal materials' patterns: seamless tiles, each a period a theme's flow moves (styles/themes.scss)

const smoothstep = (edge0, edge1, v) => ease(clamp((v - edge0) / (edge1 - edge0)));

// fractal noise over a tile, 0 to 1, wrapping: `octaves` of value noise, the first in cells `cellX` by `cellY`, each next
// at half the size and half the weight
function fbm (rand, width, height, cellX, cellY, octaves) {
  const layers = Array.from({ length: octaves }, (_, k) => noise2(rand, width, height, cellX / 2 ** k, cellY / 2 ** k));
  const total = layers.reduce((sum, _layer, k) => sum + 0.5 ** k, 0);
  return (x, y) => layers.reduce((sum, layer, k) => sum + layer(x, y) * 0.5 ** k, 0) / total;
}

// Ink: mist in a diluted ink, long soft banks of it, as a sumi-e painter leaves between mountains
function inkMist (width, height, seed) {
  const field = fbm(random(seed), width, height, width / 3, height / 3, 4);
  return paint(width, height, (x, y) => smoothstep(0.46, 0.74, field(x, y)), () => false);
}

// Matcha: the shadow a shoji's lattice casts, light falling through the paper between its bars: a bar `bar` wide on
// each edge of a pane, its shadow softening over `blur`
function shoji (width, height, bar, blur) {
  const shade = (d) => 1 - smoothstep(bar / 2, bar / 2 + blur, d);
  return paint(width, height, (x, y) => Math.max(shade(Math.min(x, width - x)), shade(Math.min(y, height - y))), () => false);
}

// Game Boy: water as the old games' tiles drew it, two rows of crests a pixel wide in a 16 by 8 tile, each pixel
// `scale` across
function pixelWater (scale) {
  const art = new Set();
  for (let x = 0; x < 16; x++) {
    const crest = Math.round(1.5 + 1.5 * Math.sin((2 * Math.PI * x) / 16));
    art.add(`${x},${crest}`);
    art.add(`${(x + 8) % 16},${crest + 4}`);
  }
  return paint(16 * scale, 8 * scale, (x, y) => (art.has(`${Math.floor(x / scale)},${Math.floor(y / scale)}`) ? 1 : 0), () => false);
}

// Ember: magma's veins, the ridges of fractal noise glowing where they crest, a softer glow round them
function magma (size, seed) {
  const field = fbm(random(seed), size, size, size / 4, size / 4, 4);
  return paint(size, size, (x, y) => {
    const ridge = 1 - Math.abs(2 * field(x, y) - 1);
    return Math.max(smoothstep(0.87, 0.97, ridge), 0.18 * smoothstep(0.8, 0.95, ridge));
  }, () => false);
}

// Harbor: caustics, the bright net light draws through moving water: the edges between the cells of points scattered
// one to a cell (the nearest two points all but equal), the net bent hard by noise so its lines run in curves, and lit
// unevenly, brightest where the light gathers
function caustics (size, cells, seed) {
  const rand = random(seed);
  const cell = size / cells;
  const points = Array.from({ length: cells * cells }, (_, i) => [((i % cells) + 0.15 + 0.7 * rand()) * cell, (Math.floor(i / cells) + 0.15 + 0.7 * rand()) * cell]);
  const bendX = fbm(rand, size, size, size / 2, size / 2, 3);
  const bendY = fbm(rand, size, size, size / 2, size / 2, 3);
  const light = fbm(rand, size, size, size / 3, size / 3, 2);
  const width = size / 160;
  return paint(size, size, (px, py) => {
    const x = px + (bendX(px, py) - 0.5) * cell * 1.1;
    const y = py + (bendY(px, py) - 0.5) * cell * 1.1;
    let first = Infinity;
    let second = Infinity;
    for (const [cx, cy] of points) {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const d = Math.hypot(x - cx - ox, y - cy - oy);
          if (d < first) {
            second = first;
            first = d;
          } else if (d < second) {
            second = d;
          }
        }
      }
    }
    return (1 - smoothstep(0, width * 3, second - first)) * (0.35 + 0.65 * smoothstep(0.3, 0.7, light(px, py)));
  }, () => false);
}

// ---- the marks

// a mark is written only when it changed, so a run leaves the rest untouched (a dev server watching public/ reloads on
// every write)
const write = (slug, name, png) => {
  const file = join(THEMES, slug, name);
  const bytes = Buffer.from(png);
  if (existsSync(file) && readFileSync(file).equals(bytes)) {
    console.log(`public/themes/${slug}/${name}: ${bytes.length} bytes, unchanged`);
    return;
  }
  mkdirSync(join(THEMES, slug), { recursive: true });
  writeFileSync(file, bytes);
  console.log(`public/themes/${slug}/${name}: ${bytes.length} bytes`);
};

// a box's title, brushed in: entered at 45°, pressed flat across, drying out at its end with a few drops flicked off
{
  const sheet = new Sheet(720, 112, paperTooth(720, 112, 11, 3.5));
  stroke(sheet, [[30, 14, 0.2], [48, 28, 0.8], [76, 36, 1.04], [220, 33, 1], [400, 28, 1.06], [560, 30, 0.98], [650, 35, 0.84], [702, 42, 0.55]], { size: 108, dryFrom: 0.84, dryness: 1.1, seed: 12 });
  spatter(sheet, random(13), 676, 50, [34, 46], 8);
  write('ink', 'title.png', sheet.mask());
}

// the meter's stroke, cut in three so its middle stretches to the fill's length and its two ends keep their shape: a
// wet entry, a run streaked at its edges, a dry end
{
  const sheet = new Sheet(2000, 86, paperTooth(2000, 86, 21, 4));
  stroke(sheet, [[26, 19, 0.2], [42, 31, 0.8], [66, 37, 1], [300, 34, 0.98], [900, 32, 0.96], [1500, 34, 0.95], [1800, 36, 0.86], [1990, 40, 0.6]], { size: 84, dryFrom: 0.83, dryness: 0.95, ink: 0.97, seed: 22 });
  write('ink', 'meter-head.png', sheet.mask(0, 150));
  write('ink', 'meter-body.png', sheet.mask(150, 1500));
  write('ink', 'meter-tail.png', sheet.mask(1650, 350));
}

// the length still to go: the same stroke's ghost, brushed nearly dry
{
  const sheet = new Sheet(2000, 86, paperTooth(2000, 86, 31, 4));
  stroke(sheet, [[20, 23, 0.3], [60, 35, 0.95], [700, 33, 0.96], [1400, 35, 0.94], [1990, 38, 0.8]], { size: 84, ink: 0.78, streak: 0.85, dryFrom: 0.1, dryness: 0.3, seed: 32 });
  write('ink', 'track.png', sheet.mask());
}

// seals: the meter's figure in a wide one, the bar's mark in a square one
write('ink', 'seal-wide.png', seal(330, 120, { inset: 6, seed: 41 }).mask());
write('ink', 'seal.png', seal(120, 120, { inset: 6, seed: 51 }).mask());

// an unobtainable slot struck through with one falling stroke (ノ), pressed at the top and swept off to nothing
{
  const sheet = new Sheet(160, 160, paperTooth(160, 160, 61));
  stroke(sheet, [[116, 16, 0.35], [122, 25, 0.95], [114, 44, 1], [92, 84, 0.8], [60, 120, 0.44], [24, 148, 0.02]], { size: 30, body: 0.4, hairs: 90, ink: 0.92, dryFrom: 0.5, dryness: 0.55, seed: 62 });
  write('ink', 'slash.png', sheet.mask(0, 160, 0.14));
}

// Wisteria: the waves, at twice the size they're shown so they stay crisp under the dex's zoom (a scale 32px across)
write('wisteria', 'seigaiha.png', seigaiha(32, 4, 2.2).mask());

// and its tiles' waves at night, larger (a scale 64px across), their lines as thin
write('wisteria', 'seigaiha-large.png', seigaiha(64, 4, 2.2).mask());

// art laid behind the rows of boxes (Wisteria's clouds, Midnight's mountains, Ink's pond), in strips 520 wide and three
// rows of boxes tall, which a theme repeats down its box grid (styles/themes.scss). Keep in step with $art-row there: a
// row, top to top, is a box's title line and margin, its tiles in their frame, and the gap under it
const ART_TITLE = 25 * 1.35 + 10;
const ART_ROW = ART_TITLE + 5 * 110 + 2 + 60;
const ART_WIDTH = 520;
// Midnight's and Ink's strips start inside the first row's tiles, 200 down the grid ($art-origin), so a band never meets
// a strip's end; Wisteria's start at the grid's top
const ART_ORIGIN = 200;

// and its clouds behind the rows of boxes, flat, as a crest draws suyari-gasumi: a period of three rows, a cloud or two
// in the band under each, tucking behind the row above or the row below, so the boxes always lie over them. The band
// under the third row is also the one over the first, where only clouds tucking up may go: they lie above the grid
// there, and so never show; past the last row the grid ends. Strips anchored left and right reach the page's margins; at
// any width the clouds of one band never meet. In the night's gold: the theme lays them in Soft Dark alone
{
  // bars 9 thick, a cloud of three tiers 45 tall: one tucks its top bar behind the row above (9 over the band's top), or
  // its bottom bar behind the next row's tiles (its foot 9 past their top, 103.75 below the band's)
  const t = 9;
  const geometry = { width: ART_WIDTH, row: ART_ROW, foot: ART_ROW - 60, t, inset: 24 };
  const shapes = {
    wide: { tiers: [[[70, 330]], [[0, 170], [205, 430]], [[120, 360], [380, 425]]], bridges: [[0, 95, 125], [0, 240, 275], [1, 135, 158], [1, 255, 290]] },
    small: { tiers: [[[40, 190]], [[0, 120], [150, 210]], [[60, 160]]], bridges: [[0, 60, 85], [0, 160, 180], [1, 80, 105]] },
    across: { tiers: [[[150, 380]], [[0, 230], [260, 470]], [[90, 300], [330, 420]]], bridges: [[0, 170, 200], [0, 300, 330], [1, 120, 150], [1, 360, 390]] },
    right: { tiers: [[[140, 400]], [[30, 220], [250, 420]], [[0, 190], [230, 340]]], bridges: [[0, 160, 190], [0, 300, 330], [1, 60, 90], [1, 270, 300]] },
  };
  // only the left strip tucks a cloud behind the row below, short, under its first box, which every row has: under a
  // last row's empty places a cloud would lie whole in the open
  const clouds = {
    left: [
      { band: 0, y: -t, shape: shapes.wide },
      { band: 1, y: 103.75 + t - 5 * t, shape: shapes.small },
    ],
    right: [{ band: 2, y: -t, shape: shapes.right }],
    centre: [{ band: 1, y: -t, shape: shapes.across }],
  };
  const tone = { gold: [240, 198, 100], opacity: 0.32 };
  Object.entries(clouds).forEach(([side, list]) => {
    write('wisteria', `clouds-${side}.svg`, cloudStrip(list, side, tone, geometry));
  });
}

// Ink's pond under the boxes, alive (styles/themes.scss swims and spreads them): a kohaku and a sumi koi, each alone,
// facing right as the dex reads; a droplet's rings on the pond, seen at a slant; and a drop's rings on a tile pressed,
// seen from above. At twice the size they're shown, so the lines stay crisp under the dex's zoom
write('ink', 'koi-kohaku.png', koiAlone('kohaku', {
  length: 120,
  curve: 0.04,
  patches: [{ t: 0.1, long: 0.075, wide: 0.06 }, { t: 0.42, side: 0.012, long: 0.13, wide: 0.075, tilt: 8 }, { t: 0.78, side: -0.006, long: 0.075, wide: 0.05 }],
}, 131, 2));
write('ink', 'koi-sumi.png', koiAlone('sumi', { length: 110, curve: -0.04, gills: false }, 141, 2));
write('ink', 'ripple.png', rings([12, 27, 46], 0.34, 151, 2));
write('ink', 'drop.png', rings([9, 20, 32], 1, 161, 2));

// a sealed tile's ensō, the circle a brush draws in one breath: entered at the left, carried round over the top and
// back under, pressed hardest through the turn and run dry before it closes, the gap left open. Faint, in the sumi
{
  const size = 200;
  const sheet = new Sheet(size, size, paperTooth(size, size, 171, 1.5));
  const r = 72;
  const points = Array.from({ length: 14 }, (_, k) => {
    const a = ((196 + k * 24.5) * Math.PI) / 180;
    const press = [0.3, 0.85, 1, 1.04, 1.06, 1.04, 1, 1, 0.98, 0.95, 0.92, 0.88, 0.8, 0.62][k];
    return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r, press];
  });
  stroke(sheet, points, { size: 36, body: 0.44, hairs: 150, ink: 0.97, streak: 0.24, dryFrom: 0.62, dryness: 0.95, seed: 172 });
  write('ink', 'enso.png', sheet.mask(0, size, 0.11));
}

// the bar's foot brushed on: one broad stroke along its lower edge, its underside ragged with the brush's hairs and
// drying toward the right, the band above it solid so it joins the bar. Stretched to the window's width
{
  const [w, h] = [2400, 40];
  const sheet = new Sheet(w, h, paperTooth(w, h, 181, 4));
  stroke(sheet, [[-40, 3, 1], [500, 4, 1.02], [1100, 6, 1], [1700, 5, 0.98], [2200, 6, 0.94], [2440, 7, 0.86]], { size: 64, ink: 0.98, streak: 0.3, dryFrom: 0.55, dryness: 0.7, seed: 182 });
  sheet.alpha.fill(1, 0, w * 8);
  write('ink', 'bar-edge.png', sheet.mask());
}

// Midnight's meter at night: its filled length a neon floor in perspective, as the sunset at its far end draws one, the
// horizon along its top, rows nearer the eye further apart and rays from the vanishing point at the track's right end,
// where the sun sets. Stretched to the track (the theme sizes it so), every line kept a hair wide at any stretch
{
  const [w, h] = [1000, 40];
  let lines = '';
  for (let k = 1; k <= 7; k++) {
    lines += `M0 ${fixed(h * (k / 7) ** 1.8)}H${w}`;
  }
  for (let k = 0; k < 26; k++) {
    lines += `M${w} 0L${fixed(w - 60 - k * k * 2.2 - k * 34)} ${h}`;
  }
  write('midnight', 'floor.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${lines}" fill="none" stroke="#ff4fd8" stroke-opacity=".75" vector-effect="non-scaling-stroke"/></svg>\n`);
}

// Midnight's mountains behind the rows of boxes, its Soft Dark a vaporwave night: on the boxes' outer flanks, clear of
// their names (the left strip's x 20 to 196, a first box's; the right's 324 to 500, a last box's 466 to 642), varied
// over the three rows, in the neon cyan of its grid and the lavender of its tiles
{
  const ranges = {
    left: [
      { band: 0, x0: 20, x1: 196, peaks: [[52, 64], [104, 92], [156, 58]], back: [[78, 76], [140, 86]] },
      { band: 2, x0: 26, x1: 188, peaks: [[70, 70], [128, 82]], back: [[104, 92]] },
    ],
    right: [
      { band: 1, x0: 324, x1: 500, peaks: [[360, 60], [414, 94], [466, 66]], back: [[386, 80], [446, 74]] },
      { band: 2, x0: 336, x1: 494, peaks: [[384, 62], [446, 78]], back: [[420, 88]] },
    ],
  };
  const tone = {
    edge: '#3fe8ff', line: 0.9, glow: 0.2, facet: 0.42, backEdge: '#b98cff',
    front: { light: [44, 38, 104], dark: [16, 14, 44], spread: 0.35 },
    back: { light: [92, 66, 150], dark: [36, 26, 72], spread: 0.25 },
  };
  const geometry = { width: ART_WIDTH, row: ART_ROW, title: ART_TITLE, origin: ART_ORIGIN, sink: 18 };
  Object.entries(ranges).forEach(([side, list], i) => {
    write('midnight', `mountains-${side}.svg`, mountainStrip(list, tone, 7 + i, geometry));
  });
}

// seal materials' patterns, each a seamless tile of what its theme's flow moves: Ink's mist and Matcha's shoji light at
// the size they're shown, the rest at twice it so they stay crisp under the dex's zoom
write('ink', 'mist.png', inkMist(512, 256, 101).mask());
write('matcha', 'shoji.png', shoji(192, 240, 6, 14).mask());
write('game-boy', 'water.png', pixelWater(6).mask());
write('ember', 'magma.png', magma(384, 111).mask());
write('harbor', 'caustics.png', caustics(640, 5, 121).mask());
