import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { BOX_COLUMNS, BOX_GAP, BOX_SIZE, BOX_WIDTH, TILE_SIZE } from '../../../utils/pokemon';
import { NARROW_WIDTH } from './use-tracker';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { measureScrollbar, scrollbarSize } from '../../../utils/scrollbar';

import type { RefObject } from 'react';

// under a modal or the timeline, the dex behind keeps its zoom, and under an open menu too, which is placed by what it
// opened from and wouldn't follow it (the move menu by its tile, a field's by the popover, the species picker by its
// slot)
const COVERED = '.modal-overlay, .timeline, .almanac, .review, .scene, .dropdown-menu, .move-menu, .species-picker';

// screen px either side past the scrollbar's room, so a box's outline never meets the scroller's edge
const EDGE_ROOM = 8;
// screen px too: the header sits outside the dex's zoom, and is measured as it shows, its own zoom and all; this is
// about what it is until it has been
const HEADER_GUESS = 160;
// unscaled px: a box's title with its margin, and its tiles
const BOX_HEIGHT = 44 + (BOX_SIZE / BOX_COLUMNS) * TILE_SIZE + 2;
// unscaled px between two rows of boxes; keep in sync with .box-grid's gap in styles/tracker.scss
const BOX_ROW_GAP = 60;
// scaled px above the first row of boxes, whatever the window's height, and the room the fit leaves below it
const TOP_GAP = 30;
const MAX_FIT = 2;
// two boxes across below this read too small at 100%: the fit gives one box the width instead
const MIN_TWO_FIT = 0.8;

// a sealed tile's flipping lines, unscaled; keep in sync with styles/tracker.scss and styles/tile-faces.scss
// band is the badges row's distance below the number line, where the two meet in the lower block's pages
const FLIP_LINES = { names: 22, badges: 20, numbers: 16, band: 14 };

// the user's own zoom, on top of the fit; 1 is the fit itself. Below 100% the steps also land exactly on 3 and on
// MIN_COLUMNS boxes across, where zooming out stops, with even steps between where two are further apart than
// MAX_STEP_OUT; those zooms depend on the window (zoomSteps)
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN_COLUMNS = 4;
// the widest step out below 100%, as a ratio: a wider gap (three boxes across to four, which was a third) is split
// evenly, so a filtered view can be brought down to just hold a run of results, a generation say
const MAX_STEP_OUT = 1.15;
// the list view has no columns to stop at
const LIST_MIN_ZOOM = 0.5;
// wheel deltaY per step: a mouse notch is about 100, a trackpad pinch sends many small ones
const WHEEL_STEP = 50;
// what holds the scroll place through a zoom or resize: a tile or ledger row, else the box or chunk round a gap
const ANCHORS = '[data-pokemon-id], .box, .results-chunk';
// screen px from the point searched for one: down across the gap between two rows of boxes, and along past the gap
// between two boxes, which is where the scroller's middle falls with an even number of them across
const PROBES = [0, 40, -40, 80, -80, 160, -160];
const PROBES_ACROSS = [0, 48, -48];
// a change of scale restyles every tile the dex holds, a frame of a quarter of a second or more with a thousand of
// them, where a transform costs a frame nothing. So a window being dragged first shows the dex as it's drawn, stretched
// to the scale it's going to and followed frame by frame, and it's drawn anew at that scale once, this long after the
// last frame of the drag. A zoom step isn't shown that way (it was, for a day: the boxes eased to their size, spilled
// off the screen where a step in regrouped them, then jumped to their places as it landed, a theme's page art with
// them; the user's ask was the place kept, not a move): it's drawn at once, its place put back in the same frame.
const LAND_MS = 140;
// what makes that frame slow is the sealed tiles' flipping lines (FlipStrips): about seventy elements a tile against
// the tile's own six, nine in ten of everything the dex holds, and the browser keeps the rows of them within some
// 3000px of the screen drawn, six rows where two show. So the frame that draws the dex at a new scale takes the rows on
// screen alone (data-unsettled: every other row's flips skipped outright, styles/tracker.scss), 100ms where it took
// 250, and the rows around them come back after it, nearest first, this many overlays a frame (a row of boxes has three)
const SETTLE_PER_FRAME = 3;

function gutters (): number {
  return 2 * (scrollbarSize() + EDGE_ROOM);
}

interface Anchor {
  el: Element;
  // a tile's or a row's mon, by which it's found again where the change drew it anew (a results chunk regrouped)
  id?: string;
  // the point's place on it as a share of its height, which scales with it
  at: number;
  y: number;
}

// none at the very top, which stays the top; a point off the scroller (a wheel over the header) takes its middle, and
// so does one beside the boxes (the paper either side of one box across), at the point's height
function findAnchor (scroller: HTMLElement, x?: number, y?: number): Anchor | null {
  if (scroller.scrollTop < 1) {
    return null;
  }
  const view = scroller.getBoundingClientRect();
  const middle = view.left + view.width / 2;
  const px = x !== undefined && x >= view.left && x < view.right ? x : middle;
  const py = y !== undefined && y >= view.top && y < view.bottom ? y : view.top + view.height / 2;
  for (const across of px === middle ? [px] : [px, middle]) {
    for (const dy of PROBES) {
      if (py + dy < view.top || py + dy >= view.bottom) {
        continue;
      }
      for (const dx of PROBES_ACROSS) {
        for (const hit of document.elementsFromPoint(across + dx, py + dy)) {
          const el = hit.closest<HTMLElement>(ANCHORS);
          if (el && scroller.contains(el)) {
            const rect = el.getBoundingClientRect();
            return { el, id: el.dataset.pokemonId, at: rect.height > 0 ? (py - rect.top) / rect.height : 0, y: py };
          }
        }
      }
    }
  }
  return null;
}

// what the dex is drawn at: its scale and boxes across, the zoom asked for (as stored, which only a zoom changes: the
// step it snaps to moves with the window where it's one that fits a number of boxes across), and whether a change from
// it can be shown stretched first (the boxes and a search's results, which keep their width; the narrow list and the
// ledger fill theirs, so they're drawn anew at once)
interface Drawn {
  scale: number;
  columns: number;
  zoom: number;
  stretches: boolean;
}

function sameDrawn (a: Drawn, b: Drawn): boolean {
  return a.scale === b.scale && a.columns === b.columns && a.zoom === b.zoom && a.stretches === b.stretches;
}

// two boxes span the width, scaled up or down to it, or one box where two would shrink below MIN_TWO_FIT; the height
// can stop it enlarging but never shrinks it, and leaves the same gap below the first row as above it; a window too
// narrow for one box gets the list view instead
function fitScale (width: number, height: number, header = HEADER_GUESS): number {
  if (width <= NARROW_WIDTH) {
    return 1;
  }
  const two = (width - gutters()) / (2 * BOX_WIDTH + BOX_GAP);
  const across = two >= MIN_TWO_FIT ? two : (width - gutters()) / BOX_WIDTH;
  const down = Math.max(1, (height - header) / (BOX_HEIGHT + 2 * TOP_GAP));
  return Math.floor(Math.min(MAX_FIT, across, down) * 100) / 100;
}

// as many boxes across as the scaled width holds
function columnsAt (width: number, scale: number): number {
  return Math.max(1, Math.floor(((width - gutters()) / scale + BOX_GAP) / (BOX_WIDTH + BOX_GAP)));
}

// screen px the boxes span at a fit: the header's width (headerWidth)
function spanAt (width: number, fit: number): number {
  return (columnsAt(width, fit) * (BOX_WIDTH + BOX_GAP) - BOX_GAP) * fit;
}

// each flipping line's face height in scaled px and the band, rounded to whole screen pixels so the strips rest on them
// and a page's two zones meet where the number line's and the badges' do (Chromium snaps each box's edges to the pixel
// grid, so a fractional one comes out a pixel wider on some tiles than on others)
function flipLinesAt (scale: number): Record<keyof typeof FLIP_LINES, number> {
  const pixels = scale * window.devicePixelRatio;
  const round = (height: number) => Math.round(height * pixels) / pixels;
  return {
    names: round(FLIP_LINES.names),
    badges: round(FLIP_LINES.badges),
    numbers: round(FLIP_LINES.numbers),
    band: round(FLIP_LINES.band),
  };
}

// the zoom at which exactly `columns` boxes fill the width, nudged under the boundary so it floors to them
function zoomForColumns (width: number, fit: number, columns: number): number {
  return ((width - gutters()) / (fit * (columns * (BOX_WIDTH + BOX_GAP) - BOX_GAP))) * 0.9999;
}

// this window's steps: the zooms that fit each column count from one more than the fit shows to MIN_COLUMNS across (the
// last one the floor, or 100% where the fit already shows that many), and the fixed ones above the floor that aren't
// too close to one of them to feel like a step of their own; 100% always stays. Below it, a gap wider than
// MAX_STEP_OUT gets steps of its own, spaced by ratio, as zooming feels
function zoomSteps (width: number, fit: number): number[] {
  if (width <= NARROW_WIDTH) {
    return [LIST_MIN_ZOOM, ...ZOOM_STEPS];
  }
  const floor = Math.min(1, zoomForColumns(width, fit, MIN_COLUMNS));
  const columnSteps = [floor];
  for (let columns = MIN_COLUMNS - 1; columns > columnsAt(width, fit); columns--) {
    const zoom = zoomForColumns(width, fit, columns);
    if (zoom < 1) {
      columnSteps.push(zoom);
    }
  }
  const nearColumnStep = (step: number) => columnSteps.some((zoom) => Math.abs(step / zoom - 1) < 0.08);
  const fixed = ZOOM_STEPS.filter((step) => step === 1 || (step > floor && !nearColumnStep(step)));
  const steps = [...new Set([...columnSteps, ...fixed])].sort((a, b) => a - b);
  return steps.flatMap((step, i) => {
    const next = steps[i + 1];
    if (next === undefined || next > 1) {
      return [step];
    }
    const parts = Math.ceil(Math.log(next / step) / Math.log(MAX_STEP_OUT));
    return Array.from({ length: parts }, (_, k) => step * (next / step) ** (k / parts));
  });
}

function stepFrom (zoom: number, direction: number, steps: number[]): number {
  const current = Number.isFinite(zoom) ? zoom : 1;
  const nearest = steps.reduce((best, step, i) => (Math.abs(step - current) < Math.abs(steps[best] - current) ? i : best), 0);
  return steps[Math.min(steps.length - 1, Math.max(0, nearest + direction))];
}

interface DexScale {
  // the scale and the boxes across the dex is drawn at: at once for a zoom step or boxes regrouped, and for a resize
  // that keeps the boxes across once the window has come to rest (it's shown stretched till then)
  scale: number;
  columns: number;
  // rows of boxes the area shows at the scale, a partly shown one included: the screenful the dex opens on
  rows: number;
  // false for the first render, before the area has been measured
  measured: boolean;
  // screen px the boxes span at 100%: the header (its meter end to end) lines up with them there, and never moves as
  // the zoom changes
  headerWidth: number;
  flipLines: Record<keyof typeof FLIP_LINES, number>;
  zoom: number;
  // counts zoom inputs, including ones already at a limit
  nudges: number;
  // for the dex's own layout effect on its scale and columns: the place put back as soon as it's drawn at them, ahead
  // of whatever places itself by its tiles after (the popover)
  onRescaled: () => void;
}

// ref is the unscaled area below the nav; Ctrl+wheel, Ctrl+=/− and Ctrl+0 set the zoom (Cmd on macOS), Z resets it.
// ledger: the list is up in the boxes' place
export function useDexScale (ref: RefObject<HTMLElement>, scroller: RefObject<HTMLElement>, ledger: boolean): DexScale {
  const [area, setArea] = useState({ width: 0, height: 0, header: HEADER_GUESS });
  // as it's laid out now, for the observer, which runs between renders
  const areaRef = useRef(area);
  areaRef.current = area;
  const [zoom, setZoom] = useLocalStorage('dexZoom', 1);
  const [nudges, setNudges] = useState(0);
  // the face heights are whole screen pixels, so a change of display scaling (another monitor) re-renders them
  const [, setPixelRatio] = useState(window.devicePixelRatio);

  useEffect(() => {
    let media: MediaQueryList;
    const handleChange = () => {
      measureScrollbar();
      setPixelRatio(window.devicePixelRatio);
      watch();
    };
    const watch = () => {
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener('change', handleChange, { once: true });
    };
    watch();
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const fit = fitScale(area.width, area.height, area.header);
  const steps = zoomSteps(area.width, fit);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // taken before a change of scale renders, and put back in the commit that draws the dex at the new one (rescaled,
  // below), so the old place never paints; with the point it was taken at, where it's taken again as a stretch lands
  const anchorRef = useRef<Anchor | null>(null);
  const pointRef = useRef<{ x?: number; y?: number }>({});
  // a stretch under way: what the dex was drawn at as it began, and the timer it lands on (0 once that's run)
  const stretchRef = useRef<{ from: Drawn; timer: number } | null>(null);
  // the scale and columns the dex was last drawn at (0 till it's been measured: the scale it opens at is no change),
  // and the frame its flips are coming back on
  const settledRef = useRef({ scale: 0, columns: 0, frame: 0 });
  const measuredRef = useRef(false);
  measuredRef.current = area.width > 0;
  const holdPlace = useCallback((x?: number, y?: number) => {
    const el = scroller.current;
    if (el && !stretchRef.current) {
      pointRef.current = { x, y };
      anchorRef.current ??= findAnchor(el, x, y);
    }
  }, [scroller]);

  const applyZoom = useCallback((next: number, x?: number, y?: number) => {
    if (next !== stepFrom(zoomRef.current, 0, stepsRef.current)) {
      holdPlace(x, y);
    }
    setZoom(next);
    setNudges((count) => count + 1);
  }, [setZoom, holdPlace]);

  useHotkey('z', () => applyZoom(1));

  // the area, and the header above the boxes in it, which grows with the window's width and the dex's name (a long one
  // takes the tags onto a line of their own). The two go round: the header's height sets the fit where the height
  // stops it, the fit sets the header's width, and its width how it wraps, so its height. So it's settled where they
  // agree, each height the header's had kept by the width it had it at (for this area and what the header holds now):
  // a fit that would swap between two every frame, the header wrapping at the one and not at the other (two boxes
  // across and three), is seen coming round, and rests on the smaller of them, the taller header's
  useLayoutEffect(() => {
    const el = ref.current!;
    const header = el.querySelector<HTMLElement>('.dex-search-bar');
    let heights = new Map<number, number>();
    let size = '';
    // the header's height to fit the area to: as it's measured, unless the width that fits it is one it's been laid out
    // at already, whose height is followed on from there till the fit stays put or comes back round
    const headerFor = (width: number, height: number): number => {
      const shown = areaRef.current;
      const at = spanAt(shown.width, fitScale(shown.width, shown.height, shown.header));
      const measured = header?.getBoundingClientRect().height ?? HEADER_GUESS;
      if (`${width}x${height}` !== size) {
        size = `${width}x${height}`;
        heights = new Map();
      } else if (heights.has(at) && heights.get(at) !== measured) {
        // changed at a width it's had before (a name, a filter, its own zoom): what was measured no longer holds
        heights = new Map();
      }
      heights.set(at, measured);
      let assumed = measured;
      const path = [at];
      for (;;) {
        const next = spanAt(width, fitScale(width, height, assumed));
        const known = heights.get(next);
        if (next === path[path.length - 1] || known === undefined) {
          return assumed;
        }
        if (path.includes(next)) {
          return Math.max(...path.slice(path.indexOf(next)).map((span) => heights.get(span)!));
        }
        path.push(next);
        assumed = known;
      }
    };
    // a few renders in a row at most, the header taking each new width before it's measured again
    const settle = () => {
      for (let pass = 0; pass < 3; pass++) {
        const next = { width: el.clientWidth, height: el.clientHeight, header: headerFor(el.clientWidth, el.clientHeight) };
        const shown = areaRef.current;
        if (next.width === shown.width && next.height === shown.height && next.header === shown.header) {
          break;
        }
        // a quarter down, as a resize from the bottom edge moves the middle; each pass, the one before having used it
        if (scroller.current) {
          const view = scroller.current.getBoundingClientRect();
          holdPlace(undefined, view.top + view.height / 4);
        }
        flushSync(() => setArea(next));
      }
      // dropped when the scale didn't change, or a later change would put it back
      if (!stretchRef.current) {
        anchorRef.current = null;
      }
    };
    setArea({ width: el.clientWidth, height: el.clientHeight, header: header?.getBoundingClientRect().height ?? HEADER_GUESS });
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(frame);
      if (entries.some((entry) => entry.target === el)) {
        // the area: at once, so a resized window never paints a frame at the old scale. The header this re-wraps is
        // reported again after, being inside it
        settle();
      } else {
        // the header alone, which mustn't change size again inside the round that reported it (the browser drops the
        // report, an error): the next frame
        frame = requestAnimationFrame(settle);
      }
    });
    observer.observe(el);
    if (header) {
      observer.observe(header);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, scroller, holdPlace]);

  useEffect(() => {
    let wheel = 0;
    // a trackpad pinch arrives as a ctrl+wheel too; Cmd stands in for Ctrl on macOS, as it does for the keys below
    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      if (document.querySelector(COVERED)) {
        return;
      }
      if (Math.sign(e.deltaY) !== Math.sign(wheel)) {
        wheel = 0;
      }
      wheel += e.deltaY;
      if (Math.abs(wheel) >= WHEEL_STEP) {
        applyZoom(stepFrom(zoomRef.current, wheel < 0 ? 1 : -1, stepsRef.current), e.clientX, e.clientY);
        wheel = 0;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || document.querySelector(COVERED)) {
        return;
      }
      if (e.key === '=' || e.key === '+') {
        applyZoom(stepFrom(zoomRef.current, 1, stepsRef.current));
      } else if (e.key === '-' || e.key === '_') {
        applyZoom(stepFrom(zoomRef.current, -1, stepsRef.current));
      } else if (e.key === '0') {
        applyZoom(1);
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
  }, [applyZoom]);

  // a stored value from another window size or an older step list snaps to the nearest step
  const steppedZoom = stepFrom(zoom, 0, steps);
  // where the window and the zoom put the dex now, and what it's drawn at: the same at rest. A resize that keeps the
  // boxes across is shown stretched first; every other change is drawn at once: a zoom step, a resize that regroups the
  // boxes (the fit's own change of columns, two boxes giving way to one, is no stretch of what's there), and whatever
  // can't be shown stretched. A zoom step is told by the zoom asked for, not the step: at three boxes across, say, the
  // step is whatever zoom fits three to the window, a new one every frame of a drag
  const target: Drawn = {
    scale: fit * steppedZoom,
    columns: columnsAt(area.width, fit * steppedZoom),
    zoom: Number.isFinite(zoom) ? zoom : 1,
    stretches: area.width > NARROW_WIDTH && !ledger,
  };
  const [held, setHeld] = useState(target);
  const direct = !target.stretches || !held.stretches || held.zoom !== target.zoom || held.columns !== target.columns;
  if (direct && !sameDrawn(held, target)) {
    setHeld(target);
  }
  const drawn = direct ? target : held;
  const targetRef = useRef(target);
  targetRef.current = target;
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;

  // run as a change renders, by the dex on what it's drawn at (onRescaled) and here on where it's going. On its way
  // there, the dex is stretched to it about the place held (its top, at the top) and the landing put off; drawn there,
  // or back where it began, the stretch comes off and the place goes back under the point it was held at
  const rescaled = useCallback(() => {
    const el = scroller.current;
    const dex = el?.querySelector<HTMLElement>(':scope > .dex');
    if (!el || !dex) {
      return;
    }
    const going = targetRef.current;
    const shown = drawnRef.current;
    const away = going.scale !== shown.scale;
    // the stretch off, and the place back under its point; where the dex is drawn anew, the flips on screen with it
    // and the rest after
    const put = () => {
      if (stretchRef.current) {
        window.clearTimeout(stretchRef.current.timer);
        stretchRef.current = null;
        dex.style.transform = '';
        dex.style.transformOrigin = '';
        el.removeAttribute('data-rescaling');
      }
      const settled = settledRef.current;
      const anew = measuredRef.current && settled.scale !== 0 && (settled.scale !== shown.scale || settled.columns !== shown.columns);
      if (measuredRef.current) {
        settled.scale = shown.scale;
        settled.columns = shown.columns;
      }
      // every overlay there now held back, before the first layout at the new scale, which the place's rects below
      // force; one drawn after (a search's results, a row's first seal) isn't, as it's drawn at the new scale anyway
      const flips = anew ? [...el.querySelectorAll('.flip-overlay')] : [];
      if (flips.length > 0) {
        cancelAnimationFrame(settled.frame);
        flips.forEach((flip) => flip.setAttribute('data-unsettled', ''));
      }
      const anchor = anchorRef.current;
      anchorRef.current = null;
      const at = anchor && (anchor.el.isConnected ? anchor.el : anchor.id ? el.querySelector(`[data-pokemon-id='${anchor.id}']`) : null);
      if (anchor && at) {
        const rect = at.getBoundingClientRect();
        const off = rect.top + anchor.at * rect.height - anchor.y;
        if (Math.abs(off) >= 0.5) {
          el.scrollTop += off;
        }
      }
      if (flips.length > 0) {
        const view = el.getBoundingClientRect();
        const ranked = flips.map((flip) => {
          const rect = flip.getBoundingClientRect();
          return { flip, by: Math.max(0, view.top - rect.bottom, rect.top - view.bottom) };
        }).sort((a, b) => a.by - b.by);
        let next = ranked.findIndex(({ by }) => by > 0);
        next = next === -1 ? ranked.length : next;
        ranked.slice(0, next).forEach(({ flip }) => flip.removeAttribute('data-unsettled'));
        const more = () => {
          ranked.slice(next, next + SETTLE_PER_FRAME).forEach(({ flip }) => flip.removeAttribute('data-unsettled'));
          next += SETTLE_PER_FRAME;
          if (next < ranked.length) {
            settled.frame = requestAnimationFrame(more);
          }
        };
        if (next < ranked.length) {
          settled.frame = requestAnimationFrame(more);
        }
      }
    };
    // drawn anew since its stretch began (landed, or regrouped by a resize), or landed back where it began; or with no
    // stretch, a change drawn at once
    const before = stretchRef.current;
    if (before ? before.from !== shown || (!away && before.timer === 0) : !away) {
      put();
    }
    const stretch = stretchRef.current;
    if (!away && !stretch) {
      return;
    }
    if (!stretch) {
      // (a step on from one that's just landed takes the place anew)
      anchorRef.current ??= findAnchor(el, pointRef.current.x, pointRef.current.y);
      const anchor = anchorRef.current;
      // in the dex's own px, which its zoom scales
      dex.style.transformOrigin = `50% ${anchor ? (anchor.y - dex.getBoundingClientRect().top) / shown.scale : 0}px`;
    }
    el.setAttribute('data-rescaling', '');
    dex.style.transform = `scale(${going.scale / shown.scale})`;
    window.clearTimeout(stretch?.timer);
    const timer = window.setTimeout(() => {
      const landing = stretchRef.current;
      if (!landing) {
        return;
      }
      landing.timer = 0;
      // the place as it's come to be shown, a scroll since the stretch began and all
      anchorRef.current = findAnchor(el, pointRef.current.x, pointRef.current.y);
      if (sameDrawn(targetRef.current, drawnRef.current)) {
        // back where it began (a window dragged out and back): nothing to draw anew
        rescaledRef.current();
      } else {
        setHeld(targetRef.current);
      }
    }, LAND_MS);
    stretchRef.current = { from: stretch?.from ?? shown, timer };
  }, [scroller]);
  const rescaledRef = useRef(rescaled);
  rescaledRef.current = rescaled;
  useLayoutEffect(rescaled, [rescaled, drawn.scale, drawn.columns, target.scale]);
  useEffect(() => () => {
    window.clearTimeout(stretchRef.current?.timer);
    cancelAnimationFrame(settledRef.current.frame);
  }, []);

  return {
    scale: drawn.scale,
    columns: drawn.columns,
    rows: Math.max(1, Math.ceil((area.height - area.header) / ((BOX_HEIGHT + BOX_ROW_GAP) * drawn.scale))),
    measured: area.width > 0,
    headerWidth: spanAt(area.width, fit),
    flipLines: flipLinesAt(drawn.scale),
    zoom: steppedZoom,
    nudges,
    onRescaled: rescaled,
  };
}
