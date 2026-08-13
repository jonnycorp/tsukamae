import { useCallback, useEffect, useRef, useState } from 'react';

import type { PointerEvent as ReactPointerEvent } from 'react';

interface Options {
  // hold duration in ms, counted after the delay
  duration?: number;
  // grace before progress starts, so ordinary clicks never show the wheel
  delay?: number;
  onComplete: () => void;
}

// press-and-hold; releasing early resets progress to zero
export function useLongPress ({ duration = 1000, delay = 0, onComplete }: Options) {
  const [progress, setProgress] = useState(0);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  const frameRef = useRef<number>();
  const startRef = useRef(0);
  // ref so the animation loop never closes over a stale callback
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const cancel = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    setProgress(0);
    setPoint(null);
  }, []);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current - delay;
    const next = Math.min(1, Math.max(0, elapsed / duration));
    setProgress(next);

    if (next >= 1) {
      frameRef.current = undefined;
      setPoint(null);
      setProgress(0);
      completeRef.current();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [duration, delay]);

  const start = useCallback((e: ReactPointerEvent) => {
    // primary button only
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    startRef.current = performance.now();
    setPoint({ x: e.clientX, y: e.clientY });
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const move = useCallback((e: ReactPointerEvent) => {
    setPoint((prev) => (prev ? { x: e.clientX, y: e.clientY } : prev));
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    progress,
    point,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onPointerMove: move,
    },
  };
}
