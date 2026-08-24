import ballsJson from '../../data/balls.json';
import languagesJson from '../../data/languages.json';
import originGamesJson from '../../data/games.json';

import { localizeBall, localizeCaptureLanguage, localizeOriginGame } from '../i18n/names';
import { translate } from '../i18n/translations';

import type { CaptureMetadata, FavoriteState, GameSave, GenderLock, GenderState } from '../types';
import type { Locale, TranslationKey } from '../i18n/translations';

// catalogs live here, not in local-data — that import would cycle

export interface OriginGame {
  id: string;
  name: string;
}
export const ORIGIN_GAMES = originGamesJson as OriginGame[];

// abbr is the in-game three-letter tag; name_max caps both OT and nickname
export interface Language {
  id: string;
  name: string;
  abbr: string;
  name_max: number;
}
export const LANGUAGES = languagesJson as Language[];

export const NAME_MAX_FALLBACK = 12;

// distributions: the Cherish Ball is only ever used for them, and they floor favorite
export const MYSTERY_GIFT = 'mystery_gift';
export const CHERISH_BALL = 'cherish_ball';

export function nameMaxLength (language: string | null | undefined): number {
  return LANGUAGES.find((entry) => entry.id === language)?.name_max ?? NAME_MAX_FALLBACK;
}

export interface Ball {
  id: string;
  name: string;
}
export const BALLS = ballsJson as Ball[];

const ORIGIN_GAME_NAMES = new Map(ORIGIN_GAMES.map((game) => [game.id, game.name]));

// "Violet (JPN)", derived from the game/language pair
export function saveLabel (save: GameSave, locale: Locale): string {
  const game = localizeOriginGame(locale, save.game, ORIGIN_GAME_NAMES.get(save.game) ?? save.game);
  const abbr = LANGUAGES.find((language) => language.id === save.language)?.abbr;
  return abbr ? `${game} (${abbr})` : game;
}

// saves are keyed by game/language pair, never by id
export function findSave (saves: GameSave[], game: string | null, language: string | null): GameSave | undefined {
  if (!game || !language) {
    return undefined;
  }
  return saves.find((save) => save.game === game && save.language === language);
}

// the OT a save stamps on its catches, or null when no save matches
export function lookupOT (saves: GameSave[], game: string | null, language: string | null): string | null {
  return findSave(saves, game, language)?.ot || null;
}

export type CaptureFieldId =
  | 'save'
  | 'origin_game'
  | 'language'
  | 'been_to_champions'
  | 'location'
  | 'ball'
  | 'catch_date'
  | 'gender'
  | 'nickname'
  | 'ot'
  | 'level'
  | 'trained'
  | 'favorite';

// compound kinds own more than one metadata key or render a dependent input
export type CaptureFieldKind = 'select' | 'text' | 'number' | 'date' | 'yesno' | 'save' | 'location' | 'nickname';

export interface CaptureFieldOption {
  value: string;
  label: string;
  // public/ path rendered beside the label
  icon?: string;
}

export interface CaptureField {
  id: CaptureFieldId;
  kind: CaptureFieldKind;
  labelKey: TranslationKey;
  // metadata keys this field owns
  keys: (keyof CaptureMetadata)[];
  // unanswered blocks sealing
  gatesSeal: boolean;
  // offered as a per-dex prefill
  defaultable: boolean;
  options?: (locale: Locale) => CaptureFieldOption[];
  // text cap, resolved from the record — OT and nickname follow the mon's language
  maxLength?: (meta: Partial<CaptureMetadata>) => number;
  // number kind bounds, clamped on input
  min?: number;
  max?: number;
  // null means untouched, never "no"
  isAnswered: (meta: Partial<CaptureMetadata>) => boolean;
}

function filled (value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export const CAPTURE_FIELDS: CaptureField[] = [
  {
    // picking a save fills origin game, language and OT in one action
    id: 'save',
    kind: 'save',
    labelKey: 'info.myGame',
    keys: [],
    gatesSeal: false,
    defaultable: true,
    isAnswered: () => true,
  },
  {
    id: 'origin_game',
    kind: 'select',
    labelKey: 'info.originGame',
    keys: ['origin_game'],
    gatesSeal: true,
    defaultable: true,
    options: (locale) => ORIGIN_GAMES.map((game) => ({ value: game.id, label: localizeOriginGame(locale, game.id, game.name) })),
    isAnswered: (meta) => filled(meta.origin_game),
  },
  {
    id: 'language',
    kind: 'select',
    labelKey: 'info.language',
    keys: ['language'],
    gatesSeal: true,
    defaultable: true,
    options: (locale) => LANGUAGES.map((language) => ({ value: language.id, label: localizeCaptureLanguage(locale, language.id, language.name) })),
    isAnswered: (meta) => filled(meta.language),
  },
  {
    // sits under origin game + language — the trio the save picker writes together
    id: 'ot',
    kind: 'text',
    labelKey: 'info.ot',
    keys: ['ot'],
    gatesSeal: true,
    // OT comes from the save mapping or by hand, never a blanket default
    defaultable: false,
    maxLength: (meta) => nameMaxLength(meta.language),
    isAnswered: (meta) => filled(meta.ot),
  },
  {
    // two-state: unanswered reads as no, so it never gates or defaults
    id: 'been_to_champions',
    kind: 'yesno',
    labelKey: 'info.beenToChampions',
    keys: ['been_to_champions'],
    gatesSeal: false,
    defaultable: false,
    isAnswered: () => true,
  },
  {
    id: 'location',
    kind: 'location',
    labelKey: 'info.location',
    keys: ['location', 'location_save'],
    gatesSeal: true,
    // derives from the dex: home dex prefills 'home', regional dexes 'game'
    defaultable: false,
    // champions is filtered by locationOptions: home dex + been_to_champions only
    options: (locale) => [
      { value: 'home', label: translate(locale, 'location.home') },
      { value: 'game', label: translate(locale, 'location.game') },
      { value: 'champions', label: translate(locale, 'location.champions') },
    ],
    // naming the cartridge is part of answering "in a game"
    isAnswered: (meta) => meta.location === 'home' || meta.location === 'champions' ||
      (meta.location === 'game' && filled(meta.location_save)),
  },
  {
    id: 'ball',
    kind: 'select',
    labelKey: 'info.ball',
    keys: ['ball'],
    gatesSeal: true,
    defaultable: true,
    options: (locale) => BALLS.map((ball) => ({
      value: ball.id,
      label: localizeBall(locale, ball.id, ball.name),
      icon: ball.id === 'unknown' ? undefined : `balls/${ball.id}.png`,
    })),
    isAnswered: (meta) => filled(meta.ball),
  },
  {
    id: 'catch_date',
    kind: 'date',
    labelKey: 'info.catchDate',
    keys: ['catch_date'],
    gatesSeal: true,
    defaultable: false,
    isAnswered: (meta) => filled(meta.catch_date),
  },
  {
    id: 'gender',
    kind: 'select',
    labelKey: 'info.gender',
    keys: ['gender'],
    gatesSeal: true,
    // species locks prefill at mark time; a blanket default would be a guess
    defaultable: false,
    options: (locale) => [
      { value: 'none', label: translate(locale, 'gender.none') },
      { value: 'male', label: translate(locale, 'gender.male') },
      { value: 'female', label: translate(locale, 'gender.female') },
    ],
    isAnswered: (meta) => filled(meta.gender),
  },
  {
    id: 'nickname',
    kind: 'nickname',
    labelKey: 'info.nickname',
    keys: ['has_nickname', 'nickname'],
    gatesSeal: true,
    defaultable: false,
    maxLength: (meta) => nameMaxLength(meta.language),
    // unchecked means no; only checked-with-empty-text blocks
    isAnswered: (meta) => meta.has_nickname !== true || filled(meta.nickname),
  },
  {
    id: 'level',
    kind: 'number',
    labelKey: 'info.level',
    keys: ['level'],
    gatesSeal: true,
    // per-specimen by nature; a blanket default would be a guess
    defaultable: false,
    min: 1,
    max: 100,
    isAnswered: (meta) => typeof meta.level === 'number',
  },
  {
    id: 'trained',
    kind: 'select',
    labelKey: 'info.trained',
    keys: ['trained'],
    gatesSeal: true,
    defaultable: true,
    options: (locale) => [
      { value: 'none', label: translate(locale, 'trained.none') },
      { value: 'ivs', label: translate(locale, 'trained.ivs') },
      { value: 'ev', label: translate(locale, 'trained.ev') },
    ],
    isAnswered: (meta) => filled(meta.trained),
  },
  {
    // partner (red heart) is strictly hand-picked; nickname floors this at favorite
    id: 'favorite',
    kind: 'select',
    labelKey: 'info.favorite',
    keys: ['favorite'],
    gatesSeal: false,
    defaultable: false,
    options: (locale) => [
      { value: 'no', label: translate(locale, 'favorite.no') },
      { value: 'favorite', label: translate(locale, 'favorite.favorite') },
      { value: 'partner', label: translate(locale, 'favorite.partner') },
    ],
    isAnswered: () => true,
  },
];

export const DEFAULTABLE_FIELDS = CAPTURE_FIELDS.filter((field) => field.defaultable);

export const EMPTY_METADATA: CaptureMetadata = {
  origin_game: null,
  language: null,
  been_to_champions: null,
  location: null,
  location_save: null,
  ball: null,
  catch_date: null,
  has_nickname: null,
  nickname: null,
  ot: null,
  gender: null,
  level: null,
  trained: null,
  favorite: null,
};

// a field's answer as display text for the sealed record
export function formatFieldValue (field: CaptureField, meta: Partial<CaptureMetadata>, locale: Locale, saves: GameSave[] = []): string {
  const blank = translate(locale, 'common.unspecified');

  switch (field.kind) {
    case 'select': {
      // favorite's unanswered reads as none, never blank
      const value = (meta[field.keys[0]] as string | null) ?? (field.id === 'favorite' ? 'no' : null);
      return value ? field.options!(locale).find((option) => option.value === value)?.label ?? value : blank;
    }
    case 'text':
      return (meta[field.keys[0]] as string | null) || blank;
    case 'number': {
      const value = meta[field.keys[0]];
      return typeof value === 'number' ? String(value) : blank;
    }
    case 'date':
      // stored ISO yyyy-mm-dd, shown yyyy/mm/dd
      return meta.catch_date ? meta.catch_date.replaceAll('-', '/') : blank;
    case 'yesno':
      // two-state: unanswered reads as no
      return translate(locale, meta[field.keys[0]] === true ? 'common.yes' : 'common.no');
    case 'location': {
      if (meta.location === 'home') {
        return translate(locale, 'location.home');
      }
      if (meta.location === 'champions') {
        return translate(locale, 'location.champions');
      }
      if (meta.location === 'game' && meta.location_save) {
        const save = saves.find((entry) => entry.id === meta.location_save);
        // a deleted save leaves the id visible rather than a blank
        return save ? saveLabel(save, locale) : meta.location_save;
      }
      return blank;
    }
    case 'nickname':
      return meta.has_nickname === true ? (meta.nickname || blank) : translate(locale, 'common.no');
    default:
      return blank;
  }
}

// a species gender lock is itself the answer; null = both genders possible
export function genderFromLock (lock: GenderLock | null | undefined): GenderState | null {
  if (lock === 'genderless') {
    return 'none';
  }
  return lock ?? null;
}

// only the registry's defaultable keys — stored settings still carry keys that have since been removed
export function metadataFromDefaults (defaults: Partial<CaptureMetadata> | undefined): Partial<CaptureMetadata> {
  const meta: Partial<CaptureMetadata> = {};
  if (!defaults) {
    return meta;
  }
  for (const field of DEFAULTABLE_FIELDS) {
    for (const key of field.keys) {
      const value = defaults[key];
      if (value !== undefined && value !== null) {
        (meta as Record<string, unknown>)[key] = value;
      }
    }
  }
  return meta;
}

// a floored record can't be 'no'; the control coerces its value into whatever this returns
export function favoriteOptions (locale: Locale, meta: Partial<CaptureMetadata>): CaptureFieldOption[] {
  const all = CAPTURE_FIELDS.find((field) => field.id === 'favorite')!.options!(locale);
  const floored = meta.has_nickname === true || meta.origin_game === MYSTERY_GIFT;
  return floored ? all.filter((option) => option.value !== 'no') : all;
}

// legacy boolean favorites read as the new enum; never written back
export function coerceFavorite (value: unknown): FavoriteState | null {
  if (value === true) {
    return 'favorite';
  }
  // 'none' is the pre-rename literal
  if (value === 'none') {
    return 'no';
  }
  if (value === 'no' || value === 'favorite' || value === 'partner') {
    return value;
  }
  return null;
}

// locked species offer their single answer; mixed species can't be genderless
export function genderOptions (locale: Locale, lock: GenderLock | null | undefined): CaptureFieldOption[] {
  const all = CAPTURE_FIELDS.find((field) => field.id === 'gender')!.options!(locale);
  const locked = genderFromLock(lock);
  return locked
    ? all.filter((option) => option.value === locked)
    : all.filter((option) => option.value !== 'none');
}

// champions only exists in the home dex, and only once the mon has been there
export function locationOptions (locale: Locale, meta: Partial<CaptureMetadata>, isHomeDex: boolean): CaptureFieldOption[] {
  const all = CAPTURE_FIELDS.find((field) => field.id === 'location')!.options!(locale);
  return all.filter((option) => option.value !== 'champions' || (isHomeDex && meta.been_to_champions === true));
}

// cross-field rules, applied wherever metadata is written
export function withFieldInvariants (
  current: Partial<CaptureMetadata>,
  patch: Partial<CaptureMetadata>,
): Partial<CaptureMetadata> {
  const next = { ...patch };

  // nothing catchable comes in a Cherish Ball; the reverse doesn't hold, so this runs one way only
  if (patch.ball === CHERISH_BALL) {
    next.origin_game = MYSTERY_GIFT;
  }

  const merged = { ...current, ...next };

  // a nickname or a Mystery Gift origin floors favorite; partner is deliberate and survives either.
  // keyed on the transition so re-picking a save can't quietly demote a hand-set heart
  const wasFloored = current.has_nickname === true || current.origin_game === MYSTERY_GIFT;
  const isFloored = merged.has_nickname === true || merged.origin_game === MYSTERY_GIFT;
  if (wasFloored !== isFloored && merged.favorite !== 'partner') {
    next.favorite = isFloored ? 'favorite' : 'no';
  }

  // can't be somewhere it has never been
  if (merged.been_to_champions !== true && merged.location === 'champions') {
    next.location = null;
    next.location_save = null;
  }
  // the cartridge only means anything while in a game
  if (merged.location !== 'game' && merged.location_save) {
    next.location_save = null;
  }

  return next;
}

// drives the seal gate and the tile badge
export function unansweredFields (meta: Partial<CaptureMetadata>): CaptureField[] {
  return CAPTURE_FIELDS.filter((field) => field.gatesSeal && !field.isAnswered(meta));
}

export function isRecordComplete (meta: Partial<CaptureMetadata>): boolean {
  return unansweredFields(meta).length === 0;
}
