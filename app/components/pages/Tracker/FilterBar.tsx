import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EMPTY_FILTERS, FACETS, FILTER_VIEWS, anyFilterActive, appliedFacets, facetOptions, filterMatcher, hasQuery, queryMatcher } from './filters';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Dispatch, SetStateAction } from 'react';
import type { Facet, FacetId, TrackerFilters } from './filters';

interface PanelProps {
  facets: Facet[];
  filters: TrackerFilters;
  onToggle: (facet: FacetId, value: string) => void;
  query: string;
  regional: boolean;
}

function FacetPanel ({ facets, filters, onToggle, query, regional }: PanelProps) {
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();

  return (
    <div className="facet-panel">
      {facets.map((facet) => {
        const options = facetOptions(facet, captures, filters, query, regional, locale);
        if (options.length === 0) {
          return null;
        }
        const selected = filters.facets[facet.id] ?? [];
        const setAside = !facet.species && filters.view === 'missing';
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
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
        {open && <FacetPanel facets={facets} filters={filters} onToggle={toggleValue} query={query} regional={regional} />}
      </div>

      {appliedFacets(filters).map((facet) => {
        const labels = filters.facets[facet.id]!.map((value) => facet.label(value, locale));
        return (
          <button className="filter-chip" key={facet.id} onClick={() => setFacet(facet.id, [])} title={t('filter.clear')} type="button">
            <span className="filter-chip-label">{t(facet.labelKey)}</span>
            {labels.length > 2 ? `${labels[0]} +${labels.length - 1}` : labels.join(', ')}
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
