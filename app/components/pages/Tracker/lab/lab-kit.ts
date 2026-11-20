import { useEffect, useRef, useState } from 'react';

import { useThemeContext } from '../../../../hooks/contexts/use-local-storage-context';

import type { SceneView } from '../Scene';
import type { TrackerFilters } from '../filters';

// what every lab sketch is handed by the tracker (LabHost): the same four ways out a scene has. A filter goes over the
// dex as a layer, Escape there coming back to the sketch as it was left (`back`)
export interface LabProps {
  back: SceneView | null;
  onClose: () => void;
  onFilter: (filters: TrackerFilters, view: SceneView) => void;
  onLocate: (pokemon: number) => void;
  onReview: (queue: number[], start?: number) => void;
}

// nothing moves in still mode (M) or for a system set to reduce motion: a sketch's loop draws its last frame and stops
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

// a sketch's keys: one document listener for its life, in the capture phase so it's ahead of the scene's own (an
// Escape a sketch takes for itself never closes the scene), calling the latest `handle`, so a sketch that re-renders
// every frame isn't adding and removing it every frame. A key typed into a field is the field's
export function useKeys (handle: (e: KeyboardEvent) => void) {
  const ref = useRef(handle);
  ref.current = handle;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!(e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]'))) {
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
