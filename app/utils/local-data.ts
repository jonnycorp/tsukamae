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
import legendsZAMegaDimensionMeta from '../../data/dexes/legends-z-a-mega-dimension/meta.json';
import legendsZAMegaDimensionPokemon from '../../data/dexes/legends-z-a-mega-dimension/pokemon.json';
import legendsZARegionalMeta from '../../data/dexes/legends-z-a-regional/meta.json';
import legendsZARegionalPokemon from '../../data/dexes/legends-z-a-regional/pokemon.json';
import letsGoRegionalMeta from '../../data/dexes/lets-go-regional/meta.json';
import letsGoRegionalPokemon from '../../data/dexes/lets-go-regional/pokemon.json';
import orasRegionalMeta from '../../data/dexes/oras-regional/meta.json';
import orasRegionalPokemon from '../../data/dexes/oras-regional/pokemon.json';
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

import { EMPTY_METADATA, coerceFavorite } from './capture-fields';

import type { Capture, CaptureMetadata, CapturePokemon, CaptureStatus, Dex, DexType, Game, GameSave } from '../types';

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

// data names games by their lead version; display them as pairs
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
  // home and legends_arceus keep their names
};

function catalogEntry (meta: unknown, pokemonList: unknown): CatalogDex {
  const entry = { ...(meta as CatalogMeta), pokemonList: pokemonList as CapturePokemon[] };
  const gameName = GAME_NAME_OVERRIDES[entry.game.id];
  if (gameName) {
    entry.game = { ...entry.game, name: gameName };
  }
  // drop the legacy "HOME " prefix from national-dex names
  entry.name = entry.name.replace(/^HOME /, '');
  return entry;
}

// newest game first, merging both manifests in generate-dataset.mjs
export const DEX_CATALOG: CatalogDex[] = [
  catalogEntry(homeNationalMeta, homeNationalPokemon),
  catalogEntry(homeNationalGigantamaxMeta, homeNationalGigantamaxPokemon),
  catalogEntry(legendsZARegionalMeta, legendsZARegionalPokemon),
  catalogEntry(legendsZAMegaDimensionMeta, legendsZAMegaDimensionPokemon),
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
  return DEX_CATALOG.find((entry) => entry.key === key) || DEX_CATALOG.find((entry) => entry.key === DEFAULT_CATALOG_KEY)!;
}

export interface ProgressEntry extends CaptureMetadata {
  status: CaptureStatus;
  // only reachable from 'caught'
  sealed: boolean;
}
export type Progress = Record<string, ProgressEntry>;

// per-dex prefills for newly marked mons only
export type CaptureDefaults = Partial<CaptureMetadata> & {
  status?: CaptureStatus | null;
};

export interface PersonalDex {
  id: string;
  title: string;
  catalogKey: string;
  shiny: boolean;
  // caught-or-not only, no metadata; set at creation, never convertible
  checklist?: boolean;
  progress: Progress;
  captureDefaults?: CaptureDefaults;
}

export interface AppState {
  activeDexId: string;
  dexes: PersonalDex[];
  // absent on state written before saves existed
  saves?: GameSave[];
}

export function newDexId (): string {
  return `dex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newSaveId (): string {
  return `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedState (): AppState {
  return { activeDexId: '', dexes: [] };
}

function normalizeState (raw: unknown): AppState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return seedState();
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.dexes)) {
    return seedState();
  }
  const state = raw as unknown as AppState;
  // clear activeDexId only when its dex is gone
  if (state.activeDexId && !state.dexes.some((dex) => dex.id === state.activeDexId)) {
    state.activeDexId = '';
  }
  return state;
}

export interface TrackerBridge {
  load: () => Promise<unknown>;
  save: (state: AppState) => Promise<void>;
}

declare global {
  interface Window {
    tracker?: TrackerBridge;
  }
}

const BROWSER_STORAGE_KEY = 'dex_data';

// fresh/test mode keeps everything in memory
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

export function exportAppState (): string {
  return JSON.stringify(getAppState(), null, 2);
}

export async function importAppState (raw: unknown): Promise<AppState> {
  const next = normalizeState(raw);
  appState = next;
  await saveRaw(next);
  return next;
}

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
    if (!entry) {
      return { ...EMPTY_METADATA, pokemon, captured: false, status: null, sealed: false };
    }
    // spread first so a field added later reads as unanswered
    return {
      ...EMPTY_METADATA,
      ...entry,
      pokemon,
      captured: true,
      status: entry.status,
      sealed: Boolean(entry.sealed),
      favorite: coerceFavorite((entry as unknown as Record<string, unknown>).favorite),
    };
  });
}

export function dexCounts (dex: PersonalDex): { marked: number; temporary: number; caught: number; sealed: number; total: number } {
  const entries = Object.values(dex.progress);
  return {
    // every slot with an entry, whatever its status
    marked: entries.length,
    temporary: entries.filter((entry) => entry.status === 'temporary').length,
    caught: entries.filter((entry) => entry.status === 'caught').length,
    sealed: entries.filter((entry) => entry.sealed).length,
    total: getCatalogDex(dex.catalogKey).total,
  };
}
