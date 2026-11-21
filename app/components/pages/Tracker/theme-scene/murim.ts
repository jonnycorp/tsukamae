import { canvas, rng } from './texture';

import type { SceneMaker } from './scene';

// Murim: a shan shui scroll, ink on xuan paper. Karst peaks rising out of the mist in ranks, each laid in washes darker
// at its crest and lost into the cloud at its foot, pines leaning from the nearest, a waterfall dropping between them;
// a line of Li Bai's in a column at the top right and the painter's red seal under it. The painting is laid once for
// the window's size; over it, the mist drifts slowly along the valleys and a few cranes cross the sky, their wings
// beating slowly
const POEM = '飛流直下三千尺';

function painting (width: number, height: number, dpr: number): HTMLCanvasElement {
  const [c, ctx] = canvas(Math.round(width * dpr), Math.round(height * dpr));
  ctx.scale(dpr, dpr);
  const random = rng(31);
  // the paper: warm, a little deeper toward its edges as an old scroll's is
  const paper = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.2, width / 2, height / 2, height * 1.1);
  paper.addColorStop(0, '#f3ecdc');
  paper.addColorStop(1, '#ddd2b8');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  // a peak: a tall pillar of rock, its sides stepping in and out as karst does, washed darker toward its crest
  const peak = (x: number, base: number, w: number, h: number, ink: number) => {
    const top = base - h;
    const steps = 9;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const y = base - (h * i) / steps;
      const narrow = 1 - 0.55 * (i / steps) ** 1.4;
      left.push([x - (w / 2) * narrow * (0.85 + 0.3 * random()), y]);
      right.push([x + (w / 2) * narrow * (0.85 + 0.3 * random()), y]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const [px, py] of left) {
      ctx.lineTo(px, py);
    }
    ctx.quadraticCurveTo(x + (random() - 0.5) * w * 0.3, top - h * 0.06, right[steps][0], right[steps][1]);
    for (let i = steps; i >= 0; i--) {
      ctx.lineTo(right[i][0], right[i][1]);
    }
    ctx.closePath();
    const wash = ctx.createLinearGradient(0, top, 0, base);
    wash.addColorStop(0, `rgba(28, 26, 24, ${ink})`);
    wash.addColorStop(0.45, `rgba(40, 38, 34, ${ink * 0.55})`);
    wash.addColorStop(1, 'rgba(60, 56, 50, 0)');
    ctx.fillStyle = wash;
    ctx.fill();
    // the brush's line down its shaded side, soft and broken toward the foot
    ctx.save();
    ctx.clip();
    const side = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    side.addColorStop(0, `rgba(20, 18, 16, ${ink * 0.5})`);
    side.addColorStop(0.35, 'rgba(20, 18, 16, 0)');
    ctx.fillStyle = side;
    ctx.fillRect(x - w, top - h * 0.1, w * 2, h * 1.1);
    ctx.restore();
    return { x, top };
  };

  // a pine leaning out from a crest as the welcoming pine does: a crooked trunk, its boughs reaching out level to one
  // side, the needles at each bough's end a flat-topped cloud of ink
  const pine = (x: number, y: number, s: number, lean: number) => {
    ctx.strokeStyle = 'rgba(24, 22, 20, 0.88)';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.06;
    const tx = x + lean * s * 0.18;
    const ty = y - s * 0.62;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - lean * s * 0.12, y - s * 0.2, tx + lean * s * 0.1, y - s * 0.4, tx, ty);
    ctx.stroke();
    const boughs = [[0.35, 0.75], [0.6, 0.55], [0.85, 0.4], [1.0, 0.25]];
    for (const [at, reach] of boughs) {
      const bx = x + (tx - x) * at;
      const by = y + (ty - y) * at;
      const ex = bx + lean * s * reach;
      const ey = by - s * 0.04;
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo((bx + ex) / 2, by + s * 0.03, ex, ey);
      ctx.stroke();
      // the needle cloud: a row of overlapping mounds over a flat underside
      ctx.fillStyle = 'rgba(22, 26, 22, 0.82)';
      const cw = s * (0.2 + reach * 0.25);
      ctx.beginPath();
      ctx.moveTo(ex - cw, ey + s * 0.03);
      for (let k = 0; k <= 4; k++) {
        const mx = ex - cw + (k / 4) * cw * 2;
        ctx.arc(mx, ey + s * 0.02, s * (0.045 + 0.02 * random()), Math.PI, 0);
      }
      ctx.lineTo(ex + cw, ey + s * 0.035);
      ctx.closePath();
      ctx.fill();
    }
  };

  // ranks of peaks, the far ones pale and the near dark; mist lying between each rank
  const ranks = [
    { n: 9, base: 0.62, h: [0.2, 0.32], w: [0.05, 0.09], ink: 0.18 },
    { n: 7, base: 0.76, h: [0.28, 0.42], w: [0.07, 0.12], ink: 0.32 },
    { n: 5, base: 0.95, h: [0.35, 0.55], w: [0.09, 0.16], ink: 0.55 },
    { n: 3, base: 1.12, h: [0.5, 0.75], w: [0.14, 0.2], ink: 0.8 },
  ];
  const crests: { x: number; top: number; s: number }[] = [];
  ranks.forEach((rank, r) => {
    for (let i = 0; i < rank.n; i++) {
      // the nearest rank keeps to the sides, leaving the middle open as the painters did
      const spread = r === 3 ? (i % 2 ? 0.82 + random() * 0.15 : 0.03 + random() * 0.15) : (i + random() * 0.8) / rank.n;
      const h = (rank.h[0] + random() * (rank.h[1] - rank.h[0])) * height;
      const w = (rank.w[0] + random() * (rank.w[1] - rank.w[0])) * width;
      const p = peak(spread * width, rank.base * height, w, h, rank.ink);
      if (r >= 2) {
        crests.push({ ...p, s: w * 0.7 });
      }
    }
    // mist over the rank's foot
    const mist = ctx.createLinearGradient(0, rank.base * height - height * 0.16, 0, rank.base * height);
    mist.addColorStop(0, 'rgba(243, 236, 220, 0)');
    mist.addColorStop(1, 'rgba(243, 236, 220, 0.95)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, rank.base * height - height * 0.16, width, height * 0.16 + height * 0.3);
  });
  for (const { x, top, s } of crests) {
    if (random() < 0.7) {
      pine(x + (random() - 0.5) * s * 0.4, top + s * 0.1, s * (0.5 + random() * 0.4), random() < 0.5 ? -1 : 1);
    }
  }

  // the waterfall, a pale ribbon dropping between the near peaks, misting at its foot
  const fx = width * 0.74;
  const fall = ctx.createLinearGradient(0, height * 0.3, 0, height * 0.8);
  fall.addColorStop(0, 'rgba(246, 241, 228, 0.9)');
  fall.addColorStop(1, 'rgba(246, 241, 228, 0)');
  ctx.fillStyle = fall;
  ctx.fillRect(fx, height * 0.3, width * 0.016, height * 0.5);
  const spray = ctx.createRadialGradient(fx + width * 0.008, height * 0.8, 0, fx + width * 0.008, height * 0.8, height * 0.08);
  spray.addColorStop(0, 'rgba(246, 241, 228, 0.9)');
  spray.addColorStop(1, 'rgba(246, 241, 228, 0)');
  ctx.fillStyle = spray;
  ctx.fillRect(fx - height * 0.1, height * 0.7, height * 0.2, height * 0.2);

  // the poem in a column at the top right, and the seal under it
  const size = Math.max(16, height * 0.026);
  ctx.fillStyle = 'rgba(24, 22, 20, 0.82)';
  ctx.font = `${size}px "Ma Shan Zheng", "Zhi Mang Xing", "KaiTi", "STKaiti", "Kaiti SC", "Yu Mincho", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const colX = width * 0.93;
  [...POEM].forEach((ch, i) => ctx.fillText(ch, colX, height * 0.14 + i * size * 1.15));
  const sealY = height * 0.14 + POEM.length * size * 1.15 + size * 0.4;
  ctx.fillStyle = 'rgba(178, 34, 30, 0.85)';
  ctx.fillRect(colX - size * 0.55, sealY, size * 1.1, size * 1.1);
  ctx.fillStyle = '#f3ecdc';
  ctx.font = `${size * 0.8}px "KaiTi", "STKaiti", "Yu Mincho", serif`;
  ctx.fillText('捕', colX, sealY + size * 0.15);
  return c;
}

// a soft bank of mist, made once and slid along the valleys
function mistBank (w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const random = rng(77);
  for (let i = 0; i < 14; i++) {
    const x = random() * w;
    const y = h * (0.3 + random() * 0.4);
    const r = h * (0.25 + random() * 0.35);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(246, 240, 226, 0.55)');
    g.addColorStop(1, 'rgba(246, 240, 226, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // the same again a width along, so the bank wraps
    ctx.save();
    ctx.translate(x < w / 2 ? w : -w, 0);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  return c;
}

export const murimScene: SceneMaker = (back) => {
  const ctx = back.getContext('2d')!;
  let art: HTMLCanvasElement | null = null;
  let mist: HTMLCanvasElement | null = null;
  let [w, h, scale] = [0, 0, 1];

  // a crane in flight seen from below: white body and neck stretched out, legs trailing, wings with black tips beating
  const crane = (x: number, y: number, s: number, beat: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#f7f3ea';
    ctx.strokeStyle = 'rgba(30, 28, 26, 0.85)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.45, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.4, 0);
    ctx.lineTo(s * 0.95, -s * 0.05);
    ctx.stroke();
    ctx.fillStyle = '#c4302a';
    ctx.beginPath();
    ctx.arc(s * 0.92, -s * 0.06, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.95, s * 0.04);
    ctx.stroke();
    for (const side of [-1, 1]) {
      const tip = side * s * (0.55 + 0.35 * beat);
      ctx.fillStyle = '#f7f3ea';
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, 0);
      ctx.quadraticCurveTo(-s * 0.05, tip * 0.6, -s * 0.3, tip);
      ctx.lineTo(s * 0.12, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(26, 24, 22, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, tip * 0.72);
      ctx.quadraticCurveTo(-s * 0.2, tip * 0.9, -s * 0.3, tip);
      ctx.lineTo(-s * 0.08, tip * 0.75);
      ctx.fill();
    }
    ctx.restore();
  };

  return {
    resize (width, height, dpr) {
      back.width = Math.round(width * dpr);
      back.height = Math.round(height * dpr);
      [w, h, scale] = [width, height, dpr];
      art = painting(width, height, dpr);
      mist = mistBank(Math.round(width), Math.round(height * 0.35));
    },
    draw (t) {
      if (!art || !mist) {
        return;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(art, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // two banks of mist, at two heights, drifting at two paces
      for (const [y, pace] of [[0.5, 6], [0.72, 10]]) {
        const off = (t * pace) % w;
        ctx.drawImage(mist, -off, h * y - mist.height / 2);
        ctx.drawImage(mist, w - off, h * y - mist.height / 2);
      }
      // the cranes, a loose line of them crossing slowly and coming round again
      const cross = w + 400;
      for (let i = 0; i < 5; i++) {
        const x = ((t * 14) % cross) - 200 - i * 70;
        const y = h * 0.2 + i * 22 + Math.sin(t * 0.2 + i) * 6;
        crane(x, y, 26 - i * 2, Math.sin(t * 1.2 + i * 0.7));
      }
    },
    dispose () {
      art = null;
      mist = null;
    },
  };
};
