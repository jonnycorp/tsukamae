import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfo } from '@fortawesome/free-solid-svg-icons';

import { DEX } from '../../../utils/local-data';
import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { nationalId, padding } from '../../../utils/formatting';
import { useCreateCapture, useDeleteCapture } from '../../../hooks/queries/captures';
import { useDelayedRender } from '../../../hooks/use-delayed-render';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerContext } from './use-tracker';

import type { Dispatch, SetStateAction } from 'react';
import type { UICapture } from './use-tracker';

interface Props {
  capture: UICapture | null;
  delay?: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function Pokemon ({ capture, delay = 0, setSelectedPokemon }: Props) {
  const render = useDelayedRender(delay);

  const { setCaptures } = useTrackerContext();
  const { setShowInfo } = useLocalStorageContext();

  const createCapturesMutation = useCreateCapture();
  const deleteCapturesMutation = useDeleteCapture();

  if (!render || !capture) {
    return (
      <div className="pokemon empty">
        <div className="set-captured" />
        <div className="set-captured-mobile" />
      </div>
    );
  }

  const handleSetCapturedClick = async () => {
    if (createCapturesMutation.isLoading || deleteCapturesMutation.isLoading) {
      // We're already making a request, so exit early.
      return;
    }

    createCapturesMutation.reset();
    deleteCapturesMutation.reset();

    const payload = { pokemon: [capture.pokemon.id] };

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        // We're not modifying this one.
        return cap;
      }
      return {
        ...cap,
        pending: true,
        // We need to make it look like captured is false, otherwise, the pending styles won't show up.
        captured: false,
      };
    }));

    if (capture.captured) {
      await deleteCapturesMutation.mutateAsync({ payload });
    } else {
      await createCapturesMutation.mutateAsync({ payload });
    }

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        // We're not modifying this one.
        return cap;
      }
      return {
        ...cap,
        pending: false,
        captured: !capture.captured,
        // Unmarking clears origin/temporary state along with the capture.
        origin_game: capture.captured ? null : cap.origin_game,
        temporary: capture.captured ? false : cap.temporary,
      };
    }));
  };

  const handleSetInfoClick = () => {
    setSelectedPokemon(capture.pokemon.id);
    setShowInfo(true);
  };

  const classes = {
    pokemon: true,
    captured: capture.captured,
    pending: capture.pending,
    temporary: capture.captured && capture.temporary,
  };

  const regional = DEX.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (capture.pokemon.dex_number === -1 ? '---' : capture.pokemon.dex_number) : nationalId(capture.pokemon.national_id);
  const paddingDigits = DEX.total >= 1000 ? 4 : 3;

  return (
    <div className={classNames(classes)}>
      <div className="set-captured" onClick={handleSetCapturedClick}>
        <h4><PokemonName name={capture.pokemon.name} /></h4>
        <div className="icon-wrapper">
          <i className={iconClass(capture.pokemon, DEX)} />
        </div>
        <p>#{padding(idToDisplay, paddingDigits)}</p>
      </div>
      <div className="set-captured-mobile" onClick={handleSetCapturedClick}>
        <div className="icon-wrapper">
          <i className={iconClass(capture.pokemon, DEX)} />
        </div>
        <h4><PokemonName name={capture.pokemon.name} /></h4>
        <p>#{padding(idToDisplay, paddingDigits)}</p>
      </div>
      <div className="set-info" onClick={handleSetInfoClick}>
        <FontAwesomeIcon icon={faInfo} />
      </div>
    </div>
  );
}
