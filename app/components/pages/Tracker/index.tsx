import { useCallback, useEffect, useRef, useState } from 'react';

import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { PokemonPopover } from './PokemonPopover';
import { SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SearchBar } from './SearchBar';
import { EMPTY_FILTERS } from './filters';
import { TrackerContextProvider } from './use-tracker';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useFlipClock } from './use-flip-clock';
import { useTranslation } from '../../../hooks/use-translation';

import type { AnimationEvent } from 'react';

export function Tracker () {
  const { activeDex } = useDexContext();

  return (
    <TrackerContextProvider key={activeDex!.id}>
      <TrackerInner />
    </TrackerContextProvider>
  );
}

// a CSS animation starts when its element is first styled, which content-visibility delays until scroll-in
function syncShine (e: AnimationEvent<HTMLDivElement>) {
  if (e.animationName !== 'seal-shine') {
    return;
  }
  for (const animation of (e.target as HTMLElement).getAnimations()) {
    animation.startTime = 0;
  }
}

function TrackerInner () {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<HTMLDivElement>(null);

  const { activeDex } = useDexContext();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);

  useFlipClock(containerRef);

  useEffect(() => {
    const previous = document.title;
    document.title = `${activeDex!.title} | ${t('app.name')}`;
    return () => {
      document.title = previous;
    };
  }, [activeDex!.title, t]);

  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.scrollTop = 0;
    }
  }, [query]);

  const handleScroll = useCallback(() => {
    setShowScroll((trackerRef.current?.scrollTop ?? 0) >= SHOW_SCROLL_THRESHOLD);
  }, []);

  const handleScrollButtonClick = useCallback(() => {
    trackerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePopoverClose = useCallback(() => setSelectedPokemon(0), []);

  return (
    <div className="tracker-container" onAnimationStart={syncShine} ref={containerRef}>
      <div className="tracker">
        <div className="dex-wrapper">
          <SearchBar
            filters={filters}
            query={query}
            setFilters={setFilters}
            setQuery={setQuery}
          />
          <div className="dex-column" onScroll={handleScroll} ref={trackerRef}>
            <Dex
              filters={filters}
              onScrollButtonClick={handleScrollButtonClick}
              query={query}
              setFilters={setFilters}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
              showScrollButton={showScroll}
            />
            <Footer />
          </div>
        </div>
        {selectedPokemon !== 0 && !activeDex!.checklist &&
          <PokemonPopover onClose={handlePopoverClose} selectedPokemon={selectedPokemon} />
        }
      </div>
    </div>
  );
}
