import bdspNationalMeta from '../../data/dexes/bdsp-national/meta.json';
import bdspNationalPokemon from '../../data/dexes/bdsp-national/pokemon.json';
import bdspRegionalMeta from '../../data/dexes/bdsp-regional/meta.json';
import bdspRegionalPokemon from '../../data/dexes/bdsp-regional/pokemon.json';
import blueberryMeta from '../../data/dexes/blueberry/meta.json';
import blueberryPokemon from '../../data/dexes/blueberry/pokemon.json';
import homeNationalGigantamaxMeta from '../../data/dexes/home-national-gigantamax/meta.json';
import homeNationalGigantamaxPokemon from '../../data/dexes/home-national-gigantamax/pokemon.json';
import homeNationalMeta from '../../data/dexes/home-national/meta.json';
import homeNationalPokemon from '../../data/dexes/home-national/pokemon.json';
import kitakamiMeta from '../../data/dexes/kitakami/meta.json';
import kitakamiPokemon from '../../data/dexes/kitakami/pokemon.json';
import legendsArceusRegionalMeta from '../../data/dexes/legends-arceus-regional/meta.json';
import legendsArceusRegionalPokemon from '../../data/dexes/legends-arceus-regional/pokemon.json';
import letsGoRegionalMeta from '../../data/dexes/lets-go-regional/meta.json';
import letsGoRegionalPokemon from '../../data/dexes/lets-go-regional/pokemon.json';
import orasRegionalMeta from '../../data/dexes/oras-regional/meta.json';
import orasRegionalPokemon from '../../data/dexes/oras-regional/pokemon.json';
import originGamesJson from '../../data/games.json';
import paldeaFullMeta from '../../data/dexes/paldea-full/meta.json';
import paldeaFullPokemon from '../../data/dexes/paldea-full/pokemon.json';
import scarletVioletRegionalMeta from '../../data/dexes/scarlet-violet-regional/meta.json';
import scarletVioletRegionalPokemon from '../../data/dexes/scarlet-violet-regional/pokemon.json';
import sunMoonRegionalMeta from '../../data/dexes/sun-moon-regional/meta.json';
import sunMoonRegionalPokemon from '../../data/dexes/sun-moon-regional/pokemon.json';
import swordShieldExpansionRegionalMeta from '../../data/dexes/sword-shield-expansion-regional/meta.json';
import swordShieldExpansionRegionalPokemon from '../../data/dexes/sword-shield-expansion-regional/pokemon.json';
import swordShieldNationalMeta from '../../data/dexes/sword-shield-national/meta.json';
import swordShieldNationalPokemon from '../../data/dexes/sword-shield-national/pokemon.json';
import swordShieldRegionalMeta from '../../data/dexes/sword-shield-regional/meta.json';
import swordShieldRegionalPokemon from '../../data/dexes/sword-shield-regional/pokemon.json';
import ultraSunUltraMoonRegionalMeta from '../../data/dexes/ultra-sun-ultra-moon-regional/meta.json';
import ultraSunUltraMoonRegionalPokemon from '../../data/dexes/ultra-sun-ultra-moon-regional/pokemon.json';
import xYRegionalMeta from '../../data/dexes/x-y-regional/meta.json';
import xYRegionalPokemon from '../../data/dexes/x-y-regional/pokemon.json';

import type { Capture, CapturePokemon, CaptureStatus, Dex, DexType, Game } from '../types';

// ---------------------------------------------------------------------------
// The catalog: every dex structure bundled by scripts/generate-dataset.mjs.
// This never changes at runtime — the user creates personal dexes from it.
// ---------------------------------------------------------------------------

export interface CatalogDex {
  key: string;
  name: string;
  game: Game;
  dex_type: DexType;
  total: number;
  pokemonList: CapturePokemon[];
}

interface CatalogMeta {
  key: string;
  name: string;
  game: Game;
  dex_type: DexType;
  total: number;
}

function catalogEntry (meta: unknown, pokemonList: unknown): CatalogDex {
  return { ...(meta as CatalogMeta), pokemonList: pokemonList as CapturePokemon[] };
}

// Same order as DEX_MANIFEST in scripts/generate-dataset.mjs (newest first);
// the in-app picker preserves it.
export const DEX_CATALOG: CatalogDex[] = [
  catalogEntry(homeNationalMeta, homeNationalPokemon),
  catalogEntry(homeNationalGigantamaxMeta, homeNationalGigantamaxPokemon),
  catalogEntry(paldeaFullMeta, paldeaFullPokemon),
  catalogEntry(kitakamiMeta, kitakamiPokemon),
  catalogEntry(blueberryMeta, blueberryPokemon),
  catalogEntry(scarletVioletRegionalMeta, scarletVioletRegionalPokemon),
  catalogEntry(legendsArceusRegionalMeta, legendsArceusRegionalPokemon),
  catalogEntry(bdspRegionalMeta, bdspRegionalPokemon),
  catalogEntry(bdspNationalMeta, bdspNationalPokemon),
  catalogEntry(swordShieldExpansionRegionalMeta, swordShieldExpansionRegionalPokemon),
  catalogEntry(swordShieldRegionalMeta, swordShieldRegionalPokemon),
  catalogEntry(swordShieldNationalMeta, swordShieldNationalPokemon),
  catalogEntry(letsGoRegionalMeta, letsGoRegionalPokemon),
  catalogEntry(ultraSunUltraMoonRegionalMeta, ultraSunUltraMoonRegionalPokemon),
  catalogEntry(sunMoonRegionalMeta, sunMoonRegionalPokemon),
  catalogEntry(orasRegionalMeta, orasRegionalPokemon),
  catalogEntry(xYRegionalMeta, xYRegionalPokemon),
];

export const DEFAULT_CATALOG_KEY = 'home-national';

export function getCatalogDex (key: string): CatalogDex {
  // A progress file referencing a key that's no longer bundled (should never
  // happen — keys are append-only) falls back to the default dex structure
  // rather than crashing the tracker.
  return DEX_CATALOG.find((entry) => entry.key === key) || DEX_CATALOG.find((entry) => entry.key === DEFAULT_CATALOG_KEY)!;
}

// Origin-game options for the "which game was this mon caught in" dropdown.
export interface OriginGame {
  id: string;
  name: string;
}
export const ORIGIN_GAMES = originGamesJson as OriginGame[];

// ---------------------------------------------------------------------------
// Persisted state: the user's personal dexes, each an instance of a catalog
// entry with its own progress. Progress is a sparse map keyed by pokemon id —
// uncaught mons are omitted so the persisted file stays small and readable.
// ---------------------------------------------------------------------------

export interface ProgressEntry {
  status: CaptureStatus;
  origin_game: string | null;
}
export type Progress = Record<string, ProgressEntry>;

export interface PersonalDex {
  id: string;
  title: string;
  catalogKey: string;
  shiny: boolean;
  progress: Progress;
}

export interface AppState {
  activeDexId: string;
  dexes: PersonalDex[];
}

export function newDexId (): string {
  return `dex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// The pre-multi-dex format: one implicit HOME national dex, stored as a flat
// map of pokemon id → entry.
interface LegacyProgressEntry {
  captured: boolean;
  origin_game: string | null;
  temporary: boolean;
}

function seedState (): AppState {
  const dex: PersonalDex = {
    id: newDexId(),
    title: 'HOME National Living Dex',
    catalogKey: DEFAULT_CATALOG_KEY,
    shiny: false,
    progress: {},
  };
  return { activeDexId: dex.id, dexes: [dex] };
}

function migrateLegacyState (legacy: Record<string, LegacyProgressEntry>): AppState {
  const progress: Progress = {};
  for (const [pokemonId, entry] of Object.entries(legacy)) {
    if (!entry || !entry.captured) {
      continue;
    }
    progress[pokemonId] = {
      status: entry.temporary ? 'temporary' : 'caught',
      origin_game: entry.origin_game || null,
    };
  }
  const state = seedState();
  state.dexes[0].progress = progress;
  return state;
}

function normalizeState (raw: unknown): AppState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return seedState();
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.dexes)) {
    if (Object.keys(record).length === 0) {
      return seedState();
    }
    return migrateLegacyState(raw as Record<string, LegacyProgressEntry>);
  }
  const state = raw as unknown as AppState;
  if (state.dexes.length === 0) {
    return seedState();
  }
  if (!state.dexes.some((dex) => dex.id === state.activeDexId)) {
    state.activeDexId = state.dexes[0].id;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Persistence. The bridge exposed by the Electron preload script owns the
// file on disk; when the app runs in a plain browser (yarn start), it's
// absent and we fall back to localStorage so development still works.
// ---------------------------------------------------------------------------

export interface TrackerBridge {
  load: () => Promise<unknown>;
  save: (state: AppState) => Promise<void>;
}

declare global {
  interface Window {
    tracker?: TrackerBridge;
  }
}

const BROWSER_STORAGE_KEY = 'progress';

async function loadRaw (): Promise<unknown> {
  if (window.tracker) {
    return window.tracker.load();
  }
  try {
    return JSON.parse(window.localStorage.getItem(BROWSER_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

async function saveRaw (state: AppState): Promise<void> {
  if (window.tracker) {
    return window.tracker.save(state);
  }
  window.localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(state));
}

// The in-memory source of truth, shared by the dex-management context and the
// capture hooks. Loaded (and legacy files migrated) once on startup; every
// mutation writes the whole state back.
let appState: AppState | null = null;

export async function loadAppState (): Promise<AppState> {
  if (!appState) {
    appState = normalizeState(await loadRaw());
  }
  return appState;
}

export function getAppState (): AppState {
  if (!appState) {
    throw new Error('app state accessed before loadAppState resolved');
  }
  return appState;
}

export async function mutateAppState (mutator: (state: AppState) => void): Promise<AppState> {
  const state = getAppState();
  mutator(state);
  await saveRaw(state);
  return state;
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

// A Dex-shaped view of a personal dex so the components inherited from
// pokedextracker.com (iconClass, DexIndicator, box grouping, numbering) keep
// working unchanged.
export function toDexView (dex: PersonalDex): Dex {
  const catalog = getCatalogDex(dex.catalogKey);
  return {
    id: 1,
    user_id: 1,
    title: dex.title,
    slug: dex.id,
    shiny: dex.shiny,
    game: catalog.game,
    dex_type: catalog.dex_type,
    regional: catalog.dex_type.tags.includes('regional'),
    caught: 0,
    total: catalog.total,
    date_created: '',
    date_modified: '',
  };
}

export function progressToCaptures (dex: PersonalDex): Capture[] {
  const catalog = getCatalogDex(dex.catalogKey);
  return catalog.pokemonList.map((pokemon) => {
    const entry = dex.progress[pokemon.id];
    return {
      pokemon,
      captured: Boolean(entry),
      status: entry ? entry.status : null,
      origin_game: entry ? entry.origin_game : null,
    };
  });
}
