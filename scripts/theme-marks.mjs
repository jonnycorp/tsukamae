'use strict';

// dev-only: the marks the themes draw with, into public/themes/<slug>/.
// - Ink's brush: each stroke simulated bristle by bristle, a sumi brush's teardrop footprint held at 45°, every hair
//   carrying its own ink and laying it where the paper's tooth takes it, so the wet run of a stroke comes out solid and
//   its dry end breaks into streaks (kasure).
// - Wisteria's waves (seigaiha), drawn exactly, each pixel's coverage sampled 4 by 4.
// - the seal materials' patterns (Matcha, Game Boy, Ember, Harbor).
// Alpha masks, coloured from the theme's own tones in its stylesheet. Seeded, so a run draws the same marks every time
// (yarn marks:themes)

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

// ---- seal materials' patterns: seamless tiles, each a period a theme's flow moves (styles/themes.scss)

const smoothstep = (edge0, edge1, v) => ease(clamp((v - edge0) / (edge1 - edge0)));

// fractal noise over a tile, 0 to 1, wrapping: `octaves` of value noise, the first in cells `cellX` by `cellY`, each next
// at half the size and half the weight
function fbm (rand, width, height, cellX, cellY, octaves) {
  const layers = Array.from({ length: octaves }, (_, k) => noise2(rand, width, height, cellX / 2 ** k, cellY / 2 ** k));
  const total = layers.reduce((sum, _layer, k) => sum + 0.5 ** k, 0);
  return (x, y) => layers.reduce((sum, layer, k) => sum + layer(x, y) * 0.5 ** k, 0) / total;
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

// Ink's brush stroke, entered at 45°, pressed flat across, drying out at its end with a few drops flicked off: its
// boxes' titles and its page change (styles/themes2/_shodo.scss)
{
  const sheet = new Sheet(720, 112, paperTooth(720, 112, 11, 3.5));
  stroke(sheet, [[30, 14, 0.2], [48, 28, 0.8], [76, 36, 1.04], [220, 33, 1], [400, 28, 1.06], [560, 30, 0.98], [650, 35, 0.84], [702, 42, 0.55]], { size: 108, dryFrom: 0.84, dryness: 1.1, seed: 12 });
  spatter(sheet, random(13), 676, 50, [34, 46], 8);
  write('ink', 'title.png', sheet.mask());
}

// Wisteria's tiles' waves (seigaiha), a scale 64px across, at twice the size they're shown so they stay crisp under
// the dex's zoom
write('wisteria', 'seigaiha-large.png', seigaiha(64, 4, 2.2).mask());

// seal materials' patterns, each a seamless tile of what its theme's flow moves: Matcha's shoji light at the size it's
// shown, the rest at twice it so they stay crisp under the dex's zoom
write('matcha', 'shoji.png', shoji(192, 240, 6, 14).mask());
write('game-boy', 'water.png', pixelWater(6).mask());
write('ember', 'magma.png', magma(384, 111).mask());
write('harbor', 'caustics.png', caustics(640, 5, 121).mask());
