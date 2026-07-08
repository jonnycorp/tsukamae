import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretLeft, faCaretRight, faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

import { DEX, ORIGIN_GAMES } from '../../../utils/local-data';
import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { nationalId, padding, serebiiLink } from '../../../utils/formatting';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerContext } from './use-tracker';
import { useUpdateCapture } from '../../../hooks/queries/captures';

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

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

interface Props {
  selectedPokemon: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function Info ({ selectedPokemon }: Props) {
  const { captures, setCaptures } = useTrackerContext();
  const { showInfo, setShowInfo } = useLocalStorageContext();

  const updateCaptureMutation = useUpdateCapture();

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

  const handleTemporaryChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!capture) {
      return;
    }

    const temporary = e.target.checked;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, temporary };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, temporary } });
  };

  if (!capture) {
    return (
      <div className={`info ${showInfo ? '' : 'collapsed'}`}>
        <div className="info-collapse" onClick={handleInfoClick}>
          <FontAwesomeIcon icon={showInfo ? faCaretRight : faCaretLeft} />
        </div>

        <div className="info-main" />
      </div>
    );
  }

  const { pokemon } = capture;
  const regional = DEX.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (pokemon.dex_number === -1 ? '---' : pokemon.dex_number) : nationalId(pokemon.national_id);

  return (
    <div className={`info ${showInfo ? '' : 'collapsed'}`}>
      <div className="info-collapse" onClick={handleInfoClick}>
        <FontAwesomeIcon icon={showInfo ? faCaretRight : faCaretLeft} />
      </div>

      <div className="info-main">
        <div className="info-header">
          <i className={iconClass(pokemon, DEX)} />
          <h1><PokemonName name={pokemon.name} /></h1>
          <h2>#{padding(idToDisplay, DEX.total >= 1000 ? 4 : 3)}</h2>
        </div>

        {capture.captured ?
          <div className="info-capture-details">
            <div className="form-group">
              <label htmlFor="origin-game">Currently In</label>
              <select
                className="form-control"
                id="origin-game"
                name="origin-game"
                onChange={handleOriginGameChange}
                value={capture.origin_game || ''}
              >
                <option value="">—</option>
                {ORIGIN_GAMES.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <div className="checkbox">
                <label>
                  <input
                    checked={capture.temporary}
                    id="temporary"
                    name="temporary"
                    onChange={handleTemporaryChange}
                    type="checkbox"
                  />
                  <span className="checkbox-custom"><span /></span>Temporary (to be replaced)
                </label>
              </div>
            </div>
          </div> :
          <div className="info-capture-details">
            <p className="info-uncaught-note">Not caught yet.</p>
          </div>
        }

        <div className="info-footer">
          <a
            href={`http://bulbapedia.bulbagarden.net/wiki/${encodeURI(pokemon.name)}_(Pok%C3%A9mon)`}
            rel="noopener noreferrer"
            target="_blank"
          >
            Bulbapedia <FontAwesomeIcon icon={faLongArrowAltRight} />
          </a>
          <a
            href={serebiiLink(SEREBII_LINKS[DEX.game.game_family.id], pokemon.national_id)}
            rel="noopener noreferrer"
            target="_blank"
          >
            Serebii <FontAwesomeIcon icon={faLongArrowAltRight} />
          </a>
        </div>
      </div>
    </div>
  );
}
