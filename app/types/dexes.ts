import type { DexType } from './dex-types';
import type { Game } from './games';

export interface Dex {
  title: string;
  shiny: boolean;
  game: Game;
  dex_type: DexType;
  regional: boolean;
  total: number;
}
