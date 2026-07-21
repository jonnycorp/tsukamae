import type { GameFamily } from './games';

// caught = have it; temporary = placeholder to replace; locked = final.
export type CaptureStatus = 'caught' | 'temporary' | 'locked';

export interface Capture {
  pokemon: CapturePokemon;
  captured: boolean;
  // null while uncaught.
  status: CaptureStatus | null;
  // The game the mon originated from (id from data/games.json), if set.
  origin_game: string | null;
  language: string | null;
}

export interface CapturePokemon {
  id: number;
  national_id: number;
  name: string;
  // Official katakana species name (from PokéAPI via scripts/add-japanese-names.mjs).
  name_ja: string | null;
  game_family: GameFamily;
  form: string | null;
  box: string | null;
  dex_number: number;
}
