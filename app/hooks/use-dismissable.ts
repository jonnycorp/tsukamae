import { useCallback, useEffect, useRef, useState } from 'react';

import type { RefObject } from 'react';

// keep in sync with $fade-duration in styles/variables.scss
export const FADE_MS = 150;

interface Options {
  onDismissed: () => void;
  // outside-click boundary (mousedown, so drag-selects ending outside don't close)
  ref?: RefObject<HTMLElement>;
}

// unmounts after a timeout rather than on transitionend, which doesn't reliably fire
export function useDismissable ({ onDismissed, ref }: Options) {
  const [closing, setClosing] = useState(false);

  const closingRef = useRef(false);
  const timeoutRef = useRef<number>();
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  const dismiss = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    setClosing(true);
    timeoutRef.current = window.setTimeout(() => onDismissedRef.current(), FADE_MS);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismiss]);

  useEffect(() => {
    if (!ref) {
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        dismiss();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ref, dismiss]);

  return { closing, dismiss };
}
