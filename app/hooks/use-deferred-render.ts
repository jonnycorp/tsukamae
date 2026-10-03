import { useEffect, useState } from 'react';

// renders at once, or `frames` animation frames after mounting: a long list then fills in a few items a frame rather
// than building all of them in one blocking render
export function useDeferredRender (value: boolean, frames = 2): boolean {
  const [render, setRender] = useState(value);

  useEffect(() => {
    if (!render) {
      let left = frames;
      let id = 0;
      const tick = () => {
        left--;
        if (left <= 0) {
          setRender(true);
        } else {
          id = window.requestAnimationFrame(tick);
        }
      };
      id = window.requestAnimationFrame(tick);

      return () => window.cancelAnimationFrame(id);
    }
  }, []);

  return render;
}
