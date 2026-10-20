import { useEffect, useSyncExternalStore } from 'react';

// dev-only scaffolding (the theme preview): on under yarn start / electron:dev, off in every production build
export const TESTING = process.env.NODE_ENV !== 'production';

// a dev build shown as a production build has it: Ctrl+Shift+P (Cmd on macOS) hides the scaffolding and brings it back,
// held for the window's session so a reload keeps it. Dev-only UI asks useDevScaffolding() rather than TESTING, so the
// preview hides it too; a production build has neither the scaffolding nor the key
const PREVIEW_KEY = 'prodPreview';
const listeners = new Set<() => void>();

function readPreview (): boolean {
  try {
    return window.sessionStorage.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

let prodPreview = TESTING && readPreview();

function toggleProdPreview () {
  prodPreview = !prodPreview;
  try {
    window.sessionStorage.setItem(PREVIEW_KEY, prodPreview ? '1' : '0');
  } catch {
    // storage unavailable: held until a reload
  }
  listeners.forEach((listener) => listener());
}

function subscribe (listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDevScaffolding (): boolean {
  return useSyncExternalStore(subscribe, () => TESTING && !prodPreview);
}

// the key, in the capture phase so it works from a field or under a modal alike, and claimed so it never types
export function useProdPreviewHotkey () {
  useEffect(() => {
    if (!TESTING) {
      return;
    }
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (!e.repeat) {
          toggleProdPreview();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown, true);
    return () => document.removeEventListener('keydown', handleKeydown, true);
  }, []);
}
