import { NATURES } from './capture-fields';

// how the sealed tiles show their faces (the theme menu or O, data-display on the root): Hexagon, the default, for
// day-to-day work, every face's facts in plain view a page at a time, or Orbit, for the pleasure of it, the ball alone
// large in the middle with its marks circling it under the mon's nickname, nothing flipping. Each is a list of pages,
// every page a block over the number line and the badges together, so a mode with more than one flips them alike
// (FlipStrips, styles/tile-faces.scss)
export type DisplayMode = 'hexagon' | 'orbit';
export const DISPLAY_MODES: DisplayMode[] = ['hexagon', 'orbit'];

export type FacePage = 'record' | 'trainer' | 'hub' | 'species';

export const DISPLAY_PAGES: Record<DisplayMode, FacePage[]> = {
  hexagon: ['record', 'trainer', 'species'],
  orbit: ['hub'],
};

// the stats a nature moves, by the letters Japanese players write them with (H A B C D S): each row of five in NATURES
// raises Attack, Defense, Speed, Sp. Atk, Sp. Def in turn and each column lowers them in the same turn, the five where
// the two meet moving nothing (neutral); null for a record with no nature
export type StatLetter = 'H' | 'A' | 'B' | 'C' | 'D' | 'S';
const ROW_STATS: StatLetter[] = ['A', 'B', 'S', 'C', 'D'];

export function natureStats (nature: string | null | undefined): { up: StatLetter; down: StatLetter } | 'neutral' | null {
  const i = nature ? NATURES.indexOf(nature) : -1;
  if (i < 0) {
    return null;
  }
  const up = ROW_STATS[Math.floor(i / 5)];
  const down = ROW_STATS[i % 5];
  return up === down ? 'neutral' : { up, down };
}

// the six round the stat hexagon as the games' summary draws it, HP at the top and on clockwise: Attack, Defense, Speed
// at the foot, Sp. Def, Sp. Atk
export const HEX_ORDER: StatLetter[] = ['H', 'A', 'B', 'S', 'D', 'C'];
