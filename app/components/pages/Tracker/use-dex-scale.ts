import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { BOX_COLUMNS, BOX_GAP, BOX_SIZE, BOX_WIDTH, TILE_SIZE } from '../../../utils/pokemon';
import { NARROW_WIDTH } from './use-tracker';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useLocalStorage } from '../../../hooks/use-local-storage';

import type { RefObject } from 'react';

// under a modal or the timeline, the dex behind keeps its zoom
const COVERED = '.modal-overlay, .timeline, .almanac, .review, .command-palette';

// screen px, not scaled px: scrollbars keep their size whatever the dex zoom, so room for a gutter either side
const GUTTERS = 24;
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

// a sealed tile's flipping lines, unscaled; keep in sync with styles/tracker.scss
// band is the badges row's distance below the number line, where the two meet in the types' block; glyph is a type's
// symbol on that block, and glyphGap the space between two
const FLIP_LINES = { names: 22, badges: 20, numbers: 16, band: 14, glyph: 16, glyphGap: 6 };

// the user's own zoom, on top of the fit; 1 is the fit itself. Below 100% the steps also land exactly on 3 and on
// MIN_COLUMNS boxes across, where zooming out stops; those zooms depend on the window (zoomSteps)
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN_COLUMNS = 4;
// the list view has no columns to stop at
const LIST_MIN_ZOOM = 0.5;
// wheel deltaY per step: a mouse notch is about 100, a trackpad pinch sends many small ones
const WHEEL_STEP = 50;

// two boxes span the width, scaled up or down to it, or one box where two would shrink below MIN_TWO_FIT; the height
// can stop it enlarging but never shrinks it, and leaves the same gap below the first row as above it; a window too
// narrow for one box gets the list view instead
function fitScale (width: number, height: number, header = HEADER_GUESS): number {
  if (width <= NARROW_WIDTH) {
    return 1;
  }
  const two = (width - GUTTERS) / (2 * BOX_WIDTH + BOX_GAP);
  const across = two >= MIN_TWO_FIT ? two : (width - GUTTERS) / BOX_WIDTH;
  const down = Math.max(1, (height - header) / (BOX_HEIGHT + 2 * TOP_GAP));
  return Math.floor(Math.min(MAX_FIT, across, down) * 100) / 100;
}

// as many boxes across as the scaled width holds
function columnsAt (width: number, scale: number): number {
  return Math.max(1, Math.floor(((width - GUTTERS) / scale + BOX_GAP) / (BOX_WIDTH + BOX_GAP)));
}

// screen px the boxes span at a fit: the header's width (headerWidth)
function spanAt (width: number, fit: number): number {
  return (columnsAt(width, fit) * (BOX_WIDTH + BOX_GAP) - BOX_GAP) * fit;
}

// each flipping line's face height in scaled px, the band, and the types' glyph and gap, rounded to whole screen pixels
// so the strips rest on them, the types' block lines up across the two lines it spans, and every tile draws a glyph
// the same size (Chromium snaps each box's edges to the pixel grid, so a fractional one comes out a pixel wider on some
// tiles than on others)
function flipLinesAt (scale: number): Record<keyof typeof FLIP_LINES, number> {
  const pixels = scale * window.devicePixelRatio;
  const round = (height: number) => Math.round(height * pixels) / pixels;
  return {
    names: round(FLIP_LINES.names),
    badges: round(FLIP_LINES.badges),
    numbers: round(FLIP_LINES.numbers),
    band: round(FLIP_LINES.band),
    glyph: round(FLIP_LINES.glyph),
    glyphGap: round(FLIP_LINES.glyphGap),
  };
}

// the zoom at which exactly `columns` boxes fill the width, nudged under the boundary so it floors to them
function zoomForColumns (width: number, fit: number, columns: number): number {
  return ((width - GUTTERS) / (fit * (columns * (BOX_WIDTH + BOX_GAP) - BOX_GAP))) * 0.9999;
}

// this window's steps: the zooms that fit each column count from one more than the fit shows to MIN_COLUMNS across (the
// last one the floor, or 100% where the fit already shows that many), and the fixed ones above the floor that aren't
// too close to one of them to feel like a step of their own; 100% always stays
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
  return [...new Set([...columnSteps, ...fixed])].sort((a, b) => a - b);
}

function stepFrom (zoom: number, direction: number, steps: number[]): number {
  const current = Number.isFinite(zoom) ? zoom : 1;
  const nearest = steps.reduce((best, step, i) => (Math.abs(step - current) < Math.abs(steps[best] - current) ? i : best), 0);
  return steps[Math.min(steps.length - 1, Math.max(0, nearest + direction))];
}

interface DexScale {
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
}

// ref is the unscaled area below the nav; Ctrl+wheel, Ctrl+=/− and Ctrl+0 set the zoom (Cmd on macOS), Z resets it
export function useDexScale (ref: RefObject<HTMLElement>): DexScale {
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

  const applyZoom = useCallback((next: number) => {
    setZoom(next);
    setNudges((count) => count + 1);
  }, [setZoom]);

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
          return;
        }
        flushSync(() => setArea(next));
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
  }, [ref]);

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
        applyZoom(stepFrom(zoomRef.current, wheel < 0 ? 1 : -1, stepsRef.current));
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
  const scale = fit * steppedZoom;
  return {
    scale,
    columns: columnsAt(area.width, scale),
    rows: Math.max(1, Math.ceil((area.height - area.header) / ((BOX_HEIGHT + BOX_ROW_GAP) * scale))),
    measured: area.width > 0,
    headerWidth: spanAt(area.width, fit),
    flipLines: flipLinesAt(scale),
    zoom: steppedZoom,
    nudges,
  };
}
