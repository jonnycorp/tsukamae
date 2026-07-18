import { decimal } from '../../utils/formatting';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../hooks/use-translation';

import type { MouseEvent } from 'react';

interface Props {
  caught: number;
  locked?: number;
  temporary?: number;
  total: number;
}

// `caught` counts every captured mon; temporary/locked are subsets of it.
export function Progress ({ caught, locked = 0, temporary = 0, total }: Props) {
  const { t } = useTranslation();
  const { showProgressBreakdown, setShowProgressBreakdown } = useLocalStorageContext();

  const percent = 100 * caught / total;
  const plainCaught = caught - temporary - locked;

  // Landing cards live inside a clickable dex tile; the toggle must not open the dex.
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
            ? <span className="mobile"> (<b>{caught}</b> {t('progress.caught')}, <b>{total - caught}</b> {t('progress.toGo')}{temporary > 0 && <>, <b className="temporary-count">{temporary}</b> {t('progress.temporary')}</>}{locked > 0 && <>, <b className="locked-count">{locked}</b> {t('progress.locked')}</>})</span>
            : <span className="mobile"> (<b>{caught}</b> {t('progress.caught')}, <b>{total - caught}</b> {t('progress.toGo')})</span>}
        </div>
        {showProgressBreakdown
          ? (
            <div className="progress-inner-row">
              <div className="progress-inner progress-inner-locked" style={{ width: `${100 * locked / total}%` }} />
              <div className="progress-inner" style={{ width: `${100 * plainCaught / total}%` }} />
              <div className="progress-inner progress-inner-temporary" style={{ width: `${100 * temporary / total}%` }} />
            </div>
          )
          : <div className="progress-inner" style={{ width: `${percent}%` }} />}
      </div>
    </div>
  );
}
