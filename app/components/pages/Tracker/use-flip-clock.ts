import { useEffect } from 'react';

import type { RefObject } from 'react';

const HOLD_MS = 5500;
// keep in sync with $flip-slide in styles/tracker.scss
const SLIDE_MS = 800;

// face 2 is the cloned first row, snapped to 0 without a transition so every slide moves upward
function createFlipClock (el: HTMLElement) {
  let face = 0;
  let timer = 0;
  let due = 0;
  let remaining = HOLD_MS;
  let sliding = false;
  let paused = false;

  const hold = (ms: number) => {
    due = performance.now() + ms;
    timer = window.setTimeout(slide, ms);
  };

  const slide = () => {
    sliding = true;
    face = face === 1 ? 2 : 1;
    el.dataset.flipping = '';
    el.dataset.flip = String(face);
    timer = window.setTimeout(settle, SLIDE_MS + 200);
  };

  const settle = () => {
    sliding = false;
    delete el.dataset.flipping;
    if (face === 2) {
      face = 0;
      el.dataset.flip = '0';
    }
    if (paused) {
      remaining = HOLD_MS;
    } else {
      hold(HOLD_MS);
    }
  };

  el.dataset.flip = '0';
  hold(HOLD_MS);

  return {
    toggle () {
      paused = !paused;
      if (sliding) {
        return;
      }
      if (paused) {
        window.clearTimeout(timer);
        remaining = Math.max(0, due - performance.now());
      } else {
        hold(remaining);
      }
    },
    stop () {
      window.clearTimeout(timer);
    },
  };
}

// space freezes the flips on whatever face they show instead of paging the dex down
export function useFlipClock (ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const clock = createFlipClock(ref.current!);

    const handleKeydown = (e: KeyboardEvent) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : '';
      if (e.key !== ' ' || tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      clock.toggle();
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      clock.stop();
    };
  }, []);
}
