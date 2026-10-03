import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { BOX_COLUMNS, BOX_GAP, BOX_SIZE, BOX_WIDTH, TILE_SIZE } from '../../../utils/pokemon';
import { NARROW_WIDTH } from './use-tracker';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useLocalStorage } from '../../../hooks/use-local-storage';

import type { RefObject } from 'react';

// under a modal or the timeline, the dex behind keeps its zoom
const COVERED = '.modal-overlay, .timeline';

// screen px, not scaled px: scrollbars keep their size whatever the dex zoom, so room for a gutter either side
const GUTTERS = 24;
// screen px too: the search bar sits outside the zoom
const SEARCH_BAR = 130;
// unscaled px: a box's title with its margin, and its tiles
const BOX_HEIGHT = 44 + (BOX_SIZE / BOX_COLUMNS) * TILE_SIZE + 2;
// above the first row of boxes: centring it under the search bar, within these
const TOP_GAP = { min: 30, max: 70 };
const MAX_FIT = 2;

// a sealed tile's flipping lines, unscaled; keep in sync with styles/tracker.scss
const FLIP_LINES = { names: 22, badges: 20, numbers: 16 };

// the user's own zoom, on top of the fit; 1 is the fit itself. Below 100% the steps also land exactly on 3 and on
// MIN_COLUMNS boxes across, where zooming out stops; those zooms depend on the window (zoomSteps)
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN_COLUMNS = 4;
// the list view has no columns to stop at
const LIST_MIN_ZOOM = 0.5;
// wheel deltaY per step: a mouse notch is about 100, a trackpad pinch sends many small ones
const WHEEL_STEP = 50;

// two boxes span the width, scaled up or down to it; the height can stop it enlarging but never shrinks it, and
// leaves the same gap below the first row as above it; a window too narrow for one box gets the list view instead
function fitScale (width: number, height: number): number {
  if (width <= NARROW_WIDTH) {
    return 1;
  }
  const across = (width - GUTTERS) / (2 * BOX_WIDTH + BOX_GAP);
  const down = Math.max(1, (height - SEARCH_BAR) / (BOX_HEIGHT + 2 * TOP_GAP.min));
  return Math.floor(Math.min(MAX_FIT, across, down) * 100) / 100;
}

// as many boxes across as the scaled width holds
function columnsAt (width: number, scale: number): number {
  return Math.max(1, Math.floor(((width - GUTTERS) / scale + BOX_GAP) / (BOX_WIDTH + BOX_GAP)));
}

// scaled px above the first row of boxes, so the row sits centred in the room under the search bar
function topGapAt (height: number, scale: number): number {
  return Math.min(TOP_GAP.max, Math.max(TOP_GAP.min, ((height - SEARCH_BAR) / scale - BOX_HEIGHT) / 2));
}

// each flipping line's face height in scaled px, rounded to whole screen pixels so the strips rest on them
function flipLinesAt (scale: number): Record<keyof typeof FLIP_LINES, number> {
  const pixels = scale * window.devicePixelRatio;
  const round = (height: number) => Math.round(height * pixels) / pixels;
  return { names: round(FLIP_LINES.names), badges: round(FLIP_LINES.badges), numbers: round(FLIP_LINES.numbers) };
}

// the zoom at which exactly `columns` boxes fill the width, nudged under the boundary so it floors to them
function zoomForColumns (width: number, fit: number, columns: number): number {
  return ((width - GUTTERS) / (fit * (columns * (BOX_WIDTH + BOX_GAP) - BOX_GAP))) * 0.9999;
}

// this window's steps: the zooms that fit each column count from 3 to MIN_COLUMNS across (the last one the floor, or
// 100% where the fit already shows that many), and the fixed ones above the floor that aren't too close to one of them
// to feel like a step of their own; 100% always stays
function zoomSteps (width: number, fit: number): number[] {
  if (width <= NARROW_WIDTH) {
    return [LIST_MIN_ZOOM, ...ZOOM_STEPS];
  }
  const floor = Math.min(1, zoomForColumns(width, fit, MIN_COLUMNS));
  const columnSteps = [floor];
  for (let columns = MIN_COLUMNS - 1; columns >= 3; columns--) {
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
  // false for the first render, before the area has been measured
  measured: boolean;
  // screen px the boxes span at 100%: the search bar lines up with them there, and never moves as the zoom changes
  headerWidth: number;
  topGap: number;
  flipLines: Record<keyof typeof FLIP_LINES, number>;
  zoom: number;
  // counts zoom inputs, including ones already at a limit
  nudges: number;
}

// ref is the unscaled area below the nav; Ctrl+wheel, Ctrl+=/− and Ctrl+0 set the zoom (Cmd on macOS), Z resets it
export function useDexScale (ref: RefObject<HTMLElement>): DexScale {
  const [area, setArea] = useState({ width: 0, height: 0 });
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

  const fit = fitScale(area.width, area.height);
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

  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    measure();
    // synchronous, so a resized window never paints a frame at the old scale
    const observer = new ResizeObserver(() => flushSync(measure));
    observer.observe(el);
    return () => observer.disconnect();
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
    measured: area.width > 0,
    headerWidth: (columnsAt(area.width, fit) * (BOX_WIDTH + BOX_GAP) - BOX_GAP) * fit,
    topGap: topGapAt(area.height, scale),
    flipLines: flipLinesAt(scale),
    zoom: steppedZoom,
    nudges,
  };
}
