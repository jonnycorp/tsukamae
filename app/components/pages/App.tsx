import { useEffect, useState } from 'react';

import { DexContextProvider, useDexContext } from '../../hooks/contexts/use-dex-context';
import { Landing } from './Landing';
import { Nav } from '../library/Nav';
import { Palette } from './Palette';
import { Tracker } from './Tracker';
import { TESTING } from '../../utils/testing';
import { applyTheme } from '../../palette/apply-theme';
import { useLocalStorageContext, useThemeContext } from '../../hooks/contexts/use-local-storage-context';
import { usePaletteBroadcastReceiver } from '../../palette/use-palette-broadcast';
import { useScrollbarFade } from '../../hooks/use-scrollbar-fade';

export function App () {
  const { locale } = useLocalStorageContext();
  const { isSoftDark, theme } = useThemeContext();

  useScrollbarFade();
  usePaletteBroadcastReceiver(theme);

  // drives CJK font behavior
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // on <html> so the document surface and native controls flip too
  useEffect(() => {
    document.documentElement.classList.toggle('soft-dark', isSoftDark);
  }, [isSoftDark]);

  return (
    <div className="root">
      <DexContextProvider>
        <AppContent />
      </DexContextProvider>
    </div>
  );
}

function AppContent () {
  const { dexes, activeDex } = useDexContext();
  // Electron loads no query string, so the nav button is the way in there
  const [showPalette, setShowPalette] = useState(TESTING && window.location.search.includes('palette'));

  if (showPalette) {
    return (
      <>
        <Nav onTogglePalette={() => setShowPalette(false)} />
        <Palette />
      </>
    );
  }

  if (dexes === null) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Nav onTogglePalette={TESTING ? () => setShowPalette(true) : undefined} />
      {activeDex ? <Tracker /> : <Landing />}
    </>
  );
}
