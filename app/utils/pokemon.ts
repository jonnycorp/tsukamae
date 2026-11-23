import classNames from 'classnames';

import { lookOf } from './looks';
import { padding } from './formatting';
import { showsShiny } from './shiny';

import type { Capture, CapturePokemon, Dex } from '../types';

export const BOX_SIZE = 30;
export const BOX_COLUMNS = 6;
// unscaled px; keep in sync with $pokemon-box-size, $box-width and $dex-grid-gap in styles/variables.scss
export const TILE_SIZE = 110;
// a box's tiles plus the 1px frame each side, and the gap between boxes across a row
export const BOX_WIDTH = BOX_COLUMNS * TILE_SIZE + 2;
export const BOX_GAP = 40;

// a new box when the last one is full or a named run starts; never an empty box or a gap between them (a full box
// followed by a new run used to skip an index, and the flip overlays counted the gap)
export function groupBoxes<T extends { pokemon: { box: string | null } }> (captures: T[]): T[][] {
  const boxes: T[][] = [];
  captures.forEach((capture, i) => {
    const current = boxes[boxes.length - 1];
    if (!current || current.length === BOX_SIZE || capture.pokemon.box !== captures[i - 1].pokemon.box) {
      boxes.push([capture]);
    } else {
      current.push(capture);
    }
  });
  return boxes;
}

export function numberDigits (dex: Dex): number {
  return dex.total >= 1000 ? 4 : 3;
}

// regional dexes number by their own order; -1 marks a slot the regional dex doesn't number
export function dexNumber (pokemon: CapturePokemon, dex: Dex): string {
  if (!dex.regional) {
    return padding(pokemon.national_id, numberDigits(dex));
  }
  return pokemon.dex_number === -1 ? '---' : padding(pokemon.dex_number, numberDigits(dex));
}

// how a species' icon is drawn: `family`, the game family whose icons to draw (the dex's own), or none for the sheet's
// own; `shiny`, in its shiny colours, as the dex's box says for a species alone (a marked mon's own record says:
// monIcon); `female`, its species' female icon where it has one (the sheet's gender-female), never over a form
export interface IconOptions {
  family?: string | null;
  shiny?: boolean;
  female?: boolean;
}

export function iconClass ({ national_id: nationalId, form }: CapturePokemon, dex: Dex, { family = dex.dex_type.game_family_id, shiny = dex.shiny, female = false }: IconOptions = {}) {
  return classNames('pkicon', `pkicon-${padding(nationalId, 3)}`, {
    'color-shiny': shiny,
    [`form-${form}`]: Boolean(form),
    'gender-female': female && !form,
    [`game-family-${family}`]: Boolean(family),
  });
}

// a mon to draw: a marked one's record, or a species alone ({ pokemon }), drawn as its dex's box says
export type IconMon = Pick<Capture, 'pokemon'> & Partial<Pick<Capture, 'shiny' | 'gender' | 'look'>>;

// a mon's icon as its record says: its colours (utils/shiny), and a female's own icon; or the form its dex shows it as
// (utils/looks), from the sheet's own icons, as a game family's have none of its forms
export function monIcon (mon: IconMon, dex: Dex): string {
  const look = lookOf(mon, dex);
  const shiny = showsShiny(mon, dex);
  return look
    ? iconClass({ ...mon.pokemon, form: look.form }, dex, { family: null, shiny })
    : iconClass(mon.pokemon, dex, { shiny, female: mon.gender === 'female' });
}
