import { canHold } from './game-reach';
import { isDexPlaceId } from './dex-places';
import { offersChampions } from './champions';
import { saveLabel } from './capture-fields';
import { translate } from '../i18n/translations';

import type { Capture, CaptureLocation, CaptureMetadata, GameSave, Place } from '../types';
import type { Locale } from '../i18n/translations';

// a sealed mon is the slot's holder for good, but where it is can still change: taken out to a game for raids, into
// Champions, back to HOME. Its location is the one field a sealed record still edits, from its popover or by L over
// its tile

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

// a sealed record moved; Champions, once it's been there, remembered (been to Champions is for good, as the field is)
export function movedRecord<T extends Located & Pick<CaptureMetadata, 'been_to_champions'>> (record: T, to: Place): T {
  return {
    ...record,
    location: to.location,
    location_save: inSomewhere(to) ? to.location_save : null,
    been_to_champions: to.location === 'champions' ? true : record.been_to_champions,
  };
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

// where a mon can be moved: HOME, each of your games that `holds` says can take it, and Champions where `champions` says
// it can go (utils/champions: a HOME dex's mon on the roster). A HOME entry in My Games is a trainer, not a place (HOME
// itself is one), so it's never a game to move into
export function destinations (saves: GameSave[], champions: boolean, holds: (save: GameSave) => boolean): Place[] {
  return [
    { location: 'home', location_save: null },
    ...saves.filter((save) => save.game !== 'home' && holds(save)).map((save): Place => ({ location: 'game', location_save: save.id })),
    ...(champions ? [{ location: 'champions', location_save: null } as Place] : []),
  ];
}

// where one mon can be moved, as its popover, the move menu (L) and the review offer it: the games that can hold it
// (utils/game-reach) and the one it's in, and Champions while it can go there
export function placesFor (saves: GameSave[], capture: Capture, homeDex: boolean, inDexes: Place[] = []): Place[] {
  const [home, ...rest] = destinations(saves, offersChampions(capture, homeDex), (save) => save.id === capture.location_save || canHold(save, capture, saves));
  return [home, ...inDexes, ...rest];
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
