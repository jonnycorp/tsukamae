import { useEffect, useRef } from 'react';

// a bare letter; stays quiet while typing, under a modal, on key repeat and beside cmd/ctrl/alt
export function useHotkey (key: string, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      if (document.querySelector('.modal-overlay')) {
        return;
      }
      handlerRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key]);
}
