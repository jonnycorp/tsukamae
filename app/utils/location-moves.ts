import { saveLabel } from './capture-fields';
import { translate } from '../i18n/translations';

import type { CaptureLocation, CaptureMetadata, GameSave, Place } from '../types';
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
  return { location: meta.location, location_save: meta.location === 'game' ? meta.location_save : null };
}

export function samePlace (a: Place, b: Place): boolean {
  return a.location === b.location && (a.location !== 'game' || a.location_save === b.location_save);
}

// a sealed record moved; Champions, once it's been there, remembered (been to Champions is for good, as the field is)
export function movedRecord<T extends Located & Pick<CaptureMetadata, 'been_to_champions'>> (record: T, to: Place): T {
  return {
    ...record,
    location: to.location,
    location_save: to.location === 'game' ? to.location_save : null,
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

// where a mon can be moved: HOME, each of your games, and Champions in a HOME dex
export function destinations (saves: GameSave[], homeDex: boolean): Place[] {
  return [
    { location: 'home', location_save: null },
    ...saves.map((save): Place => ({ location: 'game', location_save: save.id })),
    ...(homeDex ? [{ location: 'champions', location_save: null } as Place] : []),
  ];
}

// where a record shows it is, a game whose save is unanswered (a new mark in a game's dex, a save since deleted) as
// just a game, where placeOf leaves it unanswered
export function shownPlace (meta: Located): Place | null {
  if (meta.location === 'game' && !meta.location_save) {
    return { location: 'game', location_save: null };
  }
  return placeOf(meta);
}

export function placeKey (place: Place): string {
  return place.location === 'game' && place.location_save ? `game:${place.location_save}` : place.location;
}

export function placeFromKey (key: string): Place {
  return key.startsWith('game:') ? { location: 'game', location_save: key.slice(5) } : { location: key as Place['location'], location_save: null };
}

// HOME, Champions, or the game's name and language as My Games lists it; a game since deleted from My Games reads as an
// unnamed game
export function placeLabel (place: Place, saves: GameSave[], locale: Locale): string {
  if (place.location !== 'game') {
    return translate(locale, `location.${place.location}`);
  }
  const save = saves.find((entry) => entry.id === place.location_save);
  return save ? saveLabel(save, locale) : translate(locale, 'location.game');
}
