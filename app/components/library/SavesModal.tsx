import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

import { Dropdown } from './Dropdown';
import { LANGUAGES, ORIGIN_GAMES, nameMaxLength, saveLabel } from '../../utils/capture-fields';
import { localizeCaptureLanguage, localizeOriginGame } from '../../i18n/names';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../hooks/use-dismissable';
import { useTranslation } from '../../hooks/use-translation';

import type { MouseEvent } from 'react';

interface Props {
  onRequestClose: () => void;
}

export function SavesModal ({ onRequestClose }: Props) {
  const { saves, createSave, moveSave, deleteSave } = useDexContext();
  const { t, locale } = useTranslation();
  const { closing, dismiss } = useDismissable({ onDismissed: onRequestClose });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const [draftGame, setDraftGame] = useState('');
  const [draftLanguage, setDraftLanguage] = useState('');
  const [draftOT, setDraftOT] = useState('');

  const otMax = nameMaxLength(draftLanguage);

  // the game/language pair is the mapping key, so it must stay unique
  const duplicate = Boolean(draftGame && draftLanguage &&
    saves.some((save) => save.game === draftGame && save.language === draftLanguage));
  const canAdd = Boolean(draftGame && draftLanguage && draftOT.trim()) && !duplicate;

  // switching language can tighten the limit under what's already typed
  const handleLanguageChange = (next: string) => {
    setDraftLanguage(next);
    setDraftOT((prev) => prev.slice(0, nameMaxLength(next)));
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      dismiss();
    }
  };

  const handleAdd = () => {
    if (!canAdd) {
      return;
    }
    createSave({ game: draftGame, language: draftLanguage, ot: draftOT.trim() });
    setDraftGame('');
    setDraftLanguage('');
    setDraftOT('');
    setAdding(false);
  };

  const handleDelete = (id: string, label: string) => {
    if (window.confirm(t('saves.deleteConfirm', { label }))) {
      deleteSave(id);
    }
  };

  return (
    <div className={classNames('modal-overlay', { closing })} onClick={handleOverlayClick}>
      <div aria-label={t('saves.title')} className="modal modal-wide" role="dialog">
        <button aria-label={t('popover.close')} className="modal-close" onClick={dismiss} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className="form">
          <h1>{t('saves.title')}</h1>

          {saves.length > 0 &&
            <ul className="saves-list">
              <li className="saves-list-header">
                <span>{t('saves.game')}</span>
                <span>{t('saves.ot')}</span>
              </li>
              {saves.map((save, index) => (
                <li className="saves-list-item" key={save.id}>
                  <div className="saves-list-key">{saveLabel(save, locale)}</div>
                  <div className="saves-list-key">{save.ot}</div>
                  {editing &&
                    <div className="saves-list-controls">
                      <button
                        aria-label={t('landing.moveUp')}
                        disabled={index === 0}
                        onClick={() => moveSave(save.id, -1)}
                        title={t('landing.moveUp')}
                        type="button"
                      >
                        <FontAwesomeIcon icon={faChevronUp} />
                      </button>
                      <button
                        aria-label={t('landing.moveDown')}
                        disabled={index === saves.length - 1}
                        onClick={() => moveSave(save.id, 1)}
                        title={t('landing.moveDown')}
                        type="button"
                      >
                        <FontAwesomeIcon icon={faChevronDown} />
                      </button>
                      <button
                        aria-label={t('saves.delete')}
                        className="saves-delete"
                        onClick={() => handleDelete(save.id, saveLabel(save, locale))}
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
            <FontAwesomeIcon icon={faPlus} /> {t('saves.add')}
          </button>

          {saves.length > 0 &&
            <button className="btn btn-edit-list" onClick={() => setEditing((open) => !open)} type="button">
              {t(editing ? 'landing.doneEditing' : 'landing.editList')}
            </button>
          }
        </div>
      </div>
    </div>
  );
}
