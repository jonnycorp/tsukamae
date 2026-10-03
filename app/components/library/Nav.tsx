import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faFileExport, faFileImport, faFlask, faGamepad, faGear, faLanguage, faMoon, faPalette, faPencilAlt, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { DexModal } from './DexModal';
import { Dropdown } from './Dropdown';
import { SavesModal } from './SavesModal';
import { THEMES, themePalette } from '../../palette/themes';
import { exportAppState, importAppState, isAppState } from '../../utils/local-data';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useLocalStorageContext, useThemeContext } from '../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../hooks/use-translation';

import type { ChangeEvent, RefObject } from 'react';
import type { PersonalDex } from '../../utils/local-data';

// closes on a press outside, or on an Escape nothing else has claimed, as the Filters panel and the dropdowns do
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        close();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);
}

interface Props {
  onTogglePreview?: () => void;
}

const THEME_DOTS = ['chrome', 'accent', 'status-unobtainable', 'status-temporary', 'status-caught'];

export function Nav ({ onTogglePreview }: Props) {
  const { locale, setLocale } = useLocalStorageContext();
  const { isSoftDark, setIsSoftDark, theme, setTheme } = useThemeContext();
  const { dexes, activeDex, setActiveDex } = useDexContext();
  const { t } = useTranslation();
  // before the data loads, or when it can't be, there's nothing to export or edit, but Import can still restore an export
  const loaded = dexes !== null;

  const [showCreate, setShowCreate] = useState(false);
  // the dex Edit Dex opened for, so a save can only ever write to that one
  const [editing, setEditing] = useState<PersonalDex | null>(null);
  const [showSaves, setShowSaves] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const [showDataMenu, setShowDataMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useOutsideClickClose(showDataMenu, dataMenuRef, () => setShowDataMenu(false));
  useOutsideClickClose(showThemeMenu, themeMenuRef, () => setShowThemeMenu(false));

  const handleLanguageToggle = () => setLocale(locale === 'en' ? 'ja' : 'en');
  const handleLogoClick = () => setActiveDex('');
  const handleNewDexClick = () => setShowCreate(true);
  const handleEditDexClick = () => setEditing(activeDex);
  const handleCreateClose = () => setShowCreate(false);
  const handleEditClose = () => setEditing(null);

  const handleExportClick = () => {
    const blob = new Blob([exportAppState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // today where the user is: toISOString's UTC date is tomorrow's by evening in the Americas
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.download = `tsukamae-progress-${today}.json`;
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
    // re-picking the same file must still fire onChange
    e.target.value = '';
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

    if (!isAppState(raw)) {
      window.alert(t('nav.importNotExport'));
      return;
    }

    if (!window.confirm(t('nav.importConfirm'))) {
      return;
    }

    try {
      await importAppState(raw);
    } catch {
      window.alert(t('nav.importFailed'));
      return;
    }
    window.location.reload();
  };

  return (
    <nav className={classNames('titlebar', { 'dropdown-open': showDataMenu || showThemeMenu })}>
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
          <a className="nav-icon tooltip" onClick={handleEditDexClick}>
            <FontAwesomeIcon icon={faPencilAlt} />
            <span className="tooltip-text">{t('nav.editDex')}</span>
          </a>
          <a className="nav-icon tooltip" onClick={handleNewDexClick}>
            <FontAwesomeIcon icon={faPlus} />
            <span className="tooltip-text">{t('nav.newDex')}</span>
          </a>
        </div>
      }
      <div className="nav-menu" ref={dataMenuRef}>
        <a className="nav-icon tooltip" onClick={() => setShowDataMenu((open) => !open)}>
          <FontAwesomeIcon icon={faGear} />
          {!showDataMenu && <span className="tooltip-text">{t('nav.data')}</span>}
        </a>
        {showDataMenu &&
          <ul className="nav-menu-dropdown">
            {loaded && <li onClick={handleExportClick}><FontAwesomeIcon icon={faFileExport} /> {t('nav.export')}</li>}
            <li onClick={handleImportClick}><FontAwesomeIcon icon={faFileImport} /> {t('nav.import')}</li>
          </ul>
        }
      </div>
      {loaded &&
        <a className="nav-icon tooltip" onClick={() => setShowSaves(true)}>
          <FontAwesomeIcon icon={faGamepad} />
          <span className="tooltip-text">{t('nav.saves')}</span>
        </a>
      }
      <input
        accept="application/json,.json"
        onChange={handleImportFile}
        ref={importInputRef}
        style={{ display: 'none' }}
        type="file"
      />
      <a className="nav-icon tooltip" onClick={handleLanguageToggle}>
        <FontAwesomeIcon icon={faLanguage} />
        <span className="tooltip-text">{locale === 'en' ? '日本語' : 'English'}</span>
      </a>
      {onTogglePreview &&
        <a className="nav-icon tooltip" onClick={onTogglePreview}>
          <FontAwesomeIcon icon={faFlask} />
          <span className="tooltip-text">Theme Preview</span>
        </a>
      }
      <div className="nav-menu" ref={themeMenuRef}>
        <a className="nav-icon tooltip" onClick={() => setShowThemeMenu((open) => !open)}>
          <FontAwesomeIcon icon={faPalette} />
          {!showThemeMenu && <span className="tooltip-text">{t('nav.theme')}</span>}
        </a>
        {showThemeMenu &&
          <ul className="nav-menu-dropdown theme-popover">
            {THEMES.map((seed) => (
              <li className={seed.name === theme ? 'theme-active' : ''} key={seed.name} onClick={() => setTheme(seed.name)}>
                <span className="theme-dots">
                  {THEME_DOTS.map((token) => (
                    <span className="theme-dot" key={token} style={{ backgroundColor: themePalette(seed, isSoftDark ? 'dark' : 'light')[token] }} />
                  ))}
                </span>
                {seed.name}
                {seed.name === theme && <FontAwesomeIcon className="theme-check" icon={faCheck} />}
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
      {editing && <DexModal dex={editing} onRequestClose={handleEditClose} />}
      {showSaves && <SavesModal onRequestClose={() => setShowSaves(false)} />}
    </nav>
  );
}
