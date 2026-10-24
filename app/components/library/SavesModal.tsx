import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPencilAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

import { Dropdown } from './Dropdown';
import { ModalShell } from './ModalShell';
import { LANGUAGES, ORIGIN_GAMES, idDigits, nameMaxLength, saveLabel } from '../../utils/capture-fields';
import { gameColor } from '../../utils/game-colors';
import { localizeCaptureLanguage, localizeOriginGame } from '../../i18n/names';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../hooks/use-dismissable';
import { useDragReorder } from '../../hooks/use-drag-reorder';
import { useTranslation } from '../../hooks/use-translation';

import type { CSSProperties } from 'react';

interface Props {
  onRequestClose: () => void;
}

export function SavesModal ({ onRequestClose }: Props) {
  const { dexes, saves, createSave, updateSave, moveSave, deleteSave } = useDexContext();
  const { t, locale } = useTranslation();
  const { closing, dismiss } = useDismissable({ onDismissed: onRequestClose });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  // the game the form is changing, in place of adding one
  const [editId, setEditId] = useState<string | null>(null);

  const [draftGame, setDraftGame] = useState('');
  const [draftLanguage, setDraftLanguage] = useState('');
  const [draftOT, setDraftOT] = useState('');
  const [draftTID, setDraftTID] = useState('');

  const otMax = nameMaxLength(draftLanguage);

  // each game a block in its colour, dragged into its place (or moved a place by Alt+↑/↓)
  const { itemProps } = useDragReorder(saves.length, (from, to) => moveSave(saves[from].id, to - from));

  // what's typed is folded to digits as it goes, except mid-composition (an IME's text can't change under it)
  const tid = idDigits(draftTID);

  // the game/language pair is the mapping key, so it must stay unique, unless every game sharing it has its own ID No.
  // (two files of one game), which tells them apart
  const duplicate = Boolean(draftGame && draftLanguage &&
    saves.some((save) => save.id !== editId && save.game === draftGame && save.language === draftLanguage &&
      (!tid || !save.tid || save.tid === tid)));
  const canAdd = Boolean(draftGame && draftLanguage && draftOT.trim()) && !duplicate;

  const handleLanguageChange = (next: string) => {
    setDraftLanguage(next);
    setDraftOT((prev) => prev.slice(0, nameMaxLength(next)));
  };

  const handleAdd = () => {
    if (!canAdd) {
      return;
    }
    // the ID No. is optional: a game added before it was asked for has none, and can be given one by Edit
    const input = { game: draftGame, language: draftLanguage, ot: draftOT.trim(), tid: tid || undefined };
    if (editId) {
      updateSave(editId, input);
    } else {
      createSave(input);
    }
    setDraftGame('');
    setDraftLanguage('');
    setDraftOT('');
    setDraftTID('');
    setEditId(null);
    setAdding(false);
  };

  // fixing a typo used to mean delete and add again, which left every mon placed in the game without a location
  const handleEdit = (id: string) => {
    const save = saves.find((entry) => entry.id === id);
    if (!save) {
      return;
    }
    setDraftGame(save.game);
    setDraftLanguage(save.language);
    setDraftOT(save.ot);
    setDraftTID(save.tid ?? '');
    setEditId(id);
    setAdding(true);
  };

  const handleDelete = (id: string, label: string) => {
    // a mon "in a game" names the game by id, so deleting it leaves those locations unanswered
    const placed = (dexes ?? []).reduce((count, dex) => count +
      Object.values(dex.progress).filter((entry) => entry.location === 'game' && entry.location_save === id).length, 0);
    if (window.confirm(placed > 0 ? t('saves.deleteConfirmUsed', { label, count: placed }) : t('saves.deleteConfirm', { label }))) {
      deleteSave(id);
      if (editId === id) {
        setEditId(null);
        setAdding(false);
      }
    }
  };

  return (
    <ModalShell closing={closing} contentLabel={t('saves.title')} onDismiss={dismiss} wide>
      <div className="form">
        <h1>{t('saves.title')}</h1>

        {saves.length > 0 &&
          <ul className={editing ? 'saves-list editing' : 'saves-list'}>
            <li className="saves-list-header">
              <span>{t('saves.game')}</span>
              <span>{t('saves.ot')}</span>
              <span>{t('saves.tid')}</span>
            </li>
            {saves.map((save, index) => (
              <li
                {...itemProps(index)}
                aria-roledescription={t('landing.dragHint')}
                className="saves-list-item"
                key={save.id}
                style={{ '--spine': gameColor(save.game) } as CSSProperties}
                tabIndex={0}
              >
                <span aria-hidden="true" className="block-grip" data-drag-handle="" title={t('landing.dragHint')} />
                <div className="saves-list-key">{saveLabel(save, locale)}</div>
                <div className="saves-list-key">{save.ot}</div>
                <div className="saves-list-key saves-list-tid">{save.tid || '—'}</div>
                {editing &&
                  <div className="saves-list-controls">
                    <button
                      aria-label={t('saves.edit')}
                      aria-pressed={editId === save.id}
                      onClick={() => handleEdit(save.id)}
                      title={t('saves.edit')}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faPencilAlt} />
                    </button>
                    <button
                      aria-label={t('saves.delete')}
                      className="saves-delete"
                      onClick={() => handleDelete(save.id, saveLabel(save, locale, saves))}
                      title={t('saves.delete')}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                }
              </li>
            ))}
          </ul>
        }

        {adding &&
          <>
            <div className="saves-add">
              <div className="form-group">
                <label htmlFor="save_game">{t('saves.game')}</label>
                <Dropdown
                  blankLabel={t('common.unspecified')}
                  id="save_game"
                  onSelect={setDraftGame}
                  options={ORIGIN_GAMES.map((game) => ({ value: game.id, label: localizeOriginGame(locale, game.id, game.name) }))}
                  value={draftGame}
                />
              </div>
              <div className="form-group">
                <label htmlFor="save_language">{t('saves.language')}</label>
                <Dropdown
                  blankLabel={t('common.unspecified')}
                  id="save_language"
                  onSelect={handleLanguageChange}
                  options={LANGUAGES.map((language) => ({ value: language.id, label: localizeCaptureLanguage(locale, language.id, language.name) }))}
                  value={draftLanguage}
                />
              </div>
              <div className="form-group">
                <label htmlFor="save_ot">{t('saves.ot')}</label>
                <input
                  className="form-control"
                  id="save_ot"
                  maxLength={otMax}
                  onChange={(e) => setDraftOT(e.target.value)}
                  type="text"
                  value={draftOT}
                />
              </div>
              <div className="form-group saves-tid">
                <label htmlFor="save_tid">{t('saves.tid')}</label>
                <input
                  autoComplete="off"
                  className="form-control"
                  id="save_tid"
                  inputMode="numeric"
                  onChange={(e) => setDraftTID((e.nativeEvent as InputEvent).isComposing ? e.target.value : idDigits(e.target.value))}
                  onCompositionEnd={(e) => setDraftTID(idDigits(e.currentTarget.value))}
                  placeholder={t('saves.tidPlaceholder')}
                  type="text"
                  value={draftTID}
                />
              </div>
            </div>
            {duplicate && <p className="saves-warning">{t('saves.duplicate')}</p>}
          </>
        }

        <button
          className="btn btn-blue btn-compact"
          disabled={adding && !canAdd}
          onClick={() => (adding ? handleAdd() : setAdding(true))}
          type="button"
        >
          <FontAwesomeIcon icon={editId ? faCheck : faPlus} /> {t(editId ? 'saves.save' : 'saves.add')}
        </button>

        {saves.length > 0 &&
          <button className="btn btn-edit-list" onClick={() => setEditing((open) => !open)} type="button">
            {t(editing ? 'landing.doneEditing' : 'landing.editList')}
          </button>
        }
      </div>
    </ModalShell>
  );
}
