import type { GameFamily } from './games';

// How a caught slot is held:
// - caught: a regular, properly obtained mon.
// - temporary: a placeholder (e.g. from Pokémon GO or traded from a stranger)
//   that should eventually be replaced with a properly obtained one.
// - locked: this slot is final and never changing.
export type CaptureStatus = 'caught' | 'temporary' | 'locked';

export interface Capture {
  pokemon: CapturePokemon;
  captured: boolean;
  // null while uncaught.
  status: CaptureStatus | null;
  // The game the mon originated from (id from data/games.json), if set.
  origin_game: string | null;
}

export interface CapturePokemon {
  id: number;
  national_id: number;
  name: string;
  game_family: GameFamily;
  form: string | null;
  box: string | null;
  dex_number: number;
}
