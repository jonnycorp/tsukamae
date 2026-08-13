import { useCallback, useEffect, useRef } from 'react';

// batches rapid input into one commit — on idle pause, on flush (blur), or on unmount
export function useDebouncedCommit (delay = 600) {
  const timerRef = useRef<number>();
  const pendingRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    pendingRef.current = null;
  }, []);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    cancel();
    pending?.();
  }, [cancel]);

  const schedule = useCallback((commit: () => void) => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }
    pendingRef.current = commit;
    timerRef.current = window.setTimeout(flush, delay);
  }, [flush, delay]);

  // a pending edit survives dismissal
  useEffect(() => flush, [flush]);

  return { schedule, flush, cancel };
}
