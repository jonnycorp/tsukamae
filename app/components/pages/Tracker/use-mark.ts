import { useCallback } from 'react';

import { EMPTY_METADATA, dexBaselines, freshMetadata, withBaselines } from '../../../utils/capture-fields';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { writeTouches } from '../../../utils/review-confirm';
import { useTrackerActions } from './use-tracker';

import type { CaptureStatus } from '../../../types';

// a status set on a slot, from a tile or a ledger row: unobtainable clears the record, and what W had confirmed of it
// (utils/review-confirm); a marked record keeps its own, with what a caught one must have filled in; a new mark (or one
// back from unobtainable) is built as writeCapture builds it. The caller has already ruled out a sealed mon
export function useMark (): (pokemon: number, status: CaptureStatus) => void {
  const { activeDex, activeDexView, saves } = useDexContext();
  const { setCaptures, updateCapture } = useTrackerActions();
  const dexId = activeDex!.id;
  const checklist = Boolean(activeDex!.checklist);
  const defaults = activeDex!.captureDefaults;
  const homeDex = activeDexView!.game.id === 'home';
  const { shiny } = activeDex!;

  return useCallback((pokemon: number, status: CaptureStatus) => {
    if (status === 'unobtainable') {
      writeTouches(dexId, pokemon, null);
    }
    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== pokemon) {
        return cap;
      }
      if (status === 'unobtainable') {
        return { ...cap, ...EMPTY_METADATA, captured: true, status };
      }
      if (cap.captured && cap.status !== 'unobtainable') {
        return checklist ? { ...cap, status } : withBaselines({ ...cap, status }, dexBaselines(shiny));
      }
      const fresh = freshMetadata({ defaults, checklist, homeDex, shiny, genderLock: cap.pokemon.gender_lock, saves });
      return { ...cap, ...fresh, captured: true, status };
    }));
    updateCapture({ pokemon, status });
  }, [setCaptures, updateCapture, dexId, checklist, defaults, homeDex, shiny, saves]);
}
