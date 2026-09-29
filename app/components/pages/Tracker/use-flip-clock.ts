import { useEffect } from 'react';

import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';

import type { RefObject } from 'react';

// keep in sync with $flip-hold and $flip-slide in styles/tracker.scss
const HOLD_MS = 5500;
const SLIDE_MS = 800;
// a face's hold and the slide off it: face 0 holds in the first half of a cycle, face 1 in the second
const HALF_MS = HOLD_MS + SLIDE_MS;

const now = () => document.timeline.currentTime as number;

// every strip runs the flip-cycle animation (styles/tracker.scss) on the compositor, so a flip costs the page nothing;
// this starts each from one shared epoch, so a strip styled later (a box scrolling into view, a row's first seal) joins
// in step, and pauses them all on the face on show
function createFlipClock (el: HTMLElement) {
  let epoch = now();
  let paused = false;
  let landing = 0;

  const syncAll = (animations: Animation[]) => {
    for (const animation of animations) {
      if ('animationName' in animation && animation.animationName === 'flip-cycle') {
        animation.startTime = epoch;
      }
    }
  };

  const handleAnimationStart = (e: AnimationEvent) => {
    if (e.animationName === 'flip-cycle') {
      syncAll((e.target as Element).getAnimations());
    }
  };
  el.addEventListener('animationstart', handleAnimationStart);

  const pauseOn = (face: number) => {
    paused = true;
    el.dataset.flipPaused = String(face);
  };

  return {
    toggle () {
      if (landing) {
        // pressed again before the slide landed
        window.clearTimeout(landing);
        landing = 0;
        return;
      }
      if (paused) {
        // resume from the start of the held face's hold; a strip offscreen all along kept its old animation, and
        // gets the new epoch here rather than from an animationstart
        epoch = now() - Number(el.dataset.flipPaused) * HALF_MS;
        paused = false;
        delete el.dataset.flipPaused;
        syncAll(el.getAnimations({ subtree: true }));
        return;
      }
      const time = (now() - epoch) % (2 * HALF_MS);
      const face = Math.floor(time / HALF_MS);
      const into = time % HALF_MS;
      if (into < HOLD_MS) {
        pauseOn(face);
      } else {
        // mid-slide: land on the next face first
        landing = window.setTimeout(() => {
          landing = 0;
          pauseOn(1 - face);
        }, HALF_MS - into);
      }
    },
    stop () {
      window.clearTimeout(landing);
      el.removeEventListener('animationstart', handleAnimationStart);
    },
  };
}

// space freezes the flips on whatever face they show instead of paging the dex down; quiet like the other hotkeys while
// typing, under a modal or an open menu, once claimed and beside a modifier, a control focused from the keyboard keeps
// its Space, and with nothing flipping (no seals yet, a checklist, the list view) it pages the dex as usual
export function useFlipClock (ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current!;
    const clock = createFlipClock(el);

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(MENU_OR_MODAL)) {
        return;
      }
      if (e.target instanceof Element && (e.target.closest('input, textarea, [contenteditable]') || e.target.matches(':focus-visible'))) {
        return;
      }
      if (!el.querySelector('.flip-strip')) {
        return;
      }
      // held down, each repeat would page the dex; only the first press toggles
      e.preventDefault();
      if (!e.repeat) {
        clock.toggle();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      clock.stop();
    };
  }, []);
}
