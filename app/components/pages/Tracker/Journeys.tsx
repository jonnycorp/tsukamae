import classNames from 'classnames';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { OriginMark } from './seal-faces';
import { Scene, SceneMon } from './Scene';
import { gameColor } from '../../../utils/game-colors';
import { generationKey, generationOf, journeys, locationOf, pieceOrder, placeColor } from './journeys-model';
import { localizeOriginGame } from '../../../i18n/names';
import { placeFromKey, placeLabel } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { GameSave } from '../../../types';
import type { JourneysData, Piece, Route, Split, Stop } from './journeys-model';
import type { TrackerFilters } from './filters';
import type { TranslationKey } from '../../../i18n/translations';

// the chart, unscaled: each stop's bar this wide, a gap between stops, every stop's row tall enough for its name, the
// chart as tall as its longest column needs (between its floor and its ceiling), and past the ceiling (the card
// scrolling) where a column of many stops would leave its strands less than STRAND_ROOM between them. The right
// side's stops spread out over the height, so each generation (or place) stands apart as a little collection of its
// own, up to so far apart
const BAR_W = 10;
const STOP_GAP = 6;
const SPREAD_GAP = 40;
const MIN_ROW = 22;
const ROW = 30;
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 680;
const STRAND_ROOM = 160;
// the names' room either side of the bars
const NAMES_SHARE = 0.27;
const NAMES_MIN = 120;
const NAMES_MAX = 220;
// the busiest strands listed beside the chart
const TOP_ROUTES = 10;
const TIP_GAP = 14;
// the most sprites a tooltip shows, in rows of PREVIEW_ROW, its last one given over to how many more there are
const PREVIEW = 32;
const PREVIEW_ROW = 8;
// keep in sync with .jr-chart[data-moving] in styles/journeys.scss: the strands' move from one split to the other
const MOVE_MS = 900;

// how Journeys was left for the dex, to come back to: its split, and how far down it was
export interface JourneysView {
  split: Split;
  scroll: number;
}

interface Props {
  // come back to from the dex (index.tsx's layer): opened quietly, as it was left
  back: JourneysView | null;
  onClose: () => void;
  // a strand, a game or a generation (or place) pressed: the dex filtered to it as the scene closes, with how Journeys
  // was left
  onFilter: (filters: TrackerFilters, view: JourneysView) => void;
}

// what the pointer (or the keyboard) is on: a strand, a game, or a stop on the right
type Hot = { kind: 'route'; from: string; to: string } | { kind: 'origin' | 'right'; key: string };

const hotKey = (hot: Hot) => (hot.kind === 'route' ? `route:${hot.from}>${hot.to}` : `${hot.kind}:${hot.key}`);

interface PlacedStop {
  stop: Stop;
  // the bar's top and height, and the middle of the stop's row, where its name sits
  y: number;
  h: number;
  mid: number;
}

interface RouteShape {
  route: Route;
  path: string;
  // the share that has been to Champions, along its top
  visitedPath: string | null;
}

interface Layout {
  height: number;
  names: number;
  origins: PlacedStop[];
  right: Record<Split, PlacedStop[]>;
  // each piece's band in either split, the same commands in both so it can move from one to the other
  pieces: { piece: Piece; d: Record<Split, string> }[];
  routes: Record<Split, RouteShape[]>;
  k: number;
}

const SPLITS: Split[] = ['generation', 'place'];

// a piece's end on the right in a split: its generation, or its place
const rightKey = (split: Split, piece: Piece) => (split === 'generation' ? generationKey(piece.generation) : piece.place);

// how far the counts can be scaled for a column's rows to fit the height, every row at least MIN_ROW tall: the small
// stops take MIN_ROW each, the rest share what's left in proportion
function scaleFor (stops: Stop[], height: number): number {
  const gaps = STOP_GAP * Math.max(0, stops.length - 1);
  let small = new Set<Stop>();
  let k = 0;
  for (let pass = 0; pass < 6; pass++) {
    const big = stops.filter((stop) => !small.has(stop)).reduce((sum, stop) => sum + stop.count, 0);
    k = big > 0 ? (height - gaps - small.size * MIN_ROW) / big : 0;
    const next = new Set(stops.filter((stop) => stop.count * k < MIN_ROW));
    if (next.size === small.size) {
      break;
    }
    small = next;
  }
  return Math.max(0, k);
}

// a band from one bar to the other, its two ends `t` thick, curving across the middle
const band = (xa: number, ya: number, xb: number, yb: number, t: number) => {
  const xm = (xa + xb) / 2;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(xa)},${f(ya)}C${f(xm)},${f(ya)} ${f(xm)},${f(yb)} ${f(xb)},${f(yb)}L${f(xb)},${f(yb + t)}C${f(xm)},${f(yb + t)} ${f(xm)},${f(ya + t)} ${f(xa)},${f(ya + t)}Z`;
};

// the height a column needs for all its strands together to be STRAND_ROOM thick, every row still MIN_ROW at least
function heightFor (stops: Stop[], total: number): number {
  const k = STRAND_ROOM / Math.max(1, total);
  return STOP_GAP * Math.max(0, stops.length - 1) + stops.reduce((sum, stop) => sum + Math.max(MIN_ROW, stop.count * k), 0);
}

function layOut (data: JourneysData, width: number, saves: GameSave[]): Layout {
  const names = Math.min(NAMES_MAX, Math.max(NAMES_MIN, width * NAMES_SHARE));
  const longest = Math.max(data.origins.length, data.generations.length, data.places.length);
  const height = Math.max(
    Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, longest * ROW)),
    ...[data.origins, data.generations, data.places].map((stops) => heightFor(stops, data.total)),
  );
  // one scale for every column, so a strand keeps its thickness as it moves
  const k = Math.min(scaleFor(data.origins, height), scaleFor(data.generations, height), scaleFor(data.places, height));

  // a column's rows from the top, the whole column centred in the height; spread, its stops share the room left over
  // between them, up to SPREAD_GAP apart
  const column = (stops: Stop[], spread = false): PlacedStop[] => {
    const rows = stops.map((stop) => Math.max(stop.count * k, MIN_ROW));
    const between = Math.max(0, stops.length - 1);
    const filled = rows.reduce((sum, row) => sum + row, 0);
    const gap = spread && between > 0 ? Math.min(SPREAD_GAP, Math.max(STOP_GAP, (height - filled) / between)) : STOP_GAP;
    let top = (height - filled - gap * between) / 2;
    return stops.map((stop, i) => {
      const h = stop.count * k;
      const placed = { stop, y: top + (rows[i] - h) / 2, h, mid: top + rows[i] / 2 };
      top += rows[i] + gap;
      return placed;
    });
  };
  const origins = column(data.origins);
  const right = { generation: column(data.generations, true), place: column(data.places, true) };

  const xa = names + BAR_W;
  const xb = width - names - BAR_W;
  const shapes = new Map(data.pieces.map((piece) => [piece.key, { piece, d: { generation: '', place: '' } }]));
  const routes = { generation: [] as RouteShape[], place: [] as RouteShape[] };
  for (const split of SPLITS) {
    // each piece stacked under the last at either end, in the split's order (pieceOrder), so a strand's pieces lie
    // together at both ends and the strands cross no more than they must
    const order = pieceOrder(split, saves);
    const left = new Map<string, number>();
    const into = new Map<string, number>();
    for (const placed of origins) {
      let y = placed.y;
      for (const piece of data.pieces.filter((entry) => entry.origin === placed.stop.key).sort(order.left)) {
        left.set(piece.key, y);
        y += piece.count * k;
      }
    }
    for (const placed of right[split]) {
      let y = placed.y;
      for (const piece of data.pieces.filter((entry) => rightKey(split, entry) === placed.stop.key).sort(order.right)) {
        into.set(piece.key, y);
        y += piece.count * k;
      }
    }
    for (const piece of data.pieces) {
      shapes.get(piece.key)!.d[split] = band(xa, left.get(piece.key)!, xb, into.get(piece.key)!, piece.count * k);
    }
    // a strand runs from its first piece's top at either end
    routes[split] = data.routes[split].map((route) => {
      const strand = data.pieces.filter((piece) => piece.origin === route.from && rightKey(split, piece) === route.to);
      const ya = Math.min(...strand.map((piece) => left.get(piece.key)!));
      const yb = Math.min(...strand.map((piece) => into.get(piece.key)!));
      return {
        route,
        path: band(xa, ya, xb, yb, route.count * k),
        visitedPath: route.visited > 0 ? band(xa, ya, xb, yb, route.visited * k) : null,
      };
    });
  }
  return { height, names, origins, right, pieces: [...shapes.values()], routes, k };
}

// journeys (J): the master set as strands from the game each mon was caught in to the generation it belongs to, games
// and generations alike newest at the top, each strand as thick as its mons and in its game's colour, so a
// generation's bar shows which games it came from; a gold top edge is the share that has been to Champions. The
// toggle splits the right side by where the mons are now instead (HOME, Champions, or out in one of your games),
// every strand moving across to it and turning into its place's colour. The busiest strands beside the chart; one
// hovered shows its mons' sprites, and a strand, a game, a generation or a place pressed filters the dex to it
export function Journeys ({ back, onClose, onFilter }: Props) {
  const { captures } = useTrackerState();
  const { saves } = useDexContext();
  const { still } = useThemeContext();
  const { t, locale } = useTranslation();
  const data = useMemo(() => journeys(captures, saves), [captures, saves]);
  const pageRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hot, setHot] = useState<Hot | null>(null);
  const [split, setSplit] = useState<Split>(back?.split ?? 'generation');
  // set while the strands move from one split to the other: what's drawn on them (the gold, where a press lands) waits
  // for them to settle
  const [moving, setMoving] = useState(false);
  const gradientId = useId();

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return undefined;
    }
    setWidth(Math.floor(chart.clientWidth));
    // the new width drawn on the next frame, not inside the observer's own delivery, where the chart's growth (and the
    // scrollbar it can bring) would be a change the observer has to report again before the frame can end
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(next));
    });
    observer.observe(chart);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // the move's end counted from the last switch, so switching back mid-move runs the whole way to the other side
  useEffect(() => {
    if (!moving) {
      return undefined;
    }
    const timer = window.setTimeout(() => setMoving(false), MOVE_MS);
    return () => window.clearTimeout(timer);
  }, [moving, split]);

  const switchTo = (next: Split) => {
    if (next === split) {
      return;
    }
    setHot(null);
    setMoving(!still);
    setSplit(next);
  };

  const layout = useMemo(() => (width > 0 && data.total > 0 ? layOut(data, width, saves) : null), [data, width, saves]);

  // come back to: as far down as it was left, once the chart has its height
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    const body = pageRef.current?.closest('.scene-body');
    if (back && layout && body && !scrolled.current) {
      scrolled.current = true;
      body.scrollTop = back.scroll;
    }
  }, [back, layout]);

  const originName = useCallback((key: string) => localizeOriginGame(locale, key, ORIGIN_GAME_NAMES.get(key) ?? key), [locale]);
  const rightName = useCallback((side: Split, key: string) => (side === 'generation'
    ? t('filter.gen', { n: generationOf(key) })
    : placeLabel(placeFromKey(key), saves, locale)), [saves, locale, t]);
  const rightColor = (side: Split, key: string, origin: string) => (side === 'generation' ? gameColor(origin) : placeColor(key, saves));
  // a generation's region, beside its number
  const regionName = (key: string) => t(`journeys.region.${generationOf(key)}` as TranslationKey);

  const rightFilter = (key: string): TrackerFilters['facets'] => (split === 'generation'
    ? { generation: [String(generationOf(key))] }
    : { location: [locationOf(key)] });
  const left = (): JourneysView => ({ split, scroll: pageRef.current?.closest('.scene-body')?.scrollTop ?? 0 });
  const pressRoute = (route: Route) => onFilter({ view: 'all', facets: { origin_game: [route.from], ...rightFilter(route.to) } }, left());
  const pressOrigin = (key: string) => onFilter({ view: 'all', facets: { origin_game: [key] } }, left());
  const pressRight = (key: string) => onFilter({ view: 'all', facets: rightFilter(key) }, left());

  // the tooltip by the pointer (or the name the keyboard is on), flipped to its left where the window ends. The point
  // is kept apart from what's hot, so following the pointer along one strand moves the tooltip alone, and the chart
  // re-renders only as the pointer passes from one thing to another
  const pointer = useRef({ x: 0, y: 0 });
  const placeTip = useCallback(() => {
    const tip = tipRef.current;
    if (!tip) {
      return;
    }
    const { x, y } = pointer.current;
    const zoom = tip.currentCSSZoom;
    const w = tip.offsetWidth * zoom;
    const h = tip.offsetHeight * zoom;
    const left = x + TIP_GAP + w <= window.innerWidth ? x + TIP_GAP : x - TIP_GAP - w;
    const top = Math.min(window.innerHeight - h - 8, Math.max(8, y - h / 2));
    tip.style.left = `${Math.max(8, left) / zoom}px`;
    tip.style.top = `${top / zoom}px`;
  }, []);
  useLayoutEffect(placeTip, [hot, placeTip]);
  const aim = (next: Hot, at: { x: number; y: number }) => {
    pointer.current = at;
    setHot((current) => (current && hotKey(current) === hotKey(next) ? current : next));
    placeTip();
  };

  const pointAt = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });
  const focusAt = (e: FocusEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: rect.right, y: rect.top + rect.height / 2 };
  };

  // what a hovered strand, game or right-hand stop lights: the strand and its two ends, or the stop with every strand
  // through it and the stops at their other ends; the rest dims
  const litPiece = (piece: Piece) => !hot || (hot.kind === 'route'
    ? hot.from === piece.origin && hot.to === rightKey(split, piece)
    : hot.kind === 'origin' ? hot.key === piece.origin : hot.key === rightKey(split, piece));
  const litRoute = (route: Route) => !hot || (hot.kind === 'route' ? hot.from === route.from && hot.to === route.to : hot.kind === 'origin' ? hot.key === route.from : hot.key === route.to);
  const litStops = useMemo(() => {
    if (!hot) {
      return null;
    }
    if (hot.kind === 'route') {
      return { origin: new Set([hot.from]), right: new Set([hot.to]) };
    }
    const linked = data.routes[split].filter((route) => (hot.kind === 'origin' ? route.from === hot.key : route.to === hot.key));
    return {
      origin: new Set(hot.kind === 'origin' ? [hot.key] : linked.map((route) => route.from)),
      right: new Set(hot.kind === 'right' ? [hot.key] : linked.map((route) => route.to)),
    };
  }, [hot, data.routes, split]);
  const litStop = (kind: 'origin' | 'right', key: string) => !litStops || litStops[kind].has(key);

  const top = useMemo(() => [...data.routes[split]].sort((a, b) => b.count - a.count).slice(0, TOP_ROUTES), [data.routes, split]);
  const topMax = top[0]?.count ?? 1;
  const routeKey = (route: Route) => `${route.from}>${route.to}`;
  // the gradient a piece is filled with: its game's colour into its place's in the place split, its game's throughout
  // in the generation split; one per game and place, its far end turning as the split does
  const pairs = useMemo(() => [...new Set(data.pieces.map((piece) => `${piece.origin}|${piece.place}`))], [data.pieces]);
  const pairId = (piece: Piece) => `${gradientId}-${pairs.indexOf(`${piece.origin}|${piece.place}`)}`;

  // how many a strand or a stop carries, and a look at them: their sprites in the dex's order, as many as PREVIEW
  // allows, the rest counted in the last one's place
  const mons = (stop: Stop) => {
    const shown = stop.mons.length > PREVIEW ? stop.mons.slice(0, PREVIEW - 1) : stop.mons;
    return (
      <>
        <strong>{t('journeys.mons', { n: stop.count })}</strong>
        <span className="jr-tip-mons" style={{ '--cols': Math.min(PREVIEW_ROW, stop.mons.length) } as CSSProperties}>
          {shown.map((pokemon) => <SceneMon key={pokemon.id} pokemon={pokemon} />)}
          {shown.length < stop.mons.length && <span className="jr-tip-more">+{stop.mons.length - shown.length}</span>}
        </span>
      </>
    );
  };

  const tip = () => {
    if (!hot) {
      return null;
    }
    if (hot.kind === 'route') {
      const route = data.routes[split].find((entry) => entry.from === hot.from && entry.to === hot.to);
      if (!route) {
        return null;
      }
      return (
        <div className="jr-tip" ref={tipRef} role="status">
          <div className="jr-tip-route">
            <OriginMark game={route.from} />{originName(route.from)}<span className="jr-arrow">→</span>{rightName(split, route.to)}
          </div>
          {mons(route)}
          <em>{t('journeys.pressRoute')}{split === 'place' && locationOf(route.to) === 'game' ? ` ${t('journeys.anyGame')}` : ''}</em>
        </div>
      );
    }
    const stops = hot.kind === 'origin' ? data.origins : split === 'generation' ? data.generations : data.places;
    const stop = stops.find((entry) => entry.key === hot.key);
    if (!stop) {
      return null;
    }
    return (
      <div className="jr-tip" ref={tipRef} role="status">
        <div className="jr-tip-route">
          {hot.kind === 'origin' && <OriginMark game={stop.key} />}
          {hot.kind === 'origin' ? originName(stop.key) : rightName(split, stop.key)}
          {hot.kind === 'right' && split === 'generation' && <span className="jr-region">{regionName(stop.key)}</span>}
        </div>
        {mons(stop)}
        <em>{t('journeys.pressNode')}{hot.kind === 'right' && split === 'place' && stop.key.startsWith('game') ? ` ${t('journeys.anyGame')}` : ''}</em>
      </div>
    );
  };

  return (
    <Scene hint={t('journeys.hint')} name="journeys" onClose={onClose} quiet={Boolean(back)} title={t('journeys.title')}>
      {({ scale }) => (
        <>
          <div className="jr-page" ref={pageRef} style={{ zoom: scale }}>
            <section className="scene-card jr-card" style={{ '--i': 0 } as CSSProperties}>
              <h2><span>{t(split === 'generation' ? 'journeys.chartGeneration' : 'journeys.chartPlace')}</span></h2>
              <p className="jr-note">
                <span>{t('journeys.counting', { n: data.total })}</span>
                <span className="jr-legend"><span className="jr-legend-gold" />{t('journeys.legendVisited')}</span>
              </p>
              <div className="jr-columns">
                <span>{t('journeys.from')}</span>
                <span aria-label={t('journeys.split')} className="jr-split" role="group">
                  {SPLITS.map((side) => (
                    <button aria-pressed={split === side} className={classNames({ on: split === side })} key={side} onClick={() => switchTo(side)} type="button">
                      {t(side === 'generation' ? 'journeys.byGeneration' : 'journeys.byPlace')}
                    </button>
                  ))}
                </span>
              </div>
              <div
                className="jr-chart"
                data-hot={hot ? '' : undefined}
                data-moving={moving || undefined}
                data-split={split}
                ref={chartRef}
                style={{ height: layout?.height ?? (data.total > 0 ? MIN_HEIGHT : 'auto') }}
              >
                {data.total === 0 && <p className="jr-empty">{t('journeys.empty')}</p>}
                {layout && (
                  <>
                    <svg aria-hidden="true" className="jr-svg" height={layout.height} width={width}>
                      <defs>
                        {pairs.map((pair, i) => {
                          const [origin, place] = pair.split('|');
                          return (
                            <linearGradient gradientUnits="userSpaceOnUse" id={`${gradientId}-${i}`} key={pair} x1={layout.names} x2={width - layout.names} y1={0} y2={0}>
                              <stop className="jr-stop-color" offset="0" style={{ stopColor: gameColor(origin) }} />
                              <stop className="jr-stop-color" offset="1" style={{ stopColor: rightColor(split, place, origin) }} />
                            </linearGradient>
                          );
                        })}
                        <clipPath id={`${gradientId}-reveal`}>
                          <rect className="jr-reveal" height={layout.height} width={width} x={0} y={0} />
                        </clipPath>
                      </defs>
                      <g clipPath={`url(#${gradientId}-reveal)`}>
                        {layout.pieces.map(({ piece, d }) => (
                          <path
                            className={classNames('jr-piece', { dim: !litPiece(piece) })}
                            fill={`url(#${pairId(piece)})`}
                            key={piece.key}
                            style={{ d: `path('${d[split]}')` } as CSSProperties}
                          />
                        ))}
                        <g className="jr-marks">
                          {layout.routes[split].map(({ route, visitedPath }) => visitedPath && (
                            <path className={classNames('jr-gold', { dim: !litRoute(route) })} d={visitedPath} key={routeKey(route)} />
                          ))}
                        </g>
                        <g className="jr-hits">
                          {layout.routes[split].map(({ route, path }) => (
                            <path
                              className="jr-hit"
                              d={path}
                              key={routeKey(route)}
                              onClick={() => pressRoute(route)}
                              onPointerEnter={(e) => aim({ kind: 'route', from: route.from, to: route.to }, pointAt(e))}
                              onPointerLeave={() => setHot(null)}
                              onPointerMove={(e) => aim({ kind: 'route', from: route.from, to: route.to }, pointAt(e))}
                            />
                          ))}
                        </g>
                      </g>
                      {layout.origins.map((placed) => (
                        <rect className={classNames('jr-bar', { dim: !litStop('origin', placed.stop.key) })} height={Math.max(2, placed.h)} key={placed.stop.key} style={{ fill: gameColor(placed.stop.key) }} width={BAR_W} x={layout.names} y={placed.y} />
                      ))}
                      {/* a generation's bar in a quiet grey, as the strands into it carry the colours; a place's in its own */}
                      {SPLITS.map((side) => (
                        <g className={classNames('jr-side', { off: side !== split })} key={side}>
                          {layout.right[side].map((placed) => (
                            <rect
                              className={classNames('jr-bar', { 'jr-gen-bar': side === 'generation', dim: side === split && !litStop('right', placed.stop.key) })}
                              height={Math.max(2, placed.h)}
                              key={placed.stop.key}
                              style={side === 'generation' ? undefined : { fill: placeColor(placed.stop.key, saves) }}
                              width={BAR_W}
                              x={width - layout.names - BAR_W}
                              y={placed.y}
                            />
                          ))}
                        </g>
                      ))}
                    </svg>
                    {/* the names fade in as one, so each can still hide for the split it isn't */}
                    <div className="jr-labels">
                      {layout.origins.map((placed) => (
                        <button
                          className={classNames('jr-stop', 'from', { dim: !litStop('origin', placed.stop.key) })}
                          key={placed.stop.key}
                          onBlur={() => setHot(null)}
                          onClick={() => pressOrigin(placed.stop.key)}
                          onFocus={(e) => aim({ kind: 'origin', key: placed.stop.key }, focusAt(e))}
                          onPointerEnter={(e) => aim({ kind: 'origin', key: placed.stop.key }, pointAt(e))}
                          onPointerLeave={() => setHot(null)}
                          style={{ top: placed.mid, width: layout.names - 8 }}
                          type="button"
                        >
                          <span className="jr-stop-name">{originName(placed.stop.key)}</span>
                          <OriginMark game={placed.stop.key} />
                          <strong>{placed.stop.count}</strong>
                        </button>
                      ))}
                      {SPLITS.map((side) => layout.right[side].map((placed) => (
                        <button
                          aria-hidden={side !== split || undefined}
                          className={classNames('jr-stop', 'to', { off: side !== split, dim: side === split && !litStop('right', placed.stop.key) })}
                          key={`${side}-${placed.stop.key}`}
                          onBlur={() => setHot(null)}
                          onClick={() => pressRight(placed.stop.key)}
                          onFocus={(e) => aim({ kind: 'right', key: placed.stop.key }, focusAt(e))}
                          onPointerEnter={(e) => aim({ kind: 'right', key: placed.stop.key }, pointAt(e))}
                          onPointerLeave={() => setHot(null)}
                          style={{ top: placed.mid, left: width - layout.names + 8, width: layout.names - 8 }}
                          tabIndex={side === split ? undefined : -1}
                          type="button"
                        >
                          <strong>{placed.stop.count}</strong>
                          <span className="jr-stop-name">{rightName(side, placed.stop.key)}</span>
                          {side === 'generation' && <span className="jr-region">{regionName(placed.stop.key)}</span>}
                        </button>
                      )))}
                    </div>
                  </>
                )}
              </div>
            </section>
            <section className="scene-card jr-routes-card" style={{ '--i': 1 } as CSSProperties}>
              <h2><span>{t('journeys.routes')}</span></h2>
              {top.length === 0 && <p className="jr-empty">{t('journeys.empty')}</p>}
              <ol className="jr-routes">
                {top.map((route, i) => (
                  <li key={`${split}-${routeKey(route)}`} style={{ '--r': i } as CSSProperties}>
                    <button
                      className="jr-route-row"
                      onBlur={() => setHot(null)}
                      onClick={() => pressRoute(route)}
                      onFocus={(e) => aim({ kind: 'route', from: route.from, to: route.to }, focusAt(e))}
                      onPointerEnter={(e) => aim({ kind: 'route', from: route.from, to: route.to }, pointAt(e))}
                      onPointerLeave={() => setHot(null)}
                      type="button"
                    >
                      <span className="jr-route-ends">
                        <OriginMark game={route.from} />
                        <span className="jr-route-from">{originName(route.from)}</span>
                        <span className="jr-arrow">→</span>
                        <span className="jr-route-to">{rightName(split, route.to)}</span>
                      </span>
                      <span className="jr-route-bar">
                        <span style={{ width: `${(100 * route.count) / topMax}%`, background: `linear-gradient(90deg, ${gameColor(route.from)}, ${rightColor(split, route.to, route.from)})` }} />
                      </span>
                      <strong className="jr-route-count">{route.count}</strong>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          {hot && <div className="jr-tip-layer" style={{ zoom: scale }}>{tip()}</div>}
        </>
      )}
    </Scene>
  );
}
