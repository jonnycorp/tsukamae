import rosterJson from '../../data/champions.json';

import type { Capture, CapturePokemon } from '../types';

// Pokémon Champions' roster, kept by hand in data/champions.json as each season adds to it: an entry with no form takes
// every slot of its species but the regional forms (a Gigantamax slot included), each of which is an entry of its own
interface RosterEntry {
  national: number;
  form?: string;
}
const REGIONAL_FORMS = new Set(['alola', 'galar', 'hisui', 'paldea']);
const slotKey = (national: number, form: string | null | undefined) => (form && REGIONAL_FORMS.has(form) ? `${national}:${form}` : String(national));
const ROSTER = new Set((rosterJson.pokemon as RosterEntry[]).map((entry) => slotKey(entry.national, entry.form)));

// whether a mon can go to Champions this season
export function canVisitChampions (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>): boolean {
  return ROSTER.has(slotKey(pokemon.national_id, pokemon.form));
}

// Been to Champions, asked only of a mon that can go there; kept on show where it says yes, so a record the roster
// doesn't cover can still be put right
export function asksChampions (capture: Pick<Capture, 'pokemon' | 'been_to_champions'>): boolean {
  return capture.been_to_champions === true || canVisitChampions(capture.pokemon);
}

// whether Champions is a place to move a record to: in a HOME dex, for a mon that can go there or is there already
export function offersChampions (capture: Pick<Capture, 'pokemon' | 'location'>, homeDex: boolean): boolean {
  return homeDex && (capture.location === 'champions' || canVisitChampions(capture.pokemon));
}
