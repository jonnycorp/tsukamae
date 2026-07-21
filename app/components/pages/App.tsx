import { useEffect } from 'react';

import { DexContextProvider, useDexContext } from '../../hooks/contexts/use-dex-context';
import { Landing } from './Landing';
import { Nav } from '../library/Nav';
import { Palette } from './Palette';
import { Tracker } from './Tracker';
import { applyTheme } from '../../palette/apply-theme';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { usePaletteBroadcastReceiver } from '../../palette/use-palette-broadcast';
import { useScrollbarFade } from '../../hooks/use-scrollbar-fade';

export function App () {
  const { isSoftDark, locale, theme } = useLocalStorageContext();

  useScrollbarFade();
  // Follows live color picks from a ?palette=1 tab (dev aid; inert otherwise).
  usePaletteBroadcastReceiver(theme);

  // <html lang> drives CJK font behavior.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Mode class mirrored onto <html> (document surface + native UI); soft dark only flips surfaces + text.
  useEffect(() => {
    document.documentElement.classList.toggle('soft-dark', isSoftDark);
  }, [isSoftDark]);

  return (
    <div className={`root ${isSoftDark ? 'soft-dark' : ''}`}>
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
