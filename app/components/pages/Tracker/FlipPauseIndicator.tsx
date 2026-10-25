import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleDot, faIdCard, faPause, faPlay, faSignature } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { DISPLAY_PAGES } from '../../../utils/display-modes';
import { FACE_KEYS } from './use-flip-clock';
import { useDisplayContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { FacePage } from '../../../utils/display-modes';
import type { FlipPause } from './use-flip-clock';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// keep in sync with $flip-flash in styles/tracker.scss: the words' slide off to the side
const FLASH_MS = 1200;

// each page's sign in the picker; the species' shows one of the type glyphs it puts on the tiles
const PAGE_ICONS: Record<FacePage, IconDefinition | null> = {
  record: faIdCard,
  trainer: faSignature,
  hub: faCircleDot,
  species: null,
};

// Space's answer, at the end of the filters' row: a pause button for as long as the flips are held, and beside it, from
// the moment they're held, a picker for the page they hold (1 2 3 too, the display mode's pages in its order); each
// press's words slide off to the side and go. A mode with nothing to flip (Orbit) shows none of it, its room kept
export function FlipPauseIndicator ({ paused: held, face, presses, toggle, pick }: FlipPause) {
  const { t } = useTranslation();
  const { display } = useDisplayContext();
  const pages = DISPLAY_PAGES[display];
  const flips = pages.length > 1;
  const paused = held && flips;
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
    <div className={classNames('flip-indicator', { flash: flash && flips, paused })}>
      <div aria-hidden={!paused} aria-label={t('flips.faces')} className="flip-picker" role="radiogroup">
        {pages.map((page, i) => (
          <button
            aria-checked={face === i}
            aria-label={t(`flips.page.${page}`)}
            className={classNames('flip-face', { active: face === i })}
            key={page}
            onClick={(e) => {
              pick(i);
              // a face clicked lets the focus go, or Space would press it again (and do nothing) instead of resuming;
              // one picked from the keyboard keeps it
              if (e.detail > 0) {
                e.currentTarget.blur();
              }
            }}
            role="radio"
            tabIndex={paused ? 0 : -1}
            title={`${t(`flips.page.${page}`)} (${FACE_KEYS[i]})`}
            type="button"
          >
            {PAGE_ICONS[page]
              ? <FontAwesomeIcon icon={PAGE_ICONS[page]!} />
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
