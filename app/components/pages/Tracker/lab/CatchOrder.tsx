import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES, ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { GalaxyPanel, Hologram } from './GalaxyPanel';
import { cssColor, easeOut, fitCanvas, useFrameLoop, useKeys } from './lab-kit';
import { displayName } from '../../../library/PokemonName';
import { gameColor } from '../../../../utils/game-colors';
import { iconClass } from '../../../../utils/pokemon';
import { localizeBall, localizeOriginGame } from '../../../../i18n/names';
import { spriteCuts, spriteShadow, spriteSheet } from './sprite-atlas';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useLabText } from './lab-i18n';
import { useThemeContext } from '../../../../hooks/contexts/use-local-storage-context';

import type { CSSProperties, PointerEvent } from 'react';
import type { Capture } from '../../../../types';
import type { LabProps } from './lab-kit';
import type { LabRecord } from './LabScope';
import type { SpriteCut } from './sprite-atlas';

// the run: a catch to so many ms, the whole of it held between these, so a few catches don't flash by and a thousand
// don't drag; the gaps between days aren't drawn out, only the order
const STEP_MS = 12;
const MIN_MS = 5000;
const MAX_MS = 15000;
// a newly lit tile lands over this many catches, from a little larger and fainter onto its place
const LAND = 10;
// a gap between generations' bands, in tiles
const BAND_GAP = 0.7;
// the games named under the wall, most first
const KEY_GAMES = 10;
// the art at the side changes no faster than this while the run plays, each one given time to come on
const STAGE_MS = 700;

export type MosaicState = 'caught' | 'missing' | 'unobtainable';

export const mosaicState = (capture: Capture): MosaicState => (!capture.captured ? 'missing' : capture.status === 'unobtainable' ? 'unobtainable' : 'caught');

interface Cell {
  record: LabRecord;
  x: number;
  y: number;
  // its turn in the catch order, or null for a mon not caught
  rank: number | null;
  // its box sprite's cut of the sheet
  cut: SpriteCut | null;
}

// the size of tile that fits every band (each starting a row of its own) into w by h, and the columns that gives
function fitTiles (bands: number[], w: number, h: number): { size: number; columns: number } {
  let best = { size: 0, columns: 1 };
  for (let columns = 6; columns <= 260; columns += 1) {
    const rows = bands.reduce((n, count) => n + Math.ceil(count / columns), 0) + (bands.length - 1) * BAND_GAP;
    const size = Math.min(w / columns, h / rows);
    if (size > best.size) {
      best = { size, columns };
    }
  }
  return best;
}

interface Props {
  records: LabRecord[];
  scale: number;
  calm: boolean;
  onBack: () => void;
  onLocate: LabProps['onLocate'];
  onFilter: LabProps['onFilter'];
}

// the mosaic in catch order: every shown mon at once, the wall fitted beside a stage, each mon its own sprite, a faint
// shadow till its turn and then lit on its game's colour as the day it was caught leads above; the art of the latest
// one held up on the stage as a hologram, and the games counted up below as they come in. Scrubbed, or played again. A
// tile pointed at is named beside it; pressed, the run stops on it and the stage shows its record, Q and E stepping on
// through the order from there
export function CatchOrder ({ records, scale, calm, onBack, onLocate, onFilter }: Props) {
  const { lt, locale } = useLabText();
  const { theme } = useThemeContext();
  const { activeDexView } = useDexContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cells = useRef<{ list: Cell[]; labels: { x: number; y: number; generation: number }[]; size: number; w: number; h: number; from: unknown }>({ list: [], labels: [], size: 0, w: 0, h: 0, from: null });
  const cursor = useRef(calm ? Infinity : 0);
  const hover = useRef<Cell | null>(null);
  const staged = useRef({ at: -1, time: 0 });
  const [shown, setShown] = useState(0);
  const [stage, setStage] = useState(-1);
  const [focus, setFocus] = useState<number | null>(null);
  const [playing, setPlaying] = useState(!calm);
  const [pointing, setPointing] = useState(false);
  const [, setSheetIn] = useState(false);
  const sheet = spriteSheet(() => setSheetIn(true));

  // the caught in the order they were caught (undated ones last), and each one's turn
  const ordered = useMemo(() => records.filter(({ capture }) => mosaicState(capture) === 'caught')
  .sort((a, b) => (a.capture.catch_date ?? '9999').localeCompare(b.capture.catch_date ?? '9999') || a.key.localeCompare(b.key)), [records]);
  const rank = useMemo(() => new Map(ordered.map((record, i) => [record.key, i])), [ordered]);
  const total = ordered.length;
  const duration = Math.min(MAX_MS, Math.max(MIN_MS, total * STEP_MS));
  const picked = focus !== null ? ordered[focus] ?? null : null;

  // each mon's sprite cut, measured once for the lot
  const cutOf = useMemo(() => {
    const classes = records.map(({ capture }) => iconClass(capture.pokemon, activeDexView!));
    const found = spriteCuts(classes);
    return new Map(records.map((record, i) => [record.key, found.get(classes[i]) ?? null]));
  }, [records, activeDexView]);

  // the bands as the wall has them: a dex's generations in turn
  const bands = useMemo(() => {
    const groups: LabRecord[][] = [];
    let last = '';
    for (const record of records) {
      const band = `${record.dex.id}:${record.capture.pokemon.generation}`;
      if (band !== last) {
        groups.push([]);
        last = band;
      }
      groups[groups.length - 1].push(record);
    }
    return groups;
  }, [records]);

  // the colours the canvas draws, as this theme has them
  const colors = useMemo(() => {
    const games = new Map<string, string>();
    for (const { capture } of ordered) {
      if (capture.origin_game && !games.has(capture.origin_game)) {
        games.set(capture.origin_game, cssColor(gameColor(capture.origin_game)));
      }
    }
    return {
      games,
      ink: cssColor('var(--ink)'),
      none: cssColor('var(--ink-muted)'),
      accent: cssColor('var(--accent)'),
    };
  }, [ordered, theme]); // theme: the tokens change with it

  const lay = (w: number, h: number) => {
    const { size, columns } = fitTiles(bands.map((band) => band.length), w, h);
    const width = size * columns;
    const left = (w - width) / 2;
    const list: Cell[] = [];
    const labels: { x: number; y: number; generation: number }[] = [];
    let row = 0;
    for (const band of bands) {
      labels.push({ x: left - size * 0.6, y: row * size + size / 2, generation: band[0].capture.pokemon.generation });
      band.forEach((record, i) => list.push({
        record,
        x: left + (i % columns) * size,
        y: (row + Math.floor(i / columns)) * size,
        rank: rank.get(record.key) ?? null,
        cut: cutOf.get(record.key) ?? null,
      }));
      row += Math.ceil(band.length / columns) + BAND_GAP;
    }
    const height = (row - BAND_GAP) * size;
    for (const spot of [...list, ...labels]) {
      spot.y += (h - height) / 2;
    }
    cells.current = { list, labels, size, w, h, from: cutOf };
  };

  const draw = (dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (playing) {
      cursor.current = Math.min(total + LAND, cursor.current + (dt / duration) * total);
      if (cursor.current >= total + LAND) {
        setPlaying(false);
      }
    }
    const at = cursor.current;
    const reached = Math.min(total, Math.floor(at));
    if (reached !== shown) {
      setShown(reached);
    }
    // the stage a beat behind the run, so each mon's art has the time to come on
    const now = performance.now();
    if (reached - 1 !== staged.current.at && (!playing || now - staged.current.time > STAGE_MS)) {
      staged.current = { at: reached - 1, time: now };
      setStage(reached - 1);
    }
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (cells.current.w !== w || cells.current.h !== h || cells.current.from !== cutOf) {
      lay(w, h);
    }
    const { list, labels, size } = cells.current;
    const pad = Math.max(0.5, size * 0.08);
    const inner = size - pad * 2;
    const radius = size * 0.22;
    const shadow = spriteShadow(colors.ink);
    const day = picked?.capture.catch_date;
    ctx.clearRect(0, 0, w, h);
    // each band's generation, beside its first row where there's room
    if (labels[0]?.x > size) {
      ctx.fillStyle = colors.none;
      ctx.globalAlpha = 0.6;
      ctx.font = `${Math.round(Math.max(10, size * 0.5))}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const label of labels) {
        ctx.fillText(String(label.generation), label.x, label.y);
      }
    }
    // a sprite into its tile, as large as fits without going past twice its own size, crisp where it's grown
    const sprite = (source: HTMLImageElement | HTMLCanvasElement, cut: SpriteCut, x: number, y: number, grow = 1) => {
      const fit = Math.min(inner / cut.w, inner / cut.h, 2) * grow;
      const dw = cut.w * fit;
      const dh = cut.h * fit;
      ctx.imageSmoothingEnabled = fit < 1;
      ctx.drawImage(source, cut.x, cut.y, cut.w, cut.h, x + size / 2 - dw / 2, y + size / 2 - dh / 2, dw, dh);
    };
    let latest: Cell | null = null;
    const lifted: { cell: Cell; age: number }[] = [];
    for (const cell of list) {
      const lit = cell.rank !== null && cell.rank < at;
      // a pick dims all but its own day
      const dim = picked && !(cell.record.capture.catch_date === day && day) ? 0.35 : 1;
      if (cell.rank !== null && reached > 0 && cell.rank === reached - 1) {
        latest = cell;
      }
      if (lit) {
        const age = at - cell.rank!;
        if (age < LAND) {
          lifted.push({ cell, age });
          continue;
        }
        ctx.globalAlpha = 0.3 * dim;
        ctx.fillStyle = (cell.record.capture.origin_game && colors.games.get(cell.record.capture.origin_game)) || colors.none;
        ctx.beginPath();
        ctx.roundRect(cell.x + pad, cell.y + pad, inner, inner, radius);
        ctx.fill();
        if (cell.cut && sheet.complete) {
          ctx.globalAlpha = dim;
          sprite(sheet, cell.cut, cell.x, cell.y);
        }
      } else if (cell.cut && shadow) {
        // still to come, its shadow; not caught, fainter; out of reach, all but gone
        ctx.globalAlpha = (cell.rank !== null ? 0.16 : mosaicState(cell.record.capture) === 'missing' ? 0.08 : 0.03) * dim;
        sprite(shadow, cell.cut, cell.x, cell.y);
      }
    }
    // the ones landing, over the rest: from larger and fainter, a ring of their game's colour going out round them
    lifted.sort((a, b) => b.age - a.age);
    for (const { cell, age } of lifted) {
      const p = easeOut(age / LAND);
      const color = (cell.record.capture.origin_game && colors.games.get(cell.record.capture.origin_game)) || colors.none;
      ctx.globalAlpha = 0.3 * p;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(cell.x + pad, cell.y + pad, inner, inner, radius);
      ctx.fill();
      ctx.globalAlpha = 0.6 * (1 - p);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.arc(cell.x + size / 2, cell.y + size / 2, size * (0.5 + p * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      if (cell.cut && sheet.complete) {
        ctx.globalAlpha = 0.4 + 0.6 * p;
        sprite(sheet, cell.cut, cell.x, cell.y, 1 + 0.8 * (1 - p));
      }
    }
    // the latest caught ringed while the run goes; the pick ringed and breathing
    const ring = (cell: Cell, strength: number) => {
      ctx.globalAlpha = strength;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.beginPath();
      ctx.roundRect(cell.x + pad / 2, cell.y + pad / 2, size - pad, size - pad, radius);
      ctx.stroke();
    };
    if (latest && reached < total && !picked) {
      ring(latest, 1);
    }
    const pickedCell = picked && list.find((cell) => cell.record === picked);
    if (pickedCell) {
      ring(pickedCell, 0.7 + 0.3 * Math.sin(now / 300));
    }
    // what's pointed at, named in a whisper beside it
    const pointed = hover.current;
    if (pointed) {
      ring(pointed, 0.5);
      const { capture } = pointed.record;
      const label = [displayName(capture.pokemon.name, capture.pokemon.name_ja, locale), capture.captured ? capture.catch_date : lt(`mosaic.state.${mosaicState(capture)}`)].filter(Boolean).join('  ');
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'middle';
      const width = ctx.measureText(label).width;
      const right = pointed.x + size + 8 + width < w;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillStyle = colors.ink;
      ctx.globalAlpha = 0.85;
      ctx.fillText(label, right ? pointed.x + size + 8 : pointed.x - 8, pointed.y + size / 2);
    }
    ctx.globalAlpha = 1;
  };

  // drawn every frame while the run plays or a pick breathes; otherwise as it changes: on each render (a scrub, a
  // pointer) and as the window resizes it
  const animating = !calm && (playing || picked !== null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useFrameLoop((_t, dt) => draw(dt), animating);
  useEffect(() => {
    if (!animating) {
      draw(0);
    }
  });
  useEffect(() => {
    const observer = new ResizeObserver(() => drawRef.current(0));
    observer.observe(canvasRef.current!);
    return () => observer.disconnect();
  }, []);

  // Space plays and pauses; Q and E step a pick through the order as far as the run has come; Escape lets a pick go,
  // then goes back to the wall rather than closing the scene. Added once, on mount, so it's ahead of the scene's Escape
  useKeys((e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === ' ') {
      toggle();
    } else if ((key === 'q' || key === 'e') && shown > 0) {
      setPlaying(false);
      const from = focus ?? (key === 'q' ? shown : -1);
      setFocus(Math.max(0, Math.min(shown - 1, from + (key === 'q' ? -1 : 1))));
    } else if (key === 'escape') {
      if (focus !== null) {
        setFocus(null);
      } else {
        onBack();
      }
    } else {
      return;
    }
    e.preventDefault();
  });

  const toggle = () => {
    if (calm) {
      return;
    }
    if (!playing && cursor.current >= total) {
      cursor.current = 0;
    }
    setFocus(null);
    setPlaying(!playing);
  };

  const cellAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { list, size } = cells.current;
    return list.find((cell) => x >= cell.x && x < cell.x + size && y >= cell.y && y < cell.y + size) ?? null;
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const cell = cellAt(e);
    if (cell !== hover.current) {
      hover.current = cell;
      setPointing(cell?.rank !== null && cell?.rank !== undefined && cell.rank < shown);
      if (!animating) {
        draw(0);
      }
    }
  };

  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);
  const ballName = (ball: string) => localizeBall(locale, ball, BALL_NAMES.get(ball) ?? ball);
  const current = (picked ?? (shown > 0 ? ordered[shown - 1] : null));
  const onStage = stage >= 0 ? ordered[Math.min(stage, total - 1)] : null;

  // the games as far as the run has come, the most at its end first
  const games = useMemo(() => {
    const final = new Map<string, number>();
    for (const { capture } of ordered) {
      if (capture.origin_game) {
        final.set(capture.origin_game, (final.get(capture.origin_game) ?? 0) + 1);
      }
    }
    return [...final.entries()].sort((a, b) => b[1] - a[1]).slice(0, KEY_GAMES).map(([game]) => game);
  }, [ordered]);
  const counts = new Map<string, number>();
  for (const { capture } of ordered.slice(0, shown)) {
    if (capture.origin_game) {
      counts.set(capture.origin_game, (counts.get(capture.origin_game) ?? 0) + 1);
    }
  }

  return (
    <div className="lco">
      <header className="lco-head" style={{ zoom: scale }}>
        <button className="lco-back" onClick={onBack} type="button"><FontAwesomeIcon icon={faArrowLeft} /> {lt('mosaic.wall')}</button>
        <div className="lco-date">
          <b>{current ? (current.capture.catch_date ? dateLabel(current.capture.catch_date) : lt('mosaic.undated')) : '—'}</b>
          <span>{picked ? lt('galaxy.nth', { n: focus! + 1, total }) : lt('mosaic.count', { n: shown, total })}</span>
        </div>
      </header>
      <div className="lco-main">
        <div className="lco-stage" style={{ zoom: scale }}>
          {picked
            ? (
              <GalaxyPanel
                ballName={picked.capture.ball ? ballName(picked.capture.ball) : undefined}
                kind="constellation"
                onFilterBall={() => onFilter({ view: 'all', facets: { ball: [picked.capture.ball ?? ''] } }, { scroll: 0 })}
                onLocate={() => onLocate(picked.capture.pokemon.id)}
                record={picked}
              />
            )
            : onStage && (
              <div className="lco-show" key={onStage.key}>
                <Hologram record={onStage} />
                <strong>{displayName(onStage.capture.pokemon.name, onStage.capture.pokemon.name_ja, locale)}</strong>
                {onStage.capture.origin_game && <small>{gameName(onStage.capture.origin_game)}</small>}
              </div>
            )}
        </div>
        <canvas
          className="lco-canvas"
          onClick={() => {
            const cell = hover.current;
            if (cell?.rank !== null && cell?.rank !== undefined && cell.rank < shown) {
              setPlaying(false);
              setFocus(cell.rank === focus ? null : cell.rank);
            } else {
              setFocus(null);
            }
          }}
          onPointerLeave={() => {
            hover.current = null;
            setPointing(false);
            if (!animating) {
              draw(0);
            }
          }}
          onPointerMove={onPointerMove}
          ref={canvasRef}
          style={{ cursor: pointing ? 'pointer' : 'default' }}
        />
      </div>
      <footer className="lco-foot" style={{ zoom: scale }}>
        <div className="lco-games">
          {games.map((game) => (
            <span className={counts.get(game) ? 'on' : undefined} key={game} style={{ '--ground': gameColor(game) } as CSSProperties}>
              <i />{gameName(game)}<b>{counts.get(game) ?? 0}</b>
            </span>
          ))}
        </div>
        <div className="lab-scrub">
          <button aria-label={lt(playing ? 'galaxy.pause' : 'galaxy.play')} disabled={calm} onClick={toggle} type="button">
            <FontAwesomeIcon icon={playing ? faPause : faPlay} />
          </button>
          <input
            aria-label={lt('mosaic.order')}
            max={total}
            min={0}
            onChange={(e) => {
              setPlaying(false);
              setFocus(null);
              cursor.current = Number(e.target.value);
              setShown(cursor.current);
            }}
            step={1}
            type="range"
            value={shown}
          />
        </div>
      </footer>
    </div>
  );
}
