import classNames from 'classnames';

import { padding } from './formatting';

import type { CapturePokemon, Dex } from '../types';

export const BOX_SIZE = 30;
export const BOX_COLUMNS = 6;
// keep in sync with $pokemon-box-size in styles/variables.scss
export const TILE_SIZE = 110;

export function groupBoxes<T extends { pokemon: { box: string | null } }> (captures: T[]) {
  let lastBoxName: string | null = null;
  let lastBoxIndex = 0;

  return captures.reduce<T[][]>((all, capture) => {
    let boxIndex = all[lastBoxIndex].length === BOX_SIZE ? lastBoxIndex + 1 : lastBoxIndex;

    if (capture.pokemon.box !== lastBoxName) {
      boxIndex++;
    }

    lastBoxName = capture.pokemon.box;
    lastBoxIndex = boxIndex;

    all[boxIndex] = all[boxIndex] || [];
    all[boxIndex].push(capture);
    return all;
  }, [[]]);
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
