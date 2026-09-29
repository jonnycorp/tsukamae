// explicit .ts extensions: scripts/check-themes.mjs loads these modules in node
import { contrast, cssColor, deltaE, hueDistance, over, parseCssColor, toLch, toRgb } from './color.ts';

import type { Lch, Rgb } from './color.ts';

export type Mode = 'light' | 'dark';

// a theme is a handful of hues; every colour in both modes is computed from them
export interface ThemeSeed {
  name: string;
  // chrome, page and meter
  hue: number;
  // text, buttons and the popover
  ink: number;
  unobtainable: number;
  temporary: number;
  caught: number;
  // scales every chroma except the status tones
  chroma: number;
  statusChroma?: number;
  unobtainableChroma?: number;
}

// Apricot is the one contrasting theme; the rest are waves through a single colour family
export const THEMES: ThemeSeed[] = [
  { name: 'Apricot', hue: 55, ink: 42, unobtainable: 75, temporary: 355, caught: 132, chroma: 1 },
  { name: 'Matcha', hue: 128, ink: 145, unobtainable: 160, temporary: 112, caught: 145, chroma: 0.85 },
  { name: 'Harbor', hue: 232, ink: 245, unobtainable: 68, temporary: 205, caught: 240, chroma: 0.8, unobtainableChroma: 0.9 },
  { name: 'Wisteria', hue: 300, ink: 295, unobtainable: 285, temporary: 318, caught: 292, chroma: 1 },
  { name: 'Graphite', hue: 250, ink: 255, unobtainable: 250, temporary: 232, caught: 256, chroma: 0.22, statusChroma: 0.85, unobtainableChroma: 0.3 },
];

export const DEFAULT_THEME = 'Apricot';

type Source = 'hue' | 'ink' | 'unobtainable' | 'temporary' | 'caught';
type Tone = [l: number, c: number, source: Source];

const STATUS_SOURCES: Source[] = ['unobtainable', 'temporary', 'caught'];

const TONES: Record<Mode, Record<string, Tone>> = {
  light: {
    paper: [0.958, 0.018, 'hue'],
    'paper-raised': [0.986, 0.008, 'hue'],
    'paper-sunken': [0.925, 0.02, 'hue'],
    chip: [0.915, 0.016, 'hue'],
    chrome: [0.865, 0.062, 'hue'],
    'chrome-hover': [0.895, 0.052, 'hue'],
    'chrome-active': [0.925, 0.04, 'hue'],
    'chrome-well': [0.83, 0.062, 'hue'],
    'chrome-pattern': [0.815, 0.068, 'hue'],
    meter: [0.83, 0.075, 'hue'],
    'meter-edge': [0.74, 0.085, 'hue'],
    accent: [0.47, 0.065, 'ink'],
    'accent-hover': [0.41, 0.062, 'ink'],
    overlay: [0.44, 0.055, 'ink'],
    'overlay-deep': [0.39, 0.052, 'ink'],
    'overlay-deeper': [0.35, 0.05, 'ink'],
    'overlay-edge': [0.36, 0.05, 'ink'],
    field: [0.986, 0.008, 'hue'],
    'field-edge': [0.72, 0.035, 'ink'],
    'field-focus': [0.47, 0.065, 'ink'],
    'tile-unobtainable': [0.885, 0.026, 'unobtainable'],
    'tile-temporary': [0.925, 0.05, 'temporary'],
    'tile-temporary-stripe': [0.88, 0.066, 'temporary'],
    'tile-caught': [0.835, 0.075, 'caught'],
    'status-unobtainable': [0.62, 0.08, 'unobtainable'],
    'status-temporary': [0.64, 0.12, 'temporary'],
    'status-caught': [0.62, 0.12, 'caught'],
  },
  dark: {
    paper: [0.345, 0.03, 'hue'],
    'paper-raised': [0.395, 0.034, 'hue'],
    'paper-sunken': [0.3, 0.026, 'hue'],
    chip: [0.3, 0.02, 'hue'],
    chrome: [0.26, 0.042, 'hue'],
    'chrome-hover': [0.3, 0.044, 'hue'],
    'chrome-active': [0.34, 0.046, 'hue'],
    'chrome-well': [0.225, 0.04, 'hue'],
    'chrome-pattern': [0.295, 0.048, 'hue'],
    meter: [0.27, 0.05, 'hue'],
    'meter-edge': [0.5, 0.06, 'hue'],
    accent: [0.8, 0.07, 'hue'],
    'accent-hover': [0.85, 0.06, 'hue'],
    overlay: [0.265, 0.032, 'ink'],
    'overlay-deep': [0.315, 0.034, 'ink'],
    'overlay-deeper': [0.355, 0.036, 'ink'],
    'overlay-edge': [0.4, 0.038, 'ink'],
    field: [0.3, 0.026, 'hue'],
    'field-edge': [0.5, 0.034, 'ink'],
    'field-focus': [0.8, 0.07, 'hue'],
    'tile-unobtainable': [0.245, 0.022, 'unobtainable'],
    'tile-temporary': [0.285, 0.045, 'temporary'],
    'tile-temporary-stripe': [0.325, 0.06, 'temporary'],
    'tile-caught': [0.31, 0.085, 'caught'],
    'status-unobtainable': [0.7, 0.07, 'unobtainable'],
    'status-temporary': [0.72, 0.1, 'temporary'],
    'status-caught': [0.72, 0.11, 'caught'],
  },
};

// fixed hues whose lightness still follows the mode
const FIXED: Record<Mode, Record<string, Lch>> = {
  light: {
    gift: { l: 0.52, c: 0.19, h: 26 },
    danger: { l: 0.52, c: 0.16, h: 25 },
    'danger-hover': { l: 0.46, c: 0.15, h: 25 },
    'mark-blue': { l: 0.62, c: 0.13, h: 256 },
    'mark-pink': { l: 0.7, c: 0.14, h: 358 },
    star: { l: 0.56, c: 0.21, h: 27 },
  },
  dark: {
    gift: { l: 0.76, c: 0.15, h: 25 },
    danger: { l: 0.6, c: 0.13, h: 25 },
    'danger-hover': { l: 0.66, c: 0.12, h: 25 },
    'mark-blue': { l: 0.72, c: 0.12, h: 256 },
    'mark-pink': { l: 0.78, c: 0.12, h: 358 },
    star: { l: 0.7, c: 0.17, h: 27 },
  },
};

interface WashLight {
  l: number;
  c: number;
  h: number | 'caught';
  alpha: number;
}

const HOME_CYAN = 200;

// alpha is where each search starts, not the final strength
const WASHES: Record<Mode, Record<string, WashLight>> = {
  light: {
    'wash-seal': { l: 0.97, c: 0.04, h: 'caught', alpha: 0.62 },
    'wash-home': { l: 0.8, c: 0.14, h: 250, alpha: 0.2 },
    'wash-champions': { l: 0.86, c: 0.17, h: 80, alpha: 0.25 },
  },
  dark: {
    'wash-seal': { l: 0.66, c: 0.1, h: 'caught', alpha: 0.32 },
    'wash-home': { l: 0.72, c: 0.14, h: 250, alpha: 0.15 },
    'wash-champions': { l: 0.6, c: 0.14, h: 72, alpha: 0.2 },
  },
};

// the weakest wash whose top reads apart from the fill and every earlier top; champions must still read gold
function solveWashes (tile: Lch, caught: number, mode: Mode): Record<string, Lch> {
  const fill = parseCssColor(cssColor(toRgb(tile)));
  const tops: Rgb[] = [];
  const solved: Record<string, Lch> = {};
  for (const [name, wash] of Object.entries(WASHES[mode])) {
    let h = wash.h === 'caught' ? caught : wash.h;
    if (name === 'wash-home' && hueDistance(h, caught) < 40) {
      h = HOME_CYAN;
    }
    const light = toRgb({ l: wash.l, c: wash.c, h });
    let top = fill;
    for (let alpha = wash.alpha; alpha < 1.01; alpha += 0.02) {
      top = parseCssColor(cssColor(over({ ...light, a: Math.min(alpha, 1) }, fill)));
      const { c, h: topHue } = toLch(top);
      const gold = name !== 'wash-champions' || (hueDistance(topHue, h) <= 45 && c >= 0.06);
      if (gold && deltaE(top, fill) >= 0.045 && tops.every((other) => deltaE(top, other) >= 0.05)) {
        break;
      }
    }
    tops.push(top);
    solved[name] = toLch(top);
  }
  return solved;
}

// dark yellows and oranges read as brown, so their chromatic dark tones sit higher
const LIFTED = new Set(['chrome', 'chrome-hover', 'chrome-active', 'chrome-well', 'chrome-pattern', 'meter', 'tile-temporary', 'tile-temporary-stripe', 'tile-caught']);
const lift = (h: number) => 0.07 * Math.exp(-((hueDistance(h, 90) / 32) ** 2));
// low-chroma yellows read as beige or khaki
const vivify = (h: number) => 1 + 0.7 * Math.exp(-((hueDistance(h, 92) / 28) ** 2));

type Backdrops = [backdrops: Rgb[], target: number];

// the nearest lightness, either way, that clears every ratio against its backdrops; the margin survives 8-bit rounding
function solve (base: Lch, ...groups: Backdrops[]): Lch {
  const margin = (l: number) => {
    const rgb = toRgb({ ...base, l });
    return Math.min(...groups.flatMap(([backdrops, target]) => backdrops.map((bg) => contrast(rgb, bg) - target)));
  };
  for (let step = 0; step <= 200; step++) {
    for (const l of [base.l - step * 0.005, base.l + step * 0.005]) {
      if (l >= 0 && l <= 1 && margin(l) >= 0.03) {
        return { ...base, l };
      }
    }
  }
  return { ...base, l: margin(0) > margin(1) ? 0 : 1 };
}

function buildPalette (seed: ThemeSeed, mode: Mode): Record<string, string> {
  const dark = mode === 'dark';
  const hues: Record<Source, number> = seed;
  const statusScale = seed.statusChroma ?? seed.chroma;

  const lch: Record<string, Lch> = { ...FIXED[mode] };
  // soft dark tiles stay deeper than the page, lift or not
  const tileCeiling = TONES.dark.paper[0] - 0.05;
  for (const [name, [l, c, source]] of Object.entries(TONES[mode])) {
    const h = hues[source];
    const status = STATUS_SOURCES.includes(source);
    const scale = source === 'unobtainable' ? seed.unobtainableChroma ?? statusScale : status ? statusScale : seed.chroma;
    const lifted = dark && LIFTED.has(name) ? l + lift(h) : l;
    lch[name] = {
      l: dark && ['tile-unobtainable', 'tile-temporary', 'tile-caught'].includes(name) ? Math.min(lifted, tileCeiling) : lifted,
      c: c * scale * (status ? vivify(h) : 1),
      h,
    };
  }

  Object.assign(lch, solveWashes(lch['tile-caught'], hues.caught, mode));

  const rgb = (...names: string[]) => names.map((name) => toRgb(lch[name]));
  const tint = (l: number, c: number, source: Source): Lch => ({ l, c, h: hues[source] });

  lch.ink = solve(tint(dark ? 0.96 : 0.3, 0.02 * seed.chroma + 0.01, 'ink'), [rgb('paper', 'paper-raised', 'paper-sunken', 'chip', 'field'), 7]);
  lch['ink-muted'] = solve(tint(dark ? 0.84 : 0.5, 0.025 * seed.chroma + 0.005, 'ink'), [rgb('paper', 'paper-raised', 'paper-sunken'), 4.5]);
  lch['on-chrome'] = solve(tint(dark ? 0.9 : 0.36, 0.04 * seed.chroma + 0.01, 'ink'), [rgb('chrome', 'chrome-hover', 'chrome-active', 'chrome-well', 'chrome-pattern'), 4.5]);
  lch['on-accent'] = solve(tint(dark ? 0.2 : 0.98, 0.01, 'hue'), [rgb('accent', 'accent-hover'), 4.5]);
  lch['on-overlay'] = solve(tint(0.96, 0.01, 'hue'), [rgb('overlay', 'overlay-deep', 'overlay-deeper'), 4.5]);
  lch['on-status'] = solve(tint(dark ? 0.2 : 0.99, 0.01, 'hue'), [rgb('status-unobtainable', 'status-temporary', 'status-caught'), 3]);
  lch['on-danger'] = solve({ l: dark ? 0.18 : 0.98, c: 0.01, h: 25 }, [rgb('danger', 'danger-hover'), 4.5]);
  lch['ink-danger'] = solve({ ...lch.danger }, [rgb('paper', 'paper-raised'), 4.5]);
  const sealedTile = rgb('tile-caught', 'wash-seal', 'wash-home', 'wash-champions');
  lch['on-tile'] = solve({ ...lch.ink }, [rgb('tile-unobtainable', 'tile-temporary', 'tile-temporary-stripe', 'tile-caught'), 7], [sealedTile, 4.5]);
  lch['on-tile-accent'] = solve(tint(dark ? 0.86 : 0.46, 0.11 * statusScale + 0.02, 'caught'), [sealedTile, 4.5]);
  lch['ink-caught'] = solve(tint(dark ? 0.86 : 0.5, 0.12 * statusScale + 0.02, 'caught'), [rgb('paper', 'paper-raised'), 4.5]);
  lch['ink-temporary'] = solve(tint(dark ? 0.86 : 0.5, 0.12 * statusScale + 0.02, 'temporary'), [rgb('paper', 'paper-raised'), 4.5]);
  // the gift red only sits on a tile's lower third, where the wash has faded below half
  const fill = toRgb(lch['tile-caught']);
  lch.gift = solve(lch.gift, [[fill, ...sealedTile.map((top) => over({ ...top, a: 0.45 }, fill))], 4.5]);
  lch['mark-blue'] = solve(lch['mark-blue'], [rgb('tile-caught', 'tile-unobtainable'), 3]);
  lch['mark-pink'] = solve(lch['mark-pink'], [rgb('tile-caught', 'tile-unobtainable'), 3]);

  const palette: Record<string, string> = {};
  for (const [name, color] of Object.entries(lch)) {
    palette[name] = cssColor(toRgb(color));
  }
  const alpha = (name: string, a: number) => cssColor({ ...toRgb(lch[name]), a });
  return {
    ...palette,
    line: alpha('ink', dark ? 0.16 : 0.15),
    'line-soft': alpha('ink', 0.12),
    'overlay-line': alpha('on-overlay', 0.16),
    'hover-wash': alpha('ink', dark ? 0.07 : 0.05),
    'scroll-thumb': alpha('ink', dark ? 0.4 : 0.38),
    'tile-hover-edge': alpha('accent', dark ? 0.7 : 0.55),
    'tile-badge': alpha('on-tile', 0.6),
    'on-overlay-muted': alpha('on-overlay', 0.76),
    'sprite-disc': alpha('ink', dark ? 0.14 : 0.1),
    shine: cssColor({ ...toRgb(tint(dark ? 0.96 : 0.995, 0.012, 'hue')), a: dark ? 0.3 : 0.55 }),
  };
}

const cache = new Map<string, Record<string, string>>();

export function findTheme (name: string): ThemeSeed {
  return THEMES.find((seed) => seed.name === name) ?? THEMES.find((seed) => seed.name === DEFAULT_THEME)!;
}

export function themePalette (seed: ThemeSeed, mode: Mode): Record<string, string> {
  const key = `${seed.name}:${mode}`;
  let palette = cache.get(key);
  if (!palette) {
    palette = buildPalette(seed, mode);
    cache.set(key, palette);
  }
  return palette;
}
