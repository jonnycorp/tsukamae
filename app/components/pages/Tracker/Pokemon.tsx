import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faBan, faCheck, faCircleExclamation, faGripVertical, faLink } from '@fortawesome/free-solid-svg-icons';
import { memo, useEffect, useRef, useState } from 'react';

import { ENTRY_DRAG } from '../../../utils/free-dex';
import { STATUSES, statusKey, unansweredFields } from '../../../utils/capture-fields';
import { SlotsLine, flipsName, liftsSprite } from './seal-faces';
import { PokemonName, displayName } from '../../library/PokemonName';
import { defaultStatus } from '../../../utils/local-data';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { isDisplaySealed, tileTint, useTrackerActions } from './use-tracker';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLongPress } from '../../../hooks/use-long-press';
import { useMark } from './use-mark';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, CaptureStatus, PokemonType } from '../../../types';
import type { CSSProperties, Dispatch, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// a checklist's status buttons, the only ones a tile has: its Temporary is Elsewhere, a copy held in another dex
const STATUS_ICONS: Record<CaptureStatus, IconDefinition> = {
  caught: faCheck,
  temporary: faLink,
  unobtainable: faBan,
};

// a sealed tile held this long unseals (the review's unseal is held as long)
export const UNSEAL_HOLD = { delay: 250, duration: 1000 };

// a tile's types at its foot (styles/tile-types.scss): their colours, and their glyphs as masks, the first over the
// second, a single type's where the second's would be
function typeVars (types: PokemonType[] | undefined): CSSProperties | undefined {
  if (!types?.length) {
    return undefined;
  }
  const [a, b = a] = types;
  return {
    '--type-a': `var(--type-${a})`,
    '--type-b': `var(--type-${b})`,
    '--glyph-a': `url(/types/${a}.svg)`,
    '--glyph-b': types.length > 1 ? `url(/types/${b}.svg)` : 'none',
    '--glyph-a-at': types.length > 1 ? 'center top' : 'center bottom',
  } as CSSProperties;
}

interface Point {
  x: number;
  y: number;
}

function UnsealRing ({ at }: { at: Point }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const follow = (e: PointerEvent) => {
      ref.current?.style.setProperty('left', `${e.clientX}px`);
      ref.current?.style.setProperty('top', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', follow);
    return () => window.removeEventListener('pointermove', follow);
  }, []);

  // portalled out: a box's tile grid has paint containment, which would anchor a fixed ring to the grid
  return createPortal(
    <div
      className="unseal-ring"
      ref={ref}
      style={{ left: at.x, top: at.y, '--hold': `${UNSEAL_HOLD.duration}ms` } as CSSProperties}
    />,
    document.body,
  );
}

interface Props {
  capture: Capture;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
  // in a free-form dex's box opened to arrange (FreeBoxes, which takes the drop): the mon's grip
  arrange?: boolean;
}

export const Pokemon = memo(function Pokemon ({ arrange = false, capture, setSelectedPokemon }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { setCaptures, updateCapture, releaseCaptures, holdHost, narrow } = useTrackerActions();
  const mark = useMark();
  const { t, locale } = useTranslation();

  const [armed, setArmed] = useState(false);

  const checklist = Boolean(activeDex!.checklist);
  const displaySealed = isDisplaySealed(capture, checklist);

  const suppressClickRef = useRef(false);
  const { wheel, handlers: unsealHandlers } = useLongPress({
    ...UNSEAL_HOLD,
    onRelease: (engaged) => {
      suppressClickRef.current = engaged;
    },
    onComplete: () => {
      suppressClickRef.current = true;
      if (checklist) {
        releaseCaptures([capture.pokemon.id]);
        return;
      }
      setCaptures((prev) => prev.map((cap) => (cap.pokemon.id === capture.pokemon.id ? { ...cap, sealed: false } : cap)));
      updateCapture({ pokemon: capture.pokemon.id, sealed: false });
    },
  });

  const dex = activeDexView!;
  const number = dexNumber(capture.pokemon, dex);
  const icon = iconClass(capture.pokemon, dex);

  // every press starts unsuppressed: a hold completed and released off the tile leaves no click to swallow, and the
  // tile, no longer holdable, would otherwise swallow the next real one
  const pressHandlers = (checklist ? capture.captured : displaySealed)
    ? {
      ...unsealHandlers,
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        suppressClickRef.current = false;
        unsealHandlers.onPointerDown(e);
      },
    }
    : {
      onPointerDown: () => {
        suppressClickRef.current = false;
      },
    };

  // a press: an unmarked mon marked (as the dex's default) and nothing more, so a run of them goes one-handed; a marked
  // one's popover opened, so a second press opens what the first marked (kept where it was in a view it no longer
  // matches, Missing's, useHeldTiles in Dex). Shift never opens (a marked one it leaves be, so a run of Shift+clicks
  // opens nothing); Alt opens it without marking (its links, a look at the mon), which a checklist, having no popover,
  // leaves be
  const handleTileClick = (e: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (checklist && (capture.captured || e.altKey)) {
      return;
    }
    if (!capture.captured && !e.altKey) {
      mark(capture.pokemon.id, defaultStatus(activeDex!));
      holdHost.current?.(capture.pokemon.id);
    } else if (!e.shiftKey || e.altKey) {
      setSelectedPokemon(capture.pokemon.id);
    }
  };

  const handleStatusClick = (e: MouseEvent<HTMLButtonElement>, status: CaptureStatus) => {
    e.stopPropagation();
    mark(capture.pokemon.id, status);
    holdHost.current?.(capture.pokemon.id);
  };

  // a sealed mon away from where its dex keeps them is tinted for where it is, and a checklist's Elsewhere as a mon
  // checked out of HOME is (use-tracker's tileTint)
  const tint = displaySealed ? tileTint(capture, checklist, activeDexView!.game.id === 'home') : null;
  // a sealed mon whose sprite FlipStrips draws over the tile (liftsSprite), the tile's own hidden under it
  const lifted = displaySealed && !checklist && liftsSprite(capture);
  const classes = classNames('pokemon', tint && `loc-${tint}`, {
    captured: capture.captured,
    unobtainable: capture.status === 'unobtainable',
    temporary: capture.status === 'temporary',
    caught: capture.status === 'caught',
    sealed: displaySealed,
    checklist,
    lifted,
  });

  const speciesName = <PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} />;
  // what a right-click anywhere on the tile copies (NameCopy), the flipping name drawn over it included
  const copyName = displayName(capture.pokemon.name, capture.pokemon.name_ja, locale);
  // a checklist's check and its Elsewhere are held to clear, as a seal is held to unseal
  const statusButtons = checklist && !narrow && !displaySealed ? STATUSES.filter((status) => status !== capture.status) : [];

  const unsealRing = wheel && <UnsealRing at={wheel} />;

  const stale = capture.sealed ? unansweredFields(capture, capture.pokemon.gender_lock) : [];
  const stalePin = stale.length > 0 &&
    <FontAwesomeIcon
      className="stale-pin"
      icon={faCircleExclamation}
      title={t('seal.stale', { fields: stale.map((field) => t(field.labelKey)).join(t('common.listSeparator')) })}
    />;

  if (narrow) {
    return (
      <div className={classes} data-copy-name={copyName} data-pokemon-id={capture.pokemon.id}>
        <div className="set-captured-mobile" onClick={handleTileClick} {...pressHandlers}>
          <div className="icon-wrapper">
            <i className={icon} />
          </div>
          <h4>{speciesName}</h4>
          <p>#{number}</p>
        </div>
        {stalePin}
        {unsealRing}
      </div>
    );
  }

  // lines that flip are drawn by the grid's FlipStrips, which a checklist has none of: the tile keeps their space, and
  // a checklist's checked tile draws its number line itself
  const flips = displaySealed && !checklist;

  const nameLine = flips && flipsName(capture) ? <div className="name-scroll" /> : <h4>{speciesName}</h4>;

  let numberLine: ReactNode = <p>#{number}</p>;
  if (displaySealed) {
    numberLine = <div className="number-scroll">{!flips && <SlotsLine capture={capture} number={number} />}</div>;
  }

  return (
    <div
      className={classes}
      data-copy-name={copyName}
      data-pokemon-id={capture.pokemon.id}
      onMouseEnter={statusButtons.length > 0 && !armed ? () => setArmed(true) : undefined}
      style={typeVars(capture.pokemon.types)}
    >
      {stalePin}
      {/* a free-form dex's mon in a box opened to arrange is moved by its grip, to another slot or onto an open
          box's name (FreeBoxes); a locked box's have none, nor a search's results, where nothing takes the drop */}
      {arrange &&
        <span
          className="free-grip"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(ENTRY_DRAG, String(capture.pokemon.id));
            e.dataTransfer.effectAllowed = 'move';
            const tile = e.currentTarget.closest('.pokemon');
            if (tile) {
              e.dataTransfer.setDragImage(tile, 24, 24);
            }
          }}
          title={t('free.drag')}
        >
          <FontAwesomeIcon icon={faGripVertical} />
        </span>
      }
      {armed && statusButtons.length > 0 &&
        <div className="set-status">
          {statusButtons.map((status) => (
            <button
              className={`status-btn status-btn-${status}`}
              key={status}
              onClick={(e) => handleStatusClick(e, status)}
              title={t(statusKey(status, checklist))}
              type="button"
            >
              <FontAwesomeIcon icon={STATUS_ICONS[status]} />
            </button>
          ))}
        </div>
      }
      <div className="set-captured" onClick={handleTileClick} {...pressHandlers}>
        {nameLine}
        <div className="icon-wrapper">
          <i className={icon} />
        </div>
        {numberLine}
      </div>
      {unsealRing}
    </div>
  );
});
