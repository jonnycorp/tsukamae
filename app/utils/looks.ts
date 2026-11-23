import looksJson from '../../data/looks.json';
import { slotKey } from './champions';

import type { Capture, CapturePokemon, Dex } from '../types';

// a look: a form a mon is shown as (Mega Charizard X, Wash Rotom, a Vivillon's pattern), a choice of display and not a
// fact of its record, so it's kept on its dex beside the record (PersonalDex.looks, utils/local-data) and goes when the
// record does. Picked in W from the forms over its lens and kept there, it's the form its sprite takes everywhere
// (utils/pokemon monIcon), its artwork the lens's and the views'. The forms are the sheet's (scripts/list-looks.mjs):
// a regional form's own under it, the giant forms never, as Gigantamax follows the record (utils/gigantamax)
export interface Look {
  form: string;
  en: string;
  ja: string;
  // its own official artwork's name (6-mega-x), where it has some (views/ViewLensArt artSrc): '' for its species'
  // default, where that shows this look rather than the base the sheet draws (West Sea Shellos, drawn East)
  art?: string;
  // offered only in a dex of this game family, whose own icon covers the form it is (Red-Striped Basculin in HOME's)
  family?: string;
  // the game family whose icon draws the base as this look (White-Striped Basculin in HOME's): there it stands in for
  // the base, never beside it
  baseIn?: string;
  // its own giant form, where Gigantamax gives it one apart from its species' (Rapid Strike Urshifu's)
  giant?: { form: string; art: string };
}

interface SlotLooks {
  // its base form's name, where it has one of its own (Unown's A)
  base: { en: string; ja: string } | null;
  forms: Look[];
}

const LOOKS = looksJson as Record<string, SlotLooks>;

const slotOf = (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>): SlotLooks | undefined => LOOKS[slotKey(pokemon.national_id, pokemon.form)];

// the looks a mon can be shown as in its dex
export function looksOf (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>, dex: Pick<Dex, 'dex_type'>): Look[] {
  const family = dex.dex_type.game_family_id;
  return (slotOf(pokemon)?.forms ?? []).filter((look) => (!look.family || look.family === family) && look.baseIn !== family);
}

// the look its dex's icon draws a mon's base as, where it's one
function drawnBase (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>, dex: Pick<Dex, 'dex_type'>): Look | null {
  const family = dex.dex_type.game_family_id;
  return slotOf(pokemon)?.forms.find((look) => look.baseIn === family) ?? null;
}

// a mon's base form's name, where it has one: the look its dex draws it as, or its own (Unown's A)
export const baseLookName = (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>, dex: Pick<Dex, 'dex_type'>) =>
  drawnBase(pokemon, dex) ?? slotOf(pokemon)?.base ?? null;

// a mon's base form's artwork: the look's its dex draws it as, else its species' default (null), but none (undefined)
// where that shows one of its looks instead
export function baseArt (pokemon: Pick<CapturePokemon, 'national_id' | 'form'>, dex: Pick<Dex, 'dex_type'>): string | null | undefined {
  const drawn = drawnBase(pokemon, dex);
  if (drawn) {
    return drawn.art;
  }
  return looksOf(pokemon, dex).some((look) => look.art === '') ? undefined : null;
}

// the look a mon is shown as: its dex's for it, while that's still one it can be
export function lookOf (mon: Pick<Capture, 'pokemon'> & Partial<Pick<Capture, 'look'>>, dex: Pick<Dex, 'dex_type'>): Look | null {
  return mon.look ? looksOf(mon.pokemon, dex).find((look) => look.form === mon.look) ?? null : null;
}
