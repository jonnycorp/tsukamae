import { GAME_FACTS } from '../../../utils/game-facts';
import { LETS_GO, cannotReach, closedGameHas, debutOf, gameDexes, homeFileOf, lineOf, sameId } from '../../../utils/game-reach';
import { MYSTERY_GIFT, nameMaxLength } from '../../../utils/capture-fields';

import type { Capture, GameSave } from '../../../types';

// the red pen (P): a dex's records read over for what can't be right (a date before the game came out, a species
// newer than the game it came from, a ball the game never had, an ID No. that isn't the file its OT is) and what's
// worth a second look (a mon its game's dex doesn't list, your name with an ID No. none of your files has, one
// trainer's name written two ways). Sealed records are read, as a record's fields are only trusted once sealed;
// unsealed drafts too when asked for, to catch a slip before the seal, but they're never scored

export type RuleId =
  | 'future'
  | 'beforeRelease'
  | 'newerSpecies'
  | 'notInGame'
  | 'hisuiBall'
  | 'arceusTwin'
  | 'arceusBall'
  | 'letsGoBall'
  | 'ballTooNew'
  | 'languageTooNew'
  | 'saveTooOld'
  | 'saveBackward'
  | 'idForm'
  | 'idMismatch'
  | 'otMismatch'
  | 'otTooLong'
  | 'nicknameTooLong'
  | 'notInDex'
  | 'strangeBall'
  | 'idUnknown'
  | 'otLanguage'
  | 'otScript'
  | 'nicknameScript';

export type Severity = 'wrong' | 'look';

// what a finding points at: a field of the record, or the species itself
export type Mark = 'species' | 'origin_game' | 'catch_date' | 'ball' | 'language' | 'location' | 'ot' | 'tid' | 'nickname';

export interface Finding {
  rule: RuleId;
  severity: Severity;
  marks: Mark[];
  // what its note names beyond the record's own fields: the file of yours it's measured against, a ball, a limit
  save?: string;
  twin?: string;
  gen?: number;
  max?: number;
  length?: number;
}

export interface Flagged {
  capture: Capture;
  findings: Finding[];
  // the worst of its findings
  severity: Severity;
}

// one trainer's name, written more than one way: the usual spelling first. Records of one file (a game and an ID No.)
// carry its ID No.; records without one are grouped by the name as the eye reads it
export interface Variant {
  spellings: { ot: string; captures: Capture[] }[];
  tid?: string;
  game?: string;
}

export interface RedPenData {
  // the records read (unobtainable ones hold none): the sealed ones, which the score is out of, and the drafts
  sealed: number;
  drafts: number;
  flagged: Flagged[];
  variants: Variant[];
}

const LETS_GO_BALLS = new Set(['poke_ball', 'great_ball', 'ultra_ball', 'master_ball', 'premier_ball']);
// Legends: Arceus's own balls: the Hisuian Poké, Great, Ultra and Heavy Balls and the six it brought. It throws no
// others but the Master Ball, and nothing else has them
const HISUI_BALLS = new Set([
  'hisuian_poke_ball', 'hisuian_great_ball', 'hisuian_ultra_ball', 'hisuian_heavy_ball',
  'feather_ball', 'wing_ball', 'jet_ball', 'leaden_ball', 'gigaton_ball', 'origin_ball',
]);
// the Hisuian ball that a modern one shares its name with, which a Legends: Arceus catch is in instead
const HISUI_TWINS: Record<string, string> = {
  poke_ball: 'hisuian_poke_ball',
  great_ball: 'hisuian_great_ball',
  ultra_ball: 'hisuian_ultra_ball',
  heavy_ball: 'hisuian_heavy_ball',
};
// the first generation whose games kept a mon in a ball; the Poké, Great, Ultra, Master and Safari Balls were always
// there. The Apricorn balls and the Sport Ball were thrown in Gen 2, but no game kept the ball a mon was in till Gen 3
// and none of those had them, so HeartGold and SoulSilver's are the first. Nothing moves back to an older game, so
// none of its mons, bred ones included, can be in a ball from after it
const BALL_DEBUT: Record<string, number> = {
  level_ball: 4,
  lure_ball: 4,
  moon_ball: 4,
  friend_ball: 4,
  love_ball: 4,
  fast_ball: 4,
  heavy_ball: 4,
  sport_ball: 4,
  premier_ball: 3,
  net_ball: 3,
  nest_ball: 3,
  dive_ball: 3,
  timer_ball: 3,
  repeat_ball: 3,
  luxury_ball: 3,
  heal_ball: 4,
  dusk_ball: 4,
  quick_ball: 4,
  cherish_ball: 4,
  park_ball: 4,
  dream_ball: 5,
  beast_ball: 7,
};
// the first generation of games in a language, of those here: Chinese came with Sun and Moon, and no Gen 3 game was
// Korean
const LANGUAGE_DEBUT: Record<string, number> = { chinese_simplified: 7, chinese_traditional: 7, korean: 4 };
const CHINESE = new Set(['chinese_simplified', 'chinese_traditional']);
const EUROPEAN = new Set(['english', 'french', 'italian', 'german', 'spanish']);
// the Ultra Beasts, which come as legendaries do, by ways a game's dex doesn't list (Ultra Space, Max Lair)
const ULTRA_BEASTS = new Set([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);

// the longest OT and nickname a game of a generation took: Gen 3 to 5 games kept Japanese names to 5 characters and
// European ones to 7 (an OT) and 10 (a nickname); later games, the language's own limit
function nameLimits (language: string, gen: number): { ot: number; nickname: number } {
  if (gen <= 5 && language === 'japanese') {
    return { ot: 5, nickname: 5 };
  }
  if (gen <= 5 && EUROPEAN.has(language)) {
    return { ot: 7, nickname: 10 };
  }
  const max = nameMaxLength(language);
  return { ot: max, nickname: max };
}

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const FULL_WIDTH = /[！-～]/;

// a name with characters its language's games can't type: the European ones type no Japanese, Chinese or Korean, nor
// full-width letters, Japanese games no Hangul, Korean ones no kana, Chinese ones neither
function untypable (name: string, language: string): boolean {
  if (EUROPEAN.has(language)) {
    return KANA.test(name) || HAN.test(name) || HANGUL.test(name) || FULL_WIDTH.test(name);
  }
  if (language === 'japanese') {
    return HANGUL.test(name);
  }
  if (language === 'korean') {
    return KANA.test(name);
  }
  return CHINESE.has(language) && (KANA.test(name) || HANGUL.test(name));
}

// an ID No. a mon can have: one from Gen 3 to 6 keeps the five digits of a number up to 65535 in every game after
// (HOME too); since Gen 7 it's six, though Gen 9 drops the leading zeros, so only an old one's can be read for size
function idFits (tid: string, gen: number): boolean {
  return gen >= 7 || (tid.length <= 5 && Number(tid) <= 65535);
}

// the day before a game came out: a Switch game unlocks across the Americas at midnight on the US east coast, the
// evening before on its west coast, so a launch-night catch there is dated a day early
function dayBefore (date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

const length = (text: string) => [...text].length;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// today where the app is, as a catch date writes it
export function today (): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function read (capture: Capture, saves: GameSave[], now: string): Finding[] {
  const found: Finding[] = [];
  const add = (rule: RuleId, severity: Severity, marks: Mark[], detail: Partial<Finding> = {}) => found.push({ rule, severity, marks, ...detail });
  const { ball, language, catch_date: date, ot, tid } = capture;
  // a mon HOME handed out (under one of your HOME entries' ID No.) is HOME's own, whatever origin mark it came with:
  // its OT is read against that entry, and its origin game set aside, read as HOME
  const homeFile = homeFileOf(capture, saves);
  const origin = homeFile ? 'home' : capture.origin_game;
  if (homeFile && ot && homeFile.ot !== ot) {
    add('otMismatch', 'wrong', ['ot', 'tid'], { save: homeFile.id });
  }
  const nickname = capture.has_nickname ? capture.nickname : null;
  const { national_id: national, form, generation } = capture.pokemon;
  // the species itself, and the earliest of what it could have been caught as before it evolved
  const line = lineOf(capture);
  const debut = debutOf(line[0], generation);
  const earliest = Math.min(...line.map((stage) => debutOf(stage, generation)));
  const game = origin ? GAME_FACTS[origin] : undefined;
  // a game of its own, rather than HOME, GO, a trade, a gift or "other", which can hand on a mon from anywhere
  const gen = game?.gen;

  if (date && DATE.test(date)) {
    if (date > now) {
      add('future', 'wrong', ['catch_date']);
    } else if (game?.release && date < dayBefore(game.release)) {
      add('beforeRelease', 'wrong', ['origin_game', 'catch_date']);
    }
  }

  // caught there as any stage of its line: a Let's Go Onix grows into a Steelix, a HeartGold Eevee into a Sylveon
  const closed = origin ? closedGameHas(origin, line[0]) : null;
  const closedLine = origin && closed === false ? line.some((stage) => closedGameHas(origin, stage)) : closed;
  if (origin && closedLine === false) {
    add('notInGame', 'wrong', ['species', 'origin_game']);
  } else if (origin && closed === null && gen !== undefined && earliest > gen) {
    add('newerSpecies', 'wrong', ['species', 'origin_game'], { gen: debut });
  } else if (origin && closed === null && !capture.pokemon.legendary_class && !ULTRA_BEASTS.has(national) && gameDexes()[origin] &&
    !line.some((stage) => gameDexes()[origin].has(stage.national))) {
    // legendaries and Ultra Beasts come by ways a dex doesn't list (Snacksworth, raids, events), so only the rest are
    // asked about
    add('notInDex', 'look', ['species', 'origin_game']);
  }

  if (ball && origin && gen !== undefined) {
    if (HISUI_BALLS.has(ball) && origin !== 'legends_arceus') {
      add('hisuiBall', 'wrong', ['ball', 'origin_game']);
    } else if (origin === 'legends_arceus' && HISUI_TWINS[ball]) {
      add('arceusTwin', 'wrong', ['ball', 'origin_game'], { twin: HISUI_TWINS[ball] });
    } else if (origin === 'legends_arceus' && !HISUI_BALLS.has(ball) && !['master_ball', 'strange_ball', 'unknown'].includes(ball)) {
      add('arceusBall', 'wrong', ['ball', 'origin_game']);
    } else if (LETS_GO.has(origin) && !LETS_GO_BALLS.has(ball) && ball !== 'unknown') {
      add('letsGoBall', 'wrong', ['ball', 'origin_game']);
    } else if ((BALL_DEBUT[ball] ?? 0) > gen) {
      add('ballTooNew', 'wrong', ['ball', 'origin_game'], { gen: BALL_DEBUT[ball] });
    }
  }
  // the ball a game without a mon's own shows in its place: what HOME shows is the one to record
  if (ball === 'strange_ball') {
    add('strangeBall', 'look', ['ball']);
  }

  if (language && gen !== undefined && (LANGUAGE_DEBUT[language] ?? 0) > gen) {
    add('languageTooNew', 'wrong', ['language', 'origin_game']);
  }

  // a game can't hold a species newer than itself, nor a closed game one it doesn't have (the species as it is now,
  // whatever it was caught as), nor a mon that would have had to move back to it
  if (capture.location === 'game' && capture.location_save) {
    const save = saves.find((entry) => entry.id === capture.location_save);
    const held = save ? GAME_FACTS[save.game]?.gen : undefined;
    if (save && held !== undefined) {
      const holds = closedGameHas(save.game, { national, form });
      if (holds === false || (holds === null && debut > held)) {
        add('saveTooOld', 'wrong', ['species', 'location']);
      } else if (cannotReach(save.game, held, origin, gen)) {
        add('saveBackward', 'wrong', ['origin_game', 'location']);
      }
    }
  }

  if (language && gen !== undefined) {
    const limits = nameLimits(language, gen);
    if (ot && length(ot) > limits.ot) {
      add('otTooLong', 'wrong', ['ot', 'language'], { max: limits.ot, length: length(ot) });
    }
    if (nickname && length(nickname) > limits.nickname) {
      add('nicknameTooLong', 'wrong', ['nickname', 'language'], { max: limits.nickname, length: length(nickname) });
    }
  }
  // GO's names are typed in GO, and HOME's gifts come named
  if (language && origin !== 'go' && origin !== 'home') {
    if (ot && untypable(ot, language)) {
      add('otScript', 'look', ['ot', 'language']);
    }
    if (nickname && untypable(nickname, language)) {
      add('nicknameScript', 'look', ['nickname', 'language']);
    }
  }

  // the ID No.: one a game of its era can show, and, where it's one of your files', that file's game, language and OT.
  // An ID No. names one file (two of a million share one by chance), so a record that has yours with your name is
  // that file's, and one with your file's ID No. under another OT has one of the two mistyped. HOME, GO, a trade or
  // a gift aren't read against your files: a HOME gift can carry your name and ID No. under its own origin mark
  if (tid && gen !== undefined && !idFits(tid, gen)) {
    add('idForm', 'wrong', ['tid', 'origin_game'], { gen });
  }
  if (tid && ot && origin && language && gen !== undefined) {
    const idFiles = saves.filter((save) => sameId(save.tid, tid));
    const file = idFiles.find((save) => save.game === origin && save.language === language);
    const yours = idFiles.find((save) => save.ot === ot);
    if (file && file.ot !== ot) {
      add('otMismatch', 'wrong', ['ot', 'tid'], { save: file.id });
    } else if (!file && yours) {
      add('idMismatch', 'wrong', ['origin_game', 'language', 'tid'], { save: yours.id });
    } else if (!file) {
      // your name in a file of this game and language, but under an ID No. none of them has: one of the two mistyped,
      // or someone else of the same name
      const named = saves.find((save) => save.game === origin && save.language === language && save.ot === ot && save.tid);
      if (named) {
        add('idUnknown', 'look', ['tid', 'ot'], { save: named.id });
      }
    }
  }
  // without ID Nos. to go by: your name in a game you have, in a language you have no file of it in
  if (ot && origin && language && (!tid || !saves.some((save) => save.game === origin && save.tid))) {
    const files = saves.filter((save) => save.game === origin);
    if (files.some((save) => save.ot === ot) && !files.some((save) => save.language === language)) {
      add('otLanguage', 'look', ['ot', 'language']);
    }
  }
  return found;
}

// a name as the eye reads it: width, case and the spaces around it set aside
const foldName = (ot: string) => ot.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

// sealed records alone, as anything built on what a record says: an unsealed one's fields are placeholders (the dex's
// defaults stamped on a fresh mark among them). Drafts are read only when asked for, and never scored
export function redPen (captures: Capture[], saves: GameSave[], { drafts = false, now = today() } = {}): RedPenData {
  const records = captures.filter((capture) => capture.captured && capture.status !== 'unobtainable' && (capture.sealed || drafts));
  const flagged: Flagged[] = [];
  // one trainer's records, by file (a game, its language and an ID No.) or, without an ID No., by the name as the eye
  // reads it; a file of yours is left out, its own check (otMismatch) saying which spelling is off, and so are the
  // gifts, whose OTs an event writes in each language under one ID No.
  const groups = new Map<string, { tid?: string; game?: string; spellings: Map<string, Capture[]> }>();
  for (const capture of records) {
    const findings = read(capture, saves, now);
    if (findings.length > 0) {
      flagged.push({ capture, findings, severity: findings.some((finding) => finding.severity === 'wrong') ? 'wrong' : 'look' });
    }
    const { ot, tid, origin_game: game, language } = capture;
    if (!ot || game === MYSTERY_GIFT) {
      continue;
    }
    if (tid && game && (homeFileOf(capture, saves) || saves.some((save) => save.game === game && sameId(save.tid, tid)))) {
      continue;
    }
    const key = tid && game ? `file:${game}:${language ?? ''}:${Number(tid)}` : `name:${foldName(ot)}`;
    const group = groups.get(key) ?? { ...(tid && game ? { tid, game } : {}), spellings: new Map<string, Capture[]>() };
    group.spellings.set(ot, [...(group.spellings.get(ot) ?? []), capture]);
    groups.set(key, group);
  }
  const variants = [...groups.values()]
  .filter((group) => group.spellings.size > 1)
  .map(({ tid, game, spellings }) => ({
    tid,
    game,
    spellings: [...spellings].map(([ot, list]) => ({ ot, captures: list })).sort((a, b) => b.captures.length - a.captures.length),
  }))
  .sort((a, b) => b.spellings[0].captures.length - a.spellings[0].captures.length);
  const sealed = records.filter((capture) => capture.sealed).length;
  return { sealed, drafts: records.length - sealed, flagged, variants };
}
