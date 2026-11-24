import { SWSH, canMoveTo } from './game-reach';
import { isDexPlaceId } from './dex-places';
import { retiredSaves } from './retired-saves';
import { saveLabel, withFieldInvariants } from './capture-fields';
import { takesSoup } from './gigantamax';
import { translate } from '../i18n/translations';

import type { Capture, CaptureLocation, CaptureMetadata, GameSave, Place } from '../types';
import type { Locale } from '../i18n/translations';

// a sealed mon is the slot's holder for good, but where it is can still change: checked out to a game for raids, back to
// HOME, into Champions and out. Its location is the one field a sealed record still edits, from the move menu (S or L
// over its tile, or its place under the lens in W), and what a game changed on it (its level, the Gigantamax factor) is
// asked as it leaves

type Located = Pick<CaptureMetadata, 'location' | 'location_save'>;

// where a record says it is, or null while that's unanswered (a game with no save)
export function placeOf (meta: Located): Place | null {
  if (!meta.location || (meta.location === 'game' && !meta.location_save)) {
    return null;
  }
  return { location: meta.location, location_save: inSomewhere(meta) ? meta.location_save : null };
}

// which save (a game), or which checklist's boxes in HOME (a free-form dex's mon), the place is in
const inSomewhere = (meta: Located) => meta.location === 'game' || (meta.location === 'home' && isDexPlaceId(meta.location_save));

export function samePlace (a: Place, b: Place): boolean {
  return a.location === b.location && (a.location === 'champions' || (a.location_save ?? null) === (b.location_save ?? null));
}

// what a mon brings back from a game, asked as it leaves: the level it's come home at (asksLevel), and the Gigantamax
// factor Max Soup may have given it or taken back in Sword or Shield (asksSoup)
export type Back = Partial<Pick<CaptureMetadata, 'level' | 'gigantamax'>>;

// a sealed record moved, with what it brought back; Champions, once it's been there, remembered (been to Champions is
// for good, as the field is). Under the rules every write keeps (capture-fields withFieldInvariants), so a factor it came
// back with makes it a partner
export function movedRecord<T extends Located & Partial<CaptureMetadata>> (record: T, to: Place, { level, gigantamax }: Back = {}): T {
  return {
    ...record,
    ...withFieldInvariants(record, {
      location: to.location,
      location_save: inSomewhere(to) ? to.location_save : null,
      been_to_champions: to.location === 'champions' ? true : record.been_to_champions,
      level: level ?? record.level,
      gigantamax: gigantamax ?? record.gigantamax,
    }),
  };
}

// a HOME dex's sealed mon out in one of your games is still being raised there: its level isn't tracked till
// it's back (育成中), the last one confirmed kept as a floor. One at 100 can't go up, so it's just its level
export const inTraining = (record: Pick<Capture, 'sealed' | 'location' | 'level'>, homeDex: boolean) =>
  homeDex && record.sealed && record.location === 'game' && record.level !== 100;

// coming home from a game (to HOME, or a checklist's boxes in it) asks the level it's come back at, at least the floor;
// one at 100 isn't training, so it's asked nothing
export const asksLevel = (record: Pick<Capture, 'sealed' | 'location' | 'level'>, to: Place, homeDex: boolean) =>
  inTraining(record, homeDex) && to.location !== 'game';

// leaving Sword or Shield, for anywhere, a mon Max Soup reaches (utils/gigantamax takesSoup) is asked the Gigantamax
// factor again, at any level and in any dex: there alone can it have changed
export function asksSoup (record: Pick<Capture, 'location' | 'location_save' | 'pokemon'>, saves: GameSave[]): boolean {
  const game = record.location === 'game' ? saves.find((save) => save.id === record.location_save)?.game : undefined;
  return game !== undefined && SWSH.has(game) && takesSoup(record.pokemon);
}

// a sealed tile's tint for a mon away from where its dex keeps them (HOME in a HOME dex, a game in a game's): gold in
// Champions, out in one of your games, or in HOME. One where the dex keeps it has none, and wears the plain sealed wash
export type LocationTint = 'champions' | 'out' | 'home';

export function locationTint (location: CaptureLocation | null, homeDex: boolean): LocationTint | null {
  if (location === 'champions') {
    return 'champions';
  }
  if (homeDex) {
    return location === 'game' ? 'out' : null;
  }
  return location === 'home' ? 'home' : null;
}

const HOME: Place = { location: 'home', location_save: null };

// where one mon can be moved, as the move menu (S or L) offers it: HOME (and a free-form dex's checklist boxes in it,
// `inDexes`), then the games it can go to from where it is now (utils/game-reach canMoveTo, whatever the dex) that aren't
// retired (My Games' 引退, utils/retired-saves), the one it's in whatever it is. A HOME entry in My Games is a trainer,
// not a place (HOME itself is one). Champions is a step of its own (utils/champions offersChampions), and a mon in it
// is locked in HOME till it's back out: HOME is all it's offered
export function placesFor (saves: GameSave[], capture: Capture, inDexes: Place[] = []): Place[] {
  if (capture.location === 'champions') {
    return [HOME, ...inDexes];
  }
  const retired = retiredSaves();
  const holds = (save: GameSave) => save.id === capture.location_save || (!retired.has(save.id) && canMoveTo(save, capture, saves));
  return [
    HOME,
    ...inDexes,
    ...saves.filter((save) => save.game !== 'home' && holds(save)).map((save): Place => ({ location: 'game', location_save: save.id })),
  ];
}

// a free-form dex's mon can be in HOME in one of your checklist dexes' boxes, a place each
export function dexPlacesFor (active: { free?: boolean } | null, dexes: { id: string; checklist?: boolean }[]): Place[] {
  return active?.free ? dexes.filter((dex) => dex.checklist).map((dex) => ({ location: 'home', location_save: dex.id })) : [];
}

// your dexes' names, for a place in one's boxes; the dex context keeps it current
const dexNames = new Map<string, string>();

export function nameDexPlaces (dexes: { id: string; title: string }[]) {
  dexNames.clear();
  dexes.forEach((dex) => dexNames.set(dex.id, dex.title));
}

// where a record shows it is: a game whose save is unknown (a new mark in a game's dex, or a save since deleted from
// My Games, whose records still name it) as just a game, one place however it came to be, where placeOf leaves it
// unanswered
export function shownPlace (meta: Located, saves: GameSave[]): Place | null {
  if (meta.location === 'game' && (!meta.location_save || !saves.some((save) => save.id === meta.location_save))) {
    return { location: 'game', location_save: null };
  }
  return placeOf(meta);
}

export function placeKey (place: Place): string {
  if (place.location === 'home' && isDexPlaceId(place.location_save)) {
    return `home:${place.location_save}`;
  }
  return place.location === 'game' && place.location_save ? `game:${place.location_save}` : place.location;
}

export function placeFromKey (key: string): Place {
  if (key.startsWith('home:')) {
    return { location: 'home', location_save: key.slice(5) };
  }
  return key.startsWith('game:') ? { location: 'game', location_save: key.slice(5) } : { location: key as Place['location'], location_save: null };
}

// HOME, Champions, or the game's name and language as My Games lists it; a game since deleted from My Games reads as an
// unnamed game
export function placeLabel (place: Place, saves: GameSave[], locale: Locale): string {
  if (place.location === 'home' && isDexPlaceId(place.location_save)) {
    return translate(locale, 'location.inDex', { dex: dexNames.get(place.location_save) ?? '?' });
  }
  if (place.location !== 'game') {
    return translate(locale, `location.${place.location}`);
  }
  const save = saves.find((entry) => entry.id === place.location_save);
  return save ? saveLabel(save, locale, saves) : translate(locale, 'location.game');
}
