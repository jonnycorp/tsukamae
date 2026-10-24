import { BALLS, BALL_NAMES, LANGUAGES, LANGUAGE_ABBRS, ORIGIN_GAMES, ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { TYPE_ORDER } from './filters';
import { localizeBall, localizeNature, localizeOriginGame } from '../../../i18n/names';
import { placeFromKey, placeKey, placeLabel, shownPlace } from '../../../utils/location-moves';
import { translate } from '../../../i18n/translations';

import type { Capture, GameSave, PokemonType } from '../../../types';
import type { Locale } from '../../../i18n/translations';

// the ledger (Ledger.tsx): the dex as a table, sorted by any column and grouped by any field, all from the captures

// how the dex is laid out: its boxes, or the ledger (V)
export type DexLayout = 'boxes' | 'ledger';

export type LedgerColumnId = 'number' | 'name' | 'types' | 'status' | 'location' | 'origin' | 'ball' | 'language' | 'ot' | 'nickname' | 'date' | 'level';

export type LedgerGroupId = 'none' | 'box' | 'generation' | 'type' | 'status' | 'origin' | 'ball' | 'nature' | 'location' | 'language' | 'ot' | 'year';

export interface LedgerSort {
  column: LedgerColumnId;
  descending: boolean;
}

// what a row is, in the order the status column sorts them: sealed, then by how far along, the unmarked last
export type LedgerState = 'sealed' | 'caught' | 'temporary' | 'unobtainable' | 'unmarked';

const STATE_ORDER: LedgerState[] = ['sealed', 'caught', 'temporary', 'unobtainable', 'unmarked'];

export function stateOf (capture: Capture, checklist: boolean): LedgerState {
  if (!capture.captured || !capture.status) {
    return 'unmarked';
  }
  // a checklist's caught slots show as sealed, but there's no record behind them to be one
  return capture.sealed && !checklist ? 'sealed' : capture.status;
}

export interface LedgerContext {
  locale: Locale;
  checklist: boolean;
  saves: GameSave[];
  // the dex's own order, which every sort falls back on
  order: Map<number, number>;
  // each mon's box, by position, and the boxes' titles
  boxes: Map<number, number>;
  boxTitle: (box: number) => string;
  name: (capture: Capture) => string;
  collator: Intl.Collator;
}

type SortKey = number | string | null;

function rankIn (ids: readonly string[]): (id: string) => number {
  const ranks = new Map(ids.map((id, i) => [id, i]));
  return (id) => ranks.get(id) ?? ids.length;
}

const originRank = rankIn(ORIGIN_GAMES.map((game) => game.id));
const ballRank = rankIn(BALLS.map((ball) => ball.id));
const languageRank = rankIn(LANGUAGES.map((language) => language.id));
const typeRank = rankIn(TYPE_ORDER);

const placeOfCapture = (capture: Capture) => (capture.captured ? shownPlace(capture) : null);

// a blank sorts last whichever way the column runs
const SORT_KEYS: Record<LedgerColumnId, (capture: Capture, ctx: LedgerContext) => SortKey> = {
  number: (capture, ctx) => ctx.order.get(capture.pokemon.id) ?? 0,
  name: (capture, ctx) => ctx.name(capture),
  types: (capture) => {
    const [first, second] = capture.pokemon.types ?? [];
    return first ? typeRank(first) * 32 + (second ? typeRank(second) + 1 : 0) : null;
  },
  status: (capture, ctx) => STATE_ORDER.indexOf(stateOf(capture, ctx.checklist)),
  location: (capture, ctx) => {
    const place = placeOfCapture(capture);
    return place ? placeLabel(place, ctx.saves, ctx.locale) : null;
  },
  origin: (capture) => (capture.origin_game ? originRank(capture.origin_game) : null),
  ball: (capture) => (capture.ball ? ballRank(capture.ball) : null),
  language: (capture) => (capture.language ? languageRank(capture.language) : null),
  ot: (capture) => capture.ot || null,
  nickname: (capture) => (capture.has_nickname && capture.nickname) || null,
  date: (capture) => capture.catch_date,
  level: (capture) => capture.level,
};

// stable under the dex's order, so equal values keep it whichever way the column runs
export function sortCaptures (captures: Capture[], sort: LedgerSort | null, ctx: LedgerContext): Capture[] {
  if (!sort) {
    return captures;
  }
  const keyOf = SORT_KEYS[sort.column];
  const sign = sort.descending ? -1 : 1;
  const keyed = captures.map((capture) => ({ capture, key: keyOf(capture, ctx), at: ctx.order.get(capture.pokemon.id) ?? 0 }));
  keyed.sort((a, b) => {
    if (a.key === null || b.key === null) {
      if (a.key === b.key) {
        return a.at - b.at;
      }
      return a.key === null ? 1 : -1;
    }
    const order = typeof a.key === 'number' && typeof b.key === 'number' ? a.key - b.key : ctx.collator.compare(String(a.key), String(b.key));
    return order * sign || a.at - b.at;
  });
  return keyed.map((entry) => entry.capture);
}

export interface LedgerGroup {
  // '' for the mons with nothing to group them by, always last
  key: string;
  label: string;
  captures: Capture[];
  // shown before the label: a type's glyph, a ball's sprite, a game's mark
  type?: PokemonType;
  ball?: string;
  origin?: string;
}

interface GroupDef {
  key: (capture: Capture, ctx: LedgerContext) => string;
  label: (key: string, ctx: LedgerContext) => string;
  // the groups in this order; without one, the biggest first
  rank?: (key: string, ctx: LedgerContext) => number;
}

const GROUPS: Record<Exclude<LedgerGroupId, 'none'>, GroupDef> = {
  box: {
    key: (capture, ctx) => String(ctx.boxes.get(capture.pokemon.id) ?? 0),
    label: (key, ctx) => ctx.boxTitle(Number(key)),
    rank: Number,
  },
  generation: {
    key: (capture) => String(capture.pokemon.generation),
    label: (key, ctx) => translate(ctx.locale, 'filter.gen', { n: key }),
    rank: Number,
  },
  // by the first of its types, so every mon is in one group
  type: {
    key: (capture) => capture.pokemon.types?.[0] ?? '',
    label: (key, ctx) => translate(ctx.locale, `type.${key as PokemonType}`),
    rank: typeRank,
  },
  status: {
    key: (capture, ctx) => stateOf(capture, ctx.checklist),
    label: (key, ctx) => {
      if (key === 'sealed') {
        return translate(ctx.locale, 'seal.sealed');
      }
      return key === 'unmarked' ? translate(ctx.locale, 'ledger.unmarked') : translate(ctx.locale, `status.${key as 'caught'}`);
    },
    rank: (key) => STATE_ORDER.indexOf(key as LedgerState),
  },
  origin: {
    key: (capture) => capture.origin_game ?? '',
    label: (key, ctx) => localizeOriginGame(ctx.locale, key, ORIGIN_GAME_NAMES.get(key) ?? key),
    rank: originRank,
  },
  ball: {
    key: (capture) => capture.ball ?? '',
    label: (key, ctx) => localizeBall(ctx.locale, key, BALL_NAMES.get(key) ?? key),
    rank: ballRank,
  },
  // the biggest first, as the Nature filter lists them
  nature: {
    key: (capture) => capture.nature ?? '',
    label: (key, ctx) => localizeNature(ctx.locale, key, key.charAt(0).toUpperCase() + key.slice(1)),
  },
  // each of your games apart, after HOME and Champions
  location: {
    key: (capture) => {
      const place = placeOfCapture(capture);
      return place ? placeKey(place) : '';
    },
    label: (key, ctx) => placeLabel(placeFromKey(key), ctx.saves, ctx.locale),
    // HOME, Champions, your games in My Games' order, then a game with no save
    rank: (key, ctx) => {
      const place = placeFromKey(key);
      if (place.location !== 'game') {
        return place.location === 'home' ? 0 : 1;
      }
      const save = ctx.saves.findIndex((entry) => entry.id === place.location_save);
      return 2 + (save === -1 ? ctx.saves.length : save);
    },
  },
  language: {
    key: (capture) => capture.language ?? '',
    label: (key) => LANGUAGE_ABBRS.get(key) ?? key,
    rank: languageRank,
  },
  ot: {
    key: (capture) => capture.ot ?? '',
    label: (key) => key,
  },
  year: {
    key: (capture) => capture.catch_date?.slice(0, 4) ?? '',
    label: (key) => key,
    rank: Number,
  },
};

// the rows split by the field, each group in the rows' own (sorted) order
export function groupCaptures (rows: Capture[], group: LedgerGroupId, ctx: LedgerContext): LedgerGroup[] {
  if (group === 'none') {
    return [{ key: 'all', label: '', captures: rows }];
  }
  const def = GROUPS[group];
  const groups = new Map<string, Capture[]>();
  for (const capture of rows) {
    const key = def.key(capture, ctx);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(capture);
  }
  const blank = translate(ctx.locale, 'ledger.blank');
  const all = [...groups].map(([key, captures]): LedgerGroup => ({
    key,
    label: key === '' ? blank : def.label(key, ctx),
    captures,
    type: group === 'type' && key ? key as PokemonType : undefined,
    ball: group === 'ball' && key ? key : undefined,
    origin: group === 'origin' && key ? key : undefined,
  }));
  const { rank } = def;
  return all.sort((a, b) => {
    if (a.key === '' || b.key === '') {
      return a.key === '' ? 1 : -1;
    }
    return rank ? rank(a.key, ctx) - rank(b.key, ctx) : b.captures.length - a.captures.length || ctx.collator.compare(a.label, b.label);
  });
}
