import { useEffect, useState } from 'react';

// a scene's content laid out for DESIGN_WIDTH and scaled up to a wider window, as the dex is fitted to one, so a
// maximized 1440p window reads it at about the dex's size rather than as a small island in the middle
const DESIGN_WIDTH = 1400;
const MAX_SCALE = 1.85;

const scaleFor = (width: number, max: number) => Math.min(max, Math.max(1, Math.floor((width / DESIGN_WIDTH) * 100) / 100));

// max: where it stops, sooner for what shares the window with the boxes (the dex's header)
export function useSceneScale (max = MAX_SCALE): number {
  const [scale, setScale] = useState(() => scaleFor(window.innerWidth, max));
  useEffect(() => {
    const handleResize = () => setScale(scaleFor(window.innerWidth, max));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [max]);
  return scale;
}
