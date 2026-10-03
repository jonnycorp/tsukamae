import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimeline, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef } from 'react';

import { FilterBar } from './FilterBar';
import { Header } from '../../library/Header';
import { Progress } from '../../library/Progress';
import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';
import { TESTING } from '../../../utils/testing';
import { useTrackerActions, useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import type { TrackerFilters } from './filters';

interface CheckboxProps {
  checked: boolean;
  id: string;
  label: ReactNode;
  onChange: (checked: boolean) => void;
}

function FilterCheckbox ({ checked, id, label, onChange }: CheckboxProps) {
  return (
    <div className="form-group">
      <div className="checkbox">
        <label>
          <input checked={checked} id={id} name={id} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
          <span className="checkbox-custom"><span /></span>{label}
        </label>
      </div>
    </div>
  );
}

interface Props {
  filters: TrackerFilters;
  // unset in a checklist, which keeps no catch dates
  onOpenTimeline?: () => void;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
}

export function SearchBar ({ filters, onOpenTimeline, query, setFilters, setQuery }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { captures } = useTrackerState();
  const { sealFx, setSealFx } = useTrackerActions();
  const { t } = useTranslation();

  const counts = useMemo(() => {
    let marked = 0;
    let temporary = 0;
    let caught = 0;
    for (const capture of captures) {
      if (capture.captured) {
        marked++;
      }
      if (capture.status === 'temporary') {
        temporary++;
      } else if (capture.status === 'caught') {
        caught++;
      }
    }
    return { marked, temporary, caught };
  }, [captures]);

  // on keyup, so the slash itself never lands in the box; quiet like the other hotkeys while typing, under a modal or an
  // open menu and beside a modifier
  useEffect(() => {
    const handleKeyup = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      if (document.querySelector(MENU_OR_MODAL)) {
        return;
      }
      inputRef.current?.focus();
    };

    document.addEventListener('keyup', handleKeyup);
    return () => document.removeEventListener('keyup', handleKeyup);
  }, []);

  const handleClearClick = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="dex-search-bar">
      <div className="dex-search-bar-inner">
        <div className="dex-search-bar-top">
          <div className="dex-search-bar-summary">
            <Header />
            <Progress caught={counts.caught} marked={counts.marked} temporary={counts.temporary} total={captures.length} />
          </div>
          <div className="dex-search-bar-search">
            <div className="form-group">
              <FontAwesomeIcon icon={faSearch} />
              <input
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="form-control"
                id="search"
                name="search"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                ref={inputRef}
                spellCheck="false"
                type="text"
                value={query}
              />
              {query.length > 0 &&
                <a aria-label={t('search.clear')} className="clear-btn" onClick={handleClearClick} title={t('search.clear')}>
                  <FontAwesomeIcon icon={faTimes} />
                </a>
              }
            </div>
          </div>
        </div>
        <div className="dex-search-bar-filters">
          <FilterBar filters={filters} query={query} setFilters={setFilters} />
          {onOpenTimeline &&
            <button className="timeline-open" onClick={onOpenTimeline} type="button">
              <FontAwesomeIcon icon={faTimeline} />{t('timeline.open')}
            </button>
          }
          {TESTING &&
            <div className="dex-search-bar-options">
              <FilterCheckbox checked={sealFx} id="seal-fx" label="Seal FX" onChange={setSealFx} />
            </div>
          }
        </div>
      </div>
    </div>
  );
}
