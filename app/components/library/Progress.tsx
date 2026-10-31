import { useTranslation } from '../../hooks/use-translation';

import type { TranslationKey } from '../../i18n/translations';

interface Props {
  caught: number;
  // a checklist's Temporary is Elsewhere; a free-form dex counts its sealed mons of all it holds
  checklist?: boolean;
  free?: boolean;
  marked: number;
  temporary: number;
  total: number;
}

// always broken down by status: caught, then unobtainable, then temporary (striped)
export function Progress ({ caught, checklist = false, free = false, marked, temporary, total }: Props) {
  const { t } = useTranslation();

  // of the whole, as a percentage; a free-form dex holding nothing yet has no whole
  const share = (n: number) => (total > 0 ? (100 * n) / total : 0);
  const percent = share(marked);
  const unobtainable = free ? 0 : marked - temporary - caught;

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
          {t('progress.open')}{count(free ? 'progress.sealedOnly' : 'progress.marked', marked)}{t('common.listSeparator')}{count('progress.toGo', total - marked)}
          {temporary > 0 && <>{t('common.listSeparator')}{count(checklist ? 'progress.elsewhere' : 'progress.temporary', temporary, 'temporary-count')}</>}
          {caught > 0 && <>{t('common.listSeparator')}{count('progress.caught', caught, 'caught-count')}</>}
          {t('progress.close')}
        </div>
        <div className="progress-inner-row">
          <div className="progress-inner progress-inner-caught" style={{ width: `${share(free ? marked : caught)}%` }} />
          <div className="progress-inner progress-inner-unobtainable" style={{ width: `${share(unobtainable)}%` }} />
          <div className="progress-inner progress-inner-temporary" style={{ width: `${share(temporary)}%` }} />
        </div>
      </div>
    </div>
  );
}
