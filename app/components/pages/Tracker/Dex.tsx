import { useMemo } from 'react';

import { Box } from './Box';
import { Scroll } from './Scroll';
import { SearchResults } from './SearchResults';
import { anyFilterActive, useTrackerState } from './use-tracker';
import { groupBoxes } from '../../../utils/pokemon';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Dispatch, MouseEventHandler, SetStateAction } from 'react';
import type { TrackerFilters } from './use-tracker';

const DEFER_CUTOFF = 1;

interface Props {
  filters: TrackerFilters;
  onScrollButtonClick: MouseEventHandler<HTMLDivElement>;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
  showScrollButton: boolean;
}

export function Dex ({
  filters,
  onScrollButtonClick,
  query,
  setFilters,
  setQuery,
  setSelectedPokemon,
  showScrollButton,
}: Props) {
  const { activeDexView } = useDexContext();
  const { captures } = useTrackerState();

  const groupedCaptures = useMemo(() => groupBoxes(captures), [captures]);
  const boxes = useMemo(() => {
    return groupedCaptures.map((box, i) => (
      <Box
        captures={box}
        deferred={i > DEFER_CUTOFF}
        dexTotal={activeDexView!.total}
        key={box[0].pokemon.id}
        setSelectedPokemon={setSelectedPokemon}
      />
    ));
  }, [groupedCaptures]);

  return (
    <div className="dex">
      <div className="wrapper">
        <Scroll onClick={onScrollButtonClick} showScroll={showScrollButton} />
        {query.length > 0 || anyFilterActive(filters) ?
          <SearchResults
            captures={captures}
            filters={filters}
            query={query}
            setFilters={setFilters}
            setQuery={setQuery}
            setSelectedPokemon={setSelectedPokemon}
          /> :
          <div className="box-grid">{boxes}</div>
        }
      </div>
    </div>
  );
}
