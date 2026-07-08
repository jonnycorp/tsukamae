import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAsterisk, faChevronDown, faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';

import { DEFAULT_CATALOG_KEY, DEX_CATALOG, getCatalogDex } from '../../utils/local-data';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';

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
  const { dexes, createDex, updateDex, deleteDex } = useDexContext();

  const [title, setTitle] = useState(dex?.title || '');
  const [catalogKey, setCatalogKey] = useState(dex?.catalogKey || DEFAULT_CATALOG_KEY);
  const [shiny, setShiny] = useState(dex?.shiny || false);

  // The picker lists the catalog grouped by generation, newest first
  // (DEX_CATALOG is already in that order).
  const catalogByGeneration = useMemo(() => {
    const groups: { generation: number; entries: CatalogDex[] }[] = [];
    for (const entry of DEX_CATALOG) {
      const generation = entry.game.game_family.generation;
      const group = groups[groups.length - 1];
      if (group && group.generation === generation) {
        group.entries.push(entry);
      } else {
        groups.push({ generation, entries: [entry] });
      }
    }
    return groups;
  }, []);

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);
  const handleCatalogChange = (e: ChangeEvent<HTMLSelectElement>) => setCatalogKey(e.target.value);
  const handleShinyChange = (e: ChangeEvent<HTMLInputElement>) => setShiny(e.target.checked);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const resolvedTitle = title.trim() || getCatalogDex(catalogKey).name;

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
    if (window.confirm(`Delete "${dex.title}" and ALL of its progress? This cannot be undone.`)) {
      deleteDex(dex.id);
      onRequestClose();
    }
  };

  const isOnlyDex = (dexes?.length || 0) <= 1;

  return (
    <ModalShell contentLabel={dex ? 'Edit Dex' : 'Create a New Dex'} onRequestClose={onRequestClose}>
      <div className="form">
        <h1>{dex ? 'Edit Dex' : 'Create New Dex'}</h1>
        <form className="form-column" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="dex_title">Title</label>
            <input
              className="form-control"
              id="dex_title"
              maxLength={300}
              name="dex_title"
              onChange={handleTitleChange}
              placeholder={getCatalogDex(catalogKey).name}
              type="text"
              value={title}
            />
            <FontAwesomeIcon className="input-icon" icon={faAsterisk} />
          </div>
          {dex ?
            <div className="form-group">
              <label>Dex</label>
              <div className="form-note">{getCatalogDex(dex.catalogKey).name} ({getCatalogDex(dex.catalogKey).total} Pokémon) — the dex structure can&apos;t be changed after creation.</div>
            </div> :
            <div className="form-group">
              <label htmlFor="dex_catalog">Dex</label>
              <select
                className="form-control"
                id="dex_catalog"
                name="dex_catalog"
                onChange={handleCatalogChange}
                value={catalogKey}
              >
                {catalogByGeneration.map((group) => (
                  <optgroup key={group.generation} label={`Generation ${group.generation}`}>
                    {group.entries.map((entry) => <option key={entry.key} value={entry.key}>{entry.name} ({entry.total})</option>)}
                  </optgroup>
                ))}
              </select>
              <FontAwesomeIcon className="input-icon" icon={faChevronDown} />
            </div>
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
                <span className="checkbox-custom"><span /></span>Shiny
              </label>
            </div>
          </div>
          <button className="btn btn-blue" type="submit">
            {dex ? 'Save' : 'Create'} <FontAwesomeIcon icon={faLongArrowAltRight} />
          </button>
          {dex &&
            <button
              className="btn btn-white"
              disabled={isOnlyDex}
              onClick={handleDeleteClick}
              title={isOnlyDex ? 'The tracker always needs at least one dex.' : undefined}
              type="button"
            >
              Delete Dex
            </button>
          }
        </form>
      </div>
      <p><a className="link" onClick={onRequestClose}>Go Back</a></p>
    </ModalShell>
  );
}
