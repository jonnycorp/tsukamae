import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport, faFileImport, faGear, faMoon, faPencilAlt, faPlus, faSun, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { DexModal } from './DexModal';
import { exportAppState, importAppState } from '../../utils/local-data';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';

import type { ChangeEvent } from 'react';

export function Nav () {
  const { isNightMode, setIsNightMode } = useLocalStorageContext();
  const { dexes, activeDex, setActiveDex } = useDexContext();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);

  const [showDataMenu, setShowDataMenu] = useState(false);

  // Close the data menu when clicking anywhere outside it.
  useEffect(() => {
    if (!showDataMenu) {
      return;
    }
    const handleOutsideClick = (e: MouseEvent) => {
      if (dataMenuRef.current && !dataMenuRef.current.contains(e.target as Node)) {
        setShowDataMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDataMenu]);

  const handleNightModeClick = () => setIsNightMode(!isNightMode);
  // The logo returns to the landing page (no dex open).
  const handleLogoClick = () => setActiveDex('');
  const handleDexChange = (e: ChangeEvent<HTMLSelectElement>) => setActiveDex(e.target.value);
  const handleNewDexClick = () => setShowCreate(true);
  const handleEditDexClick = () => setShowEdit(true);
  const handleCreateClose = () => setShowCreate(false);
  const handleEditClose = () => setShowEdit(false);

  // Export downloads the whole tracker as JSON. In the browser this uses the
  // normal download flow; in the Electron build Chromium shows a native "Save
  // As" dialog, so it lands wherever you choose.
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

  // Placeholder: wiping every dex needs the landing page to fall back to, and
  // deleteDex currently refuses to remove the last dex. Wire this up once the
  // landing page exists.
  const handleWipeClick = () => {
    setShowDataMenu(false);
    window.alert('Wipe Data is coming with the landing page.');
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
      window.alert('That file isn\'t valid JSON.');
      return;
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      window.alert('That file doesn\'t look like a Tsukamae progress export.');
      return;
    }

    if (!window.confirm('Importing will REPLACE all current dexes and progress. Continue?')) {
      return;
    }

    await importAppState(raw);
    window.location.reload();
  };

  return (
    <nav>
      <a className="nav-logo" onClick={handleLogoClick}>Tsukamae</a>
      {activeDex &&
        <div className="nav-dex-controls">
          <select className="nav-dex-select" onChange={handleDexChange} value={activeDex.id}>
            {dexes!.map((dex) => <option key={dex.id} value={dex.id}>{dex.title}</option>)}
          </select>
          <a className="tooltip tooltip-below" onClick={handleEditDexClick}>
            <FontAwesomeIcon icon={faPencilAlt} />
            <span className="tooltip-text">Edit Dex</span>
          </a>
          <a className="tooltip tooltip-below" onClick={handleNewDexClick}>
            <FontAwesomeIcon icon={faPlus} />
            <span className="tooltip-text">New Dex</span>
          </a>
        </div>
      }
      <div className="nav-menu" ref={dataMenuRef}>
        <a className="nav-menu-toggle" onClick={() => setShowDataMenu((open) => !open)}>
          <FontAwesomeIcon icon={faGear} />
        </a>
        {showDataMenu &&
          <ul className="nav-menu-dropdown">
            <li onClick={handleExportClick}><FontAwesomeIcon icon={faFileExport} /> Export Progress</li>
            <li onClick={handleImportClick}><FontAwesomeIcon icon={faFileImport} /> Import Progress</li>
            <li className="nav-menu-danger" onClick={handleWipeClick}><FontAwesomeIcon icon={faTrash} /> Wipe Data</li>
          </ul>
        }
      </div>
      <input
        accept="application/json,.json"
        onChange={handleImportFile}
        ref={importInputRef}
        style={{ display: 'none' }}
        type="file"
      />
      <a className="tooltip tooltip-below" onClick={handleNightModeClick}>
        <FontAwesomeIcon icon={isNightMode ? faSun : faMoon} />
        <span className="tooltip-text">Night Mode {isNightMode ? 'Off' : 'On'}</span>
      </a>
      {showCreate && <DexModal onRequestClose={handleCreateClose} />}
      {showEdit && activeDex && <DexModal dex={activeDex} onRequestClose={handleEditClose} />}
    </nav>
  );
}
