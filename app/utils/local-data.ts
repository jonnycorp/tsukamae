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
import languagesJson from '../../data/languages.json';
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

// The bundled data names each dex's game after its single lead version (e.g.
// "Scarlet"); these override that with the recognizable pair shown in the dex
// picker and dex list. HOME stays HOME (it's the vehicle) — only the "National
// Dex" name is cleaned of the HOME prefix, below.
const GAME_NAME_OVERRIDES: Record<string, string> = {
  scarlet: 'Scarlet/Violet',
  scarlet_expansion_pass: 'Scarlet/Violet (Expansion Pass)',
  sword: 'Sword/Shield',
  sword_expansion_pass: 'Sword/Shield (Expansion Pass)',
  brilliant_diamond: 'Brilliant Diamond/Shining Pearl',
  lets_go_pikachu: 'Let\'s Go Pikachu/Eevee',
  ultra_sun: 'Ultra Sun/Ultra Moon',
  sun: 'Sun/Moon',
  omega_ruby: 'Omega Ruby/Alpha Sapphire',
  x: 'X/Y',
  // home and legends_arceus keep their names (vehicle / single game).
};

function catalogEntry (meta: unknown, pokemonList: unknown): CatalogDex {
  const entry = { ...(meta as CatalogMeta), pokemonList: pokemonList as CapturePokemon[] };
  const gameName = GAME_NAME_OVERRIDES[entry.game.id];
  if (gameName) {
    entry.game = { ...entry.game, name: gameName };
  }
  // Drop the legacy "HOME " prefix from the national-dex display names.
  entry.name = entry.name.replace(/^HOME /, '');
  return entry;
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

// Language-of-origin options for the "what language is this mon" dropdown. The
// set of languages the mainline games (Gen 6+ / HOME) support is small and
// fixed, so it lives in a bundled file rather than behind an API. `abbr` is the
// in-game three-letter tag (JPN, ENG, …).
export interface Language {
  id: string;
  name: string;
  abbr: string;
}
export const LANGUAGES = languagesJson as Language[];

// ---------------------------------------------------------------------------
// Persisted state: the user's personal dexes, each an instance of a catalog
// entry with its own progress. Progress is a sparse map keyed by pokemon id —
// uncaught mons are omitted so the persisted file stays small and readable.
// ---------------------------------------------------------------------------

export interface ProgressEntry {
  status: CaptureStatus;
  origin_game: string | null;
  language: string | null;
}
export type Progress = Record<string, ProgressEntry>;

// Per-dex prefills applied when a mon is NEWLY marked (never retroactively —
// see the capture mutation hooks). Each field is independent; unset fields
// stay blank so the missing-metadata mark still nags. E.g. a regional living
// dex where every catch is a locked local catch sets all three, while a
// national dex sets none so unfinished bookkeeping stays visible.
export interface CaptureDefaults {
  status: CaptureStatus | null;
  origin_game: string | null;
  language: string | null;
}

export interface PersonalDex {
  id: string;
  title: string;
  catalogKey: string;
  shiny: boolean;
  progress: Progress;
  // Absent on dexes created before this feature — treated as all-unset.
  captureDefaults?: CaptureDefaults;
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

// A brand-new install has no dexes and lands on the landing page. activeDexId
// '' means "no dex open" — the user creates their first dex from there.
function seedState (): AppState {
  return { activeDexId: '', dexes: [] };
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
      language: null,
    };
  }
  // Preserve the old implicit single dex as a real National dex, but land on
  // the landing page (activeDexId '') with it shown in the list.
  const dex: PersonalDex = {
    id: newDexId(),
    title: 'National Living Dex',
    catalogKey: DEFAULT_CATALOG_KEY,
    shiny: false,
    progress,
  };
  return { activeDexId: '', dexes: [dex] };
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
  // An empty dex list is valid (landing page). Only clear activeDexId when it
  // points at a dex that no longer exists — fall back to the landing page
  // rather than force-opening an arbitrary dex.
  if (state.activeDexId && !state.dexes.some((dex) => dex.id === state.activeDexId)) {
    state.activeDexId = '';
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

// Fresh/test mode (`yarn start:fresh`): keep everything in memory only. Real
// localStorage is never read or written, so testing can't clobber saved data
// and every reload starts from a clean slate.
const FRESH = process.env.TSUKAMAE_FRESH === '1';
let memoryStore: unknown = {};

async function loadRaw (): Promise<unknown> {
  if (FRESH) {
    return memoryStore;
  }
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
  if (FRESH) {
    memoryStore = state;
    return;
  }
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
// Import / Export: a portable JSON snapshot of the whole tracker (every dex and
// its progress). Used to back up data and carry it between app versions or
// machines. Works in the browser and the Electron build alike; the Electron
// File menu offers the same thing via native OS dialogs.
// ---------------------------------------------------------------------------

export function exportAppState (): string {
  return JSON.stringify(getAppState(), null, 2);
}

// Adopt an imported snapshot as the new state and persist it. normalizeState
// validates and migrates older/legacy shapes, so an export from a previous
// version still imports cleanly. Callers should reload afterwards so the React
// tree re-derives from the new snapshot.
export async function importAppState (raw: unknown): Promise<AppState> {
  const next = normalizeState(raw);
  appState = next;
  await saveRaw(next);
  return next;
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
      // `?? null` keeps progress files written before languages existed valid.
      language: entry ? entry.language ?? null : null,
    };
  });
}

// Summary counts for a dex (for the landing-page list). Every progress entry is
// a caught mon; temporary/locked are subsets by status.
export function dexCounts (dex: PersonalDex): { caught: number; temporary: number; locked: number; total: number } {
  const entries = Object.values(dex.progress);
  return {
    caught: entries.length,
    temporary: entries.filter((entry) => entry.status === 'temporary').length,
    locked: entries.filter((entry) => entry.status === 'locked').length,
    total: getCatalogDex(dex.catalogKey).total,
  };
}
