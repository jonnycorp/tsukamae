import { useMemo } from 'react';

import { Box } from './Box';
import { Scroll } from './Scroll';
import { SearchResults } from './SearchResults';
import { groupBoxes } from '../../../utils/pokemon';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerContext } from './use-tracker';

import type { Dispatch, MouseEventHandler, SetStateAction } from 'react';

const DEFER_CUTOFF = 1;

interface Props {
  hideCaught: boolean;
  onScrollButtonClick: MouseEventHandler<HTMLDivElement>;
  query: string;
  setHideCaught: Dispatch<SetStateAction<boolean>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
  setTemporaryOnly: Dispatch<SetStateAction<boolean>>;
  showScrollButton: boolean;
  temporaryOnly: boolean;
}

export function Dex ({
  hideCaught,
  onScrollButtonClick,
  query,
  setHideCaught,
  setQuery,
  setSelectedPokemon,
  setTemporaryOnly,
  showScrollButton,
  temporaryOnly,
}: Props) {
  const { activeDexView } = useDexContext();
  const { captures } = useTrackerContext();

  const groupedCaptures = useMemo(() => groupBoxes(captures), [captures]);
  const boxes = useMemo(() => {
    return groupedCaptures.map((box, i) => (
      <Box
        boxIndex={i}
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
        {query.length > 0 || hideCaught || temporaryOnly ?
          <SearchResults
            captures={captures}
            hideCaught={hideCaught}
            query={query}
            setHideCaught={setHideCaught}
            setQuery={setQuery}
            setSelectedPokemon={setSelectedPokemon}
            setTemporaryOnly={setTemporaryOnly}
            temporaryOnly={temporaryOnly}
          /> :
          <div className="box-grid">{boxes}</div>
        }
      </div>
    </div>
  );
}
