// one playthrough: game + language + the OT it stamps
export interface GameSave {
  id: string;
  // data/games.json id
  game: string;
  // data/languages.json id
  language: string;
  ot: string;
}
