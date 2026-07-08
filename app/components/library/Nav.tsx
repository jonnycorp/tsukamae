import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';

export function Nav () {
  const { isNightMode, setIsNightMode } = useLocalStorageContext();

  const handleNightModeClick = () => setIsNightMode(!isNightMode);

  return (
    <nav>
      <a>Tsukamae</a>
      <a className="tooltip tooltip-below" onClick={handleNightModeClick}>
        <FontAwesomeIcon icon={isNightMode ? faSun : faMoon} />
        <span className="tooltip-text">Night Mode {isNightMode ? 'Off' : 'On'}</span>
      </a>
    </nav>
  );
}
