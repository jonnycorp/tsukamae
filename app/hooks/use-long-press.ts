import { useCallback, useEffect, useRef, useState } from 'react';

import type { PointerEvent as ReactPointerEvent } from 'react';

interface Options {
  // hold duration in ms, counted after the delay
  duration?: number;
  // grace before progress starts, so ordinary clicks never show the wheel
  delay?: number;
  onComplete: () => void;
  // released before completing; engaged = the wheel had begun drawing
  onRelease?: (engaged: boolean) => void;
}

// press-and-hold; releasing early resets progress to zero
export function useLongPress ({ duration = 1000, delay = 0, onComplete, onRelease }: Options) {
  const [progress, setProgress] = useState(0);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  const frameRef = useRef<number>();
  const startRef = useRef(0);
  // ref so the animation loop never closes over a stale callback
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;
  // the press got far enough to draw the wheel
  const engagedRef = useRef(false);

  const cancel = useCallback(() => {
    // pointerleave fires without a press too, so only report real releases
    const pressing = frameRef.current !== undefined;
    const engaged = engagedRef.current;

    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    engagedRef.current = false;
    setProgress(0);
    setPoint(null);

    if (pressing) {
      releaseRef.current?.(engaged);
    }
  }, []);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current - delay;
    const next = Math.min(1, Math.max(0, elapsed / duration));
    setProgress(next);
    if (next > 0) {
      engagedRef.current = true;
    }

    if (next >= 1) {
      frameRef.current = undefined;
      engagedRef.current = false;
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
