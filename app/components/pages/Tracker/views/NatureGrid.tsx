import classNames from 'classnames';
import { useMemo, useRef, useState } from 'react';

import { HEX_ORDER, natureStats } from '../../../../utils/display-modes';
import { ViewTip } from './ViewTip';
import { NATURES } from '../../../../utils/capture-fields';
import { Scene, SceneMon, sceneScroll, useScrollBack } from '../Scene';
import { ScopeSwitch, useViewScope, useScopedRecords } from './ViewScope';
import { localizeNature } from '../../../../i18n/names';
import { useViewText } from './views-i18n';

import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { ViewKey } from './views-i18n';
import type { ViewProps } from './views-kit';
import type { ViewRecord } from './ViewScope';
import type { StatLetter } from '../../../../utils/display-modes';

// NATURES runs a row per stat raised and a column per stat lowered, in this order
const AXIS: StatLetter[] = ['A', 'B', 'S', 'C', 'D'];
const STAT_KEYS: Record<StatLetter, ViewKey> = {
  H: 'nature.stat.H', A: 'nature.stat.A', B: 'nature.stat.B', C: 'nature.stat.C', D: 'nature.stat.D', S: 'nature.stat.S',
};
const HEX_R = 120;
const TIP_MONS = 24;
// the latest caught of a nature, fanned across its cell
const PILE = 5;

const natureName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

// the natures grid: the 25 natures as the table players draw them, a row for the stat each raises and a column for the
// one it lowers, the neutral five down the diagonal. Each stat has a colour; a cell is washed in its raised stat's
// running into its lowered one's, as deep as its share of your mons, the latest few of them fanned across it. Beside it,
// the stats' lean: how much your natures have raised and lowered each, on the summary's hexagon. Pointed at, a nature
// shows its mons; pressed, it filters the dex to them
export function NatureGrid ({ back, onClose, onFilter }: ViewProps) {
  const { lt, locale } = useViewText();
  const [scope, setScope] = useViewScope('nature');
  const records = useScopedRecords(scope);
  const pageRef = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<{ nature: string; x: number; y: number } | null>(null);

  const { byNature, most, lean, total } = useMemo(() => {
    const map = new Map<string, ViewRecord[]>(NATURES.map((nature) => [nature, []]));
    const net = new Map<StatLetter, { up: number; down: number }>(HEX_ORDER.map((stat) => [stat, { up: 0, down: 0 }]));
    let counted = 0;
    for (const record of records) {
      const { capture } = record;
      if (!capture.captured || capture.status === 'unobtainable' || !capture.nature || !map.has(capture.nature)) {
        continue;
      }
      counted++;
      map.get(capture.nature)!.push(record);
      const stats = natureStats(capture.nature);
      if (stats && stats !== 'neutral') {
        net.get(stats.up)!.up++;
        net.get(stats.down)!.down++;
      }
    }
    // each nature's latest caught first
    for (const list of map.values()) {
      list.sort((a, b) => (b.capture.catch_date ?? '').localeCompare(a.capture.catch_date ?? ''));
    }
    return { byNature: map, most: Math.max(1, ...[...map.values()].map((list) => list.length)), lean: net, total: counted };
  }, [records]);
  const top = NATURES.reduce((best, nature) => (byNature.get(nature)!.length > byNature.get(best)!.length ? nature : best), NATURES[0]);

  useScrollBack(pageRef, back, true);

  const show = (nature: string) => (e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHot({ nature, x: rect.right, y: rect.top + rect.height / 2 });
  };
  const name = (nature: string) => localizeNature(locale, nature, natureName(nature));

  // the hexagon: each stat's corner, and how far out its raised and lowered shapes reach
  const leanMost = Math.max(1, ...[...lean.values()].flatMap(({ up, down }) => [up, down]));
  const corner = (k: number, r: number) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const shape = (pick: 'up' | 'down') => HEX_ORDER.map((stat, k) => corner(k, 14 + (HEX_R - 14) * (lean.get(stat)![pick] / leanMost)).map((v) => v.toFixed(1)).join(',')).join(' ');

  const hotMons = hot ? byNature.get(hot.nature) ?? [] : [];

  return (
    <Scene hint={lt('nature.hint')} name="view-nature" onClose={onClose} quiet={Boolean(back)} title={lt('nature.title')}>
      {({ scale }) => (
        <div className="ln-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="ln-head">
            <div className="ln-figure"><b>{total}</b><small>{lt('nature.total')}</small></div>
            {total > 0 && <div className="ln-figure"><b>{name(top)}</b><small>{lt('nature.top', { n: byNature.get(top)!.length })}</small></div>}
            <ScopeSwitch onChange={setScope} scope={scope} />
          </header>
          <div className="ln-body">
            <div className="ln-table">
              <span className="ln-corner"><small>{lt('nature.up')} ↓ / {lt('nature.down')} →</small></span>
              {AXIS.map((stat) => <span className="ln-axis down" key={stat} style={{ '--stat': `var(--ln-${stat})` } as CSSProperties}>{lt(STAT_KEYS[stat])}<b>{stat}</b></span>)}
              {AXIS.map((up, row) => (
                <div className="ln-row" key={up}>
                  <span className="ln-axis up" style={{ '--stat': `var(--ln-${up})` } as CSSProperties}>{lt(STAT_KEYS[up])}<b>{up}</b></span>
                  {AXIS.map((down, col) => {
                    const nature = NATURES[row * 5 + col];
                    const mons = byNature.get(nature)!;
                    return (
                      <button
                        className={classNames('ln-cell', { neutral: row === col, empty: mons.length === 0, hot: hot?.nature === nature })}
                        disabled={mons.length === 0}
                        key={down}
                        onBlur={() => setHot(null)}
                        onClick={() => onFilter({ view: 'all', facets: { nature: [nature] } }, { scroll: sceneScroll(pageRef.current) })}
                        onFocus={show(nature)}
                        onPointerEnter={show(nature)}
                        onPointerLeave={() => setHot(null)}
                        style={{ '--f': mons.length / most, '--i': row * 5 + col, '--up': `var(--ln-${up})`, '--down': `var(--ln-${down})` } as CSSProperties}
                        type="button"
                      >
                        <span className="ln-name">{name(nature)}</span>
                        <b className="ln-n">{mons.length}</b>
                        <span className="ln-pile">
                          {mons.slice(0, PILE).map(({ key, capture, view }, k) => (
                            <span key={key} style={{ '--k': k } as CSSProperties}><SceneMon pokemon={capture.pokemon} shiny={capture.shiny} view={view} /></span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <aside className="ln-lean">
              <h2>{lt('nature.lean')}</h2>
              <svg aria-hidden="true" height={HEX_R * 2 + 70} viewBox={`${-HEX_R - 35} ${-HEX_R - 35} ${HEX_R * 2 + 70} ${HEX_R * 2 + 70}`} width={HEX_R * 2 + 70}>
                {[1, 0.66, 0.33].map((f) => (
                  <polygon className="ln-hex-ring" key={f} points={HEX_ORDER.map((_, k) => corner(k, HEX_R * f).map((v) => v.toFixed(1)).join(',')).join(' ')} />
                ))}
                <polygon className="ln-hex-down" points={shape('down')} />
                <polygon className="ln-hex-up" points={shape('up')} />
                {HEX_ORDER.map((stat, k) => {
                  const [x, y] = corner(k, HEX_R + 20);
                  return <text className="ln-hex-label" key={stat} style={{ fill: `var(--ln-${stat})` }} textAnchor="middle" x={x} y={y + 4}>{stat}</text>;
                })}
              </svg>
              <p className="ln-legend"><i className="up" />{lt('nature.raised')}<i className="down" />{lt('nature.lowered')}</p>
            </aside>
          </div>

          {hot && (
            <ViewTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{name(hot.nature)}</strong>
              <small>{(() => {
                const stats = natureStats(hot.nature);
                return stats === 'neutral' || !stats ? lt('nature.neutral') : `${stats.up}↑ ${stats.down}↓`;
              })()} · {lt('nature.count', { n: hotMons.length })}</small>
              <span className="view-tip-mons">
                {hotMons.slice(0, TIP_MONS).map(({ key, capture, view }) => <SceneMon key={key} pokemon={capture.pokemon} shiny={capture.shiny} view={view} />)}
              </span>
              <em>{lt('nature.press')}</em>
            </ViewTip>
          )}
        </div>
      )}
    </Scene>
  );
}
