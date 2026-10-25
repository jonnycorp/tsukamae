import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faMars, faVenus } from '@fortawesome/free-solid-svg-icons';

import { BALL_NAMES, LANGUAGE_ABBRS, ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { BadgeRow, CatchDateLine, OTLine, OriginMark } from './seal-faces';
import { HEX_ORDER, natureStats } from '../../../utils/display-modes';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { useTranslation } from '../../../hooks/use-translation';

import type { ReactNode } from 'react';
import type { Capture } from '../../../types';
import type { FacePage, StatLetter } from '../../../utils/display-modes';

// a sealed tile's pages (utils/display-modes): every page a block over the number line and the badges together, the
// number line's zone across its top (16px) and the badges' along its foot (20px, from 14px down), so a page that keeps
// those lines keeps their places. FlipStrips lays one per page in each tile's strip

interface Props {
  capture: Capture;
}

// ---- the pieces the pages are built from

function LangTag ({ capture }: Props) {
  const abbr = capture.language ? LANGUAGE_ABBRS.get(capture.language) : null;
  return abbr ? <span className="language-tag">{abbr}</span> : null;
}

function Level ({ capture }: Props) {
  return typeof capture.level === 'number' ? <span className="page-level">Lv.{capture.level}</span> : null;
}

function Ball ({ capture, className }: Props & { className?: string }) {
  const { locale } = useTranslation();
  if (!capture.ball || capture.ball === 'unknown') {
    return null;
  }
  return (
    <img
      alt=""
      className={classNames('page-ball', className)}
      src={`/balls/${capture.ball}.png`}
      title={localizeBall(locale, capture.ball, BALL_NAMES.get(capture.ball) || capture.ball)}
    />
  );
}

function Mark ({ capture }: Props) {
  const { locale } = useTranslation();
  if (!capture.origin_game) {
    return null;
  }
  const name = localizeOriginGame(locale, capture.origin_game, ORIGIN_GAME_NAMES.get(capture.origin_game) || capture.origin_game);
  return <OriginMark game={capture.origin_game} title={name} />;
}

function Gender ({ capture }: Props) {
  const { t } = useTranslation();
  return capture.gender === 'male' || capture.gender === 'female'
    ? <FontAwesomeIcon className={`gender-badge ${capture.gender}`} icon={capture.gender === 'male' ? faMars : faVenus} title={t(`gender.${capture.gender}`)} />
    : null;
}

function Heart ({ capture }: Props) {
  const { t } = useTranslation();
  return capture.favorite === 'favorite' || capture.favorite === 'partner'
    ? <FontAwesomeIcon className={classNames('heart-badge', { partner: capture.favorite === 'partner' })} icon={faHeart} title={t(`favorite.${capture.favorite}`)} />
    : null;
}

function Trained ({ capture }: Props) {
  const { t } = useTranslation();
  return capture.trained === 'ivs' || capture.trained === 'ev'
    ? <span className={`trained-badge ${capture.trained}`} title={t(`trained.${capture.trained}`)} />
    : null;
}

// ---- the stat hexagon: HP at the top and on clockwise as the summary draws it, every stat two thirds of the way out,
// the raised one pushed to the rim and the lowered one pulled in to a third, so the shape is the nature's; a neutral
// nature an even hexagon. Drawn as a glyph on Hexagon's record line, and as one of Orbit's moons
const BASE = 2 / 3;
const DOWN = 1 / 3;

function hexPoint (letter: StatLetter, r: number): [number, number] {
  const angle = (-90 + 60 * HEX_ORDER.indexOf(letter)) * (Math.PI / 180);
  return [Math.round(r * Math.cos(angle) * 100) / 100, Math.round(r * Math.sin(angle) * 100) / 100];
}

function NatureHex ({ capture }: Props) {
  const r = 7;
  const stats = natureStats(capture.nature);
  if (!stats) {
    return null;
  }
  const moved = stats === 'neutral' ? null : stats;
  const at = (letter: StatLetter) => r * (letter === moved?.up ? 1 : letter === moved?.down ? DOWN : BASE);
  const polygon = (radius: (letter: StatLetter) => number) => HEX_ORDER.map((letter) => hexPoint(letter, radius(letter)).join(',')).join(' ');
  const dot = (letter: StatLetter, className: string) => {
    const [cx, cy] = hexPoint(letter, at(letter));
    return <circle className={`hex-dot ${className}`} cx={cx} cy={cy} r={1.3} />;
  };
  const size = r * 2 + 2;
  return (
    <svg aria-hidden="true" className="nature-hex" height={size} viewBox={`${-r - 1} ${-r - 1} ${size} ${size}`} width={size}>
      <polygon className="hex-rim" points={polygon(() => r)} />
      <polygon className="hex-mid" points={polygon(() => r * BASE)} />
      {HEX_ORDER.map((letter) => {
        const [x, y] = hexPoint(letter, r);
        return <line className="hex-spoke" key={letter} x1={0} x2={x} y1={0} y2={y} />;
      })}
      <polygon className="hex-shape" points={polygon(at)} />
      {moved && dot(moved.up, 'up')}
      {moved && dot(moved.down, 'down')}
    </svg>
  );
}

// ---- the pages

// Hexagon's record: the language at the left of the number line, the level in its middle where the number was, the
// nature drawn at its right, the stat hexagon as a glyph; the badges as they are
function RecordPage ({ capture }: Props) {
  return (
    <>
      <p className="page-line trio">
        <span className="trio-side"><LangTag capture={capture} /></span>
        <Level capture={capture} />
        <span className="trio-side"><NatureHex capture={capture} /></span>
      </p>
      <div className="page-band"><BadgeRow capture={capture} /></div>
    </>
  );
}

// Orbit's hub, its one page: the ball large in the middle on a flat ring, its far half behind the ball and its near half
// before it. What circles on it FlipStrips lays a row at a time (hubMoons)
function HubPage ({ capture }: Props) {
  return (
    <>
      <span aria-hidden="true" className="hub-ring" />
      <Ball capture={capture} className="hub-ball" />
      <span aria-hidden="true" className="hub-ring front" />
    </>
  );
}

// the ball's middle in the hub's block (its 108px stage centred, the ball 26px from 4px down)
export const HUB_BALL_Y = 17;

// the hub's moons, each in its own slot of the ring, a fifth of a turn apart: gender, heart, the game's mark, training
// and the nature's hexagon. A slot holds one kind, so every tile's moon in it circles in step with the rest of its row;
// keep the count in sync with $hub-slots in styles/tile-faces.scss
export const HUB_SLOTS = 5;

export function hubMoons (capture: Capture): (ReactNode | null)[] {
  return [
    capture.gender === 'male' || capture.gender === 'female' ? <Gender capture={capture} /> : null,
    capture.favorite === 'favorite' || capture.favorite === 'partner' ? <Heart capture={capture} /> : null,
    capture.origin_game ? <Mark capture={capture} /> : null,
    capture.trained === 'ivs' || capture.trained === 'ev' ? <Trained capture={capture} /> : null,
    natureStats(capture.nature) ? <NatureHex capture={capture} /> : null,
  ];
}

// Hexagon's trainer's page: the OT over the catch date
function TrainerPage ({ capture }: Props) {
  return (
    <>
      <div className="page-line">{capture.ot && <OTLine capture={capture} />}</div>
      <div className="page-band">{capture.catch_date && <CatchDateLine capture={capture} />}</div>
    </>
  );
}

// Hexagon's species' page, nothing of the record's: its number at the left in the tiles' thin face, its No. over it,
// and its types small at the foot's right as an unsealed tile shows them, a pair the first over the second
function SpeciesPage ({ capture, number }: Props & { number: string }) {
  const types = capture.pokemon.types ?? [];
  return (
    <>
      <span className="species-number"><span className="species-no">No.</span>{number}</span>
      <span className={classNames('species-types', { pair: types.length > 1 })}>
        {types.map((type) => (
          <span className="type-glyph" key={type} style={{ backgroundColor: `var(--type-${type})`, maskImage: `url(/types/${type}.svg)` }} />
        ))}
      </span>
    </>
  );
}

export function FacePageBlock ({ capture, page, number }: Props & { page: FacePage; number: string }) {
  let body: ReactNode;
  if (page === 'trainer') {
    body = <TrainerPage capture={capture} />;
  } else if (page === 'species') {
    body = <SpeciesPage capture={capture} number={number} />;
  } else if (page === 'hub') {
    body = <HubPage capture={capture} />;
  } else {
    body = <RecordPage capture={capture} />;
  }
  return <div className={`face-page page-${page}`}>{body}</div>;
}
