import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretLeft, faCaretRight, faLongArrowAltRight, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

import { LANGUAGES, ORIGIN_GAMES } from '../../../utils/local-data';
import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { localizeCaptureLanguage, localizeOriginGame } from '../../../i18n/names';
import { nationalId, padding, serebiiLink } from '../../../utils/formatting';
import { useDeleteCapture, useUpdateCapture } from '../../../hooks/queries/captures';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerContext } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CaptureStatus } from '../../../types';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { TranslationKey } from '../../../i18n/translations';

const SEREBII_LINKS: Record<string, string> = {
  x_y: 'pokedex-xy',
  omega_ruby_alpha_sapphire: 'pokedex-xy',
  sun_moon: 'pokedex-sm',
  ultra_sun_ultra_moon: 'pokedex-sm',
  lets_go_pikachu_eevee: 'pokedex-sm',
  sword_shield: 'pokedex-swsh',
  sword_shield_expansion_pass: 'pokedex-swsh',
  brilliant_diamond_shining_pearl: 'pokedex-swsh',
  legends_arceus: 'pokedex-swsh',
  scarlet_violet: 'pokedex-sv',
  scarlet_violet_expansion_pass: 'pokedex-sv',
  home: 'pokedex-sv',
};

const STATUS_OPTIONS: { value: CaptureStatus; labelKey: TranslationKey }[] = [
  { value: 'caught', labelKey: 'status.caught' },
  { value: 'temporary', labelKey: 'status.temporary' },
  { value: 'locked', labelKey: 'status.locked' },
];

interface Props {
  selectedPokemon: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function Info ({ selectedPokemon }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { captures, setCaptures } = useTrackerContext();
  const { showInfo, setShowInfo } = useLocalStorageContext();
  const { t, locale } = useTranslation();

  const updateCaptureMutation = useUpdateCapture(activeDex!.id);
  const deleteCaptureMutation = useDeleteCapture(activeDex!.id);

  const capture = useMemo(() => captures.find((cap) => cap.pokemon.id === selectedPokemon), [captures, selectedPokemon]);

  const handleInfoClick = () => setShowInfo(!showInfo);

  const handleOriginGameChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!capture) {
      return;
    }

    const originGame = e.target.value || null;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, origin_game: originGame };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, origin_game: originGame } });
  };

  const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!capture) {
      return;
    }

    const language = e.target.value || null;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, language };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, language } });
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!capture) {
      return;
    }

    const status = e.target.value as CaptureStatus;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, status };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, status } });
  };

  // Releasing fully removes the mon and all of its metadata — the one
  // deliberate way to undo a capture, kept out of the way at the very bottom.
  const handleRelease = () => {
    if (!capture) {
      return;
    }

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, captured: false, status: null, origin_game: null, language: null };
    }));

    deleteCaptureMutation.mutate({ payload: { pokemon: [capture.pokemon.id] } });
  };

  // With nothing selected the panel stays closed — it only opens once a mon is
  // picked (selecting one also flips showInfo on). This avoids an empty panel
  // sitting open on load.
  if (!capture) {
    return (
      <div className="info collapsed">
        <div className="info-main" />
      </div>
    );
  }

  const { pokemon } = capture;
  const dexView = activeDexView!;
  const regional = dexView.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (pokemon.dex_number === -1 ? '---' : pokemon.dex_number) : nationalId(pokemon.national_id);

  return (
    <div className={`info ${showInfo ? '' : 'collapsed'}`}>
      <div className="info-collapse" onClick={handleInfoClick}>
        <FontAwesomeIcon icon={showInfo ? faCaretRight : faCaretLeft} />
      </div>

      <div className="info-main">
        <div className="info-header">
          <i className={iconClass(pokemon, dexView)} />
          <h1><PokemonName name={pokemon.name} nameJa={pokemon.name_ja} /></h1>
          <h2>#{padding(idToDisplay, dexView.total >= 1000 ? 4 : 3)}</h2>
        </div>

        <div className="info-capture-details">
          {capture.captured ?
            <>
              <div className="form-group">
                <label htmlFor="origin-game">{t('info.originGame')}</label>
                <select
                  className="form-control"
                  id="origin-game"
                  name="origin-game"
                  onChange={handleOriginGameChange}
                  value={capture.origin_game || ''}
                >
                  <option value="">—</option>
                  {ORIGIN_GAMES.map((game) => <option key={game.id} value={game.id}>{localizeOriginGame(locale, game.id, game.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="language">{t('info.language')}</label>
                <select
                  className="form-control"
                  id="language"
                  name="language"
                  onChange={handleLanguageChange}
                  value={capture.language || ''}
                >
                  <option value="">—</option>
                  {LANGUAGES.map((language) => <option key={language.id} value={language.id}>{localizeCaptureLanguage(locale, language.id, language.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="status">{t('info.status')}</label>
                <select
                  className="form-control"
                  id="status"
                  name="status"
                  onChange={handleStatusChange}
                  value={capture.status || 'caught'}
                >
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
                </select>
              </div>
            </> :
            <p className="info-uncaught-note">{t('info.notCaught')}</p>
          }

          <div className="info-links">
            <a
              href={`http://bulbapedia.bulbagarden.net/wiki/${encodeURI(pokemon.name)}_(Pok%C3%A9mon)`}
              rel="noopener noreferrer"
              target="_blank"
            >
              Bulbapedia <FontAwesomeIcon icon={faLongArrowAltRight} />
            </a>
            <a
              href={serebiiLink(SEREBII_LINKS[dexView.game.game_family.id], pokemon.national_id)}
              rel="noopener noreferrer"
              target="_blank"
            >
              Serebii <FontAwesomeIcon icon={faLongArrowAltRight} />
            </a>
          </div>
        </div>

        {capture.captured &&
          <div className="info-footer">
            <button className="info-release" onClick={handleRelease} type="button">
              <FontAwesomeIcon icon={faTrash} /> {t('info.release')}
            </button>
          </div>
        }
      </div>
    </div>
  );
}
