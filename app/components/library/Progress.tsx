import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../hooks/use-translation';

import type { MouseEvent } from 'react';

interface Props {
  caught: number;
  marked: number;
  temporary: number;
  total: number;
}

export function Progress ({ caught, marked, temporary, total }: Props) {
  const { t } = useTranslation();
  const { showProgressBreakdown, setShowProgressBreakdown } = useLocalStorageContext();

  const percent = 100 * marked / total;
  const unobtainable = marked - temporary - caught;

  // landing rows open their dex on click
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setShowProgressBreakdown(!showProgressBreakdown);
  };

  return (
    <div className="progress-container" onClick={handleClick}>
      <div className="progress-outer">
        <div className="progress-numbers">
          <b>{percent.toFixed(1)}%</b> {t('progress.done')}
          {t('progress.open')}<b>{marked}</b> {t('progress.marked')}{t('progress.comma')}<b>{total - marked}</b> {t('progress.toGo')}
          {showProgressBreakdown && temporary > 0 && <>{t('progress.comma')}<b className="temporary-count">{temporary}</b> {t('progress.temporary')}</>}
          {showProgressBreakdown && caught > 0 && <>{t('progress.comma')}<b className="caught-count">{caught}</b> {t('progress.caught')}</>}
          {t('progress.close')}
        </div>
        {showProgressBreakdown
          ? (
            <div className="progress-inner-row">
              <div className="progress-inner progress-inner-caught" style={{ width: `${100 * caught / total}%` }} />
              <div className="progress-inner progress-inner-unobtainable" style={{ width: `${100 * unobtainable / total}%` }} />
              <div className="progress-inner progress-inner-temporary" style={{ width: `${100 * temporary / total}%` }} />
            </div>
          )
          : <div className="progress-inner" style={{ width: `${percent}%` }} />}
      </div>
    </div>
  );
}
