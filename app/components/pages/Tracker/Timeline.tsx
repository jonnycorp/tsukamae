import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faRotateRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { PokemonName } from '../../library/PokemonName';
import { SLOT_H, SLOT_W, layoutTimeline } from './timeline-layout';
import { iconClass } from '../../../utils/pokemon';
import { overrideTitleBar } from '../../../palette/apply-theme';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Dex } from '../../../types';
import type { MonthSegment, TimelineLayout, TimelineSprite } from './timeline-layout';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { TranslationKey } from '../../../i18n/translations';

// keep in sync with styles/timeline.scss: the stage's colour (under the window buttons too), the spine's distance from
// the stage's bottom, which holds the month labels and year banners, and the room kept above the tallest pile
const STAGE_COLOR = { color: '#151019', symbolColor: '#f6f1ff' };
const SPINE_BOTTOM = 96;
const HEADROOM = 56;
const SKIP_INSET = 16;
// the hover card's tallest (with a nickname) and its distance from the mon
const CARD_HEIGHT = 96;
const CARD_GAP = 12;

// the entrance: the title card holds the stage until INTRO_MS, then every mon drops in date order across the cascade,
// each landing over DROP_MS
const INTRO_MS = 1250;
const DROP_MS = 520;

function cascadeMs (count: number): number {
  return Math.min(3400, Math.max(700, count * 5));
}

function dropDelay (order: number, count: number): number {
  return INTRO_MS + (count > 1 ? order / (count - 1) : 0) * cascadeMs(count);
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

function laterLabel (months: number, t: Translate): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years > 0 ? t(years === 1 ? 'timeline.year' : 'timeline.years', { n: years }) : '',
    rest > 0 ? t(rest === 1 ? 'timeline.month' : 'timeline.months', { n: rest }) : '',
  ].filter(Boolean);
  return t('timeline.later', { span: parts.join(t('timeline.join')) });
}

interface TrackProps {
  dex: Dex;
  layout: TimelineLayout;
  monthName: (year: number, month: number) => string;
  t: Translate;
}

// the stage's contents, apart from the hover card, so a hover re-renders the card rather than every mon
const Track = memo(function Track ({ dex, layout, monthName, t }: TrackProps) {
  const count = layout.sprites.length;

  return (
    <>
      <div className="tl-spine" />
      {layout.segments.map((segment) => {
        if (segment.kind === 'skip') {
          return (
            // inset, so its slant keeps clear of the piles either side
            <div className="tl-skip" key={`skip-${segment.firstOrder}`} style={{ left: segment.x + SKIP_INSET, width: segment.width - 2 * SKIP_INSET, animationDelay: `${dropDelay(segment.firstOrder, count)}ms` }}>
              <span>{laterLabel(segment.months, t)}</span>
            </div>
          );
        }
        if (segment.kind === 'undated') {
          return (
            <div className="tl-month tl-undated" key="undated" style={{ left: segment.x, width: segment.width }}>
              <span className="tl-month-label">{t('timeline.unknown')}</span>
            </div>
          );
        }
        return (
          <div className={classNames('tl-month', { empty: segment.count === 0 })} key={`${segment.year}-${segment.month}`} style={{ left: segment.x, width: segment.width }}>
            {segment.count > 0 && <span className="tl-month-label">{monthName(segment.year, segment.month)}</span>}
            {segment.opensYear &&
              <span className="tl-year" style={{ animationDelay: `${dropDelay(segment.firstOrder, count)}ms` }}><span>{segment.year}</span></span>
            }
          </div>
        );
      })}
      {layout.sprites.map(({ capture, x, row, order, dated }) => (
        <div
          className={classNames('tl-mon', { sealed: capture.sealed, temporary: capture.status === 'temporary', undated: !dated })}
          data-order={order}
          key={capture.pokemon.id}
          style={{ left: x, bottom: SPINE_BOTTOM + row * SLOT_H, animationDelay: `${dropDelay(order, count)}ms` }}
        >
          <i className={iconClass(capture.pokemon, dex)} />
        </div>
      ))}
    </>
  );
});

interface Props {
  onClose: () => void;
  // a mon clicked on the stage: closes it and opens that mon's tile
  onLocate: (pokemon: number) => void;
}

// the dex's catches as a scene of their own: a title card slams in, the timeline's spine draws across, and every
// marked mon drops onto the month it was caught in, oldest first, while the stage pans along with them
export function Timeline ({ onClose, onLocate }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();

  const stageRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLElement>(null);
  const [rowsMax, setRowsMax] = useState(0);
  // replay bumps it, remounting the track so every animation starts over
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState(false);
  const [hovered, setHovered] = useState<TimelineSprite | null>(null);

  const layout = useMemo(() => layoutTimeline(captures, rowsMax || 1), [captures, rowsMax]);
  const count = layout.sprites.length;
  // the entrance's loop reads the newest layout: the first is laid out before the stage is measured
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  // a skip ends the entrance's loop where it is
  const settledRef = useRef(settled);
  settledRef.current = settled;

  // Mar, or 3月; and with the year in each language's order, Feb 2017 or 2017年2月
  const monthName = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { month: 'short' });
    return (year: number, month: number) => format.format(new Date(year, month - 1, 1));
  }, [locale]);
  const monthYear = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'short' });
    return (year: number, month: number) => format.format(new Date(year, month - 1, 1));
  }, [locale]);

  useInertPage();

  // focus on the stage while it's up, so the arrow keys scroll it rather than the dex behind; on close it falls back to
  // the page, not to the Timeline button, where Space would open it again instead of pausing the flips
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  // the window buttons sit on the stage now, so they take its colours while it's up; sent once the change has painted,
  // as applyTheme does, so they never switch a frame ahead of the stage or the nav
  useEffect(() => {
    const send = (colors: typeof STAGE_COLOR | null) => requestAnimationFrame(() => setTimeout(() => overrideTitleBar(colors)));
    send(STAGE_COLOR);
    return () => {
      send(null);
    };
  }, []);

  // piles grow as tall as the stage allows, then widen; measured before the first paint, so nothing lands twice
  useLayoutEffect(() => {
    const stage = stageRef.current!;
    const measure = () => {
      setRowsMax(Math.max(4, Math.floor((stage.clientHeight - SPINE_BOTTOM - HEADROOM) / SLOT_H)));
      setHovered(null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // the entrance, per run: counts the mons in as they land and pans the stage along with the front of the cascade,
  // until it's scrolled by hand; settles once the last one is down
  useEffect(() => {
    const stage = stageRef.current!;
    stage.scrollLeft = 0;
    const counter = counterRef.current;
    const total = layoutRef.current.sprites.length;
    const end = INTRO_MS + cascadeMs(total) + DROP_MS;
    const start = performance.now();
    let following = true;
    let frame = 0;
    const stopFollowing = () => {
      following = false;
    };
    const step = (now: number) => {
      if (settledRef.current) {
        return;
      }
      const elapsed = now - start - INTRO_MS;
      const sprites = layoutRef.current.sprites;
      if (elapsed >= 0 && sprites.length > 0) {
        const landed = Math.min(sprites.length, Math.floor(1 + (elapsed / cascadeMs(sprites.length)) * (sprites.length - 1)));
        if (counter) {
          counter.textContent = String(landed);
        }
        if (following) {
          const target = Math.max(0, sprites[landed - 1].x - stage.clientWidth * 0.62);
          stage.scrollLeft += (target - stage.scrollLeft) * 0.14;
        }
      }
      if (now - start < end) {
        frame = requestAnimationFrame(step);
      }
    };
    if (counter) {
      counter.textContent = '0';
    }
    frame = requestAnimationFrame(step);
    const done = window.setTimeout(() => setSettled(true), end);
    stage.addEventListener('wheel', stopFollowing, { passive: true });
    stage.addEventListener('pointerdown', stopFollowing);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
      stage.removeEventListener('wheel', stopFollowing);
      stage.removeEventListener('pointerdown', stopFollowing);
    };
  }, [run]);

  useEffect(() => {
    if (settled && counterRef.current) {
      counterRef.current.textContent = String(count);
    }
  }, [settled, count]);

  // Escape closes; while the entrance plays, any other key (or a click) skips to the end of it. A skip's key is claimed,
  // so it can't also press the focused Replay or scroll anything, and a modifier alone (an Alt+Tab begun) isn't one
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (!settled && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        e.preventDefault();
        if (!e.repeat) {
          setSettled(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, settled]);

  // the stage reads left to right in time, so the wheel scrolls it sideways; Ctrl+wheel zooms nothing here
  useEffect(() => {
    const stage = stageRef.current!;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return;
      }
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        stage.scrollLeft += delta;
      }
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, []);

  const spriteAt = (target: EventTarget): TimelineSprite | null => {
    const el = target instanceof Element ? target.closest<HTMLElement>('.tl-mon') : null;
    return el ? layout.sprites[Number(el.dataset.order)] ?? null : null;
  };

  const handleClick = (e: ReactMouseEvent) => {
    if (!settled) {
      setSettled(true);
      return;
    }
    const sprite = spriteAt(e.target);
    if (sprite) {
      onLocate(sprite.capture.pokemon.id);
    }
  };

  const handleReplay = () => {
    setSettled(false);
    setHovered(null);
    setRun((n) => n + 1);
    stageRef.current?.focus({ preventScroll: true });
  };

  const yearSegments = layout.segments.filter((segment): segment is MonthSegment => segment.kind === 'month' && segment.opensYear);
  const first = yearSegments[0]?.year;
  const last = yearSegments[yearSegments.length - 1]?.year;

  let card = null;
  if (hovered && settled) {
    const { capture } = hovered;
    const above = SPINE_BOTTOM + (hovered.row + 1) * SLOT_H + CARD_GAP;
    const roomAbove = (stageRef.current?.clientHeight ?? 0) - above >= CARD_HEIGHT;
    const place = roomAbove ? { bottom: above } : { bottom: Math.max(0, SPINE_BOTTOM + hovered.row * SLOT_H - CARD_GAP - CARD_HEIGHT) };
    card = (
      <div className="tl-card" style={{ left: hovered.x + SLOT_W / 2, ...place }}>
        <b><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></b>
        {capture.has_nickname && capture.nickname && <span className="tl-card-nickname">{capture.nickname}</span>}
        <span className="tl-card-date">{hovered.dated ? capture.catch_date!.replaceAll('-', '/') : t('timeline.noDate')}</span>
        <span className={classNames('tl-card-status', capture.sealed ? 'sealed' : capture.status)}>
          {capture.sealed ? t('seal.sealed') : t(`status.${capture.status ?? 'caught'}`)}
        </span>
      </div>
    );
  }

  return createPortal(
    <div aria-label={t('timeline.title')} aria-modal="true" className="timeline" role="dialog">
      <div className="tl-bar">
        <div className="tl-logo"><span>{t('timeline.title')}</span></div>
        <div className="tl-dex">{activeDex!.title}</div>
        <div className="tl-stats">
          <span><b ref={counterRef} /> / {count}</span>
          {first !== undefined && <span>{first === last ? first : t('common.range', { from: first, to: last! })}</span>}
          {layout.peak &&
            <span>{t('timeline.peak', { month: monthYear(layout.peak.year, layout.peak.month), count: layout.peak.count })}</span>
          }
          {layout.undated > 0 && <span>{t('timeline.undated', { count: layout.undated })}</span>}
        </div>
        <button aria-label={t('timeline.replay')} className="tl-button" onClick={handleReplay} title={t('timeline.replay')} type="button">
          <FontAwesomeIcon icon={faRotateRight} />
        </button>
        <button aria-label={t('popover.close')} className="tl-button" onClick={onClose} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div
        className={classNames('tl-stage', { settled })}
        onClick={handleClick}
        onMouseLeave={() => setHovered(null)}
        onMouseOver={(e) => setHovered(spriteAt(e.target))}
        ref={stageRef}
        tabIndex={-1}
      >
        {rowsMax > 0 &&
          <div className="tl-track" key={run} style={{ width: layout.width }}>
            <Track dex={activeDexView!} layout={layout} monthName={monthName} t={t} />
            {card}
          </div>
        }
        {count === 0 && <p className="tl-empty">{t('timeline.empty')}</p>}
      </div>

      {!settled &&
        <div className="tl-intro" key={`intro-${run}`}>
          <div className="tl-intro-flash" />
          <div className="tl-intro-slash" />
          <div className="tl-intro-title"><span>{t('timeline.title')}</span></div>
          <div className="tl-intro-sub"><span>{activeDex!.title}</span></div>
          <div className="tl-intro-skip">{t('timeline.skip')}</div>
        </div>
      }
    </div>,
    document.body,
  );
}
