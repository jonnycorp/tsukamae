import { getCatalogDex, progressToCaptures } from '../../../utils/local-data';

import type { Capture, CapturePokemon } from '../../../types';
import type { PersonalDex } from '../../../utils/local-data';

// the atlas (G): every one of your dexes laid along the national dex, species by species, so what one dex has and
// another lacks lines up. A species' state in a dex is the best of its slots there (a form marked marks it)

export type AtlasState = 'sealed' | 'caught' | 'temporary' | 'unobtainable' | 'missing';

const RANK: Record<AtlasState, number> = { missing: 0, unobtainable: 1, temporary: 2, caught: 3, sealed: 4 };

export interface AtlasRow {
  dex: PersonalDex;
  // by national number; a species the dex doesn't list has none
  states: Map<number, AtlasState>;
  marked: number;
  total: number;
}

export interface AtlasData {
  rows: AtlasRow[];
  // the species along the national dex, its plain form, from HOME's catalog
  species: Map<number, CapturePokemon>;
  max: number;
  // where each generation starts along it
  generations: { generation: number; from: number; to: number }[];
}

const stateOf = (capture: Capture): AtlasState => {
  if (!capture.captured) {
    return 'missing';
  }
  return capture.sealed ? 'sealed' : capture.status!;
};

// what a species counts as having been caught: marked, and not just to say it can't be
export const isHeld = (state: AtlasState | undefined) => state === 'sealed' || state === 'caught' || state === 'temporary';

export function atlas (dexes: PersonalDex[], activeId: string, activeCaptures: Capture[]): AtlasData {
  const rows = dexes.map((dex) => {
    const captures = dex.id === activeId ? activeCaptures : progressToCaptures(dex);
    const states = new Map<number, AtlasState>();
    let marked = 0;
    for (const capture of captures) {
      const national = capture.pokemon.national_id;
      const state = stateOf(capture);
      const before = states.get(national);
      if (before === undefined || RANK[state] > RANK[before]) {
        states.set(national, state);
      }
      marked += Number(capture.captured);
    }
    return { dex, states, marked, total: captures.length };
  });

  const species = new Map<number, CapturePokemon>();
  for (const mon of getCatalogDex('home-national').pokemonList) {
    if (!species.has(mon.national_id) || (species.get(mon.national_id)!.form && !mon.form)) {
      species.set(mon.national_id, mon);
    }
  }
  const max = Math.max(0, ...species.keys(), ...rows.flatMap((row) => [...row.states.keys()]));
  const generations: AtlasData['generations'] = [];
  for (let national = 1; national <= max; national++) {
    const generation = species.get(national)?.generation;
    const last = generations[generations.length - 1];
    if (generation !== undefined && generation !== last?.generation) {
      generations.push({ generation, from: national, to: national });
    } else if (last) {
      last.to = national;
    }
  }
  return { rows, species, max, generations };
}

// missing from the open dex, marked in another: for each other dex, what it could hand over
export function pickups (data: AtlasData, activeId: string): { row: AtlasRow; nationals: number[] }[] {
  const active = data.rows.find((row) => row.dex.id === activeId);
  if (!active) {
    return [];
  }
  const missing = [...active.states].filter(([, state]) => state === 'missing').map(([national]) => national).sort((a, b) => a - b);
  return data.rows
  .filter((row) => row !== active)
  .map((row) => ({ row, nationals: missing.filter((national) => isHeld(row.states.get(national))) }))
  .filter((entry) => entry.nationals.length > 0)
  .sort((a, b) => b.nationals.length - a.nationals.length);
}

// still missing from two or more of your dexes: one catch could fill them all
export function wanted (data: AtlasData): { national: number; rows: AtlasRow[] }[] {
  const needs = new Map<number, AtlasRow[]>();
  for (const row of data.rows) {
    row.states.forEach((state, national) => {
      if (state === 'missing') {
        needs.set(national, [...(needs.get(national) ?? []), row]);
      }
    });
  }
  return [...needs]
  .filter(([, rows]) => rows.length > 1)
  .map(([national, rows]) => ({ national, rows }))
  .sort((a, b) => b.rows.length - a.rows.length || a.national - b.national);
}
