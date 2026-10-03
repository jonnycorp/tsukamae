import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faBan, faCheck, faCircleExclamation, faClock } from '@fortawesome/free-solid-svg-icons';
import { memo, useEffect, useRef, useState } from 'react';

import { EMPTY_METADATA, STATUSES, freshMetadata, unansweredFields, withBaselines } from '../../../utils/capture-fields';
import { BadgeRow, SlotsLine, flippingLines } from './seal-faces';
import { PokemonName } from '../../library/PokemonName';
import { defaultStatus } from '../../../utils/local-data';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { isDisplaySealed, useTrackerActions } from './use-tracker';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLongPress } from '../../../hooks/use-long-press';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, CaptureStatus } from '../../../types';
import type { Dispatch, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const STATUS_ICONS: Record<CaptureStatus, IconDefinition> = {
  caught: faCheck,
  temporary: faClock,
  unobtainable: faBan,
};

const UNSEAL_HOLD = { delay: 250, duration: 1000 };
const NO_FLIPS = { name: false, badges: false, number: false };

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
      style={{ left: at.x, top: at.y, animationDuration: `${UNSEAL_HOLD.duration}ms` }}
    />,
    document.body,
  );
}

interface Props {
  capture: Capture;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export const Pokemon = memo(function Pokemon ({ capture, setSelectedPokemon }: Props) {
  const { activeDex, activeDexView, saves } = useDexContext();
  const { setCaptures, sealFx, updateCapture, releaseCaptures, narrow } = useTrackerActions();
  const { t } = useTranslation();

  const [armed, setArmed] = useState(false);

  const checklist = Boolean(activeDex!.checklist);
  const displaySealed = isDisplaySealed(capture, checklist, sealFx);

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

  const applyStatus = (status: CaptureStatus) => {
    if (displaySealed) {
      return;
    }

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      if (status === 'unobtainable') {
        return { ...cap, ...EMPTY_METADATA, captured: true, status };
      }
      if (cap.captured && cap.status !== 'unobtainable') {
        return checklist ? { ...cap, status } : withBaselines({ ...cap, status });
      }
      // a new mark, or one coming back from unobtainable: as writeCapture builds it
      const fresh = freshMetadata({
        defaults: activeDex!.captureDefaults,
        checklist,
        homeDex: dex.game.id === 'home',
        genderLock: cap.pokemon.gender_lock,
        saves,
      });
      return { ...cap, ...fresh, captured: true, status };
    }));

    updateCapture({ pokemon: capture.pokemon.id, status });

    if (!checklist) {
      setSelectedPokemon(capture.pokemon.id);
    }
  };

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

  const handleTileClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (checklist && capture.captured) {
      return;
    }
    if (capture.captured) {
      setSelectedPokemon(capture.pokemon.id);
    } else {
      applyStatus(defaultStatus(activeDex!));
    }
  };

  const handleStatusClick = (e: MouseEvent<HTMLButtonElement>, status: CaptureStatus) => {
    e.stopPropagation();
    applyStatus(status);
  };

  const classes = classNames('pokemon', {
    captured: capture.captured,
    unobtainable: capture.status === 'unobtainable',
    temporary: capture.status === 'temporary',
    caught: capture.status === 'caught',
    sealed: displaySealed,
    checklist,
    'loc-home': displaySealed && capture.location === 'home',
    'loc-champions': displaySealed && capture.location === 'champions',
  });

  const speciesName = <PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} />;
  const statusButtons = checklist && !narrow && capture.status !== 'caught' ? STATUSES.filter((status) => status !== capture.status) : [];

  const unsealRing = wheel && <UnsealRing at={wheel} />;

  // keyed on the real flag, so it also shows while seal fx is off for fixing
  const stale = capture.sealed ? unansweredFields(capture, capture.pokemon.gender_lock) : [];
  const stalePin = stale.length > 0 &&
    <FontAwesomeIcon
      className="stale-pin"
      icon={faCircleExclamation}
      title={t('seal.stale', { fields: stale.map((field) => t(field.labelKey)).join(t('common.listSeparator')) })}
    />;

  if (narrow) {
    return (
      <div className={classes} data-pokemon-id={capture.pokemon.id}>
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

  // lines that flip are drawn by the grid's FlipStrips, which a checklist has none of; the tile keeps their space
  const flips = displaySealed ? (checklist ? NO_FLIPS : flippingLines(capture)) : null;

  const nameLine = flips?.name ? <div className="name-scroll" /> : <h4>{speciesName}</h4>;

  const sealBadges = displaySealed && !checklist && !flips!.badges &&
    <div className="seal-badges"><BadgeRow capture={capture} /></div>;

  let numberLine: ReactNode = <p>#{number}</p>;
  if (flips) {
    numberLine = <div className="number-scroll">{!flips.number && <SlotsLine capture={capture} number={number} />}</div>;
  }

  return (
    <div
      className={classes}
      data-pokemon-id={capture.pokemon.id}
      onMouseEnter={statusButtons.length > 0 && !armed ? () => setArmed(true) : undefined}
    >
      {sealBadges}
      {stalePin}
      {armed && statusButtons.length > 0 &&
        <div className="set-status">
          {statusButtons.map((status) => (
            <button
              className={`status-btn status-btn-${status}`}
              key={status}
              onClick={(e) => handleStatusClick(e, status)}
              title={t(`status.${status}`)}
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
