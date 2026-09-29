import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef } from 'react';

import { dimTitleBar } from '../../palette/apply-theme';
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
  const pressedOnOverlayRef = useRef(false);

  // the backdrop dims the nav; the window buttons drawn over it fade with it, back out as soon as it starts fading out
  useEffect(() => {
    if (closing) {
      return;
    }
    dimTitleBar(true);
    return () => dimTitleBar(false);
  }, [closing]);

  // a click that starts and ends on the backdrop; a text selection dragged out of a field and released there lands on
  // the backdrop too, and mustn't throw the form away. Nor may a press that only closes a menu open in the form, as
  // Escape there closes just the menu; it's still mounted here, its own outside-press listener being on the document
  const handleOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    pressedOnOverlayRef.current = e.target === e.currentTarget && !e.currentTarget.querySelector('.dropdown-menu');
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && pressedOnOverlayRef.current) {
      onDismiss();
    }
  };

  // portalled into body, so it covers the nav whichever page opens it: in the landing page's stacking context it painted
  // under the nav, which stayed lit and clickable, and inherited that page's centred text
  return createPortal(
    <div className={classNames('modal-overlay', { closing })} onClick={handleOverlayClick} onMouseDown={handleOverlayMouseDown}>
      <div aria-label={contentLabel} className={classNames('modal', { 'modal-wide': wide })} role="dialog">
        <button aria-label={t('popover.close')} className="modal-close" onClick={onDismiss} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
