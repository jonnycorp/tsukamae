import { useEffect } from 'react';

// How long a scrollbar stays visible after its container stops scrolling.
const FADE_DELAY_MS = 1000;

// Tags whatever element is actively scrolling with .is-scrolling, and drops
// the tag after a beat of stillness. The scrollbar-fade mixin (mixins.scss)
// keys the thumb color off that class, which is what makes scrollbars fade in
// while scrolling and back out afterwards.
export function useScrollbarFade () {
  useEffect(() => {
    const timers = new Map<Element, number>();

    // Scroll events don't bubble, but they do reach the document in the
    // capture phase, so one listener covers every scroll container.
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
