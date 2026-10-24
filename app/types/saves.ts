export interface GameSave {
  id: string;
  // data/games.json id
  game: string;
  // data/languages.json id
  language: string;
  ot: string;
  // the trainer's ID No., digits as the trainer card shows them (5 in X/Y and ORAS, 6 since), leading zeros kept;
  // absent on a game added before it was asked for
  tid?: string;
}
