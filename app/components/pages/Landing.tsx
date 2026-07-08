import { useState } from 'react';

import { DexIndicator } from '../library/DexIndicator';
import { DexModal } from '../library/DexModal';
import { Progress } from '../library/Progress';
import { dexCounts, toDexView } from '../../utils/local-data';
import { useDexContext } from '../../hooks/contexts/use-dex-context';

// The landing page: the home view the logo returns to. Lists every dex you
// have (opening one enters its tracker) and offers to create a new one. With no
// dexes it's just the create prompt.
export function Landing () {
  const { dexes, setActiveDex } = useDexContext();

  const [showCreate, setShowCreate] = useState(false);

  const hasDexes = (dexes?.length ?? 0) > 0;

  return (
    <div className="home-container">
      <div className="home">
        <div className="hero">
          <img alt="Tsukamae" src="/pokeball.svg" />
          <h1>Tsukamae</h1>
        </div>

        <div className="sub">
          {hasDexes ?
            <ul className="dex-list">
              {dexes!.map((dex) => {
                const counts = dexCounts(dex);
                return (
                  <li className="dex-list-item" key={dex.id} onClick={() => setActiveDex(dex.id)}>
                    <div className="dex-list-item-title">
                      <h3>{dex.title}</h3>
                      <DexIndicator dex={toDexView(dex)} />
                    </div>
                    <Progress caught={counts.caught} locked={counts.locked} temporary={counts.temporary} total={counts.total} />
                  </li>
                );
              })}
            </ul> :
            <p className="dex-list-empty">No dexes yet — create your first one to start tracking.</p>
          }

          <button className="btn btn-blue" onClick={() => setShowCreate(true)} type="button">
            {hasDexes ? 'Create a New Dex' : 'Create Your First Dex'}
          </button>
        </div>
      </div>

      {showCreate && <DexModal onRequestClose={() => setShowCreate(false)} />}
    </div>
  );
}
