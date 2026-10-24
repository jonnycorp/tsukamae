import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faCheck, faHouse } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { OriginMark, hasOriginMark } from './seal-faces';
import { destinations, placeKey, placeLabel, placeOf, samePlace } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerActions, useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { GameSave, Place } from '../../../types';
import type { MoveTarget } from './use-tracker';

const EDGE = 8;

function PlaceIcon ({ place, saves }: { place: Place; saves: GameSave[] }) {
  if (place.location === 'home') {
    return <FontAwesomeIcon className="move-menu-icon" icon={faHouse} />;
  }
  if (place.location === 'champions') {
    return <img alt="" className="move-menu-mark" src="/marks/champions.png" />;
  }
  const save = saves.find((entry) => entry.id === place.location_save);
  // a game without a mark keeps the mark's room, so its name lines up with the rest
  return save && hasOriginMark(save.game) ? <OriginMark game={save.game} /> : <span className="move-menu-icon" />;
}

// where a sealed mon can be moved, in a menu beside its tile (L over it): HOME, each of your games, and Champions in a
// HOME dex, with where it is ticked. Picking a place moves it there. Arrows, Home/End, Enter or Space as in the
// dropdowns; L again, Escape, a press outside, a scroll or a resize close it
export function MoveMenu () {
  const { captures } = useTrackerState();
  const { moveTo, moveMenuHost } = useTrackerActions();
  const { saves, activeDexView } = useDexContext();
  const { t, locale } = useTranslation();
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const [active, setActive] = useState(0);
  const [style, setStyle] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    moveMenuHost.current = setTarget;
    return () => {
      moveMenuHost.current = null;
    };
  }, [moveMenuHost]);

  const capture = target ? captures.find((cap) => cap.pokemon.id === target.pokemon) : undefined;
  const open = Boolean(target && capture?.sealed);
  const here = capture ? placeOf(capture) : null;
  const places = useMemo(() => (open ? destinations(saves, activeDexView?.game.id === 'home') : []), [open, saves, activeDexView]);

  const close = () => setTarget(null);

  const pick = (place: Place | undefined) => {
    if (place && capture && !(here && samePlace(place, here))) {
      moveTo(capture.pokemon.id, place);
    }
    close();
  };

  // beside the tile, below it where there's room and above where there isn't (unfurling up from it), as wide as its
  // widest place, inside the window; opened at where the mon is, as the dropdowns open at their selection
  useLayoutEffect(() => {
    if (!open || !target) {
      return;
    }
    const { anchor } = target;
    const height = menuRef.current?.offsetHeight ?? 0;
    const width = menuRef.current?.offsetWidth ?? 0;
    const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));
    setStyle(anchor.bottom + height <= window.innerHeight - EDGE
      ? { top: anchor.bottom + 4, left }
      : { bottom: window.innerHeight - anchor.top + 4, left });
    setActive(Math.max(0, places.findIndex((place) => here !== null && samePlace(place, here))));
  }, [open, target]);

  // the keys the open menu takes are claimed, so none reaches the page's hotkeys (Space's pause among them)
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key === 'Escape' || e.key === 'Tab') {
        if (e.key === 'Escape') {
          e.preventDefault();
        }
        close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((index) => (index + (e.key === 'ArrowDown' ? 1 : -1) + places.length) % places.length);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : places.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(places[active]);
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (!e.repeat) {
          close();
        }
      }
    };
    const handleMousedown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        close();
      }
    };
    const handleScroll = (e: Event) => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) {
        close();
      }
    };
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('mousedown', handleMousedown, true);
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('mousedown', handleMousedown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, places, active, target]);

  if (!open || !capture) {
    return null;
  }

  return createPortal(
    <ul aria-label={t('move.title')} className="dropdown-menu move-menu" data-up={style.bottom !== undefined || undefined} ref={menuRef} role="menu" style={style}>
      {places.map((place, index) => {
        const current = here !== null && samePlace(place, here);
        return (
          <li
            aria-disabled={current}
            className={classNames({ 'dropdown-selected': current, 'dropdown-active': index === active })}
            key={placeKey(place)}
            onClick={() => pick(place)}
            onMouseEnter={() => setActive(index)}
            role="menuitem"
          >
            <PlaceIcon place={place} saves={saves} />
            <span>{placeLabel(place, saves, locale)}</span>
            {current && <FontAwesomeIcon className="dropdown-check" icon={faCheck} />}
          </li>
        );
      })}
    </ul>,
    document.body,
  );
}
