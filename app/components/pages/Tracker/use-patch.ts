import { useCallback } from 'react';

import { EMPTY_METADATA, freshMetadata, withBaselines, withFieldInvariants } from '../../../utils/capture-fields';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerActions } from './use-tracker';

import type { Capture, CaptureMetadata, CaptureStatus, GameSave } from '../../../types';
import type { CaptureDefaults } from '../../../utils/local-data';

export type RecordPatch = Partial<CaptureMetadata> & { status?: CaptureStatus; sealed?: boolean };

interface PatchEnv {
  defaults: CaptureDefaults | undefined;
  homeDex: boolean;
  saves: GameSave[];
}

// what a change to a marked record comes to, as storage keeps it (writeCapture): switching to unobtainable wipes the
// record, and leaving it starts over like a new mark; otherwise each field's invariants follow it. What My Game fills
// in (the game, the language, the OT and the ID No.) is filled in only by a pick there: one of them changed by hand
// changes alone, so a HOME gift keeps HOME's OT and ID No. under the origin mark of the game it came from. Sealing is
// only ever from Caught
export function resolvePatch (capture: Capture, changes: RecordPatch, env: PatchEnv): RecordPatch {
  const reviving = capture.status === 'unobtainable' && changes.status !== undefined && changes.status !== 'unobtainable';
  let resolved: RecordPatch;
  if (changes.status === 'unobtainable') {
    resolved = { ...changes, ...EMPTY_METADATA };
  } else if (reviving) {
    const fresh = freshMetadata({ defaults: env.defaults, checklist: false, homeDex: env.homeDex, genderLock: capture.pokemon.gender_lock, saves: env.saves });
    resolved = { ...fresh, ...changes, sealed: false };
  } else {
    resolved = { ...changes, ...withFieldInvariants(capture, changes) };
  }
  if (capture.sealed && resolved.status !== undefined && resolved.status !== 'caught') {
    resolved = { ...resolved, sealed: false };
  }
  return resolved;
}

// one change written to several marked records (the popover's one, the ledger's selection): each resolved against its
// own record, mirrored into the tracker with writeCapture's baseline fill, and stored. Checklists never get here
export function usePatchRecords (): (targets: Capture[], changes: RecordPatch) => void {
  const { activeDex, activeDexView, saves } = useDexContext();
  const { setCaptures, updateCapture } = useTrackerActions();
  const defaults = activeDex!.captureDefaults;
  const homeDex = activeDexView!.game.id === 'home';

  return useCallback((targets: Capture[], changes: RecordPatch) => {
    const env = { defaults, homeDex, saves };
    const resolved = new Map(targets.map((capture) => [capture.pokemon.id, resolvePatch(capture, changes, env)]));
    setCaptures((prev) => prev.map((cap) => {
      const patch = resolved.get(cap.pokemon.id);
      if (!patch) {
        return cap;
      }
      const next = { ...cap, ...patch };
      return next.status === 'unobtainable' ? next : withBaselines(next);
    }));
    for (const [pokemon, patch] of resolved) {
      updateCapture({ pokemon, ...patch });
    }
  }, [defaults, homeDex, saves, setCaptures, updateCapture]);
}
