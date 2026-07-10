import { useCallback, useEffect, useRef, useState } from 'react';

import type { RefObject } from 'react';

// How long the fade-out plays before the dismissed element unmounts.
// Keep in sync with $fade-duration in styles/variables.scss.
export const FADE_MS = 150;

interface Options {
  // Called once the fade-out has finished — the parent unmounts the element.
  onDismissed: () => void;
  // Outside-click boundary: a mousedown outside this element dismisses.
  // (mousedown, not click, so a drag-select that ends outside doesn't close.)
  ref?: RefObject<HTMLElement>;
}

// Dismissal with an exit animation: dismiss() flips `closing` (the CSS fades
// on that class), then fires onDismissed after the fade so the parent can
// unmount. Esc always dismisses; outside clicks dismiss when a ref is given.
// A timeout, not transitionend, so unmount is reliable even if the transition
// never fires.
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
