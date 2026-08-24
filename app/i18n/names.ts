import type { Locale } from './translations';

// JA names for data-derived labels, keyed by stable ids, falling back to the English baked into the data

// data/games.json ids — the per-mon "which game did this come from" options
const JA_ORIGIN_GAMES: Record<string, string> = {
  home: 'HOME',
  legends_za: 'LEGENDS Z-A',
  scarlet: 'スカーレット',
  violet: 'バイオレット',
  legends_arceus: 'LEGENDS アルセウス',
  brilliant_diamond: 'ブリリアントダイヤモンド',
  shining_pearl: 'シャイニングパール',
  sword: 'ソード',
  shield: 'シールド',
  lets_go_pikachu: 'Let\'s Go! ピカチュウ',
  lets_go_eevee: 'Let\'s Go! イーブイ',
  ultra_sun: 'ウルトラサン',
  ultra_moon: 'ウルトラムーン',
  sun: 'サン',
  moon: 'ムーン',
  omega_ruby: 'オメガルビー',
  alpha_sapphire: 'アルファサファイア',
  x: 'X',
  y: 'Y',
  go: 'Pokémon GO',
  trade: 'フレンド交換',
  mystery_gift: 'ふしぎなおくりもの',
  other: 'その他',
};

// catalog game ids (version pairs shown in the dex picker/indicator)
const JA_CATALOG_GAMES: Record<string, string> = {
  home: 'HOME',
  legends_za: 'LEGENDS Z-A',
  scarlet: 'スカーレット・バイオレット',
  scarlet_expansion_pass: 'スカーレット・バイオレット（ゼロの秘宝）',
  sword: 'ソード・シールド',
  sword_expansion_pass: 'ソード・シールド（エキスパンションパス）',
  brilliant_diamond: 'ブリリアントダイヤモンド・シャイニングパール',
  legends_arceus: 'LEGENDS アルセウス',
  lets_go_pikachu: 'Let\'s Go! ピカチュウ・イーブイ',
  ultra_sun: 'ウルトラサン・ウルトラムーン',
  sun: 'サン・ムーン',
  omega_ruby: 'オメガルビー・アルファサファイア',
  x: 'X・Y',
};

// dex_type.name values (and the indicator's tag labels that share them)
const JA_DEX_TYPES: Record<string, string> = {
  Regional: '地方図鑑',
  'Full National': '全国図鑑',
  'Game National': '全国図鑑（ゲーム内）',
  'Gigantamax Forms': 'キョダイマックスの姿',
  'Full Paldea': 'パルデア全図鑑',
  Kitakami: 'キタカミ図鑑',
  Blueberry: 'ブルーベリー図鑑',
  'Lumiose City': 'ミアレシティ図鑑',
  'Mega Dimension': 'メガディメンション図鑑',
  'gigantamax forms': 'キョダイマックスの姿',
};

const JA_CATALOG_DEX_NAMES: Record<string, string> = {
  'home-national': '全国図鑑',
  'home-national-gigantamax': '全国図鑑＋キョダイマックスの姿',
  'legends-z-a-regional': 'LEGENDS Z-A ミアレシティ図鑑',
  'legends-z-a-mega-dimension': 'LEGENDS Z-A メガディメンション図鑑（DLC）',
  'paldea-full': 'スカーレット・バイオレット パルデア全図鑑（DLC込み）',
  kitakami: 'スカーレット・バイオレット キタカミ図鑑（碧の仮面）',
  blueberry: 'スカーレット・バイオレット ブルーベリー図鑑（藍の円盤）',
  'scarlet-violet-regional': 'スカーレット・バイオレット 地方図鑑',
  'legends-arceus-regional': 'LEGENDS アルセウス 地方図鑑',
  'bdsp-regional': 'ブリリアントダイヤモンド・シャイニングパール 地方図鑑',
  'bdsp-national': 'ブリリアントダイヤモンド・シャイニングパール 全国図鑑',
  'sword-shield-expansion-regional': 'ソード・シールド（エキスパンションパス）地方図鑑',
  'sword-shield-regional': 'ソード・シールド 地方図鑑',
  'sword-shield-national': 'ソード・シールド 全国図鑑',
  'lets-go-regional': 'Let\'s Go! ピカチュウ・イーブイ 地方図鑑',
  'ultra-sun-ultra-moon-regional': 'ウルトラサン・ウルトラムーン 地方図鑑',
  'sun-moon-regional': 'サン・ムーン 地方図鑑',
  'oras-regional': 'オメガルビー・アルファサファイア 地方図鑑',
  'x-y-regional': 'X・Y 地方図鑑',
};

// data/languages.json ids — a mon's language of origin
const JA_CAPTURE_LANGUAGES: Record<string, string> = {
  japanese: '日本語',
  english: '英語',
  french: 'フランス語',
  italian: 'イタリア語',
  german: 'ドイツ語',
  spanish: 'スペイン語',
  korean: '韓国語',
  chinese_simplified: '中国語（簡体字）',
  chinese_traditional: '中国語（繁体字）',
};

// data/balls.json ids — the ball a mon was caught in
const JA_BALLS: Record<string, string> = {
  poke_ball: 'モンスターボール',
  great_ball: 'スーパーボール',
  ultra_ball: 'ハイパーボール',
  master_ball: 'マスターボール',
  premier_ball: 'プレミアボール',
  heal_ball: 'ヒールボール',
  net_ball: 'ネットボール',
  nest_ball: 'ネストボール',
  dive_ball: 'ダイブボール',
  dusk_ball: 'ダークボール',
  timer_ball: 'タイマーボール',
  quick_ball: 'クイックボール',
  repeat_ball: 'リピートボール',
  luxury_ball: 'ゴージャスボール',
  level_ball: 'レベルボール',
  lure_ball: 'ルアーボール',
  moon_ball: 'ムーンボール',
  friend_ball: 'フレンドボール',
  love_ball: 'ラブラブボール',
  fast_ball: 'スピードボール',
  heavy_ball: 'ヘビーボール',
  dream_ball: 'ドリームボール',
  safari_ball: 'サファリボール',
  sport_ball: 'コンペボール',
  // not ハイパーボール — that's the Ultra Ball
  beast_ball: 'ウルトラボール',
  cherish_ball: 'プレシャスボール',
  park_ball: 'パークボール',
  strange_ball: 'フシギボール',
  feather_ball: 'フェザーボール',
  wing_ball: 'ウイングボール',
  jet_ball: 'ジェットボール',
  leaden_ball: 'レドームボール',
  gigaton_ball: 'ギガトンボール',
  origin_ball: 'オリジンボール',
  unknown: '不明',
};

function localized (map: Record<string, string>, locale: Locale, key: string, fallback: string): string {
  return locale === 'ja' ? map[key] ?? fallback : fallback;
}

export function localizeOriginGame (locale: Locale, id: string, fallback: string): string {
  return localized(JA_ORIGIN_GAMES, locale, id, fallback);
}

export function localizeCatalogGame (locale: Locale, id: string, fallback: string): string {
  return localized(JA_CATALOG_GAMES, locale, id, fallback);
}

export function localizeCatalogDexName (locale: Locale, key: string, fallback: string): string {
  return localized(JA_CATALOG_DEX_NAMES, locale, key, fallback);
}

export function localizeDexType (locale: Locale, name: string, fallback = name): string {
  return localized(JA_DEX_TYPES, locale, name, fallback);
}

export function localizeCaptureLanguage (locale: Locale, id: string, fallback: string): string {
  return localized(JA_CAPTURE_LANGUAGES, locale, id, fallback);
}

export function localizeBall (locale: Locale, id: string, fallback: string): string {
  return localized(JA_BALLS, locale, id, fallback);
}
