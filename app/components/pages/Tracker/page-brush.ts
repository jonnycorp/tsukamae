import { useEffect } from 'react';

import { DISPLAY_PAGES } from '../../../utils/display-modes';
import { HOLD_MS, PHASE_MS, SLIDE_MS, isFlip } from './use-flip-clock';

import type { DisplayMode } from '../../../utils/display-modes';
import type { FlipPick } from './use-flip-clock';
import type { RefObject } from 'react';

// A theme's brushed page change (ThemeSeed.pageChange; styles/tile-faces.scss cuts its strips in place of the slide):
// as the sealed tiles' pages change, a brush lays its mark over each line whose text changes, left to right with its
// tip round, and the text dips out under it; the strip cuts to its next page there, and the mark dries away, left to
// right as well and its thin streaks first, as the new text comes up. The marks are painted on a canvas over each
// changing line of tiles in view, inside the line's overlay so it stacks as the line does (the names' under the
// sprites), made for the change and let go after it: the theme's mark (--page-brush) in its ink (--page-brush-color),
// worked out once a frame at the screen's pixels and stamped on every tile. Timed by the strips' own cycle, so the marks
// keep with what the compositor shows, or by a face picked while the flips are held (useFlipClock's flippick); never in
// still mode, which holds the flips

// the mark's moments in a change, from the end of a page's hold: laid over the line, then dried away; keep in step with
// the strips' dip in styles/tile-faces.scss ($brush-out ...)
const LAY_MS: [number, number] = [0, 340];
const DRY_MS: [number, number] = [420, SLIDE_MS];
// how dark the mark lies, and how far in from a tile's sides it starts and ends (the tile's px)
const STRENGTH = 0.7;
const INSET = 7;
// the soft edge of the brush's tip, and of the drying, as parts of a pass
const TIP = 0.05;
const DRYING = 0.2;
// the drying's pass, from before the thinnest streak to past the end
const DRY_FROM = -0.3;
const DRY_TO = 1.2;

// a mark at one size, worked out once: its ink, where in the brush's pass each pixel is laid (its tip round, each row
// of bristles a little ahead or behind) and where in the drying each dries (later along, the thin streaks first); the
// picture it stands as this frame, in the ink, and the pass and drying it was last drawn at
interface Mark {
  base: Float32Array;
  lay: Float32Array;
  dry: Float32Array;
  image: ImageData;
  canvas: HTMLCanvasElement;
  at: string;
}

// one changing line of tiles: its canvas, and a stamp of the mark on each tile
interface Line {
  canvas: HTMLCanvasElement;
  stamps: { mark: Mark; x: number; w: number }[];
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - (1 - clamp(t)) ** 2;

const images = new Map<string, HTMLImageElement | null>();

// the theme's mark, once it's loaded (null till then)
function markImage (src: string): HTMLImageElement | null {
  if (!images.has(src)) {
    images.set(src, null);
    const img = new Image();
    img.src = src;
    img.decode().then(() => images.set(src, img), () => images.delete(src));
  }
  return images.get(src)!;
}

// a colour as the canvas paints it
function rgbOf (color: string): number[] {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

function makeMark (img: HTMLImageElement, w: number, h: number, flip: boolean, rgb: number[]): Mark {
  const read = document.createElement('canvas');
  read.width = w;
  read.height = h;
  const ctx = read.getContext('2d', { willReadFrequently: true })!;
  if (flip) {
    ctx.translate(0, h);
    ctx.scale(1, -1);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const ink = ctx.getImageData(0, 0, w, h).data;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const image = new ImageData(w, h);
  const [base, lay, dry] = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  const tip = h / 2;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5 - h / 2) / (h / 2);
    const ahead = tip * (1 - Math.sqrt(Math.max(0, 1 - v * v))) + hash(y) * w * 0.05;
    const later = hash(y + 91) * w * 0.12;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      base[i] = ink[i * 4 + 3] / 255;
      lay[i] = (x + ahead) / (w + tip + w * 0.05);
      dry[i] = (x + later) / (w * 1.12) - 0.3 * (1 - base[i]);
      image.data.set(rgb, i * 4);
    }
  }
  return { base, lay, dry, image, canvas, at: '' };
}

// the mark as it stands with the brush's pass at u and the drying at q
function paint (mark: Mark, u: number, q: number) {
  const at = `${u.toFixed(3)} ${q.toFixed(3)}`;
  if (mark.at === at) {
    return;
  }
  mark.at = at;
  const { base, lay, dry, image } = mark;
  const a = image.data;
  for (let i = 0; i < base.length; i++) {
    a[i * 4 + 3] = base[i] * clamp((u - lay[i]) / TIP) * clamp((dry[i] - q) / DRYING + 1) * STRENGTH * 255;
  }
  mark.canvas.getContext('2d')!.putImageData(image, 0, 0);
}

const inView = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
};

const live = () => {
  const root = document.documentElement;
  return root.dataset.pageChange === 'brush' && !root.hasAttribute('data-still') && !document.hidden;
};

// the theme's mark's address
const brushSrc = (style: CSSStyleDeclaration) => /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(style.getPropertyValue('--page-brush'))?.[1];

// the brushed change's marks, while the dex is up in a theme that has it
export function usePageBrush (ref: RefObject<HTMLElement>, display: DisplayMode) {
  useEffect(() => {
    const el = ref.current;
    const pages = DISPLAY_PAGES[display];
    if (!el || pages.length < 2) {
      return undefined;
    }
    // the name changes only to the nickname, on the trainer's page, and back
    const trainer = pages.indexOf('trainer');
    const namesChange = (from: number, to: number) => (from === trainer) !== (to === trainer);
    const marks = new Map<string, Mark>();
    let lines: Line[] = [];
    let timer = 0;
    let frame = 0;

    // the strips' cycle, read off one in view: the page on show and how far into its phase
    const clock = () => {
      for (const overlay of el.querySelectorAll<HTMLElement>('.flip-overlay:not(.sprite-overlay)')) {
        const anim = inView(overlay) ? overlay.querySelector('.flip-strip')?.getAnimations().find(isFlip) : undefined;
        if (anim) {
          return anim;
        }
      }
      return null;
    };
    const phase = (anim: Animation) => {
      const time = anim.playState === 'running' ? anim.currentTime : null;
      if (typeof time !== 'number') {
        return null;
      }
      const at = time % (pages.length * PHASE_MS);
      return { page: Math.floor(at / PHASE_MS), into: at % PHASE_MS };
    };

    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      for (const { canvas } of lines) {
        canvas.width = canvas.height = 0;
        canvas.remove();
      }
      lines = [];
    };

    // a canvas over each line in view whose text changes, the mark's stamps on its tiles; none till the mark's loaded
    const build = (names: boolean): Line[] => {
      const style = getComputedStyle(document.documentElement);
      const src = brushSrc(style);
      const img = src ? markImage(src) : null;
      if (!img) {
        return [];
      }
      const rgb = rgbOf(style.getPropertyValue('--page-brush-color').trim() || '#000');
      if (marks.size > 16) {
        marks.clear();
      }
      const built: Line[] = [];
      for (const overlay of el.querySelectorAll<HTMLElement>('.flip-overlay:not(.sprite-overlay)')) {
        if (!inView(overlay)) {
          continue;
        }
        const zoom = overlay.currentCSSZoom || 1;
        const res = zoom * window.devicePixelRatio;
        for (const win of overlay.querySelectorAll<HTMLElement>(':scope > .flip-window')) {
          const kind = win.classList.contains('flip-lower') ? 'lower' : win.classList.contains('flip-names') && names ? 'names' : null;
          const faces = kind && inView(win) ? [...win.querySelectorAll<HTMLElement>(':scope > .flip-strip > .flip-faces')] : [];
          if (faces.length === 0) {
            continue;
          }
          const top = parseFloat(win.style.top) || 0;
          const height = win.getBoundingClientRect().height / zoom;
          const spans = faces.map((face) => [parseFloat(face.style.left), parseFloat(face.style.width)]);
          const from = Math.min(...spans.map(([left]) => left));
          const to = Math.max(...spans.map(([left, width]) => left + width));
          const canvas = document.createElement('canvas');
          canvas.className = 'page-brush';
          canvas.setAttribute('aria-hidden', 'true');
          Object.assign(canvas.style, { position: 'absolute', left: `${from}px`, top: `${top}px`, width: `${to - from}px`, height: `${height}px`, pointerEvents: 'none' });
          canvas.width = Math.round((to - from) * res);
          canvas.height = Math.round(height * res);
          const [mw, mh] = [Math.round((Math.max(...spans.map(([, width]) => width)) - 2 * INSET) * res), canvas.height];
          // each tile's stamp a little its own: turned over or not, nudged, a touch shorter
          const stamps = spans.map(([left, width]) => {
            const seed = left * 0.37 + top * 1.91;
            const flip = hash(seed) > 0.5;
            const key = `${src} ${rgb.join()} ${mw}x${mh}${flip ? ' flipped' : ''}`;
            if (!marks.has(key)) {
              marks.set(key, makeMark(img, mw, mh, flip, rgb));
            }
            const w = (width - 2 * INSET) * (1 - 0.06 * hash(seed + 7));
            return { mark: marks.get(key)!, x: (left - from + INSET + (hash(seed + 3) - 0.5) * 4) * res, w: w * res };
          });
          overlay.append(canvas);
          built.push({ canvas, stamps });
        }
      }
      return built;
    };

    // every line's marks as they stand `ms` into the change
    const draw = (ms: number) => {
      const u = ms <= LAY_MS[0] ? 0 : ease((ms - LAY_MS[0]) / (LAY_MS[1] - LAY_MS[0])) * (1 + TIP);
      const q = ms <= DRY_MS[0] ? -1 : DRY_FROM + clamp((ms - DRY_MS[0]) / (DRY_MS[1] - DRY_MS[0])) * (DRY_TO - DRY_FROM);
      for (const line of lines) {
        const ctx = line.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, line.canvas.width, line.canvas.height);
        for (const { mark, x, w } of line.stamps) {
          paint(mark, u, q);
          ctx.drawImage(mark.canvas, x, 0, w, line.canvas.height);
        }
      }
    };

    // the change the strips run on their own, from a little before it; with nothing to mark, the next waited for
    const run = (anim: Animation, page: number, into: number) => {
      lines = build(namesChange(page, (page + 1) % pages.length));
      if (lines.length === 0) {
        timer = window.setTimeout(check, PHASE_MS - into + 20);
        return;
      }
      const tick = () => {
        const now = phase(anim);
        const ms = now ? now.into - HOLD_MS : SLIDE_MS;
        // done, or held, or the theme or the display mode changed under it
        if (!now || now.page !== page || ms >= SLIDE_MS || !live()) {
          stop();
          check();
          return;
        }
        draw(ms);
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };

    // the next change's start waited for
    const check = () => {
      window.clearTimeout(timer);
      const anim = !frame && live() ? clock() : null;
      const now = anim && phase(anim);
      if (!anim || !now) {
        timer = window.setTimeout(check, 1000);
        return;
      }
      // its mark loaded ahead of it
      const src = brushSrc(getComputedStyle(document.documentElement));
      if (src) {
        markImage(src);
      }
      const lead = HOLD_MS - 80 - now.into;
      if (lead > 0) {
        timer = window.setTimeout(check, lead);
      } else if (now.into < HOLD_MS + 60) {
        run(anim, now.page, now.into);
      } else {
        timer = window.setTimeout(check, PHASE_MS - now.into + HOLD_MS - 80);
      }
    };

    // a face picked while the flips are held: its change, timed from now
    const handlePick = (e: Event) => {
      const { from, to } = (e as CustomEvent<FlipPick>).detail;
      stop();
      if (!live()) {
        return;
      }
      lines = build(namesChange(from, to));
      const start = performance.now();
      const tick = (now: number) => {
        const ms = now - start;
        if (ms >= SLIDE_MS || !live() || !el.hasAttribute('data-flip-paused')) {
          stop();
          return;
        }
        draw(ms);
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };

    el.addEventListener('flippick', handlePick);
    check();
    return () => {
      el.removeEventListener('flippick', handlePick);
      window.clearTimeout(timer);
      stop();
    };
  }, [ref, display]);
}
