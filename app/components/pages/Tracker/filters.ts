import { BALLS, BALL_NAMES, CAPTURE_FIELDS, LANGUAGES, LANGUAGE_ABBRS, ORIGIN_GAMES, ORIGIN_GAME_NAMES, isRecordComplete, readFavorite } from '../../../utils/capture-fields';
import { getCatalogDex } from '../../../utils/local-data';
import { localizeBall, localizeCatalogGame, localizeNature, localizeOriginGame } from '../../../i18n/names';
import { padding } from '../../../utils/formatting';
import { translate } from '../../../i18n/translations';

import type { Capture, CaptureLocation, FavoriteState, PokemonType, TrainedState } from '../../../types';
import type { Locale, TranslationKey } from '../../../i18n/translations';

export type FilterView = 'all' | 'missing' | 'temporary' | 'unsealed' | 'incomplete';

export type FacetId = 'generation' | 'class' | 'type' | 'game_dex' | 'origin_game' | 'language' | 'ot' | 'location' | 'ball' | 'nature' | 'trained' | 'favorite';

export interface TrackerFilters {
  view: FilterView;
  // values OR within a facet, facets AND together
  facets: Partial<Record<FacetId, string[]>>;
}

export const EMPTY_FILTERS: TrackerFilters = { view: 'all', facets: {} };

interface ViewMeta {
  id: FilterView;
  labelKey: TranslationKey;
  // reads metadata a checklist never keeps
  records?: boolean;
}

export const FILTER_VIEWS: ViewMeta[] = [
  { id: 'all', labelKey: 'filter.all' },
  { id: 'missing', labelKey: 'filter.missing' },
  { id: 'temporary', labelKey: 'filter.temporary' },
  { id: 'unsealed', labelKey: 'filter.unsealed', records: true },
  { id: 'incomplete', labelKey: 'filter.incomplete', records: true },
];

export interface Facet {
  id: FacetId;
  labelKey: TranslationKey;
  // reads the species rather than the record, so it also sorts unmarked slots
  species: boolean;
  // one value, or several (a mon's two types), any of which can match
  value: (capture: Capture) => string | readonly string[] | null;
  label: (value: string, locale: Locale) => string;
  // catalogue order; without one, values sort by count
  rank?: (value: string) => number;
  icon?: (value: string) => string | undefined;
  // a type's glyph beside the label, in the type's colour
  glyph?: (value: string) => PokemonType | undefined;
}

// what a record says of itself is a placeholder till it's sealed, so a record facet reads sealed mons alone; a
// species' facts hold whatever its record (a Gen 4 filter shows every Gen 4 mon)
function valuesOf (facet: Facet, capture: Capture): readonly string[] {
  if (!facet.species && !capture.sealed) {
    return [];
  }
  const value = facet.value(capture);
  return value === null ? [] : typeof value === 'string' ? [value] : value;
}

// the eighteen in the games' own order
export const TYPE_ORDER: PokemonType[] = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

const indexIn = (list: readonly string[]) => (value: string) => list.indexOf(value);

// a record field's facet lists its values in the order the popover offers them
const fieldOrder = (id: FacetId) => indexIn(CAPTURE_FIELDS.find((field) => field.id === id)!.options!('en').map((option) => option.value));

// a game's own Pokédex, its DLC's included, as the catalogs list them (the national dexes that only list what a game can
// hold are left out), newest first as the origin games are; ids are the catalogs' games, so names come from the same
// place as the dex picker's
const GAME_DEXES: { id: string; name: string; catalogs: string[] }[] = [
  { id: 'legends_za', name: 'Legends: Z-A', catalogs: ['legends-z-a-regional', 'legends-z-a-mega-dimension'] },
  { id: 'scarlet', name: 'Scarlet & Violet', catalogs: ['scarlet-violet-regional', 'kitakami', 'blueberry', 'paldea-full'] },
  { id: 'legends_arceus', name: 'Legends: Arceus', catalogs: ['legends-arceus-regional'] },
  { id: 'brilliant_diamond', name: 'Brilliant Diamond & Shining Pearl', catalogs: ['bdsp-regional', 'bdsp-national'] },
  { id: 'sword', name: 'Sword & Shield', catalogs: ['sword-shield-regional', 'sword-shield-expansion-regional'] },
  { id: 'lets_go_pikachu', name: 'Let\'s Go, Pikachu & Eevee', catalogs: ['lets-go-regional'] },
  { id: 'ultra_sun', name: 'Ultra Sun & Ultra Moon', catalogs: ['ultra-sun-ultra-moon-regional'] },
  { id: 'sun', name: 'Sun & Moon', catalogs: ['sun-moon-regional'] },
  { id: 'omega_ruby', name: 'Omega Ruby & Alpha Sapphire', catalogs: ['oras-regional'] },
  { id: 'x', name: 'X & Y', catalogs: ['x-y-regional'] },
];

// a species, a regional form its own (Paldean Wooper isn't Wooper): its national number and form, which every catalog
// agrees on, where a catalog's own ids don't (Z-A's, Full Paldea's and Sword and Shield's DLC count differently)
const speciesKey = (mon: { national_id: number; form?: string | null }) => `${mon.national_id}:${mon.form ?? ''}`;

// which games' dexes list a species, worked out once
let gameDexesBySpecies: Map<string, string[]> | null = null;
function gameDexesOf (mon: { national_id: number; form?: string | null }): string[] {
  if (!gameDexesBySpecies) {
    gameDexesBySpecies = new Map();
    for (const game of GAME_DEXES) {
      const species = new Set(game.catalogs.flatMap((key) => getCatalogDex(key).pokemonList.map(speciesKey)));
      species.forEach((key) => gameDexesBySpecies!.set(key, [...(gameDexesBySpecies!.get(key) ?? []), game.id]));
    }
  }
  return gameDexesBySpecies.get(speciesKey(mon)) ?? [];
}

// a stored value the app never writes has no translation, so it shows as stored
function known (locale: Locale, key: TranslationKey, value: string): string {
  const label = translate(locale, key);
  return label === key ? value : label;
}

export const FACETS: Facet[] = [
  {
    id: 'generation',
    labelKey: 'filter.generation',
    species: true,
    value: (capture) => String(capture.pokemon.generation),
    label: (value, locale) => translate(locale, 'filter.gen', { n: value }),
    rank: Number,
  },
  {
    id: 'class',
    labelKey: 'filter.class',
    species: true,
    value: (capture) => capture.pokemon.legendary_class ?? null,
    label: (value, locale) => translate(locale, value === 'mythical' ? 'filter.mythical' : 'filter.legendary'),
    rank: indexIn(['legendary', 'mythical']),
  },
  {
    // either of a mon's types, a regional form's own (Alolan Vulpix is ice)
    id: 'type',
    labelKey: 'filter.type',
    species: true,
    value: (capture) => capture.pokemon.types ?? null,
    label: (value, locale) => translate(locale, `type.${value as PokemonType}`),
    rank: indexIn(TYPE_ORDER),
    glyph: (value) => value as PokemonType,
  },
  {
    // the games whose own Pokédex lists the mon, DLC included: a HOME dex narrowed to one shows everything that game
    // has, in national order with its regional forms at the end
    id: 'game_dex',
    labelKey: 'filter.gameDex',
    species: true,
    value: (capture) => gameDexesOf(capture.pokemon),
    label: (value, locale) => localizeCatalogGame(locale, value, GAME_DEXES.find((game) => game.id === value)?.name ?? value),
    rank: indexIn(GAME_DEXES.map((game) => game.id)),
  },
  {
    id: 'origin_game',
    labelKey: 'info.originGame',
    species: false,
    value: (capture) => capture.origin_game,
    label: (value, locale) => localizeOriginGame(locale, value, ORIGIN_GAME_NAMES.get(value) ?? value),
    rank: indexIn(ORIGIN_GAMES.map((game) => game.id)),
  },
  {
    id: 'language',
    labelKey: 'info.language',
    species: false,
    value: (capture) => capture.language,
    label: (value) => LANGUAGE_ABBRS.get(value) ?? value,
    rank: indexIn(LANGUAGES.map((language) => language.id)),
  },
  {
    id: 'ot',
    labelKey: 'info.ot',
    species: false,
    value: (capture) => capture.ot,
    label: (value) => value,
  },
  {
    id: 'location',
    labelKey: 'info.location',
    species: false,
    value: (capture) => capture.location,
    label: (value, locale) => known(locale, `location.${value as CaptureLocation}`, value),
    rank: fieldOrder('location'),
  },
  {
    id: 'ball',
    labelKey: 'info.ball',
    species: false,
    value: (capture) => capture.ball,
    label: (value, locale) => localizeBall(locale, value, BALL_NAMES.get(value) ?? value),
    rank: indexIn(BALLS.map((ball) => ball.id)),
    icon: (value) => (value === 'unknown' ? undefined : `balls/${value}.png`),
  },
  {
    // the most common first: twenty-five names read better by how many carry them than in any fixed order
    id: 'nature',
    labelKey: 'info.nature',
    species: false,
    value: (capture) => capture.nature,
    label: (value, locale) => localizeNature(locale, value, value.charAt(0).toUpperCase() + value.slice(1)),
  },
  {
    id: 'trained',
    labelKey: 'info.trained',
    species: false,
    value: (capture) => capture.trained,
    label: (value, locale) => known(locale, `trained.${value as TrainedState}`, value),
    rank: fieldOrder('trained'),
  },
  {
    id: 'favorite',
    labelKey: 'info.favorite',
    species: false,
    // a value the app never writes reads as unanswered, as in the popover
    value: (capture) => {
      const favorite = readFavorite(capture.favorite);
      return favorite === 'no' ? null : favorite;
    },
    label: (value, locale) => known(locale, `favorite.${value as FavoriteState}`, value),
    rank: fieldOrder('favorite'),
  },
];

function matchesView (capture: Capture, view: FilterView): boolean {
  switch (view) {
    case 'missing':
      return !capture.captured;
    case 'temporary':
      return capture.status === 'temporary';
    case 'unsealed':
      return capture.captured && !capture.sealed;
    case 'incomplete':
      return capture.captured && !capture.sealed && capture.status !== 'unobtainable' && !isRecordComplete(capture, capture.pokemon.gender_lock);
    default:
      return true;
  }
}

// whether a view can show a sealed mon: the others (missing, temporary, unsealed, incomplete) are the status views,
// which hold none, so they set the record facets aside
export function holdsSealed (view: FilterView): boolean {
  return view === 'all';
}

export function appliedFacets (filters: TrackerFilters): Facet[] {
  return FACETS.filter((facet) => (filters.facets[facet.id]?.length ?? 0) > 0 && (facet.species || holdsSealed(filters.view)));
}

export function anyFilterActive (filters: TrackerFilters): boolean {
  return filters.view !== 'all' || appliedFacets(filters).length > 0;
}

export function filterMatcher (filters: TrackerFilters, except?: FacetId): (capture: Capture) => boolean {
  const facets = appliedFacets(filters).filter((facet) => facet.id !== except);
  return (capture) => matchesView(capture, filters.view) &&
    facets.every((facet) => {
      const values = valuesOf(facet, capture);
      return filters.facets[facet.id]!.some((selected) => values.includes(selected));
    });
}

// typing produces hiragana; species names are katakana, and a nickname can be in either
function toKatakana (value: string): string {
  return value.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

// an IME types full-width digits and letters (２５, ｚ) and some keyboards half-width kana, the names carry a mix of
// both, and a number is shown with a '#'
function fold (value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

// a word as any search compares it: folded, kana as katakana, Latin without its accents (the combining marks of Latin
// alone, so a kana's dakuten stays: ガ never finds カ)
export function searchFold (value: string): string {
  return toKatakana(fold(value)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Latin only: stripping marks from kana would take the dakuten too, and ガ would find カ
function unaccented (value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeQuery (query: string): string {
  return fold(query).trim().replace(/^#\s*/, '');
}

// whether there's anything to search for; spaces or a lone '#' leave the boxes up
export function hasQuery (query: string): boolean {
  return normalizeQuery(query).length > 0;
}

function matchesNumber (id: number, query: string): boolean {
  return String(id) === query || padding(id, 3) === query || padding(id, 4) === query;
}

// a number matches the one the tile shows, the dex's own in a regional dex, and the national one everywhere
export function queryMatcher (query: string, regional: boolean): (capture: Capture) => boolean {
  const lower = normalizeQuery(query);
  const kana = toKatakana(lower);
  const plain = unaccented(lower);
  return (capture) => unaccented(fold(capture.pokemon.name)).startsWith(plain) ||
    fold(capture.pokemon.name_ja || '').startsWith(kana) ||
    toKatakana(fold(capture.nickname || '')).startsWith(kana) ||
    (regional && matchesNumber(capture.pokemon.dex_number, lower)) ||
    matchesNumber(capture.pokemon.national_id, lower);
}

export interface FacetOption {
  value: string;
  label: string;
  // matches under the search and every other active filter
  count: number;
  icon?: string;
  glyph?: PokemonType;
}

export function facetOptions (
  facet: Facet,
  captures: Capture[],
  filters: TrackerFilters,
  query: string,
  regional: boolean,
  locale: Locale,
): FacetOption[] {
  const matchesFilters = filterMatcher(filters, facet.id);
  const matchesQuery = queryMatcher(query, regional);
  // a selected value stays listed after the last mon carrying it changes, so it can still be seen and untoggled
  const counts = new Map<string, number>((filters.facets[facet.id] ?? []).map((value) => [value, 0]));
  for (const capture of captures) {
    const matches = matchesFilters(capture) && matchesQuery(capture) ? 1 : 0;
    for (const value of valuesOf(facet, capture)) {
      if (value) {
        counts.set(value, (counts.get(value) ?? 0) + matches);
      }
    }
  }
  const options = [...counts].map(([value, count]) => ({ value, count, label: facet.label(value, locale), icon: facet.icon?.(value), glyph: facet.glyph?.(value) }));
  const { rank } = facet;
  return options.sort(rank ? (a, b) => rank(a.value) - rank(b.value) : (a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
