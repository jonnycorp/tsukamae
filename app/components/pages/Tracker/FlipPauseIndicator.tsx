import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { useTranslation } from '../../../hooks/use-translation';

import type { FlipPause } from './use-flip-clock';

const FLASH_MS = 1200;

// Space's answer: each press flashes what it did, and while the flips are held a quieter pill stays up to say so
export function FlipPauseIndicator ({ paused, presses }: FlipPause) {
  const { t } = useTranslation();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (presses === 0) {
      return;
    }
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [presses]);

  // the label stays through the fade out, rather than leaving an empty pill to fade
  return (
    <div aria-hidden={!paused && !flash} aria-live="polite" className={classNames('flip-indicator', { flash, paused })} role="status">
      <FontAwesomeIcon icon={paused ? faPause : faPlay} />
      {t(paused ? 'flips.paused' : 'flips.resumed')}
    </div>
  );
}
