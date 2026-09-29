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

import { BASELINE_METADATA, EMPTY_METADATA, genderFromLock, lookupOT, metadataFromDefaults, withBaselines } from './capture-fields';

import type { Capture, CaptureMetadata, CapturePokemon, CaptureStatus, Dex, DexType, Game, GameSave } from '../types';

export interface CatalogDex {
  key: string;
  name: string;
  game: Game;
  dex_type: DexType;
  total: number;
  pokemonList: CapturePokemon[];
}

type CatalogMeta = Omit<CatalogDex, 'pokemonList'>;

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
};

function catalogEntry (meta: unknown, pokemonList: unknown): CatalogDex {
  const entry = { ...(meta as CatalogMeta), pokemonList: pokemonList as CapturePokemon[] };
  const gameName = GAME_NAME_OVERRIDES[entry.game.id];
  if (gameName) {
    entry.game = { ...entry.game, name: gameName };
  }
  entry.name = entry.name.replace(/^HOME /, '');
  return entry;
}

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
  sealed: boolean;
}

export type Progress = Record<string, ProgressEntry>;

export type CaptureDefaults = Partial<CaptureMetadata> & {
  status?: CaptureStatus | null;
};

export interface PersonalDex {
  id: string;
  title: string;
  catalogKey: string;
  shiny: boolean;
  // set at creation only; never convertible in either direction
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

export function newId (prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeState (raw: unknown): AppState {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).dexes)) {
    return { activeDexId: '', dexes: [] };
  }
  const state = raw as AppState;
  if (state.activeDexId && !state.dexes.some((dex) => dex.id === state.activeDexId)) {
    state.activeDexId = '';
  }
  return state;
}

declare global {
  interface Window {
    tracker?: {
      load: () => Promise<unknown>;
      save: (state: AppState) => Promise<void>;
    };
  }
}

const BROWSER_STORAGE_KEY = 'dex_data';

// yarn start:fresh keeps everything in memory so real data is never touched
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

// marked records predating a field's baseline get it written once, so storage holds what the UI shows
function fillBaselines (state: AppState): boolean {
  let filled = false;
  for (const dex of state.dexes) {
    if (dex.checklist) {
      continue;
    }
    for (const [id, entry] of Object.entries(dex.progress)) {
      if (entry.status === 'unobtainable') {
        continue;
      }
      const next = withBaselines(entry);
      if (next !== entry) {
        dex.progress[id] = next;
        filled = true;
      }
    }
  }
  return filled;
}

export async function loadAppState (): Promise<AppState> {
  if (!appState) {
    appState = normalizeState(await loadRaw());
    if (fillBaselines(appState)) {
      // eslint-disable-next-line no-console
      saveRaw(appState).catch((err) => console.error('failed to save:', err));
    }
  }
  return appState;
}

export function getAppState (): AppState {
  if (!appState) {
    throw new Error('app state accessed before loadAppState resolved');
  }
  return appState;
}

// mutates in memory synchronously; the disk write settles in the background
export function commitAppState (mutator: (state: AppState) => void): void {
  const state = getAppState();
  try {
    mutator(state);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('failed to apply change:', err);
    return;
  }
  // eslint-disable-next-line no-console
  saveRaw(state).catch((err) => console.error('failed to save:', err));
}

export function exportAppState (): string {
  return JSON.stringify(getAppState(), null, 2);
}

export async function importAppState (raw: unknown): Promise<void> {
  appState = normalizeState(raw);
  fillBaselines(appState);
  await saveRaw(appState);
}

export function toDexView (dex: PersonalDex): Dex {
  const catalog = getCatalogDex(dex.catalogKey);
  return {
    title: dex.title,
    shiny: dex.shiny,
    game: catalog.game,
    dex_type: catalog.dex_type,
    regional: catalog.dex_type.tags.includes('regional'),
    total: catalog.total,
  };
}

export function progressToCaptures (dex: PersonalDex): Capture[] {
  return getCatalogDex(dex.catalogKey).pokemonList.map((pokemon) => {
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
    };
  });
}

export function dexCounts (dex: PersonalDex): { marked: number; temporary: number; caught: number; total: number } {
  const entries = Object.values(dex.progress);
  let temporary = 0;
  let caught = 0;
  for (const entry of entries) {
    if (entry.status === 'temporary') {
      temporary++;
    } else if (entry.status === 'caught') {
      caught++;
    }
  }
  return { marked: entries.length, temporary, caught, total: getCatalogDex(dex.catalogKey).total };
}

function findDex (state: AppState, dexId: string): PersonalDex {
  const dex = state.dexes.find((entry) => entry.id === dexId);
  if (!dex) {
    throw new Error(`unknown dex id ${dexId}`);
  }
  return dex;
}

// a new entry's prefills; Pokemon.applyStatus mirrors this for the optimistic tile
function newEntryMetadata (dex: PersonalDex, saves: GameSave[], pokemonId: number): CaptureMetadata {
  const catalog = getCatalogDex(dex.catalogKey);
  const meta: CaptureMetadata = { ...EMPTY_METADATA, ...(dex.checklist ? {} : BASELINE_METADATA), ...metadataFromDefaults(dex.captureDefaults) };
  meta.ot = lookupOT(saves, meta.origin_game, meta.language);
  meta.location = catalog.game.id === 'home' ? 'home' : 'game';
  meta.location_save = null;
  meta.gender = genderFromLock(catalog.pokemonList.find((mon) => mon.id === pokemonId)?.gender_lock);
  return meta;
}

export interface UpdateCapturePayload extends Partial<CaptureMetadata> {
  pokemon: number;
  status?: CaptureStatus;
  sealed?: boolean;
}

// editingSealed is the TESTING seal-fx bypass for fixing sealed records
export function writeCapture (dexId: string, payload: UpdateCapturePayload, editingSealed = false): void {
  const { pokemon, ...changes } = payload;
  commitAppState((state) => {
    const dex = findDex(state, dexId);
    const existing = dex.progress[pokemon];

    if (existing?.sealed && changes.sealed !== false && !editingSealed) {
      return;
    }

    const base: ProgressEntry = existing ?? {
      ...newEntryMetadata(dex, state.saves ?? [], pokemon),
      status: dex.captureDefaults?.status ?? 'caught',
      sealed: false,
    };

    const next: ProgressEntry = { ...base, ...changes };
    if (next.status === 'unobtainable') {
      dex.progress[pokemon] = { ...next, ...EMPTY_METADATA };
    } else {
      dex.progress[pokemon] = dex.checklist ? next : withBaselines(next);
    }
  });
}

export function deleteCaptures (dexId: string, pokemonIds: number[]): void {
  commitAppState((state) => {
    const dex = findDex(state, dexId);
    for (const id of pokemonIds) {
      if (!dex.progress[id]?.sealed) {
        delete dex.progress[id];
      }
    }
  });
}
