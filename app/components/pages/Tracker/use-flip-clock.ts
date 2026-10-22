import { useCallback, useEffect, useRef, useState } from 'react';

import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';

import type { RefObject } from 'react';

// keep in sync with $flip-hold and $flip-slide in styles/tracker.scss
const HOLD_MS = 5500;
const SLIDE_MS = 800;
// a face's hold and the slide off it; the cycle holds the record's face (number, badges), then the trainer's
// (nickname, catch date, OT), then the types', unless Types in Flips is off (applyDisplay): then just the first two,
// though the types stay a face to hold while paused
const PHASE_MS = HOLD_MS + SLIDE_MS;
const cycleFaces = () => (document.documentElement.hasAttribute('data-flip-no-types') ? 2 : 3);

const now = () => document.timeline.currentTime as number;
const isFlip = (animation: Animation) => 'animationName' in animation && String(animation.animationName).startsWith('flip-cycle');
const up = (distance: string) => `translateY(calc(-1 * ${distance}))`;

// where a strip rests on each held face, as how far up it has moved, and where it rests on its copy of the first: the
// number line and the badges a line's height to the trainer's face and a block more to the types' (styles/tracker.scss),
// the name a line to its nickname, keeping its name, or the copy of it, for the types
const BLOCK_RESTS = ['0px', 'var(--flip-face)', 'calc(var(--flip-face) + var(--flip-lower))'];
const BLOCK_COPY = 'calc(var(--flip-face) + 2 * var(--flip-lower))';
const NAME_RESTS = ['0px', 'var(--flip-face)', '0px'];
const NAME_COPY = 'calc(2 * var(--flip-face))';

// a strip's slide between two held faces, a single move either way: a line's height or a block's, wrapping between the
// types and the first face through the strip's copy of the first rather than back past the trainer's
function slide (from: number, to: number, block: boolean): [string, string] | null {
  const rests = block ? BLOCK_RESTS : NAME_RESTS;
  let a = rests[from];
  let b = rests[to];
  if (a === b) {
    return null;
  }
  if (block && from === 2 && to === 0) {
    b = BLOCK_COPY;
  } else if (block && from === 0 && to === 2) {
    a = BLOCK_COPY;
  } else if (!block && from === 1 && to === 2) {
    b = NAME_COPY;
  } else if (!block && from === 2 && to === 1) {
    a = NAME_COPY;
  }
  return [up(a), up(b)];
}

interface Held {
  paused: boolean;
  face: number;
}

// every strip runs a flip-cycle animation (styles/tracker.scss) on the compositor, so a flip costs the page nothing;
// this starts each from one shared epoch, so a strip styled later (a box scrolling into view, a row's first seal) joins
// in step, and pauses them all on the face on show, where styles/tracker.scss holds them by a static transform. toggle()
// says whether the flips are now held, or about to be, and on which face; pick() moves the held face
function createFlipClock (el: HTMLElement, still: () => boolean) {
  let epoch = now();
  let paused = false;
  let landing = 0;
  // the slides a pick plays, cancelled by the next pick or a resume
  let slides: Animation[] = [];

  const syncAll = (animations: Animation[]) => {
    for (const animation of animations) {
      if (isFlip(animation)) {
        animation.startTime = epoch;
      }
    }
  };

  const handleAnimationStart = (e: AnimationEvent) => {
    if (e.animationName.startsWith('flip-cycle')) {
      syncAll((e.target as Element).getAnimations());
    }
  };
  el.addEventListener('animationstart', handleAnimationStart);

  const held = () => Number(el.dataset.flipPaused ?? 0);

  const stopSlides = () => {
    slides.forEach((animation) => animation.cancel());
    slides = [];
  };

  const pauseOn = (face: number) => {
    paused = true;
    el.dataset.flipPaused = String(face);
  };

  // every strip's slide from one held face to another, kept so the next pick or a resume can cancel it
  const playSlides = (from: number, to: number) => {
    for (const strip of el.querySelectorAll<HTMLElement>('.flip-strip')) {
      // a held line's record and trainer's faces are the same picture: nothing to slide between them
      if (from + to === 1 && strip.closest('.flip-hold')) {
        continue;
      }
      const path = slide(from, to, Boolean(strip.closest('.flip-numbers, .flip-badges')));
      if (path) {
        slides.push(strip.animate([{ transform: path[0] }, { transform: path[1] }], { duration: SLIDE_MS, easing: 'ease-in-out' }));
      }
    }
  };

  return {
    toggle (): Held {
      if (landing) {
        // pressed again before the slide landed
        window.clearTimeout(landing);
        landing = 0;
        return { paused: false, face: held() };
      }
      if (paused) {
        // resume from the start of the held face's hold; a strip offscreen all along kept its old animation, and
        // gets the new epoch here rather than from an animationstart
        const face = held();
        stopSlides();
        paused = false;
        delete el.dataset.flipPaused;
        if (face < cycleFaces()) {
          epoch = now() - face * PHASE_MS;
          syncAll(el.getAnimations({ subtree: true }));
          return { paused: false, face };
        }
        // held on the types with them out of the cycle: every strip slides back to the record's face as a pick would,
        // and the cycle starts that face's hold as the slide lands (until then the strips' own animations wait, and
        // show the record's face beneath the slide)
        playSlides(face, 0);
        epoch = now() + SLIDE_MS;
        syncAll(el.getAnimations({ subtree: true }));
        return { paused: false, face: 0 };
      }
      const faces = cycleFaces();
      const time = (now() - epoch) % (faces * PHASE_MS);
      const face = Math.floor(time / PHASE_MS);
      const into = time % PHASE_MS;
      if (into < HOLD_MS) {
        pauseOn(face);
        return { paused: true, face };
      }
      // mid-slide: land on the next face first
      const next = (face + 1) % faces;
      landing = window.setTimeout(() => {
        landing = 0;
        pauseOn(next);
      }, PHASE_MS - into);
      return { paused: true, face: next };
    },
    // while held, slides every strip to another face; false if there was nothing to move
    pick (face: number): boolean {
      const from = held();
      if (!paused || landing || face === from) {
        return false;
      }
      stopSlides();
      pauseOn(face);
      // in still mode the face changes where it stands
      if (!still()) {
        playSlides(from, face);
      }
      return true;
    },
    stop () {
      window.clearTimeout(landing);
      stopSlides();
      el.removeEventListener('animationstart', handleAnimationStart);
    },
  };
}

export interface FlipPause {
  paused: boolean;
  // the face held, or about to be: 0 the record's, 1 the trainer's, 2 the types'
  face: number;
  // bumps on every press, so each one flashes
  presses: number;
  // what Space does, for the header's pause button
  toggle: () => void;
  // the face picker's, while held
  pick: (face: number) => void;
}

// space freezes the flips on whatever face they show instead of paging the dex down; quiet like the other hotkeys while
// typing, under a modal or an open menu, once claimed and beside a modifier, a control focused from the keyboard keeps
// its Space, and with nothing flipping (no seals yet, a checklist, the list view) it pages the dex as usual. Still mode
// holds them: frozen as it comes on, as Space would (the picker open on the face that shows), let go as it goes, and
// neither Space nor the pause button lets them go in between
export function useFlipClock (ref: RefObject<HTMLElement>, still = false): FlipPause {
  const [state, setState] = useState({ paused: false, face: 0, presses: 0 });
  const clockRef = useRef<ReturnType<typeof createFlipClock> | null>(null);
  const stillRef = useRef(still);
  stillRef.current = still;
  const pausedRef = useRef(state.paused);
  pausedRef.current = state.paused;

  const flip = useCallback(() => {
    const clock = clockRef.current;
    if (clock) {
      const { paused, face } = clock.toggle();
      setState((prev) => ({ paused, face, presses: prev.presses + 1 }));
    }
  }, []);
  const toggle = useCallback(() => {
    if (!(stillRef.current && pausedRef.current)) {
      flip();
    }
  }, [flip]);

  const pick = useCallback((face: number) => {
    if (clockRef.current?.pick(face)) {
      setState((prev) => ({ ...prev, face }));
    }
  }, []);

  useEffect(() => {
    const el = ref.current!;
    const clock = createFlipClock(el, () => stillRef.current);
    clockRef.current = clock;

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
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      clock.stop();
      clockRef.current = null;
    };
  }, [toggle]);

  useEffect(() => {
    if (clockRef.current && still !== pausedRef.current) {
      flip();
    }
  }, [still, flip]);

  return { ...state, toggle, pick };
}
