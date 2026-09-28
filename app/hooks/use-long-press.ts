import { useCallback, useEffect, useRef, useState } from 'react';

import type { PointerEvent as ReactPointerEvent } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Options {
  delay: number;
  duration: number;
  onComplete: () => void;
  // engaged = the wheel had appeared
  onRelease: (engaged: boolean) => void;
}

export function useLongPress ({ delay, duration, onComplete, onRelease }: Options) {
  const [wheel, setWheel] = useState<Point | null>(null);

  const timersRef = useRef<number[]>([]);
  const pointRef = useRef<Point>({ x: 0, y: 0 });
  const engagedRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;

  const reset = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    engagedRef.current = false;
    setWheel(null);
  }, []);

  const cancel = useCallback(() => {
    // pointerleave fires without a press too, so only report real releases
    if (timersRef.current.length === 0) {
      return;
    }
    const engaged = engagedRef.current;
    reset();
    releaseRef.current(engaged);
  }, [reset]);

  const start = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    pointRef.current = { x: e.clientX, y: e.clientY };
    timersRef.current = [
      window.setTimeout(() => {
        engagedRef.current = true;
        setWheel(pointRef.current);
      }, delay),
      window.setTimeout(() => {
        reset();
        completeRef.current();
      }, delay + duration),
    ];
  }, [delay, duration, reset]);

  const move = useCallback((e: ReactPointerEvent) => {
    pointRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  return {
    wheel,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onPointerMove: move,
    },
  };
}
