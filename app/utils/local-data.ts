import bdspNationalMeta from '../../data/dexes/bdsp-national/meta.json';
import bdspNationalPokemon from '../../data/dexes/bdsp-national/pokemon.json';
import bdspRegionalMeta from '../../data/dexes/bdsp-regional/meta.json';
import bdspRegionalPokemon from '../../data/dexes/bdsp-regional/pokemon.json';
import blueberryMeta from '../../data/dexes/blueberry/meta.json';
import blueberryPokemon from '../../data/dexes/blueberry/pokemon.json';
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

import { EMPTY_METADATA, dexBaselines, freshMetadata, withBaselines } from './capture-fields';
import { movedRecord, placeOf, samePlace } from './location-moves';

import type { Back } from './location-moves';
import type { Capture, CaptureMetadata, CapturePokemon, CaptureStatus, Dex, DexType, Game, GameSave, Place } from '../types';

export interface CatalogDex {
  key: string;
  name: string;
  game: Game;
  dex_type: DexType;
  total: number;
  pokemonList: CapturePokemon[];
}

type CatalogMeta = Omit<CatalogDex, 'pokemonList'>;

// a paired release under both its names, written as the dexes' own names write them
const GAME_NAME_OVERRIDES: Record<string, string> = {
  scarlet: 'Scarlet & Violet',
  scarlet_expansion_pass: 'Scarlet & Violet (Expansion Pass)',
  sword: 'Sword & Shield',
  sword_expansion_pass: 'Sword & Shield (Expansion Pass)',
  brilliant_diamond: 'Brilliant Diamond & Shining Pearl',
  lets_go_pikachu: 'Let\'s Go, Pikachu & Eevee',
  ultra_sun: 'Ultra Sun & Ultra Moon',
  sun: 'Sun & Moon',
  omega_ruby: 'Omega Ruby & Alpha Sapphire',
  x: 'X & Y',
};

function catalogEntry (meta: unknown, pokemonList: unknown): CatalogDex {
  const entry = { ...(meta as CatalogMeta), pokemonList: pokemonList as CapturePokemon[] };
  const gameName = GAME_NAME_OVERRIDES[entry.game.id];
  if (gameName) {
    entry.game = { ...entry.game, name: gameName };
  }
  // upstream mixes in a curly apostrophe (Let’s Go); straight, as everywhere else
  entry.name = entry.name.replace(/^HOME /, '').replaceAll('’', '\'');
  return entry;
}

export const DEX_CATALOG: CatalogDex[] = [
  catalogEntry(homeNationalMeta, homeNationalPokemon),
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

// a free-form dex holds mons of your choosing rather than a catalog's slots, as many of a species as you like,
// each an entry in one of its boxes, its record kept in progress under the entry's id as any dex's is
export interface FreeBox {
  id: string;
  // empty for its place's name ("Box 3")
  name: string;
  // its mons' order open to arrange and sort (utils/free-dex); locked when absent
  open?: boolean;
}

export interface FreeEntry {
  // its record's key, past every catalog's ids
  id: number;
  // the mon, by its id in HOME's national catalog (a form its own)
  species: number;
  box: string;
  slot: number;
}

export const FREE_ID_BASE = 10_000_000;

export interface PersonalDex {
  id: string;
  title: string;
  catalogKey: string;
  shiny: boolean;
  // set at creation only; never convertible in either direction
  checklist?: boolean;
  progress: Progress;
  captureDefaults?: CaptureDefaults;
  // set at creation only, as a checklist is; its catalog is HOME's national one, for its mons' looks
  free?: boolean;
  boxes?: FreeBox[];
  entries?: FreeEntry[];
  // its boxes' order open to arrange (utils/free-dex); locked when absent
  boxesOpen?: boolean;
  // the form each of its marked mons is shown as, by record key, where one's been kept (utils/looks): a choice of
  // display beside the records, not in them, so a sealed mon's can still change; it goes when its record does
  looks?: Record<string, string>;
}

export interface AppState {
  activeDexId: string;
  dexes: PersonalDex[];
  // absent on state written before saves existed
  saves?: GameSave[];
  // what the views keep (components/pages/Tracker/views): the name quiz's cards, the catch days' notes. A section of its
  // own, apart from the dexes, so it can be dropped whole
  views?: ViewsData;
}

// a view's section (quiz, days) of its own keys
export type ViewsData = Record<string, Record<string, unknown>>;

export function newId (prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const KNOWN_STATUSES = new Set<unknown>(['caught', 'temporary', 'unobtainable']);

const isKnownStatus = (status: unknown): status is CaptureStatus => KNOWN_STATUSES.has(status);

// a 2.0 export (or dex_data.json): every dex with an id, a title, a catalog and a progress map of records with a known
// status. Anything else, another JSON file or a 1.x export, is refused before it can replace the current state
export function isAppState (raw: unknown): raw is AppState {
  if (!isObject(raw) || !Array.isArray(raw.dexes)) {
    return false;
  }
  if (raw.activeDexId !== undefined && typeof raw.activeDexId !== 'string') {
    return false;
  }
  if (raw.saves !== undefined && !(Array.isArray(raw.saves) && raw.saves.every((save) => isObject(save) && typeof save.id === 'string'))) {
    return false;
  }
  return raw.dexes.every((dex) => isObject(dex) && typeof dex.id === 'string' && typeof dex.title === 'string' &&
    typeof dex.catalogKey === 'string' && isObject(dex.progress) &&
    // 1.x wrote its box check onto every dex it created, and its statuses overlap 2.0's, so that's what gives it away
    !('boxCheck' in dex) && !('checkedBoxes' in dex) &&
    (dex.captureDefaults === undefined || (isObject(dex.captureDefaults) &&
      (dex.captureDefaults.status === undefined || dex.captureDefaults.status === null || isKnownStatus(dex.captureDefaults.status)))) &&
    Object.values(dex.progress).every((entry) => isObject(entry) && isKnownStatus(entry.status)));
}

// the file on disk is ours, but can be hand-edited: a dex without a progress map gets an empty one, a record that isn't
// one (or has a status this version doesn't know) is dropped, and so is a game that isn't one, rather than failing every
// launch after. Import asks more of a dex than this repairs (a title, a catalog and a default status it knows), so a hand
// edit that breaks one of those still loads, but its export won't import. `dropped` says whether any of that happened,
// since the main process still holds the file as it was
function normalizeState (raw: unknown): { state: AppState; dropped: boolean } {
  if (!isObject(raw) || !Array.isArray(raw.dexes)) {
    return { state: { activeDexId: '', dexes: [] }, dropped: false };
  }
  const state = raw as unknown as AppState;
  let dropped = false;
  const dexes = state.dexes.filter(isObject);
  if (dexes.length !== state.dexes.length) {
    state.dexes = dexes;
    dropped = true;
  }
  for (const dex of state.dexes) {
    if (!isObject(dex.progress)) {
      dex.progress = {};
      dropped = true;
    }
    for (const [id, entry] of Object.entries(dex.progress)) {
      if (!isObject(entry) || !isKnownStatus(entry.status)) {
        delete dex.progress[id];
        dropped = true;
      }
    }
    // a look that isn't a form's name, or is of a mon the dex doesn't hold
    if (dex.looks !== undefined) {
      const held = new Set(dex.free ? (dex.entries ?? []).map((entry) => String(entry.id)) : Object.keys(dex.progress));
      const looks = isObject(dex.looks) ? Object.entries(dex.looks).filter(([id, form]) => typeof form === 'string' && form && held.has(id)) : [];
      if (!isObject(dex.looks) || looks.length !== Object.keys(dex.looks).length) {
        dex.looks = looks.length > 0 ? Object.fromEntries(looks) : undefined;
        dropped = true;
      }
    }
  }
  if (state.saves !== undefined) {
    const saves = Array.isArray(state.saves) ? state.saves.filter((save) => isObject(save) && typeof save.id === 'string') : [];
    if (!Array.isArray(state.saves) || saves.length !== state.saves.length) {
      state.saves = saves;
      dropped = true;
    }
  }
  if (state.views !== undefined && !(isObject(state.views) && Object.values(state.views).every(isObject))) {
    delete state.views;
    dropped = true;
  }
  if (typeof state.activeDexId !== 'string') {
    // a value Import would refuse, so the file needs it fixed too
    state.activeDexId = '';
    dropped = true;
  } else if (state.activeDexId && !state.dexes.some((dex) => dex.id === state.activeDexId)) {
    state.activeDexId = '';
  }
  return { state, dropped };
}

// the Electron preload bridge (electron/preload.js); absent in a browser
declare global {
  interface Window {
    tracker?: {
      load: () => Promise<unknown>;
      save: (state: AppState) => Promise<void>;
      // false when the main process holds no such dex to merge into
      patch: (dexId: string, entries: Record<string, ProgressEntry | null>) => Promise<boolean>;
      importState: (state: AppState) => Promise<void>;
      onSaveStatus: (listener: (ok: boolean) => void) => () => void;
      setTitleBarColors: (colors: { color: string; symbolColor: string }) => void;
      setBackground: (color: string) => void;
      pinZoom: () => void;
    };
  }
}

const BROWSER_STORAGE_KEY = 'dex_data';

// yarn start:fresh keeps everything in this tab's session, so real data is never touched and an import survives its reload
const FRESH = process.env.TSUKAMAE_FRESH === '1';
const FRESH_STORAGE_KEY = 'dex_data_fresh';

async function loadRaw (): Promise<unknown> {
  if (window.tracker && !FRESH) {
    return window.tracker.load();
  }
  const storage = FRESH ? window.sessionStorage : window.localStorage;
  try {
    return JSON.parse(storage.getItem(FRESH ? FRESH_STORAGE_KEY : BROWSER_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

async function saveRaw (state: AppState): Promise<void> {
  if (window.tracker && !FRESH) {
    return window.tracker.save(state);
  }
  const storage = FRESH ? window.sessionStorage : window.localStorage;
  storage.setItem(FRESH ? FRESH_STORAGE_KEY : BROWSER_STORAGE_KEY, JSON.stringify(state));
}

// whether the last save reached the disk. Electron's main process does the writing and says when that changes; in a
// browser the storage write is the save
type SaveStatusListener = (ok: boolean) => void;
const saveStatusListeners = new Set<SaveStatusListener>();
let saveOk = true;

function reportSave (ok: boolean) {
  if (ok !== saveOk) {
    saveOk = ok;
    saveStatusListeners.forEach((listener) => listener(ok));
  }
}

if (window.tracker && !FRESH) {
  window.tracker.onSaveStatus(reportSave);
}

export function isSaveOk (): boolean {
  return saveOk;
}

export function subscribeSaveStatus (listener: SaveStatusListener): () => void {
  saveStatusListeners.add(listener);
  return () => {
    saveStatusListeners.delete(listener);
  };
}

// set while an import waits on its file: a change made meanwhile (the page stays live) stays in memory, as sent against
// the tracker being replaced it would land on the import, or bring the old tracker back over it
let importing = false;

function save (state: AppState) {
  if (importing) {
    return;
  }
  saveRaw(state).then(() => {
    if (!window.tracker || FRESH) {
      reportSave(true);
    }
  }, (err) => {
    // eslint-disable-next-line no-console
    console.error('failed to save:', err);
    reportSave(false);
  });
}

let appState: AppState | null = null;

// keys no record holds any more, which nothing reads: an old experiment's log of a mon's moves
const RETIRED_KEYS = ['moves', 'shelf'];

// marked records predating a field's baseline get it written once, so storage holds what the UI shows (shiny as its
// dex's Shiny box says, as the whole dex was drawn shiny before a record kept it), and a retired key goes
function fillBaselines (state: AppState): boolean {
  let filled = false;
  for (const dex of state.dexes) {
    const baselines = dexBaselines(dex.shiny);
    for (const [id, entry] of Object.entries(dex.progress)) {
      let next = entry;
      if (RETIRED_KEYS.some((key) => key in entry)) {
        next = Object.fromEntries(Object.entries(entry).filter(([key]) => !RETIRED_KEYS.includes(key))) as ProgressEntry;
      }
      if (!dex.checklist && entry.status !== 'unobtainable') {
        next = withBaselines(next, baselines);
      }
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
    const { state, dropped } = normalizeState(await loadRaw());
    appState = state;
    // filled or cleaned up: the main process gets the whole of it, as tile patches will merge into its copy
    if (fillBaselines(state) || dropped) {
      save(state);
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
  save(state);
}

export function exportAppState (): string {
  return JSON.stringify(getAppState(), null, 2);
}

// built and saved in full before it replaces the live state, so a failure leaves everything as it was; in Electron that
// waits for the file itself, not just for the write to be queued
export async function importAppState (raw: AppState): Promise<void> {
  const { state: next } = normalizeState(structuredClone(raw));
  fillBaselines(next);
  importing = true;
  try {
    await (window.tracker && !FRESH ? window.tracker.importState(next) : saveRaw(next));
  } catch (err) {
    // refused, so the tracker on the page stands, with whatever changed while it waited
    importing = false;
    if (appState) {
      save(appState);
    }
    throw err;
  }
  appState = next;
  importing = false;
}

export function toDexView (dex: PersonalDex): Dex {
  const catalog = getCatalogDex(dex.catalogKey);
  return {
    title: dex.title,
    shiny: dex.shiny,
    free: Boolean(dex.free),
    game: catalog.game,
    dex_type: catalog.dex_type,
    regional: catalog.dex_type.tags.includes('regional'),
    // what numbers pad to (utils/pokemon numberDigits): a free-form dex numbers as its catalog does, however few it holds
    total: catalog.total,
  };
}

// a free-form dex's mons, box by box and slot by slot, each a capture under its entry's id with its species' looks
export function freeCaptures (dex: PersonalDex): Capture[] {
  const species = new Map(getCatalogDex(DEFAULT_CATALOG_KEY).pokemonList.map((mon) => [mon.id, mon]));
  const order = new Map((dex.boxes ?? []).map((box, i) => [box.id, i]));
  return [...(dex.entries ?? [])]
  .filter((entry) => species.has(entry.species) && order.has(entry.box))
  .sort((a, b) => order.get(a.box)! - order.get(b.box)! || a.slot - b.slot)
  .map((entry) => {
    const record = dex.progress[entry.id];
    return {
      ...EMPTY_METADATA,
      ...record,
      pokemon: { ...species.get(entry.species)!, id: entry.id, box: entry.box },
      captured: true,
      status: statusIn(dex, record?.status) ?? 'caught',
      sealed: Boolean(record?.sealed),
      look: dex.looks?.[entry.id] ?? null,
    };
  });
}

// a HOME dex that keeps records (not a checklist, whose Temporary is Elsewhere) has no Temporary: an open record
// there already is one. A stored Temporary, an old mark, reads as caught, and nothing offers it
export const noTemporary = (dex: Pick<PersonalDex, 'checklist' | 'catalogKey'>) => !dex.checklist && getCatalogDex(dex.catalogKey).game.id === 'home';
const statusIn = <S extends CaptureStatus | null | undefined>(dex: Pick<PersonalDex, 'checklist' | 'catalogKey'>, status: S): S | 'caught' =>
  (status === 'temporary' && noTemporary(dex) ? 'caught' : status);

export function progressToCaptures (dex: PersonalDex): Capture[] {
  if (dex.free) {
    return freeCaptures(dex);
  }
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
      status: statusIn(dex, entry.status) ?? null,
      sealed: Boolean(entry.sealed),
      look: dex.looks?.[pokemon.id] ?? null,
    };
  });
}

// over the catalog's slots, as the tracker counts: a record for an id the catalog doesn't have (an import from another
// dataset, a hand edit) can't be shown or released, so it isn't counted either
export function dexCounts (dex: PersonalDex): { marked: number; temporary: number; caught: number; total: number } {
  // a free-form dex's own: how many of its mons are sealed, of all it holds
  if (dex.free) {
    const entries = dex.entries ?? [];
    // each mon's status as freeCaptures reads it: caught, unless its record says otherwise
    const statusOf = (id: number) => statusIn(dex, dex.progress[id]?.status) ?? 'caught';
    return {
      marked: entries.filter((entry) => dex.progress[entry.id]?.sealed).length,
      temporary: entries.filter((entry) => statusOf(entry.id) === 'temporary').length,
      caught: entries.filter((entry) => statusOf(entry.id) === 'caught').length,
      total: entries.length,
    };
  }
  const catalog = getCatalogDex(dex.catalogKey);
  let marked = 0;
  let temporary = 0;
  let caught = 0;
  for (const { id } of catalog.pokemonList) {
    const entry = dex.progress[id];
    if (!entry) {
      continue;
    }
    marked++;
    const status = statusIn(dex, entry.status);
    if (status === 'temporary') {
      temporary++;
    } else if (status === 'caught') {
      caught++;
    }
  }
  return { marked, temporary, caught, total: catalog.total };
}

function findDex (state: AppState, dexId: string): PersonalDex {
  const dex = state.dexes.find((entry) => entry.id === dexId);
  if (!dex) {
    throw new Error(`unknown dex id ${dexId}`);
  }
  return dex;
}

// a new entry's prefills; useMark (use-mark.ts) builds the same for the tile it marks at once
function newEntryMetadata (dex: PersonalDex, saves: GameSave[], pokemonId: number): CaptureMetadata {
  const catalog = getCatalogDex(dex.catalogKey);
  return freshMetadata({
    defaults: dex.captureDefaults,
    checklist: Boolean(dex.checklist),
    homeDex: catalog.game.id === 'home',
    shiny: dex.shiny,
    genderLock: catalog.pokemonList.find((mon) => mon.id === pokemonId)?.gender_lock,
    saves,
  });
}

// a free-form dex's new mon's record: a mark's, with the dex's defaults
export function freshEntry (dex: PersonalDex, saves: GameSave[], species: number): ProgressEntry {
  return withBaselines({ ...newEntryMetadata(dex, saves, species), status: 'caught', sealed: false }, dexBaselines(dex.shiny));
}

// what a click marks; a checklist always checks as caught, and so does a default this version doesn't know, or a
// Temporary in a HOME dex
export function defaultStatus (dex: Pick<PersonalDex, 'checklist' | 'captureDefaults' | 'catalogKey'>): CaptureStatus {
  const status = !dex.checklist && dex.captureDefaults?.status;
  return isKnownStatus(status) ? statusIn(dex, status) ?? 'caught' : 'caught';
}

export interface UpdateCapturePayload extends Partial<CaptureMetadata> {
  pokemon: number;
  status?: CaptureStatus;
  sealed?: boolean;
}

// a tile's change, applied in memory at once; then only the records it changed go to the main process, which merges
// them into the tracker it holds rather than taking the whole of it again every click. A browser saves everything, as
// does a main process with no copy of the dex (a state it never saw)
function commitRecords (dexId: string, mutator: (dex: PersonalDex, state: AppState) => number[]): void {
  const state = getAppState();
  let changed: number[];
  let dex: PersonalDex;
  let looks: PersonalDex['looks'];
  try {
    dex = findDex(state, dexId);
    looks = dex.looks;
    changed = mutator(dex, state);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('failed to apply change:', err);
    return;
  }
  if (changed.length === 0) {
    return;
  }
  // a patch carries records alone, so one that took a look with it (a release) is saved whole
  if (!window.tracker || FRESH || importing || dex.looks !== looks) {
    save(state);
    return;
  }
  const entries = Object.fromEntries(changed.map((id) => [id, dex.progress[id] ?? null]));
  window.tracker.patch(dexId, entries).then((applied) => {
    // and only if this is still the tracker on the page: one replaced by an import mustn't be sent back over it
    if (!applied && state === appState) {
      save(state);
    }
  }, (err) => {
    // eslint-disable-next-line no-console
    console.error('failed to save:', err);
    reportSave(false);
  });
}

export function writeCapture (dexId: string, payload: UpdateCapturePayload): void {
  const { pokemon, ...changes } = payload;
  commitRecords(dexId, (dex, state) => {
    const existing = dex.progress[pokemon];

    if (existing?.sealed && changes.sealed !== false) {
      return [];
    }

    // unobtainable wiped the record, so leaving it starts over like a new mark; a record otherwise goes on from its status
    // as the dex reads it, an old Temporary in a HOME dex that keeps records as the Caught it shows (statusIn), so W can
    // seal it
    const reviving = existing?.status === 'unobtainable' && changes.status !== undefined && changes.status !== 'unobtainable';
    const base: ProgressEntry = existing && !reviving ? { ...existing, status: statusIn(dex, existing.status) } : {
      ...newEntryMetadata(dex, state.saves ?? [], dex.free ? (dex.entries ?? []).find((entry) => entry.id === pokemon)?.species ?? 0 : pokemon),
      status: defaultStatus(dex),
      sealed: false,
    };

    const next: ProgressEntry = { ...base, ...changes };
    // sealing is only ever from Caught, so a record leaving it leaves the seal behind
    if (next.status !== 'caught') {
      next.sealed = false;
    }
    if (next.status === 'unobtainable') {
      dex.progress[pokemon] = { ...next, ...EMPTY_METADATA };
    } else {
      dex.progress[pokemon] = dex.checklist ? next : withBaselines(next, dexBaselines(dex.shiny));
    }
    return [pokemon];
  });
}

export function deleteCaptures (dexId: string, pokemonIds: number[]): void {
  commitRecords(dexId, (dex) => {
    const released = pokemonIds.filter((id) => {
      if (!dex.progress[id] || dex.progress[id].sealed) {
        return false;
      }
      delete dex.progress[id];
      return true;
    });
    const looks = looksLess(dex.looks, released);
    if (looks !== dex.looks) {
      dex.looks = looks;
    }
    return released;
  });
}

// a dex's looks (utils/looks) less those of the mons given, as they leave it; the same where none of them had one
export function looksLess (looks: PersonalDex['looks'], ids: number[]): PersonalDex['looks'] {
  if (!looks || !ids.some((id) => id in looks)) {
    return looks;
  }
  const kept = Object.entries(looks).filter(([id]) => !ids.includes(Number(id)));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

// a marked mon's look kept, or its own form again (null); saved whole, a look being the dex's rather than its record's
export function writeLook (dexId: string, pokemon: number, form: string | null): void {
  const dex = getAppState().dexes.find((entry) => entry.id === dexId);
  const held = dex && (dex.free ? (dex.entries ?? []).some((entry) => entry.id === pokemon) : Boolean(dex.progress[pokemon]));
  if (!dex || !held || (dex.looks?.[pokemon] ?? null) === form) {
    return;
  }
  commitAppState(() => {
    const looks = looksLess(dex.looks, [pokemon]);
    dex.looks = form ? { ...looks, [pokemon]: form } : looks;
  });
}

// a sealed mon moved: the only write a sealed record takes besides unsealing, to where it is and with what it brought
// back from a game (its level, the Gigantamax factor). A move to where it already is, or of a record that isn't sealed,
// does nothing
export function moveCapture (dexId: string, pokemon: number, to: Place, back?: Back): void {
  commitRecords(dexId, (dex) => {
    const entry = dex.progress[pokemon];
    const here = entry && placeOf(entry);
    if (!entry?.sealed || (here && samePlace(here, to))) {
      return [];
    }
    dex.progress[pokemon] = movedRecord(entry, to, back);
    return [pokemon];
  });
}
