import { useTranslation } from '../../hooks/use-translation';

import type { TranslationKey } from '../../i18n/translations';

interface Props {
  caught: number;
  marked: number;
  temporary: number;
  total: number;
}

// always broken down by status: caught, then unobtainable, then temporary (striped)
export function Progress ({ caught, marked, temporary, total }: Props) {
  const { t } = useTranslation();

  const percent = 100 * marked / total;
  const unobtainable = marked - temporary - caught;

  // a template's {n} drawn bold, wherever the language puts it: "476 marked", 記録済み476
  const count = (key: TranslationKey, n: number | string, className?: string) => {
    const [before, after] = t(key).split('{n}');
    return <>{before}<b className={className}>{n}</b>{after}</>;
  };

  return (
    <div className="progress-container">
      <div className="progress-outer">
        <div className="progress-numbers">
          {count('progress.done', `${percent.toFixed(1)}%`)}
          {t('progress.open')}{count('progress.marked', marked)}{t('common.listSeparator')}{count('progress.toGo', total - marked)}
          {temporary > 0 && <>{t('common.listSeparator')}{count('progress.temporary', temporary, 'temporary-count')}</>}
          {caught > 0 && <>{t('common.listSeparator')}{count('progress.caught', caught, 'caught-count')}</>}
          {t('progress.close')}
        </div>
        <div className="progress-inner-row">
          <div className="progress-inner progress-inner-caught" style={{ width: `${100 * caught / total}%` }} />
          <div className="progress-inner progress-inner-unobtainable" style={{ width: `${100 * unobtainable / total}%` }} />
          <div className="progress-inner progress-inner-temporary" style={{ width: `${100 * temporary / total}%` }} />
        </div>
      </div>
    </div>
  );
}
