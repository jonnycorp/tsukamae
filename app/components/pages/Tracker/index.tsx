import throttle from 'lodash/throttle';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { Info } from './Info';
import { SCROLL_DEBOUNCE, SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SearchBar } from './SearchBar';
import { TrackerContextProvider, useTrackerContext } from './use-tracker';
import { useCaptures } from '../../../hooks/queries/captures';

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

  const { data: storedCaptures, isLoading: capturesIsLoading } = useCaptures(activeDex!.id);

  const [query, setQuery] = useState('');
  const [hideCaught, setHideCaught] = useState(false);
  const [temporaryOnly, setTemporaryOnly] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);

  useEffect(() => {
    document.title = `${activeDex!.title} | Tsukamae`;
  }, [activeDex!.title]);

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
    if (trackerRef.current) {
      trackerRef.current.scrollTop = 0;
    }
  }, [trackerRef.current]);

  // Wait until the captures list is populated (via the effect above). Nothing
  // is selected on load, so the info panel stays closed until a mon is clicked.
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
        <Info selectedPokemon={selectedPokemon} setSelectedPokemon={setSelectedPokemon} />
      </div>
    </div>
  );
}
