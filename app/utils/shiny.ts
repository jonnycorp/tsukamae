import type { Capture, Dex } from '../types';

// Shiny as a trait of each mon, kept on its record. A living dex is strictly not shiny, so it's asked only where a mon
// can be: a free-form dex, which holds any mon you have, and a dex whose Shiny box is ticked, whose new mons start
// shiny. Kept on show where it says yes, so a record that came in shiny can still be put right

// the dex a record is asked in, its view or the dex itself: whether it's free-form, and its Shiny box
export type ShinyDex = Pick<Dex, 'shiny'> & { free?: boolean };

export const asksShinyIn = (dex: ShinyDex): boolean => Boolean(dex.free) || dex.shiny;

export function asksShiny (capture: Pick<Capture, 'shiny'>, dex: ShinyDex): boolean {
  return capture.shiny === true || asksShinyIn(dex);
}

// drawn shiny: as its record says, and a slot with no answer (one not marked, a checklist's, which keeps no fields)
// as its dex's box says
export function showsShiny (capture: Partial<Pick<Capture, 'shiny'>>, dex: Pick<Dex, 'shiny'>): boolean {
  return capture.shiny ?? dex.shiny;
}
