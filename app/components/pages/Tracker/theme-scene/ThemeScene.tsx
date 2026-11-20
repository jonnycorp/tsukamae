import { useEffect, useRef } from 'react';

import { midnightScene } from './midnight';
import { shodoScene } from './shodo';
import { trellisScene } from './trellis';
import { tsukimiScene } from './tsukimi';
import { themeSlug } from '../../../../palette/themes';
import { useThemeContext } from '../../../../hooks/contexts/use-local-storage-context';

import type { Scene, SceneMaker } from './scene';

// a second-version theme's world, the boxes floating over it (styles/themes2): one canvas behind the dex, and for a
// theme that lights the page from outside it (Ink 2's leaf shadow) one over it, blended and never in the pointer's way.
// It moves slowly, at most 30 frames a second, and stops in still mode, a hidden window, or once the theme changes
const SCENES: Record<string, SceneMaker> = {
  'midnight-2': midnightScene,
  'ink-2': shodoScene,
  'wisteria-2': trellisScene,
  'wisteria-3': tsukimiScene,
};

const FRAME_MS = 1000 / 30;

export function ThemeScene () {
  const { theme, still } = useThemeContext();
  const slug = themeSlug(theme);
  const make = SCENES[slug];
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const back = backRef.current;
    if (!make || !back) {
      return undefined;
    }
    let scene: Scene | null = null;
    try {
      scene = make(back, frontRef.current);
    } catch {
      return undefined;
    }
    const s = scene;
    let frame = 0;
    let last = -Infinity;
    // the scene's own clock, held while still or hidden so it picks up where it stopped
    let clock = 0;
    let prev = performance.now();

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.resize(window.innerWidth, window.innerHeight, dpr);
      s.draw(clock);
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = now - prev;
      prev = now;
      if (document.hidden || still) {
        return;
      }
      clock += Math.min(dt, 100) / 1000;
      if (now - last < FRAME_MS) {
        return;
      }
      last = now;
      s.draw(clock);
    };
    size();
    window.addEventListener('resize', size);
    if (!still) {
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', size);
      s.dispose();
    };
  }, [make, still]);

  if (!make) {
    return null;
  }
  return (
    <>
      <canvas aria-hidden className="theme-scene theme-scene-back" key={`back-${slug}`} ref={backRef} />
      {make.front && <div aria-hidden className="theme-scene theme-scene-front" key={`front-${slug}`} ref={frontRef} />}
    </>
  );
}
