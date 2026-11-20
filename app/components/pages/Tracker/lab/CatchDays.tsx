import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faPen } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useRef, useState } from 'react';

import { BALL_NAMES, ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { LabTip } from './LabTip';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { ScopeSwitch, useLabScope, useScopedRecords } from './LabScope';
import { displayName } from '../../../library/PokemonName';
import { gameColor } from '../../../../utils/game-colors';
import { localizeBall, localizeOriginGame } from '../../../../i18n/names';
import { useLabText } from './lab-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';

import type { CSSProperties } from 'react';
import type { LabProps } from './lab-kit';
import type { LabRecord } from './LabScope';

type Show = 'all' | 'noted' | 'yearly';
const SHOWS: Show[] = ['all', 'noted', 'yearly'];

interface Day {
  // yyyy-mm-dd, or '' for the undated
  date: string;
  mons: LabRecord[];
  games: [game: string, count: number][];
  balls: [ball: string, count: number][];
}

const tally = (values: (string | null)[]) => {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value && value !== 'unknown') {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

// a day's note, written on its card and kept as you leave the field
function DayNote ({ value, onSave }: { value: string; onSave: (note: string) => void }) {
  const { lt } = useLabText();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="ld-note">
      <FontAwesomeIcon icon={faPen} />
      <input
        onBlur={() => {
          if (draft !== null) {
            onSave(draft.trim());
            setDraft(null);
          }
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
          // typing here is the note's, not the scene's
          e.stopPropagation();
        }}
        placeholder={lt('days.note')}
        value={draft ?? value}
      />
    </label>
  );
}

// the catch days: a journal of the days you caught on, newest first, each a card of its own: the day large, how many
// and which, the games they came from and the balls they went into. A day can be written on (what happened that day:
// a birthday, a story's turn), and a day of the year marked to come round every year, its name then on every day it
// falls on. A day's mons go to the review together, to look over as one batch; a mon pressed goes to it in the dex
export function CatchDays ({ back, onClose, onLocate, onReview }: LabProps) {
  const { lt, locale } = useLabText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useLabScope('days');
  const records = useScopedRecords(scope);
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('labDays.notes', {});
  const [yearly, setYearly] = useLocalStorage<Record<string, string>>('labDays.yearly', {});
  const [show, setShow] = useState<Show>('all');
  const [oldest, setOldest] = useState(false);
  const [hot, setHot] = useState<{ record: LabRecord; x: number; y: number } | null>(null);

  const days = useMemo(() => {
    const byDate = new Map<string, LabRecord[]>();
    for (const record of records) {
      if (record.capture.captured && record.capture.status !== 'unobtainable') {
        const date = record.capture.catch_date ?? '';
        byDate.set(date, [...(byDate.get(date) ?? []), record]);
      }
    }
    return [...byDate.entries()].map(([date, mons]): Day => ({
      date,
      mons: mons.sort((a, b) => a.capture.pokemon.id - b.capture.pokemon.id),
      games: tally(mons.map(({ capture }) => capture.origin_game)),
      balls: tally(mons.map(({ capture }) => capture.ball)),
    }));
  }, [records]);

  const dated = days.filter(({ date }) => date);
  const busiest = Math.max(1, ...dated.map(({ mons }) => mons.length));
  const shown = days
  .filter(({ date }) => show === 'all' || (show === 'noted' ? Boolean(notes[date]) : Boolean(date && yearly[date.slice(5)])))
  .sort((a, b) => (!a.date ? 1 : !b.date ? -1 : oldest ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  useScrollBack(pageRef, back, true);

  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, options).format(new Date(`${iso}T00:00:00`));
  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);
  const ballName = (ball: string) => localizeBall(locale, ball, BALL_NAMES.get(ball) ?? ball);
  const saveNote = (date: string, note: string) => {
    const next = { ...notes };
    if (note) {
      next[date] = note;
    } else {
      delete next[date];
    }
    setNotes(next);
    // a yearly day takes its name from the note it was marked with, kept in step
    if (yearly[date.slice(5)] !== undefined && note) {
      setYearly({ ...yearly, [date.slice(5)]: note });
    }
  };
  const toggleYearly = (date: string) => {
    const key = date.slice(5);
    const next = { ...yearly };
    if (next[key] !== undefined) {
      delete next[key];
    } else {
      next[key] = notes[date] || lt('days.yearly');
    }
    setYearly(next);
  };

  let lastYear = '';

  return (
    <Scene hint={lt('days.hint')} name="lab-days" onClose={onClose} quiet={Boolean(back)} title={lt('days.title')}>
      {({ scale }) => (
        <div className="ld-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="ld-head">
            <div className="ld-figure"><b>{dated.length}</b><small>{lt('days.days')}</small></div>
            {dated.length > 0 && (() => {
              const top = dated.reduce((a, b) => (b.mons.length > a.mons.length ? b : a));
              return <div className="ld-figure"><b>{fmt(top.date, { year: 'numeric', month: 'short', day: 'numeric' })}</b><small>{lt('days.busiest', { n: top.mons.length })}</small></div>;
            })()}
            <div className="ld-controls">
              <div className="lab-scope" role="group">
                {SHOWS.map((option) => (
                  <button aria-pressed={show === option} className={classNames({ on: show === option })} key={option} onClick={() => setShow(option)} type="button">
                    {lt(`days.show.${option}`)}
                  </button>
                ))}
              </div>
              <button className="ld-order" onClick={() => setOldest(!oldest)} type="button">{lt(oldest ? 'days.oldest' : 'days.newest')}</button>
              <ScopeSwitch onChange={setScope} scope={scope} />
            </div>
          </header>

          {shown.length === 0 && <p className="ld-empty">{lt('days.empty')}</p>}

          {shown.map((day) => {
            const year = day.date.slice(0, 4);
            const divider = year !== lastYear;
            lastYear = year;
            const mark = day.date ? yearly[day.date.slice(5)] : undefined;
            const here = day.mons.filter((record) => record.here);
            return (
              <div className="ld-run" key={day.date || 'undated'}>
                {divider && <h2 className="ld-year">{day.date ? year : lt('days.undated')}</h2>}
                <article className={classNames('ld-day', { marked: mark !== undefined })}>
                  <div className="ld-when">
                    {day.date
                      ? (
                        <>
                          <b>{Number(day.date.slice(8))}</b>
                          <span>{fmt(day.date, { year: 'numeric', month: 'long' })}</span>
                          <small>{fmt(day.date, { weekday: 'long' })}</small>
                        </>
                      )
                      : <b className="ld-undated">—</b>}
                    {mark !== undefined && <em className="ld-mark"><FontAwesomeIcon icon={faHeart} /> {mark}</em>}
                  </div>
                  <div className="ld-what">
                    <div className="ld-line">
                      <span className="ld-count" style={{ '--f': day.mons.length / busiest } as CSSProperties}>
                        <b>{lt('days.count', { n: day.mons.length })}</b><i />
                      </span>
                      <span className="ld-games">
                        {day.games.map(([game, n]) => (
                          <span key={game} style={{ '--ground': gameColor(game) } as CSSProperties}><i />{gameName(game)}<b>{n}</b></span>
                        ))}
                      </span>
                      <span className="ld-balls">
                        {day.balls.map(([ball, n]) => (
                          <span key={ball} title={`${ballName(ball)} ×${n}`}><img alt={ballName(ball)} height={30} src={`/balls/${ball}.png`} width={30} />{n > 1 && <b>{n}</b>}</span>
                        ))}
                      </span>
                    </div>
                    <div className="ld-mons" onPointerLeave={() => setHot(null)}>
                      {day.mons.map((record, i) => (
                        <button
                          className={classNames('ld-mon', { away: !record.here })}
                          key={record.key}
                          onClick={() => record.here && onLocate(record.capture.pokemon.id)}
                          onPointerEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHot({ record, x: rect.right, y: rect.top + rect.height / 2 });
                          }}
                          style={{ '--i': Math.min(i, 30) } as CSSProperties}
                          type="button"
                        >
                          <SceneMon pokemon={record.capture.pokemon} />
                        </button>
                      ))}
                    </div>
                    {day.date && (
                      <div className="ld-foot">
                        <DayNote onSave={(note) => saveNote(day.date, note)} value={notes[day.date] ?? ''} />
                        <button aria-pressed={mark !== undefined} className={classNames('ld-yearly', { on: mark !== undefined })} onClick={() => toggleYearly(day.date)} type="button">
                          <FontAwesomeIcon icon={faHeart} /> {lt('days.yearly')}
                        </button>
                        <button className="ld-review" disabled={here.length === 0} onClick={() => onReview(here.map(({ capture }) => capture.pokemon.id))} type="button">
                          {lt('days.review', { n: here.length })}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              </div>
            );
          })}

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{displayName(hot.record.capture.pokemon.name, hot.record.capture.pokemon.name_ja, locale)}</strong>
              <small>
                {[
                  hot.record.capture.origin_game && gameName(hot.record.capture.origin_game),
                  hot.record.capture.ball && hot.record.capture.ball !== 'unknown' && ballName(hot.record.capture.ball),
                  scope === 'all' && hot.record.dex.title,
                ].filter(Boolean).join(' · ')}
              </small>
              {hot.record.here && <em>{lt('days.press')}</em>}
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
