// romaji typed into a search, read as katakana (pika → ピカ), so a species' Japanese name can be found without an IME:
// Hepburn and the keyboard's own spellings both (shi and si, tsu and tu, chi and ti), a doubled consonant as ッ, n
// before a consonant (or nn, n') as ン, a long vowel's dash as ー. What isn't romaji is left as typed
const BASE: Record<string, string> = {
  a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ',
  ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ', ga: 'ガ', gi: 'ギ', gu: 'グ', ge: 'ゲ', go: 'ゴ',
  sa: 'サ', si: 'シ', shi: 'シ', su: 'ス', se: 'セ', so: 'ソ', za: 'ザ', zi: 'ジ', ji: 'ジ', zu: 'ズ', ze: 'ゼ', zo: 'ゾ',
  ta: 'タ', ti: 'チ', chi: 'チ', tu: 'ツ', tsu: 'ツ', te: 'テ', to: 'ト', da: 'ダ', di: 'ヂ', du: 'ヅ', de: 'デ', do: 'ド',
  na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ',
  ha: 'ハ', hi: 'ヒ', hu: 'フ', fu: 'フ', he: 'ヘ', ho: 'ホ', ba: 'バ', bi: 'ビ', bu: 'ブ', be: 'ベ', bo: 'ボ',
  pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ',
  ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ',
  ya: 'ヤ', yu: 'ユ', yo: 'ヨ',
  ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ',
  wa: 'ワ', wo: 'ヲ', vu: 'ヴ',
  fa: 'ファ', fi: 'フィ', fe: 'フェ', fo: 'フォ', she: 'シェ', je: 'ジェ', che: 'チェ',
  va: 'ヴァ', vi: 'ヴィ', ve: 'ヴェ', vo: 'ヴォ', wi: 'ウィ', we: 'ウェ',
  xa: 'ァ', xi: 'ィ', xu: 'ゥ', xe: 'ェ', xo: 'ォ', xya: 'ャ', xyu: 'ュ', xyo: 'ョ', xtu: 'ッ',
};

// the y-glides: kya, sha, cha, ja, and the rest
const GLIDES: [string, string][] = [['k', 'キ'], ['g', 'ギ'], ['s', 'シ'], ['z', 'ジ'], ['t', 'チ'], ['c', 'チ'], ['d', 'ヂ'], ['n', 'ニ'], ['h', 'ヒ'], ['b', 'ビ'], ['p', 'ピ'], ['m', 'ミ'], ['r', 'リ']];
for (const [consonant, kana] of GLIDES) {
  BASE[`${consonant}ya`] = `${kana}ャ`;
  BASE[`${consonant}yu`] = `${kana}ュ`;
  BASE[`${consonant}yo`] = `${kana}ョ`;
}
for (const [spelling, kana] of [['sha', 'シャ'], ['shu', 'シュ'], ['sho', 'ショ'], ['cha', 'チャ'], ['chu', 'チュ'], ['cho', 'チョ'], ['ja', 'ジャ'], ['ju', 'ジュ'], ['jo', 'ジョ'], ['thi', 'ティ'], ['dhi', 'ディ']]) {
  BASE[spelling] = kana;
}

const LONGEST = 3;

// the katakana of a romaji string, or null where it doesn't read as romaji (a digit, a kana already)
export function romajiToKana (input: string): string | null {
  const text = input.toLowerCase();
  if (!/^[a-z'-]+$/.test(text)) {
    return null;
  }
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '-') {
      out += 'ー';
      i += 1;
    } else if (char === '\'') {
      i += 1;
    } else if (char === 'n' && (next === undefined || next === 'n' || next === '\'' || !'aiueoy'.includes(next))) {
      // ン: before a consonant, at the end, or spelled nn or n'
      out += 'ン';
      i += next === 'n' || next === '\'' ? 2 : 1;
    } else if (next === char && !'aiueon'.includes(char)) {
      // a doubled consonant, the small tsu
      out += 'ッ';
      i += 1;
    } else {
      let matched = false;
      for (let length = LONGEST; length > 0; length -= 1) {
        const kana = BASE[text.slice(i, i + length)];
        if (kana) {
          out += kana;
          i += length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // a consonant still being typed (pik): kept as is, so the kana so far still matches
        if (i === text.length - 1) {
          return out;
        }
        return null;
      }
    }
  }
  return out;
}
