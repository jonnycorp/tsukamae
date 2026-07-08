import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faPencilAlt, faPlus, faSun } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

import { DexModal } from './DexModal';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';

import type { ChangeEvent } from 'react';

export function Nav () {
  const { isNightMode, setIsNightMode } = useLocalStorageContext();
  const { dexes, activeDex, setActiveDex } = useDexContext();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const handleNightModeClick = () => setIsNightMode(!isNightMode);
  const handleDexChange = (e: ChangeEvent<HTMLSelectElement>) => setActiveDex(e.target.value);
  const handleNewDexClick = () => setShowCreate(true);
  const handleEditDexClick = () => setShowEdit(true);
  const handleCreateClose = () => setShowCreate(false);
  const handleEditClose = () => setShowEdit(false);

  return (
    <nav>
      <a>Tsukamae</a>
      <select className="nav-dex-select" onChange={handleDexChange} value={activeDex!.id}>
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
      <a className="tooltip tooltip-below" onClick={handleNightModeClick}>
        <FontAwesomeIcon icon={isNightMode ? faSun : faMoon} />
        <span className="tooltip-text">Night Mode {isNightMode ? 'Off' : 'On'}</span>
      </a>
      {showCreate && <DexModal onRequestClose={handleCreateClose} />}
      {showEdit && activeDex && <DexModal dex={activeDex} onRequestClose={handleEditClose} />}
    </nav>
  );
}
