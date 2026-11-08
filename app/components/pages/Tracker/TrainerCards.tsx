import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useRef } from 'react';

import { LANGUAGE_ABBRS, ORIGIN_GAME_NAMES, nameLang } from '../../../utils/capture-fields';
import { Scene, SceneMon, sceneScroll, useScrollBack } from './Scene';
import { GigantamaxMark } from './seal-faces';
import { displayName } from '../../library/PokemonName';
import { gameColor } from '../../../utils/game-colors';
import { localizeOriginGame } from '../../../i18n/names';
import { showsGigantamax } from '../../../utils/gigantamax';
import { trainerCards } from './trainer-cards-model';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, GameSave } from '../../../types';
import type { CSSProperties } from 'react';
import type { SceneView } from './Scene';
import type { TrackerFilters } from './filters';

interface Props {
  // come back to from the dex (index.tsx's layer): opened quietly, as it was left
  back: SceneView | null;
  onClose: () => void;
  // a card or a trainer pressed: the dex filtered to their mons as the scene closes, with how far down it was left
  onFilter: (filters: TrackerFilters, view: SceneView) => void;
}

// a mon on a card, its heart beside it as the badge row draws it (a favourite's blue, a partner's pink), or a G-Max
// mon's mark in its place
function Mon ({ capture }: { capture: Capture }) {
  const { locale } = useTranslation();
  const hearted = capture.favorite === 'favorite' || capture.favorite === 'partner';
  return (
    <span className="tc-mon" title={displayName(capture.pokemon.name, capture.pokemon.name_ja, locale)}>
      <SceneMon pokemon={capture.pokemon} />
      {showsGigantamax(capture)
        ? <GigantamaxMark />
        : hearted && <FontAwesomeIcon className={classNames('heart-badge', { partner: capture.favorite === 'partner' })} icon={faHeart} />}
    </span>
  );
}

// the trainer cards (C): one card per game of yours, edged in its game's colour, with its OT, ID No. and
// every sealed mon its trainer caught; then the trainers who aren't you, by OT. A card pressed filters the dex to its
// mons: by game, language, OT and ID No. (a HOME entry's by OT and ID No. alone, its gifts carrying their games' marks
// and any language), so two files of one game and OT keep to their own; with no ID No. too where the card holds a mon
// with none (stampedSave puts one on the first file it fits). Escape in the dex comes back here, as Journeys does
export function TrainerCards ({ back, onClose, onFilter }: Props) {
  const { captures } = useTrackerState();
  const { saves } = useDexContext();
  const { t, locale } = useTranslation();
  const data = useMemo(() => trainerCards(saves, captures), [saves, captures]);
  const pageRef = useRef<HTMLDivElement>(null);

  // come back to: as far down as it was left, the cards there from the first frame
  useScrollBack(pageRef, back, true);

  const gameName = (id: string) => localizeOriginGame(locale, id, ORIGIN_GAME_NAMES.get(id) ?? id);
  const filter = (facets: TrackerFilters['facets']) => onFilter({ view: 'all', facets }, { scroll: sceneScroll(pageRef.current) });
  const press = (save: GameSave, mons: Capture[]) => {
    const tid = save.tid ? { tid: mons.some((capture) => !capture.tid) ? [save.tid, ''] : [save.tid] } : {};
    if (save.game === 'home') {
      filter(save.tid ? { ot: [save.ot], ...tid } : { ot: [save.ot], language: [save.language] });
      return;
    }
    filter({ origin_game: [save.game], language: [save.language], ot: [save.ot], ...tid });
  };

  return (
    <Scene hint={t('trainers.hint')} name="trainers" onClose={onClose} quiet={Boolean(back)} title={t('trainers.title')}>
      {({ scale }) => (
        <div className="tc-page" ref={pageRef} style={{ zoom: scale }}>
          <div className="tc-cards">
            {data.cards.map(({ save, mons }, i) => (
              <button
                className={classNames('tc-card', { empty: mons.length === 0 })}
                disabled={mons.length === 0}
                key={save.id}
                onClick={() => press(save, mons)}
                style={{ '--game': gameColor(save.game), '--i': i } as CSSProperties}
                type="button"
              >
                <span className="tc-head">
                  <span className="tc-game">{gameName(save.game)}</span>
                  <span className="tc-lang">{LANGUAGE_ABBRS.get(save.language) ?? save.language}</span>
                </span>
                <span className="tc-trainer">
                  <span className="tc-ot" lang={nameLang(save.ot, save.language)}>{save.ot}</span>
                  {save.tid && <span className="tc-id">{t('trainers.id', { id: save.tid })}</span>}
                  <span className="tc-count">{mons.length > 0 ? t('trainers.count', { n: mons.length }) : t('trainers.none')}</span>
                </span>
                {mons.length > 0 && <span className="tc-mons">{mons.map((capture) => <Mon capture={capture} key={capture.pokemon.id} />)}</span>}
              </button>
            ))}
          </div>
          {data.others.length > 0 && (
            <section className="scene-card tc-others" style={{ '--i': data.cards.length } as CSSProperties}>
              <h2><span>{t('trainers.others')}</span></h2>
              {data.others.map((other) => (
                <button className="tc-other" key={other.ot} onClick={() => filter({ ot: [other.ot] })} type="button">
                  <span className="tc-other-head">
                    <span className="tc-ot" lang={nameLang(other.ot, other.mons[0].language)}>{other.ot}</span>
                    <span className="tc-other-games">{other.games.map(gameName).join(' · ')}</span>
                    <span className="tc-count">{t('trainers.count', { n: other.mons.length })}</span>
                  </span>
                  <span className="tc-mons">{other.mons.map((capture) => <Mon capture={capture} key={capture.pokemon.id} />)}</span>
                </button>
              ))}
              {data.unknown > 0 && <p className="tc-note">{t('trainers.unknown', { n: data.unknown })}</p>}
            </section>
          )}
        </div>
      )}
    </Scene>
  );
}
