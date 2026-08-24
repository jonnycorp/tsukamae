// en defines the key set; ja is typed against it so the dicts can't drift

export type Locale = 'en' | 'ja';

const en = {
  'nav.editDex': 'Edit Dex',
  'nav.newDex': 'New Dex',
  'nav.export': 'Export Progress',
  'nav.import': 'Import Progress',
  'nav.saves': 'My Games',
  'nav.theme': 'Theme',
  'nav.softDark': 'Soft Dark',
  'nav.importInvalidJson': 'That file isn\'t valid JSON.',
  'nav.importNotExport': 'That file doesn\'t look like a Tsukamae progress export.',
  'nav.importConfirm': 'Importing will REPLACE all current dexes and progress. Continue?',

  'app.name': 'tsukamae',

  'search.placeholder': 'Search by name or # (use / to quick search)',
  'search.hideMarked': 'Hide Marked',
  'search.temporaryOnly': 'Temp Only',
  'search.unsealedOnly': 'Unsealed Only',
  'search.incompleteOnly': 'Incomplete Only',
  'search.favoritesOnly': 'Favorites Only',
  'search.langTags': 'Lang Tags',

  'progress.done': 'done!',
  'progress.marked': 'marked',
  'progress.toGo': 'to go',
  'progress.temporary': 'temporary',
  'progress.caught': 'caught',

  'footer.basedOn': 'Based on PokédexTracker',

  'landing.empty': 'No dexes yet — create your first one to start tracking.',
  'landing.createFirst': 'Create Your First Dex',
  'landing.createNew': 'Create a New Dex',
  'landing.moveUp': 'Move up',
  'landing.moveDown': 'Move down',
  'landing.editList': 'Edit List',
  'landing.doneEditing': 'Done',
  'landing.delete': 'Delete',
  'landing.deleteConfirm': 'Delete "{title}" and ALL of its progress? This cannot be undone.',

  'status.unobtainable': 'Unobtainable',
  'status.temporary': 'Temporary',
  'status.caught': 'Caught',

  'common.shiny': 'Shiny',
  'common.optional': 'optional',
  'common.unspecified': 'Unspecified',
  'common.yes': 'Yes',
  'common.no': 'No',

  'info.myGame': 'My Game',
  'info.originGame': 'Origin Game',
  'info.language': 'Language',
  'info.status': 'Status',
  'info.beenToChampions': 'Been to Champions',
  'info.location': 'Location',
  'info.ball': 'Ball',
  'info.catchDate': 'Catch Date',
  'info.gender': 'Gender',
  'info.nickname': 'Nickname',
  'info.ot': 'OT',
  'info.level': 'Level',
  'info.trained': 'Trained',
  'info.favorite': 'Favorite',
  'info.notCaught': 'Not marked yet.',
  'info.release': 'Release',
  'popover.close': 'Close',

  'location.home': 'In HOME',
  'location.game': 'In a game',
  'location.champions': 'In Champions',
  'location.whichGame': 'Which game',

  'trained.none': 'Untrained',
  'trained.ivs': '3+ perfect IVs',
  'trained.ev': 'EV-trained',

  'gender.none': 'Genderless',
  'gender.male': 'Male',
  'gender.female': 'Female',

  'favorite.no': 'No',
  'favorite.favorite': 'Favorite',
  'favorite.partner': 'Partner',

  'seal.action': 'Seal',
  'seal.sealed': 'Sealed',
  'seal.confirm': 'Seal {name}? A sealed Pokémon can\'t be edited or released — you\'ll have to hold to unseal it first.',
  'seal.incomplete': 'Answer every field to seal ({count} left)',

  'saves.title': 'My Games',
  'saves.add': 'Add a Game',
  'saves.game': 'Game',
  'saves.language': 'Language',
  'saves.ot': 'OT',
  'saves.delete': 'Delete',
  'saves.deleteConfirm': 'Delete "{label}"?',
  'saves.notMine': 'Not My Game',
  'saves.duplicate': 'You already have a game for that combination.',

  'dexModal.editTitle': 'Edit Dex',
  'dexModal.createTitle': 'Create New Dex',
  'dexModal.dexData': 'Dex Data',
  'dexModal.defaults': 'Pokémon Defaults',
  'dexModal.titleLabel': 'Title',
  'dexModal.game': 'Game',
  'dexModal.dex': 'Dex',
  'dexModal.checklist': 'Checklist',
  'dexModal.save': 'Save',
  'dexModal.create': 'Create',

  'box.allCaught': 'All Caught',
  'box.sealed': 'sealed',

  'searchResults.none': 'No results.',
  'searchResults.clearSearch': 'Clear your search?',
  'searchResults.noneUnmarked': 'No results in unmarked Pokémon.',
  'searchResults.includeMarked': 'Include marked Pokémon?',
  'searchResults.allMarked': 'No unmarked Pokémon.',
  'searchResults.showAll': 'Show all Pokémon?',
  'searchResults.noTemporary': 'No temporary Pokémon.',
  'searchResults.noTemporaryMatching': 'No temporary Pokémon matching your search.',
  'searchResults.noneMatching': 'No Pokémon match these filters.',
  'searchResults.clearFilters': 'Clear the filters?',
} as const;

export type TranslationKey = keyof typeof en;

const ja: Record<TranslationKey, string> = {
  'nav.editDex': '図鑑を編集',
  'nav.newDex': '新しい図鑑',
  'nav.export': 'データを書き出す',
  'nav.import': 'データを読み込む',
  'nav.saves': 'マイゲーム',
  'nav.theme': 'テーマ',
  'nav.softDark': 'ソフトダーク',
  'nav.importInvalidJson': '有効なJSONファイルではありません。',
  'nav.importNotExport': 'Tsukamaeのデータファイルではないようです。',
  'nav.importConfirm': '読み込むと現在の図鑑と進捗がすべて置き換えられます。続けますか？',

  // the brand stays english in both locales
  'app.name': 'tsukamae',

  'search.placeholder': '名前または番号で検索（/ でクイック検索）',
  'search.hideMarked': '記録済みを隠す',
  'search.temporaryOnly': '仮のみ表示',
  'search.unsealedOnly': '未確定のみ表示',
  'search.incompleteOnly': '未記入のみ表示',
  'search.favoritesOnly': 'お気に入りのみ表示',
  'search.langTags': '言語タグ',

  'progress.done': '完了！',
  'progress.marked': '記録済み',
  'progress.toGo': '残り',
  'progress.temporary': '仮',
  'progress.caught': '捕獲',

  'footer.basedOn': 'PokédexTracker がベース',

  'landing.empty': 'まだ図鑑がありません。最初の図鑑を作成して記録を始めましょう。',
  'landing.createFirst': '最初の図鑑を作成',
  'landing.createNew': '新しい図鑑を作成',
  'landing.moveUp': '上へ移動',
  'landing.moveDown': '下へ移動',
  'landing.editList': 'リストを編集',
  'landing.doneEditing': '完了',
  'landing.delete': '削除',
  'landing.deleteConfirm': '「{title}」とその進捗をすべて削除しますか？元に戻せません。',

  'status.unobtainable': '入手不可',
  'status.temporary': '仮',
  'status.caught': '捕獲済み',

  'common.shiny': '色違い',
  'common.optional': '任意',
  'common.unspecified': '未指定',
  'common.yes': 'はい',
  'common.no': 'いいえ',

  'info.myGame': 'マイゲーム',
  'info.originGame': '出身ソフト',
  'info.language': '言語',
  'info.status': '状態',
  'info.beenToChampions': 'チャンピオンズ経験',
  'info.location': '現在地',
  'info.ball': 'ボール',
  'info.catchDate': '捕獲日',
  'info.gender': '性別',
  'info.nickname': 'ニックネーム',
  'info.level': 'レベル',
  'info.ot': '親（OT）',
  'info.trained': '育成状況',
  'info.favorite': 'お気に入り',
  'info.notCaught': 'まだ記録していません。',
  'info.release': '逃がす',
  'popover.close': '閉じる',

  'location.home': 'HOME内',
  'location.game': 'ソフト内',
  'location.champions': 'チャンピオンズ内',
  'location.whichGame': 'どのソフト',

  'gender.none': '性別なし',
  'gender.male': 'オス',
  'gender.female': 'メス',

  'favorite.no': 'いいえ',
  'favorite.favorite': 'お気に入り',
  'favorite.partner': '相棒',

  'trained.none': '未育成',
  'trained.ivs': '個体値V3つ以上',
  'trained.ev': '努力値振り済み',

  'seal.action': '確定する',
  'seal.sealed': '確定済み',
  'seal.confirm': '{name} を確定しますか？確定したポケモンは編集も解放もできません。長押しで解除する必要があります。',
  'seal.incomplete': 'すべての項目に回答すると確定できます（残り{count}件）',

  'saves.title': 'マイゲーム',
  'saves.add': 'ソフトを追加',
  'saves.game': 'ソフト',
  'saves.language': '言語',
  'saves.ot': '親（OT）',
  'saves.delete': '削除',
  'saves.deleteConfirm': '「{label}」を削除しますか？',
  'saves.notMine': '自分のゲーム以外',
  'saves.duplicate': 'その組み合わせのソフトは既に登録されています。',

  'dexModal.editTitle': '図鑑を編集',
  'dexModal.createTitle': '新しい図鑑を作成',
  'dexModal.dexData': '図鑑データ',
  'dexModal.defaults': 'ポケモンの既定値',
  'dexModal.titleLabel': 'タイトル',
  'dexModal.game': 'ソフト',
  'dexModal.dex': '図鑑',
  'dexModal.checklist': 'チェックリスト',
  'dexModal.save': '保存',
  'dexModal.create': '作成',

  'box.allCaught': 'すべて捕獲済み',
  'box.sealed': '確定',

  'searchResults.none': '結果がありません。',
  'searchResults.clearSearch': '検索をクリアしますか？',
  'searchResults.noneUnmarked': '未記録のポケモンに結果がありません。',
  'searchResults.includeMarked': '記録済みも表示しますか？',
  'searchResults.allMarked': '未記録のポケモンはいません。',
  'searchResults.showAll': 'すべてのポケモンを表示しますか？',
  'searchResults.noTemporary': '仮のポケモンはいません。',
  'searchResults.noTemporaryMatching': '検索に一致する仮のポケモンはいません。',
  'searchResults.noneMatching': '条件に一致するポケモンはいません。',
  'searchResults.clearFilters': 'フィルターを解除しますか？',
};

export const translations: Record<Locale, Record<TranslationKey, string>> = { en, ja };

export function translate (locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
  const template = translations[locale][key] ?? translations.en[key] ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
