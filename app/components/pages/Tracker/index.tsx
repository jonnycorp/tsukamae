import throttle from 'lodash/throttle';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { PokemonPopover } from './PokemonPopover';
import { SCROLL_DEBOUNCE, SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SearchBar } from './SearchBar';
import { TrackerContextProvider, useTrackerContext } from './use-tracker';
import { useCaptures } from '../../../hooks/queries/captures';
import { useTranslation } from '../../../hooks/use-translation';

export function Tracker () {
  return <TrackerLoader />;
}

// Keying by the active dex remounts the whole tracker on a dex switch, so
// per-dex UI state (captures, search query, filters, selected mon) resets
// cleanly instead of carrying over from the previous dex.
function TrackerLoader () {
  const { activeDex } = useDexContext();

  if (!activeDex) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <TrackerContextProvider key={activeDex.id}>
      <TrackerInner />
    </TrackerContextProvider>
  );
}

export function TrackerInner () {
  const trackerRef = useRef<HTMLDivElement>(null);

  const { activeDex } = useDexContext();
  const { captures, setCaptures } = useTrackerContext();
  const { t } = useTranslation();

  const { data: storedCaptures, isLoading: capturesIsLoading } = useCaptures(activeDex!.id);

  const [query, setQuery] = useState('');
  const [hideCaught, setHideCaught] = useState(false);
  const [temporaryOnly, setTemporaryOnly] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);

  useEffect(() => {
    document.title = `${activeDex!.title} | ${t('app.name')}`;
  }, [activeDex!.title, t]);

  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.scrollTop = 0;
    }
  }, [query]);

  useEffect(() => {
    if (storedCaptures) {
      setCaptures(storedCaptures);
    }
  }, [storedCaptures]);

  const handleScroll = throttle(() => {
    if (!showScroll && trackerRef.current && trackerRef.current.scrollTop >= SHOW_SCROLL_THRESHOLD) {
      setShowScroll(true);
    } else if (showScroll && trackerRef.current && trackerRef.current.scrollTop < SHOW_SCROLL_THRESHOLD) {
      setShowScroll(false);
    }
  }, SCROLL_DEBOUNCE);

  const handleScrollButtonClick = useCallback(() => {
    // Animated, not a teleport — Chromium's smooth scroll is distance-capped,
    // so even a long dex gets back up in well under a second.
    trackerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Wait until the captures list is populated (via the effect above). Nothing
  // is selected on load, so no popover shows until a mon is clicked.
  if (capturesIsLoading || captures.length === 0) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="tracker-container">
      <div className="tracker">
        <div className="dex-wrapper">
          <SearchBar
            hideCaught={hideCaught}
            query={query}
            setHideCaught={setHideCaught}
            setQuery={setQuery}
            setTemporaryOnly={setTemporaryOnly}
            temporaryOnly={temporaryOnly}
          />
          <div className="dex-column" onScroll={handleScroll} ref={trackerRef}>
            <Dex
              hideCaught={hideCaught}
              onScrollButtonClick={handleScrollButtonClick}
              query={query}
              setHideCaught={setHideCaught}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
              setTemporaryOnly={setTemporaryOnly}
              showScrollButton={showScroll}
              temporaryOnly={temporaryOnly}
            />
            <Footer />
          </div>
        </div>
        {selectedPokemon !== 0 &&
          // Keyed so moving to another mon remounts with fresh position and
          // dismiss state instead of mutating the open one.
          <PokemonPopover
            key={selectedPokemon}
            onClose={() => setSelectedPokemon(0)}
            selectedPokemon={selectedPokemon}
          />
        }
      </div>
    </div>
  );
}
