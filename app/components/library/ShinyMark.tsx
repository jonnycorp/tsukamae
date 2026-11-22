import classNames from 'classnames';

import { useTranslation } from '../../hooks/use-translation';

// a shiny mon's mark beside its sprite or its name (styles/shiny.scss): Legends: Arceus' shiny stars, still
export function ShinyMark ({ className }: { className?: string }) {
  const { t } = useTranslation();
  return <span aria-label={t('info.shiny')} className={classNames('shiny-mark', className)} role="img" />;
}
