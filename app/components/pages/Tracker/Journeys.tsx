import classNames from 'classnames';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { MYSTERY_GIFT, ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { OriginMark, originMarkKey } from './seal-faces';
import { Scene, SceneMon, placeBeside, sceneScroll, useScrollBack } from './Scene';
import { gameColor } from '../../../utils/game-colors';
import { generationKey, generationOf, groupGeneration, journeys, locationOf, originRank, pairNamed, pieceOrder, placeColor } from './journeys-model';
import { localizeOriginGame } from '../../../i18n/names';
import { placeFromKey, placeLabel } from '../../../utils/location-moves';
import { useContentWidth } from '../../../hooks/use-content-width';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { GameSave } from '../../../types';
import type { Grouping, JourneysData, Piece, Route, Split, Stop } from './journeys-model';
import type { SceneView } from './Scene';
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
// the lanes: the room above and below what each holds
const LANE_PAD = 8;
// the wheel: its ring's radius at most, the room beside it for the names and above and below it for theirs, how far
// apart two names on one side keep, the gaps between generations and between stops round it, and how deep a strand
// dips toward the middle, between neighbours and between two across the ring from each other
const WHEEL_R = 250;
const WHEEL_NAMES = 200;
const WHEEL_PAD = 44;
const NAME_GAP = 20;
const SLICE_GAP = 0.06;
const ARC_GAP = 0.012;
const DIP_NEAR = 0.25;
const DIP_FAR = 0.8;
const TURN = 2 * Math.PI;

// how Journeys was left for the dex, to come back to: its split, and how far down it was
export interface JourneysView extends SceneView {
  split: Split;
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
  // its bar as path commands: a block for each game it gathers (one for a game, a pair's two, a generation's games),
  // each that game's share of it
  bars: { game: string | null; d: string }[];
  // where its name sits: the point it's set against, and whether it ends there (the games' column, the wheel's left
  // half) or starts there
  label: { x: number; y: number; end: boolean };
}

interface RouteShape {
  route: Route;
  path: string;
  // the share that has been to Champions, along its top
  visitedPath: string | null;
}

interface Layout {
  height: number;
  // the names' room beside the columns, which the gradients run between, and a name's own
  names: number;
  labelW: number;
  origins: PlacedStop[];
  right: Record<Split, PlacedStop[]>;
  // each piece's band in either split, the same commands in every arrangement and split so it can move between them
  pieces: { piece: Piece; d: Record<Split, string> }[];
  routes: Record<Split, RouteShape[]>;
  // the lanes behind the strands, in the lanes arrangement
  lanes: { y: number; h: number }[];
}

// how the chart is drawn: two columns, the games newest first (flow); the games each across from the generation of
// the region they're set in, in its lane (lanes); or one ring, each generation a slice of it with its region's games
// and its own mons side by side (wheel)
type Arrangement = 'flow' | 'lanes' | 'wheel';

const SPLITS: Split[] = ['generation', 'place'];
const ARRANGEMENTS: Arrangement[] = ['flow', 'lanes', 'wheel'];
const GROUPINGS: Grouping[] = ['each', 'pairs', 'regions'];

// a piece's end on the right in a split: its generation, or its place
const rightKey = (split: Split, piece: Piece) => (split === 'generation' ? generationKey(piece.generation) : piece.place);

// how far the counts can be scaled for a column's rows (or the ring's arcs) to fit the room, every row at least
// `least`: the small stops take `least` each, the rest share what's left in proportion
function scaleFor (stops: Stop[], height: number, least = MIN_ROW, gap = STOP_GAP): number {
  const gaps = gap * Math.max(0, stops.length - 1);
  let small = new Set<Stop>();
  let k = 0;
  for (let pass = 0; pass < 6; pass++) {
    const big = stops.filter((stop) => !small.has(stop)).reduce((sum, stop) => sum + stop.count, 0);
    k = big > 0 ? (height - gaps - small.size * least) / big : 0;
    const next = new Set(stops.filter((stop) => stop.count * k < least));
    if (next.size === small.size) {
      break;
    }
    small = next;
  }
  return Math.max(0, k);
}

// a coordinate to the hundredth, as the paths carry them
const f = (n: number) => Math.round(n * 100) / 100;

// a band from one bar to the other, its two ends `t` thick, curving across the middle
const band = (xa: number, ya: number, xb: number, yb: number, t: number) => {
  const xm = (xa + xb) / 2;
  return `M${f(xa)},${f(ya)}C${f(xm)},${f(ya)} ${f(xm)},${f(yb)} ${f(xb)},${f(yb)}L${f(xb)},${f(yb + t)}C${f(xm)},${f(yb + t)} ${f(xm)},${f(ya + t)} ${f(xa)},${f(ya + t)}Z`;
};

// the height a column needs for all its strands together to be STRAND_ROOM thick, every row still MIN_ROW at least
function heightFor (stops: Stop[], total: number): number {
  const k = STRAND_ROOM / Math.max(1, total);
  return STOP_GAP * Math.max(0, stops.length - 1) + stops.reduce((sum, stop) => sum + Math.max(MIN_ROW, stop.count * k), 0);
}

// a name's box against its point, ending there or starting there
const labelAt = ({ label }: PlacedStop, w: number): CSSProperties => ({ top: label.y, left: label.end ? label.x - w : label.x, width: w });

// the lanes, and the wheel's slices: every generation with a game or a stop in it, newest first, then (null) the games
// of none, which can hand on a mon from anywhere: HOME, GO, a trade, a gift
function bandsOf (data: JourneysData): (number | null)[] {
  const gens = new Set(data.generations.map((stop) => generationOf(stop.key)));
  for (const stop of data.origins) {
    const gen = groupGeneration(stop.key);
    if (gen !== null) {
      gens.add(gen);
    }
  }
  const none = data.origins.some((stop) => groupGeneration(stop.key) === null);
  return [...[...gens].sort((a, b) => b - a), ...(none ? [null] : [])];
}

// a stop's bar from `at`, `per` along it for each of its mons: on the left a block for each game it gathers, on the
// right the one; never shorter than `least`, then all in its first game's colour
function barsFor (data: JourneysData, stop: Stop, side: 'origin' | 'right', at: number, per: number, draw: (from: number, length: number) => string, least: number) {
  const games: { game: string | null; count: number }[] = side === 'origin' ? data.members[stop.key] : [{ game: null, count: stop.count }];
  if (stop.count * per < least) {
    return [{ game: games[0].game, d: draw(at, least) }];
  }
  let from = at;
  return games.map(({ game, count }) => {
    const d = draw(from, count * per);
    from += count * per;
    return { game, d };
  });
}

// the two columns, games on the left and the split's stops on the right; laned, each game stands across from its own
// generation in a lane of it
function layColumns (data: JourneysData, width: number, saves: GameSave[], laned: boolean): Layout {
  const names = Math.min(NAMES_MAX, Math.max(NAMES_MIN, width * NAMES_SHARE));
  const longest = Math.max(data.origins.length, data.generations.length, data.places.length);
  let height = Math.max(
    Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, longest * ROW)),
    ...[data.origins, data.generations, data.places].map((stops) => heightFor(stops, data.total)),
  );
  // one scale for every column and both column arrangements, so a strand keeps its thickness as it moves
  const k = Math.min(scaleFor(data.origins, height), scaleFor(data.generations, height), scaleFor(data.places, height));
  const rowOf = (stop: Stop) => Math.max(stop.count * k, MIN_ROW);
  // a stop's row from `top`: its bar's top and height, centred in it, and its middle
  const rowAt = (stop: Stop, top: number) => ({ stop, y: top + (rowOf(stop) - stop.count * k) / 2, h: stop.count * k, mid: top + rowOf(stop) / 2 });
  type Row = ReturnType<typeof rowAt>;
  const filled = (stops: Stop[]) => stops.reduce((sum, stop) => sum + rowOf(stop), 0) + STOP_GAP * Math.max(0, stops.length - 1);

  // a column's rows from the top, the whole column centred in the height; spread, its stops share the room left over
  // between them, up to SPREAD_GAP apart
  const column = (stops: Stop[], spread = false): Row[] => {
    const rows = stops.reduce((sum, stop) => sum + rowOf(stop), 0);
    const between = Math.max(0, stops.length - 1);
    const gap = spread && between > 0 ? Math.min(SPREAD_GAP, Math.max(STOP_GAP, (height - rows) / between)) : STOP_GAP;
    let top = (height - rows - gap * between) / 2;
    return stops.map((stop) => {
      const row = rowAt(stop, top);
      top += rowOf(stop) + gap;
      return row;
    });
  };

  // the lanes: one for each generation, newest at the top, then one for the games of none, each as tall as the
  // taller of its games and its generation, both centred in it, so a strand that stays in its generation runs straight
  // across
  const lanes: { y: number; h: number }[] = [];
  let origins: Row[] = [];
  let generations: Row[] = [];
  if (laned) {
    let top = 0;
    for (const gen of bandsOf(data)) {
      const games = data.origins.filter((stop) => groupGeneration(stop.key) === gen);
      const own = data.generations.find((stop) => gen !== null && generationOf(stop.key) === gen);
      const h = Math.max(filled(games), own ? rowOf(own) : 0) + 2 * LANE_PAD;
      let y = top + (h - filled(games)) / 2;
      for (const stop of games) {
        origins.push(rowAt(stop, y));
        y += rowOf(stop) + STOP_GAP;
      }
      if (own) {
        generations.push(rowAt(own, top + (h - rowOf(own)) / 2));
      }
      lanes.push({ y: top, h });
      top += h;
    }
    height = Math.max(top, filled(data.places));
  } else {
    origins = column(data.origins);
    generations = column(data.generations, true);
  }
  const right = { generation: generations, place: column(data.places, true) };

  const xa = names + BAR_W;
  const xb = width - names - BAR_W;
  const shapes = new Map(data.pieces.map((piece) => [piece.key, { piece, d: { generation: '', place: '' } }]));
  const routes = { generation: [] as RouteShape[], place: [] as RouteShape[] };
  // the left column's stops as they run down it (in lanes, a generation's at a time)
  const groupAt = new Map(origins.map((row, i) => [row.stop.key, i]));
  for (const split of SPLITS) {
    // each piece stacked under the last at either end, in the split's order (pieceOrder), so a strand's pieces lie
    // together at both ends and the strands cross no more than they must
    const order = pieceOrder(split, saves, (group) => groupAt.get(group) ?? 0);
    const left = new Map<string, number>();
    const into = new Map<string, number>();
    for (const row of origins) {
      let y = row.y;
      for (const piece of data.pieces.filter((entry) => entry.group === row.stop.key).sort(order.left)) {
        left.set(piece.key, y);
        y += piece.count * k;
      }
    }
    for (const row of right[split]) {
      let y = row.y;
      for (const piece of data.pieces.filter((entry) => rightKey(split, entry) === row.stop.key).sort(order.right)) {
        into.set(piece.key, y);
        y += piece.count * k;
      }
    }
    for (const piece of data.pieces) {
      shapes.get(piece.key)!.d[split] = band(xa, left.get(piece.key)!, xb, into.get(piece.key)!, piece.count * k);
    }
    // a strand runs from its first piece's top at either end
    routes[split] = data.routes[split].map((route) => {
      const strand = data.pieces.filter((piece) => piece.group === route.from && rightKey(split, piece) === route.to);
      const ya = Math.min(...strand.map((piece) => left.get(piece.key)!));
      const yb = Math.min(...strand.map((piece) => into.get(piece.key)!));
      return {
        route,
        path: band(xa, ya, xb, yb, route.count * k),
        visitedPath: route.visited > 0 ? band(xa, ya, xb, yb, route.visited * k) : null,
      };
    });
  }

  const block = (x: number) => (from: number, length: number) => `M${f(x)},${f(from)}h${BAR_W}v${f(length)}h${-BAR_W}Z`;
  const placed = (rows: Row[], side: 'origin' | 'right'): PlacedStop[] => rows.map((row) => ({
    stop: row.stop,
    bars: barsFor(data, row.stop, side, row.y, k, block(side === 'origin' ? names : width - names - BAR_W), 2),
    label: side === 'origin' ? { x: names - 8, y: row.mid, end: true } : { x: width - names + 8, y: row.mid, end: false },
  }));
  return {
    height,
    names,
    labelW: names - 8,
    origins: placed(origins, 'origin'),
    right: { generation: placed(right.generation, 'right'), place: placed(right.place, 'right') },
    pieces: [...shapes.values()],
    routes,
    lanes,
  };
}

// the wheel, by generation alone: one ring, clockwise from the top, each generation a slice of it holding its games and
// then its own mons, so a strand that stays in its generation turns back at once while one from another reaches
// across; the games of none take the last slice. A strand's ends are as wide as in its arcs' scale, and it dips toward
// the middle the further round the ring it goes
function layWheel (data: JourneysData, width: number): Layout {
  const outer = Math.max(140, Math.min(WHEEL_R, width / 2 - WHEEL_NAMES));
  const r = outer - BAR_W;
  const cx = width / 2;
  const cy = WHEEL_PAD + outer;
  const point = (a: number, at: number) => `${f(cx + at * Math.cos(a))},${f(cy + at * Math.sin(a))}`;
  const slices = bandsOf(data).map((gen) => [
    ...data.origins.filter((stop) => groupGeneration(stop.key) === gen),
    ...data.generations.filter((stop) => gen !== null && generationOf(stop.key) === gen),
  ]).filter((slice) => slice.length > 0);
  const stops = slices.flat();
  const least = MIN_ROW / outer;
  const u = scaleFor(stops, TURN - SLICE_GAP * slices.length - ARC_GAP * (stops.length - slices.length), least, 0);
  const arcs = new Map<string, { a: number; mid: number }>();
  let theta = SLICE_GAP / 2;
  for (const slice of slices) {
    slice.forEach((stop, i) => {
      const row = Math.max(stop.count * u, least);
      arcs.set(stop.key, { a: theta + (row - stop.count * u) / 2, mid: theta + row / 2 });
      theta += row + (i < slice.length - 1 ? ARC_GAP : SLICE_GAP);
    });
  }
  // turned so the newest generation starts at the top, or, with games of none, so their slice (a few small stops)
  // stands at the left, where its names stack rather than run into each other across the top
  const none = bandsOf(data).at(-1) === null ? slices.at(-1)! : null;
  const turn = none
    ? Math.PI - (arcs.get(none[0].key)!.a + arcs.get(none.at(-1)!.key)!.a + none.at(-1)!.count * u) / 2
    : -Math.PI / 2;
  for (const arcAt of arcs.values()) {
    arcAt.a += turn;
    arcAt.mid += turn;
  }

  // how far on round the ring, clockwise, one point is from another
  const on = (from: number, to: number) => (((to - from) % TURN) + TURN) % TURN;
  // at each arc, the pieces whose other ends lie furthest on round the ring first, so no two cross by the ring
  const stack = (stop: Stop, own: Piece[], far: (piece: Piece) => string, ends: Map<string, number>) => {
    const { a, mid } = arcs.get(stop.key)!;
    const reach = (piece: Piece) => on(mid, arcs.get(far(piece))!.mid);
    let at = a;
    for (const piece of own.sort((p, q) => reach(q) - reach(p) || originRank(p.origin) - originRank(q.origin) || p.key.localeCompare(q.key))) {
      ends.set(piece.key, at);
      at += piece.count * u;
    }
  };
  const from = new Map<string, number>();
  const into = new Map<string, number>();
  for (const stop of data.origins) {
    stack(stop, data.pieces.filter((piece) => piece.group === stop.key), (piece) => generationKey(piece.generation), from);
  }
  for (const stop of data.generations) {
    stack(stop, data.pieces.filter((piece) => generationKey(piece.generation) === stop.key), (piece) => piece.group, into);
  }
  // a strand from `s` round to `t`, `w` wide at both ends: the same commands as a column's band, so one can move into
  // the other
  const ribbon = (s: number, t: number, w: number) => {
    const apart = Math.min(on(s, t), on(t, s)) / Math.PI;
    const dip = r * (1 - DIP_NEAR - (DIP_FAR - DIP_NEAR) * apart);
    return `M${point(s, r)}C${point(s, dip)} ${point(t + w, dip)} ${point(t + w, r)}L${point(t, r)}C${point(t, dip)} ${point(s + w, dip)} ${point(s + w, r)}Z`;
  };
  const routes = data.routes.generation.map((route) => {
    const strand = data.pieces.filter((piece) => piece.group === route.from && generationKey(piece.generation) === route.to);
    const s = Math.min(...strand.map((piece) => from.get(piece.key)!));
    const t = Math.min(...strand.map((piece) => into.get(piece.key)!));
    return { route, path: ribbon(s, t, route.count * u), visitedPath: route.visited > 0 ? ribbon(s, t, route.visited * u) : null };
  });

  const arc = (a: number, length: number) => {
    const big = length > Math.PI ? 1 : 0;
    return `M${point(a, outer)}A${outer},${outer} 0 ${big} 1 ${point(a + length, outer)}L${point(a + length, r)}A${r},${r} 0 ${big} 0 ${point(a, r)}Z`;
  };
  const placed = (stop: Stop, side: 'origin' | 'right'): PlacedStop => {
    const { a, mid } = arcs.get(stop.key)!;
    return {
      stop,
      bars: barsFor(data, stop, side, a, u, arc, 2 / outer),
      label: { x: cx + (outer + 8) * Math.cos(mid), y: cy + (outer + 8) * Math.sin(mid), end: Math.cos(mid) < 0 },
    };
  };
  const origins = data.origins.map((stop) => placed(stop, 'origin'));
  const generations = data.generations.map((stop) => placed(stop, 'right'));
  // names on one side of the ring and one half of it pushed apart where they'd meet, away from the middle
  for (const end of [false, true]) {
    for (const upper of [true, false]) {
      const side = [...origins, ...generations].map((stop) => stop.label).filter((label) => label.end === end && (label.y < cy) === upper);
      side.sort((a, b) => (upper ? b.y - a.y : a.y - b.y));
      side.forEach((label, i) => {
        if (i > 0) {
          label.y = upper ? Math.min(label.y, side[i - 1].y - NAME_GAP) : Math.max(label.y, side[i - 1].y + NAME_GAP);
        }
      });
    }
  }
  return {
    height: 2 * (outer + WHEEL_PAD),
    names: WHEEL_NAMES,
    labelW: WHEEL_NAMES - 10,
    origins,
    right: { generation: generations, place: [] },
    pieces: data.pieces.map((piece) => {
      const d = ribbon(from.get(piece.key)!, into.get(piece.key)!, piece.count * u);
      return { piece, d: { generation: d, place: d } };
    }),
    routes: { generation: routes, place: routes },
    lanes: [],
  };
}

// journeys (J): the master set as strands from the game each mon was caught in to the generation it belongs to, each
// strand as thick as its mons and in its game's colour, so a generation's bar shows which games it came from; a gold
// top edge is the share that has been to Champions. The toggle splits the right side by where the mons are now instead
// (HOME, Champions, or out in one of your games), every strand moving across to it and turning into its place's
// colour. The options above it: the chart as two columns (flow), with each game across from the generation of its
// region (lanes; a remake goes with its region, as the user goes by), or as one ring of generations (wheel); the games
// each on their own, sister versions as one, or a region's as one; and Mystery Gift's mons in or out, as they reach
// every generation from one stop. Each change moves the strands to their new places. The busiest strands beside the
// chart; one hovered shows its mons' sprites, and a strand, a game, a generation or a place pressed filters the dex
// to it
export function Journeys ({ back, onClose, onFilter }: Props) {
  const { captures } = useTrackerState();
  const { saves } = useDexContext();
  const { still } = useThemeContext();
  const { t, locale } = useTranslation();
  // how it's drawn, kept from one opening to the next
  const [arrangement, setArrangement] = useLocalStorage<Arrangement>('journeysArrangement', 'lanes');
  const [grouping, setGrouping] = useLocalStorage<Grouping>('journeysGrouping', 'pairs');
  const [gifts, setGifts] = useLocalStorage('journeysGifts', false);
  const data = useMemo(() => journeys(captures, saves, grouping, gifts), [captures, saves, grouping, gifts]);
  const pageRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const width = useContentWidth(chartRef);
  const [hot, setHot] = useState<Hot | null>(null);
  const [chosen, setChosen] = useState<Split>(back?.split ?? 'generation');
  // the wheel goes by generation alone
  const split: Split = arrangement === 'wheel' ? 'generation' : chosen;
  // set while the strands move, from one split to the other or to another arrangement: what's drawn on them (the gold,
  // where a press lands) waits for them to settle, and with another arrangement (reshaping) so do the bars, the names
  // and the lanes
  const [moving, setMoving] = useState(false);
  const [reshaping, setReshaping] = useState(false);
  const gradientId = useId();

  // the move's end counted from the last change, so changing back mid-move runs the whole way to the other side
  useEffect(() => {
    if (!moving) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setMoving(false);
      setReshaping(false);
    }, MOVE_MS);
    return () => window.clearTimeout(timer);
  }, [moving, split, arrangement, grouping, gifts]);

  // the split on show pressed again (the wheel shows generations whatever was chosen) moves nothing, and leaves the
  // choice the other arrangements remember as it was
  const switchTo = (next: Split) => {
    if (next === split) {
      return;
    }
    setHot(null);
    setMoving(!still);
    setChosen(next);
  };
  const reshape = (change: () => void) => {
    setHot(null);
    setMoving(!still);
    setReshaping(!still);
    change();
  };

  const layout = useMemo(() => {
    if (width <= 0 || data.total === 0) {
      return null;
    }
    return arrangement === 'wheel' ? layWheel(data, width) : layColumns(data, width, saves, arrangement === 'lanes');
  }, [data, width, saves, arrangement]);

  // come back to: as far down as it was left, once the chart has its height
  useScrollBack(pageRef, back, Boolean(layout));

  const originName = useCallback((key: string) => localizeOriginGame(locale, key, ORIGIN_GAME_NAMES.get(key) ?? key), [locale]);
  // a stop on the left: its game's name, a pair's short one, or its region's games
  const stopName = (key: string) => {
    const pair = pairNamed(key);
    if (pair) {
      return locale === 'ja' ? pair.ja : pair.en;
    }
    return key.startsWith('region:')
      ? t('journeys.regionGames', { region: t(`journeys.region.${groupGeneration(key)}` as TranslationKey) })
      : originName(key);
  };
  // the games a stop on the left gathers, and their marks, each once (a pair's two share theirs)
  const gamesOf = (key: string) => data.members[key]?.map((member) => member.game) ?? [key];
  const marks = (key: string) => [...new Map(gamesOf(key).map((game) => [originMarkKey(game), game])).values()]
  .map((game) => <OriginMark game={game} key={game} />);
  // where one colour stands for a stop on the left: its newest game's
  const stopColor = (key: string) => gameColor(gamesOf(key)[0]);
  const rightName = useCallback((side: Split, key: string) => (side === 'generation'
    ? t('filter.gen', { n: generationOf(key) })
    : placeLabel(placeFromKey(key), saves, locale)), [saves, locale, t]);
  const rightColor = (side: Split, key: string, origin: string) => (side === 'generation' ? stopColor(origin) : placeColor(key, saves));
  // a generation's region, beside its number
  const regionName = (key: string) => t(`journeys.region.${generationOf(key)}` as TranslationKey);

  const rightFilter = (key: string): TrackerFilters['facets'] => (split === 'generation'
    ? { generation: [String(generationOf(key))] }
    : { location: [locationOf(key)] });
  const left = (): JourneysView => ({ split: chosen, scroll: sceneScroll(pageRef.current) });
  const pressRoute = (route: Route) => onFilter({ view: 'all', facets: { origin_game: gamesOf(route.from), ...rightFilter(route.to) } }, left());
  const pressOrigin = (key: string) => onFilter({ view: 'all', facets: { origin_game: gamesOf(key) } }, left());
  const pressRight = (key: string) => onFilter({ view: 'all', facets: rightFilter(key) }, left());

  // the tooltip by the pointer (or the name the keyboard is on), flipped to its left where the window ends. The point
  // is kept apart from what's hot, so following the pointer along one strand moves the tooltip alone, and the chart
  // re-renders only as the pointer passes from one thing to another
  const pointer = useRef({ x: 0, y: 0 });
  const placeTip = useCallback(() => {
    if (tipRef.current) {
      placeBeside(tipRef.current, pointer.current.x, pointer.current.y, TIP_GAP);
    }
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
    ? hot.from === piece.group && hot.to === rightKey(split, piece)
    : hot.kind === 'origin' ? hot.key === piece.group : hot.key === rightKey(split, piece));
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
            {marks(route.from)}{stopName(route.from)}<span className="jr-arrow">→</span>{rightName(split, route.to)}
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
    // a stop that gathers games names each, with its count
    const games = hot.kind === 'origin' ? data.members[stop.key] ?? [] : [];
    return (
      <div className="jr-tip" ref={tipRef} role="status">
        <div className="jr-tip-route">
          {hot.kind === 'origin' && marks(stop.key)}
          {hot.kind === 'origin' ? stopName(stop.key) : rightName(split, stop.key)}
          {hot.kind === 'right' && split === 'generation' && <span className="jr-region">{regionName(stop.key)}</span>}
        </div>
        {games.length > 1 && <p className="jr-tip-games">{games.map(({ game, count }) => `${originName(game)} ${count}`).join(' · ')}</p>}
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
                {data.hidden > 0 && <span>{t('journeys.giftsHidden', { n: data.hidden })}</span>}
                <span className="jr-legend"><span className="jr-legend-gold" />{t('journeys.legendVisited')}</span>
              </p>
              {/* how it's drawn: the arrangement, how the games are gathered, and Mystery Gift's mons in or out */}
              <div className="jr-options">
                <span className="jr-option">
                  <span>{t('journeys.arrange')}</span>
                  <span aria-label={t('journeys.arrange')} className="jr-split" role="group">
                    {ARRANGEMENTS.map((value) => (
                      <button
                        aria-pressed={arrangement === value}
                        className={classNames({ on: arrangement === value })}
                        key={value}
                        onClick={() => arrangement !== value && reshape(() => setArrangement(value))}
                        type="button"
                      >
                        {t(`journeys.arrange.${value}` as TranslationKey)}
                      </button>
                    ))}
                  </span>
                </span>
                <span className="jr-option">
                  <span>{t('journeys.group')}</span>
                  <span aria-label={t('journeys.group')} className="jr-split" role="group">
                    {GROUPINGS.map((value) => (
                      <button
                        aria-pressed={grouping === value}
                        className={classNames({ on: grouping === value })}
                        key={value}
                        onClick={() => grouping !== value && reshape(() => setGrouping(value))}
                        type="button"
                      >
                        {t(`journeys.group.${value}` as TranslationKey)}
                      </button>
                    ))}
                  </span>
                </span>
                <span className="jr-split">
                  <button aria-pressed={gifts} className={classNames('jr-gifts', { on: gifts })} onClick={() => reshape(() => setGifts(!gifts))} type="button">
                    <OriginMark game={MYSTERY_GIFT} />
                    {originName(MYSTERY_GIFT)}
                  </button>
                </span>
              </div>
              <div className="jr-columns">
                <span>{t('journeys.from')}</span>
                <span aria-label={t('journeys.split')} className="jr-split" role="group">
                  {SPLITS.map((side) => (
                    <button
                      aria-pressed={split === side}
                      className={classNames({ on: split === side })}
                      disabled={arrangement === 'wheel' && side === 'place'}
                      key={side}
                      onClick={() => switchTo(side)}
                      title={arrangement === 'wheel' && side === 'place' ? t('journeys.wheelSplit') : undefined}
                      type="button"
                    >
                      {t(side === 'generation' ? 'journeys.byGeneration' : 'journeys.byPlace')}
                    </button>
                  ))}
                </span>
              </div>
              <div
                className="jr-chart"
                data-hot={hot ? '' : undefined}
                data-moving={moving || undefined}
                data-reshaping={reshaping || undefined}
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
                      {/* the lanes, every other one washed, so a game reads across to its own generation */}
                      <g className="jr-lanes">
                        {layout.lanes.map((lane, i) => (
                          <rect className={classNames('jr-lane', { wash: i % 2 === 0 })} height={lane.h} key={i} width={width} x={0} y={lane.y} />
                        ))}
                      </g>
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
                            <path className={classNames('jr-gold', { dim: !litRoute(route) })} d={visitedPath} key={route.key} />
                          ))}
                        </g>
                        <g className="jr-hits">
                          {layout.routes[split].map(({ route, path }) => (
                            <path
                              className="jr-hit"
                              d={path}
                              key={route.key}
                              onClick={() => pressRoute(route)}
                              onPointerEnter={(e) => aim({ kind: 'route', from: route.from, to: route.to }, pointAt(e))}
                              onPointerLeave={() => setHot(null)}
                              onPointerMove={(e) => aim({ kind: 'route', from: route.from, to: route.to }, pointAt(e))}
                            />
                          ))}
                        </g>
                      </g>
                      <g className="jr-bars">
                        {/* a stop on the left in its game's colour, or its games' side by side */}
                        {layout.origins.map((placed) => placed.bars.map((bar, i) => (
                          <path
                            className={classNames('jr-bar', { dim: !litStop('origin', placed.stop.key) })}
                            d={bar.d}
                            key={`${placed.stop.key}-${i}`}
                            style={{ fill: gameColor(bar.game) }}
                          />
                        )))}
                        {/* a generation's bar in a quiet grey, as the strands into it carry the colours; a place's in its own */}
                        {SPLITS.map((side) => (
                          <g className={classNames('jr-side', { off: side !== split })} key={side}>
                            {layout.right[side].map((placed) => (
                              <path
                                className={classNames('jr-bar', { 'jr-gen-bar': side === 'generation', dim: side === split && !litStop('right', placed.stop.key) })}
                                d={placed.bars[0].d}
                                key={placed.stop.key}
                                style={side === 'generation' ? undefined : { fill: placeColor(placed.stop.key, saves) }}
                              />
                            ))}
                          </g>
                        ))}
                      </g>
                    </svg>
                    {/* the names fade in as one, so each can still hide for the split it isn't */}
                    <div className="jr-labels">
                      {layout.origins.map((placed) => (
                        <button
                          className={classNames('jr-stop', 'from', { end: placed.label.end, dim: !litStop('origin', placed.stop.key) })}
                          key={placed.stop.key}
                          onBlur={() => setHot(null)}
                          onClick={() => pressOrigin(placed.stop.key)}
                          onFocus={(e) => aim({ kind: 'origin', key: placed.stop.key }, focusAt(e))}
                          onPointerEnter={(e) => aim({ kind: 'origin', key: placed.stop.key }, pointAt(e))}
                          onPointerLeave={() => setHot(null)}
                          style={labelAt(placed, layout.labelW)}
                          type="button"
                        >
                          <span className="jr-stop-name">{stopName(placed.stop.key)}</span>
                          {marks(placed.stop.key)}
                          <strong>{placed.stop.count}</strong>
                        </button>
                      ))}
                      {SPLITS.map((side) => layout.right[side].map((placed) => (
                        <button
                          aria-hidden={side !== split || undefined}
                          className={classNames('jr-stop', 'to', { end: placed.label.end, off: side !== split, dim: side === split && !litStop('right', placed.stop.key) })}
                          key={`${side}-${placed.stop.key}`}
                          onBlur={() => setHot(null)}
                          onClick={() => pressRight(placed.stop.key)}
                          onFocus={(e) => aim({ kind: 'right', key: placed.stop.key }, focusAt(e))}
                          onPointerEnter={(e) => aim({ kind: 'right', key: placed.stop.key }, pointAt(e))}
                          onPointerLeave={() => setHot(null)}
                          style={labelAt(placed, layout.labelW)}
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
                  <li key={`${split}-${route.key}`} style={{ '--r': i } as CSSProperties}>
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
                        {marks(route.from)}
                        <span className="jr-route-from">{stopName(route.from)}</span>
                        <span className="jr-arrow">→</span>
                        <span className="jr-route-to">{rightName(split, route.to)}</span>
                      </span>
                      <span className="jr-route-bar">
                        <span style={{ width: `${(100 * route.count) / topMax}%`, background: `linear-gradient(90deg, ${stopColor(route.from)}, ${rightColor(split, route.to, route.from)})` }} />
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
