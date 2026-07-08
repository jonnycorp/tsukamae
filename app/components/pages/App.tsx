import { Tracker } from './Tracker';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';

export function App () {
  const { isNightMode } = useLocalStorageContext();

  return (
    <div className={`root ${isNightMode ? 'night-mode' : ''}`}>
      <Tracker />
    </div>
  );
}
