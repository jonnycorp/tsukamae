import { TYPE_ORDER } from './filters';
import { placeKey, shownPlace } from '../../../utils/location-moves';

import type { Capture, CaptureStatus, PokemonType } from '../../../types';

// what the Almanac shows: a dex's collection counted every way the records allow, from the captures alone

export interface StatusCounts {
  total: number;
  marked: number;
  caught: number;
  temporary: number;
  unobtainable: number;
  sealed: number;
}

export interface Tally {
  key: string;
  count: number;
}

// a catch that counts: the 1st, the 10th, the 50th… by date, or the latest
export interface Milestone {
  n: number;
  capture: Capture;
  latest: boolean;
}

export interface MonthCount {
  year: number;
  month: number;
  count: number;
}

export interface AlmanacData {
  all: StatusCounts;
  generations: (StatusCounts & { generation: number })[];
  types: (StatusCounts & { type: PokemonType })[];
  // over the marked records that answer each field, most first
  origins: Tally[];
  languages: Tally[];
  balls: Tally[];
  ots: Tally[];
  // sealed mons by where they are: home, champions, game:<save id>, or game where the save is unanswered
  places: Tally[];
  // catches by month, oldest first, every month from the first catch to the last (empty ones too)
  months: MonthCount[];
  undated: number;
  specials: {
    favorites: number;
    partners: number;
    nicknamed: number;
    gifts: number;
    trained: number;
    legendary: StatusCounts;
    mythical: StatusCounts;
  };
  // the 1st catch, the 10th, the 50th… by date (the dex's order within a day), and the latest
  milestones: Milestone[];
  // the latest catches, newest first
  recent: Capture[];
  // the month with the most catches
  busiest: MonthCount | null;
}

const MILESTONES = [1, 10, 50, 100, 250, 500, 750, 1000, 1500, 2000];
const RECENT = 10;

const emptyCounts = (): StatusCounts => ({ total: 0, marked: 0, caught: 0, temporary: 0, unobtainable: 0, sealed: 0 });

function count (counts: StatusCounts, capture: Capture) {
  counts.total++;
  if (!capture.captured) {
    return;
  }
  counts.marked++;
  const status = capture.status as CaptureStatus;
  counts[status]++;
  if (capture.sealed) {
    counts.sealed++;
  }
}

function tally (map: Map<string, number>, key: string | null | undefined) {
  if (key) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }
}

const sorted = (map: Map<string, number>): Tally[] => [...map].map(([key, n]) => ({ key, count: n })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

export function almanacData (captures: Capture[]): AlmanacData {
  const all = emptyCounts();
  const generations = new Map<number, StatusCounts>();
  const types = new Map<PokemonType, StatusCounts>(TYPE_ORDER.map((type) => [type, emptyCounts()]));
  const origins = new Map<string, number>();
  const languages = new Map<string, number>();
  const balls = new Map<string, number>();
  const ots = new Map<string, number>();
  const places = new Map<string, number>();
  const months = new Map<string, number>();
  const legendary = emptyCounts();
  const mythical = emptyCounts();
  let undated = 0;
  let favorites = 0;
  let partners = 0;
  let nicknamed = 0;
  let gifts = 0;
  let trained = 0;
  const byDate: Capture[] = [];

  for (const capture of captures) {
    const { pokemon } = capture;
    count(all, capture);
    if (!generations.has(pokemon.generation)) {
      generations.set(pokemon.generation, emptyCounts());
    }
    count(generations.get(pokemon.generation)!, capture);
    for (const type of pokemon.types ?? []) {
      count(types.get(type)!, capture);
    }
    if (pokemon.legendary_class === 'legendary') {
      count(legendary, capture);
    } else if (pokemon.legendary_class === 'mythical') {
      count(mythical, capture);
    }
    if (!capture.captured || capture.status === 'unobtainable') {
      continue;
    }
    // what a record says of itself counts once it's sealed, a placeholder till then, as in the filters they press into
    if (capture.sealed) {
      tally(origins, capture.origin_game);
      tally(languages, capture.language);
      tally(balls, capture.ball);
      tally(ots, capture.ot);
      const place = shownPlace(capture);
      tally(places, place && placeKey(place));
      if (capture.favorite === 'favorite') {
        favorites++;
      } else if (capture.favorite === 'partner') {
        partners++;
      }
      if (capture.has_nickname && capture.nickname) {
        nicknamed++;
      }
      if (capture.origin_game === 'mystery_gift') {
        gifts++;
      }
      if (capture.trained === 'ivs' || capture.trained === 'ev') {
        trained++;
      }
    }
    if (capture.catch_date) {
      tally(months, capture.catch_date.slice(0, 7));
      byDate.push(capture);
    } else {
      undated++;
    }
  }

  // every month from the first catch to the last, so a quiet stretch shows as one
  const dated = [...months.keys()].sort();
  const monthRun: MonthCount[] = [];
  if (dated.length > 0) {
    let [year, month] = dated[0].split('-').map(Number);
    const [lastYear, lastMonth] = dated[dated.length - 1].split('-').map(Number);
    while (year < lastYear || (year === lastYear && month <= lastMonth)) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      monthRun.push({ year, month, count: months.get(key) ?? 0 });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }
  // by date; the sort is stable, so within a day in the dex's order
  byDate.sort((a, b) => a.catch_date!.localeCompare(b.catch_date!));
  const milestones: Milestone[] = MILESTONES.filter((n) => n < byDate.length).map((n) => ({ n, capture: byDate[n - 1], latest: false }));
  if (byDate.length > 0) {
    milestones.push({ n: byDate.length, capture: byDate[byDate.length - 1], latest: true });
  }

  const busiest = monthRun.reduce<MonthCount | null>((best, entry) => (entry.count > (best?.count ?? 0) ? entry : best), null);

  return {
    all,
    generations: [...generations].sort((a, b) => a[0] - b[0]).map(([generation, counts]) => ({ generation, ...counts })),
    types: [...types].filter(([, counts]) => counts.total > 0).map(([type, counts]) => ({ type, ...counts })),
    origins: sorted(origins),
    languages: sorted(languages),
    balls: sorted(balls),
    ots: sorted(ots),
    places: sorted(places),
    months: monthRun,
    undated,
    specials: { favorites, partners, nicknamed, gifts, trained, legendary, mythical },
    milestones,
    recent: byDate.slice(-RECENT).reverse(),
    busiest,
  };
}
