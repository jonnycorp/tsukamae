import { useSyncExternalStore } from 'react';

// My Games' 引退: a save you can't reach anymore, its journey over (a cartridge gone, a file deleted). It's never
// offered as a place to move a mon to (the move menu), though records still name it as where they came from, and one
// still in it stays where it is. Kept in this window's storage, not in the collection's saves
const KEY = 'retiredSaves';
const listeners = new Set<() => void>();
let cache: Set<string> | null = null;

export function retiredSaves (): Set<string> {
  if (!cache) {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      cache = new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      cache = new Set();
    }
  }
  return cache;
}

export function setRetired (id: string, retired: boolean) {
  const next = new Set(retiredSaves());
  if (retired) {
    next.add(id);
  } else {
    next.delete(id);
  }
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // storage refused: it lasts as long as the window
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useRetiredSaves = () => useSyncExternalStore(subscribe, retiredSaves);
