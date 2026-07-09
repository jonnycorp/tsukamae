import { useEffect } from 'react';

import { DexContextProvider, useDexContext } from '../../hooks/contexts/use-dex-context';
import { Landing } from './Landing';
import { Nav } from '../library/Nav';
import { Tracker } from './Tracker';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';

export function App () {
  const { isNightMode, locale } = useLocalStorageContext();

  // Tell the renderer which language the UI is in, so it applies the right
  // font behavior for CJK text.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className={`root ${isNightMode ? 'night-mode' : ''}`}>
      <DexContextProvider>
        <AppContent />
      </DexContextProvider>
    </div>
  );
}

// The nav is shared across views; the body is the open dex's tracker, or the
// landing page (dex list) when no dex is open (activeDexId '').
function AppContent () {
  const { dexes, activeDex } = useDexContext();

  // dexes is null until the persisted state has loaded.
  if (dexes === null) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Nav />
      {activeDex ? <Tracker /> : <Landing />}
    </>
  );
}
