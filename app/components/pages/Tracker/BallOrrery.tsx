import classNames from 'classnames';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES } from '../../../utils/capture-fields';
import { Scene, SceneMon, placeBeside, sceneScroll, useScrollBack } from './Scene';
import { localizeBall } from '../../../i18n/names';
import { useContentWidth } from '../../../hooks/use-content-width';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { SceneView } from './Scene';
import type { TrackerFilters } from './filters';

// the rings, inside out: how far from the middle (unscaled px), how many balls each takes (the most used innermost),
// and how long a turn takes there, the outer ones slower
const RINGS = [
  { r: 170, n: 4, period: 90 },
  { r: 300, n: 6, period: 130 },
  { r: 430, n: 8, period: 180 },
  { r: 560, n: Infinity, period: 240 },
];
// the stage as laid out, and the room either side of the outer ring it keeps in a narrower one
const STAGE_H = 620;
const SIDE_ROOM = 70;
// a ball's sprite drawn at whole multiples of its 32px, by how many mons it holds
const SIZES: [number, number][] = [[30, 96], [8, 64], [0, 32]];
// the specks round a ball: how far out the first ring of them sits, the step out to the next, and how close they pack
const SPECK_GAP = 7;
const SPECK_STEP = 6;
const SPECK_PITCH = 6.5;
const SPECK_R = 2.3;
const TIP_GAP = 18;
const TIP_MONS = 31;

interface Body {
  ball: string;
  mons: Capture[];
  r: number;
  angle: number;
  period: number;
  size: number;
}

interface Speck {
  x: number;
  y: number;
  type: string;
}

// a ball's mons as specks in rings round it, each in its first type's colour
function specksFor (body: Body): { specks: Speck[]; box: number } {
  const specks: Speck[] = [];
  let ring = 0;
  let placed = 0;
  let radius = body.size / 2 + SPECK_GAP;
  while (placed < body.mons.length) {
    radius = body.size / 2 + SPECK_GAP + ring * SPECK_STEP;
    const fits = Math.max(6, Math.floor((2 * Math.PI * radius) / SPECK_PITCH));
    const here = Math.min(fits, body.mons.length - placed);
    for (let k = 0; k < here; k++) {
      const a = (2 * Math.PI * k) / here - Math.PI / 2 + ring * 0.35;
      specks.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius, type: body.mons[placed + k].pokemon.types?.[0] ?? 'normal' });
    }
    placed += here;
    ring++;
  }
  return { specks, box: Math.ceil(2 * (radius + SPECK_R + 2)) };
}

// how the orrery was left for the dex, to come back to: how far down it was, and how far its orbits had gone (the
// time on their one clock, which stood still while a ball was pointed at)
export interface OrreryView extends SceneView {
  orbit: number;
}

interface Props {
  // come back to from the dex (index.tsx's layer): opened quietly, as it was left, each ball where it was
  back: OrreryView | null;
  onClose: () => void;
  // a ball pressed: the dex filtered to the mons in it as the scene closes, with how it was left
  onFilter: (filters: TrackerFilters, view: OrreryView) => void;
}

// the ball orrery (B): your sealed mons' balls as a little solar system on a plane leaned back from you,
// each a body sized by how many mons it holds, the most used on the inner rings, every one of its mons a speck round
// it in its first type's colour. They circle slowly (stopped while one's pointed at, and in still mode), each turned
// to face you; pointed at or focused, a card shows its mons, and pressed it filters the dex to them. Escape in the dex
// comes back here, as Journeys does
export function BallOrrery ({ back, onClose, onFilter }: Props) {
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const width = useContentWidth(stageRef);
  const [hot, setHot] = useState<{ ball: string; x: number; y: number } | null>(null);

  const sealed = useMemo(() => captures.filter((capture) => capture.sealed && capture.ball && capture.ball !== 'unknown'), [captures]);
  const bodies = useMemo(() => {
    const groups = new Map<string, Capture[]>();
    for (const capture of sealed) {
      groups.set(capture.ball!, [...(groups.get(capture.ball!) ?? []), capture]);
    }
    const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const placed: Body[] = [];
    let next = 0;
    RINGS.forEach((ring, k) => {
      const take = ordered.slice(next, next + ring.n);
      next += take.length;
      take.forEach(([ball, mons], j) => placed.push({
        ball,
        mons,
        r: ring.r,
        period: ring.period,
        // spread round the ring, each ring set off from the last so no two line up
        angle: Math.round((360 * j) / take.length + k * 41),
        size: SIZES.find(([least]) => mons.length >= least)![1],
      }));
    });
    return placed;
  }, [sealed]);

  // the whole system fitted to a narrower window, the outer ring kept clear of its sides
  const outer = bodies.reduce((most, body) => Math.max(most, body.r), RINGS[0].r);
  const fit = width > 0 ? Math.min(1, width / (2 * (outer + SIDE_ROOM))) : 1;

  // come back to: as far down as it was left, once the system's drawn
  useScrollBack(stageRef, back, width > 0);

  const ballName = (ball: string) => localizeBall(locale, ball, BALL_NAMES.get(ball) ?? ball);
  // a ball pressed, with how far round the orbits had gone, every arm and body turning on the one clock: an arm's time,
  // plus where they'd got to when the orrery was last come back to (its delay, set back by that much)
  const press = (ball: string) => {
    const turn = stageRef.current?.querySelector('.orb-arm')?.getAnimations()[0];
    const orbit = turn ? Number(turn.currentTime ?? 0) - (turn.effect?.getTiming().delay ?? 0) : 0;
    onFilter({ view: 'all', facets: { ball: [ball] } }, { scroll: sceneScroll(stageRef.current), orbit });
  };
  // the card beside the ball's specks rather than on them; every orbit holds while one's pointed at, so it stays put
  const show = (ball: string) => (e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHot({ ball, x: rect.right, y: rect.top + rect.height / 2 });
  };

  useLayoutEffect(() => {
    if (tipRef.current && hot) {
      placeBeside(tipRef.current, hot.x, hot.y, TIP_GAP);
    }
  }, [hot]);

  const hotBody = hot ? bodies.find((body) => body.ball === hot.ball) : undefined;

  return (
    <Scene hint={t('orrery.hint')} name="orrery" onClose={onClose} quiet={Boolean(back)} title={t('orrery.title')}>
      {({ scale }) => (
        <>
          <div className="orb-page" style={{ zoom: scale }}>
            <div
              className="orb-stage"
              data-hot={hot ? true : undefined}
              ref={stageRef}
              style={{ height: STAGE_H * fit, '--orb-at': back && `${-back.orbit}ms` } as CSSProperties}
            >
              {width > 0 && (
                <div className="orb-world" style={{ zoom: fit }}>
                  <div className="orb-plane">
                    {RINGS.filter((ring) => bodies.some((body) => body.r === ring.r)).map((ring) => (
                      <span className="orb-ring" key={ring.r} style={{ '--r': `${ring.r}px` } as CSSProperties} />
                    ))}
                    <span className="orb-sun">
                      <b>{sealed.length}</b>
                      <small>{t('orrery.sealed')}</small>
                    </span>
                    {bodies.map((body) => {
                      const { specks, box } = specksFor(body);
                      return (
                        <span
                          className="orb-arm"
                          key={body.ball}
                          style={{ '--angle': `${body.angle}deg`, '--r': `${body.r}px`, '--period': `${body.period}s`, '--box': `${box}px` } as CSSProperties}
                        >
                          <button
                            aria-label={`${ballName(body.ball)} ${t('orrery.count', { n: body.mons.length })}`}
                            className={classNames('orb-body', { hot: hot?.ball === body.ball })}
                            onBlur={() => setHot(null)}
                            onClick={() => press(body.ball)}
                            onFocus={show(body.ball)}
                            onPointerEnter={show(body.ball)}
                            onPointerLeave={() => setHot(null)}
                            type="button"
                          >
                            <svg aria-hidden="true" className="orb-specks" height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} width={box}>
                              {specks.map((speck, k) => (
                                <circle cx={speck.x.toFixed(1)} cy={speck.y.toFixed(1)} key={k} r={SPECK_R} style={{ fill: `var(--type-${speck.type})` }} />
                              ))}
                            </svg>
                            <img alt="" className="orb-ball" height={body.size} src={`/balls/${body.ball}.png`} width={body.size} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <p className="orb-note">{t('orrery.note')}</p>
          </div>
          {hot && hotBody && (
            <div className="at-tip-layer" style={{ zoom: scale }}>
              <div className="at-tip orb-tip" ref={tipRef} role="status">
                <div className="at-tip-mon">
                  <img alt="" className="orb-tip-ball" height={32} src={`/balls/${hotBody.ball}.png`} width={32} />
                  <span>
                    <strong>{ballName(hotBody.ball)}</strong>
                    <small>{t('orrery.count', { n: hotBody.mons.length })}</small>
                  </span>
                </div>
                <span className="orb-tip-mons">
                  {hotBody.mons.slice(0, TIP_MONS).map((capture) => <SceneMon key={capture.pokemon.id} pokemon={capture.pokemon} />)}
                  {hotBody.mons.length > TIP_MONS && <span className="orb-tip-more">+{hotBody.mons.length - TIP_MONS}</span>}
                </span>
                <em>{t('orrery.press')}</em>
              </div>
            </div>
          )}
        </>
      )}
    </Scene>
  );
}
