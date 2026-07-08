import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

import { useCreateCapture, useDeleteCapture } from '../../../hooks/queries/captures';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerContext } from './use-tracker';

import type { UICapture } from './use-tracker';

interface Props {
  captures: UICapture[];
}

export function MarkAllButton ({ captures }: Props) {
  const { activeDex } = useDexContext();
  const { setCaptures } = useTrackerContext();

  const createCapturesMutation = useCreateCapture(activeDex!.id);
  const deleteCapturesMutation = useDeleteCapture(activeDex!.id);

  const uncaught = useMemo(() => {
    return captures.reduce((total, capture) => total + (capture.captured ? 0 : 1), 0);
  }, [captures]);

  const handleButtonClick = async () => {
    createCapturesMutation.reset();
    deleteCapturesMutation.reset();

    const deleting = uncaught === 0;
    const pokemon = captures
    .filter((capture) => capture.captured === deleting)
    .map((capture) => capture.pokemon.id);
    const payload = { pokemon };

    setCaptures((prev) => prev.map((cap) => {
      if (!pokemon.includes(cap.pokemon.id)) {
        // We're not modifying this one.
        return cap;
      }
      return {
        ...cap,
        pending: true,
        // We need to make it look like captured is false, otherwise, the pending styles won't show up.
        captured: false,
        status: null,
      };
    }));

    if (deleting) {
      await deleteCapturesMutation.mutateAsync({ payload });
    } else {
      await createCapturesMutation.mutateAsync({ payload });
    }

    setCaptures((prev) => prev.map((cap) => {
      if (!pokemon.includes(cap.pokemon.id)) {
        // We're not modifying this one.
        return cap;
      }
      return {
        ...cap,
        pending: false,
        captured: !deleting,
        // Unmarking clears status/origin state along with the capture.
        status: deleting ? null : (cap.status || 'caught'),
        origin_game: deleting ? null : cap.origin_game,
      };
    }));
  };

  const isLoading = createCapturesMutation.isLoading || deleteCapturesMutation.isLoading;

  return (
    <button className="btn btn-blue" disabled={isLoading} onClick={handleButtonClick}>
      <span className={isLoading ? 'hidden' : ''}>{uncaught === 0 ? 'Unmark' : 'Mark'} All</span>
      {isLoading ?
        <span className="spinner">
          <FontAwesomeIcon icon={faCircleNotch} spin />
        </span> :
        null
      }
    </button>
  );
}
