import { useCallback, useEffect, useRef, useState } from 'react';

import { DISPLAY_PAGES } from '../../../utils/display-modes';
import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';

import type { DisplayMode, FacePage } from '../../../utils/display-modes';
import type { RefObject } from 'react';

// keep in sync with $flip-hold and $flip-slide in styles/tile-faces.scss
const HOLD_MS = 5500;
const SLIDE_MS = 800;
// a face's hold and the slide off it; the cycle holds each of the display mode's pages in turn (utils/display-modes)
const PHASE_MS = HOLD_MS + SLIDE_MS;
// the keys that pick each held face, in the picker's order
export const FACE_KEYS = ['1', '2', '3'];

const now = () => document.timeline.currentTime as number;
const isFlip = (animation: Animation) => 'animationName' in animation && String(animation.animationName).startsWith('flip-cycle');
const up = (distance: string) => `translateY(calc(-1 * ${distance}))`;

// a strip's slide between two held faces, a single move either way (styles/tile-faces.scss places its rests): the
// lower block a page apart, wrapping between its last page and its first through its copy of the first; the name on
// its nickname for the trainer's page alone, the copy of its name after it
function slide (pages: FacePage[], from: number, to: number, lower: boolean): [string, string] | null {
  if (lower) {
    const n = pages.length;
    const at = (face: number) => `calc(${face} * var(--flip-face))`;
    const a = from === 0 && to === n - 1 ? at(n) : at(from);
    const b = from === n - 1 && to === 0 ? at(n) : at(to);
    return [up(a), up(b)];
  }
  const trainer = pages.indexOf('trainer');
  if (from !== trainer && to !== trainer) {
    return null;
  }
  const rest = (face: number) => (face === trainer ? 'var(--flip-face)' : face > trainer ? 'calc(2 * var(--flip-face))' : '0px');
  return [up(rest(from)), up(rest(to))];
}

interface Held {
  paused: boolean;
  face: number;
}

// every strip runs a flip-cycle animation (styles/tile-faces.scss) on the compositor, so a flip costs the page nothing;
// this starts each from one shared epoch, so a strip styled later (a box scrolling into view, a row's first seal) joins
// in step, and pauses them all on the face on show, where the styles hold them by a static transform. toggle() says
// whether the flips are now held, or about to be, and on which face; pick() moves the held face. pages() is the
// display mode's, read as each is needed
function createFlipClock (el: HTMLElement, still: () => boolean, pages: () => FacePage[]) {
  let epoch = now();
  let paused = false;
  let landing = 0;
  let landingOn = 0;
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
      const path = slide(pages(), from, to, Boolean(strip.closest('.flip-lower')));
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
        epoch = now() - face * PHASE_MS;
        syncAll(el.getAnimations({ subtree: true }));
        return { paused: false, face };
      }
      const faces = pages().length;
      const time = (now() - epoch) % (faces * PHASE_MS);
      const face = Math.floor(time / PHASE_MS);
      const into = time % PHASE_MS;
      if (into < HOLD_MS) {
        pauseOn(face);
        return { paused: true, face };
      }
      // mid-slide: land on the next face first
      const next = (face + 1) % faces;
      landingOn = next;
      landing = window.setTimeout(() => {
        landing = 0;
        pauseOn(next);
      }, PHASE_MS - into);
      return { paused: true, face: next };
    },
    // while held, slides every strip to another face; false if there was nothing to move
    pick (face: number): boolean {
      const from = held();
      if (!paused || landing || face === from || face >= pages().length) {
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
    // the display mode switched from the pages given: held, the strips hold the same page where the new mode has it (the
    // trainer's, the species'), or its first; the face now held, or null if they're running
    refit (from: FacePage[]): number | null {
      stopSlides();
      if (landing) {
        window.clearTimeout(landing);
        landing = 0;
        pauseOn(landingOn);
      }
      if (!paused) {
        return null;
      }
      pauseOn(Math.max(0, pages().indexOf(from[held()])));
      return held();
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
  // the face held, or about to be: the display mode's page, in its order
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
// its Space, and with nothing flipping (no seals yet, a checklist, the list view, Orbit's lone page) it pages the dex as
// usual. While they're held, 1 2 3 pick the face as the picker does, in its order. Still mode holds them: frozen as it
// comes on, as Space would (the picker open on the face that shows), let go as it goes, and neither Space nor the pause
// button lets them go in between
export function useFlipClock (ref: RefObject<HTMLElement>, still: boolean, display: DisplayMode): FlipPause {
  const [state, setState] = useState({ paused: false, face: 0, presses: 0 });
  const clockRef = useRef<ReturnType<typeof createFlipClock> | null>(null);
  const stillRef = useRef(still);
  stillRef.current = still;
  const pagesRef = useRef(DISPLAY_PAGES[display]);
  pagesRef.current = DISPLAY_PAGES[display];
  // the mode the strips were last drawn for, to hold the same page in the next
  const shownRef = useRef(display);
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
    const clock = createFlipClock(el, () => stillRef.current, () => pagesRef.current);
    clockRef.current = clock;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(MENU_OR_MODAL)) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      const face = FACE_KEYS.indexOf(e.key);
      if (face >= 0) {
        if (pausedRef.current && !e.repeat) {
          e.preventDefault();
          pick(face);
        }
        return;
      }
      if (e.key !== ' ' || (e.target instanceof Element && e.target.matches(':focus-visible'))) {
        return;
      }
      if (!el.querySelector('.flip-strip') || pagesRef.current.length < 2) {
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
  }, [toggle, pick]);

  useEffect(() => {
    if (clockRef.current && still !== pausedRef.current) {
      flip();
    }
  }, [still, flip]);

  useEffect(() => {
    const from = DISPLAY_PAGES[shownRef.current];
    shownRef.current = display;
    const face = clockRef.current?.refit(from) ?? null;
    if (face !== null) {
      setState((prev) => ({ ...prev, face }));
    }
  }, [display]);

  return { ...state, toggle, pick };
}
