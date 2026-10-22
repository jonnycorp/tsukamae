// explicit .ts extensions: scripts/check-themes.mjs loads these modules in node
import { contrast, cssColor, deltaE, hueDistance, over, parseCssColor, toLch, toRgb } from './color.ts';

import type { Lch, Rgb } from './color.ts';
import type { PokemonType } from '../types';

export type Mode = 'light' | 'dark';

type Source = 'hue' | 'ink' | 'unobtainable' | 'temporary' | 'caught';

// a theme's own step off the shared ladder for one tone: its lightness, its chroma (taken as is, not scaled), or the
// hue it's drawn from
export interface ToneOverride {
  l?: number;
  c?: number;
  source?: Source;
}

// a theme is a handful of hues; every colour in both modes is computed from them. Most themes share one lightness
// structure and differ in character; a theme with tones of its own steps off it where it says (a dark bar in Light,
// near-black paper in Soft Dark), and the solver still sets every text role to its target over whatever it chose
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
  tones?: Partial<Record<Mode, Record<string, ToneOverride>>>;
  // how strongly the grid's lines and rules show, over the shared .15
  lineAlpha?: number;
}

// Apricot is the one contrasting theme; the rest are waves through a single colour family
export const THEMES: ThemeSeed[] = [
  { name: 'Apricot', hue: 55, ink: 42, unobtainable: 75, temporary: 355, caught: 132, chroma: 1 },
  { name: 'Matcha', hue: 128, ink: 145, unobtainable: 160, temporary: 112, caught: 145, chroma: 0.85 },
  { name: 'Harbor', hue: 232, ink: 245, unobtainable: 68, temporary: 205, caught: 240, chroma: 0.8, unobtainableChroma: 0.9 },
  { name: 'Wisteria', hue: 300, ink: 295, unobtainable: 285, temporary: 318, caught: 292, chroma: 1 },
  { name: 'Graphite', hue: 250, ink: 255, unobtainable: 250, temporary: 232, caught: 256, chroma: 0.22, statusChroma: 0.85, unobtainableChroma: 0.3 },
  // the device: a red bar with white type over near-white paper, the dex's teal screen glow on the tiles; Soft Dark a
  // deep red bar over blue-black
  {
    name: 'Pokédex', hue: 25, ink: 255, unobtainable: 75, temporary: 320, caught: 190, chroma: 1,
    tones: {
      light: {
        paper: { l: 0.972, c: 0.008 }, 'paper-raised': { l: 0.994, c: 0.004 }, 'paper-sunken': { l: 0.94, c: 0.012 }, chip: { l: 0.925, c: 0.012 },
        chrome: { l: 0.52, c: 0.19 }, 'chrome-hover': { l: 0.47, c: 0.18 }, 'chrome-active': { l: 0.44, c: 0.17 }, 'chrome-pattern': { l: 0.48, c: 0.19 },
        meter: { l: 0.84, c: 0.07, source: 'caught' }, 'meter-edge': { l: 0.55, c: 0.15 },
        accent: { l: 0.45, c: 0.11 }, 'accent-hover': { l: 0.39, c: 0.1 },
        overlay: { l: 0.31, c: 0.04 }, 'overlay-deep': { l: 0.27, c: 0.038 }, 'overlay-deeper': { l: 0.24, c: 0.035 }, 'overlay-edge': { l: 0.52, c: 0.19, source: 'hue' },
        'tile-caught': { l: 0.86, c: 0.07 },
      },
      dark: {
        paper: { l: 0.25, c: 0.015, source: 'ink' }, 'paper-raised': { l: 0.29, c: 0.017, source: 'ink' }, 'paper-sunken': { l: 0.22, c: 0.013, source: 'ink' }, chip: { l: 0.22, c: 0.013, source: 'ink' },
        field: { l: 0.22, c: 0.013, source: 'ink' },
        chrome: { l: 0.36, c: 0.14 }, 'chrome-hover': { l: 0.4, c: 0.14 }, 'chrome-active': { l: 0.44, c: 0.14 }, 'chrome-pattern': { l: 0.33, c: 0.13 },
        meter: { l: 0.3, c: 0.05, source: 'caught' }, 'meter-edge': { l: 0.55, c: 0.14 },
        accent: { l: 0.74, c: 0.14 }, 'accent-hover': { l: 0.79, c: 0.12 },
        'tile-caught': { l: 0.33, c: 0.06 }, 'tile-unobtainable': { l: 0.21, c: 0.02 }, 'tile-temporary': { l: 0.27, c: 0.04 },
      },
    },
  },
  // four greens of a pocket screen, statuses told apart by depth (and temporary's stripes); Soft Dark the screen unlit
  {
    name: 'Game Boy', hue: 118, ink: 135, unobtainable: 112, temporary: 128, caught: 125, chroma: 1, lineAlpha: 0.24,
    tones: {
      light: {
        paper: { l: 0.87, c: 0.07 }, 'paper-raised': { l: 0.9, c: 0.06 }, 'paper-sunken': { l: 0.84, c: 0.075 }, chip: { l: 0.83, c: 0.07 },
        chrome: { l: 0.36, c: 0.07 }, 'chrome-hover': { l: 0.41, c: 0.075 }, 'chrome-active': { l: 0.45, c: 0.08 }, 'chrome-pattern': { l: 0.33, c: 0.065 },
        meter: { l: 0.7, c: 0.12 }, 'meter-edge': { l: 0.4, c: 0.07 },
        accent: { l: 0.36, c: 0.07 }, 'accent-hover': { l: 0.31, c: 0.065 },
        overlay: { l: 0.3, c: 0.06 }, 'overlay-deep': { l: 0.26, c: 0.055 }, 'overlay-deeper': { l: 0.23, c: 0.05 }, 'overlay-edge': { l: 0.2, c: 0.045 },
        field: { l: 0.91, c: 0.05 }, 'field-edge': { l: 0.42, c: 0.06 }, 'field-focus': { l: 0.3, c: 0.06 },
        'tile-unobtainable': { l: 0.92, c: 0.05 }, 'tile-temporary': { l: 0.82, c: 0.09 }, 'tile-temporary-stripe': { l: 0.76, c: 0.11 }, 'tile-caught': { l: 0.7, c: 0.13 },
        'status-unobtainable': { l: 0.62, c: 0.07 }, 'status-temporary': { l: 0.52, c: 0.1 }, 'status-caught': { l: 0.4, c: 0.1 },
      },
      dark: {
        paper: { l: 0.24, c: 0.04 }, 'paper-raised': { l: 0.28, c: 0.045 }, 'paper-sunken': { l: 0.21, c: 0.035 }, chip: { l: 0.21, c: 0.035 },
        chrome: { l: 0.17, c: 0.035 }, 'chrome-hover': { l: 0.21, c: 0.04 }, 'chrome-active': { l: 0.25, c: 0.045 }, 'chrome-pattern': { l: 0.15, c: 0.03 },
        meter: { l: 0.33, c: 0.07 }, 'meter-edge': { l: 0.55, c: 0.1 },
        accent: { l: 0.78, c: 0.12 }, 'accent-hover': { l: 0.83, c: 0.11 },
        field: { l: 0.21, c: 0.035 }, 'field-edge': { l: 0.5, c: 0.07 },
        'tile-unobtainable': { l: 0.18, c: 0.03 }, 'tile-temporary': { l: 0.3, c: 0.06 }, 'tile-temporary-stripe': { l: 0.34, c: 0.07 }, 'tile-caught': { l: 0.42, c: 0.1 },
        'status-unobtainable': { l: 0.55, c: 0.06 }, 'status-temporary': { l: 0.68, c: 0.1 }, 'status-caught': { l: 0.8, c: 0.12 },
      },
    },
  },
  // synthwave: a hot violet bar and magenta buttons over lilac in Light; in Soft Dark deep indigo with neon cyan tiles,
  // amber and hot pink beside them
  {
    name: 'Midnight', hue: 285, ink: 330, unobtainable: 75, temporary: 345, caught: 190, chroma: 1.2, statusChroma: 1.3,
    tones: {
      light: {
        chrome: { l: 0.45, c: 0.2 }, 'chrome-hover': { l: 0.5, c: 0.19 }, 'chrome-active': { l: 0.55, c: 0.18 }, 'chrome-pattern': { l: 0.41, c: 0.2 },
        accent: { l: 0.55, c: 0.2 }, 'accent-hover': { l: 0.49, c: 0.19 },
        overlay: { l: 0.28, c: 0.08, source: 'hue' }, 'overlay-deep': { l: 0.24, c: 0.075, source: 'hue' }, 'overlay-deeper': { l: 0.21, c: 0.07, source: 'hue' }, 'overlay-edge': { l: 0.55, c: 0.2 },
        'tile-caught': { l: 0.84, c: 0.1 },
      },
      dark: {
        paper: { l: 0.19, c: 0.05 }, 'paper-raised': { l: 0.23, c: 0.055 }, 'paper-sunken': { l: 0.16, c: 0.045 }, chip: { l: 0.16, c: 0.045 },
        chrome: { l: 0.14, c: 0.06 }, 'chrome-hover': { l: 0.19, c: 0.07 }, 'chrome-active': { l: 0.23, c: 0.08 }, 'chrome-pattern': { l: 0.17, c: 0.065 },
        meter: { l: 0.22, c: 0.07 }, 'meter-edge': { l: 0.6, c: 0.2, source: 'ink' },
        accent: { l: 0.72, c: 0.2, source: 'ink' }, 'accent-hover': { l: 0.77, c: 0.18, source: 'ink' },
        overlay: { l: 0.16, c: 0.06, source: 'hue' }, 'overlay-deep': { l: 0.2, c: 0.065, source: 'hue' }, 'overlay-deeper': { l: 0.24, c: 0.07, source: 'hue' }, 'overlay-edge': { l: 0.6, c: 0.2 },
        field: { l: 0.16, c: 0.045 }, 'field-edge': { l: 0.45, c: 0.1, source: 'hue' }, 'field-focus': { l: 0.72, c: 0.2 },
        'tile-unobtainable': { l: 0.22, c: 0.04 }, 'tile-temporary': { l: 0.26, c: 0.08 }, 'tile-temporary-stripe': { l: 0.31, c: 0.11 }, 'tile-caught': { l: 0.3, c: 0.1 },
      },
    },
  },
  // print: white paper, black bar and rules, greys for the statuses and a single red for what you press
  {
    name: 'Ink', hue: 260, ink: 25, unobtainable: 260, temporary: 25, caught: 260, chroma: 0.05, statusChroma: 0.6, unobtainableChroma: 0.05, lineAlpha: 0.32,
    tones: {
      light: {
        paper: { l: 0.975, c: 0 }, 'paper-raised': { l: 1, c: 0 }, 'paper-sunken': { l: 0.945, c: 0 }, chip: { l: 0.925, c: 0 },
        chrome: { l: 0.2, c: 0 }, 'chrome-hover': { l: 0.27, c: 0 }, 'chrome-active': { l: 0.32, c: 0 }, 'chrome-pattern': { l: 0.16, c: 0 },
        meter: { l: 0.82, c: 0 }, 'meter-edge': { l: 0.2, c: 0 },
        accent: { l: 0.52, c: 0.19 }, 'accent-hover': { l: 0.46, c: 0.18 },
        overlay: { l: 0.2, c: 0 }, 'overlay-deep': { l: 0.26, c: 0 }, 'overlay-deeper': { l: 0.31, c: 0 }, 'overlay-edge': { l: 0.12, c: 0 },
        field: { l: 1, c: 0 }, 'field-edge': { l: 0.25, c: 0 }, 'field-focus': { l: 0.52, c: 0.19 },
        'tile-unobtainable': { l: 0.885, c: 0 }, 'tile-temporary': { l: 0.93, c: 0 }, 'tile-temporary-stripe': { l: 0.86, c: 0 }, 'tile-caught': { l: 0.8, c: 0 },
        'status-unobtainable': { l: 0.62, c: 0 }, 'status-temporary': { l: 0.55, c: 0.18 }, 'status-caught': { l: 0.3, c: 0 },
      },
      dark: {
        paper: { l: 0.17, c: 0 }, 'paper-raised': { l: 0.21, c: 0 }, 'paper-sunken': { l: 0.14, c: 0 }, chip: { l: 0.14, c: 0 },
        chrome: { l: 0.1, c: 0 }, 'chrome-hover': { l: 0.15, c: 0 }, 'chrome-active': { l: 0.2, c: 0 }, 'chrome-pattern': { l: 0.12, c: 0 },
        meter: { l: 0.3, c: 0 }, 'meter-edge': { l: 0.7, c: 0 },
        accent: { l: 0.66, c: 0.17, source: 'ink' }, 'accent-hover': { l: 0.71, c: 0.15, source: 'ink' },
        overlay: { l: 0.24, c: 0 }, 'overlay-deep': { l: 0.29, c: 0 }, 'overlay-deeper': { l: 0.33, c: 0 }, 'overlay-edge': { l: 0.5, c: 0 },
        field: { l: 0.14, c: 0 }, 'field-edge': { l: 0.6, c: 0 }, 'field-focus': { l: 0.66, c: 0.17, source: 'ink' },
        'tile-unobtainable': { l: 0.235, c: 0 }, 'tile-temporary': { l: 0.29, c: 0 }, 'tile-temporary-stripe': { l: 0.345, c: 0 }, 'tile-caught': { l: 0.42, c: 0 },
        'status-unobtainable': { l: 0.55, c: 0 }, 'status-temporary': { l: 0.66, c: 0.16 }, 'status-caught': { l: 0.82, c: 0 },
      },
    },
  },
  // Pokémon HOME's own: a mint bar, sky-blue buttons and boxes over white; Soft Dark its navy
  {
    name: 'HOME', hue: 178, ink: 232, unobtainable: 62, temporary: 345, caught: 212, chroma: 1,
    tones: {
      light: {
        paper: { l: 0.97, c: 0.012 }, 'paper-raised': { l: 0.993, c: 0.005 }, 'paper-sunken': { l: 0.94, c: 0.016 },
        chrome: { l: 0.8, c: 0.1 }, 'chrome-hover': { l: 0.85, c: 0.085 }, 'chrome-active': { l: 0.89, c: 0.07 }, 'chrome-pattern': { l: 0.76, c: 0.105 },
        accent: { l: 0.52, c: 0.14 }, 'accent-hover': { l: 0.46, c: 0.13 },
        overlay: { l: 0.4, c: 0.08 }, 'overlay-deep': { l: 0.35, c: 0.075 }, 'overlay-deeper': { l: 0.31, c: 0.07 }, 'overlay-edge': { l: 0.32, c: 0.07 },
        'tile-caught': { l: 0.86, c: 0.06 },
      },
      dark: {
        paper: { l: 0.27, c: 0.04, source: 'ink' }, 'paper-raised': { l: 0.31, c: 0.045, source: 'ink' }, 'paper-sunken': { l: 0.24, c: 0.035, source: 'ink' }, chip: { l: 0.24, c: 0.035, source: 'ink' },
        field: { l: 0.24, c: 0.035, source: 'ink' },
        chrome: { l: 0.22, c: 0.05 }, 'chrome-hover': { l: 0.26, c: 0.055 }, 'chrome-active': { l: 0.3, c: 0.06 }, 'chrome-pattern': { l: 0.2, c: 0.05 },
        'tile-caught': { l: 0.34, c: 0.07 },
      },
    },
  },
  // volcanic: a charcoal bar and popover, orange buttons, ember tiles glowing beside ash; Soft Dark coal
  {
    name: 'Ember', hue: 45, ink: 40, unobtainable: 40, temporary: 18, caught: 68, chroma: 1, unobtainableChroma: 0.15,
    tones: {
      light: {
        paper: { l: 0.955, c: 0.012 }, 'paper-raised': { l: 0.985, c: 0.006 }, 'paper-sunken': { l: 0.925, c: 0.014 },
        chrome: { l: 0.27, c: 0.02, source: 'ink' }, 'chrome-hover': { l: 0.32, c: 0.02, source: 'ink' }, 'chrome-active': { l: 0.36, c: 0.022, source: 'ink' }, 'chrome-pattern': { l: 0.24, c: 0.02, source: 'ink' },
        accent: { l: 0.52, c: 0.16 }, 'accent-hover': { l: 0.47, c: 0.15 },
        overlay: { l: 0.26, c: 0.02 }, 'overlay-deep': { l: 0.22, c: 0.018 }, 'overlay-deeper': { l: 0.19, c: 0.016 }, 'overlay-edge': { l: 0.6, c: 0.17 },
        'tile-caught': { l: 0.84, c: 0.1 }, 'tile-unobtainable': { l: 0.9, c: 0.012 },
      },
      dark: {
        paper: { l: 0.2, c: 0.012 }, 'paper-raised': { l: 0.24, c: 0.014 }, 'paper-sunken': { l: 0.17, c: 0.01 }, chip: { l: 0.17, c: 0.01 },
        chrome: { l: 0.14, c: 0.012 }, 'chrome-hover': { l: 0.19, c: 0.014 }, 'chrome-active': { l: 0.23, c: 0.016 }, 'chrome-pattern': { l: 0.12, c: 0.01 },
        field: { l: 0.17, c: 0.01 },
        accent: { l: 0.72, c: 0.16 }, 'accent-hover': { l: 0.77, c: 0.14 },
        'tile-caught': { l: 0.35, c: 0.1 }, 'tile-unobtainable': { l: 0.255, c: 0.01 }, 'tile-temporary': { l: 0.3, c: 0.06 }, 'tile-temporary-stripe': { l: 0.34, c: 0.08 },
      },
    },
  },
];

export const DEFAULT_THEME = 'Apricot';

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

// each type's colour in Scarlet and Violet, where its glyph starts (seal-faces TypesBlock); only its lightness moves, per
// theme and mode, until it reads on a sealed tile, so no theme's colours bend for them
export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#9fa19f',
  fire: '#e62829',
  water: '#2980ef',
  electric: '#fac000',
  grass: '#3fa129',
  ice: '#3dcef3',
  fighting: '#ff8000',
  poison: '#9141cb',
  ground: '#915121',
  flying: '#81b9ef',
  psychic: '#ef4179',
  bug: '#91a119',
  rock: '#afa981',
  ghost: '#704170',
  dragon: '#5060e1',
  dark: '#624d4e',
  steel: '#60a1b8',
  fairy: '#ef70ef',
};

// a glyph is a graphic, not text: WCAG's 3:1 for one, on a light tile. On a soft dark tile the darker types sat dim
// at 3:1, so there each reaches 4:1
export const GLYPH_CONTRAST: Record<Mode, number> = { light: 3, dark: 4 };

interface WashLight {
  l: number;
  c: number;
  h: number | 'caught';
  alpha: number;
}

const HOME_CYAN = 200;

// alpha is where each search starts, not the final strength
// wash-loan is a sealed mon checked out, away from its shelf (utils/location-moves): a rose-coral, laid on firmly
// enough to stay rose over a green tile, where a lighter coral blended to the tan of Champions' gold
const WASHES: Record<Mode, Record<string, WashLight>> = {
  light: {
    'wash-seal': { l: 0.97, c: 0.04, h: 'caught', alpha: 0.62 },
    'wash-home': { l: 0.8, c: 0.14, h: 250, alpha: 0.2 },
    'wash-champions': { l: 0.86, c: 0.17, h: 80, alpha: 0.25 },
    'wash-loan': { l: 0.7, c: 0.18, h: 8, alpha: 0.32 },
  },
  dark: {
    'wash-seal': { l: 0.66, c: 0.1, h: 'caught', alpha: 0.32 },
    'wash-home': { l: 0.72, c: 0.14, h: 250, alpha: 0.15 },
    'wash-champions': { l: 0.6, c: 0.14, h: 72, alpha: 0.2 },
    'wash-loan': { l: 0.6, c: 0.17, h: 8, alpha: 0.3 },
  },
};

// washes that must still read as their colour once laid over the tile, not just as apart from it: Champions as gold,
// a checked-out mon as rose
const READS_AS: Record<string, { within: number; chroma: number }> = {
  'wash-champions': { within: 45, chroma: 0.06 },
  'wash-loan': { within: 20, chroma: 0.05 },
};

// the weakest wash whose top reads apart from the fill and every earlier top, and as its own colour where READS_AS says
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
      const reads = READS_AS[name];
      const colour = !reads || (hueDistance(topHue, h) <= reads.within && c >= reads.chroma);
      if (colour && deltaE(top, fill) >= 0.045 && tops.every((other) => deltaE(top, other) >= 0.05)) {
        break;
      }
    }
    tops.push(top);
    solved[name] = toLch(top);
  }
  return solved;
}

// dark yellows and oranges read as brown, so their chromatic dark tones sit higher
const LIFTED = new Set(['chrome', 'chrome-hover', 'chrome-active', 'chrome-pattern', 'meter', 'tile-temporary', 'tile-temporary-stripe', 'tile-caught']);
const lift = (h: number) => 0.07 * Math.exp(-((hueDistance(h, 90) / 32) ** 2));
// low-chroma yellows read as beige or khaki
const vivify = (h: number) => 1 + 0.7 * Math.exp(-((hueDistance(h, 92) / 28) ** 2));

type Backdrops = [backdrops: Rgb[], target: number];

// an offset shadow under display lettering (a scene's logo, the meter's percentage, a banner's name), in a tone,
// stepped from the fill under it the given way: as far as 2:1 off the fill, so it shows as a shadow and not a smudge,
// but never nearer than 3:1 to the lettering, so it never thickens the glyphs. The margins survive 8-bit rounding
function shadowFor (fill: Lch, letters: Lch, tone: Omit<Lch, 'l'>, step: number): Lch {
  const under = toRgb(fill);
  const glyphs = toRgb(letters);
  let shadow: Lch = { ...tone, l: fill.l };
  for (let l = fill.l + step; l >= 0 && l <= 1; l += step) {
    const rgb = toRgb({ ...tone, l });
    if (contrast(rgb, glyphs) < 3.03) {
      break;
    }
    shadow = { ...tone, l };
    if (contrast(rgb, under) >= 2.03) {
      break;
    }
  }
  return shadow;
}

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
  for (const [name, [baseL, baseC, baseSource]] of Object.entries(TONES[mode])) {
    const own = seed.tones?.[mode]?.[name];
    const source = own?.source ?? baseSource;
    const h = hues[source];
    const status = STATUS_SOURCES.includes(source);
    const scale = source === 'unobtainable' ? seed.unobtainableChroma ?? statusScale : status ? statusScale : seed.chroma;
    if (own && (own.l !== undefined || own.c !== undefined)) {
      // a theme's own tone is taken as given: no lift, no ceiling, its chroma unscaled
      lch[name] = { l: own.l ?? baseL, c: own.c ?? baseC * scale, h };
      continue;
    }
    const lifted = dark && LIFTED.has(name) ? baseL + lift(h) : baseL;
    lch[name] = {
      l: dark && ['tile-unobtainable', 'tile-temporary', 'tile-caught'].includes(name) ? Math.min(lifted, tileCeiling) : lifted,
      c: baseC * scale * (status ? vivify(h) : 1),
      h,
    };
  }

  Object.assign(lch, solveWashes(lch['tile-caught'], hues.caught, mode));

  const rgb = (...names: string[]) => names.map((name) => toRgb(lch[name]));
  const tint = (l: number, c: number, source: Source): Lch => ({ l, c, h: hues[source] });

  lch.ink = solve(tint(dark ? 0.96 : 0.3, 0.02 * seed.chroma + 0.01, 'ink'), [rgb('paper', 'paper-raised', 'paper-sunken', 'chip', 'field'), 7]);
  lch['ink-muted'] = solve(tint(dark ? 0.84 : 0.5, 0.025 * seed.chroma + 0.005, 'ink'), [rgb('paper', 'paper-raised', 'paper-sunken'), 4.5]);
  lch['on-chrome'] = solve(tint(dark ? 0.9 : 0.36, 0.04 * seed.chroma + 0.01, 'ink'), [rgb('chrome', 'chrome-hover', 'chrome-active', 'chrome-pattern'), 4.5]);
  // the bar's quieter words (a scene's hints and counts, a menu's keys): a third of the way back toward the chrome, as
  // far as small text still reads there
  const quiet = lch['on-chrome'].l + (lch.chrome.l - lch['on-chrome'].l) / 3;
  lch['on-chrome-muted'] = solve({ ...lch['on-chrome'], l: quiet }, [rgb('chrome', 'chrome-hover'), 4.5]);
  lch['on-accent'] = solve(tint(dark ? 0.2 : 0.98, 0.01, 'hue'), [rgb('accent', 'accent-hover'), 4.5]);
  // the shadows under display lettering (shadowFor): on the accent, a deeper accent in either mode; on the page, the
  // accent's tint toward the ink, a light page's darker and a dark page's lighter (darker can't show there)
  lch['accent-shadow'] = shadowFor(lch.accent, lch['on-accent'], lch.accent, -0.005);
  lch['paper-shadow'] = shadowFor(lch['paper-raised'], lch.ink, { c: Math.min(lch.accent.c, 0.09), h: lch.accent.h }, dark ? 0.005 : -0.005);
  lch['on-overlay'] = solve(tint(0.96, 0.01, 'hue'), [rgb('overlay', 'overlay-deep', 'overlay-deeper'), 4.5]);
  lch['on-status'] = solve(tint(dark ? 0.2 : 0.99, 0.01, 'hue'), [rgb('status-unobtainable', 'status-temporary', 'status-caught'), 3]);
  lch['on-danger'] = solve({ l: dark ? 0.18 : 0.98, c: 0.01, h: 25 }, [rgb('danger', 'danger-hover'), 4.5]);
  lch['ink-danger'] = solve({ ...lch.danger }, [rgb('paper', 'paper-raised'), 4.5]);
  const sealedTile = rgb('tile-caught', 'wash-seal', 'wash-home', 'wash-champions', 'wash-loan');
  lch['on-tile'] = solve({ ...lch.ink }, [rgb('tile-unobtainable', 'tile-temporary', 'tile-temporary-stripe', 'tile-caught'), 7], [sealedTile, 4.5]);
  lch['on-tile-accent'] = solve(tint(dark ? 0.86 : 0.46, 0.11 * statusScale + 0.02, 'caught'), [sealedTile, 4.5]);
  lch['ink-caught'] = solve(tint(dark ? 0.86 : 0.5, 0.12 * statusScale + 0.02, 'caught'), [rgb('paper', 'paper-raised'), 4.5]);
  lch['ink-temporary'] = solve(tint(dark ? 0.86 : 0.5, 0.12 * statusScale + 0.02, 'temporary'), [rgb('paper', 'paper-raised'), 4.5]);
  // the gift red only sits on a tile's lower third, where the wash has faded below half; so do the type glyphs. It's
  // darkened only as far as the marks' 3:1 there, so it stays the gift's own red rather than a maroon
  const fill = toRgb(lch['tile-caught']);
  const lowerThird = [fill, ...sealedTile.map((top) => over({ ...top, a: 0.45 }, fill))];
  lch.gift = solve(lch.gift, [lowerThird, 3]);
  for (const [type, color] of Object.entries(TYPE_COLORS)) {
    lch[`type-${type}`] = solve(toLch(parseCssColor(color)), [lowerThird, GLYPH_CONTRAST[mode]]);
  }
  lch['mark-blue'] = solve(lch['mark-blue'], [rgb('tile-caught', 'tile-unobtainable'), 3]);
  lch['mark-pink'] = solve(lch['mark-pink'], [rgb('tile-caught', 'tile-unobtainable'), 3]);

  const palette: Record<string, string> = {};
  for (const [name, color] of Object.entries(lch)) {
    palette[name] = cssColor(toRgb(color));
  }
  const alpha = (name: string, a: number) => cssColor({ ...toRgb(lch[name]), a });
  return {
    ...palette,
    line: alpha('ink', seed.lineAlpha ?? (dark ? 0.16 : 0.15)),
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

// the name as styles/themes.scss keys a theme's character: lower case, accents off, words hyphened
export function themeSlug (name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
}

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
