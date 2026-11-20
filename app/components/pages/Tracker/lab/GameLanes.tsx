import { useCallback, useMemo, useRef, useState } from 'react';

import { LabTip } from './LabTip';
import { ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { displayName } from '../../../library/PokemonName';
import { gameColor } from '../../../../utils/game-colors';
import { localizeOriginGame } from '../../../../i18n/names';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useLabText } from './lab-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { LabProps } from './lab-kit';

const DAY_MS = 86_400_000;
// the plot, unscaled: the names' column, a lane's height, a dot's radius and the step a same-day dot stacks up by
const NAMES_W = 200;
const PLOT_W = 1040;
const LANE_H = 46;
const DOT_R = 4;
const STACK = 7;
const AXIS_H = 28;

interface Lane {
  game: string;
  mons: Capture[];
  first: number;
  last: number;
}

interface Dot {
  capture: Capture;
  x: number;
  y: number;
  lane: number;
}

const dayOf = (capture: Capture) => Date.parse(`${capture.catch_date}T00:00:00`);

// the game lanes: a lane for every game your mons came from, in the order you first caught in each, so the lanes step
// down like the run of your playthroughs; along each, its mons as dots on the days you caught them (a busy day stacked
// up), over the span from its first catch to its last. Pointed at, a dot shows its mon, pressed goes to it; drag across
// the plot to take a stretch of days, and its mons go to the review together
export function GameLanes ({ back, onClose, onLocate, onReview }: LabProps) {
  const { captures } = useTrackerState();
  const { saves } = useDexContext();
  const { lt, locale } = useLabText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<{ dot: Dot; x: number; y: number } | null>(null);
  const [brush, setBrush] = useState<{ from: number; to: number; dragging: boolean } | null>(null);

  const { lanes, start, end } = useMemo(() => {
    const groups = new Map<string, Capture[]>();
    for (const capture of captures) {
      if (capture.captured && capture.status !== 'unobtainable' && capture.catch_date && capture.origin_game) {
        groups.set(capture.origin_game, [...(groups.get(capture.origin_game) ?? []), capture]);
      }
    }
    const list: Lane[] = [...groups.entries()].map(([game, mons]) => {
      const sorted = [...mons].sort((a, b) => dayOf(a) - dayOf(b));
      return { game, mons: sorted, first: dayOf(sorted[0]), last: dayOf(sorted[sorted.length - 1]) };
    }).sort((a, b) => a.first - b.first);
    const first = Math.min(...list.map((lane) => lane.first));
    const last = Math.max(...list.map((lane) => lane.last));
    // a fortnight's margin each side, so the first and last dots aren't on the edges
    return { lanes: list, start: first - 14 * DAY_MS, end: last + 14 * DAY_MS };
  }, [captures]);

  const xOf = useCallback((ms: number) => ((ms - start) / Math.max(DAY_MS, end - start)) * PLOT_W, [start, end]);
  const msOf = (x: number) => start + (x / PLOT_W) * (end - start);

  const dots = useMemo(() => lanes.flatMap((lane, l) => {
    const perDay = new Map<number, number>();
    return lane.mons.map((capture): Dot => {
      const day = dayOf(capture);
      const k = perDay.get(day) ?? 0;
      perDay.set(day, k + 1);
      // stacked up from the lane's middle, alternating above and below
      const offset = k === 0 ? 0 : Math.ceil(k / 2) * STACK * (k % 2 ? -1 : 1);
      return { capture, lane: l, x: xOf(day), y: l * LANE_H + LANE_H / 2 + Math.max(-LANE_H / 2 + DOT_R, Math.min(LANE_H / 2 - DOT_R, offset)) };
    });
  }), [lanes, xOf]);

  // the axis: a tick at each month's start, its label where there's room (every month, or every quarter)
  const months = useMemo(() => {
    const ticks: { x: number; label: string; year: boolean }[] = [];
    if (lanes.length === 0) {
      return ticks;
    }
    const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
    const span = (end - start) / (30 * DAY_MS);
    const every = span > 30 ? 3 : 1;
    const d = new Date(start);
    for (let m = new Date(d.getFullYear(), d.getMonth() + 1, 1); m.getTime() < end; m = new Date(m.getFullYear(), m.getMonth() + every, 1)) {
      const year = m.getMonth() < every;
      ticks.push({
        x: xOf(m.getTime()),
        year,
        label: year ? String(m.getFullYear()) : new Intl.DateTimeFormat(tag, { month: 'short' }).format(m),
      });
    }
    return ticks;
  }, [lanes, locale, start, end, xOf]);

  useScrollBack(pageRef, back, true);

  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (ms: number) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(ms));
  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);
  const mine = (game: string) => saves.filter((save) => save.game === game);

  // the plot's x under a pointer, in its own (unzoomed) units
  const plotX = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(PLOT_W, ((e.clientX - rect.left) / rect.width) * PLOT_W));
  };
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.lgl-dot')) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const x = plotX(e);
    setBrush({ from: x, to: x, dragging: true });
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (brush?.dragging) {
      setBrush({ ...brush, to: plotX(e) });
    }
  };
  const onUp = () => {
    if (brush?.dragging) {
      setBrush(Math.abs(brush.to - brush.from) < 4 ? null : { ...brush, dragging: false });
    }
  };

  const picked = brush ? dots.filter((dot) => dot.x >= Math.min(brush.from, brush.to) && dot.x <= Math.max(brush.from, brush.to)).map((dot) => dot.capture) : [];
  const pickedSorted = [...picked].sort((a, b) => dayOf(a) - dayOf(b));
  const plotH = lanes.length * LANE_H;

  return (
    <Scene hint={lt('lanes.hint')} name="lab-lanes" onClose={onClose} quiet={Boolean(back)} title={lt('lanes.title')}>
      {({ scale }) => (
        <div className="lgl-page" ref={pageRef} style={{ zoom: scale }}>
          {lanes.length === 0 && <p className="lgl-empty">{lt('lanes.empty')}</p>}
          {lanes.length > 0 && (
            <div className="lgl-chart">
              <div className="lgl-names" style={{ width: NAMES_W, paddingTop: AXIS_H }}>
                {lanes.map((lane, l) => (
                  <div className="lgl-name" key={lane.game} style={{ height: LANE_H, '--game': gameColor(lane.game), '--l': l } as CSSProperties}>
                    <i />
                    <span>
                      <strong>{gameName(lane.game)}</strong>
                      <small>
                        {lt('lanes.count', { n: lane.mons.length })}
                        {mine(lane.game).length > 0 && ` · ${mine(lane.game).map((save) => save.ot).join('、')}`}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              <svg
                className="lgl-plot"
                height={plotH + AXIS_H}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                viewBox={`0 ${-AXIS_H} ${PLOT_W} ${plotH + AXIS_H}`}
                width={PLOT_W}
              >
                {months.map((tick) => (
                  <g className={tick.year ? 'lgl-tick year' : 'lgl-tick'} key={tick.x}>
                    <line x1={tick.x} x2={tick.x} y1={-6} y2={plotH} />
                    <text x={tick.x + 4} y={-10}>{tick.label}</text>
                  </g>
                ))}
                {lanes.map((lane, l) => (
                  <g key={lane.game} style={{ '--game': gameColor(lane.game), '--l': l } as CSSProperties}>
                    <rect className="lgl-lane" height={LANE_H} width={PLOT_W} x={0} y={l * LANE_H} />
                    <rect className="lgl-span" height={10} rx={5} width={Math.max(10, xOf(lane.last) - xOf(lane.first) + 10)} x={xOf(lane.first) - 5} y={l * LANE_H + LANE_H / 2 - 5} />
                  </g>
                ))}
                {brush && (
                  <rect className="lgl-brush" height={plotH} width={Math.abs(brush.to - brush.from)} x={Math.min(brush.from, brush.to)} y={0} />
                )}
                {dots.map((dot) => (
                  <circle
                    className="lgl-dot"
                    cx={dot.x}
                    cy={dot.y}
                    key={dot.capture.pokemon.id}
                    onClick={() => onLocate(dot.capture.pokemon.id)}
                    onPointerEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHot({ dot, x: rect.right, y: rect.top + rect.height / 2 });
                    }}
                    onPointerLeave={() => setHot(null)}
                    r={hot?.dot === dot ? DOT_R * 1.8 : DOT_R}
                    style={{ '--game': gameColor(dot.capture.origin_game), '--x': dot.x / PLOT_W } as CSSProperties}
                  />
                ))}
              </svg>
            </div>
          )}

          {brush && !brush.dragging && (
            <div className="lgl-pick">
              <span>
                <b>{lt('lanes.count', { n: picked.length })}</b>
                {' '}{dateLabel(msOf(Math.min(brush.from, brush.to)))} – {dateLabel(msOf(Math.max(brush.from, brush.to)))}
              </span>
              <span className="lab-tip-mons">
                {pickedSorted.slice(0, 40).map((capture) => <SceneMon key={capture.pokemon.id} pokemon={capture.pokemon} />)}
                {picked.length > 40 && <small>+{picked.length - 40}</small>}
              </span>
              <span className="lgl-pick-acts">
                <button disabled={picked.length === 0} onClick={() => onReview(pickedSorted.map((capture) => capture.pokemon.id))} type="button">{lt('lanes.review')}</button>
                <button onClick={() => setBrush(null)} type="button">{lt('lanes.clear')}</button>
              </span>
            </div>
          )}
          <p className="lgl-note">{lt('lanes.note')}</p>

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <span className="lgl-tip-head">
                <SceneMon pokemon={hot.dot.capture.pokemon} />
                <strong>{displayName(hot.dot.capture.pokemon.name, hot.dot.capture.pokemon.name_ja, locale)}</strong>
              </span>
              <small>{gameName(lanes[hot.dot.lane].game)} · {dateLabel(dayOf(hot.dot.capture))}</small>
              <em>{lt('lanes.press')}</em>
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
