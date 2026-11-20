import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { LabTip } from './LabTip';
import { SceneMon } from '../Scene';
import { cssColor, easeOut, fitCanvas, useFrameLoop } from './lab-kit';
import { displayName } from '../../../library/PokemonName';
import { gameColor } from '../../../../utils/game-colors';
import { localizeOriginGame } from '../../../../i18n/names';
import { useLabText } from './lab-i18n';
import { useThemeContext } from '../../../../hooks/contexts/use-local-storage-context';

import type { CSSProperties, PointerEvent } from 'react';
import type { Capture } from '../../../../types';
import type { LabRecord } from './LabScope';

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

export type MosaicState = 'caught' | 'missing' | 'unobtainable';

export const mosaicState = (capture: Capture): MosaicState => (!capture.captured ? 'missing' : capture.status === 'unobtainable' ? 'unobtainable' : 'caught');

interface Cell {
  record: LabRecord;
  x: number;
  y: number;
  // its turn in the catch order, or null for a mon not caught
  rank: number | null;
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
  onLocate: (pokemon: number) => void;
}

// the mosaic in catch order: every shown mon at once, the wall fitted to the screen in tiles too small for sprites, each
// lit in its game's colour on its turn as the day it was caught leads above, the mon itself beside it, and the games
// counted up below as they come in. Scrubbed, or played again; a tile pointed at shows its mon, pressed goes to it
export function CatchOrder ({ records, scale, calm, onBack, onLocate }: Props) {
  const { lt, locale } = useLabText();
  const { theme } = useThemeContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cells = useRef<{ list: Cell[]; labels: { x: number; y: number; generation: number }[]; size: number; w: number; h: number }>({ list: [], labels: [], size: 0, w: 0, h: 0 });
  const cursor = useRef(calm ? Infinity : 0);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(!calm);
  const [hot, setHot] = useState<{ cell: Cell; x: number; y: number } | null>(null);

  // the caught in the order they were caught (undated ones last), and each one's turn
  const ordered = useMemo(() => records.filter(({ capture }) => mosaicState(capture) === 'caught')
  .sort((a, b) => (a.capture.catch_date ?? '9999').localeCompare(b.capture.catch_date ?? '9999') || a.key.localeCompare(b.key)), [records]);
  const rank = useMemo(() => new Map(ordered.map((record, i) => [record.key, i])), [ordered]);
  const total = ordered.length;
  const duration = Math.min(MAX_MS, Math.max(MIN_MS, total * STEP_MS));

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
      none: cssColor('var(--ink-muted)'),
      sunken: cssColor('var(--paper-sunken)'),
      line: cssColor('var(--line)'),
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
      }));
      row += Math.ceil(band.length / columns) + BAND_GAP;
    }
    const height = (row - BAND_GAP) * size;
    for (const spot of [...list, ...labels]) {
      spot.y += (h - height) / 2;
    }
    cells.current = { list, labels, size, w, h };
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
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (cells.current.w !== w || cells.current.h !== h || cells.current.list.length !== records.length) {
      lay(w, h);
    }
    const { list, labels, size } = cells.current;
    const pad = Math.max(0.5, size * 0.09);
    const inner = size - pad * 2;
    const radius = size * 0.2;
    ctx.clearRect(0, 0, w, h);
    // each band's generation, beside its first row where there's room
    if (labels[0]?.x > size) {
      ctx.fillStyle = colors.none;
      ctx.font = `${Math.round(Math.max(10, size * 0.55))}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const label of labels) {
        ctx.fillText(String(label.generation), label.x, label.y);
      }
    }
    let latest: Cell | null = null;
    for (const cell of list) {
      const lit = cell.rank !== null && cell.rank < at;
      ctx.globalAlpha = lit ? 1 : cell.rank === null ? (mosaicState(cell.record.capture) === 'missing' ? 0.45 : 0.2) : 0.9;
      ctx.fillStyle = colors.sunken;
      if (lit) {
        ctx.fillStyle = (cell.record.capture.origin_game && colors.games.get(cell.record.capture.origin_game)) || colors.none;
      }
      ctx.beginPath();
      ctx.roundRect(cell.x + pad, cell.y + pad, inner, inner, radius);
      ctx.fill();
      if (cell.rank !== null && reached > 0 && cell.rank === reached - 1) {
        latest = cell;
      }
      // landing: from larger and fainter onto its place
      const age = cell.rank === null ? Infinity : at - cell.rank;
      if (lit && age < LAND) {
        const p = easeOut(age / LAND);
        const grow = size * 1.4 * (1 - p);
        ctx.globalAlpha = 0.5 * (1 - p);
        ctx.beginPath();
        ctx.roundRect(cell.x + pad - grow / 2, cell.y + pad - grow / 2, inner + grow, inner + grow, radius + grow / 3);
        ctx.fill();
      }
    }
    // the latest caught, ringed in the accent while the run goes
    if (latest && reached < total) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = Math.max(1.5, size * 0.1);
      ctx.beginPath();
      ctx.roundRect(latest.x + pad / 2, latest.y + pad / 2, size - pad, size - pad, radius);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  useFrameLoop((_t, dt) => draw(dt), !calm);
  // still: the whole of it, drawn once and again as the window or the scrub changes it
  useEffect(() => {
    if (!calm) {
      return undefined;
    }
    draw(0);
    const observer = new ResizeObserver(() => draw(0));
    observer.observe(canvasRef.current!);
    return () => observer.disconnect();
  });

  // Space plays and pauses
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.defaultPrevented) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  });

  const toggle = () => {
    if (calm) {
      return;
    }
    if (!playing && cursor.current >= total) {
      cursor.current = 0;
    }
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
    const rect = e.currentTarget.getBoundingClientRect();
    setHot(cell ? { cell, x: rect.left + cell.x + cells.current.size, y: rect.top + cell.y + cells.current.size / 2 } : null);
  };

  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);
  const current = shown > 0 ? ordered[shown - 1] : null;

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
          <span>{lt('mosaic.count', { n: shown, total })}</span>
        </div>
        <div className="lco-mon">
          {current && (
            <>
              <span className="lco-sprite" key={current.key}><SceneMon pokemon={current.capture.pokemon} zoom={1.6} /></span>
              <span>
                <strong>{displayName(current.capture.pokemon.name, current.capture.pokemon.name_ja, locale)}</strong>
                {current.capture.origin_game && <small>{gameName(current.capture.origin_game)}</small>}
              </span>
            </>
          )}
        </div>
      </header>
      <canvas
        className="lco-canvas"
        onClick={() => {
          if (hot?.cell.record.here) {
            onLocate(hot.cell.record.capture.pokemon.id);
          }
        }}
        onPointerLeave={() => setHot(null)}
        onPointerMove={onPointerMove}
        ref={canvasRef}
        style={{ cursor: hot?.cell.record.here ? 'pointer' : 'default' }}
      />
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
              cursor.current = Number(e.target.value);
              if (calm) {
                setShown(cursor.current);
              }
            }}
            step={1}
            type="range"
            value={shown}
          />
        </div>
      </footer>
      {hot && (
        <LabTip scale={scale} x={hot.x} y={hot.y}>
          <strong>{displayName(hot.cell.record.capture.pokemon.name, hot.cell.record.capture.pokemon.name_ja, locale)}</strong>
          <small>
            {hot.cell.rank !== null
              ? [hot.cell.record.capture.catch_date && dateLabel(hot.cell.record.capture.catch_date), lt('mosaic.nth', { n: hot.cell.rank + 1 })].filter(Boolean).join(' · ')
              : lt(`mosaic.state.${mosaicState(hot.cell.record.capture)}`)}
          </small>
          {hot.cell.record.capture.origin_game && hot.cell.rank !== null && <small>{gameName(hot.cell.record.capture.origin_game)}</small>}
          {hot.cell.record.here && <em>{lt('mosaic.press')}</em>}
        </LabTip>
      )}
    </div>
  );
}
