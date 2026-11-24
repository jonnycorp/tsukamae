import { iconClass } from './pokemon';
import { lookOf } from './looks';
import { showsShiny } from './shiny';

import type { Capture, CapturePokemon, Dex } from '../types';

// Gigantamax as a trait of the mon rather than a dex of its own. The factor is Sword and Shield's: Max Soup there
// gives it to a mon of any species with a giant form but Melmetal (whose came from HOME alone), so the list is finite,
// and a mon never stays giant. Asked as a yes or no only of those species, as Been to Champions is only of Champions'
// roster (utils/champions), and kept on show where it says yes, so a record the list doesn't cover can still be put right
const GIGANTAMAX = new Set([
  3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809, 812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851, 858,
  861, 869, 879, 884, 892,
]);

const MELMETAL = 809;

// whether a mon can have the factor: its species has a giant form, and it isn't a regional form (Meowth's is Kanto's)
export function canGigantamax (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>): boolean {
  return GIGANTAMAX.has(pokemon.national_id) && !pokemon.form;
}

// whether Max Soup reaches it: drunk by a mon that can have the factor it gives it, or takes it back from one that has
// it, every one but Melmetal. So one out in Sword or Shield can come back with it changed (location-moves asksSoup)
export const takesSoup = (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>) => canGigantamax(pokemon) && pokemon.national_id !== MELMETAL;

export function asksGigantamax (capture: Pick<Capture, 'pokemon' | 'gigantamax'>): boolean {
  return capture.gigantamax === true || canGigantamax(capture.pokemon);
}

// a sealed tile that shows the giant form (styles/gigantamax.scss) and the G-Max mark in the heart's place: its record
// says yes, and there's a giant form to show
export function showsGigantamax (capture: Pick<Capture, 'pokemon' | 'gigantamax'>): boolean {
  return capture.gigantamax === true && canGigantamax(capture.pokemon);
}

// the giant form's sprite, from the sprite sheet's own, at its own size as every sprite is (styles/gigantamax.scss): in
// any dex's family, a Legends: Arceus dex's included, whose icons have no giant forms and would win over it; in the
// colours its record says; its look's own where that has one (Rapid Strike Urshifu's, utils/looks)
export function gigantamaxIcon (capture: Pick<Capture, 'pokemon' | 'shiny' | 'look'>, dex: Dex): string {
  const form = lookOf(capture, dex)?.giant?.form ?? 'gigantamax';
  return iconClass({ ...capture.pokemon, form }, dex, { family: null, shiny: showsShiny(capture, dex) });
}
