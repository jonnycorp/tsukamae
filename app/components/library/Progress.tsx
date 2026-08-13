import { decimal } from '../../utils/formatting';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../hooks/use-translation';

import type { MouseEvent } from 'react';

interface Props {
  caught?: number;
  marked: number;
  temporary?: number;
  total: number;
}

// caught and temporary are subsets of marked; the rest is unobtainable
export function Progress ({ caught = 0, marked, temporary = 0, total }: Props) {
  const { t } = useTranslation();
  const { showProgressBreakdown, setShowProgressBreakdown } = useLocalStorageContext();

  const percent = 100 * marked / total;
  const unobtainable = marked - temporary - caught;

  // landing cards are clickable, so the toggle must not open the dex
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setShowProgressBreakdown(!showProgressBreakdown);
  };

  return (
    <div className="progress-container" onClick={handleClick}>
      <div className="progress-outer">
        <div className="progress-numbers">
          <b>{decimal(percent, 1)}%</b> {t('progress.done')}
          {showProgressBreakdown
            ? <span className="mobile"> (<b>{marked}</b> {t('progress.marked')}, <b>{total - marked}</b> {t('progress.toGo')}{temporary > 0 && <>, <b className="temporary-count">{temporary}</b> {t('progress.temporary')}</>}{caught > 0 && <>, <b className="caught-count">{caught}</b> {t('progress.caught')}</>})</span>
            : <span className="mobile"> (<b>{marked}</b> {t('progress.marked')}, <b>{total - marked}</b> {t('progress.toGo')})</span>}
        </div>
        {showProgressBreakdown
          ? (
            <div className="progress-inner-row">
              <div className="progress-inner progress-inner-caught" style={{ width: `${100 * caught / total}%` }} />
              <div className="progress-inner" style={{ width: `${100 * unobtainable / total}%` }} />
              <div className="progress-inner progress-inner-temporary" style={{ width: `${100 * temporary / total}%` }} />
            </div>
          )
          : <div className="progress-inner" style={{ width: `${percent}%` }} />}
      </div>
    </div>
  );
}
