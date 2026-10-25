import classNames from 'classnames';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Scene, SceneMon } from './Scene';
import { atlas, pickups, wanted } from './atlas-model';
import { displayName } from '../../library/PokemonName';
import { padding } from '../../../utils/formatting';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { AtlasData, AtlasRow, AtlasState } from './atlas-model';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { TranslationKey } from '../../../i18n/translations';

// a strip's height, unscaled; the names' column beside the strips
const STRIP_H = 22;
const NAMES_W = 210;
const NAMES_W_NARROW = 120;
// a generation's stretch narrower than its name ("Gen 6", 第6世代) shows its number alone
const GEN_LABEL_MIN = 58;
// how many of a list show before the rest are counted
const PICKUPS_MAX = 40;
const WANTED_MAX = 24;
const TIP_GAP = 16;

const STATE_KEYS: Record<AtlasState | 'absent', TranslationKey> = {
  sealed: 'almanac.sealed',
  caught: 'status.caught',
  temporary: 'status.temporary',
  unobtainable: 'status.unobtainable',
  missing: 'almanac.missing',
  absent: 'atlas.absent',
};

const LEGEND: (AtlasState | 'absent')[] = ['sealed', 'caught', 'temporary', 'unobtainable', 'missing', 'absent'];

interface Props {
  onClose: () => void;
  // a species pressed: its first slot in the open dex, as the scene closes
  onLocate: (pokemon: number) => void;
}

// a dex along the national dex: its runs of one state drawn as one bar each, so a strip is a few dozen shapes rather
// than a thousand; a species the dex doesn't list is left as the track
function Strip ({ row, width, max }: { row: AtlasRow; width: number; max: number }) {
  const runs = useMemo(() => {
    const found: { from: number; to: number; state: AtlasState }[] = [];
    for (let national = 1; national <= max; national++) {
      const state = row.states.get(national);
      const last = found[found.length - 1];
      if (state === undefined) {
        continue;
      }
      if (last && last.state === state && last.to === national - 1) {
        last.to = national;
      } else {
        found.push({ from: national, to: national, state });
      }
    }
    return found;
  }, [row, max]);
  const step = width / max;
  return (
    <svg aria-hidden="true" className="at-strip" height={STRIP_H} shapeRendering="crispEdges" width={width}>
      {runs.map((run) => (
        <rect className={`at-${run.state}`} height={STRIP_H} key={run.from} width={Math.max(0.6, (run.to - run.from + 1) * step)} x={(run.from - 1) * step} y={0} />
      ))}
    </svg>
  );
}

// the atlas (G): every one of your dexes as a strip along the national dex, a column per species coloured for how it
// stands there (sealed, caught, temporary, unobtainable, missing, or not in that dex at all), the generations marked
// under them. The pointer (or ← →) runs a line down every strip at once and a loupe says how that species stands in
// each dex; pressed, it goes to its tile here. Under them, what's missing here but marked in another dex, and what's
// still missing from several dexes at once
export function Atlas ({ onClose, onLocate }: Props) {
  const { captures } = useTrackerState();
  const { dexes, activeDex } = useDexContext();
  const { t, locale } = useTranslation();
  const data: AtlasData = useMemo(() => atlas(dexes ?? [], activeDex!.id, captures), [dexes, activeDex, captures]);
  const handed = useMemo(() => pickups(data, activeDex!.id), [data, activeDex]);
  const needed = useMemo(() => wanted(data), [data]);
  const stripsRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hot, setHot] = useState<{ national: number; x: number; y: number } | null>(null);
  const narrow = width > 0 && width < 520;

  useLayoutEffect(() => {
    const strips = stripsRef.current;
    if (!strips) {
      return undefined;
    }
    setWidth(Math.floor(strips.clientWidth));
    // drawn on the next frame, not inside the observer's delivery (see Journeys)
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(next));
    });
    observer.observe(strips);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const names = narrow ? NAMES_W_NARROW : NAMES_W;
  const track = Math.max(0, width - names);
  const step = data.max > 0 ? track / data.max : 0;

  // the open dex's first slot for a species, if it lists it
  const slotHere = (national: number) => captures.find((capture) => capture.pokemon.national_id === national);

  const nameOf = (national: number) => {
    const mon = data.species.get(national);
    return mon ? displayName(mon.name, mon.name_ja, locale) : `#${national}`;
  };

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const zoom = e.currentTarget.currentCSSZoom;
    const x = (e.clientX - rect.left) / zoom - names;
    if (x < 0 || step === 0) {
      return null;
    }
    return Math.min(data.max, Math.max(1, Math.floor(x / step) + 1));
  };

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const national = at(e);
    setHot(national === null ? null : { national, x: e.clientX, y: e.clientY });
  };

  const go = (national: number) => {
    const slot = slotHere(national);
    if (slot) {
      onLocate(slot.pokemon.id);
    }
  };

  // ← → walk the line along the dex (Shift for ten at a time), the first press setting it on #1; Home and End to its
  // ends, Enter goes to the species it's on
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = hot?.national;
    let national = from ?? 1;
    switch (e.key) {
      case 'ArrowLeft': national = from === undefined ? 1 : from - (e.shiftKey ? 10 : 1); break;
      case 'ArrowRight': national = from === undefined ? 1 : from + (e.shiftKey ? 10 : 1); break;
      case 'Home': national = 1; break;
      case 'End': national = data.max; break;
      case 'Enter':
        if (from !== undefined) {
          go(from);
          e.preventDefault();
        }
        return;
      default: return;
    }
    e.preventDefault();
    national = Math.min(data.max, Math.max(1, national));
    const rect = stripsRef.current!.getBoundingClientRect();
    const zoom = stripsRef.current!.currentCSSZoom;
    setHot({ national, x: rect.left + (names + (national - 0.5) * step) * zoom, y: rect.top + rect.height / 2 });
  };

  // the loupe by the line, flipped to its left where the window ends
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || !hot) {
      return;
    }
    const zoom = tip.currentCSSZoom;
    const w = tip.offsetWidth * zoom;
    const h = tip.offsetHeight * zoom;
    const left = hot.x + TIP_GAP + w <= window.innerWidth ? hot.x + TIP_GAP : hot.x - TIP_GAP - w;
    const top = Math.min(window.innerHeight - h - 8, Math.max(8, hot.y - h / 2));
    tip.style.left = `${Math.max(8, left) / zoom}px`;
    tip.style.top = `${top / zoom}px`;
  }, [hot]);

  const loupe = () => {
    if (!hot) {
      return null;
    }
    const mon = data.species.get(hot.national);
    return (
      <div className="at-tip" ref={tipRef} role="status">
        <div className="at-tip-mon">
          {mon && <SceneMon pokemon={mon} zoom={1.5} />}
          <span>
            <strong>{nameOf(hot.national)}</strong>
            <small>#{padding(hot.national, 4)}</small>
          </span>
        </div>
        <ul>
          {data.rows.map((row) => {
            const state = row.states.get(hot.national) ?? 'absent';
            return (
              <li className={classNames({ here: row.dex.id === activeDex!.id })} key={row.dex.id}>
                <span className={`at-swatch at-${state}`} />
                <span className="at-tip-dex">{row.dex.title}</span>
                <span className="at-tip-state">{t(STATE_KEYS[state])}</span>
              </li>
            );
          })}
        </ul>
        <em>{slotHere(hot.national) ? t('atlas.pressToGo') : t('atlas.notHere')}</em>
      </div>
    );
  };

  const mon = (national: number) => {
    const species = data.species.get(national);
    const slot = slotHere(national);
    return (
      <button className="at-mon" disabled={!slot} key={national} onClick={() => go(national)} title={`${nameOf(national)} #${padding(national, 4)}`} type="button">
        {species && <SceneMon pokemon={species} />}
      </button>
    );
  };

  const percent = (row: AtlasRow) => (row.total > 0 ? Math.floor((100 * row.marked) / row.total) : 0);

  return (
    <Scene hint={t('atlas.hint')} name="atlas" onClose={onClose} title={t('atlas.title')}>
      {({ scale }) => (
        <>
          <div className="at-page" style={{ zoom: scale }}>
            <section className="scene-card at-card">
              <h2><span>{t('atlas.strips')}</span></h2>
              <div className="at-legend">
                {LEGEND.map((state) => (
                  <span key={state}><span className={`at-swatch at-${state}`} />{t(STATE_KEYS[state])}</span>
                ))}
              </div>
              <div
                aria-label={t('atlas.strips')}
                className="at-strips"
                onBlur={() => setHot(null)}
                onClick={() => hot && go(hot.national)}
                onKeyDown={handleKeyDown}
                onPointerLeave={() => setHot(null)}
                onPointerMove={handleMove}
                ref={stripsRef}
                role="group"
                style={{ '--names': `${names}px`, '--step': `${step}px` } as CSSProperties}
                tabIndex={0}
              >
                {width > 0 && data.rows.map((row, i) => (
                  <div className={classNames('at-row', { here: row.dex.id === activeDex!.id })} key={row.dex.id} style={{ '--i': i } as CSSProperties}>
                    <span className="at-name">
                      <span className="at-title">{row.dex.title}</span>
                      <span className="at-meta">{t(row.dex.checklist ? 'atlas.checklist' : 'atlas.living')} · {t('atlas.complete', { p: percent(row) })}</span>
                    </span>
                    <span className="at-track">
                      <Strip max={data.max} row={row} width={track} />
                    </span>
                  </div>
                ))}
                {width > 0 && (
                  <div className="at-axis">
                    {data.generations.map((gen) => (
                      <span className="at-gen" key={gen.generation} style={{ left: names + (gen.from - 1) * step, width: (gen.to - gen.from + 1) * step }}>
                        <span>{(gen.to - gen.from + 1) * step < GEN_LABEL_MIN ? gen.generation : t('filter.gen', { n: gen.generation })}</span>
                      </span>
                    ))}
                  </div>
                )}
                {width > 0 && data.generations.slice(1).map((gen) => (
                  <span aria-hidden="true" className="at-divider" key={gen.generation} style={{ left: names + (gen.from - 1) * step }} />
                ))}
                {hot && <span aria-hidden="true" className="at-line" style={{ left: names + (hot.national - 0.5) * step }} />}
              </div>
            </section>
            <div className="at-lists">
              <section className="scene-card at-list" style={{ '--i': 1 } as CSSProperties}>
                <h2><span>{t('atlas.pickups')}</span></h2>
                <p className="at-note">{t('atlas.pickupsNote', { dex: activeDex!.title })}</p>
                {data.rows.length < 2 && <p className="at-empty">{t('atlas.oneDex')}</p>}
                {data.rows.length > 1 && handed.length === 0 && <p className="at-empty">{t('atlas.noPickups')}</p>}
                {handed.map(({ row, nationals }) => (
                  <div className="at-group" key={row.dex.id}>
                    <h3>{row.dex.title}<b>{nationals.length}</b></h3>
                    <div className="at-mons">
                      {nationals.slice(0, PICKUPS_MAX).map(mon)}
                      {nationals.length > PICKUPS_MAX && <span className="at-more">{t('atlas.more', { n: nationals.length - PICKUPS_MAX })}</span>}
                    </div>
                  </div>
                ))}
              </section>
              <section className="scene-card at-list" style={{ '--i': 2 } as CSSProperties}>
                <h2><span>{t('atlas.wanted')}</span></h2>
                <p className="at-note">{t('atlas.wantedNote')}</p>
                {data.rows.length < 2 && <p className="at-empty">{t('atlas.oneDex')}</p>}
                {data.rows.length > 1 && needed.length === 0 && <p className="at-empty">{t('atlas.noWanted')}</p>}
                <ol className="at-wanted">
                  {needed.slice(0, WANTED_MAX).map(({ national, rows }) => (
                    <li key={national}>
                      {mon(national)}
                      <span className="at-wanted-name">{nameOf(national)}</span>
                      <span className="at-wanted-dexes">
                        {rows.map((row) => <span className={classNames('at-chip', { here: row.dex.id === activeDex!.id })} key={row.dex.id}>{row.dex.title}</span>)}
                      </span>
                      <b className="at-wanted-count">×{rows.length}</b>
                    </li>
                  ))}
                </ol>
                {needed.length > WANTED_MAX && <span className="at-more">{t('atlas.more', { n: needed.length - WANTED_MAX })}</span>}
              </section>
            </div>
          </div>
          {hot && <div className="at-tip-layer" style={{ zoom: scale }}>{loupe()}</div>}
        </>
      )}
    </Scene>
  );
}
