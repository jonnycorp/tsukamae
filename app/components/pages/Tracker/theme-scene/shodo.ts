import { canvas, fbm, rng, toProperty } from './texture';

import type { SceneMaker } from './scene';

// Ink 2's desk: a calligrapher's black felt (mōsen) under the sheets of hanshi the boxes are, lit from a window at the
// top left; over everything, the shadow of bamboo leaves outside that window, moving a little in the air. The felt is
// drawn once and holds still; the leaves are three sprays, each drawn once and swayed by the compositor alone
// (styles/themes2/_shodo.scss), so a frame costs nothing. It also makes the paper and the ink the stylesheet lays on:
// the hanshi's fibres (--shodo-washi), a diluted-ink wash for a sealed tile (--shodo-wash), a dry brush's streaks for
// the meter (--shodo-kasure) and the grain a seal leaves on paper (--shodo-stamp)

function washi (): HTMLCanvasElement {
  const size = 512;
  const [c, ctx] = canvas(size);
  const cloud = fbm(size, 6, 5, 11);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < cloud.length; i++) {
    // unbleached kozo: a warm white, clouded where the pulp lay thicker
    const v = (cloud[i] - 0.5) * 16;
    img.data[i * 4] = 243 + v;
    img.data[i * 4 + 1] = 238 + v;
    img.data[i * 4 + 2] = 226 + v * 1.1;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // the long fibres, a few darker, most lighter than the sheet, curving as they lay in the vat
  const random = rng(7);
  for (let n = 0; n < 900; n++) {
    const x = random() * size;
    const y = random() * size;
    const len = 6 + random() * 38;
    const a = random() * Math.PI * 2;
    const bend = (random() - 0.5) * 0.8;
    const dark = random() < 0.25;
    ctx.strokeStyle = dark ? `rgba(150, 128, 96, ${0.08 + random() * 0.1})` : `rgba(255, 253, 246, ${0.35 + random() * 0.4})`;
    ctx.lineWidth = 0.4 + random() * 0.7;
    for (const [ox, oy] of [[0, 0], [-size, 0], [0, -size], [-size, -size]]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + Math.cos(a + bend) * len * 0.5, y + oy + Math.sin(a + bend) * len * 0.5, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  return c;
}

// a wash of diluted ink, blooming unevenly, its edges where the water dried darker: an alpha mask, a box's worth
// across, so every sealed tile under it takes a different part
function wash (): HTMLCanvasElement {
  const size = 768;
  const [c, ctx] = canvas(size);
  const bloom = fbm(size, 3, 4, 23);
  const grain = fbm(size, 48, 2, 29);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < bloom.length; i++) {
    const b = bloom[i];
    // a tide line where the bloom's edge dried
    const edge = Math.exp(-(((b - 0.56) / 0.018) ** 2)) * 0.14;
    const body = Math.min(1, Math.max(0, (b - 0.32) / 0.4));
    const a = Math.min(1, 0.12 + body * 0.5 + edge + (grain[i] - 0.5) * 0.08);
    img.data[i * 4 + 3] = Math.max(0, a) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// a dry brush dragged left to right: the hairs' streaks along its length, long and uneven, where they ran short of
// ink, its two edges ragged
function kasure (): HTMLCanvasElement {
  const size = 256;
  const streaks = fbm(size, 40, 3, 41, 0.1);
  const rag = fbm(size, 24, 2, 43, 0.5);
  const [small, sctx] = canvas(size);
  const img = sctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const across = Math.min(y, size - 1 - y) / size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // solid toward the middle, the edges eaten by the paper's tooth
      const edge = Math.min(1, Math.max(0, (across - 0.04 - rag[i] * 0.1) / 0.06));
      const dry = Math.min(1, Math.max(0, (streaks[i] - 0.3) / 0.12));
      img.data[i * 4 + 3] = edge * (0.25 + dry * 0.75) * 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  const [c, ctx] = canvas(1024, 64);
  ctx.drawImage(small, 0, 0, 1024, 64);
  return c;
}

// a seal's impression: cinnabar paste pressed on paper, mostly solid, specked where the paper's grain didn't take it
function stamp (): HTMLCanvasElement {
  const size = 128;
  const [c, ctx] = canvas(size);
  const n = fbm(size, 16, 3, 53);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < n.length; i++) {
    img.data[i * 4 + 3] = n[i] > 0.27 ? 255 : n[i] > 0.22 ? 150 : 40;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// the felt: a deep warm black, its nap a fine noise, lit by the window at the top left
function felt (ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1b1917';
  ctx.fillRect(0, 0, w, h);
  const [nap, nctx] = canvas(256);
  const n = fbm(256, 64, 2, 3);
  const img = nctx.createImageData(256, 256);
  for (let i = 0; i < n.length; i++) {
    const v = 20 + (n[i] - 0.5) * 22;
    img.data[i * 4] = v + 4;
    img.data[i * 4 + 1] = v + 2;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(nap, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  const light = ctx.createRadialGradient(w * 0.08, -h * 0.1, 0, w * 0.08, -h * 0.1, Math.hypot(w, h) * 0.95);
  light.addColorStop(0, 'rgba(255, 236, 200, 0.16)');
  light.addColorStop(0.5, 'rgba(255, 236, 200, 0.05)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);
}

// a spray of bamboo: a cane's thin twig with its long narrow leaves, drawn in black, soft as a shadow cast from a few
// feet away
function spray (seed: number, w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const random = rng(seed);
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  const twigs = 3 + Math.floor(random() * 2);
  for (let t = 0; t < twigs; t++) {
    let x = w * (0.75 + random() * 0.25);
    let y = h * (random() * 0.2);
    const dir = Math.PI * (0.62 + random() * 0.25);
    ctx.lineWidth = 3;
    const steps = 5 + Math.floor(random() * 3);
    for (let s = 0; s < steps; s++) {
      const len = 50 + random() * 40;
      const nx = x + Math.cos(dir + (random() - 0.5) * 0.3) * len;
      const ny = y + Math.sin(dir + (random() - 0.5) * 0.3) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx;
      y = ny;
      // leaves fanning from a node
      const leaves = 2 + Math.floor(random() * 3);
      for (let l = 0; l < leaves; l++) {
        const a = dir + (random() - 0.3) * 1.6;
        const ll = 90 + random() * 80;
        const lw = 9 + random() * 7;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(ll * 0.25, -lw, ll * 0.7, -lw * 0.8, ll, 0);
        ctx.bezierCurveTo(ll * 0.7, lw * 0.5, ll * 0.25, lw * 0.7, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  return c;
}

export const shodoScene: SceneMaker = (back, front) => {
  const ctx = back.getContext('2d')!;
  const props = [toProperty('--shodo-washi', washi()), toProperty('--shodo-wash', wash()), toProperty('--shodo-kasure', kasure()), toProperty('--shodo-stamp', stamp())];
  const sprays = [spray(3, 700, 620), spray(9, 560, 520), spray(17, 640, 560)].map((c, i) => {
    c.className = `shodo-leaves shodo-leaves-${i + 1}`;
    front?.append(c);
    return c;
  });

  return {
    resize (width, height, dpr) {
      back.width = Math.round(width * dpr);
      back.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      felt(ctx, width, height);
    },
    draw () {},
    dispose () {
      props.forEach((off) => off());
      sprays.forEach((c) => c.remove());
    },
  };
};
shodoScene.front = true;
