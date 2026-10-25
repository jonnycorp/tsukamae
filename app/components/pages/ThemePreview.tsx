import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCheck, faChevronDown, faClock, faGamepad, faGear, faGift, faHeart, faLock, faLongArrowAltRight, faMars, faPencilAlt, faStar, faTrash, faVenus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { BOX_COLUMNS, TILE_SIZE } from '../../utils/pokemon';
import { Progress } from '../library/Progress';
import { THEMES, TYPE_COLORS, themePalette, themeSlug } from '../../palette/themes';
import { auditTheme } from '../../palette/audit';
import { contrast, cssColor, over, parseCssColor } from '../../palette/color';
import { padding } from '../../utils/formatting';

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Mode, ThemeSeed } from '../../palette/themes';
import type { PokemonType } from '../../types';

interface Sample {
  id: number;
  name: string;
  status?: 'unobtainable' | 'temporary' | 'caught';
  sealed?: boolean;
  nickname?: string;
  ot?: string;
  date?: string;
  gift?: boolean;
  location?: 'home' | 'champions' | 'out';
  partner?: boolean;
  female?: boolean;
  // the flipping lines' face on show: 1 the trainer's (nickname, catch date, OT), 2 the types'; else the record's
  face?: 1 | 2;
  types?: PokemonType[];
  hovered?: boolean;
}

const ROWS: Sample[][] = [
  [
    { id: 1, name: 'Bulbasaur', hovered: true },
    { id: 2, name: 'Ivysaur', status: 'unobtainable' },
    { id: 3, name: 'Venusaur', status: 'temporary' },
    { id: 4, name: 'Charmander', status: 'caught' },
    { id: 5, name: 'Charmeleon', status: 'caught', sealed: true, nickname: 'Ember', ot: 'Jay', date: '2026/03/14' },
    { id: 6, name: 'Charizard', status: 'caught', sealed: true, ot: 'GAME FREAK', date: '2026/05/01', gift: true, face: 1 },
  ],
  [
    { id: 7, name: 'Squirtle', status: 'caught', sealed: true, ot: 'Jay', date: '2026/01/02', location: 'home' },
    { id: 8, name: 'Wartortle', status: 'caught', sealed: true, nickname: 'Shelly', ot: 'Jay', date: '2026/02/20', location: 'champions', partner: true, female: true, face: 1 },
    { id: 9, name: 'Blastoise', status: 'caught', sealed: true, ot: 'Jay', date: '2026/04/09', location: 'out', face: 1 },
    { id: 10, name: 'Caterpie', status: 'unobtainable' },
    { id: 11, name: 'Metapod', status: 'temporary' },
    { id: 12, name: 'Butterfree', status: 'caught' },
  ],
  // the types' face, in every location's wash, single and dual
  [
    { id: 25, name: 'Pikachu', status: 'caught', sealed: true, face: 2, types: ['electric'] },
    { id: 94, name: 'Gengar', status: 'caught', sealed: true, face: 2, types: ['ghost', 'poison'], location: 'home' },
    { id: 149, name: 'Dragonite', status: 'caught', sealed: true, face: 2, types: ['dragon', 'flying'], location: 'champions' },
    { id: 124, name: 'Jynx', status: 'caught', sealed: true, face: 2, types: ['ice', 'psychic'], location: 'out' },
    { id: 208, name: 'Steelix', status: 'caught', sealed: true, face: 2, types: ['steel', 'ground'], location: 'home' },
    { id: 197, name: 'Umbreon', status: 'caught', sealed: true, face: 2, types: ['dark'], location: 'champions' },
  ],
];

const GLYPHS = Object.keys(TYPE_COLORS) as PokemonType[];

const glyphStyle = (type: PokemonType): CSSProperties => ({ backgroundColor: `var(--type-${type})`, maskImage: `url(/types/${type}.svg)` });

const SHINE_CLIP = `path('${ROWS.flat().map((sample, index) => {
  if (!sample.sealed) {
    return '';
  }
  const x = (index % BOX_COLUMNS) * TILE_SIZE;
  const y = Math.floor(index / BOX_COLUMNS) * TILE_SIZE;
  return `M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`;
}).join('')}')`;

function SampleTile ({ sample }: { sample: Sample }) {
  const number = `#${padding(sample.id, 4)}`;

  const badgeRow = (
    <span className="badge-row">
      <span className="badge-slot"><img alt="" className="ball-badge" src={sample.gift ? '/balls/cherish_ball.png' : '/balls/poke_ball.png'} /></span>
      <span className="badge-slot">
        {sample.gift ? <FontAwesomeIcon className="gift-badge" icon={faGift} /> : <span className="origin-mark" style={{ maskImage: 'url(/marks/paldea.png)' }} />}
      </span>
      <span className="badge-slot"><FontAwesomeIcon className={classNames('heart-badge', { partner: sample.partner })} icon={faHeart} /></span>
      <span className="badge-slot">
        <FontAwesomeIcon className={`gender-badge ${sample.female ? 'female' : 'male'}`} icon={sample.female ? faVenus : faMars} />
      </span>
      <span className="badge-slot"><span className="trained-badge ev" /></span>
    </span>
  );

  const slots = (
    <p className="number-line-slots">
      <span className="slot-lang"><span className="language-tag">JPN</span></span>
      <span>{number}</span>
      <span className="slot-level">Lv.50</span>
    </p>
  );

  let numberLine: ReactNode = slots;
  if (sample.face === 1) {
    numberLine = <p className={classNames('number-line-ot', { gift: sample.gift })}>{sample.ot}</p>;
  } else if (sample.face === 2) {
    numberLine = null;
  }

  return (
    <div
      className={classNames('pokemon', sample.status, {
        captured: sample.status,
        sealed: sample.sealed,
        'loc-home': sample.location === 'home',
        'loc-champions': sample.location === 'champions',
        'loc-out': sample.location === 'out',
        'theme-preview-hovered': sample.hovered,
      })}
    >
      {sample.sealed &&
        <div className="seal-badges">
          {sample.face === 1 && <span className={classNames('badge-row seal-date', { gift: sample.gift })}>{sample.date}</span>}
          {sample.face === undefined && badgeRow}
        </div>
      }
      {sample.face === 2 &&
        <div className="theme-preview-types">{sample.types?.map((type) => <span className="type-glyph" key={type} style={glyphStyle(type)} />)}</div>
      }
      {sample.hovered &&
        <div className="set-status">
          <button className="status-btn status-btn-caught" type="button"><FontAwesomeIcon icon={faCheck} /></button>
          <button className="status-btn status-btn-temporary" type="button"><FontAwesomeIcon icon={faClock} /></button>
          <button className="status-btn status-btn-unobtainable" type="button"><FontAwesomeIcon icon={faBan} /></button>
        </div>
      }
      <div className="set-captured">
        <h4>{sample.nickname && sample.face === 1 ? <span className="nickname">{sample.nickname}</span> : sample.name}</h4>
        <div className="icon-wrapper">
          <i className={`pkicon pkicon-${padding(sample.id, 3)} game-family-home`} />
        </div>
        {sample.sealed ? <div className="number-scroll">{numberLine}</div> : <p>{number}</p>}
      </div>
    </div>
  );
}

function themeTokens (seed: ThemeSeed, mode: Mode): CSSProperties {
  const style: Record<string, string> = { colorScheme: mode };
  for (const [name, value] of Object.entries(themePalette(seed, mode))) {
    style[`--${name}`] = value;
  }
  return style as CSSProperties;
}

// every type's glyph on what a sealed tile puts behind it, the fill and each location's wash faded below half (as
// app/palette/themes.ts solves them), at the tile's size, with each one's ratio on hover
function GlyphSheet ({ seed, mode }: { seed: ThemeSeed; mode: Mode }) {
  const palette = themePalette(seed, mode);
  const tokens = useMemo(() => themeTokens(seed, mode), [seed, mode]);
  const fill = parseCssColor(palette['tile-caught']);
  const backdrops: [string, string][] = [
    ['tile', palette['tile-caught']],
    ...([['game', 'wash-seal'], ['HOME', 'wash-home'], ['Champions', 'wash-champions'], ['Out', 'wash-loan']] as const).map(([label, wash]): [string, string] => [
      label,
      cssColor(over({ ...parseCssColor(palette[wash]), a: 0.45 }, fill)),
    ]),
  ];

  return (
    <div className="theme-preview-glyph-sheet" data-mode={mode} data-theme={themeSlug(seed.name)} style={tokens}>
      <h3>{mode === 'dark' ? 'soft dark' : 'light'}</h3>
      <div className="theme-preview-glyph-specimens" style={{ backgroundColor: palette['tile-caught'] }}>
        {GLYPHS.map((type) => (
          <div className="theme-preview-glyph-specimen" key={type}>
            <span className="type-glyph" style={glyphStyle(type)} />
            <small>{type}</small>
          </div>
        ))}
      </div>
      {backdrops.map(([label, background]) => (
        <div className="theme-preview-glyph-row" key={label}>
          <span className="theme-preview-glyph-label">{label}</span>
          <div className="theme-preview-glyph-strip" style={{ backgroundColor: background }}>
            {GLYPHS.map((type) => {
              const ratio = contrast(parseCssColor(palette[`type-${type}`]), parseCssColor(background));
              return <span className="type-glyph" key={type} style={glyphStyle(type)} title={`${type} ${ratio.toFixed(2)}:1`} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel ({ seed, mode }: { seed: ThemeSeed; mode: Mode }) {
  const tokens = useMemo(() => themeTokens(seed, mode), [seed, mode]);
  const failures = useMemo(() => auditTheme(seed, mode).filter((result) => !result.pass), [seed, mode]);

  return (
    <div className="theme-preview-panel" data-mode={mode} data-theme={themeSlug(seed.name)} style={tokens}>
      <nav>
        <a className="nav-logo">tsukamae</a>
        <a className="nav-icon"><FontAwesomeIcon icon={faGear} /></a>
        <a className="nav-icon"><FontAwesomeIcon icon={faGamepad} /></a>
      </nav>
      <div className="dex-search-bar">
        <div className="dex-search-bar-summary">
          <div className="header-row">
            <h1>{seed.name} · {mode}</h1>
            <div className="dex-indicator">
              <FontAwesomeIcon icon={faStar} />
              <span className="label">Full National</span>
              <span className="label">HOME</span>
            </div>
          </div>
          <Progress caught={302} marked={475} temporary={76} total={1080} />
        </div>
        <div className="dex-search-bar-filters">
          <div className="filter-bar">
            <div className="filter-views">
              <button className="filter-view" type="button">All</button>
              <button className="filter-view active" type="button">Missing</button>
              <button className="filter-view" type="button">Temporary</button>
            </div>
            <button className="filter-edit-dex" type="button"><FontAwesomeIcon icon={faPencilAlt} />Edit Dex</button>
            <button className="filter-toggle" type="button">Filters <FontAwesomeIcon icon={faChevronDown} /></button>
            <button className="filter-chip" type="button"><span className="filter-chip-label">Generation</span>Gen 9 <FontAwesomeIcon icon={faXmark} /></button>
            <span className="filter-count">97 Pokémon</span>
          </div>
        </div>
      </div>
      <div className="box">
        <div className="box-header">
          <h1>Box 1</h1>
          <span className="box-sealed-count">4/30 sealed</span>
        </div>
        <div className="box-container">
          <div className="tile-grid">
            {ROWS.flat().map((sample) => <SampleTile key={sample.id} sample={sample} />)}
          </div>
          <div className="box-shine" style={{ clipPath: SHINE_CLIP }}>
            <div className="box-shine-band" />
          </div>
        </div>
      </div>
      <div className="theme-preview-lower">
        <div className="pokemon-popover wide theme-preview-static">
          <div className="popover-header">
            <i className="pkicon pkicon-004 game-family-home" />
            <div className="popover-title">
              <h1>Charmander</h1>
              <p className="popover-meta">
                #0004
                <a>Bulbapedia <FontAwesomeIcon icon={faLongArrowAltRight} /></a>
                <a>Serebii <FontAwesomeIcon icon={faLongArrowAltRight} /></a>
              </p>
            </div>
            <button className="popover-close" type="button"><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          <div className="popover-body">
            <div className="popover-columns">
              <div className="popover-column">
                <div className="form-group">
                  <label>Origin Game</label>
                  <input className="form-control" readOnly value="Violet" />
                </div>
              </div>
              <div className="popover-column">
                <div className="form-group">
                  <label>Level</label>
                  <input className="form-control" readOnly value="50" />
                </div>
              </div>
            </div>
          </div>
          <div className="popover-footer">
            <button className="popover-seal" type="button"><FontAwesomeIcon icon={faLock} /> Seal</button>
            <button className="popover-release" type="button"><FontAwesomeIcon icon={faTrash} /> Release</button>
          </div>
        </div>
        <div className="theme-preview-side">
          <p>Body text <span className="theme-preview-muted">and muted text</span> <a className="link">with a link</a></p>
          <button className="btn btn-blue btn-compact" type="button">Create</button>
          <button className="btn btn-delete btn-compact" type="button">Delete</button>
          <div className="form-group">
            <div className="checkbox">
              <label><input checked readOnly type="checkbox" /><span className="checkbox-custom"><span /></span>Nickname</label>
            </div>
          </div>
          <p className={failures.length > 0 ? 'theme-preview-fail' : 'theme-preview-pass'}>
            {failures.length === 0 ? 'audit passes' : failures.map((failure) => `${failure.rule} ${failure.value.toFixed(2)}`).join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;
// a press that moves this far is a drag, which pans, rather than a click
const DRAG_PX = 4;

interface Drag {
  id: number;
  x: number;
  y: number;
  left: number;
  top: number;
  moved: boolean;
}

// Ctrl+scroll zooms the whole sheet about the pointer (Ctrl+0 back to 100%) and a drag pans it, for a close look at a
// glyph or a tile
export function ThemePreview () {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // the sheet's point under the pointer (unscaled, from the canvas's corner), held at that spot on screen across a zoom
  const anchorRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [panning, setPanning] = useState(false);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const anchor = anchorRef.current;
    if (scroller && anchor) {
      anchorRef.current = null;
      const canvas = canvasRef.current!.getBoundingClientRect();
      scroller.scrollLeft += canvas.left + anchor.x * zoom - anchor.clientX;
      scroller.scrollTop += canvas.top + anchor.y * zoom - anchor.clientY;
    }
  }, [zoom]);

  useEffect(() => {
    const scroller = scrollerRef.current!;
    const zoomAt = (next: number, clientX: number, clientY: number) => {
      const z = zoomRef.current;
      const target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      if (Math.abs(target - z) < 0.001) {
        return;
      }
      const canvas = canvasRef.current!.getBoundingClientRect();
      anchorRef.current = { x: (clientX - canvas.left) / z, y: (clientY - canvas.top) / z, clientX, clientY };
      setZoom(target);
    };
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      e.preventDefault();
      zoomAt(zoomRef.current * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        const rect = scroller.getBoundingClientRect();
        zoomAt(1, rect.left + scroller.clientWidth / 2, rect.top + scroller.clientHeight / 2);
      }
    };
    scroller.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      scroller.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    const scroller = e.currentTarget;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) {
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_PX) {
        return;
      }
      drag.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanning(true);
    }
    e.currentTarget.scrollLeft = drag.left - dx;
    e.currentTarget.scrollTop = drag.top - dy;
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === e.pointerId) {
      dragRef.current = null;
      setPanning(false);
    }
  };

  return (
    <div
      className={classNames('theme-preview', { panning })}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={scrollerRef}
    >
      <div className="theme-preview-canvas" ref={canvasRef} style={{ zoom }}>
        {THEMES.map((seed) => (
          <section key={seed.name}>
            <h2>
              {seed.name}
              <small>hue {seed.hue} · ink {seed.ink} · unobtainable {seed.unobtainable} · temporary {seed.temporary} · caught {seed.caught} · chroma {seed.chroma}</small>
            </h2>
            <div className="theme-preview-modes">
              <Panel mode="light" seed={seed} />
              <Panel mode="dark" seed={seed} />
              <div className="theme-preview-glyphs">
                <GlyphSheet mode="light" seed={seed} />
                <GlyphSheet mode="dark" seed={seed} />
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className="theme-preview-zoom">{Math.round(zoom * 100)}% · Ctrl+scroll to zoom, drag to pan, Ctrl+0 to reset</div>
    </div>
  );
}
