import classNames from 'classnames';
import { useMemo, useRef, useState } from 'react';

import { HEX_ORDER, natureStats } from '../../../../utils/display-modes';
import { LabTip } from './LabTip';
import { NATURES } from '../../../../utils/capture-fields';
import { Scene, SceneMon, sceneScroll, useScrollBack } from '../Scene';
import { localizeNature } from '../../../../i18n/names';
import { useLabText } from './lab-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { LabKey } from './lab-i18n';
import type { LabProps } from './lab-kit';
import type { StatLetter } from '../../../../utils/display-modes';

// NATURES runs a row per stat raised and a column per stat lowered, in this order
const AXIS: StatLetter[] = ['A', 'B', 'S', 'C', 'D'];
const STAT_KEYS: Record<StatLetter, LabKey> = {
  H: 'nature.stat.H', A: 'nature.stat.A', B: 'nature.stat.B', C: 'nature.stat.C', D: 'nature.stat.D', S: 'nature.stat.S',
};
const HEX_R = 120;
const TIP_MONS = 24;

const natureName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

// the natures grid: the 25 natures as the table players draw them, a row for the stat each raises and a column for the
// one it lowers, the neutral five down the diagonal; each nature's circle as big as the mons that have it. Beside it,
// the stats' lean: how much your natures have raised and lowered each, on the summary's hexagon. Pointed at, a nature
// shows its mons; pressed, it filters the dex to them
export function NatureGrid ({ back, onClose, onFilter }: LabProps) {
  const { captures } = useTrackerState();
  const { lt, locale } = useLabText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<{ nature: string; x: number; y: number } | null>(null);

  const { byNature, most, lean, total } = useMemo(() => {
    const map = new Map<string, Capture[]>(NATURES.map((nature) => [nature, []]));
    const net = new Map<StatLetter, { up: number; down: number }>(HEX_ORDER.map((stat) => [stat, { up: 0, down: 0 }]));
    let counted = 0;
    for (const capture of captures) {
      if (!capture.captured || capture.status === 'unobtainable' || !capture.nature || !map.has(capture.nature)) {
        continue;
      }
      counted++;
      map.get(capture.nature)!.push(capture);
      const stats = natureStats(capture.nature);
      if (stats && stats !== 'neutral') {
        net.get(stats.up)!.up++;
        net.get(stats.down)!.down++;
      }
    }
    return { byNature: map, most: Math.max(1, ...[...map.values()].map((list) => list.length)), lean: net, total: counted };
  }, [captures]);

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
    <Scene hint={lt('nature.hint')} name="lab-nature" onClose={onClose} quiet={Boolean(back)} title={lt('nature.title')}>
      {({ scale }) => (
        <div className="ln-page" ref={pageRef} style={{ zoom: scale }}>
          <div className="ln-table">
            <span className="ln-corner"><small>{lt('nature.up')} ↓ / {lt('nature.down')} →</small></span>
            {AXIS.map((stat) => <span className="ln-axis down" key={stat}>{lt(STAT_KEYS[stat])}<b>{stat}</b></span>)}
            {AXIS.map((up, row) => (
              <div className="ln-row" key={up}>
                <span className="ln-axis up">{lt(STAT_KEYS[up])}<b>{up}</b></span>
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
                      style={{ '--f': Math.sqrt(mons.length / most), '--i': row * 5 + col } as CSSProperties}
                      type="button"
                    >
                      <i className="ln-disc" />
                      <span className="ln-name">{name(nature)}</span>
                      <b className="ln-n">{mons.length}</b>
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
                return <text className="ln-hex-label" key={stat} textAnchor="middle" x={x} y={y + 4}>{stat}</text>;
              })}
            </svg>
            <p className="ln-legend"><i className="up" />{lt('nature.raised')}<i className="down" />{lt('nature.lowered')}</p>
            <p className="ln-total">{lt('nature.total', { n: total })}</p>
          </aside>

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{name(hot.nature)}</strong>
              <small>{(() => {
                const stats = natureStats(hot.nature);
                return stats === 'neutral' || !stats ? lt('nature.neutral') : `${stats.up}↑ ${stats.down}↓`;
              })()} · {lt('nature.count', { n: hotMons.length })}</small>
              <span className="lab-tip-mons">
                {hotMons.slice(0, TIP_MONS).map((capture) => <SceneMon key={capture.pokemon.id} pokemon={capture.pokemon} />)}
              </span>
              <em>{lt('nature.press')}</em>
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
