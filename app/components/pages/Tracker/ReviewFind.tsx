import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { FILTER_VIEWS, anyFilterActive, appliedFacets, hasQuery, queryExact, queryMatcher } from './filters';
import { PokemonName } from '../../library/PokemonName';
import { dexNumber, monIcon } from '../../../utils/pokemon';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, Dex } from '../../../types';
import type { TrackerFilters } from './filters';

// the dex's search and filters, where W's run is the dex's view (a scene's run is its own)
export interface RunScope {
  query: string;
  filters: TrackerFilters;
}

// what W lets go of to widen its run round a mon: the search, the filters, or (null) whatever hides it
export type LetGo = 'query' | 'filters' | null;

interface ScopeProps {
  scope: RunScope;
  onLetGo: (what: 'query' | 'filters') => void;
}

// what narrows W's run, on its foot: the dex's search and its filters, each let go of by a press, W staying on the mon
// it's on with its neighbours round it
export function RunScopeChips ({ scope, onLetGo }: ScopeProps) {
  const { t, locale } = useTranslation();
  const { query, filters } = scope;
  const filtered = anyFilterActive(filters);
  const parts = filtered
    ? [
      ...(filters.view === 'all' ? [] : [t(FILTER_VIEWS.find((view) => view.id === filters.view)!.labelKey)]),
      ...appliedFacets(filters).map((facet) => {
        const labels = filters.facets[facet.id]!.map((value) => facet.label(value, locale));
        return labels.length > 2 ? t('filter.more', { first: labels[0], n: labels.length - 1 }) : labels.join(t('common.listSeparator'));
      }),
    ]
    : [];
  return (
    <>
      {hasQuery(query) &&
        <button className="review-scope" onClick={() => onLetGo('query')} title={t('review.letGoSearch')} type="button">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <span className="review-scope-text">{query.trim()}</span>
          <FontAwesomeIcon className="review-scope-x" icon={faXmark} />
        </button>
      }
      {filtered &&
        <button className="review-scope" onClick={() => onLetGo('filters')} title={t('review.letGoFilters')} type="button">
          <FontAwesomeIcon icon={faFilter} />
          <span className="review-scope-text">{parts.join(' · ')}</span>
          <FontAwesomeIcon className="review-scope-x" icon={faXmark} />
        </button>
      }
    </>
  );
}

interface FindProps {
  open: boolean;
  // folded: `back` to the page (Esc, a mon gone to), or not (focus gone elsewhere, which keeps it)
  onFold: (back: boolean) => void;
  // the dex's every mon, and those in the run
  captures: Capture[];
  run: ReadonlySet<number>;
  dex: Dex;
  onGo: (pokemon: number) => void;
  // Backspace with nothing typed: the dex's search let go of, where there's one
  onLetGo?: () => void;
}

// W's find (/): a line furling out along the foot's top edge, what's typed riding on it and the mons it finds after,
// the one Enter goes to lit (↑ ↓ or Tab move it). Over the whole dex, a mon in the run first, then one outside it,
// which going to widens the run (Review's onWiden); a whole name typed first, then those it begins
export function ReviewFind ({ open, onFold, captures, run, dex, onGo, onLetGo }: FindProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const hitsRef = useRef<HTMLOListElement>(null);
  const [text, setText] = useState('');
  const [pick, setPick] = useState(0);
  // each opening starts afresh; folding keeps what was typed in sight as it fades
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setText('');
      setPick(0);
    }
  }
  const regional = Boolean(dex.regional);

  const hits = useMemo(() => {
    if (!hasQuery(text)) {
      return [];
    }
    const matches = queryMatcher(text, regional);
    const exact = queryExact(text, regional);
    const found = captures.filter(matches).map((capture, order) => ({ capture, order, rank: (exact(capture) ? 0 : 2) + (run.has(capture.pokemon.id) ? 0 : 1) }));
    return found.sort((a, b) => a.rank - b.rank || a.order - b.order).map((hit) => hit.capture);
  }, [text, captures, run, regional]);

  // a find's hits change under it only as a record does; the lit one stays on the line
  const lit = Math.min(pick, hits.length - 1);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  // the lit one kept in sight along the line
  useLayoutEffect(() => {
    const list = hitsRef.current;
    const hit = list?.children[lit] as HTMLElement | undefined;
    if (!list || !hit) {
      return;
    }
    if (hit.offsetLeft < list.scrollLeft) {
      list.scrollLeft = hit.offsetLeft;
    } else if (hit.offsetLeft + hit.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = hit.offsetLeft + hit.offsetWidth - list.clientWidth;
    }
  }, [lit, hits]);

  const step = (by: number) => {
    if (hits.length > 0) {
      setPick((Math.max(0, lit) + by + hits.length) % hits.length);
    }
  };

  return (
    <div className="review-find" data-open={open || undefined}>
      {/* a press on the line keeps the caret in the box, the mon pressed gone to */}
      <div
        className="review-find-row"
        onMouseDown={(e) => {
          if (e.target !== inputRef.current) {
            e.preventDefault();
          }
        }}
      >
        <span aria-hidden="true" className="review-find-slash">/</span>
        <input
          aria-label={t('review.find')}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="review-find-input"
          onBlur={() => onFold(false)}
          onChange={(e) => {
            setText(e.target.value);
            setPick(0);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) {
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onFold(true);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (lit >= 0) {
                onGo(hits[lit].pokemon.id);
              } else if (!hasQuery(text)) {
                onFold(true);
              }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
              e.preventDefault();
              step(e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1);
            } else if (e.key === 'Backspace' && text === '' && onLetGo) {
              e.preventDefault();
              onLetGo();
            }
          }}
          placeholder={t('review.find')}
          ref={inputRef}
          spellCheck="false"
          tabIndex={open ? 0 : -1}
          type="text"
          value={text}
        />
        <ol className="review-find-hits" ref={hitsRef}>
          {hits.map((capture, i) => {
            const outside = !run.has(capture.pokemon.id);
            return (
              <li key={capture.pokemon.id}>
                <button
                  className={classNames('review-find-hit', { picked: i === lit, outside })}
                  onClick={() => onGo(capture.pokemon.id)}
                  tabIndex={-1}
                  title={outside ? t('review.findOutside') : undefined}
                  type="button"
                >
                  <span className="review-find-mon"><i className={monIcon(capture, dex)} /></span>
                  <span className="review-find-no">{dexNumber(capture.pokemon, dex)}</span>
                  <PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} />
                </button>
              </li>
            );
          })}
        </ol>
        <span className="review-find-count">
          {hasQuery(text) && (lit >= 0 ? t('review.findCount', { n: lit + 1, total: hits.length }) : t('review.findNone'))}
        </span>
        <span className="review-find-keys"><kbd>Enter</kbd><kbd>Esc</kbd></span>
      </div>
    </div>
  );
}
