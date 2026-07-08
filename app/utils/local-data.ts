import dexMetaJson from '../../data/dex-meta.json';
import originGamesJson from '../../data/games.json';
import pokemonListJson from '../../data/dex.json';

import type { Capture, CapturePokemon, Dex } from '../types';

// The static dataset: the full national living dex structure (with regional
// forms boxed at the bottom) snapshotted from the live pokedextracker.com API
// by scripts/generate-dataset.mjs. This never changes at runtime — only the
// user's progress does.
export const POKEMON_LIST = pokemonListJson as CapturePokemon[];

// Origin-game options for the "where does this mon currently live" dropdown.
export interface OriginGame {
  id: string;
  name: string;
}
export const ORIGIN_GAMES = originGamesJson as OriginGame[];

// A Dex-shaped constant so the existing components (iconClass, box grouping,
// numbering) keep working unchanged with the single static dex.
export const DEX: Dex = {
  id: 1,
  user_id: 1,
  title: dexMetaJson.title,
  slug: dexMetaJson.slug,
  shiny: dexMetaJson.shiny,
  game: dexMetaJson.game,
  dex_type: dexMetaJson.dex_type,
  regional: dexMetaJson.regional,
  caught: 0,
  total: dexMetaJson.total,
  date_created: '',
  date_modified: '',
};

// The user's progress: a sparse map keyed by pokemon id. Entries with all
// default values are omitted so the persisted file stays small and readable.
export interface ProgressEntry {
  captured: boolean;
  origin_game: string | null;
  temporary: boolean;
}
export type Progress = Record<string, ProgressEntry>;

// The bridge exposed by the Electron preload script. When the app runs in a
// plain browser (yarn start), it's absent and we fall back to localStorage so
// development without Electron still works.
export interface TrackerBridge {
  load: () => Promise<Progress>;
  save: (progress: Progress) => Promise<void>;
}

declare global {
  interface Window {
    tracker?: TrackerBridge;
  }
}

const BROWSER_STORAGE_KEY = 'progress';

export async function loadProgress (): Promise<Progress> {
  if (window.tracker) {
    return window.tracker.load();
  }
  try {
    return JSON.parse(window.localStorage.getItem(BROWSER_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export async function saveProgress (progress: Progress): Promise<void> {
  if (window.tracker) {
    return window.tracker.save(progress);
  }
  window.localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(progress));
}

const DEFAULT_ENTRY: ProgressEntry = {
  captured: false,
  origin_game: null,
  temporary: false,
};

export function progressToCaptures (progress: Progress): Capture[] {
  return POKEMON_LIST.map((pokemon) => {
    const entry = progress[pokemon.id] || DEFAULT_ENTRY;
    return {
      dex_id: DEX.id,
      pokemon,
      captured: entry.captured,
      origin_game: entry.origin_game,
      temporary: entry.temporary,
    };
  });
}

export function capturesToProgress (captures: Capture[]): Progress {
  const progress: Progress = {};
  for (const capture of captures) {
    // Only persist non-default entries to keep the file sparse.
    if (capture.captured || capture.origin_game || capture.temporary) {
      progress[capture.pokemon.id] = {
        captured: capture.captured,
        origin_game: capture.origin_game,
        temporary: capture.temporary,
      };
    }
  }
  return progress;
}
