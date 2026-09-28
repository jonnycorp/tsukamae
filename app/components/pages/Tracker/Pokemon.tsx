import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faCheck, faClock, faExchangeAlt, faGift, faHeart, faLock, faMapMarkerAlt, faMars, faVenus } from '@fortawesome/free-solid-svg-icons';
import { memo, useEffect, useRef, useState } from 'react';

import { BALL_NAMES, EMPTY_METADATA, LANGUAGE_ABBRS, MYSTERY_GIFT, ORIGIN_GAME_NAMES, STATUSES, genderFromLock, lookupOT, metadataFromDefaults } from '../../../utils/capture-fields';
import { PokemonName } from '../../library/PokemonName';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { isDisplaySealed, useTrackerActions } from './use-tracker';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useLongPress } from '../../../hooks/use-long-press';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, CaptureStatus } from '../../../types';
import type { Dispatch, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const STATUS_ICONS: Record<CaptureStatus, IconDefinition> = {
  caught: faLock,
  temporary: faClock,
  unobtainable: faCheck,
};

const ORIGIN_MARK_ICONS: Record<string, IconDefinition> = {
  trade: faExchangeAlt,
  go: faMapMarkerAlt,
  [MYSTERY_GIFT]: faGift,
};

// sprites come from yarn sprites:marks; trade and mystery gift fall back to glyphs
const ORIGIN_MARK_SPRITES: Record<string, string> = {
  x: 'pentagon',
  y: 'pentagon',
  omega_ruby: 'pentagon',
  alpha_sapphire: 'pentagon',
  sun: 'clover',
  moon: 'clover',
  ultra_sun: 'clover',
  ultra_moon: 'clover',
  lets_go_pikachu: 'lets-go',
  lets_go_eevee: 'lets-go',
  sword: 'galar',
  shield: 'galar',
  brilliant_diamond: 'sinnoh',
  shining_pearl: 'sinnoh',
  legends_arceus: 'hisui',
  scarlet: 'paldea',
  violet: 'paldea',
  legends_za: 'za',
  go: 'go',
};

const UNSEAL_HOLD = { delay: 250, duration: 1000 };

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

  // portalled out: .box has paint containment, which would anchor a fixed ring to the box
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
  const { setCaptures, sealFx, updateCapture, deleteCaptures, narrow } = useTrackerActions();
  const { showLanguageTags } = useLocalStorageContext();
  const { t, locale } = useTranslation();

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
        setCaptures((prev) => prev.map((cap) => (cap.pokemon.id === capture.pokemon.id
          ? { ...cap, ...EMPTY_METADATA, captured: false, status: null, sealed: false }
          : cap)));
        deleteCaptures([capture.pokemon.id]);
        return;
      }
      setCaptures((prev) => prev.map((cap) => (cap.pokemon.id === capture.pokemon.id ? { ...cap, sealed: false } : cap)));
      updateCapture({ pokemon: capture.pokemon.id, sealed: false });
    },
  });

  const dex = activeDexView!;
  const number = dexNumber(capture.pokemon, dex);
  const icon = iconClass(capture.pokemon, dex);
  const gift = capture.origin_game === MYSTERY_GIFT;

  const applyStatus = (status: CaptureStatus) => {
    if (displaySealed) {
      return;
    }

    const defaults = metadataFromDefaults(activeDex!.captureDefaults);

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      if (status === 'unobtainable') {
        return { ...cap, ...EMPTY_METADATA, captured: true, status };
      }
      if (cap.captured) {
        return { ...cap, status };
      }
      return {
        ...cap,
        ...defaults,
        captured: true,
        status,
        location: dex.game.id === 'home' ? 'home' : 'game',
        location_save: null,
        gender: genderFromLock(cap.pokemon.gender_lock),
        ot: lookupOT(saves, defaults.origin_game ?? null, defaults.language ?? null),
      };
    }));

    updateCapture({ pokemon: capture.pokemon.id, status });

    if (!checklist) {
      setSelectedPokemon(capture.pokemon.id);
    }
  };

  const pressHandlers = displaySealed
    ? {
      ...unsealHandlers,
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        suppressClickRef.current = false;
        unsealHandlers.onPointerDown(e);
      },
    }
    : {};

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
      applyStatus(activeDex!.captureDefaults?.status ?? 'caught');
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
  const statusButtons = displaySealed || checklist || narrow ? [] : STATUSES.filter((status) => status !== capture.status);

  const unsealRing = wheel && <UnsealRing at={wheel} />;

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
        {unsealRing}
      </div>
    );
  }

  const nickname = displaySealed && capture.has_nickname ? capture.nickname : null;
  const nameLine = nickname
    ? (
      <div className="name-scroll">
        <div className="name-scroll-track">
          <h4>{speciesName}</h4>
          <h4><span className="nickname">{nickname}</span></h4>
          <h4>{speciesName}</h4>
        </div>
      </div>
    )
    : <h4>{speciesName}</h4>;

  let sealBadges: ReactNode = null;
  let numberLine: ReactNode = <p>#{number}</p>;

  if (displaySealed && !checklist) {
    const originName = capture.origin_game
      ? localizeOriginGame(locale, capture.origin_game, ORIGIN_GAME_NAMES.get(capture.origin_game) || capture.origin_game)
      : '';
    const originMarkSprite = capture.origin_game ? ORIGIN_MARK_SPRITES[capture.origin_game] : null;

    const badgeRow = (
      <span className="badge-row">
        <span className="badge-slot">
          {capture.ball && capture.ball !== 'unknown' &&
            <img alt="" className="ball-badge" src={`/balls/${capture.ball}.png`} title={localizeBall(locale, capture.ball, BALL_NAMES.get(capture.ball) || capture.ball)} />
          }
        </span>
        <span className="badge-slot">
          {originMarkSprite &&
            <img alt="" src={`/marks/${originMarkSprite}.png`} title={originName} />
          }
          {!originMarkSprite && capture.origin_game && ORIGIN_MARK_ICONS[capture.origin_game] &&
            <FontAwesomeIcon className={gift ? 'gift-badge' : undefined} icon={ORIGIN_MARK_ICONS[capture.origin_game]} title={originName} />
          }
        </span>
        <span className="badge-slot">
          {(capture.favorite === 'favorite' || capture.favorite === 'partner') &&
            <FontAwesomeIcon
              className={classNames('heart-badge', { partner: capture.favorite === 'partner' })}
              icon={faHeart}
              title={t(`favorite.${capture.favorite}`)}
            />
          }
        </span>
        <span className="badge-slot">
          {(capture.gender === 'male' || capture.gender === 'female') &&
            <FontAwesomeIcon
              className={`gender-badge ${capture.gender}`}
              icon={capture.gender === 'male' ? faMars : faVenus}
              title={t(`gender.${capture.gender}`)}
            />
          }
        </span>
        <span className="badge-slot">
          {capture.been_to_champions
            ? <img alt="" src="/marks/champions.png" title={t('info.beenToChampions')} />
            : (capture.trained === 'ivs' || capture.trained === 'ev') &&
              <span className={`trained-badge ${capture.trained}`} title={t(`trained.${capture.trained}`)} />
          }
        </span>
      </span>
    );

    sealBadges = (
      <div className="seal-badges">
        {capture.catch_date
          ? <div className="seal-badges-track">
            {badgeRow}
            <span className="badge-row seal-date">{capture.catch_date.replaceAll('-', '/')}</span>
            {badgeRow}
          </div>
          : badgeRow
        }
      </div>
    );
  }

  if (displaySealed) {
    const langAbbr = showLanguageTags && capture.language ? LANGUAGE_ABBRS.get(capture.language) : null;
    const slotsRow = (
      <p className="number-line-slots">
        <span className="slot-lang">{langAbbr && <span className="language-tag">{langAbbr}</span>}</span>
        <span>#{number}</span>
        <span className="slot-level">{typeof capture.level === 'number' && `Lv.${capture.level}`}</span>
      </p>
    );
    numberLine = (
      <div className="number-scroll">
        {capture.ot
          ? <div className="number-scroll-track">
            {slotsRow}
            <p className={classNames('number-line-ot', { gift })}>{capture.ot}</p>
            {slotsRow}
          </div>
          : slotsRow
        }
      </div>
    );
  }

  return (
    <div
      className={classes}
      data-pokemon-id={capture.pokemon.id}
      onMouseEnter={statusButtons.length > 0 && !armed ? () => setArmed(true) : undefined}
    >
      {sealBadges}
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
