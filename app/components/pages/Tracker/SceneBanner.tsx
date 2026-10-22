import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';

import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';

// in step with styles/scene-banner.scss: the tab's glide in to its rest; the dex under it fading in; a beat for
// that to land before the tab goes; its glide out
const ENTER_MS = 300;
const REVEAL_MS = 240;
const HOLD_MS = 140;
const EXIT_MS = 260;

interface Props {
  title: string;
  // what's under it is ready to be seen
  ready: boolean;
  // at rest: what's under it, out of sight by then, can change (a view's swap)
  onCovered?: () => void;
  // at rest with what's under it ready: that fades in, and the tab goes once it has
  onReveal?: () => void;
  onCleared: () => void;
}

// the boxes' or the list's name, as one swaps for the other, on a tab hanging from the bottom of the header: it
// glides in from the left and rests on the header's margin while the new one builds out of sight, then that fades in,
// and only once it has does the tab glide on out to the right. It never moves while the page works: the heavy part
// comes while it rests. Still mode: no motion, there only as long as what's under it needs
export function SceneBanner ({ title, ready, onCovered, onReveal, onCleared }: Props) {
  const { still } = useThemeContext();
  const [rested, setRested] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const revealed = rested && ready;
  const handlers = useRef({ onCovered, onReveal, onCleared });
  handlers.current = { onCovered, onReveal, onCleared };

  useEffect(() => {
    if (rested) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setRested(true);
      handlers.current.onCovered?.();
    }, still ? 0 : ENTER_MS);
    return () => window.clearTimeout(timer);
  }, [rested, still]);

  useEffect(() => {
    if (!revealed) {
      return undefined;
    }
    handlers.current.onReveal?.();
    const timer = window.setTimeout(() => setLeaving(true), still ? 0 : REVEAL_MS + HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [revealed, still]);

  useEffect(() => {
    if (!leaving) {
      return undefined;
    }
    const timer = window.setTimeout(() => handlers.current.onCleared(), still ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, still]);

  return (
    <div aria-hidden="true" className={classNames('scene-banner', { leaving })}>
      <span className="scene-banner-tab">{title}</span>
    </div>
  );
}

// resolves once what's under `root` has stopped building itself (no node added or taken away for three frames running),
// or after `max` ms whatever it's doing: a view mounting its boxes or rows a few a frame
export function whenSettled (root: Element, max = 1600): Promise<void> {
  return new Promise((resolve) => {
    let quiet = 0;
    let frame = 0;
    const observer = new MutationObserver(() => {
      quiet = 0;
    });
    const done = () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, max);
    const tick = () => {
      quiet++;
      if (quiet >= 3) {
        done();
      } else {
        frame = window.requestAnimationFrame(tick);
      }
    };
    observer.observe(root, { childList: true, subtree: true });
    frame = window.requestAnimationFrame(tick);
  });
}
