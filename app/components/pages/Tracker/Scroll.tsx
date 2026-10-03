import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltUp } from '@fortawesome/free-solid-svg-icons';

import { useTranslation } from '../../../hooks/use-translation';

import type { MouseEventHandler } from 'react';

export const SHOW_SCROLL_THRESHOLD = 400;

interface Props {
  onClick: MouseEventHandler<HTMLDivElement>;
  showScroll: boolean;
}

export function Scroll ({ onClick, showScroll }: Props) {
  const { t } = useTranslation();

  return (
    <div aria-label={t('common.backToTop')} className={classNames('scroll-up', { visible: showScroll })} onClick={onClick} role="button" title={t('common.backToTop')}>
      <FontAwesomeIcon icon={faLongArrowAltUp} />
    </div>
  );
}
