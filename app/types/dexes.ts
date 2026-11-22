import type { DexType } from './dex-types';
import type { Game } from './games';

export interface Dex {
  title: string;
  // its Shiny box: new mons start shiny, and a slot with no record shows shiny (utils/shiny)
  shiny: boolean;
  // a free-form dex (utils/free-dex), any mon you have in boxes of your own, shiny ones among them
  free: boolean;
  game: Game;
  dex_type: DexType;
  regional: boolean;
  total: number;
}
