import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES, ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { LabTip } from './LabTip';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { displayName } from '../../../library/PokemonName';
import { gameColor } from '../../../../utils/game-colors';
import { localizeBall, localizeOriginGame } from '../../../../i18n/names';
import { useCalm } from './lab-kit';
import { useLabText } from './lab-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { LabProps } from './lab-kit';

// what a tile's ground shows: how the mon stands, the game it came from, or its first type
type Tint = 'state' | 'origin' | 'type';
const TINTS: Tint[] = ['state', 'origin', 'type'];
// the replay: every caught mon lit in the order it was caught, over this long
const REPLAY_MS = 9000;

const tileState = (capture: Capture) => (capture.sealed ? 'sealed' : !capture.captured ? 'missing' : capture.status ?? 'caught');

// the dex mosaic: the whole dex as one wall, a generation to a band, every mon a tile, its sprite in colour once caught
// and a shadow while still missing, a sealed one on a gilt ground. The ground can show the game each came from or its
// type instead. The replay lights the wall up in the order you caught them, the day ticking along above; a tile pointed
// at shows its mon, pressed goes to it in the dex
export function DexMosaic ({ back, onClose, onFilter, onLocate }: LabProps) {
  const { captures } = useTrackerState();
  const { lt, locale } = useLabText();
  const calm = useCalm();
  const pageRef = useRef<HTMLDivElement>(null);
  const [tint, setTint] = useState<Tint>('state');
  const [size, setSize] = useState(1);
  // a run of the replay (its key restarts the tiles' animations), and when it started
  const [replay, setReplay] = useState<{ run: number; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const [hot, setHot] = useState<{ capture: Capture; x: number; y: number } | null>(null);

  const bands = useMemo(() => {
    const groups = new Map<number, Capture[]>();
    for (const capture of captures) {
      groups.set(capture.pokemon.generation, [...(groups.get(capture.pokemon.generation) ?? []), capture]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [captures]);

  // each caught mon's place in the order they were caught (undated ones last), for the replay's delays
  const order = useMemo(() => {
    const caught = captures.filter((capture) => capture.captured && capture.status !== 'unobtainable')
    .sort((a, b) => (a.catch_date ?? '9999').localeCompare(b.catch_date ?? '9999') || a.pokemon.id - b.pokemon.id);
    return { rank: new Map(caught.map((capture, i) => [capture.pokemon.id, i])), list: caught };
  }, [captures]);

  // the day the replay has reached
  useEffect(() => {
    if (!replay) {
      return undefined;
    }
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - replay.at;
      setNow(elapsed);
      if (elapsed < REPLAY_MS + 600) {
        frame = requestAnimationFrame(tick);
      } else {
        setReplay(null);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [replay]);

  // the games your caught mons came from, most first, for the origin tint's key
  const games = useMemo(() => {
    const counts = new Map<string, number>();
    for (const capture of order.list) {
      if (capture.origin_game) {
        counts.set(capture.origin_game, (counts.get(capture.origin_game) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [order]);

  useScrollBack(pageRef, back, true);

  const step = REPLAY_MS / Math.max(1, order.list.length);
  const reachedIndex = replay ? Math.min(order.list.length - 1, Math.floor(now / step)) : -1;
  const reached = reachedIndex >= 0 ? order.list[reachedIndex] : null;

  const show = (capture: Capture) => (e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHot({ capture, x: rect.right, y: rect.top + rect.height / 2 });
  };
  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const tileStyle = (capture: Capture): CSSProperties => {
    const style: Record<string, string | number> = {};
    if (tint === 'origin' && capture.captured && capture.origin_game) {
      style['--ground'] = gameColor(capture.origin_game);
    } else if (tint === 'type') {
      style['--ground'] = `var(--type-${capture.pokemon.types?.[0] ?? 'normal'})`;
    }
    const rank = order.rank.get(capture.pokemon.id);
    if (replay && rank !== undefined) {
      style['--at'] = `${Math.round(rank * step)}ms`;
    }
    return style as CSSProperties;
  };

  const total = captures.length;
  const done = order.list.length;
  const sealed = captures.filter((capture) => capture.sealed).length;

  return (
    <Scene hint={lt('mosaic.hint')} name="lab-mosaic" onClose={onClose} quiet={Boolean(back)} title={lt('mosaic.title')}>
      {({ scale }) => (
        <div className="lm-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="lm-head">
            <div className="lm-figures">
              <span><b>{done}</b>/{total}<small>{lt('mosaic.caught')}</small></span>
              <span><b>{sealed}</b><small>{lt('mosaic.sealed')}</small></span>
              {replay && reached && <span className="lm-ticker"><b>{reached.catch_date ? dateLabel(reached.catch_date) : '—'}</b><small>{lt('mosaic.nth', { n: reachedIndex + 1 })}</small></span>}
            </div>
            <div className="lm-controls">
              <div className="lm-segment" role="group">
                {TINTS.map((option) => (
                  <button aria-pressed={tint === option} className={classNames({ on: tint === option })} key={option} onClick={() => setTint(option)} type="button">
                    {lt(`mosaic.tint.${option}`)}
                  </button>
                ))}
              </div>
              <input aria-label={lt('mosaic.size')} max={1.8} min={0.6} onChange={(e) => setSize(Number(e.target.value))} step={0.1} type="range" value={size} />
              <button className="lm-replay" disabled={calm || done === 0} onClick={() => setReplay({ run: (replay?.run ?? 0) + 1, at: performance.now() })} type="button">
                <FontAwesomeIcon icon={faPlay} /> {lt('mosaic.replay')}
              </button>
            </div>
          </header>
          {tint === 'origin' && (
            <div className="lm-key">
              {games.map(([game, n]) => (
                <button
                  key={game}
                  onClick={() => onFilter({ view: 'all', facets: { origin_game: [game] } }, { scroll: pageRef.current?.closest('.scene-body')?.scrollTop ?? 0 })}
                  style={{ '--ground': gameColor(game) } as CSSProperties}
                  title={lt('mosaic.keyPress')}
                  type="button"
                >
                  <i />{localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game)}<b>{n}</b>
                </button>
              ))}
            </div>
          )}
          <div className={classNames('lm-wall', `tint-${tint}`, { replaying: Boolean(replay) })} key={replay?.run ?? 0} style={{ '--size': size } as CSSProperties}>
            {bands.map(([generation, mons]) => {
              const have = mons.filter((capture) => capture.captured && capture.status !== 'unobtainable').length;
              return (
                <section className="lm-band" key={generation}>
                  <h3>
                    <span>{lt('mosaic.gen', { n: generation })}</span>
                    <i style={{ '--f': have / mons.length } as CSSProperties} />
                    <small>{have}/{mons.length}</small>
                  </h3>
                  <div className="lm-tiles">
                    {mons.map((capture) => (
                      <button
                        className={classNames('lm-tile', `st-${tileState(capture)}`, { hot: hot?.capture === capture })}
                        key={capture.pokemon.id}
                        onBlur={() => setHot(null)}
                        onClick={() => onLocate(capture.pokemon.id)}
                        onFocus={show(capture)}
                        onPointerEnter={show(capture)}
                        onPointerLeave={() => setHot(null)}
                        style={tileStyle(capture)}
                        type="button"
                      >
                        <SceneMon pokemon={capture.pokemon} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{displayName(hot.capture.pokemon.name, hot.capture.pokemon.name_ja, locale)}</strong>
              <small>{lt(`mosaic.state.${tileState(hot.capture)}`)}</small>
              {hot.capture.captured && (
                <small>
                  {[
                    hot.capture.catch_date && dateLabel(hot.capture.catch_date),
                    hot.capture.origin_game && localizeOriginGame(locale, hot.capture.origin_game, ORIGIN_GAME_NAMES.get(hot.capture.origin_game) ?? hot.capture.origin_game),
                    hot.capture.ball && hot.capture.ball !== 'unknown' && localizeBall(locale, hot.capture.ball, BALL_NAMES.get(hot.capture.ball) ?? hot.capture.ball),
                  ].filter(Boolean).join(' · ')}
                </small>
              )}
              <em>{lt('mosaic.press')}</em>
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
