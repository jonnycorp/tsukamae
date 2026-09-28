import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef } from 'react';

import { FILTER_META, useTrackerActions, useTrackerState } from './use-tracker';
import { Header } from '../../library/Header';
import { Progress } from '../../library/Progress';
import { TESTING } from '../../../utils/testing';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import type { TrackerFilters } from './use-tracker';

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
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
}

export function SearchBar ({ filters, query, setFilters, setQuery }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeDex } = useDexContext();
  const { captures } = useTrackerState();
  const { sealFx, setSealFx } = useTrackerActions();
  const { setShowLanguageTags, showLanguageTags } = useLocalStorageContext();
  const { t } = useTranslation();

  const checklist = Boolean(activeDex?.checklist);
  const filterMeta = checklist ? FILTER_META.filter((meta) => meta.id === 'hideMarked') : FILTER_META;

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

  useEffect(() => {
    const handleKeyup = (e: KeyboardEvent) => {
      if (e.key === '/' && e.target instanceof Element && e.target.tagName !== 'INPUT') {
        inputRef.current?.focus();
      }
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
                <a className="clear-btn" onClick={handleClearClick}>
                  <FontAwesomeIcon className="input-icon" icon={faTimes} />
                </a>
              }
            </div>
          </div>
        </div>
        <div className="dex-search-bar-filters">
          {filterMeta.map((meta) => (
            <FilterCheckbox
              checked={filters[meta.id]}
              id={meta.id}
              key={meta.id}
              label={t(meta.labelKey)}
              onChange={(checked) => setFilters((prev) => ({ ...prev, [meta.id]: checked }))}
            />
          ))}
          {!checklist &&
            <FilterCheckbox checked={showLanguageTags} id="language-tags" label={t('search.langTags')} onChange={setShowLanguageTags} />
          }
          {TESTING &&
            <FilterCheckbox checked={sealFx} id="seal-fx" label="Seal FX" onChange={setSealFx} />
          }
        </div>
      </div>
    </div>
  );
}
