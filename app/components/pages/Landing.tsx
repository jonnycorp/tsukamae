import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  const { dexes, setActiveDex, moveDex, deleteDex } = useDexContext();
  const { t } = useTranslation();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);

  const hasDexes = (dexes?.length ?? 0) > 0;

  // the row itself opens the dex, so stop propagation
  const handleMoveClick = (e: MouseEvent<HTMLButtonElement>, id: string, delta: number) => {
    e.stopPropagation();
    moveDex(id, delta);
  };

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(t('landing.deleteConfirm', { title }))) {
      deleteDex(id);
    }
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
            <ul className={classNames('dex-list', { editing })}>
              {dexes!.map((dex, index) => {
                const counts = dexCounts(dex);
                return (
                  <li className="dex-list-item" key={dex.id} onClick={() => (editing ? undefined : setActiveDex(dex.id))}>
                    <div className="dex-list-item-title">
                      <h3>{dex.title}</h3>
                      <DexIndicator dex={toDexView(dex)} />
                      {editing &&
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
                          <button
                            aria-label={t('landing.delete')}
                            className="dex-delete"
                            onClick={(e) => handleDeleteClick(e, dex.id, dex.title)}
                            title={t('landing.delete')}
                            type="button"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      }
                    </div>
                    <Progress caught={counts.caught} marked={counts.marked} temporary={counts.temporary} total={counts.total} />
                  </li>
                );
              })}
            </ul> :
            <p className="dex-list-empty">{t('landing.empty')}</p>
          }

          <button className="btn btn-blue" onClick={() => setShowCreate(true)} type="button">
            {hasDexes ? t('landing.createNew') : t('landing.createFirst')}
          </button>

          {hasDexes &&
            <button className="btn btn-edit-list" onClick={() => setEditing((open) => !open)} type="button">
              {t(editing ? 'landing.doneEditing' : 'landing.editList')}
            </button>
          }
        </div>
      </div>

      {showCreate && <DexModal onRequestClose={() => setShowCreate(false)} />}
    </div>
  );
}
