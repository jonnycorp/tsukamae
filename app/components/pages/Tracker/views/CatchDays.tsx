import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faPen } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useRef, useState } from 'react';
import { useKeys, useViewData } from './views-kit';

import { BALL_NAMES, ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { GalaxyPanel } from './GalaxyPanel';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { ScopeSwitch, useViewScope, useScopedRecords } from './ViewScope';
import { gameColor } from '../../../../utils/game-colors';
import { localizeBall, localizeOriginGame } from '../../../../i18n/names';
import { useViewText } from './views-i18n';

import type { CSSProperties } from 'react';
import type { ViewProps } from './views-kit';
import type { ViewRecord } from './ViewScope';

type Show = 'all' | 'noted' | 'yearly';
const SHOWS: Show[] = ['all', 'noted', 'yearly'];

interface Day {
  // yyyy-mm-dd, or '' for the undated
  date: string;
  mons: ViewRecord[];
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
  const { lt } = useViewText();
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <label className="ld-note">
      <FontAwesomeIcon icon={faPen} />
      <input
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false;
            setDraft(null);
          } else if (draft !== null) {
            onSave(draft.trim());
            setDraft(null);
          }
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter keeps it and Escape puts it back, either leaving the field; typing here is the note's, not the scene's,
          // and an IME's Enter and Escape its conversion's
          e.stopPropagation();
          if (e.nativeEvent.isComposing) {
            return;
          }
          cancelled.current = e.key === 'Escape';
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.currentTarget.blur();
          }
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
export function CatchDays ({ back, onClose, onLocate, onReview }: ViewProps) {
  const { lt, locale } = useViewText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useViewScope('days');
  const records = useScopedRecords(scope);
  const [notes, setNotes] = useViewData<Record<string, string>>('days', 'notes', {}, 'labDays.notes');
  const [yearly, setYearly] = useViewData<Record<string, string>>('days', 'yearly', {}, 'labDays.yearly');
  const [show, setShow] = useState<Show>('all');
  const [oldest, setOldest] = useState(false);
  const [picked, setPicked] = useState<{ record: ViewRecord; day: ViewRecord[] } | null>(null);

  const days = useMemo(() => {
    const byDate = new Map<string, ViewRecord[]>();
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
  const shown = useMemo(() => days
  .filter(({ date }) => show === 'all' || (show === 'noted' ? Boolean(notes[date]) : Boolean(date && yearly[date.slice(5)])))
  .sort((a, b) => (!a.date ? 1 : !b.date ? -1 : oldest ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))), [days, show, notes, yearly, oldest]);

  useScrollBack(pageRef, back, true);

  // Escape lets a pick go before it closes the scene
  useKeys((e) => {
    if (e.key === 'Escape' && picked && !e.defaultPrevented) {
      setPicked(null);
      e.preventDefault();
    }
  });

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

  // the cards, apart from the tip, so pointing at a mon re-renders none of them
  const cards = useMemo(() => {
    let lastYear = '';
    return shown.map((day) => {
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
              <div className="ld-mons">
                {day.mons.map((record, i) => (
                  <button
                    className={classNames('ld-mon', { away: !record.here })}
                    key={record.key}
                    onClick={() => setPicked({ record, day: day.mons })}
                    style={{ '--i': Math.min(i, 30) } as CSSProperties}
                    type="button"
                  >
                    <SceneMon pokemon={record.capture.pokemon} view={record.view} />
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
    });
  }, [shown, notes, yearly, busiest, locale, onReview]); // the rest follow from these

  return (
    <Scene hint={lt('days.hint')} name="view-days" onClose={onClose} quiet={Boolean(back)} title={lt('days.title')}>
      {({ scale }) => (
        <div className={classNames('ld-page', { aside: picked })} ref={pageRef} style={{ zoom: scale }}>
          <header className="ld-head">
            <div className="ld-figure"><b>{dated.length}</b><small>{lt('days.days')}</small></div>
            {dated.length > 0 && (() => {
              const top = dated.reduce((a, b) => (b.mons.length > a.mons.length ? b : a));
              return <div className="ld-figure"><b>{fmt(top.date, { year: 'numeric', month: 'short', day: 'numeric' })}</b><small>{lt('days.busiest', { n: top.mons.length })}</small></div>;
            })()}
            <div className="ld-controls">
              <div className="view-scope" role="group">
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

          {cards}

          {picked && (
            <GalaxyPanel
              ballName={picked.record.capture.ball ? ballName(picked.record.capture.ball) : undefined}
              day={picked.day}
              key={picked.record.key}
              keys={false}
              kind="day"
              onLocate={() => onLocate(picked.record.capture.pokemon.id)}
              onPick={(record) => setPicked({ ...picked, record })}
              record={picked.record}
            />
          )}
        </div>
      )}
    </Scene>
  );
}
