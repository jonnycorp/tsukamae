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

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { TrackerFilters } from './use-tracker';

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
  const { setShowLanguageTags, setShowOriginMarks, showLanguageTags, showOriginMarks } = useLocalStorageContext();
  const { t } = useTranslation();

  // a checklist has no metadata, so only presence can filter
  const checklist = Boolean(activeDex?.checklist);
  const filterMeta = checklist ? FILTER_META.filter((meta) => meta.id === 'hideMarked') : FILTER_META;

  // the bar owns the dex summary counts
  const marked = useMemo(() => captures.filter(({ captured }) => captured).length, [captures]);
  const temporary = useMemo(() => captures.filter((capture) => capture.status === 'temporary').length, [captures]);
  const caught = useMemo(() => captures.filter((capture) => capture.status === 'caught').length, [captures]);

  useEffect(() => {
    const handleKeyup = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.tagName.toLowerCase() !== 'input' && e.key === '/') {
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keyup', handleKeyup);

    return () => document.removeEventListener('keyup', handleKeyup);
  }, [inputRef.current]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);
  const handleFilterChange = (id: keyof TrackerFilters, checked: boolean) => setFilters((prev) => ({ ...prev, [id]: checked }));
  const handleOriginMarksChange = (e: ChangeEvent<HTMLInputElement>) => setShowOriginMarks(e.target.checked);
  const handleLanguageTagsChange = (e: ChangeEvent<HTMLInputElement>) => setShowLanguageTags(e.target.checked);

  const handleClearClick = () => {
    setQuery('');
    inputRef.current && inputRef.current.focus();
  };

  return (
    <div className="dex-search-bar">
      <div className="dex-search-bar-inner">
        <div className="dex-search-bar-summary">
          <Header />
          <Progress caught={caught} marked={marked} temporary={temporary} total={captures.length} />
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
              onChange={handleInputChange}
              placeholder={t('search.placeholder')}
              ref={inputRef}
              spellCheck="false"
              type="text"
              value={query}
            />
            {query.length > 0 ?
              <a className="clear-btn" onClick={handleClearClick}>
                <FontAwesomeIcon className="input-icon" icon={faTimes} />
              </a> :
              null
            }
          </div>
          <div className="dex-search-bar-filters">
            {filterMeta.map((meta) => (
              <div className="form-group" key={meta.id}>
                <div className="checkbox">
                  <label>
                    <input
                      checked={filters[meta.id]}
                      id={meta.id}
                      name={meta.id}
                      onChange={(e) => handleFilterChange(meta.id, e.target.checked)}
                      type="checkbox"
                    />
                    <span className="checkbox-custom"><span /></span>{t(meta.labelKey)}
                  </label>
                </div>
              </div>
            ))}
            {!checklist && <>
              <div className="form-group">
                <div className="checkbox">
                  <label>
                    <input
                      checked={showOriginMarks}
                      id="origin-marks"
                      name="origin-marks"
                      onChange={handleOriginMarksChange}
                      type="checkbox"
                    />
                    <span className="checkbox-custom"><span /></span>{t('search.originMarks')}
                  </label>
                </div>
              </div>
              <div className="form-group">
                <div className="checkbox">
                  <label>
                    <input
                      checked={showLanguageTags}
                      id="language-tags"
                      name="language-tags"
                      onChange={handleLanguageTagsChange}
                      type="checkbox"
                    />
                    <span className="checkbox-custom"><span /></span>{t('search.langTags')}
                  </label>
                </div>
              </div>
            </>}
            {TESTING &&
              // dev scaffolding: flips sealed visuals off in place for comparison, no writes
              <div className="form-group">
                <div className="checkbox">
                  <label>
                    <input
                      checked={sealFx}
                      id="seal-fx"
                      name="seal-fx"
                      onChange={(e) => setSealFx(e.target.checked)}
                      type="checkbox"
                    />
                    <span className="checkbox-custom"><span /></span>Seal FX
                  </label>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
