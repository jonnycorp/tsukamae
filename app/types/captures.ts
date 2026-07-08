import type { GameFamily } from './games';

export interface Capture {
  dex_id: number;
  pokemon: CapturePokemon;
  captured: boolean;
  // The game the mon currently lives in (id from data/games.json), if set.
  origin_game: string | null;
  // A placeholder mon (e.g. from Pokémon GO or traded from a stranger) that
  // should eventually be replaced with a properly obtained one.
  temporary: boolean;
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
