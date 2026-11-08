import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExchangeAlt, faGift, faHeart, faMars, faVenus } from '@fortawesome/free-solid-svg-icons';

import { LANGUAGE_ABBRS, MYSTERY_GIFT, nameLang } from '../../../utils/capture-fields';
import { PokemonName } from '../../library/PokemonName';
import { showsGigantamax } from '../../../utils/gigantamax';

import type { Capture } from '../../../types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// GO has a mark of its own (ORIGIN_MARK_SPRITES), so it never needs a glyph
const ORIGIN_MARK_ICONS: Record<string, IconDefinition> = {
  trade: faExchangeAlt,
  [MYSTERY_GIFT]: faGift,
};

// sprites come from yarn sprites:marks; trade and mystery gift fall back to glyphs, and the Generation IV and V games,
// from before the marks, have none
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
  // the Switch releases', given in HOME since their link: a Game Boy Advance
  firered: 'gba',
  leafgreen: 'gba',
  go: 'go',
};

// a sealed tile's name gives way to its nickname, flipping to it for Hexagon's trainer's page and shown in its place in
// Orbit, as its number line and badges show the display mode's pages (face-pages) on every sealed tile; FlipStrips draws
// them, and the tile leaves their space empty
export function flipsName (capture: Capture): boolean {
  return Boolean(capture.has_nickname && capture.nickname);
}

// a sealed tile's sprite that FlipStrips draws over the tile, the tile's own hidden under it, so a sprite reaching up
// covers its name wherever the name is drawn: one under a name that flips, which the overlay draws, and a giant form's
export function liftsSprite (capture: Capture): boolean {
  return flipsName(capture) || showsGigantamax(capture);
}

interface Props {
  capture: Capture;
}

// whether a game has a mark to show, so a list can keep a mark's room for one that hasn't (HOME, Other, the Generation
// IV and V games)
export function hasOriginMark (game: string): boolean {
  return Boolean(ORIGIN_MARK_SPRITES[game] || ORIGIN_MARK_ICONS[game]);
}

// which mark a game wears, so games that share one (sister versions) can show it once
export const originMarkKey = (game: string) => ORIGIN_MARK_SPRITES[game] ?? game;

// a game's origin mark: its sprite, or a glyph for a trade or a gift (GO has a sprite of its own)
export function OriginMark ({ game }: { game: string }) {
  const sprite = ORIGIN_MARK_SPRITES[game];
  if (sprite) {
    return <span className="origin-mark" style={{ maskImage: `url(/marks/${sprite}.png)` }} />;
  }
  const icon = ORIGIN_MARK_ICONS[game];
  return icon ? <FontAwesomeIcon className={game === MYSTERY_GIFT ? 'gift-badge' : undefined} icon={icon} /> : null;
}

export function SpeciesLine ({ capture }: Props) {
  return <h4><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h4>;
}

export function NicknameLine ({ capture }: Props) {
  return <h4 lang={nameLang(capture.nickname!, capture.language)}><span className="nickname">{capture.nickname}</span></h4>;
}

// the Gigantamax factor's mark (pokesprite's, yarn sprites:marks), worn in the heart's place: every mon with the
// factor is a partner, so the mark says that too
export function GigantamaxMark () {
  return <img alt="" className="gmax-mark" src="/marks/gigantamax.png" />;
}

// a sealed tile's badges, on its last page; drawn on the flips' overlay, which takes no pointer, so none has a tooltip
export function BadgeRow ({ capture }: Props) {
  return (
    <span className="badge-row">
      <span className="badge-slot">
        {capture.ball && capture.ball !== 'unknown' && <img alt="" className="ball-badge" src={`/balls/${capture.ball}.png`} />}
      </span>
      <span className="badge-slot">
        {capture.origin_game && <OriginMark game={capture.origin_game} />}
      </span>
      <span className="badge-slot">
        {showsGigantamax(capture)
          ? <GigantamaxMark />
          : (capture.favorite === 'favorite' || capture.favorite === 'partner') &&
            <FontAwesomeIcon className={classNames('heart-badge', { partner: capture.favorite === 'partner' })} icon={faHeart} />
        }
      </span>
      <span className="badge-slot">
        {(capture.gender === 'male' || capture.gender === 'female') &&
          <FontAwesomeIcon className={`gender-badge ${capture.gender}`} icon={capture.gender === 'male' ? faMars : faVenus} />
        }
      </span>
      <span className="badge-slot">
        {capture.been_to_champions
          ? <img alt="" src="/marks/champions.png" />
          : (capture.trained === 'ivs' || capture.trained === 'ev') && <span className={`trained-badge ${capture.trained}`} />
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
