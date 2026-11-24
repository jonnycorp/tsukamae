import homeCatalogsJson from '../../data/home-catalogs.json';
import { GAME_FACTS } from './game-facts';
import { REGIONAL_FORMS, slotKey } from './champions';
import { getCatalogDex } from './local-data';

import type { Capture, CapturePokemon, GameSave } from '../types';

const homeCatalogs = homeCatalogsJson as { sword_shield: string[]; scarlet_violet: string[] };

// what could have been caught where, and what a game's file can hold: read by the red pen (Red Pen's rules) and by the
// places a sealed mon can be moved to

export const LETS_GO = new Set(['lets_go_pikachu', 'lets_go_eevee']);
const BDSP = new Set(['brilliant_diamond', 'shining_pearl']);
const ZA = 'legends_za';

// a mon keeps the game it was caught in as it evolves, so an evolved mon can come from a game that never had it, caught
// there as what it evolves from: a FireRed Magnemite grown into a Magnezone, a Legends: Arceus Quilava into an ordinary
// Typhlosion outside Hisui, a Violet Sneasel of Hisui's (bred from one HOME brought in) into a Sneasler. Each slot
// (utils/champions slotKey) from what it evolves from, where that can be a species another game had
const EVOLVES_FROM: Record<string, string> = {
  // into a later generation
  169: '42', // Crobat, from Golbat
  182: '44', // Bellossom, from Gloom
  186: '61', // Politoed, from Poliwhirl
  196: '133', // Espeon, from Eevee
  197: '133', // Umbreon
  199: '79', // Slowking, from Slowpoke
  208: '95', // Steelix, from Onix
  212: '123', // Scizor, from Scyther
  230: '117', // Kingdra, from Seadra
  233: '137', // Porygon2, from Porygon
  242: '113', // Blissey, from Chansey
  407: '315', // Roserade, from Roselia
  424: '190', // Ambipom, from Aipom
  429: '200', // Mismagius, from Misdreavus
  430: '198', // Honchkrow, from Murkrow
  461: '215', // Weavile, from Sneasel
  462: '82', // Magnezone, from Magneton
  463: '108', // Lickilicky, from Lickitung
  464: '112', // Rhyperior, from Rhydon
  465: '114', // Tangrowth, from Tangela
  466: '125', // Electivire, from Electabuzz
  467: '126', // Magmortar, from Magmar
  468: '176', // Togekiss, from Togetic
  469: '193', // Yanmega, from Yanma
  470: '133', // Leafeon, from Eevee
  471: '133', // Glaceon
  472: '207', // Gliscor, from Gligar
  473: '221', // Mamoswine, from Piloswine
  474: '233', // Porygon-Z, from Porygon2
  475: '281', // Gallade, from Kirlia
  476: '299', // Probopass, from Nosepass
  477: '356', // Dusknoir, from Dusclops
  478: '361', // Froslass, from Snorunt
  700: '133', // Sylveon, from Eevee
  866: '122:galar', // Mr. Rime, from Galarian Mr. Mime
  899: '234', // Wyrdeer, from Stantler
  900: '123', // Kleavor, from Scyther
  901: '217', // Ursaluna, from Ursaring
  979: '57', // Annihilape, from Primeape
  981: '203', // Farigiraf, from Girafarig
  982: '206', // Dudunsparce, from Dunsparce
  983: '625', // Kingambit, from Bisharp
  1011: '840', // Dipplin, from Applin
  1018: '884', // Archaludon, from Duraludon
  1019: '1011', // Hydrapple, from Dipplin
  // the ordinary forms of Hisui's regional evolutions, which Legends: Arceus has only the first stages of: one of its
  // own grown anywhere else
  157: '156', // Typhlosion, from Quilava
  503: '502', // Samurott, from Dewott
  549: '548', // Lilligant, from Petilil
  628: '627', // Braviary, from Rufflet
  705: '704', // Sliggoo, from Goomy
  706: '705', // Goodra
  713: '712', // Avalugg, from Bergmite
  724: '723', // Decidueye, from Dartrix
  // the regional forms an ordinary mon grows into by evolving in the region (a Pikachu evolved in Alola is an Alolan
  // Raichu)
  '26:alola': '25', // Raichu, from Pikachu
  '103:alola': '102', // Exeggutor, from Exeggcute
  '105:alola': '104', // Marowak, from Cubone
  '110:galar': '109', // Weezing, from Koffing
  '122:galar': '439', // Mr. Mime, from Mime Jr.
  '157:hisui': '156', // Typhlosion, from Quilava
  '503:hisui': '502', // Samurott, from Dewott
  '549:hisui': '548', // Lilligant, from Petilil
  '628:hisui': '627', // Braviary, from Rufflet
  '705:hisui': '704', // Sliggoo, from Goomy
  '706:hisui': '705:hisui', // Goodra
  '713:hisui': '712', // Avalugg, from Bergmite
  '724:hisui': '723', // Decidueye, from Dartrix
  // a regional form's own line, which a game can have the first of without the rest (a Sneasel of Hisui's bred in
  // Violet)
  '20:alola': '19:alola', // Raticate
  '28:alola': '27:alola', // Sandslash
  '38:alola': '37:alola', // Ninetales
  '51:alola': '50:alola', // Dugtrio
  '53:alola': '52:alola', // Persian
  '75:alola': '74:alola', // Graveler
  '76:alola': '75:alola', // Golem
  '89:alola': '88:alola', // Muk
  '78:galar': '77:galar', // Rapidash
  '80:galar': '79:galar', // Slowbro
  '199:galar': '79:galar', // Slowking
  '264:galar': '263:galar', // Linoone
  '555:galar': '554:galar', // Darmanitan
  862: '264:galar', // Obstagoon, from Galarian Linoone
  863: '52:galar', // Perrserker, from Galarian Meowth
  864: '222:galar', // Cursola, from Galarian Corsola
  865: '83:galar', // Sirfetch'd, from Galarian Farfetch'd
  867: '562:galar', // Runerigus, from Galarian Yamask
  '59:hisui': '58:hisui', // Arcanine
  '101:hisui': '100:hisui', // Electrode
  '571:hisui': '570:hisui', // Zoroark
  903: '215:hisui', // Sneasler, from Hisuian Sneasel
  904: '211:hisui', // Overqwil, from Hisuian Qwilfish
  980: '194:paldea', // Clodsire, from Paldean Wooper
};

export interface Stage {
  national: number;
  form: string | null;
}

const stageOf = (key: string): Stage => {
  const [national, form] = key.split(':');
  return { national: Number(national), form: form ?? null };
};

// a mon and what it could have been caught as: the slot itself, then each earlier stage EVOLVES_FROM names
export function lineOf (capture: Capture): Stage[] {
  const { national_id: national, form } = capture.pokemon;
  const line: Stage[] = [{ national, form }];
  for (let from = EVOLVES_FROM[slotKey(national, form)]; from; from = EVOLVES_FROM[from]) {
    line.push(stageOf(from));
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

// Legends: Arceus's dex by species and regional form, so its Hisuian Growlithe is no Kantonian one and its Raichu no
// Alolan one; a form of no region (a cloak, a sea) read as its species
let hisui: Set<string> | null = null;
function hisuiHas (stage: Stage): boolean {
  hisui ??= new Set(getCatalogDex('legends-arceus-regional').pokemonList.map((mon) => slotKey(mon.national_id, mon.form)));
  return hisui.has(slotKey(stage.national, stage.form));
}

// what a closed game can be caught in: Let's Go is Kanto's 151 (their Alolan forms among its trades) and Meltan's
// line, Legends: Arceus is Hisui's dex in its own forms, Brilliant Diamond and Shining Pearl the first 493; nothing
// else, and whatever is on their lists can, whatever the generation the dataset files it under (Meltan's). null for a
// game that isn't closed
export function closedGameHas (game: string, stage: Stage): boolean | null {
  if (LETS_GO.has(game)) {
    return (stage.form === null || stage.form === 'alola') && (stage.national <= 151 || stage.national === 808 || stage.national === 809);
  }
  if (game === 'legends_arceus') {
    return hisuiHas(stage);
  }
  if (BDSP.has(game)) {
    return stage.form === null && stage.national <= 493;
  }
  return null;
}

// a trade, a gift or "other", which can hand on a mon from any game
const ANYWHERE = new Set(['trade', 'mystery_gift', 'other']);

// whether a mon from `origin` can never have got into one of your files of a game: one befriended in Legends: Z-A never
// leaves it for another game; and a game HOME can't send to (everything before Sword and Shield, Let's Go too) has only
// what was caught there or moved on into it, never back: Let's Go takes only its own and GO's, the rest nothing newer
// than themselves, and nothing from HOME, GO or Let's Go
export function cannotReach (saveGame: string, saveGen: number, origin: string | null, originGen: number | undefined): boolean {
  if (origin === ZA) {
    return saveGame !== ZA;
  }
  if (saveGen >= 8 || !origin || ANYWHERE.has(origin)) {
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

// what HOME can send each of the Switch games that take from it, by species and regional form: Sword and
// Shield's and Scarlet and Violet's catalogues as Showdown has them (data/home-catalogs.json,
// scripts/fetch-home-catalogs.mjs), Legends: Z-A's its two dexes, and the closed games theirs (closedGameHas)
export const SWSH = new Set(['sword', 'shield']);
const SV = new Set(['scarlet', 'violet']);
let catalogs: { swsh: Set<string>; sv: Set<string>; za: Set<string> } | null = null;
function catalogOf (game: string): Set<string> | null {
  catalogs ??= {
    swsh: new Set(homeCatalogs.sword_shield),
    sv: new Set(homeCatalogs.scarlet_violet),
    za: new Set(['legends-z-a-regional', 'legends-z-a-mega-dimension']
    .flatMap((key) => getCatalogDex(key).pokemonList.map((mon) => slotKey(mon.national_id, mon.form)))),
  };
  if (SWSH.has(game)) {
    return catalogs.swsh;
  }
  if (SV.has(game)) {
    return catalogs.sv;
  }
  return game === ZA ? catalogs.za : null;
}

const SPINDA = 327;
const NINCADA = 290;

// whether a game can hold a mon, the species as it is now (whatever it was caught as): one of the Switch games HOME
// sends to only what its catalogue has, a closed game only what it has (closedGameHas), any other game nothing newer
// than itself. And nothing HOME keeps out of it: Spinda goes neither into Brilliant Diamond and Shining Pearl nor out
// of them, and Nincada into them only if it came from them. The Gigantamax factor keeps a mon out of Let's Go alone,
// since only Sword and Shield give it and nothing that's been to a newer game goes back to Let's Go, and a giant
// Pikachu, Eevee or Meowth no further: any one of them can drink Max Soup. One of HOME's own entries, GO, a trade, a
// gift or "other" is no game to hold anything. A mon from a trade, a gift or "other" could be from either side of
// Spinda's and Nincada's rules, so it's kept out by neither
export function gameHolds (game: string, capture: Pick<Capture, 'pokemon' | 'gigantamax'>, origin: string | null): boolean {
  const { national_id: national, form, generation } = capture.pokemon;
  const gen = GAME_FACTS[game]?.gen;
  if (gen === undefined) {
    return false;
  }
  const catalog = catalogOf(game);
  if (catalog ? !catalog.has(slotKey(national, form)) : !(closedGameHas(game, { national, form }) ?? debutOf({ national, form }, generation) <= gen)) {
    return false;
  }
  if (origin && !ANYWHERE.has(origin) &&
    ((national === SPINDA && BDSP.has(game) !== BDSP.has(origin)) || (national === NINCADA && BDSP.has(game) && !BDSP.has(origin)))) {
    return false;
  }
  return !(capture.gigantamax === true && LETS_GO.has(game));
}

// the game a mon is in now, as far as where it can go next: HOME for HOME or Champions (which it visits from HOME), the
// game of the file it's in, or null while that isn't known (no file named, one since deleted from My Games, or a
// trade's, a gift's or "other", which is no game)
function gameNow (capture: Pick<Capture, 'location' | 'location_save'>, saves: GameSave[]): string | null {
  if (capture.location === 'home' || capture.location === 'champions') {
    return 'home';
  }
  const game = capture.location === 'game' ? saves.find((save) => save.id === capture.location_save)?.game : undefined;
  return game && !ANYWHERE.has(game) ? game : null;
}

// the games HOME sends to and takes from: the Switch games, Let's Go among them
const linked = (game: string) => LETS_GO.has(game) || (GAME_FACTS[game]?.gen ?? 0) >= 8;

// whether a sealed mon can be moved to one of your files of a game, from where it is now: the game must hold it
// (gameHolds) and be one it could ever be in (cannotReach), and there must be a way there. A mon in Legends: Z-A stays
// in Z-A. Let's Go takes one from Let's Go, from GO (by GO Park), or from HOME when it came from Let's Go (or from a
// trade, a gift or "other", which might be Let's Go's). The games before Sword and Shield take nothing from HOME or GO,
// only what's in one of them already, and only into one no older: Bank moves a mon on up and never back (once in Sun
// and Moon, never to X and Y again). Every other game HOME sends to takes it from anywhere, by HOME. Where it is isn't
// known (no place yet, a file since deleted), only the first two are asked
export function canMoveTo (save: GameSave, capture: Capture, saves: GameSave[]): boolean {
  const held = GAME_FACTS[save.game]?.gen;
  const origin = originOf(capture, saves);
  if (held === undefined || !gameHolds(save.game, capture, origin) || cannotReach(save.game, held, origin, origin ? GAME_FACTS[origin]?.gen : undefined)) {
    return false;
  }
  const now = gameNow(capture, saves);
  if (now === null) {
    return true;
  }
  if (now === ZA) {
    return save.game === ZA;
  }
  if (LETS_GO.has(save.game)) {
    return LETS_GO.has(now) || now === 'go' || (now === 'home' && (!origin || ANYWHERE.has(origin) || LETS_GO.has(origin)));
  }
  if (!linked(save.game)) {
    const from = GAME_FACTS[now]?.gen;
    return from !== undefined && !linked(now) && from <= held;
  }
  return true;
}

// the Ultra Beasts, which come as legendaries do (Ultra Space, Max Lair)
const ULTRA_BEASTS = new Set([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);

// a mon a game can have outside its dexes: a legendary, a mythical or an Ultra Beast, which come by ways a dex doesn't
// list (Snacksworth, raids, events), so its game's dex not listing it is no sign it's wrong
export const outsideDexes = (pokemon: Pick<CapturePokemon, 'national_id' | 'legendary_class'>) => Boolean(pokemon.legendary_class) || ULTRA_BEASTS.has(pokemon.national_id);
