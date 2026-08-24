import classNames from 'classnames';
import throttle from 'lodash/throttle';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AnimationEvent as ReactAnimationEvent } from 'react';

import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { PokemonPopover } from './PokemonPopover';
import { SCROLL_DEBOUNCE, SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SearchBar } from './SearchBar';
import { EMPTY_FILTERS, TrackerContextProvider, useTrackerActions, useTrackerState } from './use-tracker';
import { useCaptures } from '../../../hooks/queries/captures';
import { useTranslation } from '../../../hooks/use-translation';

export function Tracker () {
  return <TrackerLoader />;
}

// keyed remount on dex switch resets per-dex UI state
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
  const { captures } = useTrackerState();
  const { setCaptures } = useTrackerActions();
  const { t } = useTranslation();

  const { data: storedCaptures, isLoading: capturesIsLoading } = useCaptures(activeDex!.id);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);
  const [flipsPaused, setFlipsPaused] = useState(false);

  // a CSS animation starts whenever its element is first styled — which is at seal time for a
  // new seal, and at scroll-in time for anything content-visibility skipped. Pinning startTime
  // to the timeline origin re-phases every one of them onto the same clock.
  const syncAnimation = useCallback((e: ReactAnimationEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches?.('.name-scroll-track, .seal-badges-track, .number-scroll-track, .box-shine-band')) {
      return;
    }
    for (const animation of target.getAnimations()) {
      animation.startTime = 0;
    }
  }, []);

  // space freezes the flips mid-cycle instead of paging the dex down
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : '';
      if (e.key !== ' ' || tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      setFlipsPaused((prev) => !prev);
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

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

  // memoized so re-renders don't reset the throttle window
  const handleScroll = useMemo(() => throttle(() => {
    setShowScroll((trackerRef.current?.scrollTop ?? 0) >= SHOW_SCROLL_THRESHOLD);
  }, SCROLL_DEBOUNCE), []);

  const handleScrollButtonClick = useCallback(() => {
    trackerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (capturesIsLoading || captures.length === 0) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className={classNames('tracker-container', { 'flips-paused': flipsPaused })} onAnimationStart={syncAnimation}>
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
        {selectedPokemon !== 0 &&
          // keyed so another mon remounts with fresh position state
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
