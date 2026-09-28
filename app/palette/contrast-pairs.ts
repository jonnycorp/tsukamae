// the contract the audit enforces and the workbench displays — one list, so they can't disagree

export interface ContrastPair {
  label: string;
  // palette token name, or a literal hex for colours that aren't themed
  fg: string;
  bg: string[];
  target: number;
  mode: 'light' | 'dark' | 'both';
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  { label: 'Body text', fg: 'text-light', bg: ['surface-light', 'surface-raised-light'], target: 4.5, mode: 'light' },
  { label: 'Muted text', fg: 'text-muted-light', bg: ['surface-light', 'surface-raised-light'], target: 3, mode: 'light' },
  { label: 'Body text', fg: 'text-dark', bg: ['surface-dark', 'surface-raised-dark'], target: 4.5, mode: 'dark' },
  { label: 'Muted text', fg: 'text-muted-dark', bg: ['surface-dark', 'surface-raised-dark'], target: 3, mode: 'dark' },
  { label: 'Status counts', fg: 'accent-caught-light', bg: ['surface-light', 'surface-raised-light'], target: 4.5, mode: 'light' },
  { label: 'Status counts', fg: 'accent-temporary-light', bg: ['surface-light', 'surface-raised-light'], target: 4.5, mode: 'light' },
  { label: 'Status counts', fg: 'accent-caught-dark', bg: ['surface-dark', 'surface-raised-dark'], target: 4.5, mode: 'dark' },
  { label: 'Status counts', fg: 'accent-temporary-dark', bg: ['surface-dark', 'surface-raised-dark'], target: 4.5, mode: 'dark' },
  { label: 'Nav + dropdowns', fg: 'text-on-chrome', bg: ['brand-primary', 'brand-primary-l10', 'brand-primary-l15', 'brand-primary-d4'], target: 4.5, mode: 'both' },
  { label: 'Popover text', fg: 'text-inverse', bg: ['brand-secondary', 'brand-secondary-dark', 'brand-secondary-dark-d3', 'brand-secondary-dark-d4'], target: 4.5, mode: 'both' },
  { label: 'Tile text', fg: 'text-on-tile', bg: ['unobtainable-light', 'temporary-light', 'caught-light'], target: 4.5, mode: 'both' },
  { label: 'Button text', fg: 'text-inverse', bg: ['brand-secondary', 'brand-secondary-dark'], target: 4.5, mode: 'both' },
  { label: 'Delete button', fg: 'text-inverse', bg: ['release-danger'], target: 4.5, mode: 'light' },
  { label: 'Delete button', fg: 'text-inverse', bg: ['release-danger-soft'], target: 4.5, mode: 'dark' },
  // caught-text is a tile accent, not body copy, so it is deliberately left out
  { label: 'Gift OT', fg: 'gift', bg: ['caught-light'], target: 3, mode: 'both' },
];

// the gift red never changes with the theme, so every theme's tile text has to stay distinguishable from it
export const GIFT_DISTINCT = {
  // the colours a gift OT can sit beside on a sealed tile
  tokens: ['caught-text', 'text-on-tile'],
  minHueGap: 20,
  // below this chroma a hue clash reads as brown, not as red
  chromaFloor: 35,
  minDeltaE: 25,
};
