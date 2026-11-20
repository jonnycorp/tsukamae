// the katakana the kana board lays out (KanaBoard.tsx): the gojūon in its columns (a, ka, sa… n), each read top to
// bottom a i u e o, a gap where a column has no kana; then the voiced and half-voiced columns
export const SEION: (string | null)[][] = [
  ['ア', 'イ', 'ウ', 'エ', 'オ'],
  ['カ', 'キ', 'ク', 'ケ', 'コ'],
  ['サ', 'シ', 'ス', 'セ', 'ソ'],
  ['タ', 'チ', 'ツ', 'テ', 'ト'],
  ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  ['マ', 'ミ', 'ム', 'メ', 'モ'],
  ['ヤ', null, 'ユ', null, 'ヨ'],
  ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  ['ワ', null, null, null, 'ヲ'],
  ['ン', null, null, null, null],
];

export const DAKUON: (string | null)[][] = [
  ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  ['ダ', 'ヂ', 'ヅ', 'デ', 'ド'],
  ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  [null, null, 'ヴ', null, null],
];

const ROMAJI: Record<string, string> = {
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'wo', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ヴ: 'vu',
  ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o',
};

// a kana and the small ャ ュ ョ (or ァ ィ ゥ ェ ォ) after it as one sound: キャ kya, シャ sha, ティ ti, ファ fa
const YOON: Record<string, string> = { ャ: 'a', ュ: 'u', ョ: 'o' };
const SMALL_VOWEL: Record<string, string> = { ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o' };

function combine (base: string, small: string): string | null {
  const head = ROMAJI[base];
  if (!head) {
    return null;
  }
  if (small in YOON) {
    if (head === 'shi' || head === 'chi' || head === 'ji') {
      return head.slice(0, -1) + YOON[small];
    }
    return head.endsWith('i') ? `${head.slice(0, -1)}y${YOON[small]}` : null;
  }
  if (small in SMALL_VOWEL) {
    const vowel = SMALL_VOWEL[small];
    if (head === 'fu') {
      return `f${vowel}`;
    }
    if (head === 'vu') {
      return `v${vowel}`;
    }
    if (head === 'te' || head === 'de') {
      return `${head[0]}${vowel === 'u' ? 'yu' : vowel}`;
    }
    if (head === 'shi' || head === 'chi' || head === 'ji') {
      return `${head.slice(0, -1)}${vowel}`;
    }
    if (head === 'u') {
      return `w${vowel}`;
    }
    return `${head.replace(/[aiueo]$/, '')}${vowel}`;
  }
  return null;
}

// a katakana name read in Hepburn romaji, as a learner sounds it out: the long mark doubles the vowel before it, ッ
// doubles the consonant after it; anything not kana (a digit, ♀, a Latin letter) kept as it is
export function romaji (kana: string): string {
  let out = '';
  let geminate = false;
  const chars = [...kana];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === 'ッ') {
      geminate = true;
      continue;
    }
    if (char === 'ー') {
      const vowel = out.match(/[aiueo]$/)?.[0];
      out += vowel ?? '-';
      continue;
    }
    const paired = chars[i + 1] ? combine(char, chars[i + 1]) : null;
    const sound = paired ?? ROMAJI[char];
    if (paired) {
      i++;
    }
    if (!sound) {
      out += char;
      geminate = false;
      continue;
    }
    if (geminate) {
      out += sound.startsWith('ch') ? 't' : sound[0];
      geminate = false;
    }
    out += sound;
  }
  return out;
}

export const kanaRomaji = (kana: string) => ROMAJI[kana] ?? '';
