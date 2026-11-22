import { useCallback, useEffect, useRef, useState } from 'react';

import { commitAppState, getAppState } from '../../../../utils/local-data';
import { useThemeContext } from '../../../../hooks/contexts/use-local-storage-context';

import type { SceneView } from '../Scene';
import type { TrackerFilters } from '../filters';

// what every view is handed by the tracker (ViewsHost): the same four ways out a scene has. A filter goes over the
// dex as a layer, Escape there coming back to the view as it was left (`back`)
export interface ViewProps {
  back: SceneView | null;
  onClose: () => void;
  onFilter: (filters: TrackerFilters, view: SceneView) => void;
  onLocate: (pokemon: number) => void;
  // shows a mon where it's filed in the boxes, without opening it (views/spotlight.ts)
  onSpot: (pokemon: number) => void;
  // W over a run of mons, at the one given (its id) or the first
  onReview: (queue: number[], start?: number) => void;
}

// the views' settings in the window's storage, kept under lab… before the views had their name: moved once
try {
  for (const key of Object.keys(window.localStorage)) {
    if (/^lab(Scope\.|Galaxy\.|LensArt$|Sheet\.|Mosaic\.)/.test(key)) {
      const to = `view${key.slice(3)}`;
      if (window.localStorage.getItem(to) === null) {
        window.localStorage.setItem(to, window.localStorage.getItem(key)!);
      }
      window.localStorage.removeItem(key);
    }
  }
} catch {
  // storage out of reach: the settings start over
}

// a view's own data, kept in the tracker's file (dex_data.json) under views.<section>.<key>, so it goes with an export
// and a move to another PC. The first read takes over what it was kept as in the window's storage before (`legacy`)
export function useViewData<T> (section: string, key: string, fallback: T, legacy?: string): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const kept = getAppState().views?.[section]?.[key];
    if (kept !== undefined) {
      return kept as T;
    }
    try {
      const raw = legacy ? window.localStorage.getItem(legacy) : null;
      if (raw) {
        const moved = JSON.parse(raw) as T;
        commitAppState((state) => {
          state.views ??= {};
          (state.views[section] ??= {})[key] = moved;
        });
        window.localStorage.removeItem(legacy!);
        return moved;
      }
    } catch {
      // unreadable: left where it was
    }
    return fallback;
  });
  const set = useCallback((next: T) => {
    commitAppState((state) => {
      state.views ??= {};
      (state.views[section] ??= {})[key] = next;
    });
    setValue(next);
  }, [section, key]);
  return [value, set];
}

// nothing moves in still mode (M) or for a system set to reduce motion: a view's loop draws its last frame and stops
export function useCalm (): boolean {
  const { still } = useThemeContext();
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handle = () => setReduced(query.matches);
    query.addEventListener('change', handle);
    return () => query.removeEventListener('change', handle);
  }, []);
  return still || reduced;
}

// a requestAnimationFrame loop handed the time since it started and since the last frame (ms), the latest `draw`
// always the one called; held while `running` is false
export function useFrameLoop (draw: (t: number, dt: number) => void, running = true) {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    let frame = 0;
    let start = -1;
    let last = 0;
    const tick = (now: number) => {
      if (start < 0) {
        start = now;
        last = now;
      }
      drawRef.current(now - start, Math.min(64, now - last));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}

// a view's keys: one document listener for its life, in the capture phase so it's ahead of the scene's own (an
// Escape a view takes for itself never closes the scene), calling the latest `handle`, so a view that re-renders
// every frame isn't adding and removing it every frame. A key typed into a field is the field's; a slider or a box to
// tick takes no text, and keeps focus after a drag or a click, so the view's keys go on working over one
const TYPING = 'input:not([type="range"], [type="checkbox"], [type="radio"]), textarea, select, [contenteditable]';

export function useKeys (handle: (e: KeyboardEvent) => void) {
  const ref = useRef(handle);
  ref.current = handle;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!(e.target instanceof Element && e.target.closest(TYPING))) {
        ref.current(e);
      }
    };
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, []);
}

// a theme token's colour as the root has it now, for a canvas, which can't read var()
export function token (name: string, fallback = '#888'): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// a hex colour at an opacity, for a canvas gradient's stops; any other colour as it is
export function alpha (color: string, a: number): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${Math.round(a * 255).toString(16).padStart(2, '0')}` : color;
}

// ease out, cubic
export const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// a canvas sized to its box at the screen's pixel density, its context scaled so drawing is in CSS pixels
export function fitCanvas (canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ratio = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * ratio);
  const h = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

// a CSS colour (one with var() in it, as a game's is) as the root resolves it now, for a canvas
export function cssColor (value: string): string {
  const probe = document.createElement('i');
  probe.style.color = value;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

// today, or another day, as yyyy-mm-dd where you are (not UTC's, which is tomorrow by evening in the Americas)
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
