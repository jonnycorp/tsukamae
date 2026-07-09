import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAsterisk, faChevronDown, faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';

import { DEFAULT_CATALOG_KEY, DEX_CATALOG, getCatalogDex } from '../../utils/local-data';
import { localizeCatalogDexName, localizeCatalogGame, localizeDexType } from '../../i18n/names';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../hooks/use-translation';

import type { CatalogDex, PersonalDex } from '../../utils/local-data';
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react';

interface ModalShellProps {
  children: ReactNode;
  contentLabel: string;
  onRequestClose: () => void;
}

// A dependency-free stand-in for the react-modal component the original
// dex-management UI used; reuses the .modal/.modal-overlay styles.
function ModalShell ({ children, contentLabel, onRequestClose }: ModalShellProps) {
  const { isNightMode } = useLocalStorageContext();

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onRequestClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div aria-label={contentLabel} className={`modal ${isNightMode ? 'night-mode' : ''}`} role="dialog">
        {children}
      </div>
    </div>
  );
}

interface Props {
  // When set, the modal edits this existing dex; otherwise it creates one.
  dex?: PersonalDex;
  onRequestClose: () => void;
}

export function DexModal ({ dex, onRequestClose }: Props) {
  const { createDex, updateDex, deleteDex } = useDexContext();
  const { t, locale } = useTranslation();

  const initialCatalog = getCatalogDex(dex?.catalogKey || DEFAULT_CATALOG_KEY);

  const [title, setTitle] = useState(dex?.title || '');
  const [gameId, setGameId] = useState(initialCatalog.game.id);
  const [catalogKey, setCatalogKey] = useState(initialCatalog.key);
  const [shiny, setShiny] = useState(dex?.shiny || false);

  // The catalog grouped by game, newest first (DEX_CATALOG is already in that
  // order). Picking a game filters the Dex options to just that game's dexes —
  // e.g. HOME → Full National / Gigantamax Forms — mirroring the original
  // pokedextracker create-dex flow, where the game is the top-level category.
  const gamesWithDexes = useMemo(() => {
    const groups: { game: CatalogDex['game']; entries: CatalogDex[] }[] = [];
    const byGameId = new Map<string, { game: CatalogDex['game']; entries: CatalogDex[] }>();
    for (const entry of DEX_CATALOG) {
      let group = byGameId.get(entry.game.id);
      if (!group) {
        group = { game: entry.game, entries: [] };
        byGameId.set(entry.game.id, group);
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  }, []);

  const dexesForGame = useMemo(
    () => gamesWithDexes.find((group) => group.game.id === gameId)?.entries || [],
    [gamesWithDexes, gameId],
  );

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);

  const handleGameChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newGameId = e.target.value;
    setGameId(newGameId);
    // Default to the first dex of the newly selected game.
    const firstEntry = gamesWithDexes.find((group) => group.game.id === newGameId)?.entries[0];
    if (firstEntry) {
      setCatalogKey(firstEntry.key);
    }
  };

  const handleCatalogChange = (e: ChangeEvent<HTMLSelectElement>) => setCatalogKey(e.target.value);
  const handleShinyChange = (e: ChangeEvent<HTMLInputElement>) => setShiny(e.target.checked);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // An empty title falls back to the catalog name in the language the user
    // was typing in — titles are user data, saved as-is.
    const resolvedTitle = title.trim() || localizeCatalogDexName(locale, catalogKey, getCatalogDex(catalogKey).name);

    if (dex) {
      updateDex(dex.id, { title: resolvedTitle, shiny });
    } else {
      createDex({ title: resolvedTitle, catalogKey, shiny });
    }
    onRequestClose();
  };

  const handleDeleteClick = () => {
    if (!dex) {
      return;
    }
    // Deleting the open dex (even the only one) drops back to the landing page.
    if (window.confirm(t('dexModal.deleteConfirm', { title: dex.title }))) {
      deleteDex(dex.id);
      onRequestClose();
    }
  };

  return (
    <ModalShell contentLabel={t(dex ? 'dexModal.editTitle' : 'dexModal.createTitle')} onRequestClose={onRequestClose}>
      <div className="form">
        <h1>{t(dex ? 'dexModal.editTitle' : 'dexModal.createTitle')}</h1>
        <form className="form-column" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="dex_title">{t('dexModal.titleLabel')}</label>
            <input
              className="form-control"
              id="dex_title"
              maxLength={300}
              name="dex_title"
              onChange={handleTitleChange}
              placeholder={localizeCatalogDexName(locale, catalogKey, getCatalogDex(catalogKey).name)}
              type="text"
              value={title}
            />
            <FontAwesomeIcon className="input-icon" icon={faAsterisk} />
          </div>
          {dex ?
            <div className="form-group">
              <label>{t('dexModal.dex')}</label>
              <div className="form-note">{t('dexModal.structureNote', { name: localizeCatalogDexName(locale, dex.catalogKey, getCatalogDex(dex.catalogKey).name), total: getCatalogDex(dex.catalogKey).total })}</div>
            </div> :
            <>
              <div className="form-group">
                <label htmlFor="dex_game">{t('dexModal.game')}</label>
                <select
                  className="form-control"
                  id="dex_game"
                  name="dex_game"
                  onChange={handleGameChange}
                  value={gameId}
                >
                  {gamesWithDexes.map((group) => <option key={group.game.id} value={group.game.id}>{localizeCatalogGame(locale, group.game.id, group.game.name)}</option>)}
                </select>
                <FontAwesomeIcon className="input-icon" icon={faChevronDown} />
              </div>
              <div className="form-group">
                <label htmlFor="dex_catalog">{t('dexModal.dex')}</label>
                <select
                  className="form-control"
                  id="dex_catalog"
                  name="dex_catalog"
                  onChange={handleCatalogChange}
                  value={catalogKey}
                >
                  {dexesForGame.map((entry) => <option key={entry.key} value={entry.key}>{localizeDexType(locale, entry.dex_type.name)} ({entry.total})</option>)}
                </select>
                <FontAwesomeIcon className="input-icon" icon={faChevronDown} />
              </div>
            </>
          }
          <div className="form-group">
            <div className="checkbox">
              <label>
                <input
                  checked={shiny}
                  id="shiny"
                  name="shiny"
                  onChange={handleShinyChange}
                  type="checkbox"
                />
                <span className="checkbox-custom"><span /></span>{t('common.shiny')}
              </label>
            </div>
          </div>
          <button className="btn btn-blue" type="submit">
            {t(dex ? 'dexModal.save' : 'dexModal.create')} <FontAwesomeIcon icon={faLongArrowAltRight} />
          </button>
          {dex &&
            <button
              className="btn btn-white"
              onClick={handleDeleteClick}
              type="button"
            >
              {t('dexModal.delete')}
            </button>
          }
        </form>
      </div>
      <p><a className="link back-link" onClick={onRequestClose}>{t('dexModal.goBack')}</a></p>
    </ModalShell>
  );
}
