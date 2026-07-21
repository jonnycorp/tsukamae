import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

import { DexIndicator } from '../library/DexIndicator';
import { DexModal } from '../library/DexModal';
import { PokeballLogo } from '../library/PokeballLogo';
import { Progress } from '../library/Progress';
import { dexCounts, toDexView } from '../../utils/local-data';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../hooks/use-translation';

import type { MouseEvent } from 'react';

export function Landing () {
  const { dexes, setActiveDex, moveDex } = useDexContext();
  const { t } = useTranslation();

  const [showCreate, setShowCreate] = useState(false);

  const hasDexes = (dexes?.length ?? 0) > 0;

  // Reordering lives on the row's click target, so don't let it open the dex.
  const handleMoveClick = (e: MouseEvent<HTMLButtonElement>, id: string, delta: number) => {
    e.stopPropagation();
    moveDex(id, delta);
  };

  return (
    <div className="home-container">
      <div className="home">
        <div className="hero">
          <PokeballLogo />
          <h1>{t('app.name')}</h1>
        </div>

        <div className="sub">
          {hasDexes ?
            <ul className="dex-list">
              {dexes!.map((dex, index) => {
                const counts = dexCounts(dex);
                return (
                  <li className="dex-list-item" key={dex.id} onClick={() => setActiveDex(dex.id)}>
                    <div className="dex-list-item-title">
                      <h3>{dex.title}</h3>
                      <DexIndicator dex={toDexView(dex)} />
                      <div className="dex-reorder">
                        <button
                          aria-label={t('landing.moveUp')}
                          disabled={index === 0}
                          onClick={(e) => handleMoveClick(e, dex.id, -1)}
                          title={t('landing.moveUp')}
                          type="button"
                        >
                          <FontAwesomeIcon icon={faChevronUp} />
                        </button>
                        <button
                          aria-label={t('landing.moveDown')}
                          disabled={index === dexes!.length - 1}
                          onClick={(e) => handleMoveClick(e, dex.id, 1)}
                          title={t('landing.moveDown')}
                          type="button"
                        >
                          <FontAwesomeIcon icon={faChevronDown} />
                        </button>
                      </div>
                    </div>
                    <Progress caught={counts.caught} locked={counts.locked} temporary={counts.temporary} total={counts.total} />
                  </li>
                );
              })}
            </ul> :
            <p className="dex-list-empty">{t('landing.empty')}</p>
          }

          <button className="btn btn-blue" onClick={() => setShowCreate(true)} type="button">
            {hasDexes ? t('landing.createNew') : t('landing.createFirst')}
          </button>
        </div>
      </div>

      {showCreate && <DexModal onRequestClose={() => setShowCreate(false)} />}
    </div>
  );
}
