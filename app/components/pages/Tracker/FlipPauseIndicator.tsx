import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag, faPause, faPlay, faSignature } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { useTranslation } from '../../../hooks/use-translation';

import type { FlipPause } from './use-flip-clock';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { TranslationKey } from '../../../i18n/translations';

// keep in sync with $flip-flash in styles/tracker.scss: the words' slide off to the side
const FLASH_MS = 1200;

// the faces the picker holds, in the cycle's order; the types' shows one of the glyphs it puts on the tiles
const FACES: { face: number; labelKey: TranslationKey; icon?: IconDefinition }[] = [
  { face: 0, labelKey: 'flips.face0', icon: faHashtag },
  { face: 1, labelKey: 'flips.face1', icon: faSignature },
  { face: 2, labelKey: 'flips.face2' },
];

// Space's answer, at the end of the filters' row: a pause button for as long as the flips are held, and beside it, from
// the moment they're held, a picker for the face they hold; each press's words slide off to the side and go
export function FlipPauseIndicator ({ paused, face, presses, toggle, pick }: FlipPause) {
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

  // the words start where the picker opens, and it pushes them aside as it wipes open
  return (
    <div className={classNames('flip-indicator', { flash, paused })}>
      <div aria-hidden={!paused} aria-label={t('flips.faces')} className="flip-picker" role="radiogroup">
        {FACES.map((option) => (
          <button
            aria-checked={face === option.face}
            aria-label={t(option.labelKey)}
            className={classNames('flip-face', { active: face === option.face })}
            key={option.face}
            onClick={(e) => {
              pick(option.face);
              // a face clicked lets the focus go, or Space would press it again (and do nothing) instead of resuming;
              // one picked from the keyboard keeps it
              if (e.detail > 0) {
                e.currentTarget.blur();
              }
            }}
            role="radio"
            tabIndex={paused ? 0 : -1}
            title={t(option.labelKey)}
            type="button"
          >
            {option.icon
              ? <FontAwesomeIcon icon={option.icon} />
              : <span className="flip-face-glyph" style={{ maskImage: 'url(/types/grass.svg)' }} />
            }
          </button>
        ))}
      </div>
      <span aria-live="polite" className="flip-indicator-label" role="status">{t(paused ? 'flips.paused' : 'flips.resumed')}</span>
      <button
        aria-label={t(paused ? 'flips.resume' : 'flips.pause')}
        aria-pressed={paused}
        className="flip-indicator-button"
        onClick={toggle}
        title={t(paused ? 'flips.resume' : 'flips.pause')}
        type="button"
      >
        <FontAwesomeIcon icon={paused ? faPause : faPlay} />
      </button>
    </div>
  );
}
