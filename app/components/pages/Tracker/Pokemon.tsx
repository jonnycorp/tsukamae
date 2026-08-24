import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faCheck, faClock, faExchangeAlt, faGift, faHeart, faLock, faMapMarkerAlt, faMars, faVenus } from '@fortawesome/free-solid-svg-icons';

import { BALLS, EMPTY_METADATA, LANGUAGES, ORIGIN_GAMES, genderFromLock, lookupOT, metadataFromDefaults } from '../../../utils/capture-fields';
import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { nationalId, padding } from '../../../utils/formatting';
import { useDelayedRender } from '../../../hooks/use-delayed-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useLongPress } from '../../../hooks/use-long-press';
import { isDisplaySealed, useTrackerActions } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import { memo, useRef } from 'react';

import type { Dispatch, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react';
import type { CaptureStatus } from '../../../types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { TranslationKey } from '../../../i18n/translations';
import type { UICapture } from './use-tracker';

// a tile only offers the statuses it isn't in
const STATUS_META: { status: CaptureStatus; icon: IconDefinition; labelKey: TranslationKey }[] = [
  { status: 'caught', icon: faLock, labelKey: 'status.caught' },
  { status: 'temporary', icon: faClock, labelKey: 'status.temporary' },
  { status: 'unobtainable', icon: faCheck, labelKey: 'status.unobtainable' },
];

// only non-cartridge origins get a tile mark
const ORIGIN_MARK_ICONS: Record<string, IconDefinition> = {
  trade: faExchangeAlt,
  go: faMapMarkerAlt,
  mystery_gift: faGift,
};

// real origin marks (public/marks/, yarn sprites:marks) for sealed badges; trade/mystery gift fall back to the glyphs
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

const ORIGIN_NAMES = new Map(ORIGIN_GAMES.map((game) => [game.id, game.name]));
const LANGUAGE_ABBRS = new Map(LANGUAGES.map((language) => [language.id, language.abbr]));
const BALL_NAMES = new Map(BALLS.map((ball) => [ball.id, ball.name]));

interface Props {
  capture: UICapture | null;
  delay?: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

// memoized: a commit only re-renders the tile whose capture object changed
export const Pokemon = memo(function Pokemon ({ capture, delay = 0, setSelectedPokemon }: Props) {
  const render = useDelayedRender(delay);

  const { activeDex, activeDexView, saves } = useDexContext();
  const { setCaptures, sealFx, updateCapture, deleteCaptures } = useTrackerActions();
  const { showLanguageTags } = useLocalStorageContext();
  const { t, locale } = useTranslation();

  // caught-or-not only: a check wears the sealed visuals, no seal semantics
  const checklist = Boolean(activeDex!.checklist);

  // everything visual keys off this; data guards keep reading capture.sealed (sealFx is TESTING-only)
  const displaySealed = Boolean(capture) && isDisplaySealed(capture!, checklist, sealFx);

  // holding the tile itself unseals (or unchecks); the delay keeps ordinary clicks from flashing the wheel
  const suppressClickRef = useRef(false);
  const { progress: unsealProgress, point: unsealPoint, handlers: unsealHandlers } = useLongPress({
    delay: 250,
    // once the wheel has shown, the release was a hold being abandoned, not a click
    onRelease: (engaged) => {
      suppressClickRef.current = engaged;
    },
    onComplete: () => {
      if (!capture) {
        return;
      }
      suppressClickRef.current = true;
      if (checklist) {
        // unchecking clears the slot entirely
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

  if (!render || !capture) {
    return (
      <div className="pokemon empty">
        <div className="set-captured" />
        <div className="set-captured-mobile" />
      </div>
    );
  }

  const originName = capture.origin_game
    ? localizeOriginGame(locale, capture.origin_game, ORIGIN_NAMES.get(capture.origin_game) || capture.origin_game)
    : '';
  // the tag only ever shows in the sealed number line now
  const langAbbr = showLanguageTags && capture.language ? LANGUAGE_ABBRS.get(capture.language) : null;

  // setting a status is also how a mon gets marked
  const applyStatus = (status: CaptureStatus) => {
    // display-sealed so the TESTING edit mode writes through; BAU the mutation layer refuses too
    if (displaySealed) {
      return;
    }

    // mirrors the mutation layer's prefill, registry-filtered so removed keys can't leak in
    const defaults = metadataFromDefaults(activeDex!.captureDefaults);

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      // unobtainable wipes the record rather than prefilling one
      if (status === 'unobtainable') {
        return { ...cap, ...EMPTY_METADATA, captured: true, status };
      }
      if (cap.captured) {
        return { ...cap, status };
      }
      // location, gender and OT mirror the mutation layer's derived prefills
      return {
        ...cap,
        ...defaults,
        captured: true,
        status,
        location: activeDexView!.game.id === 'home' ? 'home' : 'game',
        location_save: null,
        gender: genderFromLock(cap.pokemon.gender_lock),
        ot: lookupOT(saves, defaults.origin_game ?? null, defaults.language ?? null),
      };
    }));

    updateCapture({ pokemon: capture.pokemon.id, status });

    // a checklist check is complete in itself; no metadata to go fill in
    if (!checklist) {
      setSelectedPokemon(capture.pokemon.id);
    }
  };

  // a press that drew the wheel ends here, not in the popover
  const pressHandlers = displaySealed
    ? { ...unsealHandlers, onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      // a stale suppression would otherwise eat the next real click
      suppressClickRef.current = false;
      unsealHandlers.onPointerDown(e);
    } }
    : {};

  // never unmarks — release is the only way out
  const handleTileClick = () => {
    // swallow the click that closes out any hold, completed or abandoned
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // a checked box is inert; hold is the only way out
    if (checklist && capture.captured) {
      return;
    }
    if (capture.captured) {
      setSelectedPokemon(capture.pokemon.id);
    } else {
      // unobtainable is always a deliberate choice, never a default
      applyStatus(activeDex!.captureDefaults?.status ?? 'caught');
    }
  };

  const handleStatusClick = (e: MouseEvent<HTMLButtonElement>, status: CaptureStatus) => {
    e.stopPropagation();
    applyStatus(status);
  };

  const classes = {
    pokemon: true,
    captured: capture.captured,
    unobtainable: capture.status === 'unobtainable',
    temporary: capture.status === 'temporary',
    caught: capture.status === 'caught',
    sealed: displaySealed,
    checklist,
    // location paints the whole sealed tile; plain green = sitting in a game
    'loc-home': displaySealed && capture.location === 'home',
    'loc-champions': displaySealed && capture.location === 'champions',
  };

  const dexView = activeDexView!;
  const regional = dexView.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (capture.pokemon.dex_number === -1 ? '---' : capture.pokemon.dex_number) : nationalId(capture.pokemon.national_id);
  const paddingDigits = dexView.total >= 1000 ? 4 : 3;

  // a sealed tile offers nothing on hover; a checklist knows only caught-by-click
  const statusButtons = displaySealed || checklist ? [] : STATUS_META.filter((meta) => meta.status !== capture.status);

  // sealed name line alternates species and nickname; badges sit static on the tile edge
  const nickname = displaySealed && capture.has_nickname ? capture.nickname : null;
  const speciesName = <PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} />;
  const nameLine = nickname
    ? (
      <div className="name-scroll">
        <div className="name-scroll-track">
          <h4>{speciesName}</h4>
          <h4><span className="nickname">{nickname}</span></h4>
          {/* first frame repeats at the end so the loop lands seamlessly */}
          <h4>{speciesName}</h4>
        </div>
      </div>
    )
    : <h4>{speciesName}</h4>;

  const originMarkSprite = capture.origin_game ? ORIGIN_MARK_SPRITES[capture.origin_game] : null;
  let sealBadges: ReactNode = null;
  if (displaySealed && !checklist) {
    // fixed slots so a badge always sits in the same column; an empty slot is information
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
            <FontAwesomeIcon icon={ORIGIN_MARK_ICONS[capture.origin_game]} title={originName} />
          }
        </span>
        {/* blue heart = favorite, red heart = partner; trained has no say here */}
        <span className="badge-slot">
          {(capture.favorite === 'favorite' || capture.favorite === 'partner') &&
            <FontAwesomeIcon
              className={`heart-badge${capture.favorite === 'partner' ? ' partner' : ''}`}
              icon={faHeart}
              title={t(capture.favorite === 'partner' ? 'favorite.partner' : 'favorite.favorite')}
            />
          }
        </span>
        <span className="badge-slot">
          {(capture.gender === 'male' || capture.gender === 'female') &&
            <FontAwesomeIcon
              className={`gender-badge ${capture.gender}`}
              icon={capture.gender === 'male' ? faMars : faVenus}
              title={t(capture.gender === 'male' ? 'gender.male' : 'gender.female')}
            />
          }
        </span>
        {/* the honors slot: champions outranks trained */}
        <span className="badge-slot">
          {capture.been_to_champions
            ? <img alt="" src="/marks/champions.png" title={t('info.beenToChampions')} />
            : (capture.trained === 'ivs' || capture.trained === 'ev') &&
              <span className={`trained-badge ${capture.trained}`} title={t(capture.trained === 'ev' ? 'trained.ev' : 'trained.ivs')} />
          }
        </span>
      </span>
    );

    // flips to the catch date on the nickname clock; the clone lands the loop
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

  // sealed number line flips to the OT on the same clock
  let sealedNumberLine: ReactNode = null;
  if (displaySealed) {
    const slotsRow = (
      // fixed slots so tag, number and level never shift; the number holds the middle
      <p className="number-line-slots">
        <span className="slot-lang">{langAbbr && <span className="language-tag">{langAbbr}</span>}</span>
        <span className="slot-number">#{padding(idToDisplay, paddingDigits)}</span>
        <span className="slot-level">{typeof capture.level === 'number' && `Lv.${capture.level}`}</span>
      </p>
    );
    sealedNumberLine = (
      <div className="number-scroll">
        {capture.ot
          ? <div className="number-scroll-track">
            {slotsRow}
            <p className="number-line-ot">{capture.ot}</p>
            {slotsRow}
          </div>
          : slotsRow
        }
      </div>
    );
  }

  return (
    // data-pokemon-id anchors the popover
    <div
      className={classNames(classes)}
      data-pokemon-id={capture.pokemon.id}
    >
      {sealBadges}
      {/* sealed tiles get no hover scrim — there is nothing to offer */}
      {!displaySealed && statusButtons.length > 0 &&
        <div className="set-status">
          {statusButtons.map((meta) => (
            <button
              className={`status-btn status-btn-${meta.status}`}
              key={meta.status}
              onClick={(e) => handleStatusClick(e, meta.status)}
              title={t(meta.labelKey)}
              type="button"
            >
              <FontAwesomeIcon icon={meta.icon} />
            </button>
          ))}
        </div>
      }
      <div className="set-captured" onClick={handleTileClick} {...pressHandlers}>
        {nameLine}
        <div className="icon-wrapper">
          <i className={iconClass(capture.pokemon, dexView)} />
        </div>
        {displaySealed
          ? sealedNumberLine
          : <p>#{padding(idToDisplay, paddingDigits)}</p>
        }
      </div>
      <div className="set-captured-mobile" onClick={handleTileClick} {...pressHandlers}>
        <div className="icon-wrapper">
          <i className={iconClass(capture.pokemon, dexView)} />
        </div>
        <h4><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h4>
        <p>#{padding(idToDisplay, paddingDigits)}</p>
      </div>
      {/* portalled out: .box has paint containment, which would anchor a fixed ring to the box */}
      {unsealPoint && unsealProgress > 0 && createPortal(
        <div
          className="unseal-ring"
          style={{
            left: unsealPoint.x,
            top: unsealPoint.y,
            background: `conic-gradient(var(--caught) ${unsealProgress * 360}deg, transparent 0deg)`,
          }}
        />,
        document.body,
      )}
    </div>
  );
});
