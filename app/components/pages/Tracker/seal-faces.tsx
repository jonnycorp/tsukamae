import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExchangeAlt, faGift, faHeart, faMars, faVenus } from '@fortawesome/free-solid-svg-icons';

import { BALL_NAMES, LANGUAGE_ABBRS, MYSTERY_GIFT, ORIGIN_GAME_NAMES, nameLang } from '../../../utils/capture-fields';
import { PokemonName } from '../../library/PokemonName';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// GO has a mark of its own (ORIGIN_MARK_SPRITES), so it never needs a glyph
const ORIGIN_MARK_ICONS: Record<string, IconDefinition> = {
  trade: faExchangeAlt,
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

// a sealed tile's lines that alternate with a second face: the name with its nickname, the badges with the catch
// date, the number with the OT; FlipStrips slides these, and the tile leaves their space empty
export function flippingLines (capture: Capture) {
  return {
    name: Boolean(capture.has_nickname && capture.nickname),
    badges: Boolean(capture.catch_date),
    number: Boolean(capture.ot),
  };
}

interface Props {
  capture: Capture;
}

export function SpeciesLine ({ capture }: Props) {
  return <h4><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h4>;
}

export function NicknameLine ({ capture }: Props) {
  return <h4 lang={nameLang(capture.nickname!, capture.language)}><span className="nickname">{capture.nickname}</span></h4>;
}

export function BadgeRow ({ capture }: Props) {
  const { t, locale } = useTranslation();

  const originName = capture.origin_game
    ? localizeOriginGame(locale, capture.origin_game, ORIGIN_GAME_NAMES.get(capture.origin_game) || capture.origin_game)
    : '';
  const originMarkSprite = capture.origin_game ? ORIGIN_MARK_SPRITES[capture.origin_game] : null;

  return (
    <span className="badge-row">
      <span className="badge-slot">
        {capture.ball && capture.ball !== 'unknown' &&
          <img alt="" className="ball-badge" src={`/balls/${capture.ball}.png`} title={localizeBall(locale, capture.ball, BALL_NAMES.get(capture.ball) || capture.ball)} />
        }
      </span>
      <span className="badge-slot">
        {originMarkSprite &&
          <span className="origin-mark" style={{ maskImage: `url(/marks/${originMarkSprite}.png)` }} title={originName} />
        }
        {!originMarkSprite && capture.origin_game && ORIGIN_MARK_ICONS[capture.origin_game] &&
          <FontAwesomeIcon className={capture.origin_game === MYSTERY_GIFT ? 'gift-badge' : undefined} icon={ORIGIN_MARK_ICONS[capture.origin_game]} title={originName} />
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
}

export function CatchDateLine ({ capture }: Props) {
  return (
    <span className={classNames('badge-row seal-date', { gift: capture.origin_game === MYSTERY_GIFT })}>
      {capture.catch_date!.replaceAll('-', '/')}
    </span>
  );
}

export function SlotsLine ({ capture, number }: Props & { number: string }) {
  const langAbbr = capture.language ? LANGUAGE_ABBRS.get(capture.language) : null;

  return (
    <p className="number-line-slots">
      <span className="slot-lang">{langAbbr && <span className="language-tag">{langAbbr}</span>}</span>
      <span>#{number}</span>
      <span className="slot-level">{typeof capture.level === 'number' && `Lv.${capture.level}`}</span>
    </p>
  );
}

export function OTLine ({ capture }: Props) {
  return (
    <p className={classNames('number-line-ot', { gift: capture.origin_game === MYSTERY_GIFT })} lang={nameLang(capture.ot!, capture.language)}>
      {capture.ot}
    </p>
  );
}
