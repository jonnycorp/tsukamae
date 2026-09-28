import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

import { useTranslation } from '../../hooks/use-translation';

import type { MouseEvent, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // plays the overlay fade-out while true
  closing: boolean;
  contentLabel: string;
  onDismiss: () => void;
  wide?: boolean;
}

export function ModalShell ({ children, closing, contentLabel, onDismiss, wide = false }: Props) {
  const { t } = useTranslation();

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  };

  return (
    <div className={classNames('modal-overlay', { closing })} onClick={handleOverlayClick}>
      <div aria-label={contentLabel} className={classNames('modal', { 'modal-wide': wide })} role="dialog">
        <button aria-label={t('popover.close')} className="modal-close" onClick={onDismiss} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </div>
    </div>
  );
}
