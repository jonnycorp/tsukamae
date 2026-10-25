import { GAME_FACTS } from './game-facts';
import { getCatalogDex } from './local-data';

import type { Capture, GameSave } from '../types';

// what could have been caught where, and what a game's file can hold: read by the red pen (Red Pen's rules) and by the
// places a sealed mon can be moved to

export const LETS_GO = new Set(['lets_go_pikachu', 'lets_go_eevee']);
const BDSP = new Set(['brilliant_diamond', 'shining_pearl']);
// a regional form came with its region, so its own generation is its debut; any other form is read by its species
const REGIONAL_FORMS = new Set(['alola', 'galar', 'hisui', 'paldea']);

// a mon keeps the game it was caught in as it evolves, so an evolved species can come from a game older than itself,
// caught there as what it evolves from (a Magnezone caught as a FireRed Magnemite). The evolutions that cross from
// one generation into a later one, each from what it evolves from (by national number); a line a regional form starts
// (Obstagoon's, Sneasler's, Clodsire's) has none, as its form came with its region
const EVOLVES_FROM: Record<number, number> = {
  169: 42, // Crobat, from Golbat
  182: 44, // Bellossom, from Gloom
  186: 61, // Politoed, from Poliwhirl
  196: 133, // Espeon, from Eevee
  197: 133, // Umbreon
  199: 79, // Slowking, from Slowpoke
  208: 95, // Steelix, from Onix
  212: 123, // Scizor, from Scyther
  230: 117, // Kingdra, from Seadra
  233: 137, // Porygon2, from Porygon
  242: 113, // Blissey, from Chansey
  407: 315, // Roserade, from Roselia
  424: 190, // Ambipom, from Aipom
  429: 200, // Mismagius, from Misdreavus
  430: 198, // Honchkrow, from Murkrow
  461: 215, // Weavile, from Sneasel
  462: 82, // Magnezone, from Magneton
  463: 108, // Lickilicky, from Lickitung
  464: 112, // Rhyperior, from Rhydon
  465: 114, // Tangrowth, from Tangela
  466: 125, // Electivire, from Electabuzz
  467: 126, // Magmortar, from Magmar
  468: 176, // Togekiss, from Togetic
  469: 193, // Yanmega, from Yanma
  470: 133, // Leafeon, from Eevee
  471: 133, // Glaceon
  472: 207, // Gliscor, from Gligar
  473: 221, // Mamoswine, from Piloswine
  474: 233, // Porygon-Z, from Porygon2
  475: 281, // Gallade, from Kirlia
  476: 299, // Probopass, from Nosepass
  477: 356, // Dusknoir, from Dusclops
  478: 361, // Froslass, from Snorunt
  700: 133, // Sylveon, from Eevee
  866: 439, // Mr. Rime, from a Mime Jr. that grew into Galarian Mr. Mime in Galar
  899: 234, // Wyrdeer, from Stantler
  900: 123, // Kleavor, from Scyther
  901: 217, // Ursaluna, from Ursaring
  979: 57, // Annihilape, from Primeape
  981: 203, // Farigiraf, from Girafarig
  982: 206, // Dudunsparce, from Dunsparce
  983: 625, // Kingambit, from Bisharp
  1011: 840, // Dipplin, from Applin
  1018: 884, // Archaludon, from Duraludon
  1019: 1011, // Hydrapple, from Dipplin
};
// the regional forms an ordinary mon grows into by evolving in the region (a Pikachu evolved in Alola is an Alolan
// Raichu), each from that ordinary species
const REGIONAL_FROM: Record<string, number> = {
  '26:alola': 25, // Raichu, from Pikachu
  '103:alola': 102, // Exeggutor, from Exeggcute
  '105:alola': 104, // Marowak, from Cubone
  '110:galar': 109, // Weezing, from Koffing
  '122:galar': 439, // Mr. Mime, from Mime Jr.
  '157:hisui': 156, // Typhlosion, from Quilava
  '503:hisui': 502, // Samurott, from Dewott
  '549:hisui': 548, // Lilligant, from Petilil
  '628:hisui': 627, // Braviary, from Rufflet
  '705:hisui': 704, // Sliggoo, from Goomy
  '706:hisui': 704, // Goodra
  '713:hisui': 712, // Avalugg, from Bergmite
  '724:hisui': 723, // Decidueye, from Dartrix
};

export interface Stage {
  national: number;
  form: string | null;
}

// a mon and what it could have been caught as: the slot itself, then (for a species, or a regional form an ordinary
// mon grows into) each earlier stage across the generations
export function lineOf (capture: Capture): Stage[] {
  const { national_id: national, form } = capture.pokemon;
  const line: Stage[] = [{ national, form }];
  let from: number | undefined = form ? REGIONAL_FROM[`${national}:${form}`] : EVOLVES_FROM[national];
  while (from !== undefined) {
    line.push({ national: from, form: null });
    from = EVOLVES_FROM[from];
  }
  return line;
}

// the national numbers a game's own dexes list, read off the catalog: Sword and Shield's by their regional dexes, as
// the Pokédex filter reads them (their national catalog lists every species)
const nationals = (keys: string[]) => new Set(keys.flatMap((key) => getCatalogDex(key).pokemonList.map((mon) => mon.national_id)));
let dexes: Record<string, Set<number>> | null = null;
export function gameDexes (): Record<string, Set<number>> {
  if (!dexes) {
    const sv = nationals(['paldea-full', 'scarlet-violet-regional', 'kitakami', 'blueberry']);
    const swsh = nationals(['sword-shield-regional', 'sword-shield-expansion-regional']);
    const za = nationals(['legends-z-a-regional', 'legends-z-a-mega-dimension']);
    dexes = {
      legends_arceus: nationals(['legends-arceus-regional']),
      scarlet: sv,
      violet: sv,
      sword: swsh,
      shield: swsh,
      legends_za: za,
    };
  }
  return dexes;
}

// a stage's debut: its species' earliest generation, so a form that came later (a Gigantamax, whose factor any old
// Charizard can take from Max Soup) is read by its species; a regional form by its own (the slot's, `fallback`)
let debuts: Map<number, number> | null = null;
export function debutOf (stage: Stage, fallback: number): number {
  if (stage.form && REGIONAL_FORMS.has(stage.form)) {
    return fallback;
  }
  if (!debuts) {
    debuts = new Map();
    for (const mon of getCatalogDex('home-national').pokemonList) {
      debuts.set(mon.national_id, Math.min(debuts.get(mon.national_id) ?? Infinity, mon.generation));
    }
  }
  return debuts.get(stage.national) ?? fallback;
}

// what a closed game can be caught in: Let's Go is Kanto's 151 (their Alolan forms among its trades) and Meltan's
// line, Legends: Arceus is Hisui's dex, Brilliant Diamond and Shining Pearl the first 493; nothing else, and whatever
// is on their lists can, whatever the generation the dataset files it under (Meltan's). null for a game that isn't
// closed
export function closedGameHas (game: string, stage: Stage): boolean | null {
  if (LETS_GO.has(game)) {
    return (stage.form === null || stage.form === 'alola') && (stage.national <= 151 || stage.national === 808 || stage.national === 809);
  }
  if (game === 'legends_arceus') {
    return gameDexes().legends_arceus.has(stage.national);
  }
  if (BDSP.has(game)) {
    return stage.form === null && stage.national <= 493;
  }
  return null;
}

// a mon in one of your files of a game HOME can't send to (everything before Sword and Shield, Let's Go too) got there
// by being caught there or moved on into it, never back: Let's Go takes only its own and GO's, the rest nothing newer
// than themselves, and nothing from HOME, GO or Let's Go
export function cannotReach (saveGame: string, saveGen: number, origin: string | null, originGen: number | undefined): boolean {
  if (saveGen >= 8 || !origin || origin === 'trade' || origin === 'mystery_gift' || origin === 'other') {
    return false;
  }
  if (LETS_GO.has(saveGame)) {
    return !(LETS_GO.has(origin) || origin === 'go');
  }
  if (origin === 'home' || origin === 'go' || LETS_GO.has(origin)) {
    return true;
  }
  return originGen !== undefined && originGen > saveGen;
}

// two ID Nos. as one number, so a six-digit one with its leading zeros matches the same one without
export const sameId = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b) && Number(a) === Number(b);

// a mon HOME handed out: one under the ID No. of one of your HOME entries in My Games, whatever origin mark it came
// with. That's HOME's own, so its origin game is set aside (read as HOME) wherever a game's facts would judge it
export function homeFileOf (capture: Pick<Capture, 'tid'>, saves: GameSave[]): GameSave | undefined {
  return capture.tid ? saves.find((save) => save.game === 'home' && sameId(save.tid, capture.tid)) : undefined;
}

export function originOf (capture: Pick<Capture, 'tid' | 'origin_game'>, saves: GameSave[]): string | null {
  return homeFileOf(capture, saves) ? 'home' : capture.origin_game;
}

// whether one of your files can hold a mon: one of HOME's own entries is no game to hold anything, a game can't hold
// a species newer than itself, nor a closed game one it doesn't have (the species as it is now, whatever it was
// caught as), nor a mon that would have had to move back to it
export function canHold (save: GameSave, capture: Capture, saves: GameSave[]): boolean {
  if (save.game === 'home') {
    return false;
  }
  const held = GAME_FACTS[save.game]?.gen;
  if (held === undefined) {
    return true;
  }
  const { national_id: national, form, generation } = capture.pokemon;
  const holds = closedGameHas(save.game, { national, form });
  if (holds === false || (holds === null && debutOf({ national, form }, generation) > held)) {
    return false;
  }
  const origin = originOf(capture, saves);
  return !cannotReach(save.game, held, origin, origin ? GAME_FACTS[origin]?.gen : undefined);
}
