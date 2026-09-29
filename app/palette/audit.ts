// explicit .ts extensions: scripts/check-themes.mjs loads these modules in node
import { THEMES, themePalette } from './themes.ts';
import { contrast, deltaE, parseCssColor } from './color.ts';

import type { Mode, ThemeSeed } from './themes.ts';

interface ContrastRule {
  fg: string;
  bg: string[];
  min: number;
}

interface DistinctRule {
  a: string;
  b: string[];
  min: number;
}

// every text role against every surface it can land on
const CONTRAST_RULES: ContrastRule[] = [
  { fg: 'ink', bg: ['paper', 'paper-raised', 'paper-sunken', 'chip', 'field', 'meter', 'tile-unobtainable', 'tile-temporary', 'tile-caught'], min: 4.5 },
  { fg: 'ink', bg: ['paper', 'paper-raised'], min: 7 },
  { fg: 'ink-muted', bg: ['paper', 'paper-raised', 'paper-sunken'], min: 4.5 },
  { fg: 'on-chrome', bg: ['chrome', 'chrome-hover', 'chrome-active', 'chrome-well'], min: 4.5 },
  { fg: 'on-accent', bg: ['accent', 'accent-hover'], min: 4.5 },
  { fg: 'on-overlay', bg: ['overlay', 'overlay-deep', 'overlay-deeper'], min: 4.5 },
  { fg: 'on-overlay-muted', bg: ['overlay', 'overlay-deep'], min: 4.5 },
  { fg: 'on-danger', bg: ['danger', 'danger-hover'], min: 4.5 },
  { fg: 'ink-danger', bg: ['paper', 'paper-raised'], min: 4.5 },
  { fg: 'on-status', bg: ['status-unobtainable', 'status-temporary', 'status-caught'], min: 3 },
  { fg: 'on-tile', bg: ['tile-unobtainable', 'tile-temporary', 'tile-temporary-stripe', 'tile-caught'], min: 7 },
  { fg: 'on-tile', bg: ['wash-seal', 'wash-home', 'wash-champions'], min: 4.5 },
  { fg: 'on-tile-accent', bg: ['tile-caught', 'wash-seal', 'wash-home', 'wash-champions'], min: 4.5 },
  { fg: 'gift', bg: ['tile-caught'], min: 4.5 },
  { fg: 'ink-caught', bg: ['paper', 'paper-raised'], min: 4.5 },
  { fg: 'ink-temporary', bg: ['paper', 'paper-raised'], min: 4.5 },
  { fg: 'tile-badge', bg: ['tile-unobtainable', 'tile-caught'], min: 3 },
  { fg: 'mark-blue', bg: ['tile-unobtainable', 'tile-caught'], min: 3 },
  { fg: 'mark-pink', bg: ['tile-unobtainable', 'tile-caught'], min: 3 },
];

// OKLab distance, so an empty slot, each status, each sealed location and the gift red stay tellable apart; temporary also carries its stripes
const DISTINCT_RULES: DistinctRule[] = [
  { a: 'tile-unobtainable', b: ['paper', 'tile-caught'], min: 0.05 },
  { a: 'tile-caught', b: ['paper'], min: 0.05 },
  { a: 'tile-temporary', b: ['paper', 'tile-unobtainable', 'tile-caught'], min: 0.035 },
  { a: 'tile-temporary-stripe', b: ['tile-temporary'], min: 0.03 },
  { a: 'chrome', b: ['paper'], min: 0.05 },
  { a: 'paper-raised', b: ['paper'], min: 0.02 },
  { a: 'gift', b: ['on-tile-accent', 'on-tile'], min: 0.12 },
  { a: 'tile-caught', b: ['wash-seal', 'wash-home', 'wash-champions'], min: 0.045 },
  { a: 'wash-seal', b: ['wash-home', 'wash-champions'], min: 0.05 },
  { a: 'wash-home', b: ['wash-champions'], min: 0.05 },
];

export interface AuditResult {
  theme: string;
  mode: Mode;
  rule: string;
  value: number;
  min: number;
  pass: boolean;
}

export function auditTheme (seed: ThemeSeed, mode: Mode): AuditResult[] {
  const palette = themePalette(seed, mode);
  const color = (name: string) => {
    if (!palette[name]) {
      throw new Error(`${seed.name} ${mode}: unknown token ${name}`);
    }
    return parseCssColor(palette[name]);
  };
  const results: AuditResult[] = [];
  const record = (rule: string, value: number, min: number) => {
    results.push({ theme: seed.name, mode, rule, value, min, pass: value >= min });
  };
  for (const { fg, bg, min } of CONTRAST_RULES) {
    for (const name of bg) {
      record(`${fg} on ${name}`, contrast(color(fg), color(name)), min);
    }
  }
  for (const { a, b, min } of DISTINCT_RULES) {
    for (const name of b) {
      record(`${a} vs ${name} (ΔE)`, deltaE(color(a), color(name)), min);
    }
  }
  return results;
}

export function auditAll (): AuditResult[] {
  return THEMES.flatMap((seed) => (['light', 'dark'] as Mode[]).flatMap((mode) => auditTheme(seed, mode)));
}
