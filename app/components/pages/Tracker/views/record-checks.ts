import { GAME_FACTS } from '../../../../utils/game-facts';
import { closedGameHas, debutOf, gameDexes, lineOf, sameId } from '../../../../utils/game-reach';
import { localDay } from './views-kit';
import { unansweredFields } from '../../../../utils/capture-fields';

import type { ViewKey } from './views-i18n';
import type { ViewRecord } from './ViewScope';

// each generation's first day, for a mon caught before its species was out anywhere
const GEN_DAY: Record<number, string> = {
  1: '1996-02-27', 2: '1999-11-21', 3: '2002-11-21', 4: '2006-09-28', 5: '2010-09-18', 6: '2013-10-12', 7: '2016-11-18', 8: '2019-11-15', 9: '2022-11-18',
};

export type Check = 'future' | 'beforeGame' | 'beforeSpecies' | 'notInGame' | 'otSplit' | 'languageSplit' | 'staleSeal';
export const CHECKS: Check[] = ['future', 'beforeGame', 'beforeSpecies', 'notInGame', 'otSplit', 'languageSplit', 'staleSeal'];

// the fields each check is about, for a sheet that marks the field itself
export const CHECK_FIELDS: Record<Check, string[]> = {
  future: ['catch_date'],
  beforeGame: ['catch_date', 'origin_game'],
  beforeSpecies: ['catch_date'],
  notInGame: ['origin_game'],
  otSplit: ['ot', 'tid'],
  languageSplit: ['language'],
  staleSeal: [],
};

export interface Flag {
  record: ViewRecord;
  // what's off, in a few words, for its tip
  why: string;
}

type Text = (key: ViewKey, params?: Record<string, string | number>) => string;

// every caught record looked over for what doesn't add up (views/RecordCheck.tsx shows them a check to a card): a day
// still to come, a day before its game (or its species) was out, a mon its game's dex doesn't have, one trainer's ID
// No. under two OT names or two languages, a sealed record whose fields have gone stale
export function checkRecords (records: ViewRecord[], lt: Text, gameName: (game: string) => string): { flags: Map<Check, Flag[]>; caught: number } {
  const today = localDay();
  const out = new Map<Check, Flag[]>(CHECKS.map((check) => [check, []]));
  const add = (check: Check, record: ViewRecord, why: string) => out.get(check)!.push({ record, why });
  const held = records.filter(({ capture }) => capture.captured && capture.status !== 'unobtainable');
  const dexes = gameDexes();

  for (const record of held) {
    const { capture } = record;
    const date = capture.catch_date;
    const game = capture.origin_game;
    const line = lineOf(capture);
    if (date && date > today) {
      add('future', record, date);
    }
    const release = game ? GAME_FACTS[game]?.release : undefined;
    if (date && release && date < release) {
      add('beforeGame', record, lt('check.why.beforeGame', { date, game: gameName(game!), release }));
    }
    const debut = GEN_DAY[debutOf(line[0], capture.pokemon.generation)];
    if (date && debut && date < debut) {
      add('beforeSpecies', record, lt('check.why.beforeSpecies', { date, debut }));
    }
    if (game) {
      const closed = line.map((stage) => closedGameHas(game, stage));
      const listed = dexes[game];
      if ((closed[0] !== null && !closed.some(Boolean)) || (listed && !line.some((stage) => listed.has(stage.national)))) {
        add('notInGame', record, gameName(game));
      }
    }
    if (capture.sealed && unansweredFields(capture, capture.pokemon.gender_lock).length > 0) {
      add('staleSeal', record, unansweredFields(capture, capture.pokemon.gender_lock).map((field) => field.id).join(', '));
    }
  }

  // one trainer's mons: the same game and ID No., which should share one OT name and one language
  const trainers = new Map<string, ViewRecord[]>();
  for (const record of held) {
    const { tid, origin_game: game } = record.capture;
    if (tid && game && !['trade', 'mystery_gift', 'other', 'home', 'go'].includes(game)) {
      const key = `${game}:${Number(tid)}`;
      trainers.set(key, [...(trainers.get(key) ?? []), record]);
    }
  }
  for (const group of trainers.values()) {
    const ots = new Set(group.map(({ capture }) => capture.ot).filter(Boolean));
    if (ots.size > 1) {
      for (const record of group) {
        add('otSplit', record, lt('check.why.otSplit', { tid: record.capture.tid!, ots: [...ots].join(' / ') }));
      }
    }
    const languages = new Set(group.map(({ capture }) => capture.language).filter(Boolean));
    if (languages.size > 1 && group.every(({ capture }) => sameId(capture.tid, group[0].capture.tid))) {
      for (const record of group) {
        add('languageSplit', record, lt('check.why.languageSplit', { tid: record.capture.tid!, n: languages.size }));
      }
    }
  }
  return { flags: out, caught: held.length };
}
