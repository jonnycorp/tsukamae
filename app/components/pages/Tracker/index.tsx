import { useCallback, useEffect, useRef, useState } from 'react';

import { Almanac } from './Almanac';
import { CommandPalette } from './CommandPalette';
import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { MoveMenu } from './MoveMenu';
import { NameCopy } from './NameCopy';
import { PokemonPopover } from './PokemonPopover';
import { Review } from './Review';
import { SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SceneBanner, whenSettled } from './SceneBanner';
import { SearchBar } from './SearchBar';
import { Timeline } from './Timeline';
import { ZoomIndicator } from './ZoomIndicator';
import { EMPTY_FILTERS, filterMatcher, queryMatcher } from './filters';
import { MENU_OR_MODAL, useHotkey } from '../../../hooks/use-hotkey';
import { UndoToast } from './UndoToast';
import { redoRecords, undoRecords } from '../../../utils/local-data';
import { TrackerContextProvider, useTrackerActions, useTrackerState } from './use-tracker';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDexScale } from './use-dex-scale';
import { useFlipClock } from './use-flip-clock';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { AnimationEvent, CSSProperties } from 'react';
import type { HistoryDirection, HistoryStep } from '../../../utils/local-data';
import type { DexLayout } from './ledger-model';
import type { FacetId } from './filters';

// frames a located mon is looked for before it's taken as filtered out
const LOCATE_FRAMES = 30;

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

  const { activeDex, activeDexView } = useDexContext();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showScroll, setShowScroll] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(0);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showAlmanac, setShowAlmanac] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  // the last undo or redo, said for a moment at the window's foot
  const [undone, setUndone] = useState<{ direction: HistoryDirection; step: HistoryStep | null; at: number } | null>(null);
  // the review's run of mons, fixed as it opens
  const [review, setReview] = useState<{ queue: number[]; start: number } | null>(null);
  const { captures } = useTrackerState();
  const { revealHost } = useTrackerActions();
  // the boxes, or the ledger in their place (V); kept across dexes and restarts
  const [layout, setLayout] = useLocalStorage<DexLayout>('dexLayout', 'boxes');

  const { still, setStill } = useThemeContext();
  const flipPause = useFlipClock(containerRef, still);
  // still mode (M): no moving part anywhere, the flips held on the face its picker shows (useFlipClock), the sealed
  // boxes' shine gone and the meter at rest; kept through a restart
  useHotkey('m', () => setStill(!still));
  const { scale, columns, measured, headerWidth, flipLines, zoom, nudges } = useDexScale(areaRef);
  // the ball badge draws a 20px sprite area at 15px (styles/tracker.scss): pixelated only once that's no longer a shrink
  const crispBalls = scale * window.devicePixelRatio >= 20 / 15;

  useEffect(() => {
    document.title = `${activeDex!.title} | ${t('app.name')}`;
    return () => {
      document.title = t('app.name');
    };
  }, [activeDex!.title, t]);

  // a new search, view or facet starts at the top, as a new list; re-clicking the view already shown keeps its place
  useEffect(() => {
    if (columnRef.current) {
      columnRef.current.scrollTop = 0;
    }
  }, [query, filters.view, filters.facets, layout]);

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

  // a checklist keeps no catch dates, so it has no timeline
  const timeline = !activeDex!.checklist;
  const handleOpenTimeline = useCallback(() => {
    setSelectedPokemon(0);
    setShowTimeline(true);
  }, []);
  const handleCloseTimeline = useCallback(() => setShowTimeline(false), []);
  // a mon clicked on the timeline (or the almanac's milestones, or picked in the palette): back to the dex, its tile
  // (or ledger row) brought into view with its popover open, if it's showing; looked for over a few frames, as a
  // cleared filter or the ledger's later rows can take that long to render it
  const handleLocate = useCallback((pokemon: number, select = true) => {
    setShowTimeline(false);
    setShowAlmanac(false);
    let frames = 0;
    const find = () => {
      const tile = document.querySelector(`.dex [data-pokemon-id='${pokemon}']`);
      if (tile) {
        tile.scrollIntoView({ block: 'center' });
        if (select) {
          setSelectedPokemon(pokemon);
        }
      } else if (frames++ < LOCATE_FRAMES) {
        // in a folded ledger group it has no row until the group opens
        revealHost.current?.(pokemon);
        requestAnimationFrame(find);
      }
    };
    requestAnimationFrame(find);
  }, [revealHost]);
  useHotkey('t', () => {
    if (timeline && !document.querySelector('.facet-panel')) {
      handleOpenTimeline();
    }
  });

  // the almanac (A): the dex counted every way; a bar pressed there filters the dex to it, in place of what was set
  const handleOpenAlmanac = useCallback(() => {
    setSelectedPokemon(0);
    setShowAlmanac(true);
  }, []);
  const handleCloseAlmanac = useCallback(() => setShowAlmanac(false), []);
  const handleAlmanacFilter = useCallback((facet: FacetId, value: string) => {
    setShowAlmanac(false);
    setQuery('');
    setFilters({ view: 'all', facets: { [facet]: [value] } });
  }, []);
  // the boxes or the list (V, the dex menu, the palette): the one coming named on a tab under the header (SceneBanner),
  // on the header's left margin (the boxes' too), as the dex fades out; swapped in out of sight once the tab rests, and
  // faded in, before the tab goes, once it has stopped building itself (its boxes and its rows come a few a frame, from
  // the top), so it shows whole and still
  const [curtain, setCurtain] = useState<{ to: DexLayout; top: number; left: number; settled: boolean; revealed: boolean } | null>(null);
  const switchLayout = useCallback((to: DexLayout) => {
    const column = columnRef.current;
    if (to !== layout && !curtain && column) {
      const wrapper = column.parentElement!;
      const margin = wrapper.querySelector('.dex-search-bar-inner');
      const left = margin ? margin.getBoundingClientRect().left - wrapper.getBoundingClientRect().left : 0;
      setCurtain({ to, top: column.offsetTop, left, settled: false, revealed: false });
    }
  }, [layout, curtain]);
  const handleCurtainReveal = useCallback(() => {
    setCurtain((current) => current && { ...current, revealed: true });
  }, []);
  const handleCurtainCovered = useCallback(() => {
    if (curtain) {
      setLayout(curtain.to);
    }
  }, [curtain, setLayout]);
  useEffect(() => {
    if (!curtain || curtain.settled || layout !== curtain.to || !columnRef.current) {
      return undefined;
    }
    let live = true;
    whenSettled(columnRef.current).then(() => {
      if (live) {
        setCurtain((current) => current && { ...current, settled: true });
      }
    });
    return () => {
      live = false;
    };
  }, [curtain, layout]);
  useHotkey('v', () => switchLayout(layout === 'boxes' ? 'ledger' : 'boxes'));

  // Ctrl+K (Cmd on macOS): the command palette from anywhere in the dex, a field included, but not over a menu or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k' || document.querySelector(MENU_OR_MODAL)) {
        return;
      }
      e.preventDefault();
      setSelectedPokemon(0);
      setShowPalette(true);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  const handleClosePalette = useCallback(() => setShowPalette(false), []);

  // Ctrl+Z takes back the last change to this dex's records (a mark, an edit, a seal, a move, a release, a whole
  // batch), Ctrl+Shift+Z or Ctrl+Y puts it back; a field keeps its own undo, and a modal or an open menu its keys
  const dexId = activeDex!.id;
  const handleHistory = useCallback((direction: HistoryDirection) => {
    const step = direction === 'undo' ? undoRecords(dexId) : redoRecords(dexId);
    setUndone({ direction, step, at: Date.now() });
  }, [dexId]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) {
        return;
      }
      const key = e.key.toLowerCase();
      const direction = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey) ? 'redo' : key === 'z' ? 'undo' : null;
      if (!direction || e.repeat) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      if (document.querySelector('.modal-overlay, .dropdown-menu, .nav-menu-dropdown, .command-palette')) {
        return;
      }
      e.preventDefault();
      handleHistory(direction);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleHistory]);

  // the review (W): the mons the dex shows now, in its order, from the popover's if one's open; closing it comes back
  // to the one it ended on. A checklist keeps no records to review
  const handleOpenReview = useCallback(() => {
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query, Boolean(activeDexView?.regional));
    const queue = captures.filter((capture) => matchesFilters(capture) && matchesQuery(capture)).map((capture) => capture.pokemon.id);
    setReview({ queue, start: Math.max(0, queue.indexOf(selectedPokemon)) });
    setSelectedPokemon(0);
  }, [captures, filters, query, activeDexView, selectedPokemon]);
  const handleCloseReview = useCallback((pokemon: number | null) => {
    setReview(null);
    if (pokemon !== null) {
      handleLocate(pokemon, false);
    }
  }, [handleLocate]);
  useHotkey('w', () => {
    if (!activeDex!.checklist && !document.querySelector('.facet-panel')) {
      handleOpenReview();
    }
  });
  // a mon picked in a scene (the timeline, the almanac, the palette) that the search or a filter hides has them
  // cleared first, so there's a tile to go to
  const regional = Boolean(activeDexView?.regional);
  const handleReveal = useCallback((pokemon: number) => {
    const capture = captures.find((entry) => entry.pokemon.id === pokemon);
    if (capture && !(filterMatcher(filters)(capture) && queryMatcher(query, regional)(capture))) {
      setFilters(EMPTY_FILTERS);
      setQuery('');
    }
    handleLocate(pokemon);
  }, [captures, filters, query, regional, handleLocate]);

  useHotkey('a', () => {
    if (!document.querySelector('.facet-panel')) {
      handleOpenAlmanac();
    }
  });

  return (
    <div className="tracker-container" onAnimationStart={syncShine} ref={containerRef}>
      <div className="tracker" ref={areaRef}>
        <div
          className="dex-wrapper"
          data-crisp-balls={crispBalls || undefined}
          style={{
            '--dex-columns': columns,
            '--dex-header-width': `${headerWidth}px`,
            '--flip-names': `${flipLines.names}px`,
            '--flip-badges': `${flipLines.badges}px`,
            '--flip-numbers': `${flipLines.numbers}px`,
            '--flip-band': `${flipLines.band}px`,
            '--flip-lower': `${flipLines.band + flipLines.badges}px`,
            '--type-glyph': `${flipLines.glyph}px`,
            '--type-gap': `${flipLines.glyphGap}px`,
          } as CSSProperties}
        >
          <SearchBar
            filters={filters}
            flipPause={flipPause}
            layout={layout}
            onLayout={switchLayout}
            onOpenAlmanac={handleOpenAlmanac}
            onOpenReview={activeDex!.checklist ? undefined : handleOpenReview}
            onOpenTimeline={timeline ? handleOpenTimeline : undefined}
            query={query}
            setFilters={setFilters}
            setQuery={setQuery}
          />
          <div className="dex-column" data-veil={(curtain && !curtain.revealed) || undefined} ref={columnRef}>
            <div className="scroll-sentinel" ref={sentinelRef} style={{ height: SHOW_SCROLL_THRESHOLD }} />
            <Dex
              columns={columns}
              filters={filters}
              layout={layout}
              measured={measured}
              onScrollButtonClick={handleScrollButtonClick}
              query={query}
              scale={scale}
              selectedPokemon={selectedPokemon}
              setFilters={setFilters}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
              showScrollButton={showScroll}
            />
            <Footer />
          </div>
          {curtain &&
            <div className="view-curtain" style={{ top: curtain.top, left: curtain.left }}>
              <SceneBanner
                onCleared={() => setCurtain(null)}
                onCovered={handleCurtainCovered}
                onReveal={handleCurtainReveal}
                ready={curtain.settled}
                title={t(curtain.to === 'ledger' ? 'layout.ledger' : 'layout.boxes')}
              />
            </div>
          }
        </div>
        {selectedPokemon !== 0 && !activeDex!.checklist &&
          <PokemonPopover onClose={handlePopoverClose} scale={scale} selectedPokemon={selectedPokemon} />
        }
      </div>
      <ZoomIndicator nudges={nudges} zoom={zoom} />
      <NameCopy />
      {!activeDex!.checklist && <MoveMenu />}
      {showTimeline && <Timeline onClose={handleCloseTimeline} onLocate={handleReveal} />}
      {showAlmanac && <Almanac onClose={handleCloseAlmanac} onFilter={handleAlmanacFilter} onLocate={handleReveal} />}
      {review && <Review onClose={handleCloseReview} queue={review.queue} start={review.start} />}
      {undone && <UndoToast key={undone.at} {...undone} onAgain={handleHistory} onDone={() => setUndone(null)} />}
      {showPalette &&
        <CommandPalette
          filters={filters}
          layout={layout}
          onClose={handleClosePalette}
          onHistory={handleHistory}
          onLocate={handleReveal}
          onOpenAlmanac={handleOpenAlmanac}
          onOpenReview={activeDex!.checklist ? undefined : handleOpenReview}
          onOpenTimeline={timeline ? handleOpenTimeline : undefined}
          setFilters={setFilters}
          setLayout={switchLayout}
          setQuery={setQuery}
        />
      }
    </div>
  );
}
