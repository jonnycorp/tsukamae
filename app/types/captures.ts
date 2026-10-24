export type CaptureStatus = 'unobtainable' | 'temporary' | 'caught';

export type CaptureLocation = 'home' | 'game' | 'champions';

// none = untrained; ivs = 3+ perfect; ev = EV-trained
export type TrainedState = 'none' | 'ivs' | 'ev';

// none = genderless
export type GenderState = 'none' | 'male' | 'female';

// species-level constraint from PokéAPI gender_rate; null = both genders possible
export type GenderLock = 'genderless' | 'male' | 'female';

export type FavoriteState = 'no' | 'favorite' | 'partner';

// null means unanswered, which blocks sealing; stored values are read as-is, so one outside these types is stale data
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
  nickname: string | null;
  ot: string | null;
  // the OT's ID No., as the summary shows it beside the OT: written with the OT when one of My Games is picked for it
  // (so two files of one game, same game, language and OT, stay apart), typed for a mon from anyone else
  tid: string | null;
  gender: GenderState | null;
  // a natures id from utils/capture-fields: the nature the summary names, which a mint never changes (it changes only
  // the stats, and the summary then notes the mint beside the original)
  nature: string | null;
  level: number | null;
  trained: TrainedState | null;
  favorite: FavoriteState | null;
}

// a place a mon can be: HOME, Champions, or one of your games (location_save)
export interface Place {
  location: CaptureLocation;
  location_save: string | null;
}

export interface Capture extends CaptureMetadata {
  pokemon: CapturePokemon;
  captured: boolean;
  status: CaptureStatus | null;
  // only reachable from 'caught'
  sealed: boolean;
}

// the eighteen types, as PokéAPI names them
export type PokemonType = 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting' | 'poison' | 'ground' |
  'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface CapturePokemon {
  id: number;
  national_id: number;
  name: string;
  // katakana species name, from scripts/enrich-species.mjs
  name_ja: string | null;
  form: string | null;
  box: string | null;
  dex_number: number;
  // of the species' debut; upstream's full game_family is reduced to this at generation time
  generation: number;
  // derived from PokéAPI, never authored
  legendary_class?: 'legendary' | 'mythical' | null;
  gender_lock?: GenderLock | null;
  // one or two, in slot order, from scripts/enrich-types.mjs: a regional form's own (Alolan Vulpix is ice)
  types?: PokemonType[];
}
