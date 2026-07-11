import { useEffect } from 'react';

import { DexContextProvider, useDexContext } from '../../hooks/contexts/use-dex-context';
import { Landing } from './Landing';
import { Nav } from '../library/Nav';
import { Palette } from './Palette';
import { Tracker } from './Tracker';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { usePaletteBroadcastReceiver } from '../../palette/use-palette-broadcast';
import { useScrollbarFade } from '../../hooks/use-scrollbar-fade';

export function App () {
  const { isNightMode, locale } = useLocalStorageContext();

  useScrollbarFade();
  // Follows live color picks from a ?palette=1 tab (dev aid; inert otherwise).
  usePaletteBroadcastReceiver();

  // <html lang> drives CJK font behavior.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Mode class mirrored onto <html> (document surface + native UI); .soft-dark is the surfaces-and-text-only prototype.
  useEffect(() => {
    document.documentElement.classList.toggle('soft-dark', isNightMode);
  }, [isNightMode]);

  return (
    <div className={`root ${isNightMode ? 'soft-dark' : ''}`}>
      <DexContextProvider>
        <AppContent />
      </DexContextProvider>
    </div>
  );
}

// Nav is shared; the body is the open dex's tracker or the landing page.
function AppContent () {
  const { dexes, activeDex } = useDexContext();

  // Palette workbench gate; the nav comes along for its mode toggle.
  if (window.location.search.includes('palette')) {
    return (
      <>
        <Nav />
        <Palette />
      </>
    );
  }

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
