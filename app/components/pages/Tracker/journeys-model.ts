import { ORIGIN_GAMES } from '../../../utils/capture-fields';
import { gameColor } from '../../../utils/game-colors';
import { placeKey, shownPlace } from '../../../utils/location-moves';

import type { Capture, CaptureLocation, CapturePokemon, GameSave } from '../../../types';

// journeys (J): the master set's sealed mons as strands from the game each was caught in to the generation it belongs
// to (its slot's, so an Alolan form is Gen 7's), or, the other way the right side splits, to where it is now. A
// record's fields are placeholders till it's sealed, so only sealed ones travel

export type Split = 'generation' | 'place';

// the finest pieces the strands are made of, one game, one generation and one place each: either split draws the
// pieces with the same two ends as one strand, so going from one to the other moves every piece across
export interface Piece {
  key: string;
  origin: string;
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
  origins: Stop[];
  generations: Stop[];
  places: Stop[];
  // in the order they stack in each split
  pieces: Piece[];
  routes: Record<Split, Route[]>;
}

const ORIGIN_ORDER = new Map(ORIGIN_GAMES.map((game, i) => [game.id, i]));

export const generationKey = (generation: number) => `gen:${generation}`;
export const generationOf = (key: string) => Number(key.slice(4));

// a place's filter value: the Location filter knows HOME, Champions and "in a game", not which save
export function locationOf (key: string): CaptureLocation {
  return key.startsWith('game') ? 'game' : key as CaptureLocation;
}

const emptyStop = (key: string): Stop => ({ key, count: 0, visited: 0, mons: [] });

export function journeys (captures: Capture[], saves: GameSave[]): JourneysData {
  const origins = new Map<string, Stop>();
  const generations = new Map<string, Stop>();
  const places = new Map<string, Stop>();
  const routes: Record<Split, Map<string, Route>> = { generation: new Map(), place: new Map() };
  const pieces = new Map<string, Piece>();
  const data: JourneysData = {
    total: 0,
    origins: [],
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
    const place = capture.sealed ? shownPlace(capture) : null;
    if (!place || !capture.origin_game) {
      continue;
    }
    const origin = capture.origin_game;
    const generation = capture.pokemon.generation;
    const to = placeKey(place);
    bump(stopIn(origins, origin), capture);
    bump(stopIn(generations, generationKey(generation)), capture);
    bump(stopIn(places, to), capture);
    bump(routeIn(routes.generation, origin, generationKey(generation)), capture);
    bump(routeIn(routes.place, origin, to), capture);
    const key = `${origin}|${generation}|${to}`;
    const piece = pieces.get(key) ?? pieces.set(key, { key, origin, generation, place: to, count: 0 }).get(key)!;
    piece.count++;

    data.total++;
  }

  // the games newest first, as the origin filter lists them, and the generations so too, Gen 9 down to Gen 1; the
  // places as a mon moves through them: HOME, Champions, then your games in My Games' order, a game whose save is
  // unknown last
  const placeRank = (key: string) => {
    if (key === 'home') {
      return -2;
    }
    if (key === 'champions') {
      return -1;
    }
    const at = saves.findIndex((save) => `game:${save.id}` === key);
    return at === -1 ? saves.length : at;
  };
  data.origins = [...origins.values()].sort((a, b) => (ORIGIN_ORDER.get(a.key) ?? 99) - (ORIGIN_ORDER.get(b.key) ?? 99));
  data.generations = [...generations.values()].sort((a, b) => generationOf(b.key) - generationOf(a.key));
  data.places = [...places.values()].sort((a, b) => placeRank(a.key) - placeRank(b.key));
  const originRank = (key: string) => ORIGIN_ORDER.get(key) ?? 99;
  const rightRank = (split: Split, key: string) => (split === 'generation' ? -generationOf(key) : placeRank(key));
  for (const split of ['generation', 'place'] as Split[]) {
    data.routes[split] = [...routes[split].values()].sort((a, b) => originRank(a.from) - originRank(b.from) || rightRank(split, a.to) - rightRank(split, b.to));
  }
  data.pieces = [...pieces.values()];
  return data;
}

// the order a split stacks the pieces in at each end, as the stops run down their columns (games and generations
// newest first): leaving a game, by the other end, and reaching a stop, by the game, so each strand's pieces lie
// together at both ends and the strands cross no more than they must
export function pieceOrder (split: Split, saves: GameSave[]): { left: (a: Piece, b: Piece) => number; right: (a: Piece, b: Piece) => number } {
  const placeRank = (key: string) => (key === 'home' ? -2 : key === 'champions' ? -1 : saves.findIndex((save) => `game:${save.id}` === key) + 1 || saves.length + 1);
  const originRank = (key: string) => ORIGIN_ORDER.get(key) ?? 99;
  if (split === 'generation') {
    return {
      left: (a, b) => b.generation - a.generation || placeRank(a.place) - placeRank(b.place),
      right: (a, b) => originRank(a.origin) - originRank(b.origin) || placeRank(a.place) - placeRank(b.place),
    };
  }
  return {
    left: (a, b) => placeRank(a.place) - placeRank(b.place) || b.generation - a.generation,
    right: (a, b) => originRank(a.origin) - originRank(b.origin) || b.generation - a.generation,
  };
}

// a place's colour: HOME's, Champions' gold, or the game of the save it's in
export function placeColor (key: string, saves: GameSave[]): string {
  if (key === 'home') {
    return gameColor('home');
  }
  if (key === 'champions') {
    return 'var(--jr-gold)';
  }
  return gameColor(saves.find((save) => `game:${save.id}` === key)?.game);
}
