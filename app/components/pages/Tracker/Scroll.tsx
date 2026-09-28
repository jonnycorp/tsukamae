import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltUp } from '@fortawesome/free-solid-svg-icons';

import type { MouseEventHandler } from 'react';

export const SHOW_SCROLL_THRESHOLD = 400;

interface Props {
  onClick: MouseEventHandler<HTMLDivElement>;
  showScroll: boolean;
}

export function Scroll ({ onClick, showScroll }: Props) {
  return (
    <div className={classNames('scroll-up', { visible: showScroll })} onClick={onClick}>
      <FontAwesomeIcon icon={faLongArrowAltUp} />
    </div>
  );
}
