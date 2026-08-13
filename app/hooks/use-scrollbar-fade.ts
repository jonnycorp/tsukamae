import { useEffect } from 'react';

// how long a scrollbar stays visible after its container stops scrolling
const FADE_DELAY_MS = 1000;

// tags the scrolling element with .is-scrolling; the scrollbar-fade mixin keys off it
export function useScrollbarFade () {
  useEffect(() => {
    const timers = new Map<Element, number>();

    // scroll doesn't bubble but reaches document in the capture phase — one listener covers all
    const handleScroll = (event: Event) => {
      const el = event.target instanceof Element ? event.target : document.documentElement;

      el.classList.add('is-scrolling');
      window.clearTimeout(timers.get(el));
      timers.set(el, window.setTimeout(() => {
        el.classList.remove('is-scrolling');
        timers.delete(el);
      }, FADE_DELAY_MS));
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
}
