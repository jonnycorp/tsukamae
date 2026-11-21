import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ArtHologram } from './GalaxyPanel';
import { Scene, SceneMon } from '../Scene';
import { ScopeSwitch, useViewScope, useScopedRecords } from './ViewScope';
import { intervalMs, review } from './fsrs';
import { localDay, useKeys, useViewData } from './views-kit';
import { useViewText } from './views-i18n';

import type { Card, Grade } from './fsrs';
import type { CSSProperties } from 'react';
import type { CapturePokemon } from '../../../../types';
import type { ViewProps } from './views-kit';

// a card due within this much counts as due now, so a mon missed a minute ago comes back in the same sitting
const LEARN_AHEAD = 20 * 60_000;
// a stability this long and the name counts as known
const KNOWN_DAYS = 21;
// past this long to answer, a right answer is offered as Hard rather than Good
const SLOW_MS = 6000;
const GRADES: Grade[] = [2, 3, 4];

interface Entry {
  key: string;
  name: string;
  pokemon: CapturePokemon;
  // when it was caught in the scope's dexes, to learn your own mons' names first
  caught: string | null;
}

interface Question {
  entry: Entry;
  choices: Entry[];
  at: number;
}

interface Today {
  date: string;
  fresh: number;
  extra: number;
  done: number;
  right: number;
}

function shuffle<T> (list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// three others alike enough to make it a question: a shared first kana, a shared type, the same generation
function lookalikes (entry: Entry, pool: Entry[]): Entry[] {
  const scored = pool.filter((other) => other.key !== entry.key && other.name !== entry.name).map((other) => ({
    other,
    score: (other.name[0] === entry.name[0] ? 2 : 0) +
      (other.pokemon.types?.some((type) => entry.pokemon.types?.includes(type)) ? 1 : 0) +
      (other.pokemon.generation === entry.pokemon.generation ? 1 : 0) + Math.random() * 1.5,
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(({ other }) => other);
}

const span = (ms: number, lt: ReturnType<typeof useViewText>['lt']) => {
  const minutes = ms / 60_000;
  if (minutes < 60) {
    return lt('quiz.minutes', { n: Math.max(1, Math.round(minutes)) });
  }
  const days = ms / 86_400_000;
  if (days < 1) {
    return lt('quiz.hours', { n: Math.round(minutes / 60) });
  }
  return days < 60 ? lt('quiz.days', { n: Math.round(days) }) : lt('quiz.months', { n: Math.round(days / 30) });
};

// the name quiz: a mon's Japanese name, and four sprites to find it among, the others alike enough to need knowing.
// Each name is a card on a small FSRS: a miss comes back in a minute, a hit on Hard, Good or Easy (offered by how quick
// it was, Space taking that) goes out as far as it'll still be remembered. New names come a day's worth at a time, your
// own caught mons first, newest first; the rest of the dex after, by number. Every card is kept in the data file
export function NameQuiz ({ onClose }: ViewProps) {
  const { lt } = useViewText();
  const [scope, setScope] = useViewScope('quiz');
  const records = useScopedRecords(scope);
  const [cards, setCards] = useViewData<Record<string, Card>>('quiz', 'cards', {}, 'labQuiz.cards');
  const [perDay, setPerDay] = useViewData('quiz', 'newPerDay', 20, 'labQuiz.newPerDay');
  const [storedToday, setToday] = useViewData<Today | null>('quiz', 'today', null, 'labQuiz.today');
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<{ picked: string; ms: number } | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const date = localDay();
  const today: Today = storedToday?.date === date ? storedToday : { date, fresh: 0, extra: 0, done: 0, right: 0 };

  // one card a name, its own mons' catch days kept for the order new ones come in
  const pool = useMemo(() => {
    const byKey = new Map<string, Entry>();
    for (const { capture } of records) {
      const { pokemon } = capture;
      if (!pokemon.name_ja) {
        continue;
      }
      const key = String(pokemon.national_id);
      const caught = capture.captured ? capture.catch_date ?? '0000' : null;
      const had = byKey.get(key);
      if (!had || (caught && (!had.caught || caught > had.caught))) {
        // its sprite the species' own where the dex has it, not a regional form's
        const sprite = had && had.pokemon.form === null ? had.pokemon : pokemon;
        byKey.set(key, { key, name: pokemon.name_ja, pokemon: sprite, caught: caught ?? had?.caught ?? null });
      }
    }
    return [...byKey.values()];
  }, [records]);

  const now = Date.now();
  const due = pool.filter((entry) => cards[entry.key] && cards[entry.key].due <= now + LEARN_AHEAD)
  .sort((a, b) => cards[a.key].due - cards[b.key].due);
  const unseen = pool.filter((entry) => !cards[entry.key])
  .sort((a, b) => (b.caught ?? '').localeCompare(a.caught ?? '') || a.pokemon.national_id - b.pokemon.national_id);
  const freshLeft = Math.max(0, perDay + today.extra - today.fresh);
  const known = pool.filter((entry) => (cards[entry.key]?.stability ?? 0) >= KNOWN_DAYS).length;
  const learning = pool.filter((entry) => cards[entry.key]).length;

  const ask = useCallback(() => {
    const ready = due.filter((entry) => entry.key !== lastKey);
    const entry = ready[0] ?? (freshLeft > 0 ? unseen[0] : undefined) ?? due[0];
    setAnswer(null);
    setQuestion(entry ? { entry, choices: shuffle([entry, ...lookalikes(entry, pool)]), at: performance.now() } : null);
  }, [due, unseen, freshLeft, pool, lastKey]);

  // the first question, and another whenever there's none and one's become ready
  useEffect(() => {
    if (!question) {
      ask();
    }
  }, [question, ask]);

  const pick = (choice: Entry) => {
    if (!question || answer) {
      return;
    }
    setAnswer({ picked: choice.key, ms: performance.now() - question.at });
  };
  const right = answer !== null && question !== null && answer.picked === question.entry.key;
  const suggested: Grade = !answer || !right ? 1 : answer.ms > SLOW_MS ? 2 : 3;

  const grade = (g: Grade) => {
    if (!question || !answer) {
      return;
    }
    const { key } = question.entry;
    const fresh = !cards[key];
    setCards({ ...cards, [key]: review(cards[key], g, Date.now()) });
    setToday({ ...today, fresh: today.fresh + (fresh ? 1 : 0), done: today.done + 1, right: today.right + (right ? 1 : 0) });
    setLastKey(key);
    setQuestion(null);
  };

  useKeys((e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) {
      return;
    }
    const n = Number(e.key);
    if (!answer && question && n >= 1 && n <= question.choices.length) {
      pick(question.choices[n - 1]);
    } else if (answer && (e.key === ' ' || e.key === 'Enter')) {
      grade(suggested);
    } else if (answer && right && n >= 1 && n <= 4) {
      grade(n as Grade);
    } else {
      return;
    }
    e.preventDefault();
  });

  // each generation's names known, learning and not yet met
  const gens = useMemo(() => {
    const by = new Map<number, { total: number; seen: number; known: number }>();
    for (const entry of pool) {
      const g = entry.pokemon.generation;
      const row = by.get(g) ?? { total: 0, seen: 0, known: 0 };
      row.total++;
      row.seen += cards[entry.key] ? 1 : 0;
      row.known += (cards[entry.key]?.stability ?? 0) >= KNOWN_DAYS ? 1 : 0;
      by.set(g, row);
    }
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [pool, cards]);

  const card = question ? cards[question.entry.key] : undefined;
  const nextDue = Object.entries(cards).filter(([key]) => pool.some((entry) => entry.key === key))
  .reduce((soonest, [, c]) => Math.min(soonest, c.due), Infinity);

  return (
    <Scene hint={lt('quiz.hint')} name="view-quiz" onClose={onClose} title={lt('quiz.title')}>
      {({ scale }) => (
        <div className="lq-page" style={{ zoom: scale }}>
          <header className="lq-head">
            <div className="lq-figure"><b>{today.done}</b><small>{lt('quiz.today')}</small></div>
            <div className="lq-figure"><b>{today.done ? `${Math.round((today.right / today.done) * 100)}%` : '—'}</b><small>{lt('quiz.rate')}</small></div>
            <div className="lq-figure"><b>{due.length}</b><small>{lt('quiz.due')}</small></div>
            <div className="lq-figure"><b>{Math.min(freshLeft, unseen.length)}</b><small>{lt('quiz.new')}</small></div>
            <div className="lq-figure"><b>{known}<span>/{pool.length}</span></b><small>{lt('quiz.known', { n: learning })}</small></div>
            <ScopeSwitch onChange={setScope} scope={scope} />
          </header>

          {question
            ? (
              <section className={classNames('lq-card', { answered: Boolean(answer), right, wrong: answer && !right })} key={`${question.entry.key}-${question.at}`}>
                <span className="lq-tag">{card ? lt('quiz.review') : lt('quiz.fresh')}</span>
                <h2 className="lq-name">{question.entry.name}</h2>
                {/* answered: the mon the name is, its art held up beside the name (no English: the name's to be learnt as itself) */}
                {answer && (
                  <div className="lq-reveal">
                    <ArtHologram pokemon={question.entry.pokemon} />
                  </div>
                )}
                <div className="lq-choices">
                  {question.choices.map((choice, i) => (
                    <button
                      className={classNames('lq-choice', {
                        correct: answer && choice.key === question.entry.key,
                        picked: answer?.picked === choice.key,
                      })}
                      disabled={Boolean(answer)}
                      key={choice.key}
                      onClick={() => pick(choice)}
                      style={{ '--i': i } as CSSProperties}
                      type="button"
                    >
                      <kbd>{i + 1}</kbd>
                      <SceneMon pokemon={choice.pokemon} zoom={2.2} />
                      {answer && <small>{choice.name}</small>}
                    </button>
                  ))}
                </div>
                <div className="lq-grades">
                  {answer && right && GRADES.map((g) => (
                    <button className={classNames('lq-grade', { on: g === suggested })} key={g} onClick={() => grade(g)} type="button">
                      <kbd>{g}</kbd>{lt(`quiz.grade.${g}`)}<small>{span(intervalMs(card, g, Date.now()), lt)}</small>
                    </button>
                  ))}
                  {answer && !right && (
                    <button className="lq-grade on" onClick={() => grade(1)} type="button">
                      {lt('quiz.grade.1')}<small>{span(intervalMs(card, 1, Date.now()), lt)}</small>
                    </button>
                  )}
                  {!answer && <span className="lq-prompt">{lt('quiz.prompt')}</span>}
                </div>
              </section>
            )
            : (
              <section className="lq-done">
                <h2>{lt('quiz.doneTitle')}</h2>
                <p>{Number.isFinite(nextDue) ? lt('quiz.next', { when: span(nextDue - Date.now(), lt) }) : lt('quiz.start')}</p>
                {unseen.length > 0 && (
                  <button className="lq-grade on" onClick={() => setToday({ ...today, extra: today.extra + 10 })} type="button">{lt('quiz.more')}</button>
                )}
              </section>
            )}

          <footer className="lq-gens">
            {gens.map(([generation, row]) => (
              <div className="lq-gen" key={generation}>
                <span>{lt('mosaic.gen', { n: generation })}</span>
                <i style={{ '--seen': row.seen / row.total, '--known': row.known / row.total } as CSSProperties} />
                <small>{row.known}/{row.total}</small>
              </div>
            ))}
            <label className="lq-per-day">
              {lt('quiz.perDay')}
              <input max={100} min={0} onChange={(e) => setPerDay(Math.max(0, Number(e.target.value) || 0))} onKeyDown={(e) => e.stopPropagation()} type="number" value={perDay} />
            </label>
          </footer>
        </div>
      )}
    </Scene>
  );
}
