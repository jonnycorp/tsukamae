// what a mon's origin game makes possible, so a record is only ever offered what one from there can hold:
// - the balls it could have been caught, hatched or given in there;
// - the languages the game was made in;
// - how many digits its ID No. has (five to Gen 6, 0 to 65535; six from Gen 7);
// - how long its OT can be, set the day it's caught, and its nickname.
// Checked on 2026-11-19 against PKHeX's legality tables (BallUseLegality, Legal.cs) and Bulbapedia's ball, ID No., name
// and language pages. An origin that's no one game (HOME's legacy, a trade, Other) holds any standard ball; a gift any of
// those, its Cherish Ball, and the Hisuian Poké Ball Legends: Arceus's gifts came in
import { GAME_FACTS } from './game-facts';

// the generation a game came out in (utils/game-facts.ts, as the red pen reads it); none for an origin that's no one game
const generationOf = (game: string | null | undefined): number | null => (game ? GAME_FACTS[game]?.gen ?? null : null);

// ---- balls

// never a mon's own: the Strange Ball is what a game shows for a ball it hasn't got (Hisui's), the Park Ball only ever
// carried Pal Park's catches home to their own, and 不明 isn't one
export const NEVER_BALLS = new Set(['strange_ball', 'park_ball', 'unknown']);
const HISUI = ['hisuian_poke_ball', 'hisuian_great_ball', 'hisuian_ultra_ball', 'feather_ball', 'wing_ball', 'jet_ball',
  'hisuian_heavy_ball', 'leaden_ball', 'gigaton_ball', 'origin_ball'];
// Diamond and Pearl's fourteen, every game's since (but Let's Go's and Legends')
const G4 = ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball', 'net_ball', 'dive_ball', 'nest_ball', 'repeat_ball', 'timer_ball',
  'luxury_ball', 'premier_ball', 'dusk_ball', 'heal_ball', 'quick_ball'];
const APRICORN = ['fast_ball', 'level_ball', 'lure_ball', 'heavy_ball', 'love_ball', 'friend_ball', 'moon_ball'];
// every standard ball: Gen 7 on, any of them (one bought, found or given, or passed down an egg from either parent)
const STANDARD = [...G4, ...APRICORN, 'safari_ball', 'sport_ball', 'dream_ball', 'beast_ball'];

const BALLS_BY_GAME: Record<string, string[]> = {
  // Kanto's: the Dive and Premier Balls only as items brought over from Ruby, Sapphire, Emerald or the GameCube games
  firered: ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball', 'safari_ball', 'net_ball', 'nest_ball', 'repeat_ball', 'timer_ball',
    'luxury_ball', 'dive_ball', 'premier_ball'],
  // Gen 3 to 5 eggs hatch in a Poké Ball, so these are what each game threw: the Great Marsh's Safari Ball
  diamond: [...G4, 'safari_ball'],
  platinum: [...G4, 'safari_ball'],
  // the Safari Zone, the Bug-Catching Contest's Sport Ball and Kurt's Apricorn balls
  heartgold: [...G4, 'safari_ball', 'sport_ball', ...APRICORN],
  // the Dream Ball, from the Dream World and the Entree Forest
  black: [...G4, 'dream_ball'],
  // Gen 6 eggs take the mother's ball, any up to the Dream Ball; no Beast Ball yet
  x: [...G4, ...APRICORN, 'safari_ball', 'sport_ball', 'dream_ball'],
  sun: STANDARD,
  lets_go_pikachu: ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball', 'premier_ball'],
  sword: STANDARD,
  brilliant_diamond: STANDARD,
  // Hisui's ten (the Origin Ball for Dialga and Palkia), and no Master Ball
  legends_arceus: HISUI,
  scarlet: STANDARD,
  // no eggs, but every standard ball sold or given (the Heal Ball at the Boutique)
  legends_za: STANDARD,
  // what GO catches with: its Master Ball since 2023, and the Beast Ball for Ultra Beasts
  go: ['poke_ball', 'great_ball', 'ultra_ball', 'premier_ball', 'master_ball', 'beast_ball'],
  // a gift: any standard ball, the Cherish Ball most came in, and the Hisuian Poké Ball of Legends: Arceus's
  mystery_gift: [...STANDARD, 'cherish_ball', 'hisuian_poke_ball'],
};
// each version as its pair
for (const [version, pair] of [['leafgreen', 'firered'], ['pearl', 'diamond'], ['soulsilver', 'heartgold'], ['white', 'black'], ['black_2', 'black'],
  ['white_2', 'black'], ['y', 'x'], ['omega_ruby', 'x'], ['alpha_sapphire', 'x'], ['moon', 'sun'], ['ultra_sun', 'sun'], ['ultra_moon', 'sun'],
  ['lets_go_eevee', 'lets_go_pikachu'], ['shield', 'sword'], ['shining_pearl', 'brilliant_diamond'], ['violet', 'scarlet']]) {
  BALLS_BY_GAME[version] = BALLS_BY_GAME[pair];
}

// whether a mon from this origin can be in this ball: its game's, or for one that's no one game (HOME's legacy, a trade,
// Other, none yet) any standard ball
export function ballAllowed (game: string | null | undefined, ball: string): boolean {
  return !NEVER_BALLS.has(ball) && (BALLS_BY_GAME[game ?? ''] ?? STANDARD).includes(ball);
}

// ---- languages: each game in the languages it was made in: FireRed and LeafGreen in six, Korean from Diamond and Pearl,
// Chinese from Sun and Moon

const WESTERN = ['japanese', 'english', 'french', 'italian', 'german', 'spanish'];
export function languageAllowed (game: string | null | undefined, language: string): boolean {
  const generation = generationOf(game);
  if (generation === null) {
    return true;
  }
  if (generation === 3) {
    return WESTERN.includes(language);
  }
  if (generation <= 6) {
    return WESTERN.includes(language) || language === 'korean';
  }
  return true;
}

// ---- the ID No.: five digits to Gen 6 (a 16-bit number, 0 to 65535, kept so in every game after), six from Gen 7; an
// origin that's no one game, up to six

export function idLength (game: string | null | undefined): number {
  const generation = generationOf(game);
  return generation !== null && generation <= 6 ? 5 : 6;
}

export function idAllowed (game: string | null | undefined, tid: string): boolean {
  const length = idLength(game);
  return /^\d+$/.test(tid) && tid.length <= length && (length === 6 || Number(tid) <= 65535);
}

// ---- names: an OT is set the day it's caught, so its game's limit holds (Gen 3 to 5: 5 in Japanese or Korean, 7 in
// the rest; from Gen 6, 6 and 12). A nickname takes its language's from Gen 6 whatever the game: a Gen 3 to 5 mon that came
// over without one can be given its first in Sword, Shield, Scarlet or Violet

export const CJK = new Set(['japanese', 'korean', 'chinese_simplified', 'chinese_traditional']);
export function otMax (game: string | null | undefined, language: string | null | undefined): number {
  const generation = generationOf(game) ?? 9;
  const cjk = CJK.has(language ?? '');
  if (generation <= 5) {
    return cjk ? 5 : 7;
  }
  return cjk ? 6 : 12;
}

export const nicknameMax = (language: string | null | undefined): number => (CJK.has(language ?? '') ? 6 : 12);
