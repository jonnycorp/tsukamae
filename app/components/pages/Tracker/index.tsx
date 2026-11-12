import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Almanac } from './Almanac';
import { Atlas } from './Atlas';
import { BallOrrery } from './BallOrrery';
import { Dex } from './Dex';
import { HotkeySheet } from './HotkeySheet';
import { Journeys } from './Journeys';
import { MoveMenu } from './MoveMenu';
import { NameCopy } from './NameCopy';
import { PokemonPopover } from './PokemonPopover';
import { RedPen } from './RedPen';
import { TrainerCards } from './TrainerCards';
import { Review } from './Review';
import { SHOW_SCROLL_THRESHOLD } from './Scroll';
import { SceneBanner } from './SceneBanner';
import { SearchBar } from './SearchBar';
import { Timeline } from './Timeline';
import { ZoomIndicator } from './ZoomIndicator';
import { DISPLAY_MODES } from '../../../utils/display-modes';
import { EMPTY_FILTERS, filterMatcher, queryMatcher } from './filters';
import { MENU_OR_MODAL, useHotkey } from '../../../hooks/use-hotkey';
import { whenSettled } from '../../../utils/when-settled';
import { TrackerContextProvider, useTrackerActions, useTrackerState } from './use-tracker';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDexScale } from './use-dex-scale';
import { useFlipClock } from './use-flip-clock';
import { useInkPond } from './ink-pond';
import { usePageBrush } from './page-brush';
import { useDisplayContext, useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { AnimationEvent, CSSProperties } from 'react';
import type { DexLayout } from './ledger-model';
import type { FacetId, TrackerFilters } from './filters';
import type { JourneysView } from './Journeys';
import type { LabScene, SceneView } from './Scene';
import type { OrreryView } from './BallOrrery';

// frames a located mon is looked for before it's taken as filtered out, beyond those the boxes are still going in for
const LOCATE_FRAMES = 30;
// the longest a page waits on the dex it hands a view to (handOff) before it goes anyway
const HAND_OFF_MS = 1500;

// what a page hands the dex as it goes: the closes of the pages going (several at once), and a mon to bring into view,
// its popover opened (select) once they've gone
interface HandOff {
  closes: (() => void)[];
  locate: { pokemon: number; select: boolean } | null;
}

// a scene that filters the dex as a layer over it, and how it was left, to come back to
type SceneBack =
  | { scene: 'journeys'; view: JourneysView }
  | { scene: 'trainers'; view: SceneView }
  | { scene: 'orrery'; view: OrreryView };

// the name on the tab in the filters' row that goes back to it (FilterBar)
const LAYER_TITLES = { journeys: 'journeys.title', trainers: 'trainers.title', orrery: 'orrery.title' } as const;

export function Tracker () {
  const { activeDex } = useDexContext();

  return (
    <TrackerContextProvider key={activeDex!.id}>
      <TrackerInner />
    </TrackerContextProvider>
  );
}

// a CSS animation starts when its element is first styled, which content-visibility delays until scroll-in, and a
// moon slot's group (FlipStrips) only once a mon fills it: the seal materials' flow and the moons' turn all run from the
// timeline's start, so every box keeps in step, and a row's slots their fifth of a turn apart (by their delays); and an
// open free box's marching frame, so two open at once march together
const SYNCED = ['seal-flow', 'hub-far', 'hub-near', 'free-march'];

function syncLoops (e: AnimationEvent<HTMLDivElement>) {
  if (!SYNCED.includes(e.animationName)) {
    return;
  }
  // a pseudo-element's animation (the frame's ::after) comes only with the subtree's, of which it alone is set
  const target = e.target as HTMLElement;
  for (const animation of target.getAnimations({ subtree: Boolean(e.pseudoElement) })) {
    const effect = animation.effect as KeyframeEffect | null;
    if (!e.pseudoElement || (effect?.target === target && effect.pseudoElement === e.pseudoElement)) {
      animation.startTime = 0;
    }
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
  // every shortcut, on a sheet (H)
  const [showHelp, setShowHelp] = useState(false);
  // the review's run of mons, fixed as it opens
  const [review, setReview] = useState<{ queue: number[]; start: number } | null>(null);
  const { captures } = useTrackerState();
  const { revealHost } = useTrackerActions();
  // the boxes, or the ledger in their place (V); kept across dexes and restarts
  const [layout, setLayout] = useLocalStorage<DexLayout>('dexLayout', 'boxes');

  const { still, setStill } = useThemeContext();
  const { display, setDisplay } = useDisplayContext();
  const flipPause = useFlipClock(containerRef, still, display);
  // Ink's pond, drops falling on it every second or two (ink-pond.ts)
  useInkPond();
  // a theme's brushed page change, its marks laid over the lines as they change (page-brush.ts)
  usePageBrush(containerRef, display);
  // still mode (M): no moving part anywhere, the flips held on the face its picker shows (useFlipClock), the sealed
  // boxes' seal flows stopped and the meter at rest; kept through a restart
  useHotkey('m', () => setStill(!still));
  // the sealed tiles' display mode (O): Hexagon's pages, or Orbit's hub alone, and back; kept through a restart
  useHotkey('o', () => setDisplay((mode) => DISPLAY_MODES[(DISPLAY_MODES.indexOf(mode) + 1) % DISPLAY_MODES.length]));
  useHotkey('h', () => {
    if (!document.querySelector('.facet-panel')) {
      setSelectedPokemon(0);
      setShowHelp(true);
    }
  });
  const { scale, columns, rows, measured, headerWidth, flipLines, zoom, nudges } = useDexScale(areaRef, columnRef);
  // the ball badge draws a 20px sprite area at 15px (styles/tracker.scss): pixelated only once that's no longer a shrink
  const crispBalls = scale * window.devicePixelRatio >= 20 / 15;
  // and Orbit's hub draws it at 26px (styles/tile-faces.scss), no longer a shrink from a lower zoom
  const crispHub = scale * window.devicePixelRatio >= 20 / 26;

  useEffect(() => {
    document.title = `${activeDex!.title} | ${t('app.name')}`;
    return () => {
      document.title = t('app.name');
    };
  }, [activeDex!.title, t]);

  // a new search, view or facet starts at the top, as a new list; re-clicking the view already shown keeps its place.
  // On the values the dex draws by (Dex.tsx defers them), so the jump lands with the view it brings, never on the old
  const shownQuery = useDeferredValue(query);
  const shownFilters = useDeferredValue(filters);
  useLayoutEffect(() => {
    if (columnRef.current) {
      columnRef.current.scrollTop = 0;
    }
  }, [shownQuery, shownFilters.view, shownFilters.facets, layout]);

  // a fast fling scrolls on ahead of what's been drawn, and content-visibility draws a box's tiles, its seal ground and
  // its row's flips only once they're nearly in view, so they came in blank: those within a screen and a half either
  // way are kept drawn (data-near, styles/tracker.scss). Watched as they're added and let go as they leave, the boxes
  // going in a few a frame
  useEffect(() => {
    const root = columnRef.current;
    if (!root) {
      return undefined;
    }
    const NEAR = '.box-container > .tile-grid, .results-chunk > .tile-grid, .seal-material, .flip-overlay';
    const near = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.toggleAttribute('data-near', entry.isIntersecting));
    }, { root, rootMargin: '150% 0px' });
    const each = (node: Node, act: (el: Element) => void) => {
      if (node instanceof Element) {
        if (node.matches(NEAR)) {
          act(node);
        }
        node.querySelectorAll(NEAR).forEach(act);
      }
    };
    each(root, (el) => near.observe(el));
    const added = new MutationObserver((records) => records.forEach((record) => {
      record.addedNodes.forEach((node) => each(node, (el) => near.observe(el)));
      record.removedNodes.forEach((node) => each(node, (el) => near.unobserve(el)));
    }));
    added.observe(root, { childList: true, subtree: true });
    return () => {
      added.disconnect();
      near.disconnect();
    };
  }, []);

  // watches a sentinel rather than reading scrollTop per scroll event, which forced layout mid-scroll
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setShowScroll(!entry.isIntersecting), { root: columnRef.current });
    observer.observe(sentinelRef.current!);
    return () => observer.disconnect();
  }, []);

  const handleScrollButtonClick = useCallback(() => {
    // still mode (M) jumps there rather than gliding
    columnRef.current?.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  }, [still]);

  const handlePopoverClose = useCallback(() => setSelectedPokemon(0), []);

  // a page handing the dex a view (a filter pressed in the almanac or Journeys, one cleared to find a mon) or a mon to
  // show: the page stays up over the dex till the dex shows that view whole (the filters it renders behind the last
  // view, Dex.tsx's data-stale, then a rebuilt grid's first screenful, data-hidden) with the mon brought into view, and
  // goes in one frame, so the dex never shows what it showed before, or half of what comes next. A mon's looked for
  // over a few frames from there, as the boxes or the ledger's later rows can take that long to render it. The page's
  // own close (Escape, its ✕) waits for it too, as closing first would show what it holds back
  const [handing, setHanding] = useState<HandOff | null>(null);
  const handingRef = useRef(false);

  // a checklist keeps no catch dates, so it has no timeline
  const timeline = !activeDex!.checklist;
  const handleOpenTimeline = useCallback(() => {
    setSelectedPokemon(0);
    setShowTimeline(true);
  }, []);
  const handleCloseTimeline = useCallback(() => {
    if (!handingRef.current) {
      setShowTimeline(false);
    }
  }, []);

  const handOff = useCallback((close: () => void, locate: HandOff['locate'] = null) => {
    handingRef.current = true;
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
      // the boxes built afresh fade in (.box-grid, styles/tracker.scss): waited out too, so the page never leaves
      // onto paper
      const fading = [...document.querySelectorAll<HTMLElement>('.dex .box-grid')].some((grid) => getComputedStyle(grid).opacity !== '1');
      if (!late && (fading || document.querySelector('.dex[data-stale], .box-grid[data-hidden]'))) {
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
      handingRef.current = false;
      closes.forEach((close) => close());
      if (tile && locate.select) {
        setSelectedPokemon(locate.pokemon);
      }
      setHanding(null);
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [handing, revealHost]);

  // a mon clicked on the timeline (or the almanac's milestones, or a scene): back to the dex, its tile (or ledger row)
  // brought into view with its popover open, if it's showing
  const handleLocate = useCallback((pokemon: number) => {
    handOff(() => {
      setShowTimeline(false);
      setShowAlmanac(false);
    }, { pokemon, select: true });
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
  const handleCloseAlmanac = useCallback(() => {
    if (!handingRef.current) {
      setShowAlmanac(false);
    }
  }, []);
  const handleAlmanacFilter = useCallback((facet: FacetId, value: string) => {
    setQuery('');
    setFilters({ view: 'all', facets: { [facet]: [value] } });
    handOff(() => setShowAlmanac(false));
  }, [handOff]);
  // the boxes or the list (V, the dex menu): the one coming named on a tab under the header (SceneBanner), on the
  // header's left margin (the boxes' too), as the dex fades out; swapped in out of sight once the tab rests, and faded
  // in, before the tab goes, once it has stopped building itself (its boxes and its rows come a few a frame, from the
  // top), so it shows whole and still
  const [curtain, setCurtain] = useState<{ to: DexLayout; top: number; left: number; settled: boolean; revealed: boolean } | null>(null);
  const switchLayout = useCallback((to: DexLayout) => {
    const column = columnRef.current;
    if (to !== layout && !curtain && column) {
      const wrapper = column.parentElement!;
      const margin = wrapper.querySelector('.dex-search-bar-inner');
      const left = margin ? margin.getBoundingClientRect().left - wrapper.getBoundingClientRect().left : 0;
      // the popover goes with the dex it sits over, as it does for a page opening over the dex
      setSelectedPokemon(0);
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

  // the review (W): the mons the dex shows now, in its order, from the popover's if one's open, else from the one W
  // was pressed over (a press marks a tile without opening it); closing it comes back to the one it ended on. A
  // checklist keeps no records to review
  const handleOpenReview = useCallback((pointed = 0) => {
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query, Boolean(activeDexView?.regional));
    // the one it starts from is shown, so it's in, where it stands, though the view only holds it (a press marked it)
    const from = selectedPokemon || pointed;
    const queue = captures.filter((capture) => capture.pokemon.id === from || (matchesFilters(capture) && matchesQuery(capture))).map((capture) => capture.pokemon.id);
    closingReview.current = false;
    setReview({ queue, start: Math.max(0, queue.indexOf(from)) });
    setSelectedPokemon(0);
  }, [captures, filters, query, activeDexView, selectedPokemon]);
  const closingReview = useRef(false);
  const handleCloseReview = useCallback((pokemon: number | null) => {
    if (closingReview.current) {
      return;
    }
    const capture = pokemon === null ? undefined : captures.find((entry) => entry.pokemon.id === pokemon);
    const shown = capture && filterMatcher(filters)(capture) && queryMatcher(query, Boolean(activeDexView?.regional))(capture);
    if (pokemon === null || !shown) {
      setReview(null);
      return;
    }
    closingReview.current = true;
    // let go as the close lands, so a review opened again (from W or a scene) closes again
    handOff(() => {
      closingReview.current = false;
      setReview(null);
    }, { pokemon, select: false });
  }, [handOff, captures, filters, query, activeDexView]);
  // the tile or ledger row under the pointer, as L and D find theirs (Dex.tsx)
  useHotkey('w', () => {
    if (!activeDex!.checklist && !document.querySelector('.facet-panel')) {
      const tile = document.querySelector<HTMLElement>(':is(.pokemon, .ledger-row)[data-pokemon-id]:hover');
      handleOpenReview(Number(tile?.dataset.pokemonId) || 0);
    }
  });
  // a mon picked in a scene (the timeline, the almanac, the red pen, the atlas) that the search or a filter hides has
  // them cleared first, so there's a tile to go to
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

  // the scenes on the shared shell, one up at a time (Scene.tsx): each opened by its key; what's pressed in one filters
  // the dex, goes to a mon's tile, or runs the review through a list of mons, as the scene closes
  const [scene, setScene] = useState<LabScene | null>(null);
  // a scene come back to from the dex, quietly and as it was left (null when it's opened)
  const [sceneBack, setSceneBack] = useState<SceneBack | null>(null);
  const handleOpenScene = useCallback((next: LabScene) => {
    setSelectedPokemon(0);
    setSceneBack(null);
    setScene(next);
  }, []);
  const handleCloseScene = useCallback(() => {
    if (!handingRef.current) {
      setScene(null);
    }
  }, []);
  // a press in a scene that filters the dex (Journeys, the trainer cards, the ball orrery) does it as a layer over it,
  // which stands while the filter it set does (the search left empty): Escape there, nothing else taking it, or the tab
  // naming the scene, goes back to that scene as it was left, without its entrance, and the dex back to what it showed
  // before. A press from a scene opened over the layer keeps that before
  const [layer, setLayer] = useState<{ filters: TrackerFilters; query: string; set: TrackerFilters; from: SceneBack } | null>(null);
  const layerStands = layer !== null && filters === layer.set && query === '';
  const handleLayerFilter = useCallback((next: TrackerFilters, from: SceneBack) => {
    const before = layerStands ? layer : { filters, query };
    setLayer({ filters: before.filters, query: before.query, set: next, from });
    setQuery('');
    setFilters(next);
    handOff(() => setScene(null));
  }, [layer, layerStands, filters, query, handOff]);
  const handleLayerBack = useCallback(() => {
    if (!layer) {
      return;
    }
    setFilters(layer.filters);
    setQuery(layer.query);
    setLayer(null);
    setSelectedPokemon(0);
    setSceneBack(layer.from);
    setScene(layer.from.scene);
  }, [layer]);
  const handleJourneysFilter = useCallback((next: TrackerFilters, view: JourneysView) => {
    handleLayerFilter(next, { scene: 'journeys', view });
  }, [handleLayerFilter]);
  const handleTrainersFilter = useCallback((next: TrackerFilters, view: SceneView) => {
    handleLayerFilter(next, { scene: 'trainers', view });
  }, [handleLayerFilter]);
  const handleOrreryFilter = useCallback((next: TrackerFilters, view: OrreryView) => {
    handleLayerFilter(next, { scene: 'orrery', view });
  }, [handleLayerFilter]);
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
      handleLayerBack();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [layerStands, handleLayerBack]);
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
  // a checklist's Red Pen keeps its bookkeeping alone
  useHotkey('p', sceneKey('redpen'));
  useHotkey('g', sceneKey('atlas'));
  useHotkey('c', sceneKey('trainers', true));
  useHotkey('b', sceneKey('orrery', true));

  return (
    <div className="tracker-container" onAnimationStart={syncLoops} ref={containerRef}>
      <div className="tracker" ref={areaRef}>
        <div
          className="dex-wrapper"
          data-crisp-balls={crispBalls || undefined}
          data-crisp-hub={crispHub || undefined}
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
            source={layerStands ? { title: t(LAYER_TITLES[layer.from.scene]), onBack: handleLayerBack } : undefined}
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
      {scene === 'journeys' &&
        <Journeys back={sceneBack?.scene === 'journeys' ? sceneBack.view : null} onClose={handleCloseScene} onFilter={handleJourneysFilter} />}
      {scene === 'redpen' && <RedPen onClose={handleCloseScene} onLocate={handleSceneLocate} onReview={handleSceneReview} />}
      {scene === 'atlas' && <Atlas onClose={handleCloseScene} onLocate={handleSceneLocate} />}
      {scene === 'trainers' &&
        <TrainerCards back={sceneBack?.scene === 'trainers' ? sceneBack.view : null} onClose={handleCloseScene} onFilter={handleTrainersFilter} />}
      {scene === 'orrery' &&
        <BallOrrery back={sceneBack?.scene === 'orrery' ? sceneBack.view : null} onClose={handleCloseScene} onFilter={handleOrreryFilter} />}
      {showHelp && <HotkeySheet checklist={Boolean(activeDex!.checklist)} onClose={() => setShowHelp(false)} />}
    </div>
  );
}
