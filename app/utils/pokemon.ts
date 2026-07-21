import classNames from 'classnames';

import { padding } from './formatting';

import type { Dex } from '../types';

export const BOX_SIZE = 30;

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

// pokemonId → box index for a catalog list, cached per list (catalog references are stable).
const boxIndexCache = new WeakMap<object, Map<number, number>>();

export function boxIndexByPokemonId (pokemonList: { id: number; box: string | null }[]): Map<number, number> {
  const cached = boxIndexCache.get(pokemonList);
  if (cached) {
    return cached;
  }
  const byId = new Map<number, number>();
  groupBoxes(pokemonList.map((pokemon) => ({ pokemon }))).forEach((box, boxIndex) => {
    for (const { pokemon } of box) {
      byId.set(pokemon.id, boxIndex);
    }
  });
  boxIndexCache.set(pokemonList, byId);
  return byId;
}

interface Pokemon {
  national_id: number;
  form: string | null;
}

export function iconClass ({ national_id: nationalId, form }: Pokemon, dex: Dex) {
  const classes = {
    'color-shiny': dex.shiny,
    [`form-${form}`]: Boolean(form),
    [`game-family-${dex.dex_type.game_family_id}`]: true,
  };

  return classNames('pkicon', `pkicon-${padding(nationalId, 3)}`, classes);
}
