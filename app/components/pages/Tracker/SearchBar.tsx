import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimeline, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DexModal } from '../../library/DexModal';
import { FilterBar } from './FilterBar';
import { FlipPauseIndicator } from './FlipPauseIndicator';
import { Header } from '../../library/Header';
import { Progress } from '../../library/Progress';
import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { FlipPause } from './use-flip-clock';
import type { PersonalDex } from '../../../utils/local-data';
import type { TrackerFilters } from './filters';

interface Props {
  filters: TrackerFilters;
  flipPause: FlipPause;
  // unset in a checklist, which keeps no catch dates
  onOpenTimeline?: () => void;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
}

// the dex's header: its name and tags over its progress, the search in the middle with Timeline and the flips' pause
// after it, and the filters' row under them, Edit Dex among the filters
export function SearchBar ({ filters, flipPause, onOpenTimeline, query, setFilters, setQuery }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeDex } = useDexContext();
  const { captures } = useTrackerState();
  const { t } = useTranslation();
  // the dex Edit Dex opened for, so a save can only ever write to that one
  const [editing, setEditing] = useState<PersonalDex | null>(null);

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
          <div className="dex-search-bar-after">
            {onOpenTimeline &&
              <button className="timeline-open" onClick={onOpenTimeline} type="button">
                <FontAwesomeIcon icon={faTimeline} />{t('timeline.open')}
              </button>
            }
            <FlipPauseIndicator face={flipPause.face} paused={flipPause.paused} pick={flipPause.pick} presses={flipPause.presses} toggle={flipPause.toggle} />
          </div>
        </div>
        <div className="dex-search-bar-filters">
          <FilterBar filters={filters} onEditDex={() => setEditing(activeDex)} query={query} setFilters={setFilters} />
        </div>
      </div>
      {editing && <DexModal dex={editing} onRequestClose={() => setEditing(null)} />}
    </div>
  );
}
