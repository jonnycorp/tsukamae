import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useRef, useState } from 'react';

import { GAME_FACTS } from '../../../../utils/game-facts';
import { LabTip } from './LabTip';
import { ORIGIN_GAME_NAMES, unansweredFields } from '../../../../utils/capture-fields';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { ScopeSwitch, useLabScope, useScopedRecords } from './LabScope';
import { closedGameHas, debutOf, gameDexes, lineOf, sameId } from '../../../../utils/game-reach';
import { displayName } from '../../../library/PokemonName';
import { localizeOriginGame } from '../../../../i18n/names';
import { localDay } from './lab-kit';
import { useLabText } from './lab-i18n';

import type { CSSProperties } from 'react';
import type { LabKey } from './lab-i18n';
import type { LabProps } from './lab-kit';
import type { LabRecord } from './LabScope';

// each generation's first day, for a mon caught before its species was out anywhere
const GEN_DAY: Record<number, string> = {
  1: '1996-02-27', 2: '1999-11-21', 3: '2002-11-21', 4: '2006-09-28', 5: '2010-09-18', 6: '2013-10-12', 7: '2016-11-18', 8: '2019-11-15', 9: '2022-11-18',
};

type Check = 'future' | 'beforeGame' | 'beforeSpecies' | 'notInGame' | 'otSplit' | 'languageSplit' | 'staleSeal';
const CHECKS: Check[] = ['future', 'beforeGame', 'beforeSpecies', 'notInGame', 'otSplit', 'languageSplit', 'staleSeal'];

interface Flag {
  record: LabRecord;
  // what's off, in a few words, for its tip
  why: string;
}

// the record check: every caught record looked over for what doesn't add up, a check to a card: a day still to come,
// a day before its game (or its species) was out, a mon its game's dex doesn't have, one trainer's ID No. under two OT
// names or two languages, a sealed record whose fields have gone stale. Each card's mons go to the review together to
// put right; a ring at the top shows how many records pass every check, to watch it fill as you go
export function RecordCheck ({ back, onClose, onReview }: LabProps) {
  const { lt, locale } = useLabText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useLabScope('check');
  const records = useScopedRecords(scope);
  const [hot, setHot] = useState<{ flag: Flag; x: number; y: number } | null>(null);

  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);

  const { flags, caught } = useMemo(() => {
    const today = localDay();
    const out = new Map<Check, Flag[]>(CHECKS.map((check) => [check, []]));
    const add = (check: Check, record: LabRecord, why: string) => out.get(check)!.push({ record, why });
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
    const trainers = new Map<string, LabRecord[]>();
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
  }, [records, locale]);

  useScrollBack(pageRef, back, true);

  const flagged = new Set([...flags.values()].flat().map(({ record }) => record.key));
  const clean = caught - flagged.size;
  const share = caught ? clean / caught : 1;
  const queueOf = (list: Flag[]) => [...new Set(list.filter(({ record }) => record.here).map(({ record }) => record.capture.pokemon.id))];
  const everything = queueOf([...flags.values()].flat());

  // the cards, apart from the tip, so pointing at a mon re-renders none of them
  const checks = useMemo(() => (
    <div className="lc-checks">
      {CHECKS.map((check, i) => {
        const list = flags.get(check)!;
        const queue = queueOf(list);
        return (
          <section className={classNames('lc-check', { ok: list.length === 0 })} key={check} style={{ '--i': i } as CSSProperties}>
            <div className="lc-check-head">
              <span className="lc-badge">{list.length === 0 ? <FontAwesomeIcon icon={faCheck} /> : list.length}</span>
              <div>
                <h3>{lt(`check.${check}` as LabKey)}</h3>
                <p>{lt(`check.${check}.about` as LabKey)}</p>
              </div>
              {queue.length > 0 && (
                <button className="lc-review" onClick={() => onReview(queue)} type="button">{lt('check.review', { n: queue.length })}</button>
              )}
            </div>
            {list.length > 0 && (
              <div className="lc-mons" onPointerLeave={() => setHot(null)}>
                {list.map((flag) => (
                  <button
                    className={classNames('lc-mon', { away: !flag.record.here })}
                    key={flag.record.key}
                    onClick={() => flag.record.here && onReview([flag.record.capture.pokemon.id])}
                    onPointerEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHot({ flag, x: rect.right, y: rect.top + rect.height / 2 });
                    }}
                    type="button"
                  >
                    <SceneMon pokemon={flag.record.capture.pokemon} />
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  ), [flags, locale, onReview]); // the rest follow from these

  return (
    <Scene hint={lt('check.hint')} name="lab-check" onClose={onClose} quiet={Boolean(back)} title={lt('check.title')}>
      {({ scale }) => (
        <div className="lc-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="lc-head">
            <div className="lc-ring" style={{ '--f': share } as CSSProperties}>
              <b>{Math.floor(share * 100)}<small>%</small></b>
            </div>
            <div className="lc-sum">
              <h2>{lt('check.clean', { clean, caught })}</h2>
              <p>{flagged.size ? lt('check.flagged', { n: flagged.size }) : lt('check.allClean')}</p>
              {everything.length > 0 && (
                <button className="lc-review" onClick={() => onReview(everything)} type="button">{lt('check.reviewAll', { n: everything.length })}</button>
              )}
            </div>
            <ScopeSwitch onChange={setScope} scope={scope} />
          </header>

          {checks}

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{displayName(hot.flag.record.capture.pokemon.name, hot.flag.record.capture.pokemon.name_ja, locale)}</strong>
              <small>{hot.flag.why}</small>
              {scope === 'all' && <small>{hot.flag.record.dex.title}</small>}
              {hot.flag.record.here && <em>{lt('check.press')}</em>}
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
