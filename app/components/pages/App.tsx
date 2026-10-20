import { useEffect, useState, useSyncExternalStore } from 'react';

import { DexContextProvider, useDexContext } from '../../hooks/contexts/use-dex-context';
import { Landing } from './Landing';
import { Nav } from '../library/Nav';
import { ThemePreview } from './ThemePreview';
import { Tracker } from './Tracker';
import { TESTING, useDevScaffolding, useProdPreviewHotkey } from '../../utils/testing';
import { applyDisplay, applyTheme } from '../../palette/apply-theme';
import { isSaveOk, subscribeSaveStatus } from '../../utils/local-data';
import { useLocalStorageContext, useThemeContext } from '../../hooks/contexts/use-local-storage-context';
import { useScrollbarFade } from '../../hooks/use-scrollbar-fade';
import { useTranslation } from '../../hooks/use-translation';

export function App () {
  const { locale } = useLocalStorageContext();
  const { isSoftDark, theme, locationTints, flipTypes } = useThemeContext();

  useScrollbarFade();
  useProdPreviewHotkey();

  // drives CJK font behavior
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    applyTheme(theme, isSoftDark);
  }, [theme, isSoftDark]);

  useEffect(() => {
    applyDisplay(locationTints, flipTypes);
  }, [locationTints, flipTypes]);

  return (
    <div className="root">
      <DexContextProvider>
        <AppContent />
      </DexContextProvider>
    </div>
  );
}

function AppContent () {
  const { dexes, activeDex, loadFailed } = useDexContext();
  const { t } = useTranslation();
  const saveOk = useSyncExternalStore(subscribeSaveStatus, isSaveOk);
  // Electron loads no query string, so the nav button is the way in there; the production preview (Ctrl+Shift+P) shows
  // the app as a production build has it, the theme preview and its button gone
  const [showPreview, setShowPreview] = useState(TESTING && window.location.search.includes('preview'));
  const dev = useDevScaffolding();

  if (showPreview && dev) {
    return (
      <>
        <Nav onTogglePreview={() => setShowPreview(false)} />
        <ThemePreview />
      </>
    );
  }

  let page;
  if (loadFailed) {
    page = <p className="load-failed">{t('app.loadFailed', { import: t('nav.import') })}</p>;
  } else if (dexes === null) {
    page = <div className="loading">{t('app.loading')}</div>;
  } else {
    page = activeDex ? <Tracker /> : <Landing />;
  }

  // the nav is the window's title bar, so it's there before the data loads and when it can't be, offering Import; a
  // failed save stays on screen under it until a save goes through
  return (
    <>
      <Nav onTogglePreview={dev ? () => setShowPreview(true) : undefined} />
      {!saveOk && <p className="save-failed" role="alert">{t('app.saveFailed', { export: t('nav.export') })}</p>}
      {page}
    </>
  );
}
