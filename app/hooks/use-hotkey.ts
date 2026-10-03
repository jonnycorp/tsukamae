import { useEffect, useRef } from 'react';

// a modal, the timeline, or a menu open anywhere: a dropdown (whose type-ahead a letter belongs to) or the nav's gear
// and theme menus; every keyboard shortcut stands down while one is up
export const MENU_OR_MODAL = '.modal-overlay, .timeline, .dropdown-menu, .nav-menu-dropdown';

// a bare letter; stays quiet while typing, under a modal or an open menu, for a key a control has already claimed, on
// key repeat and beside cmd/ctrl/alt
export function useHotkey (key: string, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key || e.defaultPrevented || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      if (document.querySelector(MENU_OR_MODAL)) {
        return;
      }
      handlerRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key]);
}
