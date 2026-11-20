import classNames from 'classnames';
import { useMemo } from 'react';

import { everyDex } from '../../../../utils/copies';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useLabText } from './lab-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { PersonalDex } from '../../../../utils/local-data';

// what a sketch reads: the open dex alone, or every dex you have
export type LabScope = 'dex' | 'all';

// a mon in one of your dexes: its key unique across them all (a mon's id is its catalog's, so two dexes share them),
// and whether it's in the open dex, the only one the dex can go to
export interface LabRecord {
  key: string;
  capture: Capture;
  dex: PersonalDex;
  here: boolean;
}

// a sketch's scope, the open dex unless it's been switched, kept for each sketch through a restart
export function useLabScope (sketch: string): [LabScope, (scope: LabScope) => void] {
  const [scope, setScope] = useLocalStorage<LabScope>(`labScope.${sketch}`, 'dex');
  return [scope === 'all' ? 'all' : 'dex', setScope];
}

// the records in a scope: the open dex's as the tracker holds them, every other's read from its progress
export function useScopedRecords (scope: LabScope): LabRecord[] {
  const { captures } = useTrackerState();
  const { dexes, activeDex } = useDexContext();
  return useMemo(() => {
    const all = scope === 'all' ? everyDex(dexes ?? [], activeDex!.id, captures) : [{ dex: activeDex!, captures }];
    return all.flatMap(({ dex, captures: held }) => held.map((capture) => ({
      key: `${dex.id}:${capture.pokemon.id}`,
      capture,
      dex,
      here: dex.id === activeDex!.id,
    })));
  }, [scope, dexes, activeDex, captures]);
}

// the switch between the two, in a sketch's header
export function ScopeSwitch ({ scope, onChange }: { scope: LabScope; onChange: (scope: LabScope) => void }) {
  const { lt } = useLabText();
  const { dexes } = useDexContext();
  return (
    <div className="lab-scope" role="group">
      {(['dex', 'all'] as LabScope[]).map((option) => (
        <button
          aria-pressed={scope === option}
          className={classNames({ on: scope === option })}
          disabled={option === 'all' && (dexes?.length ?? 0) < 2}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {lt(option === 'dex' ? 'scope.dex' : 'scope.all')}
        </button>
      ))}
    </div>
  );
}
