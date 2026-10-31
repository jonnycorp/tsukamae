import { useLayoutEffect, useState } from 'react';

import type { RefObject } from 'react';

// an element's content width in whole pixels, followed as it resizes (a scene's chart, which it lays out to fit). The
// new width is drawn on the next frame, not inside the observer's own delivery, where the growth it brings (and the
// scrollbar that can come with it) would be a change the observer has to report again before the frame can end
export function useContentWidth (ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    setWidth(Math.floor(el.clientWidth));
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(next));
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref]);

  return width;
}
