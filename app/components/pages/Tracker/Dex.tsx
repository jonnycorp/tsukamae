import { useDeferredValue, useMemo } from 'react';

import { Box } from './Box';
import { Scroll } from './Scroll';
import { SearchResults } from './SearchResults';
import { anyFilterActive } from './filters';
import { groupBoxes } from '../../../utils/pokemon';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useTrackerActions, useTrackerState } from './use-tracker';

import type { Dispatch, MouseEventHandler, SetStateAction } from 'react';
import type { TrackerFilters } from './filters';

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
  const { releaseCaptures } = useTrackerActions();

  const boxes = useMemo(() => groupBoxes(captures), [captures]);

  useHotkey('d', () => {
    const tile = document.querySelector<HTMLElement>('.pokemon[data-pokemon-id]:hover');
    const id = Number(tile?.dataset.pokemonId);
    const capture = captures.find((cap) => cap.pokemon.id === id);
    if (!capture?.captured || capture.sealed) {
      return;
    }
    releaseCaptures([id]);
    setSelectedPokemon((current) => (current === id ? 0 : current));
  });

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
