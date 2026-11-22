import { useEffect, useRef } from 'react';

import { kumoScene } from './kumo';
import { midnightScene } from './midnight';
import { onsenScene } from './onsen';
import { shodoScene } from './shodo';
import { yozakuraScene } from './yozakura';
import { setSceneGround } from '../../../../palette/apply-theme';
import { themeSlug } from '../../../../palette/themes';
import { useThemeContext } from '../../../../hooks/contexts/use-local-storage-context';

import type { Scene, SceneMaker } from './scene';

// a second-version theme's world, the boxes floating over it (styles/themes2): one canvas behind the dex. It moves
// slowly, at most 30 frames a second, and holds still in still mode, a hidden window, or under a page that covers the
// whole window (covered: W, the timeline, the almanac, a scene or a view), its clock held so it goes on from where it
// stopped; it's built anew only as the theme changes, or as the GPU comes back from losing its context
const SCENES: Record<string, SceneMaker> = {
  midnight: midnightScene,
  ink: shodoScene,
  wisteria: kumoScene,
  yozakura: yozakuraScene,
  onsen: onsenScene,
};

const FRAME_MS = 1000 / 30;

export function ThemeScene ({ covered }: { covered: boolean }) {
  const { theme, still } = useThemeContext();
  const slug = themeSlug(theme);
  const make = SCENES[slug];
  const backRef = useRef<HTMLCanvasElement>(null);
  const held = still || covered;
  const heldRef = useRef(held);
  heldRef.current = held;
  // sets the frames going again once they're let go
  const wakeRef = useRef(() => undefined as void);

  useEffect(() => {
    const back = backRef.current;
    if (!make || !back) {
      return undefined;
    }
    const listening = new AbortController();
    const { signal } = listening;
    let scene: Scene | null = null;
    let frame = 0;
    let sizing = 0;
    let last = -Infinity;
    let clock = 0;
    let prev = 0;

    // sized to the window at its pixel ratio, and drawn there at once (a held scene draws nothing else)
    const size = () => {
      sizing = 0;
      if (scene) {
        scene.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 2));
        scene.draw(clock);
      }
    };
    const build = () => {
      try {
        scene = make(back);
      } catch {
        scene = null;
        return;
      }
      setSceneGround(scene.ground ?? null);
      size();
      // a scene over pictures, drawn again once they're in
      const built = scene;
      built.ready?.then(() => scene === built && built.draw(clock), () => undefined);
    };
    const tick = (now: number) => {
      if (heldRef.current || !scene) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
      const dt = now - prev;
      prev = now;
      if (document.hidden) {
        return;
      }
      clock += Math.min(dt, 100) / 1000;
      if (now - last < FRAME_MS) {
        return;
      }
      last = now;
      scene.draw(clock);
    };
    const wake = () => {
      if (!frame && !heldRef.current && scene) {
        prev = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    wakeRef.current = wake;

    // a drag of the window's edge sends a resize a pointer move: refitted once a frame, as a scene over pictures
    // resamples every one of them to the new size
    const handleResize = () => {
      if (!sizing) {
        sizing = requestAnimationFrame(size);
      }
    };
    // the window taken to a screen of another pixel ratio, which sends no resize of its own: watched at the ratio it's
    // at, and again at the new one
    const watchRatio = () => {
      window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => {
        watchRatio();
        handleResize();
      }, { once: true, signal });
    };
    // the GPU's context lost (a driver reset, a sleep): taken back when it's offered, and the scene built on it anew
    const handleLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      scene?.dispose();
      scene = null;
    };
    const handleRestored = () => {
      build();
      wake();
    };

    build();
    wake();
    watchRatio();
    window.addEventListener('resize', handleResize, { signal });
    back.addEventListener('webglcontextlost', handleLost, { signal });
    back.addEventListener('webglcontextrestored', handleRestored, { signal });
    return () => {
      listening.abort();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(sizing);
      wakeRef.current = () => undefined;
      scene?.dispose();
      scene = null;
      setSceneGround(null);
    };
  }, [make]);

  useEffect(() => {
    if (!held) {
      wakeRef.current();
    }
  }, [held]);

  if (!make) {
    return null;
  }
  return (
    <canvas aria-hidden className="theme-scene" key={slug} ref={backRef} />
  );
}
