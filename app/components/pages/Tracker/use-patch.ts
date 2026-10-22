import { useCallback } from 'react';

import { EMPTY_METADATA, freshMetadata, lookupOT, withBaselines, withFieldInvariants } from '../../../utils/capture-fields';
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
// record, and leaving it starts over like a new mark; otherwise each field's invariants follow it, and a game or
// language moved by hand onto another of your games takes that game's OT, as picking it would (a typed OT, or one
// moving onto a game that isn't yours, stays); sealing is only ever from Caught
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
    if (!('ot' in changes) && ('origin_game' in resolved || 'language' in resolved)) {
      const stamped = lookupOT(env.saves, capture.origin_game, capture.language);
      const restamped = lookupOT(
        env.saves,
        'origin_game' in resolved ? resolved.origin_game ?? null : capture.origin_game,
        'language' in resolved ? resolved.language ?? null : capture.language,
      );
      if (stamped !== null && restamped !== null && capture.ot === stamped) {
        resolved.ot = restamped;
      }
    }
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
