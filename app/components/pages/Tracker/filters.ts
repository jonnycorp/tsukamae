import { BALLS, BALL_NAMES, LANGUAGES, LANGUAGE_ABBRS, ORIGIN_GAMES, ORIGIN_GAME_NAMES, isRecordComplete } from '../../../utils/capture-fields';
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
    value: (capture) => String(capture.pokemon.game_family.generation),
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
    rank: indexIn(['home', 'champions', 'game']),
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
    rank: indexIn(['none', 'ivs', 'ev']),
  },
  {
    id: 'favorite',
    labelKey: 'info.favorite',
    species: false,
    value: (capture) => (capture.favorite === null || capture.favorite === 'no' ? null : String(capture.favorite)),
    label: (value, locale) => known(locale, `favorite.${value as FavoriteState}`, value),
    rank: indexIn(['favorite', 'partner']),
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
      return capture.captured && !capture.sealed && capture.status !== 'unobtainable' && !isRecordComplete(capture);
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

// typing produces hiragana; names are katakana
function toKatakana (value: string): string {
  return value.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

function matchesNumber (id: number, query: string): boolean {
  return String(id) === query || padding(id, 3) === query || padding(id, 4) === query;
}

export function queryMatcher (query: string): (capture: Capture) => boolean {
  const lower = query.toLowerCase();
  const kana = toKatakana(query);
  return (capture) => capture.pokemon.name.toLowerCase().startsWith(lower) ||
    (capture.pokemon.name_ja || '').startsWith(kana) ||
    (capture.nickname || '').toLowerCase().startsWith(lower) ||
    matchesNumber(capture.pokemon.dex_number, query) ||
    matchesNumber(capture.pokemon.national_id, query);
}

export interface FacetOption {
  value: string;
  label: string;
  // matches under every other active filter
  count: number;
  icon?: string;
}

export function facetOptions (facet: Facet, captures: Capture[], filters: TrackerFilters, locale: Locale): FacetOption[] {
  const matches = filterMatcher(filters, facet.id);
  const counts = new Map<string, number>();
  for (const capture of captures) {
    const value = facet.value(capture);
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + (matches(capture) ? 1 : 0));
    }
  }
  const options = [...counts].map(([value, count]) => ({ value, count, label: facet.label(value, locale), icon: facet.icon?.(value) }));
  const { rank } = facet;
  return options.sort(rank ? (a, b) => rank(a.value) - rank(b.value) : (a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
