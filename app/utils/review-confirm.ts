import { CAPTURE_FIELDS, MYSTERY_GIFT, favoriteOptions, freshMetadata, genderOptions, readFavorite, stampedSave } from './capture-fields';
import { homeFileOf } from './game-reach';
import { asksChampions } from './champions';
import { asksGigantamax } from './gigantamax';

import type { Capture, CaptureMetadata, GameSave } from '../types';
import type { CaptureField } from './capture-fields';

// the plate fields a record can be given a value in without you. As it's marked:
// - its baselines: no Champions, no G-Max, no nickname, untrained, no heart;
// - the dex's defaults: the game and its language, the OT and ID No. of the save they name, the ball, the training;
// - a gender its species is locked to.
// Or since: the heart floored by a nickname or a gift.
// An open record's field still holding such a value counts in W only once you've touched it there (picked it, the same
// value too; pressed its plate; My Game's pick for the four it fills), unless it's left but the one choice (a locked
// gender, a G-Max mon's partner heart). Kept in this window's storage, per dex and mon, never in the collection: it's how a
// record is filled in, not part of it. A sealed record's are all touched (sealing took them), and one unsealed again
// keeps them so
const CONFIRMABLE_FIELDS = ['origin_game', 'language', 'ot', 'tid', 'been_to_champions', 'gigantamax', 'ball', 'gender', 'nickname', 'trained', 'favorite'];
export const CONFIRMABLE: CaptureField[] = CAPTURE_FIELDS.filter((field) => CONFIRMABLE_FIELDS.includes(field.id));
export const CONFIRMABLE_IDS = CONFIRMABLE.map((field) => field.id as string);
// the four My Game fills, all touched by its pick
export const MY_GAME_IDS = ['origin_game', 'language', 'ot', 'tid'];

const KEY = 'reviewConfirmed';
type Store = Record<string, Record<string, string[]>>;

function load (): Store {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

function store (next: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage refused: the touches last as long as the review
  }
}

// a dex's touches, by mon
export function readTouches (dexId: string): Record<string, string[]> {
  return load()[dexId] ?? {};
}

// fields touched on a mon, and fields to touch again (one a rule just changed); null clears them all, as it's sealed or
// released
export function writeTouches (dexId: string, pokemon: number, fields: string[] | null, untouch: string[] = []): Record<string, string[]> {
  const all = load();
  const dex = { ...(all[dexId] ?? {}) };
  if (fields === null) {
    delete dex[pokemon];
  } else {
    dex[pokemon] = [...new Set([...(dex[pokemon] ?? []), ...fields])].filter((field) => !untouch.includes(field));
  }
  all[dexId] = dex;
  store(all);
  return dex;
}

// the values a record of this dex is given as it's marked, its species' gender lock aside
export function givenValues (defaults: Partial<CaptureMetadata> | undefined, homeDex: boolean, saves: GameSave[]): Partial<CaptureMetadata> {
  return freshMetadata({ defaults, checklist: false, homeDex, genderLock: null, saves });
}

// whether a field's asked of this mon at all: Been to Champions of one on the roster, Gigantamax of one with a giant form
export const asksField = (capture: Capture, field: CaptureField) => (field.id !== 'been_to_champions' || asksChampions(capture)) &&
  (field.id !== 'gigantamax' || asksGigantamax(capture));

// still holding a value it was given
function holdsGiven (capture: Capture, field: CaptureField, given: Partial<CaptureMetadata>): boolean {
  if (field.id === 'favorite') {
    const floored = capture.has_nickname === true || capture.origin_game === MYSTERY_GIFT;
    return capture.favorite === 'no' || capture.favorite === readFavorite(given.favorite) || (floored && capture.favorite === 'favorite');
  }
  if (field.id === 'gender') {
    return Boolean(capture.pokemon.gender_lock);
  }
  const key = field.id === 'nickname' ? 'has_nickname' : field.keys[0];
  const value = given[key];
  return value !== null && value !== undefined && capture[key] === value;
}

// left but the one choice: nothing to confirm
function oneChoice (capture: Capture, field: CaptureField): boolean {
  if (field.id === 'gender') {
    return genderOptions('en', capture.pokemon.gender_lock).length === 1;
  }
  return field.id === 'favorite' && favoriteOptions('en', capture).length === 1;
}

// an open record's fields still holding a value they were given, still to touch
export function untouched (capture: Capture, touched: string[] | undefined, given: Partial<CaptureMetadata>): CaptureField[] {
  if (!capture.captured || capture.sealed || capture.status === 'unobtainable') {
    return [];
  }
  return CONFIRMABLE.filter((field) => asksField(capture, field) && holdsGiven(capture, field, given) && !oneChoice(capture, field) &&
    !touched?.includes(field.id));
}

// where an open record's four origin fields came from, as W's left side shows them:
// - save: one of your saves, the four held as one card (the cartridge) and changed only by picking another;
// - gift: a HOME entry's trainer (language, OT, ID No.) held so, the mark's game picked apart;
// - manual: by hand, the four plates as before;
// - empty: none yet, the card waiting on a pick.
// Read from the record, but for the hand's flag (MANUAL_ORIGIN), set as Not my game is picked or one of the four is
// changed by hand, and let go as a save is picked: typed values that happen to match a save don't lock it under you
export const MANUAL_ORIGIN = 'manual-origin';
export type OriginMode = 'save' | 'gift' | 'manual' | 'empty';

export function originMode (capture: Capture, saves: GameSave[], touched: string[] | undefined): { mode: OriginMode; save?: GameSave } {
  if (saves.length === 0 || touched?.includes(MANUAL_ORIGIN)) {
    return { mode: 'manual' };
  }
  const home = homeFileOf(capture, saves);
  if (home && capture.ot === home.ot && capture.language === home.language) {
    return { mode: 'gift', save: home };
  }
  const save = stampedSave(saves, capture);
  if (save && save.game !== 'home') {
    return { mode: 'save', save };
  }
  if (capture.origin_game || capture.language || capture.ot || capture.tid) {
    return { mode: 'manual' };
  }
  return { mode: 'empty' };
}

// the fields a mode's card holds: a save's (or the empty card's) all four, a gift's its trainer
export const softFields = (mode: OriginMode): string[] => (mode === 'save' || mode === 'empty' ? MY_GAME_IDS : mode === 'gift' ? MY_GAME_IDS.slice(1) : []);
