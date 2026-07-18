// en defines the key set; ja is typed against it so the dicts can't drift.

export type Locale = 'en' | 'ja';

// Order drives the language toggle. `label` is each language's own endonym.
export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

const en = {
  'nav.editDex': 'Edit Dex',
  'nav.newDex': 'New Dex',
  'nav.export': 'Export Progress',
  'nav.import': 'Import Progress',
  'nav.wipe': 'Wipe Data',
  'nav.wipeConfirm': 'Wipe ALL dexes and progress? Theme and language settings are kept. This cannot be undone.',
  'nav.theme': 'Theme',
  'nav.softDark': 'Soft Dark',
  'nav.importInvalidJson': 'That file isn\'t valid JSON.',
  'nav.importNotExport': 'That file doesn\'t look like a Tsukamae progress export.',
  'nav.importConfirm': 'Importing will REPLACE all current dexes and progress. Continue?',

  'app.name': 'tsukamae',

  'search.placeholder': 'Search by name or # (use / to quick search)',
  'search.hideCaught': 'Hide Caught',
  'search.temporaryOnly': 'Temp Only',

  'progress.done': 'done!',
  'progress.caught': 'caught',
  'progress.toGo': 'to go',
  'progress.temporary': 'temporary',
  'progress.locked': 'locked',

  'markAll.mark': 'Mark All',
  'markAll.unmark': 'Unmark All',
  'markAll.unmarkConfirm': 'Unmark every Pokémon in this box? Their origin game and language data will be cleared too.',

  'footer.basedOn': 'Based on PokédexTracker',

  'landing.empty': 'No dexes yet — create your first one to start tracking.',
  'landing.createFirst': 'Create Your First Dex',
  'landing.createNew': 'Create a New Dex',
  'landing.moveUp': 'Move up',
  'landing.moveDown': 'Move down',

  'status.caught': 'Caught',
  'status.temporary': 'Temporary',
  'status.locked': 'Locked',

  'common.shiny': 'Shiny',
  'common.optional': 'optional',

  'info.originGame': 'Origin Game',
  'info.language': 'Language',
  'info.status': 'Status',
  'info.notCaught': 'Not caught yet.',
  'info.release': 'Release',
  'popover.close': 'Close',

  'dexModal.editTitle': 'Edit Dex',
  'dexModal.createTitle': 'Create New Dex',
  'dexModal.dexData': 'Dex Data',
  'dexModal.defaults': 'Pokémon Defaults',
  'dexModal.noDefault': 'No Default',
  'dexModal.titleLabel': 'Title',
  'dexModal.game': 'Game',
  'dexModal.dex': 'Dex',
  'dexModal.save': 'Save',
  'dexModal.create': 'Create',
  'dexModal.delete': 'Delete Dex',
  'dexModal.deleteConfirm': 'Delete "{title}" and ALL of its progress? This cannot be undone.',

  'searchResults.none': 'No results.',
  'searchResults.clearSearch': 'Clear your search?',
  'searchResults.noneUncaught': 'No results in uncaught Pokémon.',
  'searchResults.includeCaught': 'Include caught Pokémon?',
  'searchResults.allCaught': 'No uncaught Pokémon.',
  'searchResults.showAll': 'Show all Pokémon?',
  'searchResults.noTemporary': 'No temporary Pokémon.',
  'searchResults.noTemporaryMatching': 'No temporary Pokémon matching your search.',
} as const;

export type TranslationKey = keyof typeof en;

const ja: Record<TranslationKey, string> = {
  'nav.editDex': '図鑑を編集',
  'nav.newDex': '新しい図鑑',
  'nav.export': 'データを書き出す',
  'nav.import': 'データを読み込む',
  'nav.wipe': 'データを消去',
  'nav.wipeConfirm': 'すべての図鑑と進捗を消去しますか？テーマと言語の設定は保持されます。元に戻せません。',
  'nav.theme': 'テーマ',
  'nav.softDark': 'ソフトダーク',
  'nav.importInvalidJson': '有効なJSONファイルではありません。',
  'nav.importNotExport': 'Tsukamaeのデータファイルではないようです。',
  'nav.importConfirm': '読み込むと現在の図鑑と進捗がすべて置き換えられます。続けますか？',

  // The brand stays in English in both locales (part of the look).
  'app.name': 'tsukamae',

  'search.placeholder': '名前または番号で検索（/ でクイック検索）',
  'search.hideCaught': '捕獲済みを隠す',
  'search.temporaryOnly': '仮のみ表示',

  'progress.done': '完了！',
  'progress.caught': '捕獲',
  'progress.toGo': '残り',
  'progress.temporary': '仮',
  'progress.locked': 'ロック',

  'markAll.mark': 'すべて記録',
  'markAll.unmark': 'すべて解除',
  'markAll.unmarkConfirm': 'このボックスのポケモンをすべて解除しますか？出身ソフトと言語のデータも消去されます。',

  'footer.basedOn': 'PokédexTracker がベース',

  'landing.empty': 'まだ図鑑がありません。最初の図鑑を作成して記録を始めましょう。',
  'landing.createFirst': '最初の図鑑を作成',
  'landing.createNew': '新しい図鑑を作成',
  'landing.moveUp': '上へ移動',
  'landing.moveDown': '下へ移動',

  'status.caught': '捕獲済み',
  'status.temporary': '仮',
  'status.locked': 'ロック',

  'common.shiny': '色違い',
  'common.optional': '任意',

  'info.originGame': '出身ソフト',
  'info.language': '言語',
  'info.status': '状態',
  'info.notCaught': 'まだ捕まえていません。',
  'info.release': '逃がす',
  'popover.close': '閉じる',

  'dexModal.editTitle': '図鑑を編集',
  'dexModal.createTitle': '新しい図鑑を作成',
  'dexModal.dexData': '図鑑データ',
  'dexModal.defaults': 'ポケモンの既定値',
  'dexModal.noDefault': '既定値なし',
  'dexModal.titleLabel': 'タイトル',
  'dexModal.game': 'ソフト',
  'dexModal.dex': '図鑑',
  'dexModal.save': '保存',
  'dexModal.create': '作成',
  'dexModal.delete': '図鑑を削除',
  'dexModal.deleteConfirm': '「{title}」とその進捗をすべて削除しますか？元に戻せません。',

  'searchResults.none': '結果がありません。',
  'searchResults.clearSearch': '検索をクリアしますか？',
  'searchResults.noneUncaught': '未捕獲のポケモンに結果がありません。',
  'searchResults.includeCaught': '捕獲済みも表示しますか？',
  'searchResults.allCaught': '未捕獲のポケモンはいません。',
  'searchResults.showAll': 'すべてのポケモンを表示しますか？',
  'searchResults.noTemporary': '仮のポケモンはいません。',
  'searchResults.noTemporaryMatching': '検索に一致する仮のポケモンはいません。',
};

export const translations: Record<Locale, Record<TranslationKey, string>> = { en, ja };

export function translate (locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
  const template = translations[locale][key] ?? translations.en[key] ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
