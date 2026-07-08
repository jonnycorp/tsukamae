import throttle from 'lodash/throttle';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DEX } from '../../../utils/local-data';
import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { Info } from './Info';
import { Nav } from '../../library/Nav';
import { SCROLL_DEBOUNCE, SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SearchBar } from './SearchBar';
import { TrackerContextProvider, useTrackerContext } from './use-tracker';
import { useCaptures } from '../../../hooks/queries/captures';

// To enable the inner component to access the context value, it needs to be nested under the provider, so we need this
// wrapper component to add that nesting.
export function Tracker () {
  return (
    <TrackerContextProvider>
      <TrackerInner />
    </TrackerContextProvider>
  );
}

export function TrackerInner () {
  const trackerRef = useRef<HTMLDivElement>(null);

  const { setCaptures } = useTrackerContext();

  const { data: storedCaptures, isLoading: capturesIsLoading } = useCaptures();

  const [query, setQuery] = useState('');
  const [hideCaught, setHideCaught] = useState(false);
  const [temporaryOnly, setTemporaryOnly] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);

  useEffect(() => {
    document.title = `${DEX.title} | Pokédex Tracker`;
  }, []);

  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.scrollTop = 0;
    }
  }, [query]);

  useEffect(() => {
    if (storedCaptures) {
      setCaptures(storedCaptures);
      setSelectedPokemon(storedCaptures[0].pokemon.id);
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

  if (capturesIsLoading || !selectedPokemon) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="tracker-container">
      <Nav />
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
