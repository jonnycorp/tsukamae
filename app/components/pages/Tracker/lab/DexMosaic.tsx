import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES, ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { CatchOrder, mosaicState } from './CatchOrder';
import { LabTip } from './LabTip';
import { Scene, sceneScroll, useScrollBack } from '../Scene';
import { ScopeSwitch, useLabScope, useScopedRecords } from './LabScope';
import { displayName } from '../../../library/PokemonName';
import { gameColor } from '../../../../utils/game-colors';
import { iconClass } from '../../../../utils/pokemon';
import { localizeBall, localizeOriginGame } from '../../../../i18n/names';
import { useCalm } from './lab-kit';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useLabText } from './lab-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';

import type { CSSProperties } from 'react';
import type { LabProps } from './lab-kit';
import type { LabRecord } from './LabScope';
import type { PersonalDex } from '../../../../utils/local-data';

// the wall's zooms (Ctrl+wheel, Ctrl+= and Ctrl+-, Ctrl+0 back to 1), a tile 44px at 1; a wheel's travel to a step, as
// the dex's
const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
const WHEEL_STEP = 50;

// a dex's wall: a band per generation shown
export interface MosaicWall {
  dex: PersonalDex;
  bands: [generation: number, records: LabRecord[]][];
}

const stepZoom = (zoom: number, by: number) => {
  const at = ZOOMS.reduce((best, z, i) => (Math.abs(z - zoom) < Math.abs(ZOOMS[best] - zoom) ? i : best), 0);
  return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, at + by))];
};

// the tiles, apart from the tip so pointing at one re-renders none of them; a tile found by its key from the wall's own
// pointer (one handler for the lot)
const Wall = memo(function Wall ({ walls, labelled, onPoint }: { walls: MosaicWall[]; labelled: boolean; onPoint: (key: string | null, el?: Element) => void }) {
  const { activeDexView } = useDexContext();
  const { lt } = useLabText();
  const point = (e: { target: EventTarget }) => {
    const tile = (e.target as Element).closest('.lm-tile');
    onPoint(tile?.getAttribute('data-key') ?? null, tile ?? undefined);
  };
  return (
    <div className="lm-wall" onBlur={() => onPoint(null)} onFocus={point} onPointerLeave={() => onPoint(null)} onPointerOver={point}>
      {walls.map(({ dex, bands }) => (
        <section className="lm-dex" key={dex.id}>
          {labelled && <h2>{dex.title}{dex.shiny ? ' ✦' : ''}</h2>}
          {bands.map(([generation, records]) => {
            const have = records.filter(({ capture }) => mosaicState(capture) === 'caught').length;
            return (
              <section className="lm-band" key={generation} style={{ '--n': records.length } as CSSProperties}>
                <h3>
                  <span>{lt('mosaic.gen', { n: generation })}</span>
                  <i style={{ '--f': have / records.length } as CSSProperties} />
                  <small>{have}/{records.length}</small>
                </h3>
                <div className="lm-tiles">
                  {records.map(({ key, capture }) => {
                    const state = mosaicState(capture);
                    return (
                      <button
                        className={`lm-tile st-${state}`}
                        data-key={key}
                        key={key}
                        style={state === 'caught' && capture.origin_game ? { '--ground': gameColor(capture.origin_game) } as CSSProperties : undefined}
                        type="button"
                      >
                        <span className="scene-mon"><i className={iconClass(capture.pokemon, activeDexView!)} /></span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
});

// the dex mosaic: the open dex (or every dex) as one wall, a generation to a band, every mon a tile on the colour of
// the game it came from, a shadow while still missing. The chips above narrow it to generations; Ctrl+wheel zooms it as
// the dex's does. "Catch order" fits all of it to one screen and lights it in the order you caught them (CatchOrder). A
// tile pointed at shows its mon, pressed goes to it in the dex; a game's chip filters the dex to it
export function DexMosaic ({ back, onClose, onFilter, onLocate }: LabProps) {
  const { lt, locale } = useLabText();
  const calm = useCalm();
  const pageRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useLabScope('mosaic');
  const records = useScopedRecords(scope);
  const [zoom, setZoom] = useLocalStorage('labMosaic.zoom', 1);
  const [gens, setGens] = useState<number[]>([]);
  const [order, setOrder] = useState(false);
  const [hot, setHot] = useState<{ record: LabRecord; x: number; y: number } | null>(null);
  // where a zoom was asked from, to keep under the pointer once the wall has its new size
  const anchor = useRef<{ y: number; content: number; from: number } | null>(null);
  const leftAt = useRef(0);

  const generations = useMemo(() => [...new Set(records.map(({ capture }) => capture.pokemon.generation))].sort((a, b) => a - b), [records]);
  const shown = useMemo(() => records.filter(({ capture }) => gens.length === 0 || gens.includes(capture.pokemon.generation)), [records, gens]);

  const walls = useMemo(() => {
    const byDex = new Map<string, MosaicWall & { groups: Map<number, LabRecord[]> }>();
    for (const record of shown) {
      let wall = byDex.get(record.dex.id);
      if (!wall) {
        wall = { dex: record.dex, bands: [], groups: new Map() };
        byDex.set(record.dex.id, wall);
      }
      const generation = record.capture.pokemon.generation;
      wall.groups.set(generation, [...(wall.groups.get(generation) ?? []), record]);
    }
    return [...byDex.values()].map(({ dex, groups }) => ({ dex, bands: [...groups.entries()].sort((a, b) => a[0] - b[0]) }));
  }, [shown]);
  const byKey = useMemo(() => new Map(shown.map((record) => [record.key, record])), [shown]);

  const caught = useMemo(() => shown.filter(({ capture }) => mosaicState(capture) === 'caught'), [shown]);
  // the games the shown caught mons came from, most first, for the key
  const games = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { capture } of caught) {
      if (capture.origin_game) {
        counts.set(capture.origin_game, (counts.get(capture.origin_game) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [caught]);

  useScrollBack(pageRef, back, true);

  const scroller = () => pageRef.current?.closest('.scene-body') ?? null;

  // Ctrl+wheel and Ctrl+=/-/0, the dex's own zoom standing down under a scene; a step keeps what's under the pointer
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    if (order) {
      return undefined;
    }
    let wheel = 0;
    const apply = (next: number, y?: number) => {
      const body = scroller();
      if (!body || next === zoomRef.current) {
        return;
      }
      const at = (y ?? body.getBoundingClientRect().top + body.clientHeight / 2) - body.getBoundingClientRect().top;
      anchor.current = { y: at, content: body.scrollTop + at, from: zoomRef.current };
      setZoom(next);
    };
    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      if (Math.sign(e.deltaY) !== Math.sign(wheel)) {
        wheel = 0;
      }
      wheel += e.deltaY;
      if (Math.abs(wheel) >= WHEEL_STEP) {
        apply(stepZoom(zoomRef.current, wheel < 0 ? 1 : -1), e.clientY);
        wheel = 0;
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) {
        return;
      }
      if (e.key === '=' || e.key === '+') {
        apply(stepZoom(zoomRef.current, 1));
      } else if (e.key === '-' || e.key === '_') {
        apply(stepZoom(zoomRef.current, -1));
      } else if (e.key === '0') {
        apply(1);
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [order, setZoom]);

  useLayoutEffect(() => {
    const body = scroller();
    if (anchor.current && body) {
      const { y, content, from } = anchor.current;
      body.scrollTop = content * (zoom / from) - y;
      anchor.current = null;
    }
  }, [zoom]);

  // back from the catch order where the wall was left
  useLayoutEffect(() => {
    const body = scroller();
    if (!order && body && leftAt.current) {
      body.scrollTop = leftAt.current;
    }
  }, [order]);

  const onPoint = useCallback((key: string | null, el?: Element) => {
    const record = key ? byKey.get(key) : undefined;
    if (!record || !el) {
      setHot(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setHot({ record, x: rect.right, y: rect.top + rect.height / 2 });
  }, [byKey]);

  const toggleGen = (generation: number) => setGens(gens.includes(generation) ? gens.filter((g) => g !== generation) : [...gens, generation]);
  const openOrder = () => {
    leftAt.current = sceneScroll(pageRef.current);
    setHot(null);
    setOrder(true);
  };
  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);

  return (
    <Scene hint={lt('mosaic.hint')} name="lab-mosaic" onClose={onClose} quiet={Boolean(back)} title={lt('mosaic.title')}>
      {({ scale }) => (order
        ? <CatchOrder calm={calm} onBack={() => setOrder(false)} onLocate={onLocate} records={shown} scale={scale} />
        : (
          <div className="lm-page" ref={pageRef} style={{ zoom: scale }}>
            <header className="lm-head">
              <div className="lm-figures">
                <b>{caught.length}</b>
                <span>/{shown.length}<small>{lt('mosaic.caught')}</small></span>
              </div>
              <div className="lm-gens" role="group">
                <button aria-pressed={gens.length === 0} className={classNames({ on: gens.length === 0 })} onClick={() => setGens([])} type="button">{lt('mosaic.genAll')}</button>
                {generations.map((generation) => (
                  <button aria-pressed={gens.includes(generation)} className={classNames({ on: gens.includes(generation) })} key={generation} onClick={() => toggleGen(generation)} type="button">
                    {generation}
                  </button>
                ))}
              </div>
              <div className="lm-controls">
                <ScopeSwitch onChange={setScope} scope={scope} />
                <button className="lm-order-open" disabled={caught.length === 0} onClick={openOrder} type="button">
                  <FontAwesomeIcon icon={faPlay} /> {lt('mosaic.order')}
                </button>
              </div>
            </header>
            <div className="lm-key">
              {games.map(([game, n]) => (
                <button
                  key={game}
                  onClick={() => onFilter({ view: 'all', facets: { origin_game: [game] } }, { scroll: sceneScroll(pageRef.current) })}
                  style={{ '--ground': gameColor(game) } as CSSProperties}
                  title={lt('mosaic.keyPress')}
                  type="button"
                >
                  <i />{gameName(game)}<b>{n}</b>
                </button>
              ))}
            </div>
            <div
              className="lm-zoom"
              onClick={(e) => {
                const record = byKey.get((e.target as Element).closest('.lm-tile')?.getAttribute('data-key') ?? '');
                if (record?.here) {
                  onLocate(record.capture.pokemon.id);
                }
              }}
              style={{ '--size': zoom } as CSSProperties}
            >
              <Wall labelled={walls.length > 1} onPoint={onPoint} walls={walls} />
            </div>

            {hot && (
              <LabTip scale={scale} x={hot.x} y={hot.y}>
                <strong>{displayName(hot.record.capture.pokemon.name, hot.record.capture.pokemon.name_ja, locale)}</strong>
                <small>{lt(`mosaic.state.${mosaicState(hot.record.capture)}`)}{walls.length > 1 ? ` · ${hot.record.dex.title}` : ''}</small>
                {hot.record.capture.captured && (
                  <small>
                    {[
                      hot.record.capture.catch_date && dateLabel(hot.record.capture.catch_date),
                      hot.record.capture.origin_game && gameName(hot.record.capture.origin_game),
                      hot.record.capture.ball && hot.record.capture.ball !== 'unknown' && localizeBall(locale, hot.record.capture.ball, BALL_NAMES.get(hot.record.capture.ball) ?? hot.record.capture.ball),
                    ].filter(Boolean).join(' · ')}
                  </small>
                )}
                {hot.record.here && <em>{lt('mosaic.press')}</em>}
              </LabTip>
            )}
          </div>
        ))}
    </Scene>
  );
}
