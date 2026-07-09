import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faLock } from '@fortawesome/free-solid-svg-icons';

import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { nationalId, padding } from '../../../utils/formatting';
import { useDelayedRender } from '../../../hooks/use-delayed-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorageContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerContext } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';
import { useUpdateCapture } from '../../../hooks/queries/captures';

import type { CaptureStatus } from '../../../types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import type { TranslationKey } from '../../../i18n/translations';
import type { UICapture } from './use-tracker';

// The status a hover button sets, and how it's labelled. A tile only shows the
// statuses it isn't currently in.
const STATUS_META: { status: CaptureStatus; icon: IconDefinition; labelKey: TranslationKey }[] = [
  { status: 'caught', icon: faCheck, labelKey: 'status.caught' },
  { status: 'temporary', icon: faClock, labelKey: 'status.temporary' },
  { status: 'locked', icon: faLock, labelKey: 'status.locked' },
];

interface Props {
  capture: UICapture | null;
  delay?: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function Pokemon ({ capture, delay = 0, setSelectedPokemon }: Props) {
  const render = useDelayedRender(delay);

  const { activeDex, activeDexView } = useDexContext();
  const { setCaptures } = useTrackerContext();
  const { setShowInfo } = useLocalStorageContext();
  const { t } = useTranslation();

  const updateCaptureMutation = useUpdateCapture(activeDex!.id);

  if (!render || !capture) {
    return (
      <div className="pokemon empty">
        <div className="set-captured" />
        <div className="set-captured-mobile" />
      </div>
    );
  }

  // Setting a status is also how a mon gets caught (a plain uncaught mon
  // defaults to 'caught'). Every status change opens the info panel on that
  // mon, since it now holds the metadata (origin game) you'll usually set next.
  const applyStatus = (status: CaptureStatus) => {
    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, captured: true, pending: false, status };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, status } });

    setSelectedPokemon(capture.pokemon.id);
    setShowInfo(true);
  };

  const openInfo = () => {
    setSelectedPokemon(capture.pokemon.id);
    setShowInfo(true);
  };

  // A plain tile click never unmarks (that's the deliberate Release button in
  // the info panel). It catches an uncaught mon, or just opens the info panel
  // for one that's already caught.
  const handleTileClick = () => {
    if (capture.captured) {
      openInfo();
    } else {
      applyStatus('caught');
    }
  };

  const handleStatusClick = (e: MouseEvent<HTMLButtonElement>, status: CaptureStatus) => {
    e.stopPropagation();
    applyStatus(status);
  };

  const classes = {
    pokemon: true,
    captured: capture.captured,
    pending: capture.pending,
    temporary: capture.status === 'temporary',
    locked: capture.status === 'locked',
  };

  const dexView = activeDexView!;
  const regional = dexView.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (capture.pokemon.dex_number === -1 ? '---' : capture.pokemon.dex_number) : nationalId(capture.pokemon.national_id);
  const paddingDigits = dexView.total >= 1000 ? 4 : 3;

  const statusButtons = STATUS_META.filter((meta) => meta.status !== capture.status);

  return (
    <div className={classNames(classes)}>
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
      <div className="set-captured" onClick={handleTileClick}>
        <h4><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h4>
        <div className="icon-wrapper">
          <i className={iconClass(capture.pokemon, dexView)} />
        </div>
        <p>#{padding(idToDisplay, paddingDigits)}</p>
      </div>
      <div className="set-captured-mobile" onClick={handleTileClick}>
        <div className="icon-wrapper">
          <i className={iconClass(capture.pokemon, dexView)} />
        </div>
        <h4><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h4>
        <p>#{padding(idToDisplay, paddingDigits)}</p>
      </div>
    </div>
  );
}
