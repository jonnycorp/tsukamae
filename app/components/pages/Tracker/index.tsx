import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Almanac } from './Almanac';
import { Atlas } from './Atlas';
import { CommandPalette } from './CommandPalette';
import { Dex } from './Dex';
import { Footer } from '../../library/Footer';
import { Journeys } from './Journeys';
import { MoveMenu } from './MoveMenu';
import { NameCopy } from './NameCopy';
import { PokemonPopover } from './PokemonPopover';
import { RedPen } from './RedPen';
import { Review } from './Review';
import { SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SceneBanner, whenSettled } from './SceneBanner';
import { SearchBar } from './SearchBar';
import { Timeline } from './Timeline';
import { ZoomIndicator } from './ZoomIndicator';
import { DISPLAY_MODES } from '../../../utils/display-modes';
import { EMPTY_FILTERS, filterMatcher, queryMatcher } from './filters';
import { MENU_OR_MODAL, useHotkey } from '../../../hooks/use-hotkey';
import { UndoToast } from './UndoToast';
import { redoRecords, undoRecords } from '../../../utils/local-data';
import { TrackerContextProvider, useTrackerActions, useTrackerState } from './use-tracker';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDexScale } from './use-dex-scale';
import { useFlipClock } from './use-flip-clock';
import { useDisplayContext, useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { AnimationEvent, CSSProperties } from 'react';
import type { HistoryDirection, HistoryStep } from '../../../utils/local-data';
import type { DexLayout } from './ledger-model';
import type { FacetId, TrackerFilters } from './filters';
import type { JourneysView } from './Journeys';
import type { LabScene } from './Scene';

// frames a located mon is looked for before it's taken as filtered out, beyond those the boxes are still going in for
const LOCATE_FRAMES = 30;
// the longest a page waits on the dex it hands a view to (handOff) before it goes anyway
const HAND_OFF_MS = 1500;

// what a page hands the dex as it goes: the closes of the pages going (several at once, the palette as its command
// runs), and a mon to bring into view, its popover opened (select) once they've gone
interface HandOff {
  closes: (() => void)[];
  locate: { pokemon: number; select: boolean } | null;
}

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
  const { display, setDisplay } = useDisplayContext();
  const flipPause = useFlipClock(containerRef, still, display);
  // still mode (M): no moving part anywhere, the flips held on the face its picker shows (useFlipClock), the sealed
  // boxes' shine gone and the meter at rest; kept through a restart
  useHotkey('m', () => setStill(!still));
  // the sealed tiles' display mode (O): Hexagon's pages, or Orbit's hub alone, and back; kept through a restart
  useHotkey('o', () => setDisplay(DISPLAY_MODES[(DISPLAY_MODES.indexOf(display) + 1) % DISPLAY_MODES.length]));
  const { scale, columns, rows, measured, headerWidth, flipLines, zoom, nudges } = useDexScale(areaRef);
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

  // a page handing the dex a view (a filter pressed in the almanac or Journeys, one cleared to find a mon, the
  // palette's) or a mon to show: the page stays up over the dex till the dex shows that view whole (the filters it
  // renders behind the last view, Dex.tsx's data-stale, then a rebuilt grid's first screenful, data-hidden) with the
  // mon brought into view, and goes in one frame, so the dex never shows what it showed before, or half of what comes
  // next. A mon's looked for over a few frames from there, as the boxes or the ledger's later rows can take that long
  // to render it
  const [handing, setHanding] = useState<HandOff | null>(null);
  const handOff = useCallback((close: () => void, locate: HandOff['locate'] = null) => {
    setHanding((prev) => ({ closes: [...(prev?.closes ?? []), close], locate: locate ?? prev?.locate ?? null }));
  }, []);
  useLayoutEffect(() => {
    if (!handing) {
      return undefined;
    }
    const { closes, locate } = handing;
    const start = performance.now();
    let frames = 0;
    let frame = 0;
    const step = () => {
      const late = performance.now() - start > HAND_OFF_MS;
      if (!late && document.querySelector('.dex[data-stale], .box-grid[data-hidden]')) {
        frame = requestAnimationFrame(step);
        return;
      }
      const tile = locate && document.querySelector(`.dex [data-pokemon-id='${locate.pokemon}']`);
      if (locate && !tile && !late && (document.querySelector('.dex [data-building]') || frames++ < LOCATE_FRAMES)) {
        // in a folded ledger group it has no row until the group opens
        revealHost.current?.(locate.pokemon);
        frame = requestAnimationFrame(step);
        return;
      }
      tile?.scrollIntoView({ block: 'center' });
      closes.forEach((close) => close());
      if (tile && locate.select) {
        setSelectedPokemon(locate.pokemon);
      }
      setHanding(null);
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [handing, revealHost]);

  // a mon clicked on the timeline (or the almanac's milestones, or picked in the palette): back to the dex, its tile
  // (or ledger row) brought into view with its popover open, if it's showing
  const handleLocate = useCallback((pokemon: number, select = true) => {
    handOff(() => {
      setShowTimeline(false);
      setShowAlmanac(false);
    }, { pokemon, select });
  }, [handOff]);
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
    setQuery('');
    setFilters({ view: 'all', facets: { [facet]: [value] } });
    handOff(() => setShowAlmanac(false));
  }, [handOff]);
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
  // as what it ran hands over (a filter, a mon to find), the palette going with it
  const handleClosePalette = useCallback(() => handOff(() => setShowPalette(false)), [handOff]);

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
      if (document.querySelector('.modal-overlay, .scene, .dropdown-menu, .nav-menu-dropdown, .command-palette')) {
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
    if (pokemon === null) {
      setReview(null);
      return;
    }
    handOff(() => setReview(null), { pokemon, select: false });
  }, [handOff]);
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

  // the scenes on the shared shell, one up at a time (Scene.tsx): each opened by its key or from the palette; what's
  // pressed in one filters the dex, goes to a mon's tile, or runs the review through a list of mons, as the scene closes
  const [scene, setScene] = useState<LabScene | null>(null);
  // Journeys come back to from the dex, quietly and as it was left (null when it's opened)
  const [journeysBack, setJourneysBack] = useState<JourneysView | null>(null);
  const handleOpenScene = useCallback((next: LabScene) => {
    setSelectedPokemon(0);
    setJourneysBack(null);
    setScene(next);
  }, []);
  const handleCloseScene = useCallback(() => setScene(null), []);
  // a press in Journeys filters the dex as a layer over it, which stands while the filter it set does (the search
  // left empty): Escape there, nothing else taking it, goes back to Journeys as it was left, without its entrance,
  // and the dex back to what it showed before. A press from a Journeys opened over the layer keeps that before
  const [layer, setLayer] = useState<{ filters: TrackerFilters; query: string; set: TrackerFilters; view: JourneysView } | null>(null);
  const layerStands = layer !== null && filters === layer.set && query === '';
  const handleJourneysFilter = useCallback((next: TrackerFilters, view: JourneysView) => {
    const before = layerStands ? layer : { filters, query };
    setLayer({ filters: before.filters, query: before.query, set: next, view });
    setQuery('');
    setFilters(next);
    handOff(() => setScene(null));
  }, [layer, layerStands, filters, query, handOff]);
  const handleJourneysBack = useCallback(() => {
    if (!layer) {
      return;
    }
    setFilters(layer.filters);
    setQuery(layer.query);
    setLayer(null);
    setSelectedPokemon(0);
    setJourneysBack(layer.view);
    setScene('journeys');
  }, [layer]);
  // first of every listener, so the key is read before anything acts on it: an open popover, menu, panel or
  // selection (the ledger's), or a field being typed in, keeps it
  useEffect(() => {
    if (!layerStands) {
      return undefined;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.repeat || e.isComposing) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      if (document.querySelector(`${MENU_OR_MODAL}, .pokemon-popover, .facet-panel, .batch-bar`)) {
        return;
      }
      e.preventDefault();
      handleJourneysBack();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [layerStands, handleJourneysBack]);
  // a scene reading the records (records) has nothing to show in a checklist, which keeps none
  const sceneKey = (next: LabScene, records = false) => () => {
    if (!document.querySelector('.facet-panel') && !(records && activeDex!.checklist)) {
      handleOpenScene(next);
    }
  };
  const handleSceneLocate = useCallback((pokemon: number) => {
    handOff(() => setScene(null));
    handleReveal(pokemon);
  }, [handOff, handleReveal]);
  const handleSceneReview = useCallback((queue: number[], start?: number) => {
    setScene(null);
    setSelectedPokemon(0);
    setReview({ queue, start: start === undefined ? 0 : Math.max(0, queue.indexOf(start)) });
  }, []);
  useHotkey('j', sceneKey('journeys', true));
  useHotkey('p', sceneKey('redpen', true));
  useHotkey('g', sceneKey('atlas'));

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
            source={layerStands ? { title: t('journeys.title'), onBack: handleJourneysBack } : undefined}
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
              rows={rows}
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
      {scene === 'journeys' && <Journeys back={journeysBack} onClose={handleCloseScene} onFilter={handleJourneysFilter} />}
      {scene === 'redpen' && <RedPen onClose={handleCloseScene} onLocate={handleSceneLocate} onReview={handleSceneReview} />}
      {scene === 'atlas' && <Atlas onClose={handleCloseScene} onLocate={handleSceneLocate} />}
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
          onOpenScene={handleOpenScene}
          onOpenTimeline={timeline ? handleOpenTimeline : undefined}
          setFilters={setFilters}
          setLayout={switchLayout}
          setQuery={setQuery}
        />
      }
    </div>
  );
}
