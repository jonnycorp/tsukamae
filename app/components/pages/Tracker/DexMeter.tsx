import classNames from 'classnames';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { AnimationEvent, CSSProperties } from 'react';
import type { TranslationKey } from '../../../i18n/translations';

interface Props {
  caught: number;
  marked: number;
  temporary: number;
  total: number;
}

// the figure's count, as long as the bar's draw-in as the dex opens and its spring to a new value (styles/meter.scss)
export const COUNT_MS = 700;

interface Pop {
  id: number;
  delta: number;
  at: number;
}

// the dex's progress, the header's centerpiece: a bar the header's width, so marking one mon moves its edge, filled as
// a glass tube is with water, one colour for everything marked, under a slanted banner of the percentage; nothing else
// inside it, so the edge always shows (its counts are MeterCounts, under it, by status). Its moves
// are the timeline's: it draws in as the dex opens and the figure counts up, its water drifts; a change springs its
// edge, pops the difference off it and runs a shine down what's filled; a tenth crossed upward flares there under a
// banner of it slammed over the bar, in place of the pop. Still mode keeps every bit of it still: the figure and the
// edge go straight to a change, with nothing popped, run or slammed
export function DexMeter ({ marked, total }: Pick<Props, 'marked' | 'total'>) {
  const { t } = useTranslation();
  const { still } = useThemeContext();
  const percent = total > 0 ? (100 * marked) / total : 0;

  // the figure, written straight to its text node as it counts, so nothing renders per frame: from nothing as the dex
  // opens, from wherever it had got to after that
  const figureRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(0);
  useLayoutEffect(() => {
    const el = figureRef.current;
    if (!el) {
      return undefined;
    }
    const show = (n: number) => {
      shownRef.current = n;
      el.textContent = `${n.toFixed(1)}%`;
    };
    if (still) {
      show(percent);
      return undefined;
    }
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    // a frame's time can be a moment before the start, which would count below where it set out (a "-0.0%")
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      show(from + (percent - from) * (1 - (1 - progress) ** 3));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    show(from);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [percent, still]);

  // each change after the dex opened (its tracker mounts afresh per dex, so never a switch): the difference, or a
  // tenth crossed upward
  const lastRef = useRef(marked);
  const [pops, setPops] = useState<Pop[]>([]);
  const [milestone, setMilestone] = useState<{ id: number; tenth: number } | null>(null);
  useEffect(() => {
    const before = lastRef.current;
    lastRef.current = marked;
    if (marked === before || total === 0 || still) {
      return;
    }
    const id = performance.now();
    const tenth = (n: number) => Math.floor((10 * n) / total);
    if (tenth(marked) > tenth(before)) {
      setMilestone({ id, tenth: tenth(marked) });
    } else {
      setPops((prev) => [...prev, { id, delta: marked - before, at: (100 * marked) / total }]);
    }
  }, [marked, total, still]);
  // still mode lets go of whatever was mid-move
  useEffect(() => {
    if (still) {
      setPops([]);
      setMilestone(null);
    }
  }, [still]);
  const latest = pops[pops.length - 1];

  const endMilestone = (e: AnimationEvent) => {
    if (e.animationName === 'meter-fade') {
      setMilestone(null);
    }
  };

  return (
    <div aria-label={t('meter.label')} aria-valuemax={total} aria-valuemin={0} aria-valuenow={marked} className="dex-meter" role="progressbar">
      <div className="dex-meter-figure"><span ref={figureRef} /></div>
      <div className="dex-meter-bar">
        <div className="dex-meter-track">
          <div className="dex-meter-liquid">
            <div className="dex-meter-fill" style={{ width: `${percent}%` }} />
            <div className="dex-meter-water" style={{ width: `${percent}%` }} />
          </div>
          {latest && <span className="dex-meter-shine" key={latest.id} style={{ width: `${percent}%` }} />}
          <span className="dex-meter-edge" style={{ left: `${percent}%`, '--meter-at': percent } as CSSProperties} />
          {milestone && <i className="dex-meter-flare" key={milestone.id} style={{ left: `${milestone.tenth * 10}%` }} />}
          {pops.map((pop) => (
            <span
              className={classNames('dex-meter-pop', { down: pop.delta < 0 })}
              key={pop.id}
              onAnimationEnd={() => setPops((prev) => prev.filter((entry) => entry.id !== pop.id))}
              style={{ '--at': `${pop.at}%` } as CSSProperties}
            >
              {pop.delta > 0 ? `+${pop.delta}` : `−${-pop.delta}`}
            </span>
          ))}
          {milestone &&
            <span className="dex-meter-milestone" key={milestone.id} onAnimationEnd={endMilestone} style={{ '--at': `${milestone.tenth * 10}%` } as CSSProperties}>
              {milestone.tenth * 10}%
            </span>
          }
        </div>
      </div>
    </div>
  );
}

// the meter's counts, under its right end at the filters' row's end: marked, to go, temporary, caught
export function MeterCounts ({ caught, marked, temporary, total }: Props) {
  const { t } = useTranslation();
  // a template's {n} drawn bold, wherever the language puts it: "476 marked", 記録済み476
  const count = (key: TranslationKey, n: number, className?: string) => {
    const [before, after] = t(key).split('{n}');
    return <>{before}<b className={className}>{n}</b>{after}</>;
  };
  return (
    <span className="dex-meter-counts">
      {count('progress.marked', marked)}{t('common.listSeparator')}{count('progress.toGo', total - marked)}
      {temporary > 0 && <>{t('common.listSeparator')}{count('progress.temporary', temporary, 'temporary-count')}</>}
      {caught > 0 && <>{t('common.listSeparator')}{count('progress.caught', caught, 'caught-count')}</>}
    </span>
  );
}
