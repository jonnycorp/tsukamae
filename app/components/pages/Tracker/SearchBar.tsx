import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DexMenu } from './DexMenu';
import { DexMeter, MeterCounts } from './DexMeter';
import { DexModal } from '../../library/DexModal';
import { FilterBar } from './FilterBar';
import { FlipPauseIndicator } from './FlipPauseIndicator';
import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useSceneScale } from './use-scene-scale';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { DexLayout } from './ledger-model';
import type { FlipPause } from './use-flip-clock';
import type { PersonalDex } from '../../../utils/local-data';
import type { FilterSource } from './FilterBar';
import type { TrackerFilters } from './filters';

// the header grows with a wide window as the scenes do, though less: its height comes out of the boxes' fit
const HEADER_MAX_SCALE = 1.2;

interface Props {
  filters: TrackerFilters;
  flipPause: FlipPause;
  layout: DexLayout;
  onLayout: (layout: DexLayout) => void;
  // unset in a checklist, which keeps no catch dates and no records to review
  onOpenTimeline?: () => void;
  onOpenReview?: () => void;
  onOpenAlmanac: () => void;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  // a scene the filter came from, on a tab in the filters' row (FilterBar)
  source?: FilterSource;
}

// the dex's header: its name (a menu of the scenes, the layouts and Edit Dex) and tags, the search in the middle with
// the flips' pause after it; the meter, its centerpiece, across the whole width under them; the filters' row last
export function SearchBar ({ filters, flipPause, layout, onLayout, onOpenAlmanac, onOpenReview, onOpenTimeline, query, setFilters, setQuery, source }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeDex } = useDexContext();
  const { captures } = useTrackerState();
  const { t } = useTranslation();
  const scale = useSceneScale(HEADER_MAX_SCALE);
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
    <div className="dex-search-bar" style={{ zoom: scale, '--header-zoom': scale } as CSSProperties}>
      <div className="dex-search-bar-inner">
        <div className="dex-search-bar-top">
          <div className="dex-search-bar-summary">
            <DexMenu
              layout={layout}
              onEditDex={() => setEditing(activeDex)}
              onLayout={onLayout}
              onOpenAlmanac={onOpenAlmanac}
              onOpenReview={onOpenReview}
              onOpenTimeline={onOpenTimeline}
            />
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
            <FlipPauseIndicator face={flipPause.face} paused={flipPause.paused} pick={flipPause.pick} presses={flipPause.presses} toggle={flipPause.toggle} />
          </div>
        </div>
        <DexMeter marked={counts.marked} total={captures.length} />
        <div className="dex-search-bar-filters">
          <FilterBar filters={filters} query={query} setFilters={setFilters} source={source} />
          <MeterCounts caught={counts.caught} marked={counts.marked} temporary={counts.temporary} total={captures.length} />
        </div>
      </div>
      {editing && <DexModal dex={editing} onRequestClose={() => setEditing(null)} />}
    </div>
  );
}
