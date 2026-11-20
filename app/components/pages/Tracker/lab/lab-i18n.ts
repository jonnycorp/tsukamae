import { useCallback } from 'react';

import { useTranslation } from '../../../../hooks/use-translation';

import type { Locale } from '../../../../i18n/translations';

// the lab's own strings, apart from i18n/translations.ts so a sketch comes out with its file: each sketch's keys under
// its own prefix. Japanese first, as the app leans
const ja = {
  'lab.title': 'ラボ',
  'lab.hint': '試作中のビュー。押すか数字キーで開く',
  'lab.note': 'どれも試作品です。気に入ったものだけ残して、ほかは消してください。',
  'calendar.title': '捕獲カレンダー',
  'calendar.blurb': '捕まえた日ごとに一年を一枚に。日を押すとその日のポケモンを確認',
  'calendar.hint': '日に合わせるとその日のポケモン、押すと確認で順に表示',
  'calendar.dated': '日付つきの記録',
  'calendar.activeDays': '捕まえた日数',
  'calendar.streak': '最長連続日数',
  'calendar.until': '{date}まで',
  'calendar.busiest': '一日の最多',
  'calendar.first': '最初の記録',
  'calendar.onThisDay': '過去の今日',
  'calendar.yearsAgo': '{n}年前',
  'calendar.empty': '捕まえた日が入った記録がまだありません。',
  'calendar.count': '{n}匹',
  'calendar.none': 'この日はなし',
  'calendar.press': '押すとこの日のポケモンを確認',
  'galaxy.title': 'ボール銀河',
  'galaxy.blurb': '初めて使った順にボールが渦を巻く銀河。開くと歴史を再生',
  'galaxy.hint': 'ドラッグで移動、ホイールで拡大。ボールを押すと図鑑を絞り込み、近づくと一匹ずつ選べる',
  'galaxy.empty': 'ボールと捕まえた日が入った記録がまだありません。',
  'galaxy.readout': '{mons}匹・ボール{balls}種',
  'galaxy.play': '再生',
  'galaxy.pause': '一時停止',
  'galaxy.scrub': '日付',
  'galaxy.legend': '中心が最初に使ったボール。外へいくほど新しく、点は一匹ずつ（色は一つめのタイプ）',
  'galaxy.ballFacts': '{n}匹・{first}〜{last}',
  'galaxy.press': '押すとこのボールで図鑑を絞り込み',
  'galaxy.pressMon': '押すと図鑑でこのポケモンへ',
  'champions.title': 'チャンピオンズ一覧',
  'champions.blurb': '今シーズン連れていけるポケモンの一覧。全図鑑から、いる・行った・未参加・未所持を表示',
  'champions.hint': 'カードに合わせると持っている個体、押すと開いている図鑑でそのポケモンへ',
  'champions.there': 'チャンピオンズにいる',
  'champions.been': '行ったことがある',
  'champions.held': '持っているが未参加',
  'champions.none': '未所持',
  'champions.reached': '参加済み',
  'champions.updated': '{date}更新',
  'champions.gen': '第{n}世代',
  'champions.atChampions': 'チャンピオンズ',
  'champions.inGame': 'ソフト',
  'champions.beenShort': '参加済み',
  'champions.noCopies': 'どの図鑑にもまだいません',
  'champions.press': '押すと図鑑でこのポケモンへ',
  'art.toSprite': 'ドット絵に',
  'art.toArt': '公式イラストに',
};

type LabStrings = Record<keyof typeof ja, string>;
export type LabKey = keyof typeof ja;

const en: LabStrings = {
  'lab.title': 'Lab',
  'lab.hint': 'Views in the works; press one, or its number, to open it',
  'lab.note': 'Every one of these is a sketch. Keep the ones you like and delete the rest.',
  'calendar.title': 'Catch Calendar',
  'calendar.blurb': 'A year to a sheet, every mon on the day you caught it; press a day to go through its mons',
  'calendar.hint': 'Point at a day to see its mons; press it to go through them in the review',
  'calendar.dated': 'dated records',
  'calendar.activeDays': 'days with a catch',
  'calendar.streak': 'longest streak (days)',
  'calendar.until': 'ending {date}',
  'calendar.busiest': 'most in a day',
  'calendar.first': 'first record',
  'calendar.onThisDay': 'On This Day',
  'calendar.yearsAgo': '{n}y ago',
  'calendar.empty': 'No record has a catch date yet.',
  'calendar.count': '{n} Pokémon',
  'calendar.none': 'Nothing this day',
  'calendar.press': 'Press to go through this day\'s mons',
  'galaxy.title': 'Ball Galaxy',
  'galaxy.blurb': 'Your balls as a spiral galaxy in the order you first used them; it opens by replaying your history',
  'galaxy.hint': 'Drag to look around, wheel to zoom; press a ball to filter the dex, or zoom in to pick a single mon',
  'galaxy.empty': 'No record has both a ball and a catch date yet.',
  'galaxy.readout': '{mons} Pokémon · {balls} balls',
  'galaxy.play': 'Play',
  'galaxy.pause': 'Pause',
  'galaxy.scrub': 'Date',
  'galaxy.legend': 'The first ball you used is at the heart, each newer one further out; every mote is a mon, in its first type\'s colour',
  'galaxy.ballFacts': '{n} Pokémon · {first} to {last}',
  'galaxy.press': 'Press to filter the dex to this ball',
  'galaxy.pressMon': 'Press to go to this mon in the dex',
  'champions.title': 'Champions Roster',
  'champions.blurb': 'Every mon this season\'s Champions roster takes, and how far each has got with you across all your dexes',
  'champions.hint': 'Point at a card to see your copies; press it to go to that mon in the open dex',
  'champions.there': 'In Champions',
  'champions.been': 'Been to Champions',
  'champions.held': 'Held, never gone',
  'champions.none': 'Not held',
  'champions.reached': 'have been',
  'champions.updated': 'Updated {date}',
  'champions.gen': 'Gen {n}',
  'champions.atChampions': 'Champions',
  'champions.inGame': 'In a game',
  'champions.beenShort': 'been',
  'champions.noCopies': 'In none of your dexes yet',
  'champions.press': 'Press to go to this mon in the dex',
  'art.toSprite': 'Show Sprite',
  'art.toArt': 'Show Artwork',
};

const STRINGS: Record<Locale, LabStrings> = { ja, en };

export function labText (locale: Locale, key: LabKey, params?: Record<string, string | number>): string {
  const template = STRINGS[locale][key] ?? STRINGS.ja[key];
  return params ? template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : template;
}

export function useLabText () {
  const { locale } = useTranslation();
  const lt = useCallback((key: LabKey, params?: Record<string, string | number>) => labText(locale, key, params), [locale]);
  return { lt, locale };
}
