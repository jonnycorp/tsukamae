import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useTranslation } from '../../../hooks/use-translation';

// a little after the tag's 1s rise and fade (.name-copied in styles/tracker.scss) has played out
const SHOWN_MS = 1100;
// the tag keeps this far inside the window's sides
const EDGE = 8;
// the timeline's hover card, which names the mon from above it
const HOVER_CARD = '.tl-card';
// tiles a press is held on to unseal or release (Pokemon.tsx): a finger's hold raises a contextmenu of its own partway
// through, which is that hold, not a copy
const HELD = '.pokemon.sealed, .pokemon.checklist.captured';

interface Copied {
  x: number;
  y: number;
  // below the pointer, as a hover card is above it
  under: boolean;
  // counts the copies, so another one restarts the tag rather than finding it half faded
  n: number;
}

// a right-click on a Pokémon (a tile, the name atop the popover, a mon on the timeline: whatever carries
// data-copy-name) copies its name as shown, and a tag at the pointer says so. One listener for the page, so the tiles
// pay nothing for it
export function NameCopy () {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<Copied | null>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const source = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-copy-name]') : null;
      if (!source) {
        return;
      }
      e.preventDefault();
      if ((e as PointerEvent).pointerType === 'touch' && source.closest(HELD)) {
        return;
      }
      const { clientX: x, clientY: y } = e;
      const card = document.querySelector(HOVER_CARD)?.getBoundingClientRect();
      const under = Boolean(card && card.bottom <= y);
      navigator.clipboard.writeText(source.dataset.copyName!).then(
        () => setCopied((prev) => ({ x, y, under, n: (prev?.n ?? 0) + 1 })),
        (err) => {
          // eslint-disable-next-line no-console
          console.error('failed to copy:', err);
        },
      );
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(null), SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // centred over the pointer, but kept inside the window, where a tile at its edge would cut the tag in half
  useLayoutEffect(() => {
    const tag = tagRef.current;
    if (!copied || !tag) {
      return;
    }
    const half = tag.offsetWidth / 2 + EDGE;
    tag.style.left = `${Math.min(Math.max(copied.x, half), window.innerWidth - half)}px`;
  }, [copied]);

  if (!copied) {
    return null;
  }

  // portalled, so it rises over the timeline and the popover too
  return createPortal(
    <div className={classNames('name-copied', { under: copied.under })} key={copied.n} ref={tagRef} role="status" style={{ left: copied.x, top: copied.y }}>
      <FontAwesomeIcon icon={faCheck} />
      {t('name.copied')}
    </div>,
    document.body,
  );
}
