import { isDexPlaceId } from './dex-places';
import { progressToCaptures } from './local-data';

import type { Capture } from '../types';
import type { PersonalDex } from './local-data';

// one mon is one copy, however many of your dexes mention it. A records dex's mark is a copy of its own, and so
// is a checklist's check, each checklist being a living dex's boxes in HOME; a checklist's Elsewhere (its stored
// Temporary) is a mon represented in another dex, no copy; a free-form dex's entry is one, unless it's in a
// checklist's boxes, where it is that checklist's check and counted there

// a mon as every catalog knows it: its species and form (ids differ between catalogs)
export const speciesKey = (pokemon: { national_id: number; form?: string | null }) => `${pokemon.national_id}|${pokemon.form ?? ''}`;

export type CopyKind = 'copy' | 'elsewhere' | null;

export function copyKind (capture: Capture, dex: PersonalDex): CopyKind {
  if (!capture.captured || capture.status === 'unobtainable') {
    return null;
  }
  if (dex.checklist) {
    return capture.status === 'temporary' ? 'elsewhere' : 'copy';
  }
  return dex.free && capture.location === 'home' && isDexPlaceId(capture.location_save) ? null : 'copy';
}

export interface DexCaptures {
  dex: PersonalDex;
  captures: Capture[];
}

// every dex's mons, the open one's as the tracker holds them
export function everyDex (dexes: PersonalDex[], activeId: string, activeCaptures: Capture[]): DexCaptures[] {
  return dexes.map((dex) => ({ dex, captures: dex.id === activeId ? activeCaptures : progressToCaptures(dex) }));
}

// for each mon (species and form), how many copies of it each dex holds
export function copiesByDex (all: DexCaptures[]): Map<string, Map<string, number>> {
  const held = new Map<string, Map<string, number>>();
  for (const { dex, captures } of all) {
    for (const capture of captures) {
      if (copyKind(capture, dex) === 'copy') {
        const key = speciesKey(capture.pokemon);
        const by = held.get(key) ?? held.set(key, new Map()).get(key)!;
        by.set(dex.id, (by.get(dex.id) ?? 0) + 1);
      }
    }
  }
  return held;
}

export type Misplaced = 'gone' | 'notListed' | 'notChecked' | 'elsewhere' | 'claimed';

export interface Bookkeeping {
  // the open checklist's Elsewhere marks that no other dex holds a copy of
  unbacked: Capture[];
  // the open free-form dex's mons in a checklist's boxes that the checklist doesn't hold for them
  misplaced: { capture: Capture; dex: PersonalDex | null; why: Misplaced }[];
}

// the Red Pen's bookkeeping across dexes (it alone checks these): a checklist's Elsewhere has a copy behind it in
// another dex, and a free-form entry in a checklist's boxes is that checklist's check, checked there and claimed by it
// alone
export function bookkeeping (dexes: PersonalDex[], active: PersonalDex, activeCaptures: Capture[]): Bookkeeping {
  const result: Bookkeeping = { unbacked: [], misplaced: [] };
  if (active.checklist) {
    const held = copiesByDex(everyDex(dexes, active.id, activeCaptures));
    for (const capture of activeCaptures) {
      const by = capture.captured && capture.status === 'temporary' ? held.get(speciesKey(capture.pokemon)) : undefined;
      if (capture.captured && capture.status === 'temporary' && ![...(by?.keys() ?? [])].some((id) => id !== active.id)) {
        result.unbacked.push(capture);
      }
    }
  }
  if (active.free) {
    const slots = new Map<string, Map<string, Capture>>();
    const slotsOf = (dex: PersonalDex) => slots.get(dex.id) ?? slots.set(dex.id, new Map(progressToCaptures(dex).map((capture) => [speciesKey(capture.pokemon), capture]))).get(dex.id)!;
    const claims = new Map<string, number>();
    const placed = activeCaptures.filter((capture) => capture.location === 'home' && isDexPlaceId(capture.location_save));
    placed.forEach((capture) => {
      const key = `${capture.location_save}|${speciesKey(capture.pokemon)}`;
      claims.set(key, (claims.get(key) ?? 0) + 1);
    });
    for (const capture of placed) {
      const dex = dexes.find((entry) => entry.id === capture.location_save && entry.checklist) ?? null;
      const slot = dex && slotsOf(dex).get(speciesKey(capture.pokemon));
      let why: Misplaced | null = null;
      if (!dex) {
        why = 'gone';
      } else if (!slot) {
        why = 'notListed';
      } else if (slot.captured && slot.status === 'temporary') {
        why = 'elsewhere';
      } else if (!slot.captured || slot.status !== 'caught') {
        why = 'notChecked';
      } else if ((claims.get(`${capture.location_save}|${speciesKey(capture.pokemon)}`) ?? 0) > 1) {
        why = 'claimed';
      }
      if (why) {
        result.misplaced.push({ capture, dex, why });
      }
    }
  }
  return result;
}
