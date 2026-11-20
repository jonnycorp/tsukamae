import { canvas, rng } from './texture';

import type { SceneMaker } from './scene';

// Neon Rain: a side street in Tokyo at night in the rain, seen out of focus through wet glass. Buildings with a few
// windows lit, their vertical signs in neon (a coffee shop, an izakaya, karaoke, ramen, yakitori), the street below
// shining with their colours smeared down it; rain falling fine and faint across all of it. The street is drawn once
// for the window's size; a frame lays the rain over it
const SIGNS: [string, string][] = [
  ['喫茶', '#ff5fb0'], ['居酒屋', '#ffb347'], ['カラオケ', '#6ff3ff'], ['ラーメン', '#ff4a4a'], ['焼鳥', '#ffd166'],
  ['薬', '#7cff9b'], ['ホテル', '#c49bff'], ['酒', '#ff6fd8'], ['麻雀', '#5fd0ff'], ['質', '#ffe066'], ['BAR', '#ff8fd0'],
];

function street (width: number, height: number, dpr: number): HTMLCanvasElement {
  const [c, ctx] = canvas(Math.round(width * dpr), Math.round(height * dpr));
  ctx.scale(dpr, dpr);
  const random = rng(8);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#05040c');
  sky.addColorStop(0.7, '#130b22');
  sky.addColorStop(1, '#0a0712');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const [city, cctx] = canvas(Math.round(width * dpr), Math.round(height * dpr));
  cctx.scale(dpr, dpr);
  const ground = height * 0.78;
  // buildings, a row of them up both sides, windows lit here and there
  let x = -20;
  while (x < width) {
    const bw = 90 + random() * 160;
    const bh = height * (0.35 + random() * 0.5);
    cctx.fillStyle = `hsl(${250 + random() * 30}, 25%, ${6 + random() * 5}%)`;
    cctx.fillRect(x, ground - bh, bw, bh);
    for (let wy = ground - bh + 14; wy < ground - 30; wy += 22) {
      for (let wx = x + 10; wx < x + bw - 14; wx += 18) {
        if (random() < 0.18) {
          cctx.fillStyle = random() < 0.6 ? 'rgba(255, 210, 150, 0.55)' : 'rgba(150, 200, 255, 0.45)';
          cctx.fillRect(wx, wy, 9, 12);
        }
      }
    }
    x += bw + 4;
  }
  // the signs, vertical, in neon, each a tube round its panel and its characters lit
  const jp = '"Yu Gothic", "Meiryo", "Hiragino Sans", "Noto Sans JP", sans-serif';
  for (let i = 0; i < 16; i++) {
    const [word, colour] = SIGNS[i % SIGNS.length];
    const size = 22 + random() * 14;
    const sx = (i / 16) * width + random() * 50;
    const sy = height * (0.12 + random() * 0.4);
    const chars = [...word];
    const sh = chars.length * size * 1.15 + 16;
    cctx.save();
    cctx.shadowColor = colour;
    cctx.shadowBlur = 18;
    cctx.fillStyle = 'rgba(10, 6, 16, 0.85)';
    cctx.fillRect(sx, sy, size + 16, sh);
    cctx.strokeStyle = colour;
    cctx.lineWidth = 2.5;
    cctx.strokeRect(sx, sy, size + 16, sh);
    cctx.fillStyle = colour;
    cctx.font = `700 ${size}px ${jp}`;
    cctx.textAlign = 'center';
    cctx.textBaseline = 'top';
    chars.forEach((ch, k) => cctx.fillText(ch, sx + 8 + size / 2, sy + 8 + k * size * 1.15));
    cctx.restore();
  }
  // a few round paper lanterns, red, over the izakaya doors
  for (let i = 0; i < 6; i++) {
    const lx = random() * width;
    const ly = ground - 40 - random() * 40;
    cctx.save();
    cctx.shadowColor = '#ff5a3a';
    cctx.shadowBlur = 24;
    cctx.fillStyle = '#e8432a';
    cctx.beginPath();
    cctx.ellipse(lx, ly, 12, 16, 0, 0, Math.PI * 2);
    cctx.fill();
    cctx.restore();
  }

  // out of focus through the wet glass
  ctx.filter = 'blur(3.5px)';
  ctx.drawImage(city, 0, 0, width, height);
  // the street: wet, the signs' colours smeared down it
  ctx.filter = 'blur(10px)';
  ctx.globalAlpha = 0.5;
  ctx.save();
  ctx.translate(0, ground * 2);
  ctx.scale(1, -1);
  ctx.beginPath();
  ctx.rect(0, ground, width, ground);
  ctx.clip();
  for (let k = 0; k < 3; k++) {
    ctx.drawImage(city, 0, k * 14, width, height);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  const wet = ctx.createLinearGradient(0, ground, 0, height);
  wet.addColorStop(0, 'rgba(10, 6, 18, 0.2)');
  wet.addColorStop(1, 'rgba(6, 4, 12, 0.75)');
  ctx.fillStyle = wet;
  ctx.fillRect(0, ground, width, height - ground);
  return c;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

export const neonRainScene: SceneMaker = (back) => {
  const ctx = back.getContext('2d')!;
  let city: HTMLCanvasElement | null = null;
  let drops: Drop[] = [];
  let w = 0;
  let h = 0;
  let scale = 1;
  return {
    resize (width, height, dpr) {
      w = width;
      h = height;
      scale = dpr;
      back.width = Math.round(width * dpr);
      back.height = Math.round(height * dpr);
      city = street(width, height, dpr);
      const random = rng(3);
      drops = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
        x: random() * width,
        y: random() * height,
        len: 10 + random() * 22,
        speed: 260 + random() * 200,
        alpha: 0.05 + random() * 0.12,
      }));
    },
    draw (t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (city) {
        ctx.drawImage(city, 0, 0);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const d of drops) {
        const y = (d.y + t * d.speed) % (h + d.len) - d.len;
        const x = (d.x - y * 0.12 + w) % w;
        ctx.strokeStyle = `rgba(200, 210, 255, ${d.alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - d.len * 0.12, y + d.len);
        ctx.stroke();
      }
    },
    dispose () {},
  };
};
