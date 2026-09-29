import { useEffect, useState } from 'react';

import { DexContextProvider, useDexContext } from '../../hooks/contexts/use-dex-context';
import { Landing } from './Landing';
import { Nav } from '../library/Nav';
import { ThemePreview } from './ThemePreview';
import { Tracker } from './Tracker';
import { TESTING } from '../../utils/testing';
import { applyTheme } from '../../palette/apply-theme';
import { useLocalStorageContext, useThemeContext } from '../../hooks/contexts/use-local-storage-context';
import { useScrollbarFade } from '../../hooks/use-scrollbar-fade';

export function App () {
  const { locale } = useLocalStorageContext();
  const { isSoftDark, theme } = useThemeContext();

  useScrollbarFade();

  // drives CJK font behavior
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    applyTheme(theme, isSoftDark);
  }, [theme, isSoftDark]);

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
  const [showPreview, setShowPreview] = useState(TESTING && window.location.search.includes('preview'));

  if (showPreview) {
    return (
      <>
        <Nav onTogglePreview={() => setShowPreview(false)} />
        <ThemePreview />
      </>
    );
  }

  if (dexes === null) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Nav onTogglePreview={TESTING ? () => setShowPreview(true) : undefined} />
      {activeDex ? <Tracker /> : <Landing />}
    </>
  );
}
