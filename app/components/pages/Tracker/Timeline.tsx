import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faClock, faGamepad, faLock, faMinus, faPlus, faRotateRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { LANGUAGE_ABBRS, ORIGIN_GAME_NAMES, findSave, nameLang } from '../../../utils/capture-fields';
import { OriginMark } from './seal-faces';
import { PokemonName, displayName } from '../../library/PokemonName';
import { SLOT_H, SLOT_W, layoutTimeline } from './timeline-layout';
import { TitleCard, useCalmStart } from './TitleCard';
import { iconClass } from '../../../utils/pokemon';
import { localizeOriginGame } from '../../../i18n/names';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, Dex } from '../../../types';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Locale, TranslationKey } from '../../../i18n/translations';
import type { MonthSegment, TimelineLayout, TimelineSprite } from './timeline-layout';

// keep in sync with styles/timeline.scss: the stage's colour (under the window buttons too), the spine's distance from
// the stage's bottom, which holds the month and day labels and the year banners, and the room kept above the tallest
// stack
const SPINE_BOTTOM = 96;
const HEADROOM = 56;
// the stage's scrollbars' thickness: the fit always leaves the horizontal one its room, or a track just wider than the
// stage would fit itself out from under its own scrollbar and back, every frame
const SCROLLBAR = 10;
const SKIP_INSET = 16;
// the hover card's tallest (with a nickname) and its distance from the mon
const CARD_HEIGHT = 100;
const CARD_GAP = 12;

// the stage opens fitting its tallest stack, though never past 100% nor under FIT_MIN, below which it scrolls up to
// the rest; from there it zooms out to ZOOM_MIN, or as far as the tallest stack takes to fit (to ZOOM_FLOOR), and in
// to ZOOM_MAX
const FIT_MIN = 0.35;
const ZOOM_MIN = 0.2;
const ZOOM_FLOOR = 0.05;
const ZOOM_MAX = 2;
const ZOOM_STEP = 1.25;
// a press that moves this far is a drag, which pans the stage, rather than a click
const DRAG_PX = 5;

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

interface AxisProps {
  count: number;
  layout: TimelineLayout;
  monthName: (year: number, month: number) => string;
  t: Translate;
}

// the ground under the stacks, drawn at the screen's size whatever the zoom: the spine, each month's tick and name, each
// day's date under its stack, the years' banners, and the cards for long lulls. Positions are unscaled (--x, --w) and
// the track's --z places them, so a zoom restyles them rather than rendering them again; a label that wouldn't fit at
// the zoom fades (styles/timeline.scss)
const Axis = memo(function Axis ({ count, layout, monthName, t }: AxisProps) {
  return (
    <>
      <div className="tl-spine" />
      <div className="tl-axis">
        {layout.segments.map((segment) => {
          if (segment.kind === 'skip') {
            return null;
          }
          if (segment.kind === 'undated') {
            return (
              <div className="tl-month tl-undated" key="undated" style={{ '--x': segment.x, '--w': segment.width } as CSSProperties}>
                <span className="tl-month-label">{t('timeline.unknown')}</span>
              </div>
            );
          }
          return (
            <div
              className={classNames('tl-month', { empty: segment.count === 0 })}
              key={`${segment.year}-${segment.month}`}
              style={{ '--x': segment.x, '--w': segment.width } as CSSProperties}
            >
              {segment.days.map((day) => <span className="tl-day" key={day.dx} style={{ '--dx': day.dx } as CSSProperties}>{day.day}</span>)}
              {segment.count > 0 && <span className="tl-month-label">{monthName(segment.year, segment.month)}</span>}
              {segment.opensYear &&
                <span className="tl-year" style={{ animationDelay: `${dropDelay(segment.firstOrder, count)}ms` }}><span>{segment.year}</span></span>
              }
            </div>
          );
        })}
      </div>
      {/* the lulls' cards outside it, each popping up on its own turn in the cascade, never dimmed by the months' fade */}
      {layout.segments.map((segment) => segment.kind === 'skip' &&
        // inset, so its slant keeps clear of the stacks either side
        <div
          className="tl-skip"
          key={`skip-${segment.firstOrder}`}
          style={{ '--x': segment.x + SKIP_INSET, '--w': segment.width - 2 * SKIP_INSET, animationDelay: `${dropDelay(segment.firstOrder, count)}ms` } as CSSProperties}
        >
          <span>{laterLabel(segment.months, t)}</span>
        </div>,
      )}
    </>
  );
});

interface MonsProps {
  dex: Dex;
  layout: TimelineLayout;
  locale: Locale;
}

// every mon, at the unscaled size and place the zoomed scene around them scales; so a hover re-renders the card, and a
// zoom the scene's zoom, rather than every mon. Each drops in on its turn, when the entrance gives it .dropping
const Mons = memo(function Mons ({ dex, layout, locale }: MonsProps) {
  return (
    <>
      {layout.sprites.map(({ capture, x, row, order, dated }) => (
        <div
          className={classNames('tl-mon', { sealed: capture.sealed, temporary: capture.status === 'temporary', undated: !dated })}
          data-copy-name={displayName(capture.pokemon.name, capture.pokemon.name_ja, locale)}
          data-order={order}
          key={capture.pokemon.id}
          style={{ left: x, bottom: row * SLOT_H }}
        >
          <i className={iconClass(capture.pokemon, dex)} />
        </div>
      ))}
    </>
  );
});

// where a mon came from: its game, its language and its OT, and whether those three make it one of your own
// playthroughs (My Games)
function CardOrigin ({ capture }: { capture: Capture }) {
  const { saves } = useDexContext();
  const { t, locale } = useTranslation();

  if (!capture.origin_game) {
    return null;
  }
  const game = localizeOriginGame(locale, capture.origin_game, ORIGIN_GAME_NAMES.get(capture.origin_game) ?? capture.origin_game);
  const abbr = capture.language ? LANGUAGE_ABBRS.get(capture.language) : undefined;
  const yours = Boolean(capture.ot && findSave(saves, capture.origin_game, capture.language, capture.tid, capture.ot)?.ot === capture.ot);

  return (
    <span className="tl-card-origin">
      <OriginMark game={capture.origin_game} />
      {abbr ? t('saves.label', { game, language: abbr }) : game}
      {capture.ot &&
        <>
          {t('timeline.originSeparator')}
          <span lang={nameLang(capture.ot, capture.language)}>{capture.ot}</span>
        </>
      }
      {yours && <FontAwesomeIcon icon={faGamepad} title={t('timeline.yours')} />}
    </span>
  );
}

interface Anchor {
  // the point held in place: its unscaled distance along the track, and its unscaled height above the spine, or for a
  // point in the band under the spine, which doesn't scale, null and its distance from the bottom as it is
  u: number;
  above: number | null;
  fromBottom: number;
  // where it's held, in the stage; a null py is the stage's bottom edge, wherever that is after a resize
  px: number;
  py: number | null;
}

interface Drag {
  id: number;
  x: number;
  y: number;
  left: number;
  top: number;
  moved: boolean;
}

interface Props {
  onClose: () => void;
  // a mon clicked on the stage: closes it and opens that mon's tile
  onLocate: (pokemon: number) => void;
}

// the dex's catches as a scene of their own: a title card slams in, the timeline's spine draws across, and every
// marked mon drops onto the day it was caught, oldest first, while the stage pans along with them. Then it zooms
// (Ctrl+wheel, + and −, or the bar's buttons) and pans (drag, wheel, Shift+wheel) like a map
export function Timeline ({ onClose, onLocate }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();

  const stageRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLElement>(null);
  // the view's size, and the height the fit has, whether or not the horizontal scrollbar is up
  const [stageSize, setStageSize] = useState<{ width: number; height: number; fitHeight: number } | null>(null);
  // null fits the tallest stack, following the window as it resizes; a number is a zoom of your own
  const [zoom, setZoom] = useState<number | null>(null);
  // replay bumps it, remounting the track so every animation starts over
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState(false);
  // the whole entrance (card, spine, cascade) held till the stage's first paint has gone by (useCalmStart)
  const calm = useCalmStart();
  const [hovered, setHovered] = useState<TimelineSprite | null>(null);
  const [panning, setPanning] = useState(false);

  const layout = useMemo(() => layoutTimeline(captures), [captures]);
  const count = layout.sprites.length;

  const room = (stageSize?.fitHeight ?? 0) - SPINE_BOTTOM - HEADROOM;
  const fitAll = layout.height > 0 ? room / layout.height : 1;
  const fit = clamp(fitAll, FIT_MIN, 1);
  const minZoom = clamp(fitAll, ZOOM_FLOOR, ZOOM_MIN);
  const z = clamp(zoom ?? fit, minZoom, ZOOM_MAX);
  const trackWidth = layout.width * z;
  const trackHeight = Math.max(stageSize?.height ?? 0, SPINE_BOTTOM + layout.height * z + HEADROOM);

  // the entrance's loop and the wheel read the newest of these
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const zRef = useRef(z);
  zRef.current = z;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const limitsRef = useRef({ minZoom, fit });
  limitsRef.current = { minZoom, fit };
  // a skip ends the entrance's loop where it is
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const anchorRef = useRef<Anchor | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // a drag ends in a click, which mustn't also open the tile it ended on
  const suppressClickRef = useRef(false);

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

  // holds the unscaled point under (px, py) in place across the coming zoom or resize
  const holdAnchor = useCallback((px: number, py: number | null) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const z0 = zRef.current;
    const fromBottom = stage.scrollHeight - stage.scrollTop - (py ?? stage.clientHeight);
    const above = fromBottom >= SPINE_BOTTOM ? (fromBottom - SPINE_BOTTOM) / z0 : null;
    anchorRef.current = { u: (stage.scrollLeft + px) / z0, above, fromBottom, px, py };
  }, []);

  // the stage's size sets the fit; measured before the first paint, so nothing lands twice. A resize keeps the view's
  // left and bottom edges on the same part of the scene
  useLayoutEffect(() => {
    const stage = stageRef.current!;
    const measure = () => {
      holdAnchor(0, null);
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight, fitHeight: stage.offsetHeight - SCROLLBAR });
      setHovered(null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [holdAnchor]);

  // a zoom or resize just rendered: scroll so the anchored point sits where it was held
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const stage = stageRef.current;
    if (!anchor || !stage) {
      return;
    }
    anchorRef.current = null;
    const fromBottom = anchor.above === null ? anchor.fromBottom : SPINE_BOTTOM + anchor.above * z;
    stage.scrollLeft = anchor.u * z - anchor.px;
    stage.scrollTop = stage.scrollHeight - fromBottom - (anchor.py ?? stage.clientHeight);
  });

  // about the pointer for the wheel; for the keys and buttons, about the middle of the view's bottom edge, so the spine
  // stays where it is and the stacks grow up from it; and a fit lands on the spine, as the stage opens
  const zoomAt = useCallback((next: number | null, clientX?: number, clientY?: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const { minZoom: low, fit: fitted } = limitsRef.current;
    const target = clamp(next ?? fitted, low, ZOOM_MAX);
    if (next !== null && Math.abs(target - zRef.current) < 0.001) {
      return;
    }
    // already fitted, nothing renders to place the view (an anchor held for it would wait, and jump the view at some
    // later render): it lands on the spine here
    if (next === null && zoomRef.current === null) {
      stage.scrollTop = stage.scrollHeight - stage.clientHeight;
      return;
    }
    const rect = stage.getBoundingClientRect();
    holdAnchor((clientX ?? rect.left + stage.clientWidth / 2) - rect.left, clientY === undefined ? null : clientY - rect.top);
    if (next === null && anchorRef.current) {
      anchorRef.current = { ...anchorRef.current, above: null, fromBottom: 0 };
    }
    setZoom(next === null ? null : target);
  }, [holdAnchor]);

  // each run opens at the start of the track with the spine in view
  const measured = stageSize !== null;
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (measured && stage) {
      anchorRef.current = null;
      stage.scrollLeft = 0;
      stage.scrollTop = stage.scrollHeight;
    }
  }, [run, measured]);

  // the entrance, per run: drops the mons in turn and counts them in as they land, and pans the stage along with the
  // front of the cascade, until it's scrolled or dragged by hand; settles once the last one is down. Its clock starts
  // with the stage calm. A mon starts falling as its turn comes (.dropping), not waiting out a delay from the start:
  // only those in the air are animating, rather than every mon at once, each a layer for the compositor to carry
  useEffect(() => {
    if (!calm) {
      return undefined;
    }
    const stage = stageRef.current!;
    const counter = counterRef.current;
    // in the cascade's order, as Mons renders them
    const mons = stage.querySelectorAll<HTMLElement>('.tl-mon');
    let dropped = 0;
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
        for (; dropped < landed; dropped++) {
          mons[dropped]?.classList.add('dropping');
        }
        if (counter) {
          counter.textContent = String(landed);
        }
        if (following) {
          const target = Math.max(0, sprites[landed - 1].x * zRef.current - stage.clientWidth * 0.62);
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
  }, [run, calm]);

  useEffect(() => {
    if (settled && counterRef.current) {
      counterRef.current.textContent = String(count);
    }
  }, [settled, count]);

  // Escape closes; while the entrance plays, any other key (or a click) skips to the end of it. A skip's key is claimed,
  // so it can't also press the focused Replay or scroll anything, and a modifier alone (an Alt+Tab begun) isn't one.
  // Once settled, + and − zoom (with Ctrl or without), and 0 or Z fits the stage again
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (!settled) {
        if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
          e.preventDefault();
          if (!e.repeat) {
            setSettled(true);
          }
        }
      } else if (!e.altKey) {
        const key = e.key.toLowerCase();
        if (key === '+' || key === '=') {
          e.preventDefault();
          zoomAt(zRef.current * ZOOM_STEP);
        } else if (key === '-' || key === '_') {
          e.preventDefault();
          zoomAt(zRef.current / ZOOM_STEP);
        } else if (key === '0' || key === 'z') {
          e.preventDefault();
          zoomAt(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, settled, zoomAt]);

  // the stage reads left to right in time, so the wheel scrolls it sideways and Shift+wheel up and down the stacks;
  // Ctrl+wheel (a touchpad's pinch too) zooms about the pointer
  useEffect(() => {
    const stage = stageRef.current!;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(zRef.current * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
        return;
      }
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        if (e.shiftKey) {
          stage.scrollTop += delta;
        } else {
          stage.scrollLeft += delta;
        }
      }
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [zoomAt]);

  const spriteAt = (target: EventTarget): TimelineSprite | null => {
    const el = target instanceof Element ? target.closest<HTMLElement>('.tl-mon') : null;
    return el ? layout.sprites[Number(el.dataset.order)] ?? null : null;
  };

  // a press that travels is a drag, panning the stage under the pointer; one that doesn't is a click. The pointer is
  // only captured once it's a drag, so a click still lands on the mon it's on
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    if (e.button !== 0) {
      return;
    }
    const stage = e.currentTarget;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: false };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) {
      return;
    }
    // a press let go where the stage never heard it (off the stage before it travelled, onto the bar say) is over, not
    // a drag waiting to start
    if ((e.buttons & 1) === 0) {
      dragRef.current = null;
      if (drag.moved) {
        setPanning(false);
      }
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
      setHovered(null);
    }
    e.currentTarget.scrollLeft = drag.left - dx;
    e.currentTarget.scrollTop = drag.top - dy;
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) {
      return;
    }
    dragRef.current = null;
    if (drag.moved) {
      suppressClickRef.current = true;
      setPanning(false);
    }
  };

  const handleClick = (e: ReactMouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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
    setZoom(null);
    setRun((n) => n + 1);
    stageRef.current?.focus({ preventScroll: true });
  };

  const yearSegments = layout.segments.filter((segment): segment is MonthSegment => segment.kind === 'month' && segment.opensYear);
  const first = yearSegments[0]?.year;
  const last = yearSegments[yearSegments.length - 1]?.year;

  let card = null;
  if (hovered && settled && !panning) {
    const { capture } = hovered;
    const stage = stageRef.current;
    // above the mon, unless the view's top edge would cut it off: then under it
    const above = SPINE_BOTTOM + (hovered.row + 1) * SLOT_H * z + CARD_GAP;
    const viewTop = stage ? trackHeight - stage.scrollTop : Infinity;
    const place = above + CARD_HEIGHT <= viewTop
      ? { bottom: above }
      : { bottom: Math.max(0, SPINE_BOTTOM + hovered.row * SLOT_H * z - CARD_GAP - CARD_HEIGHT) };
    const x = (hovered.x + SLOT_W / 2) * z;
    card = (
      <div className="tl-card" style={{ left: x, '--card-x': x, '--track-w': trackWidth, ...place } as CSSProperties}>
        <b>
          <PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} />
          {capture.sealed && <FontAwesomeIcon className="tl-card-mark sealed" icon={faLock} title={t('seal.sealed')} />}
          {capture.status === 'temporary' && <FontAwesomeIcon className="tl-card-mark" icon={faClock} title={t('status.temporary')} />}
        </b>
        {capture.has_nickname && capture.nickname &&
          <span className="tl-card-nickname" lang={nameLang(capture.nickname, capture.language)}>{capture.nickname}</span>
        }
        <span className="tl-card-date">{hovered.dated ? capture.catch_date!.replaceAll('-', '/') : t('timeline.noDate')}</span>
        <CardOrigin capture={capture} />
      </div>
    );
  }

  return createPortal(
    <div aria-label={t('timeline.title')} aria-modal="true" className="timeline" data-gate={(!calm && !settled) || undefined} role="dialog">
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
        <div className="tl-zoom">
          <button aria-label={t('timeline.zoomOut')} className="tl-button" onClick={() => zoomAt(z / ZOOM_STEP)} title={t('timeline.zoomOut')} type="button">
            <FontAwesomeIcon icon={faMinus} />
          </button>
          <button aria-label={t('timeline.fit')} className="tl-zoom-level" onClick={() => zoomAt(null)} title={t('timeline.fit')} type="button">
            {Math.round(z * 100)}%
          </button>
          <button aria-label={t('timeline.zoomIn')} className="tl-button" onClick={() => zoomAt(z * ZOOM_STEP)} title={t('timeline.zoomIn')} type="button">
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
        <button aria-label={t('timeline.replay')} className="tl-button" onClick={handleReplay} title={t('timeline.replay')} type="button">
          <FontAwesomeIcon icon={faRotateRight} />
        </button>
        <button aria-label={t('popover.close')} className="tl-button" onClick={onClose} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div
        className={classNames('tl-stage', { settled, panning })}
        onClick={handleClick}
        onLostPointerCapture={handlePointerUp}
        onMouseLeave={() => setHovered(null)}
        onMouseOver={(e) => {
          if (!dragRef.current?.moved) {
            setHovered(spriteAt(e.target));
          }
        }}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={stageRef}
        tabIndex={-1}
      >
        {measured &&
          <div className="tl-track" key={run} style={{ width: trackWidth, height: trackHeight, '--z': z } as CSSProperties}>
            <Axis count={count} layout={layout} monthName={monthName} t={t} />
            <div className="tl-scene">
              <div className="tl-scene-zoom">
                <Mons dex={activeDexView!} layout={layout} locale={locale} />
              </div>
            </div>
            {card}
          </div>
        }
        {count === 0 && <p className="tl-empty">{t('timeline.empty')}</p>}
      </div>

      {!settled && <TitleCard hint={t('scene.skip')} key={`intro-${run}`} sub={activeDex!.title} title={t('timeline.title')} />}
    </div>,
    document.body,
  );
}
