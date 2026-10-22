import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faRotateLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useState } from 'react';

import { displayName } from '../../library/PokemonName';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { HistoryDirection, HistoryStep } from '../../../utils/local-data';

const SHOW_MS = 4000;
// its gap from the window's foot (styles/review.scss), kept above whatever stands there
const FOOT_GAP = 20;

interface Props {
  direction: HistoryDirection;
  // null when there was nothing to take back or put back
  step: HistoryStep | null;
  // the other way, from the toast's button
  onAgain: (direction: HistoryDirection) => void;
  onDone: () => void;
}

// what Ctrl+Z (or Ctrl+Shift+Z) just did, said for a moment at the window's foot, with the way back
export function UndoToast ({ direction, step, onAgain, onDone }: Props) {
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();

  useEffect(() => {
    const timer = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  // above the review's foot (zoomed with its scene) or the batch bar, never over them
  const [bottom, setBottom] = useState<number | undefined>();
  useLayoutEffect(() => {
    const below = document.querySelector('.review-foot') ?? document.querySelector('.batch-bar');
    if (below) {
      setBottom(window.innerHeight - below.getBoundingClientRect().top + FOOT_GAP);
    }
  }, []);

  let text: string;
  if (!step) {
    text = t(direction === 'undo' ? 'history.nothingToUndo' : 'history.nothingToRedo');
  } else {
    const ids = Object.keys(step.before).map(Number);
    const first = captures.find((capture) => capture.pokemon.id === ids[0]);
    const what = ids.length === 1 && first ? displayName(first.pokemon.name, first.pokemon.name_ja, locale) : t('filter.count', { count: ids.length });
    text = t(direction === 'undo' ? 'history.undone' : 'history.redone', { what });
  }
  const other = direction === 'undo' ? 'redo' : 'undo';

  return createPortal(
    <div className="undo-toast" role="status" style={{ bottom }}>
      <FontAwesomeIcon icon={direction === 'undo' ? faRotateLeft : faRotateRight} />
      <span>{text}</span>
      {step &&
        <button onClick={() => onAgain(other)} type="button">{t(other === 'redo' ? 'history.redo' : 'history.undo')}</button>
      }
    </div>,
    document.body,
  );
}
