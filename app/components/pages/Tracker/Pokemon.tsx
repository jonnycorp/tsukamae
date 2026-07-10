import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircleExclamation, faClock, faLock } from '@fortawesome/free-solid-svg-icons';

import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { nationalId, padding } from '../../../utils/formatting';
import { useDelayedRender } from '../../../hooks/use-delayed-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
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
  // defaults to the dex's default status, or 'caught'). Every status change
  // opens the popover on that mon, since it holds the metadata (origin game)
  // you'll usually set next.
  const applyStatus = (status: CaptureStatus) => {
    // Mirror the mutation layer: a fresh catch prefills the dex's
    // captureDefaults; a mon that was already caught keeps its data.
    const defaults = activeDex!.captureDefaults;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      if (cap.captured) {
        return { ...cap, pending: false, status };
      }
      return {
        ...cap,
        captured: true,
        pending: false,
        status,
        origin_game: defaults?.origin_game ?? null,
        language: defaults?.language ?? null,
      };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, status } });

    setSelectedPokemon(capture.pokemon.id);
  };

  // A plain tile click never unmarks (that's the deliberate Release button in
  // the popover). It catches an uncaught mon, or just opens the popover for
  // one that's already caught. Clicking the tile of the open popover closes
  // it naturally: the mousedown lands outside the popover (dismissing it) and
  // this click re-selects the same id, which is a no-op.
  const handleTileClick = () => {
    if (capture.captured) {
      setSelectedPokemon(capture.pokemon.id);
    } else {
      applyStatus(activeDex!.captureDefaults?.status ?? 'caught');
    }
  };

  const handleStatusClick = (e: MouseEvent<HTMLButtonElement>, status: CaptureStatus) => {
    e.stopPropagation();
    applyStatus(status);
  };

  // Caught but with unfinished bookkeeping (origin game or language unset),
  // regardless of status — a locked slot with unknown origin still deserves
  // the nudge.
  const metaMissing = capture.captured && (!capture.origin_game || !capture.language);

  const classes = {
    pokemon: true,
    captured: capture.captured,
    pending: capture.pending,
    temporary: capture.status === 'temporary',
    locked: capture.status === 'locked',
    'meta-missing': metaMissing,
  };

  const dexView = activeDexView!;
  const regional = dexView.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (capture.pokemon.dex_number === -1 ? '---' : capture.pokemon.dex_number) : nationalId(capture.pokemon.national_id);
  const paddingDigits = dexView.total >= 1000 ? 4 : 3;

  const statusButtons = STATUS_META.filter((meta) => meta.status !== capture.status);

  return (
    // data-pokemon-id is the anchor the popover positions itself against.
    <div className={classNames(classes)} data-pokemon-id={capture.pokemon.id}>
      {metaMissing &&
        <div className="missing-meta-badge">
          <FontAwesomeIcon icon={faCircleExclamation} />
        </div>
      }
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
