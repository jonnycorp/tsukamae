// JS mirror of variables.scss palette maps — KEEP IN SYNC; ?palette=1 self-checks both

export type DeriveFn = 'lighten' | 'darken' | 'desaturate' | 'saturate' | 'saturation' | 'tint' | 'shade' | 'alpha' | 'readable';

export interface DerivedSpec {
  source: string;
  fn: DeriveFn;
  // % points for lighten/darken/etc, proportional for tint/shade, 0–1 for alpha,
  // target contrast ratio for readable
  amount: number;
  // readable only: every backdrop the token must clear its ratio against
  against?: string[];
}

export const PALETTE_BASES: Record<string, string> = {
  'brand-primary': '#ffcbb0',
  'brand-secondary': '#8c5b4f',
  unobtainable: '#ef9d70',
  error: '#ff0000',
  success: '#00cc66',
  temporary: '#f0a3b8',
  caught: '#96b96e',
  'release-danger': '#b23b3b',
  'gray-light': '#f1f1f1',
  'gray-medium': '#d2d2d2',
  'gray-dark': '#ababab',
};

// the shipped themes; Peach Milk matches PALETTE_BASES (the compiled default)
export const PALETTE_PRESETS: Record<string, Record<string, string>> = {
  'Peach Milk': {
    unobtainable: '#ef9d70',
    'brand-primary': '#ffcbb0',
    'brand-secondary': '#8c5b4f',
    temporary: '#f0a3b8',
    caught: '#96b96e',
  },
  Sakura: {
    unobtainable: '#f48fd4',
    'brand-primary': '#ffc2ee',
    'brand-secondary': '#8a4f7d',
    temporary: '#ffb385',
    caught: '#d96a8b',
  },
  Butter: {
    unobtainable: '#f4c84f',
    'brand-primary': '#ffe3a3',
    'brand-secondary': '#8f6f4e',
    temporary: '#f2a65a',
    caught: '#6fa8d6',
  },
  'Mint Milk': {
    unobtainable: '#7fd0a8',
    'brand-primary': '#bfe8d2',
    'brand-secondary': '#3f7d68',
    temporary: '#f2c073',
    caught: '#4a90c2',
  },
  Twilight: {
    unobtainable: '#a49add',
    'brand-primary': '#c9c3e8',
    'brand-secondary': '#56548f',
    temporary: '#eea98c',
    caught: '#5da98c',
  },
  Matcha: {
    unobtainable: '#96b542',
    'brand-primary': '#cfd9a8',
    'brand-secondary': '#5c6b3c',
    temporary: '#e8b465',
    caught: '#52855e',
  },
  Latte: {
    unobtainable: '#cf9d64',
    'brand-primary': '#e6d3bd',
    'brand-secondary': '#6f4e37',
    temporary: '#e58f7b',
    caught: '#5b8a8a',
  },
  Slate: {
    unobtainable: '#7396c4',
    'brand-primary': '#c6cdd8',
    'brand-secondary': '#3d4a5d',
    temporary: '#e0a35c',
    caught: '#63a06f',
  },
};

export const DEFAULT_THEME = 'Peach Milk';

// the bases shown as identity dots for a theme (nav popover + workbench)
export const PRESET_DOT_BASES = ['brand-primary', 'brand-secondary', 'unobtainable', 'temporary', 'caught'];

export const PALETTE_DERIVED: [string, DerivedSpec][] = [
  ['brand-primary-light', { source: 'brand-primary', fn: 'tint', amount: 46.5 }],
  ['brand-primary-dark', { source: 'brand-primary', fn: 'darken', amount: 7 }],
  ['brand-primary-l10', { source: 'brand-primary', fn: 'lighten', amount: 10 }],
  ['brand-primary-l15', { source: 'brand-primary', fn: 'lighten', amount: 15 }],
  ['brand-primary-d4', { source: 'brand-primary', fn: 'darken', amount: 4 }],
  ['unobtainable-light', { source: 'unobtainable', fn: 'tint', amount: 46.5 }],
  ['unobtainable-light-d5', { source: 'unobtainable-light', fn: 'darken', amount: 5 }],
  ['brand-secondary-light', { source: 'brand-secondary', fn: 'lighten', amount: 7 }],
  ['brand-secondary-dark', { source: 'brand-secondary', fn: 'darken', amount: 7 }],
  ['brand-secondary-dark-d3', { source: 'brand-secondary-dark', fn: 'darken', amount: 3 }],
  ['brand-secondary-dark-d4', { source: 'brand-secondary-dark', fn: 'darken', amount: 4 }],
  ['brand-secondary-a7', { source: 'brand-secondary', fn: 'alpha', amount: .07 }],
  ['brand-secondary-a15', { source: 'brand-secondary', fn: 'alpha', amount: .15 }],
  ['brand-secondary-a45', { source: 'brand-secondary', fn: 'alpha', amount: .45 }],
  ['temporary-light', { source: 'temporary', fn: 'tint', amount: 68 }],
  ['temporary-a60', { source: 'temporary', fn: 'alpha', amount: .6 }],
  ['temporary-stripe', { source: 'temporary', fn: 'alpha', amount: .16 }],
  ['caught-light', { source: 'caught', fn: 'tint', amount: 55.7 }],
  ['caught-d10', { source: 'caught', fn: 'darken', amount: 10 }],
  ['caught-a60', { source: 'caught', fn: 'alpha', amount: .6 }],
  ['gray-light-l25', { source: 'gray-light', fn: 'lighten', amount: 25 }],
  ['gray-light-a30', { source: 'gray-light', fn: 'alpha', amount: .3 }],
  ['gray-medium-a40', { source: 'gray-medium', fn: 'alpha', amount: .4 }],
  ['release-danger-muted', { source: 'release-danger', fn: 'desaturate', amount: 15 }],
  ['release-danger-soft', { source: 'release-danger-muted', fn: 'darken', amount: 5 }],
  ['release-danger-dark', { source: 'release-danger', fn: 'darken', amount: 7 }],
  ['release-danger-soft-dark', { source: 'release-danger-soft', fn: 'darken', amount: 7 }],
  ['grid-line-light', { source: 'brand-secondary', fn: 'alpha', amount: .18 }],
  ['pattern-icons', { source: 'brand-primary', fn: 'shade', amount: 10 }],
  ['brand-primary-dim', { source: 'brand-primary', fn: 'saturation', amount: 25 }],
  ['surface-light', { source: 'brand-primary', fn: 'tint', amount: 62 }],
  ['surface-raised-light', { source: 'brand-primary', fn: 'tint', amount: 85 }],
  ['surface-dark', { source: 'brand-primary-dim', fn: 'shade', amount: 64 }],
  ['surface-raised-dark', { source: 'brand-primary-dim', fn: 'shade', amount: 56 }],
  // text roles: every one is contrast-guaranteed against the surfaces it can land on,
  // so no theme and no mode can render a field unreadable
  ['text-light', { source: 'brand-secondary', fn: 'readable', amount: 4.5, against: ['surface-light', 'surface-raised-light'] }],
  ['text-muted-src-light', { source: 'brand-secondary', fn: 'tint', amount: 38 }],
  ['text-muted-light', { source: 'text-muted-src-light', fn: 'readable', amount: 3, against: ['surface-light', 'surface-raised-light'] }],
  // near-white but carrying the theme's own hue, rather than a flat neutral
  ['text-dark-src', { source: 'brand-primary-dim', fn: 'tint', amount: 88 }],
  ['text-dark', { source: 'text-dark-src', fn: 'readable', amount: 4.5, against: ['surface-dark', 'surface-raised-dark'] }],
  ['text-muted-dark-src', { source: 'text-dark-src', fn: 'shade', amount: 28 }],
  ['text-muted-dark', { source: 'text-muted-dark-src', fn: 'readable', amount: 3, against: ['surface-dark', 'surface-raised-dark'] }],
  // the nav bar and the tile fills don't flip with the mode, so these are mode-independent
  ['text-on-chrome', { source: 'brand-secondary', fn: 'readable', amount: 4.5, against: ['brand-primary', 'brand-primary-l10', 'brand-primary-l15', 'brand-primary-light', 'brand-primary-d4'] }],
  ['text-inverse', { source: 'gray-light', fn: 'readable', amount: 4.5, against: ['brand-secondary', 'brand-secondary-dark', 'brand-secondary-dark-d3', 'brand-secondary-dark-d4', 'release-danger', 'release-danger-soft'] }],
  ['text-on-tile', { source: 'brand-secondary', fn: 'readable', amount: 4.5, against: ['unobtainable-light', 'temporary-light', 'caught-light'] }],
  // status colours used as text on the page, rather than on a tile fill
  ['accent-caught-light', { source: 'caught', fn: 'readable', amount: 4.5, against: ['surface-light', 'surface-raised-light'] }],
  ['accent-caught-dark', { source: 'caught', fn: 'readable', amount: 4.5, against: ['surface-dark', 'surface-raised-dark'] }],
  ['accent-temporary-light', { source: 'temporary', fn: 'readable', amount: 4.5, against: ['surface-light', 'surface-raised-light'] }],
  ['accent-temporary-dark', { source: 'temporary', fn: 'readable', amount: 4.5, against: ['surface-dark', 'surface-raised-dark'] }],
  // the sealed glint: near-white, but carrying the active theme's hue
  ['shine', { source: 'brand-primary', fn: 'tint', amount: 90 }],
  ['shine-a50', { source: 'shine', fn: 'alpha', amount: .5 }],
];

export const TOKEN_NAMES: string[] = [...Object.keys(PALETTE_BASES), ...PALETTE_DERIVED.map(([name]) => name)];

// channels are floats 0–255 (dart-sass emits fractional rgb); alpha 0–1
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function hexToRgba (hex: string): Rgba | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff, a: 1 };
}

export function rgbaToHex (color: Rgba): string {
  const channel = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function cssValue (color: Rgba): string {
  if (color.a >= 1) {
    return rgbaToHex(color);
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return `rgba(${round(color.r)}, ${round(color.g)}, ${round(color.b)}, ${color.a})`;
}

// HSL round trip matching Sass semantics (lightness/saturation in % points)

function rgbToHsl ({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return { h: h * 60, s, l };
}

function hslToRgb (h: number, s: number, l: number, a: number): Rgba {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    return { r: l * 255, g: l * 255, b: l * 255, a };
  }
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return { r: channel(hue + 1 / 3) * 255, g: channel(hue) * 255, b: channel(hue - 1 / 3) * 255, a };
}

function adjustLightness (color: Rgba, points: number): Rgba {
  const { h, s, l } = rgbToHsl(color);
  const clamped = Math.min(1, Math.max(0, l + points / 100));
  return hslToRgb(h, s, clamped, color.a);
}

function adjustSaturation (color: Rgba, points: number): Rgba {
  const { h, s, l } = rgbToHsl(color);
  const clamped = Math.min(1, Math.max(0, s + points / 100));
  return hslToRgb(h, clamped, l, color.a);
}

function setSaturation (color: Rgba, percent: number): Rgba {
  const { h, l } = rgbToHsl(color);
  return hslToRgb(h, percent / 100, l, color.a);
}

// sass scale-color semantics: share of remaining headroom toward white/black
function scaleLightness (color: Rgba, percent: number): Rgba {
  const { h, s, l } = rgbToHsl(color);
  const scaled = percent >= 0 ? l + (1 - l) * (percent / 100) : l * (1 + percent / 100);
  return hslToRgb(h, s, Math.min(1, Math.max(0, scaled)), color.a);
}

// walks the source toward the backdrop's opposite until it clears the ratio against all of them
function readable (color: Rgba, backdrops: Rgba[], target: number): Rgba {
  if (backdrops.length === 0) {
    return color;
  }
  const average = backdrops.reduce((sum, bg) => sum + luminance(bg), 0) / backdrops.length;
  const step = average < .5 ? 6 : -6;
  let current = color;
  for (let i = 0; i < 60; i++) {
    if (backdrops.every((bg) => contrastRatio(current, bg, bg) >= target)) {
      break;
    }
    current = scaleLightness(current, step);
  }
  return current;
}

// same order and math as the SCSS build
export function resolvePalette (overrides: Record<string, string> = {}): Record<string, Rgba> {
  const resolved: Record<string, Rgba> = {};
  for (const [name, fallback] of Object.entries(PALETTE_BASES)) {
    resolved[name] = hexToRgba(overrides[name] ?? fallback) ?? hexToRgba(fallback)!;
  }
  for (const [name, spec] of PALETTE_DERIVED) {
    const source = resolved[spec.source];
    if (spec.fn === 'alpha') {
      resolved[name] = { ...source, a: spec.amount };
    } else if (spec.fn === 'desaturate' || spec.fn === 'saturate') {
      resolved[name] = adjustSaturation(source, spec.fn === 'saturate' ? spec.amount : -spec.amount);
    } else if (spec.fn === 'saturation') {
      resolved[name] = setSaturation(source, spec.amount);
    } else if (spec.fn === 'readable') {
      resolved[name] = readable(source, (spec.against ?? []).map((key) => resolved[key]), spec.amount);
    } else if (spec.fn === 'tint' || spec.fn === 'shade') {
      resolved[name] = scaleLightness(source, spec.fn === 'tint' ? spec.amount : -spec.amount);
    } else {
      resolved[name] = adjustLightness(source, spec.fn === 'lighten' ? spec.amount : -spec.amount);
    }
  }
  return resolved;
}

// parses hex / keywords / fractional rgb() from getComputedStyle
export function parseCssColor (raw: string): Rgba | null {
  const value = raw.trim().toLowerCase();
  if (value === 'white') {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  if (value === 'black') {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  const hex = hexToRgba(value);
  if (hex) {
    return hex;
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return hexToRgba(`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`);
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(value);
  if (fn) {
    const parts = fn[1].split(',').map((part) => parseFloat(part));
    if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
  }
  return null;
}

export function colorsClose (a: Rgba, b: Rgba, tolerance = 1.5): boolean {
  return Math.abs(a.r - b.r) <= tolerance
    && Math.abs(a.g - b.g) <= tolerance
    && Math.abs(a.b - b.b) <= tolerance
    && Math.abs(a.a - b.a) <= .01;
}

// --- WCAG contrast (alpha composited over the given backdrop first)

function luminance ({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const n = v / 255;
    return n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4);
  };
  return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
}

export function composite (fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) {
    return fg;
  }
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

export function contrastRatio (fg: Rgba, bg: Rgba, behind: Rgba = { r: 255, g: 255, b: 255, a: 1 }): number {
  const solidBg = composite(bg, behind);
  const solidFg = composite(fg, solidBg);
  const l1 = luminance(solidFg);
  const l2 = luminance(solidBg);
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}
