import classNames from 'classnames';
import { useMemo, useRef, useState } from 'react';

import { LabTip } from './LabTip';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { displayName } from '../../../library/PokemonName';
import { isoDay } from './lab-kit';
import { useLabText } from './lab-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { LabProps } from './lab-kit';

const DAY_MS = 86_400_000;
// a loupe's sprites before the rest are counted
const TIP_MONS = 24;
// the shades a day's cell takes, by how many it holds
const LEVELS = [1, 2, 4, 7];

interface Day {
  iso: string;
  mons: Capture[];
}

interface Year {
  year: number;
  // Monday-first weeks, Jan 1's week first, each seven days or null outside the year
  weeks: (Day | null)[][];
  total: number;
  months: number[];
}

const level = (n: number) => LEVELS.reduce((found, least, i) => (n >= least ? i + 1 : found), 0);
const parse = (iso: string) => new Date(`${iso}T00:00:00`);

function buildYear (year: number, byDay: Map<string, Capture[]>): Year {
  const first = new Date(year, 0, 1);
  // Monday's column 0
  const lead = (first.getDay() + 6) % 7;
  const weeks: (Day | null)[][] = [];
  const months = Array<number>(12).fill(0);
  let total = 0;
  for (let d = new Date(first.getTime() - lead * DAY_MS); d.getFullYear() <= year; d = new Date(d.getTime() + 7 * DAY_MS)) {
    const week: (Day | null)[] = [];
    for (let k = 0; k < 7; k++) {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
      if (day.getFullYear() !== year) {
        week.push(null);
        continue;
      }
      const iso = isoDay(day);
      const mons = byDay.get(iso) ?? [];
      total += mons.length;
      months[day.getMonth()] += mons.length;
      week.push({ iso, mons });
    }
    weeks.push(week);
  }
  return { year, weeks, total, months };
}

// the longest run of days in a row with a catch, and where it ended
function longestStreak (days: string[]): { length: number; end: string | null } {
  let best = { length: 0, end: null as string | null };
  let run = 0;
  let prev = -Infinity;
  for (const iso of days) {
    const t = parse(iso).getTime();
    run = Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1;
    prev = t;
    if (run > best.length) {
      best = { length: run, end: iso };
    }
  }
  return best;
}

// the catch calendar: every dated mon on the day it was caught, a year a sheet of weeks (Monday first), each day's cell
// shaded by how many it holds, a month's total as a bar beside its year. Pointed at, a day shows its mons; pressed, the
// review runs through them. Above it all, the run's numbers, and the mons caught on this day in years gone by
export function CatchCalendar ({ back, onClose, onReview }: LabProps) {
  const { captures } = useTrackerState();
  const { lt, locale } = useLabText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<{ day: Day; x: number; y: number } | null>(null);

  const dated = useMemo(() => captures
  .filter((capture) => capture.captured && capture.status !== 'unobtainable' && capture.catch_date)
  .sort((a, b) => a.catch_date!.localeCompare(b.catch_date!) || a.pokemon.id - b.pokemon.id), [captures]);

  const { years, stats, onThisDay } = useMemo(() => {
    const byDay = new Map<string, Capture[]>();
    for (const capture of dated) {
      byDay.set(capture.catch_date!, [...(byDay.get(capture.catch_date!) ?? []), capture]);
    }
    const days = [...byDay.keys()].sort();
    const yearNumbers = [...new Set(days.map((iso) => Number(iso.slice(0, 4))))].sort((a, b) => b - a);
    const busiest = days.reduce<string | null>((best, iso) => (!best || byDay.get(iso)!.length > byDay.get(best)!.length ? iso : best), null);
    const today = isoDay(new Date());
    const monthDay = today.slice(5);
    return {
      years: yearNumbers.map((year) => buildYear(year, byDay)),
      stats: {
        first: days[0] ?? null,
        busiest,
        busiestCount: busiest ? byDay.get(busiest)!.length : 0,
        active: days.length,
        streak: longestStreak(days),
      },
      onThisDay: dated.filter((capture) => capture.catch_date!.slice(5) === monthDay && capture.catch_date !== today),
    };
  }, [dated]);

  useScrollBack(pageRef, back, true);

  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const longDate = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(parse(iso));
  const shortDate = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(parse(iso));
  const monthNames = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(tag, { month: 'short' }).format(new Date(2000, m, 1)));
  const weekdayNames = Array.from({ length: 7 }, (_, k) => new Intl.DateTimeFormat(tag, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + k)));

  const today = isoDay(new Date());
  const show = (day: Day) => (e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHot({ day, x: rect.right, y: rect.top + rect.height / 2 });
  };
  const review = (mons: Capture[]) => {
    if (mons.length > 0) {
      onReview(mons.map((capture) => capture.pokemon.id));
    }
  };

  return (
    <Scene hint={lt('calendar.hint')} name="lab-calendar" onClose={onClose} quiet={Boolean(back)} title={lt('calendar.title')}>
      {({ scale }) => (
        <div className="lc-page" ref={pageRef} style={{ zoom: scale }}>
          <section className="lc-stats">
            <div className="lc-stat" style={{ '--i': 0 } as CSSProperties}>
              <b>{dated.length}</b>
              <small>{lt('calendar.dated')}</small>
            </div>
            <div className="lc-stat" style={{ '--i': 1 } as CSSProperties}>
              <b>{stats.active}</b>
              <small>{lt('calendar.activeDays')}</small>
            </div>
            <div className="lc-stat" style={{ '--i': 2 } as CSSProperties}>
              <b>{stats.streak.length}</b>
              <small>{lt('calendar.streak')}</small>
              {stats.streak.end && <em>{lt('calendar.until', { date: shortDate(stats.streak.end) })}</em>}
            </div>
            <div className="lc-stat" style={{ '--i': 3 } as CSSProperties}>
              <b>{stats.busiestCount}</b>
              <small>{lt('calendar.busiest')}</small>
              {stats.busiest && <em>{shortDate(stats.busiest)}</em>}
            </div>
            <div className="lc-stat" style={{ '--i': 4 } as CSSProperties}>
              <b className="lc-stat-date">{stats.first ? shortDate(stats.first) : '—'}</b>
              <small>{lt('calendar.first')}</small>
            </div>
          </section>

          {onThisDay.length > 0 && (
            <section className="lc-today">
              <h2>{lt('calendar.onThisDay')}</h2>
              <div className="lc-today-mons">
                {onThisDay.map((capture) => (
                  <button
                    className="lc-today-mon"
                    key={capture.pokemon.id}
                    onClick={() => review(onThisDay)}
                    title={displayName(capture.pokemon.name, capture.pokemon.name_ja, locale)}
                    type="button"
                  >
                    <SceneMon pokemon={capture.pokemon} zoom={1.5} />
                    <small>{lt('calendar.yearsAgo', { n: Number(isoDay(new Date()).slice(0, 4)) - Number(capture.catch_date!.slice(0, 4)) })}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {years.length === 0 && <p className="lc-empty">{lt('calendar.empty')}</p>}

          {years.map((year, y) => {
            const most = Math.max(1, ...year.months);
            return (
              <section className="lc-year" key={year.year} style={{ '--y': y } as CSSProperties}>
                <header>
                  <h2>{locale === 'ja' ? `${year.year}年` : year.year}</h2>
                  <span>{lt('calendar.count', { n: year.total })}</span>
                </header>
                <div className="lc-sheet">
                  <div className="lc-weekdays">
                    {weekdayNames.map((name, k) => <span key={k}>{k % 2 === 0 ? name : ''}</span>)}
                  </div>
                  <div className="lc-grid">
                    <div className="lc-months">
                      {year.weeks.map((week, w) => {
                        const firstOfMonth = week.find((day) => day?.iso.endsWith('-01'));
                        return <span key={w}>{firstOfMonth ? monthNames[Number(firstOfMonth.iso.slice(5, 7)) - 1] : ''}</span>;
                      })}
                    </div>
                    <div className="lc-weeks">
                      {year.weeks.map((week, w) => (
                        <div className="lc-week" key={w} style={{ '--w': w } as CSSProperties}>
                          {week.map((day, k) => (day && day.iso > today ? <span className="lc-day future" key={k} /> : day
                            ? (
                              <button
                                aria-label={`${longDate(day.iso)} ${lt('calendar.count', { n: day.mons.length })}`}
                                className={classNames('lc-day', `lv-${level(day.mons.length)}`, { hot: hot?.day.iso === day.iso, today: day.iso === today })}
                                key={k}
                                onBlur={() => setHot(null)}
                                onClick={() => review(day.mons)}
                                onFocus={show(day)}
                                onPointerEnter={show(day)}
                                onPointerLeave={() => setHot(null)}
                                type="button"
                              />
                            )
                            : <span className="lc-day off" key={k} />))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div aria-hidden="true" className="lc-bars">
                    {year.months.map((n, m) => (
                      <span className="lc-bar" key={m} style={{ '--f': n / most, '--m': m } as CSSProperties}>
                        <i />
                        <small>{monthNames[m]}</small>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{longDate(hot.day.iso)}</strong>
              <small>{hot.day.mons.length > 0 ? lt('calendar.count', { n: hot.day.mons.length }) : lt('calendar.none')}</small>
              {hot.day.mons.length > 0 && (
                <>
                  <span className="lab-tip-mons">
                    {hot.day.mons.slice(0, TIP_MONS).map((capture) => <SceneMon key={capture.pokemon.id} pokemon={capture.pokemon} />)}
                    {hot.day.mons.length > TIP_MONS && <span className="lc-more">+{hot.day.mons.length - TIP_MONS}</span>}
                  </span>
                  <em>{lt('calendar.press')}</em>
                </>
              )}
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
