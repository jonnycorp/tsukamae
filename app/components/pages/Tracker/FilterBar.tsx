import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { EMPTY_FILTERS, FACETS, FILTER_VIEWS, anyFilterActive, appliedFacets, facetOptions, filterMatcher, hasQuery, holdsSealed, queryMatcher } from './filters';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Facet, FacetId, TrackerFilters } from './filters';

// the gap the panel keeps from the window's edges, as its width does (tracker.scss)
const PANEL_EDGE = 16;

interface PanelProps {
  facets: Facet[];
  filters: TrackerFilters;
  onToggle: (facet: FacetId, value: string) => void;
  panelRef: RefObject<HTMLDivElement>;
  query: string;
  regional: boolean;
}

function FacetPanel ({ facets, filters, onToggle, panelRef, query, regional }: PanelProps) {
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();

  return (
    <div className="facet-panel" ref={panelRef}>
      {facets.map((facet) => {
        const options = facetOptions(facet, captures, filters, query, regional, locale);
        if (options.length === 0) {
          return null;
        }
        const selected = filters.facets[facet.id] ?? [];
        const setAside = !facet.species && !holdsSealed(filters.view);
        return (
          <section className={classNames('facet', { 'set-aside': setAside })} key={facet.id}>
            <h3>{t(facet.labelKey)}</h3>
            <div className="facet-options">
              {options.map((option) => (
                <button
                  aria-pressed={selected.includes(option.value)}
                  className={classNames('facet-option', { active: selected.includes(option.value), empty: option.count === 0 })}
                  disabled={setAside}
                  key={option.value}
                  onClick={() => onToggle(facet.id, option.value)}
                  type="button"
                >
                  {option.icon && <img alt="" src={`/${option.icon}`} />}
                  {option.glyph && (
                    <span className="facet-glyph-chip">
                      <span className="type-glyph facet-glyph" style={{ backgroundColor: `var(--type-${option.glyph})`, maskImage: `url(/types/${option.glyph}.svg)` }} />
                    </span>
                  )}
                  {option.label}
                  <span className="facet-count">{option.count}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface Props {
  filters: TrackerFilters;
  // the dex's settings, its defaults among them, in reach for marking a run of mons from one game
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
}

export function FilterBar ({ filters, query, setFilters }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const regional = Boolean(activeDexView?.regional);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useHotkey('f', () => setOpen((prev) => !prev));
  useHotkey('r', () => setFilters(EMPTY_FILTERS));

  const checklist = Boolean(activeDex?.checklist);
  const views = FILTER_VIEWS.filter((view) => !checklist || !view.records);
  const facets = FACETS.filter((facet) => !checklist || facet.species);
  const active = anyFilterActive(filters);

  const count = useMemo(() => {
    if (!active && !hasQuery(query)) {
      return null;
    }
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query, regional);
    return captures.filter((capture) => matchesFilters(capture) && matchesQuery(capture)).length;
  }, [captures, filters, query, regional, active]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof Node && !anchorRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    // an Escape already claimed (by an open dropdown) is left alone, as the popover and modals leave it
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setOpen(false);
      }
    };
    // a resize lays the header out again, leaving the panel where the toggle was: it closes, as a dropdown's menu does
    const close = () => setOpen(false);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // under the toggle, moved left as far as it would run past the window: a narrow window has the toggle near its edge
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!open || !anchor || !panel) {
      return;
    }
    // in screen px, then the header's own (it zooms with a wide window)
    const left = anchor.getBoundingClientRect().left;
    const overflow = left + panel.getBoundingClientRect().width - (window.innerWidth - PANEL_EDGE);
    panel.style.left = `${-Math.max(0, Math.min(overflow, left - PANEL_EDGE)) / panel.currentCSSZoom}px`;
  }, [open]);

  const setFacet = (facet: FacetId, values: string[]) => setFilters((prev) => ({ ...prev, facets: { ...prev.facets, [facet]: values } }));

  const toggleValue = (facet: FacetId, value: string) => {
    const current = filters.facets[facet] ?? [];
    setFacet(facet, current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  };

  return (
    <div className="filter-bar">
      <div aria-label={t('filter.views')} className="filter-views" role="radiogroup">
        {views.map((view) => (
          <button
            aria-checked={filters.view === view.id}
            className={classNames('filter-view', { active: filters.view === view.id })}
            key={view.id}
            onClick={() => setFilters((prev) => ({ ...prev, view: view.id }))}
            role="radio"
            type="button"
          >
            {t(view.labelKey)}
          </button>
        ))}
      </div>

      <div className="filter-anchor" ref={anchorRef}>
        <button aria-expanded={open} className={classNames('filter-toggle', { open })} onClick={() => setOpen((prev) => !prev)} type="button">
          {t('filter.facets')}
          <FontAwesomeIcon icon={faChevronDown} />
        </button>
        {open && <FacetPanel facets={facets} filters={filters} onToggle={toggleValue} panelRef={panelRef} query={query} regional={regional} />}
      </div>

      {appliedFacets(filters).map((facet) => {
        const labels = filters.facets[facet.id]!.map((value) => facet.label(value, locale));
        return (
          <button className="filter-chip" key={facet.id} onClick={() => setFacet(facet.id, [])} title={t('filter.clear')} type="button">
            <span className="filter-chip-label">{t(facet.labelKey)}</span>
            {labels.length > 2 ? t('filter.more', { first: labels[0], n: labels.length - 1 }) : labels.join(t('common.listSeparator'))}
            <FontAwesomeIcon icon={faXmark} />
          </button>
        );
      })}

      {count !== null && <span className="filter-count">{t('filter.count', { count })}</span>}
      {active &&
        <button className="filter-clear" onClick={() => setFilters(EMPTY_FILTERS)} type="button">{t('filter.clear')}</button>
      }
    </div>
  );
}
