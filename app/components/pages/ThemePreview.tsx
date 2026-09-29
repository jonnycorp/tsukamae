import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCheck, faChevronDown, faClock, faGamepad, faGear, faGift, faHeart, faLock, faLongArrowAltRight, faMars, faPencilAlt, faPlus, faStar, faTrash, faVenus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

import { BOX_COLUMNS, TILE_SIZE } from '../../utils/pokemon';
import { Progress } from '../library/Progress';
import { THEMES, themePalette } from '../../palette/themes';
import { auditTheme } from '../../palette/audit';
import { padding } from '../../utils/formatting';

import type { CSSProperties } from 'react';
import type { Mode, ThemeSeed } from '../../palette/themes';

interface Sample {
  id: number;
  name: string;
  status?: 'unobtainable' | 'temporary' | 'caught';
  sealed?: boolean;
  nickname?: string;
  ot?: string;
  date?: string;
  gift?: boolean;
  location?: 'home' | 'champions';
  partner?: boolean;
  female?: boolean;
  // the second face of every flip track, frozen
  flipped?: boolean;
  hovered?: boolean;
}

const ROWS: Sample[][] = [
  [
    { id: 1, name: 'Bulbasaur', hovered: true },
    { id: 2, name: 'Ivysaur', status: 'unobtainable' },
    { id: 3, name: 'Venusaur', status: 'temporary' },
    { id: 4, name: 'Charmander', status: 'caught' },
    { id: 5, name: 'Charmeleon', status: 'caught', sealed: true, nickname: 'Ember', ot: 'Jay', date: '2026/03/14' },
    { id: 6, name: 'Charizard', status: 'caught', sealed: true, ot: 'GAME FREAK', date: '2026/05/01', gift: true, flipped: true },
  ],
  [
    { id: 7, name: 'Squirtle', status: 'caught', sealed: true, ot: 'Jay', date: '2026/01/02', location: 'home' },
    { id: 8, name: 'Wartortle', status: 'caught', sealed: true, nickname: 'Shelly', ot: 'Jay', date: '2026/02/20', location: 'champions', partner: true, female: true, flipped: true },
    { id: 9, name: 'Blastoise' },
    { id: 10, name: 'Caterpie', status: 'unobtainable' },
    { id: 11, name: 'Metapod', status: 'temporary' },
    { id: 12, name: 'Butterfree', status: 'caught' },
  ],
];

const SHINE_CLIP = `path('${ROWS.flat().map((sample, index) => {
  if (!sample.sealed) {
    return '';
  }
  const x = (index % BOX_COLUMNS) * TILE_SIZE;
  const y = Math.floor(index / BOX_COLUMNS) * TILE_SIZE;
  return `M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`;
}).join('')}')`;

function SampleTile ({ sample }: { sample: Sample }) {
  const shift = (px: number): CSSProperties | undefined => (sample.flipped ? { transform: `translateY(-${px}px)` } : undefined);
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

  return (
    <div
      className={classNames('pokemon', sample.status, {
        captured: sample.status,
        sealed: sample.sealed,
        'loc-home': sample.location === 'home',
        'loc-champions': sample.location === 'champions',
        'theme-preview-hovered': sample.hovered,
      })}
    >
      {sample.sealed &&
        <div className="seal-badges">
          <div className="seal-badges-track" style={shift(20)}>
            {badgeRow}
            <span className={classNames('badge-row seal-date', { gift: sample.gift })}>{sample.date}</span>
            {badgeRow}
          </div>
        </div>
      }
      {sample.hovered &&
        <div className="set-status">
          <button className="status-btn status-btn-caught" type="button"><FontAwesomeIcon icon={faCheck} /></button>
          <button className="status-btn status-btn-temporary" type="button"><FontAwesomeIcon icon={faClock} /></button>
          <button className="status-btn status-btn-unobtainable" type="button"><FontAwesomeIcon icon={faBan} /></button>
        </div>
      }
      <div className="set-captured">
        {sample.nickname
          ? (
            <div className="name-scroll">
              <div className="name-scroll-track" style={shift(22)}>
                <h4>{sample.name}</h4>
                <h4><span className="nickname">{sample.nickname}</span></h4>
                <h4>{sample.name}</h4>
              </div>
            </div>
          )
          : <h4>{sample.name}</h4>}
        <div className="icon-wrapper">
          <i className={`pkicon pkicon-${padding(sample.id, 3)} game-family-home`} />
        </div>
        {sample.sealed
          ? (
            <div className="number-scroll">
              <div className="number-scroll-track" style={shift(16)}>
                {slots}
                <p className={classNames('number-line-ot', { gift: sample.gift })}>{sample.ot}</p>
                {slots}
              </div>
            </div>
          )
          : <p>{number}</p>}
      </div>
    </div>
  );
}

function Panel ({ seed, mode }: { seed: ThemeSeed; mode: Mode }) {
  const tokens = useMemo(() => {
    const style: Record<string, string> = { colorScheme: mode };
    for (const [name, value] of Object.entries(themePalette(seed, mode))) {
      style[`--${name}`] = value;
    }
    return style as CSSProperties;
  }, [seed, mode]);
  const failures = useMemo(() => auditTheme(seed, mode).filter((result) => !result.pass), [seed, mode]);

  return (
    <div className="theme-preview-panel" style={tokens}>
      <nav>
        <a className="nav-logo">tsukamae</a>
        <a className="nav-icon"><FontAwesomeIcon icon={faPencilAlt} /></a>
        <a className="nav-icon"><FontAwesomeIcon icon={faPlus} /></a>
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
          {ROWS.flat().map((sample) => <SampleTile key={sample.id} sample={sample} />)}
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
              <label><input checked readOnly type="checkbox" /><span className="checkbox-custom"><span /></span>Lang Tags</label>
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

export function ThemePreview () {
  return (
    <div className="theme-preview">
      {THEMES.map((seed) => (
        <section key={seed.name}>
          <h2>
            {seed.name}
            <small>hue {seed.hue} · ink {seed.ink} · unobtainable {seed.unobtainable} · temporary {seed.temporary} · caught {seed.caught} · chroma {seed.chroma}</small>
          </h2>
          <div className="theme-preview-modes">
            <Panel mode="light" seed={seed} />
            <Panel mode="dark" seed={seed} />
          </div>
        </section>
      ))}
    </div>
  );
}
