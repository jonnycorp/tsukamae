import { decimal } from '../../utils/formatting';
import { useTranslation } from '../../hooks/use-translation';

interface Props {
  caught: number;
  locked?: number;
  temporary?: number;
  total: number;
}

export function Progress ({ caught, locked = 0, temporary = 0, total }: Props) {
  const { t } = useTranslation();

  const percent = 100 * caught / total;

  return (
    <div className="progress-container">
      <div className="progress-outer">
        <div className="progress-numbers"><b>{decimal(percent, 1)}%</b> {t('progress.done')}<span className="mobile"> (<b>{caught}</b> {t('progress.caught')}, <b>{total - caught}</b> {t('progress.toGo')})</span></div>
        <div className="progress-inner" style={{ width: `${percent}%` }} />
      </div>
      <h3>(<b>{caught}</b> {t('progress.caught')}, <b>{total - caught}</b> {t('progress.toGo')}{temporary > 0 && <>, <b className="temporary-count">{temporary}</b> {t('progress.temporary')}</>}{locked > 0 && <>, <b className="locked-count">{locked}</b> {t('progress.locked')}</>})</h3>
    </div>
  );
}
