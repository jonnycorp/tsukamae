import { canvas, rng, toProperty } from './texture';

import type { SceneMaker } from './scene';

// Wisteria 2's night under a trellis: racemes of wisteria hanging from the top of the window in three depths, the far
// ones small and dim, the near ones large and soft as if out of focus, each swaying slowly on its own; a few petals
// drifting down behind the boxes; out of focus lights in the dark beyond. The racemes are drawn once into sprites, so
// a frame is a few dozen images placed. Also makes the gold dust (nashiji) the stylesheet lays in the lacquer
// (--trellis-nashiji)

interface Raceme {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  sway: number;
  speed: number;
  phase: number;
  alpha: number;
}

interface Petal {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  spin: number;
}

// one raceme: florets set in a spiral down a stem, open and pale at the top, closing into deep violet buds at the tip;
// those on the far side of the stem drawn first and darker, so it has a body
function raceme (seed: number, length: number, blur: number, dpr: number): HTMLCanvasElement {
  const random = rng(seed);
  const width = length * 0.3;
  const pad = blur * 3 + 8;
  const [c, ctx] = canvas(Math.ceil((width + pad * 2) * dpr), Math.ceil((length + pad * 2) * dpr));
  ctx.scale(dpr, dpr);
  ctx.translate(pad + width / 2, pad);
  if (blur > 0) {
    ctx.filter = `blur(${blur}px)`;
  }
  const curve = (random() - 0.5) * 0.12;
  const at = (y: number) => curve * y * (y / length) * 1.5;
  ctx.strokeStyle = 'rgba(70, 60, 50, 0.7)';
  ctx.lineWidth = Math.max(1, length / 160);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let y = 0; y <= length; y += 6) {
    ctx.lineTo(at(y), y);
  }
  ctx.stroke();
  const count = Math.round(length * 0.75);
  const florets = Array.from({ length: count }, (_, i) => {
    const s = i / count;
    const turn = i * 2.4 + random() * 0.4;
    return { s, turn, depth: Math.cos(turn), r: random() };
  }).sort((p, q) => p.depth - q.depth);
  for (const { s, turn, depth, r } of florets) {
    const y = s * length + (r - 0.5) * 4;
    const spread = (width / 2) * (1 - s ** 1.7) * (0.85 + 0.15 * Math.sin(s * 9 + seed)) + 1.5;
    const x = at(y) + Math.sin(turn) * spread;
    const size = ((1 - s * 0.72) * length) / 30 * (0.8 + r * 0.4);
    const shade = 0.72 + 0.28 * (depth * 0.5 + 0.5);
    const hue = 258 + s * 18 + (r - 0.5) * 8;
    const sat = 30 + s * 32;
    const light = (80 - s * 34) * shade;
    const g = ctx.createRadialGradient(x - size * 0.2, y - size * 0.3, 0, x, y, size * 1.1);
    g.addColorStop(0, `hsl(${hue - 6}, ${sat}%, ${Math.min(94, light + 12)}%)`);
    g.addColorStop(1, `hsl(${hue}, ${sat + 10}%, ${light - 10}%)`);
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(turn) * 0.6);
    ctx.beginPath();
    if (s < 0.8) {
      // open: the standard petal's broad flare over the two wings
      ctx.ellipse(0, -size * 0.35, size * 0.85, size * 0.55, 0, Math.PI, 0);
      ctx.ellipse(0, size * 0.15, size * 0.55, size * 0.6, 0, 0, Math.PI);
    } else {
      ctx.ellipse(0, 0, size * 0.45, size * 0.7, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    if (s < 0.6 && depth > 0) {
      ctx.fillStyle = 'rgba(250, 240, 170, 0.75)';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.3, size * 0.16, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  return c;
}

// the vine's leaves along the top: pinnate, a dozen narrow leaflets paired down each stalk, dark in the night
function foliage (ctx: CanvasRenderingContext2D, width: number, seed: number) {
  const random = rng(seed);
  ctx.save();
  ctx.filter = 'blur(1.5px)';
  for (let n = 0; n < width / 26; n++) {
    const x = random() * width;
    const y = -10 + random() * 50;
    const a = Math.PI / 2 + (random() - 0.5) * 1.6;
    const len = 70 + random() * 70;
    const l = 10 + random() * 8;
    ctx.fillStyle = `hsl(${95 + random() * 30}, 22%, ${l}%)`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a - Math.PI / 2);
    for (let k = 1; k <= 6; k++) {
      const yy = (k / 6.5) * len;
      const ll = 18 + random() * 8;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(0, yy);
        ctx.rotate(side * (0.9 + random() * 0.3));
        ctx.beginPath();
        ctx.ellipse(0, ll / 2, ll * 0.2, ll / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// the lacquer's gold dust: flecks of three sizes scattered thin, an alpha mask
function nashiji (): HTMLCanvasElement {
  const size = 256;
  const [c, ctx] = canvas(size);
  const random = rng(31);
  for (let i = 0; i < 260; i++) {
    const r = random() < 0.85 ? 0.4 + random() * 0.6 : 1 + random() * 0.8;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 + random() * 0.65})`;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export const trellisScene: SceneMaker = (back) => {
  const ctx = back.getContext('2d')!;
  const off = toProperty('--trellis-nashiji', nashiji());
  let width = 0;
  let height = 0;
  let ground: HTMLCanvasElement | null = null;
  let racemes: Raceme[] = [];
  let petals: Petal[] = [];

  const build = (dpr: number) => {
    const [g, gctx] = canvas(Math.round(width * dpr), Math.round(height * dpr));
    gctx.scale(dpr, dpr);
    const sky = gctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0f0818');
    sky.addColorStop(0.45, '#1c0f2b');
    sky.addColorStop(1, '#251433');
    gctx.fillStyle = sky;
    gctx.fillRect(0, 0, width, height);
    // lanterns far off in the garden, out of focus
    const random = rng(5);
    gctx.filter = 'blur(10px)';
    for (let i = 0; i < 26; i++) {
      const gold = random() < 0.4;
      gctx.fillStyle = gold ? `rgba(255, 196, 120, ${0.05 + random() * 0.08})` : `rgba(190, 140, 255, ${0.05 + random() * 0.08})`;
      gctx.beginPath();
      gctx.arc(random() * width, height * (0.35 + random() * 0.65), 10 + random() * 34, 0, Math.PI * 2);
      gctx.fill();
    }
    gctx.filter = 'none';
    const glow = gctx.createRadialGradient(width * 0.5, -height * 0.1, 0, width * 0.5, -height * 0.1, height * 0.9);
    glow.addColorStop(0, 'rgba(170, 120, 230, 0.22)');
    glow.addColorStop(1, 'rgba(170, 120, 230, 0)');
    gctx.fillStyle = glow;
    gctx.fillRect(0, 0, width, height);
    foliage(gctx, width, 9);
    ground = g;

    // the racemes, far to near, spaced along the top with some bunched together as they grow
    const r = rng(77);
    racemes = [];
    const layers = [
      { n: Math.round(width / 60), len: [130, 210], blur: 0.5, alpha: 0.5, sway: 0.018 },
      { n: Math.round(width / 110), len: [220, 330], blur: 1.2, alpha: 0.8, sway: 0.024 },
      { n: Math.round(width / 280), len: [380, 520], blur: 6, alpha: 0.9, sway: 0.03 },
    ];
    layers.forEach((layer, depth) => {
      for (let i = 0; i < layer.n; i++) {
        const len = (layer.len[0] + r() * (layer.len[1] - layer.len[0])) * (r() < 0.25 ? 0.6 : 1);
        const sprite = raceme(1000 * depth + i * 7 + 1, len, layer.blur, dpr);
        // bunched as they grow, two or three to a spur, with gaps between spurs
        const spur = Math.floor(i / 3);
        const spurs = Math.ceil(layer.n / 3);
        racemes.push({
          sprite,
          x: ((spur + 0.15 + r() * 0.7) / spurs) * width + (i % 3 - 1) * len * 0.12,
          y: -len * (0.02 + r() * 0.15) + 20,
          sway: layer.sway * (0.7 + r() * 0.6),
          speed: 0.25 + r() * 0.2,
          phase: r() * Math.PI * 2,
          alpha: layer.alpha,
        });
      }
    });
    petals = Array.from({ length: 16 }, () => ({
      x: r() * width,
      y: r() * height,
      size: 3 + r() * 3,
      speed: 9 + r() * 10,
      phase: r() * Math.PI * 2,
      spin: (r() - 0.5) * 0.8,
    }));
  };

  let scale = 1;
  return {
    resize (w, h, dpr) {
      width = w;
      height = h;
      scale = dpr;
      back.width = Math.round(w * dpr);
      back.height = Math.round(h * dpr);
      build(dpr);
    },
    draw (t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (ground) {
        ctx.drawImage(ground, 0, 0);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // petals behind the racemes, falling slowly, turning as they go
      ctx.fillStyle = 'rgba(205, 175, 245, 0.55)';
      for (const p of petals) {
        const y = (p.y + t * p.speed) % (height + 20) - 10;
        const x = p.x + Math.sin(t * 0.3 + p.phase) * 30;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * p.spin + p.phase);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const rm of racemes) {
        const a = Math.sin(t * rm.speed + rm.phase) * rm.sway + Math.sin(t * rm.speed * 2.3 + rm.phase * 1.7) * rm.sway * 0.3;
        ctx.save();
        ctx.globalAlpha = rm.alpha;
        ctx.translate(rm.x, rm.y);
        ctx.rotate(a);
        ctx.drawImage(rm.sprite, -rm.sprite.width / scale / 2, 0, rm.sprite.width / scale, rm.sprite.height / scale);
        ctx.restore();
      }
    },
    dispose () {
      off();
    },
  };
};
