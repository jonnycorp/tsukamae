import { useCallback, useEffect, useRef, useState } from 'react';

import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { PokemonPopover } from './PokemonPopover';
import { SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SearchBar } from './SearchBar';
import { ZoomIndicator } from './ZoomIndicator';
import { EMPTY_FILTERS } from './filters';
import { TrackerContextProvider } from './use-tracker';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDexScale } from './use-dex-scale';
import { useFlipClock } from './use-flip-clock';
import { useTranslation } from '../../../hooks/use-translation';

import type { AnimationEvent, CSSProperties } from 'react';

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
  const areaRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { activeDex } = useDexContext();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);

  useFlipClock(containerRef);
  const { scale, columns, measured, headerWidth, topGap, flipLines, zoom, nudges } = useDexScale(areaRef);
  // the ball badge draws a 20px sprite area at 15px (styles/tracker.scss): pixelated only once that's no longer a shrink
  const crispBalls = scale * window.devicePixelRatio >= 20 / 15;

  useEffect(() => {
    const previous = document.title;
    document.title = `${activeDex!.title} | ${t('app.name')}`;
    return () => {
      document.title = previous;
    };
  }, [activeDex!.title, t]);

  useEffect(() => {
    if (columnRef.current) {
      columnRef.current.scrollTop = 0;
    }
  }, [query]);

  // watches a sentinel rather than reading scrollTop per scroll event, which forced layout mid-scroll
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setShowScroll(!entry.isIntersecting), { root: columnRef.current });
    observer.observe(sentinelRef.current!);
    return () => observer.disconnect();
  }, []);

  const handleScrollButtonClick = useCallback(() => {
    columnRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePopoverClose = useCallback(() => setSelectedPokemon(0), []);

  return (
    <div className="tracker-container" onAnimationStart={syncShine} ref={containerRef}>
      <div className="tracker" ref={areaRef}>
        <div
          className="dex-wrapper"
          data-crisp-balls={crispBalls || undefined}
          style={{
            '--dex-columns': columns,
            '--dex-header-width': `${headerWidth}px`,
            '--dex-top-gap': `${topGap}px`,
            '--flip-names': `${flipLines.names}px`,
            '--flip-badges': `${flipLines.badges}px`,
            '--flip-numbers': `${flipLines.numbers}px`,
          } as CSSProperties}
        >
          <SearchBar
            filters={filters}
            query={query}
            setFilters={setFilters}
            setQuery={setQuery}
          />
          <div className="dex-column" ref={columnRef}>
            <div className="scroll-sentinel" ref={sentinelRef} style={{ height: SHOW_SCROLL_THRESHOLD }} />
            <Dex
              columns={columns}
              filters={filters}
              measured={measured}
              onScrollButtonClick={handleScrollButtonClick}
              query={query}
              scale={scale}
              setFilters={setFilters}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
              showScrollButton={showScroll}
            />
            <Footer />
          </div>
        </div>
        {selectedPokemon !== 0 && !activeDex!.checklist &&
          <PokemonPopover onClose={handlePopoverClose} scale={scale} selectedPokemon={selectedPokemon} />
        }
      </div>
      <ZoomIndicator nudges={nudges} zoom={zoom} />
    </div>
  );
}
