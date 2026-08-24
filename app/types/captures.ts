import type { GameFamily } from './games';

// unobtainable = no legal way to get it; temporary = placeholder; caught = properly obtained
export type CaptureStatus = 'unobtainable' | 'temporary' | 'caught';

// 'champions' is only reachable once been_to_champions is true
export type CaptureLocation = 'home' | 'game' | 'champions';

// none = untrained; ivs = 3+ perfect; ev = EV-trained
export type TrainedState = 'none' | 'ivs' | 'ev';

// none = genderless
export type GenderState = 'none' | 'male' | 'female';

// species-level constraint from PokéAPI gender_rate; null = both genders possible
export type GenderLock = 'genderless' | 'male' | 'female';

// favorite = blue heart, nickname floors it there; partner = red heart, hand-picked only
export type FavoriteState = 'no' | 'favorite' | 'partner';

// null means unanswered, which blocks sealing
export interface CaptureMetadata {
  // id from data/games.json
  origin_game: string | null;
  language: string | null;
  // permanent — a mon keeps its champions data after coming back
  been_to_champions: boolean | null;
  location: CaptureLocation | null;
  // which save holds it, when location is 'game'
  location_save: string | null;
  ball: string | null;
  // ISO yyyy-mm-dd
  catch_date: string | null;
  has_nickname: boolean | null;
  // only meaningful when has_nickname is true
  nickname: string | null;
  ot: string | null;
  gender: GenderState | null;
  // 1–100
  level: number | null;
  trained: TrainedState | null;
  // legacy booleans coerce at read time (true → 'favorite')
  favorite: FavoriteState | null;
}

export interface Capture extends CaptureMetadata {
  pokemon: CapturePokemon;
  captured: boolean;
  // null while uncaught
  status: CaptureStatus | null;
  // only reachable from 'caught'
  sealed: boolean;
}

export interface CapturePokemon {
  id: number;
  national_id: number;
  name: string;
  // katakana species name, from scripts/enrich-species.mjs
  name_ja: string | null;
  game_family: GameFamily;
  form: string | null;
  box: string | null;
  dex_number: number;
  // derived from PokéAPI, never authored
  legendary_class?: 'legendary' | 'mythical' | null;
  gender_lock?: GenderLock | null;
}
