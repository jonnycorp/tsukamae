import classNames from 'classnames';

import { padding } from './formatting';

import type { CapturePokemon, Dex } from '../types';

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

export function iconClass ({ national_id: nationalId, form }: CapturePokemon, dex: Dex) {
  return classNames('pkicon', `pkicon-${padding(nationalId, 3)}`, {
    'color-shiny': dex.shiny,
    [`form-${form}`]: Boolean(form),
    [`game-family-${dex.dex_type.game_family_id}`]: true,
  });
}
