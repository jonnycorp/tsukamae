import { regionOf } from '../../../utils/game-facts';
import { MYSTERY_GIFT, ORIGIN_GAMES } from '../../../utils/capture-fields';
import { gameColor } from '../../../utils/game-colors';
import { placeFromKey, placeKey, shownPlace } from '../../../utils/location-moves';

import type { Capture, CaptureLocation, CapturePokemon, GameSave } from '../../../types';

// journeys (J): the master set's sealed mons as strands from the game each was caught in to the generation it belongs
// to (its slot's, so an Alolan form is Gen 7's), or, the other way the right side splits, to where it is now. A
// record's fields are placeholders till it's sealed, so only sealed ones travel

export type Split = 'generation' | 'place';

// how the games on the left are gathered: each on its own, sister versions as one (Scarlet and Violet), or every game
// set in one region as one (Kanto's: FireRed, LeafGreen and the Let's Go pair)
export type Grouping = 'each' | 'pairs' | 'regions';

// sister versions, newest first, each pair under the short name players give it
export const PAIRS: { games: [string, string]; en: string; ja: string }[] = [
  { games: ['scarlet', 'violet'], en: 'SV', ja: 'SV' },
  { games: ['brilliant_diamond', 'shining_pearl'], en: 'BDSP', ja: 'BDSP' },
  { games: ['sword', 'shield'], en: 'SwSh', ja: '剣盾' },
  { games: ['lets_go_pikachu', 'lets_go_eevee'], en: 'LGPE', ja: 'ピカブイ' },
  { games: ['ultra_sun', 'ultra_moon'], en: 'USUM', ja: 'USUM' },
  { games: ['sun', 'moon'], en: 'SM', ja: 'SM' },
  { games: ['omega_ruby', 'alpha_sapphire'], en: 'ORAS', ja: 'ORAS' },
  { games: ['x', 'y'], en: 'XY', ja: 'XY' },
  { games: ['black_2', 'white_2'], en: 'B2W2', ja: 'BW2' },
  { games: ['black', 'white'], en: 'BW', ja: 'BW' },
  { games: ['heartgold', 'soulsilver'], en: 'HGSS', ja: 'HGSS' },
  { games: ['diamond', 'pearl'], en: 'DP', ja: 'DP' },
  { games: ['firered', 'leafgreen'], en: 'FRLG', ja: 'FRLG' },
];
const pairKey = (pair: (typeof PAIRS)[number]) => `pair:${pair.games.join('+')}`;
const PAIR_OF = new Map(PAIRS.flatMap((pair) => pair.games.map((game) => [game, pair])));
export const pairNamed = (key: string) => PAIRS.find((pair) => pairKey(pair) === key);

// a game's stop on the left: the game, its pair (pair:scarlet+violet), or its region's games (region:1 for Kanto's). A
// game of no region (HOME, GO, a trade, a gift) always stands alone
export function groupOf (game: string, grouping: Grouping): string {
  const pair = PAIR_OF.get(game);
  if (grouping === 'pairs' && pair) {
    return pairKey(pair);
  }
  const region = regionOf(game);
  return grouping === 'regions' && region ? `region:${region}` : game;
}

// the generation whose region a stop on the left is set in, by which the lanes and the wheel line it up: a remake's
// its region's, so Brilliant Diamond stands with Sinnoh's Gen 4 and Omega Ruby with Hoenn's Gen 3; null for one of none
export function groupGeneration (key: string): number | null {
  if (key.startsWith('region:')) {
    return Number(key.slice(7));
  }
  return regionOf(pairNamed(key)?.games[0] ?? key);
}

// the finest pieces the strands are made of, one game, one generation and one place each: either split draws the
// pieces with the same two ends as one strand, so going from one to the other moves every piece across
export interface Piece {
  key: string;
  origin: string;
  // its stop on the left, the origin or what gathers it (groupOf)
  group: string;
  generation: number;
  place: string;
  count: number;
}

// one end of the strands: an origin game, a generation (gen:N) or a place (home, champions, game:<save>, or game with
// the save unknown)
export interface Stop {
  key: string;
  count: number;
  // of them, how many have been to Champions (permanent, wherever they are now)
  visited: number;
  // the mons themselves, in the dex's order, for the tooltip's sprites
  mons: CapturePokemon[];
}

export interface Route extends Stop {
  from: string;
  to: string;
}

export interface JourneysData {
  total: number;
  // Mystery Gift's mons, when they're left out
  hidden: number;
  // the stops on the left: the games, or what gathers them
  origins: Stop[];
  // the games a stop on the left gathers, with how many of its mons each holds, in the games' order
  members: Record<string, { game: string; count: number }[]>;
  generations: Stop[];
  places: Stop[];
  // in no order of their own: pieceOrder stacks them, in each split
  pieces: Piece[];
  routes: Record<Split, Route[]>;
}

const ORIGIN_ORDER = new Map(ORIGIN_GAMES.map((game, i) => [game.id, i]));

export const generationKey = (generation: number) => `gen:${generation}`;
export const generationOf = (key: string) => Number(key.slice(4));

// a place's filter value: the Location filter knows HOME, Champions and "in a game", not which save, nor which of your
// checklists' boxes a free-form dex's mon is in, in HOME
export function locationOf (key: string): CaptureLocation {
  return placeFromKey(key).location;
}

const emptyStop = (key: string): Stop => ({ key, count: 0, visited: 0, mons: [] });

// the games newest first, as the origin filter lists them; the places as a mon moves through them: HOME, Champions,
// then your games in My Games' order, a game whose save is unknown last
export const originRank = (key: string) => ORIGIN_ORDER.get(key) ?? 99;

export function placeRank (key: string, saves: GameSave[]): number {
  if (key === 'home') {
    return -2;
  }
  if (key === 'champions') {
    return -1;
  }
  const at = saves.findIndex((save) => `game:${save.id}` === key);
  return at === -1 ? saves.length : at;
}

// gifts: false leaves out Mystery Gift's mons, which reach every generation from the one stop
export function journeys (captures: Capture[], saves: GameSave[], grouping: Grouping, gifts: boolean): JourneysData {
  const origins = new Map<string, Stop>();
  const members = new Map<string, Map<string, number>>();
  const generations = new Map<string, Stop>();
  const places = new Map<string, Stop>();
  const routes: Record<Split, Map<string, Route>> = { generation: new Map(), place: new Map() };
  const pieces = new Map<string, Piece>();
  const data: JourneysData = {
    total: 0,
    hidden: 0,
    origins: [],
    members: {},
    generations: [],
    places: [],
    pieces: [],
    routes: { generation: [], place: [] },
  };

  const bump = (stop: Stop, capture: Capture) => {
    stop.count++;
    stop.visited += Number(capture.been_to_champions === true);
    stop.mons.push(capture.pokemon);
  };
  const stopIn = (map: Map<string, Stop>, key: string) => map.get(key) ?? map.set(key, emptyStop(key)).get(key)!;
  const routeIn = (map: Map<string, Route>, from: string, to: string) =>
    map.get(`${from}>${to}`) ?? map.set(`${from}>${to}`, { ...emptyStop(`${from}>${to}`), from, to }).get(`${from}>${to}`)!;

  for (const capture of captures) {
    const place = capture.sealed ? shownPlace(capture, saves) : null;
    if (!place || !capture.origin_game) {
      continue;
    }
    const origin = capture.origin_game;
    if (!gifts && origin === MYSTERY_GIFT) {
      data.hidden++;
      continue;
    }
    const group = groupOf(origin, grouping);
    const generation = capture.pokemon.generation;
    const to = placeKey(place);
    bump(stopIn(origins, group), capture);
    bump(stopIn(generations, generationKey(generation)), capture);
    bump(stopIn(places, to), capture);
    bump(routeIn(routes.generation, group, generationKey(generation)), capture);
    bump(routeIn(routes.place, group, to), capture);
    const games = members.get(group) ?? members.set(group, new Map()).get(group)!;
    games.set(origin, (games.get(origin) ?? 0) + 1);
    const key = `${origin}|${generation}|${to}`;
    const piece = pieces.get(key) ?? pieces.set(key, { key, origin, group, generation, place: to, count: 0 }).get(key)!;
    piece.count++;

    data.total++;
  }

  // a stop on the left where its newest game would stand; the generations newest first too, Gen 9 down to Gen 1
  for (const [group, games] of members) {
    data.members[group] = [...games].map(([game, count]) => ({ game, count })).sort((a, b) => originRank(a.game) - originRank(b.game));
  }
  const groupRank = (key: string) => originRank(data.members[key][0].game);
  data.origins = [...origins.values()].sort((a, b) => groupRank(a.key) - groupRank(b.key));
  data.generations = [...generations.values()].sort((a, b) => generationOf(b.key) - generationOf(a.key));
  data.places = [...places.values()].sort((a, b) => placeRank(a.key, saves) - placeRank(b.key, saves));
  const rightRank = (split: Split, key: string) => (split === 'generation' ? -generationOf(key) : placeRank(key, saves));
  for (const split of ['generation', 'place'] as Split[]) {
    data.routes[split] = [...routes[split].values()].sort((a, b) => groupRank(a.from) - groupRank(b.from) || rightRank(split, a.to) - rightRank(split, b.to));
  }
  data.pieces = [...pieces.values()];
  return data;
}

// the order a split stacks the pieces in at each end, as the stops run down their columns (games and generations
// newest first): leaving a stop on the left, by the other end and then by game, and reaching a stop, by the strand's
// own stop on the left (groupRank, its place down that column) and then by game, so each strand's pieces lie together
// at both ends (a pair's two games side by side in it, and a region's, whose games needn't stand together in the
// games' order) and the strands cross no more than they must
export function pieceOrder (split: Split, saves: GameSave[], groupRank: (group: string) => number): { left: (a: Piece, b: Piece) => number; right: (a: Piece, b: Piece) => number } {
  const place = (piece: Piece) => placeRank(piece.place, saves);
  const game = (a: Piece, b: Piece) => originRank(a.origin) - originRank(b.origin);
  const group = (a: Piece, b: Piece) => groupRank(a.group) - groupRank(b.group);
  if (split === 'generation') {
    return {
      left: (a, b) => b.generation - a.generation || game(a, b) || place(a) - place(b),
      right: (a, b) => group(a, b) || game(a, b) || place(a) - place(b),
    };
  }
  return {
    left: (a, b) => place(a) - place(b) || game(a, b) || b.generation - a.generation,
    right: (a, b) => group(a, b) || game(a, b) || b.generation - a.generation,
  };
}

// a place's colour: HOME's (a checklist's boxes there too), Champions' gold, or the game of the save it's in
export function placeColor (key: string, saves: GameSave[]): string {
  if (locationOf(key) === 'home') {
    return gameColor('home');
  }
  if (key === 'champions') {
    return 'var(--jr-gold)';
  }
  return gameColor(saves.find((save) => `game:${save.id}` === key)?.game);
}
