import ballsJson from '../../data/balls.json';
import languagesJson from '../../data/languages.json';
import originGamesJson from '../../data/games.json';

import { localizeBall, localizeCaptureLanguage, localizeOriginGame } from '../i18n/names';
import { translate } from '../i18n/translations';

import type { CaptureMetadata, CaptureStatus, FavoriteState, GameSave, GenderLock, GenderState } from '../types';
import type { Locale, TranslationKey } from '../i18n/translations';

// catalogs live here, not in local-data — that import would cycle

interface OriginGame {
  id: string;
  name: string;
}
export const ORIGIN_GAMES = originGamesJson as OriginGame[];
export const ORIGIN_GAME_NAMES = new Map(ORIGIN_GAMES.map((game) => [game.id, game.name]));

// abbr is the in-game three-letter tag; name_max caps both OT and nickname
interface Language {
  id: string;
  name: string;
  abbr: string;
  name_max: number;
}
export const LANGUAGES = languagesJson as Language[];
export const LANGUAGE_ABBRS = new Map(LANGUAGES.map((language) => [language.id, language.abbr]));

const CJK_TEXT = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff66-\uff9f]/;
const CJK_TAGS: Record<string, string> = { japanese: 'ja', korean: 'ko', chinese_simplified: 'zh-Hans', chinese_traditional: 'zh-Hant' };

// a nickname or OT is set by its own script, whatever the UI language
export function nameLang (name: string, language: string | null | undefined): string {
  return CJK_TEXT.test(name) ? CJK_TAGS[language ?? ''] ?? 'ja' : 'en';
}

export const NAME_MAX_FALLBACK = 12;

interface Ball {
  id: string;
  name: string;
}
export const BALLS = ballsJson as Ball[];
export const BALL_NAMES = new Map(BALLS.map((ball) => [ball.id, ball.name]));

export const MYSTERY_GIFT = 'mystery_gift';
const CHERISH_BALL = 'cherish_ball';

export const STATUSES: CaptureStatus[] = ['caught', 'temporary', 'unobtainable'];

export function statusOptions (locale: Locale): CaptureFieldOption[] {
  return STATUSES.map((status) => ({ value: status, label: translate(locale, `status.${status}`) }));
}

export function nameMaxLength (language: string | null | undefined): number {
  return LANGUAGES.find((entry) => entry.id === language)?.name_max ?? NAME_MAX_FALLBACK;
}

export function saveLabel (save: GameSave, locale: Locale): string {
  const game = localizeOriginGame(locale, save.game, ORIGIN_GAME_NAMES.get(save.game) ?? save.game);
  const abbr = LANGUAGE_ABBRS.get(save.language);
  return abbr ? `${game} (${abbr})` : game;
}

// saves are keyed by game/language pair, never by id
export function findSave (saves: GameSave[], game: string | null, language: string | null): GameSave | undefined {
  if (!game || !language) {
    return undefined;
  }
  return saves.find((save) => save.game === game && save.language === language);
}

export function lookupOT (saves: GameSave[], game: string | null, language: string | null): string | null {
  return findSave(saves, game, language)?.ot || null;
}

type CaptureFieldId =
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

type CaptureFieldKind = 'select' | 'text' | 'number' | 'date' | 'yesno' | 'save' | 'location' | 'nickname';

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
  keys: (keyof CaptureMetadata)[];
  gatesSeal: boolean;
  defaultable: boolean;
  options?: (locale: Locale) => CaptureFieldOption[];
  // text cap, resolved from the record — OT and nickname follow the mon's language
  maxLength?: (meta: Partial<CaptureMetadata>) => number;
  min?: number;
  max?: number;
  // stored on every marked record, for a field whose options cover every state; such a field offers no blank
  baseline?: Partial<CaptureMetadata>;
  // null means untouched, never "no"
  isAnswered: (meta: Partial<CaptureMetadata>) => boolean;
}

function filled (value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export const CAPTURE_FIELDS: CaptureField[] = [
  {
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
    defaultable: false,
    maxLength: (meta) => nameMaxLength(meta.language),
    isAnswered: (meta) => filled(meta.ot),
  },
  {
    id: 'been_to_champions',
    kind: 'yesno',
    labelKey: 'info.beenToChampions',
    keys: ['been_to_champions'],
    gatesSeal: false,
    defaultable: false,
    baseline: { been_to_champions: false },
    isAnswered: () => true,
  },
  {
    id: 'location',
    kind: 'location',
    labelKey: 'info.location',
    keys: ['location', 'location_save'],
    gatesSeal: true,
    defaultable: false,
    options: (locale) => [
      { value: 'home', label: translate(locale, 'location.home') },
      { value: 'game', label: translate(locale, 'location.game') },
      { value: 'champions', label: translate(locale, 'location.champions') },
    ],
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
    baseline: { has_nickname: false },
    maxLength: (meta) => nameMaxLength(meta.language),
    isAnswered: (meta) => meta.has_nickname !== true || filled(meta.nickname),
  },
  {
    id: 'level',
    kind: 'number',
    labelKey: 'info.level',
    keys: ['level'],
    gatesSeal: true,
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
    gatesSeal: false,
    defaultable: true,
    options: (locale) => [
      { value: 'none', label: translate(locale, 'trained.none') },
      { value: 'ivs', label: translate(locale, 'trained.ivs') },
      { value: 'ev', label: translate(locale, 'trained.ev') },
    ],
    baseline: { trained: 'none' },
    isAnswered: () => true,
  },
  {
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
    baseline: { favorite: 'no' },
    isAnswered: () => true,
  },
];

export const DEFAULTABLE_FIELDS = CAPTURE_FIELDS.filter((field) => field.defaultable);

export const BASELINE_METADATA: Partial<CaptureMetadata> = Object.assign({}, ...CAPTURE_FIELDS.map((field) => field.baseline));
export const DEFAULTABLE_BASELINES: Partial<CaptureMetadata> = Object.assign({}, ...DEFAULTABLE_FIELDS.map((field) => field.baseline));

// fills empty baseline fields; an untouched record comes back as the same object
export function withBaselines<T extends Partial<CaptureMetadata>> (meta: T, baselines = BASELINE_METADATA): T {
  let next = meta;
  for (const [key, value] of Object.entries(baselines)) {
    if (meta[key as keyof CaptureMetadata] === null || meta[key as keyof CaptureMetadata] === undefined) {
      next = next === meta ? { ...meta } : next;
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

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

export function formatFieldValue (field: CaptureField, meta: Partial<CaptureMetadata>, locale: Locale, saves: GameSave[] = []): string {
  const blank = translate(locale, 'common.unspecified');

  switch (field.kind) {
    case 'select': {
      const value = meta[field.keys[0]];
      if (value === null || value === undefined || value === '') {
        return blank;
      }
      return field.options!(locale).find((option) => option.value === value)?.label ?? String(value);
    }
    case 'text':
      return (meta[field.keys[0]] as string | null) || blank;
    case 'number': {
      const value = meta[field.keys[0]];
      return typeof value === 'number' ? String(value) : blank;
    }
    case 'date':
      return meta.catch_date ? meta.catch_date.replaceAll('-', '/') : blank;
    case 'yesno': {
      const value = meta[field.keys[0]];
      if (value === null || value === undefined) {
        return blank;
      }
      return typeof value === 'boolean' ? translate(locale, value ? 'common.yes' : 'common.no') : String(value);
    }
    case 'location': {
      if (meta.location === 'home') {
        return translate(locale, 'location.home');
      }
      if (meta.location === 'champions') {
        return translate(locale, 'location.champions');
      }
      if (meta.location === 'game' && meta.location_save) {
        const save = saves.find((entry) => entry.id === meta.location_save);
        return save ? saveLabel(save, locale) : meta.location_save;
      }
      return blank;
    }
    case 'nickname':
      if (meta.has_nickname === true) {
        return meta.nickname || blank;
      }
      return meta.has_nickname === false ? translate(locale, 'common.no') : blank;
    default:
      return blank;
  }
}

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

// anything the app doesn't write reads as unanswered
export function readFavorite (value: unknown): FavoriteState | null {
  return value === 'no' || value === 'favorite' || value === 'partner' ? value : null;
}

export function genderOptions (locale: Locale, lock: GenderLock | null | undefined): CaptureFieldOption[] {
  const all = CAPTURE_FIELDS.find((field) => field.id === 'gender')!.options!(locale);
  const locked = genderFromLock(lock);
  return locked
    ? all.filter((option) => option.value === locked)
    : all.filter((option) => option.value !== 'none');
}

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

  // keyed on the transition so re-picking a save can't quietly demote a hand-set heart
  const wasFloored = current.has_nickname === true || current.origin_game === MYSTERY_GIFT;
  const isFloored = merged.has_nickname === true || merged.origin_game === MYSTERY_GIFT;
  if (wasFloored !== isFloored && merged.favorite !== 'partner') {
    next.favorite = isFloored ? 'favorite' : 'no';
  }

  if (merged.been_to_champions !== true && merged.location === 'champions') {
    next.location = null;
    next.location_save = null;
  }
  if (merged.location !== 'game' && merged.location_save) {
    next.location_save = null;
  }

  return next;
}

export function unansweredFields (meta: Partial<CaptureMetadata>): CaptureField[] {
  return CAPTURE_FIELDS.filter((field) => field.gatesSeal && !field.isAnswered(meta));
}

export function isRecordComplete (meta: Partial<CaptureMetadata>): boolean {
  return unansweredFields(meta).length === 0;
}

const offeredValues = new Map<string, Set<string>>();

function offers (field: CaptureField, value: unknown): boolean {
  let values = offeredValues.get(field.id);
  if (!values) {
    values = new Set(field.options!('en').map((option) => option.value));
    offeredValues.set(field.id, values);
  }
  return typeof value === 'string' && values.has(value);
}

// whether the app could write the stored value today; text length is left out, event OTs outrun the typing cap
function writable (field: CaptureField, meta: Partial<CaptureMetadata>, genderLock: GenderLock | null | undefined): boolean {
  const value = field.keys.length > 0 ? meta[field.keys[0]] : null;
  // a field with a baseline is never written empty
  if (value === null || value === undefined) {
    return !field.baseline;
  }
  switch (field.kind) {
    case 'select':
      return field.id === 'gender'
        ? genderOptions('en', genderLock).some((option) => option.value === value)
        : offers(field, value);
    case 'location':
      return offers(field, value) && (value !== 'champions' || meta.been_to_champions === true);
    case 'number':
      return typeof value === 'number' && value >= (field.min ?? -Infinity) && value <= (field.max ?? Infinity);
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    default:
      return true;
  }
}

// a sealed record failing today's requirements: a gate added since, or a value the app no longer writes
export function staleFields (meta: Partial<CaptureMetadata>, genderLock: GenderLock | null | undefined): CaptureField[] {
  return CAPTURE_FIELDS.filter((field) => (field.gatesSeal && !field.isAnswered(meta)) || !writable(field, meta, genderLock));
}
