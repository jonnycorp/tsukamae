import classNames from 'classnames';
import { useMemo } from 'react';

import { everyDex } from '../../../../utils/copies';
import { toDexView } from '../../../../utils/local-data';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useViewText } from './views-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';
import { useTrackerState } from '../use-tracker';

import type { Capture, Dex } from '../../../../types';
import type { PersonalDex } from '../../../../utils/local-data';

// what a view reads: the open dex alone, or every dex you have
export type ViewScope = 'dex' | 'all';

// a mon in one of your dexes: its key unique across them all (a mon's id is its catalog's, so two dexes share them),
// its dex as the sprites draw it (shiny or not, its games' forms), and whether it's in the open dex, the only one the
// dex can go to
export interface ViewRecord {
  key: string;
  capture: Capture;
  dex: PersonalDex;
  view: Dex;
  here: boolean;
}

// a view's scope, the open dex unless it's been switched, kept for each view through a restart
export function useViewScope (sketch: string): [ViewScope, (scope: ViewScope) => void] {
  const [scope, setScope] = useLocalStorage<ViewScope>(`viewScope.${sketch}`, 'dex');
  return [scope === 'all' ? 'all' : 'dex', setScope];
}

// the records in a scope: the open dex's as the tracker holds them, every other's read from its progress
export function useScopedRecords (scope: ViewScope): ViewRecord[] {
  const { captures } = useTrackerState();
  const { dexes, activeDex, activeDexView } = useDexContext();
  return useMemo(() => {
    const all = scope === 'all' ? everyDex(dexes ?? [], activeDex!.id, captures) : [{ dex: activeDex!, captures }];
    return all.flatMap(({ dex, captures: held }) => {
      const here = dex.id === activeDex!.id;
      const view = here ? activeDexView! : toDexView(dex);
      return held.map((capture) => ({ key: `${dex.id}:${capture.pokemon.id}`, capture, dex, view, here }));
    });
  }, [scope, dexes, activeDex, activeDexView, captures]);
}

// the switch between the two, in a view's header
export function ScopeSwitch ({ scope, onChange }: { scope: ViewScope; onChange: (scope: ViewScope) => void }) {
  const { lt } = useViewText();
  const { dexes } = useDexContext();
  return (
    <div className="view-scope" role="group">
      {(['dex', 'all'] as ViewScope[]).map((option) => (
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
