import classNames from 'classnames';
import { useState } from 'react';

import { ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { SceneMon } from '../Scene';
import { artSrc } from './ViewLensArt';
import { displayName } from '../../../library/PokemonName';
import { localizeNature, localizeOriginGame } from '../../../../i18n/names';
import { useViewText } from './views-i18n';

import type { CapturePokemon, Dex } from '../../../../types';
import type { GalaxyMode } from './BallGalaxy';
import type { ViewRecord } from './ViewScope';

interface Props {
  kind: GalaxyMode;
  record: ViewRecord;
  scale?: number;
  ballName?: string;
  // every star caught the same day as this one, in the order caught
  day?: ViewRecord[];
  onPick?: (record: ViewRecord) => void;
  onLocate?: () => void;
  onFilterBall?: () => void;
  // a word under the name in place of the ball (a mon not caught: 未捕獲)
  note?: string;
  // the Q / E hint, where the keys step
  keys?: boolean;
}

const natureName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

// a mon's official art as a hologram: tinted in the accent, lined like a projection, flickering on as it comes; its
// sprite where the art isn't saved (yarn sprites:art)
export function ArtHologram ({ pokemon, view, shiny = false, gmax = false, large = false }: { pokemon: CapturePokemon; view?: Dex; shiny?: boolean; gmax?: boolean; large?: boolean }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className={classNames('lg-holo', { large })}>
      {missing
        ? <SceneMon pokemon={pokemon} view={view} zoom={large ? 6 : 3} />
        : <img alt="" draggable={false} onError={() => setMissing(true)} src={artSrc(pokemon, shiny, gmax ? 'gmax' : null)} />}
    </div>
  );
}

// a record's: in its dex's colours, its giant form where it says Gigantamax
export const Hologram = ({ record, large = false }: { record: ViewRecord; large?: boolean }) => (
  <ArtHologram gmax={Boolean(record.capture.gigantamax)} large={large} pokemon={record.capture.pokemon} shiny={record.dex.shiny} view={record.view} />
);

// what a picked star in the galaxy shows. The constellation's: a panel at the right, airy, the hologram over the mon's
// own record. The day's: a narrower one at the left, the day's whole catch under the hologram, each pressed to pick it.
// The backdrop's: the hologram alone, large, behind the galaxy. Going to the dex is only ever a press here
export function GalaxyPanel ({ kind, record, scale = 1, ballName, day = [], onPick, onLocate, onFilterBall, note, keys = true }: Props) {
  const { lt, locale } = useViewText();
  const { capture } = record;

  if (kind === 'backdrop') {
    return <div aria-hidden="true" className="lg-backdrop"><Hologram large record={record} /></div>;
  }

  const name = displayName(capture.pokemon.name, capture.pokemon.name_ja, locale);
  const facts: [string, string | null][] = [
    [lt('galaxy.f.date'), capture.captured ? capture.catch_date : null],
    [lt('galaxy.f.game'), capture.origin_game ? localizeOriginGame(locale, capture.origin_game, ORIGIN_GAME_NAMES.get(capture.origin_game) ?? capture.origin_game) : null],
    [lt('galaxy.f.ot'), capture.ot ? `${capture.ot}${capture.tid ? `  ${capture.tid}` : ''}` : null],
    [lt('galaxy.f.nickname'), capture.has_nickname ? capture.nickname : null],
    [lt('galaxy.f.nature'), capture.nature ? localizeNature(locale, capture.nature, natureName(capture.nature)) : null],
    [lt('galaxy.f.level'), capture.level ? String(capture.level) : null],
  ];

  return (
    <aside className={`lg-panel kind-${kind}`} key={record.key} style={{ zoom: scale }}>
      <Hologram record={record} />
      <div className="lg-panel-name">
        <small>No.{String(capture.pokemon.national_id).padStart(4, '0')}</small>
        <strong>{name}</strong>
      </div>
      {note
        ? <p className="lg-panel-ball">{note}</p>
        : capture.ball && capture.ball !== 'unknown' && (
          <p className="lg-panel-ball">
            <img alt="" height={26} src={`/balls/${capture.ball}.png`} width={26} />
            {ballName}
          </p>
        )}
      {kind === 'constellation' && (
        <dl className="lg-panel-facts">
          {facts.filter(([, value]) => value).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      )}
      {kind === 'day' && (
        <div className="lg-panel-day">
          <small>{lt('galaxy.sameDay', { n: day.length })}</small>
          <div>
            {day.map((other) => (
              <button className={classNames({ on: other === record })} key={other.key} onClick={() => onPick?.(other)} title={displayName(other.capture.pokemon.name, other.capture.pokemon.name_ja, locale)} type="button">
                <SceneMon pokemon={other.capture.pokemon} view={other.view} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="lg-panel-links">
        {record.here && <button onClick={onLocate} type="button">{lt('galaxy.locate')}</button>}
        {record.here && onFilterBall && capture.ball && capture.ball !== 'unknown' && <button onClick={onFilterBall} type="button">{lt('galaxy.filterBall', { ball: ballName ?? '' })}</button>}
      </div>
      {keys && <small className="lg-panel-keys">{lt('galaxy.keys')}</small>}
    </aside>
  );
}
