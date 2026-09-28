import { useDeferredValue, useMemo } from 'react';

import { Box } from './Box';
import { Scroll } from './Scroll';
import { SearchResults } from './SearchResults';
import { anyFilterActive, useTrackerState } from './use-tracker';
import { groupBoxes } from '../../../utils/pokemon';

import type { Dispatch, MouseEventHandler, SetStateAction } from 'react';
import type { TrackerFilters } from './use-tracker';

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
  const { captures } = useTrackerState();

  const boxes = useMemo(() => groupBoxes(captures), [captures]);

  const deferredQuery = useDeferredValue(query);
  const deferredFilters = useDeferredValue(filters);

  return (
    <div className="dex">
      <div className="wrapper">
        <Scroll onClick={onScrollButtonClick} showScroll={showScrollButton} />
        {deferredQuery.length > 0 || anyFilterActive(deferredFilters) ?
          <SearchResults
            captures={captures}
            filters={deferredFilters}
            query={deferredQuery}
            setFilters={setFilters}
            setQuery={setQuery}
            setSelectedPokemon={setSelectedPokemon}
          /> :
          <div className="box-grid">
            {boxes.map((box, i) => (
              <Box
                captures={box}
                deferred={i > 1}
                key={box[0].pokemon.id}
                setSelectedPokemon={setSelectedPokemon}
              />
            ))}
          </div>
        }
      </div>
    </div>
  );
}
