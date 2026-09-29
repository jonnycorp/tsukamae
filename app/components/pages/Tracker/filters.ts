import { BALLS, BALL_NAMES, CAPTURE_FIELDS, LANGUAGES, LANGUAGE_ABBRS, ORIGIN_GAMES, ORIGIN_GAME_NAMES, isRecordComplete } from '../../../utils/capture-fields';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { padding } from '../../../utils/formatting';
import { translate } from '../../../i18n/translations';

import type { Capture, CaptureLocation, FavoriteState, TrainedState } from '../../../types';
import type { Locale, TranslationKey } from '../../../i18n/translations';

export type FilterView = 'all' | 'missing' | 'temporary' | 'unsealed' | 'incomplete';

export type FacetId = 'generation' | 'class' | 'origin_game' | 'language' | 'ot' | 'location' | 'ball' | 'trained' | 'favorite';

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
  value: (capture: Capture) => string | null;
  label: (value: string, locale: Locale) => string;
  // catalogue order; without one, values sort by count
  rank?: (value: string) => number;
  icon?: (value: string) => string | undefined;
}

const indexIn = (list: readonly string[]) => (value: string) => list.indexOf(value);

// a record field's facet lists its values in the order the popover offers them
const fieldOrder = (id: FacetId) => indexIn(CAPTURE_FIELDS.find((field) => field.id === id)!.options!('en').map((option) => option.value));

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
    value: (capture) => (capture.favorite === null || capture.favorite === 'no' ? null : String(capture.favorite)),
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

// a record facet can't match an unmarked slot, so the missing view sets those aside
export function appliedFacets (filters: TrackerFilters): Facet[] {
  return FACETS.filter((facet) => (filters.facets[facet.id]?.length ?? 0) > 0 && (facet.species || filters.view !== 'missing'));
}

export function anyFilterActive (filters: TrackerFilters): boolean {
  return filters.view !== 'all' || appliedFacets(filters).length > 0;
}

export function filterMatcher (filters: TrackerFilters, except?: FacetId): (capture: Capture) => boolean {
  const facets = appliedFacets(filters).filter((facet) => facet.id !== except);
  return (capture) => matchesView(capture, filters.view) &&
    facets.every((facet) => filters.facets[facet.id]!.includes(facet.value(capture) ?? ''));
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
    const value = facet.value(capture);
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + (matchesFilters(capture) && matchesQuery(capture) ? 1 : 0));
    }
  }
  const options = [...counts].map(([value, count]) => ({ value, count, label: facet.label(value, locale), icon: facet.icon?.(value) }));
  const { rank } = facet;
  return options.sort(rank ? (a, b) => rank(a.value) - rank(b.value) : (a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
