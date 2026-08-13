import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faFileExport, faFileImport, faGamepad, faGear, faLanguage, faMoon, faPalette, faPencilAlt, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { DexModal } from './DexModal';
import { Dropdown } from './Dropdown';
import { SavesModal } from './SavesModal';
import { PALETTE_PRESETS, PRESET_DOT_BASES } from '../../palette/tokens';
import { exportAppState, importAppState } from '../../utils/local-data';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../hooks/use-translation';

import type { ChangeEvent, RefObject } from 'react';

// closes a nav popover on any outside click
function useOutsideClickClose (open: boolean, ref: RefObject<HTMLDivElement>, close: () => void) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);
}

export function Nav () {
  const { isSoftDark, setIsSoftDark, theme, setTheme, locale, setLocale } = useLocalStorageContext();
  const { dexes, activeDex, setActiveDex } = useDexContext();
  const { t } = useTranslation();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSaves, setShowSaves] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useOutsideClickClose(showDataMenu, dataMenuRef, () => setShowDataMenu(false));
  useOutsideClickClose(showThemeMenu, themeMenuRef, () => setShowThemeMenu(false));

  const handleLanguageToggle = () => setLocale(locale === 'en' ? 'ja' : 'en');
  // the logo returns to the landing page
  const handleLogoClick = () => setActiveDex('');
  const handleNewDexClick = () => setShowCreate(true);
  const handleEditDexClick = () => setShowEdit(true);
  const handleCreateClose = () => setShowCreate(false);
  const handleEditClose = () => setShowEdit(false);

  const handleExportClick = () => {
    const blob = new Blob([exportAppState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tsukamae-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowDataMenu(false);
  };

  const handleImportClick = () => {
    setShowDataMenu(false);
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (!file) {
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      window.alert(t('nav.importInvalidJson'));
      return;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      window.alert(t('nav.importNotExport'));
      return;
    }

    if (!window.confirm(t('nav.importConfirm'))) {
      return;
    }

    await importAppState(raw);
    window.location.reload();
  };

  return (
    <nav className={classNames({ 'dropdown-open': showDataMenu || showThemeMenu })}>
      <a className="nav-logo" onClick={handleLogoClick}>{t('app.name')}</a>
      {activeDex &&
        <div className="nav-dex-controls">
          <Dropdown
            id="nav_dex"
            onSelect={setActiveDex}
            options={dexes!.map((dex) => ({ value: dex.id, label: dex.title }))}
            triggerClassName="nav-dex-select"
            value={activeDex.id}
          />
          <a className="nav-icon tooltip tooltip-below" onClick={handleEditDexClick}>
            <FontAwesomeIcon icon={faPencilAlt} />
            <span className="tooltip-text">{t('nav.editDex')}</span>
          </a>
          <a className="nav-icon tooltip tooltip-below" onClick={handleNewDexClick}>
            <FontAwesomeIcon icon={faPlus} />
            <span className="tooltip-text">{t('nav.newDex')}</span>
          </a>
        </div>
      }
      <div className="nav-menu" ref={dataMenuRef}>
        <a className="nav-icon nav-menu-toggle" onClick={() => setShowDataMenu((open) => !open)}>
          <FontAwesomeIcon icon={faGear} />
        </a>
        {showDataMenu &&
          <ul className="nav-menu-dropdown">
            <li onClick={handleExportClick}><FontAwesomeIcon icon={faFileExport} /> {t('nav.export')}</li>
            <li onClick={handleImportClick}><FontAwesomeIcon icon={faFileImport} /> {t('nav.import')}</li>
          </ul>
        }
      </div>
      <a className="nav-icon tooltip tooltip-below" onClick={() => setShowSaves(true)}>
        <FontAwesomeIcon icon={faGamepad} />
        <span className="tooltip-text">{t('nav.saves')}</span>
      </a>
      <input
        accept="application/json,.json"
        onChange={handleImportFile}
        ref={importInputRef}
        style={{ display: 'none' }}
        type="file"
      />
      <a className="nav-icon tooltip tooltip-below" onClick={handleLanguageToggle}>
        <FontAwesomeIcon icon={faLanguage} />
        <span className="tooltip-text">{locale === 'en' ? '日本語' : 'English'}</span>
      </a>
      <div className="nav-menu" ref={themeMenuRef}>
        <a className="nav-icon tooltip tooltip-below" onClick={() => setShowThemeMenu((open) => !open)}>
          <FontAwesomeIcon icon={faPalette} />
          {!showThemeMenu && <span className="tooltip-text">{t('nav.theme')}</span>}
        </a>
        {showThemeMenu &&
          <ul className="nav-menu-dropdown theme-popover">
            {Object.entries(PALETTE_PRESETS).map(([name, preset]) => (
              <li className={name === theme ? 'theme-active' : ''} key={name} onClick={() => setTheme(name)}>
                <span className="theme-dots">
                  {PRESET_DOT_BASES.map((base) => <span className="theme-dot" key={base} style={{ backgroundColor: preset[base] }} />)}
                </span>
                {name}
                {name === theme && <FontAwesomeIcon className="theme-check" icon={faCheck} />}
              </li>
            ))}
            <li className={`theme-soft-dark ${isSoftDark ? 'theme-active' : ''}`} onClick={() => setIsSoftDark(!isSoftDark)}>
              <FontAwesomeIcon icon={faMoon} />
              {t('nav.softDark')}
              {isSoftDark && <FontAwesomeIcon className="theme-check" icon={faCheck} />}
            </li>
          </ul>
        }
      </div>
      {showCreate && <DexModal onRequestClose={handleCreateClose} />}
      {showEdit && activeDex && <DexModal dex={activeDex} onRequestClose={handleEditClose} />}
      {showSaves && <SavesModal onRequestClose={() => setShowSaves(false)} />}
    </nav>
  );
}
