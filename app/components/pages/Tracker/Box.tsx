import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

import { BOX_COLUMNS, BOX_SIZE, TILE_SIZE } from '../../../utils/pokemon';
import { Pokemon } from './Pokemon';
import { isDisplaySealed, useTrackerActions } from './use-tracker';
import { padding } from '../../../utils/formatting';
import { useDeferredRender } from '../../../hooks/use-deferred-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { Dispatch, SetStateAction } from 'react';
import type { UICapture } from './use-tracker';

interface Props {
  captures: UICapture[];
  deferred?: boolean;
  dexTotal: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function Box ({ captures, deferred = false, dexTotal, setSelectedPokemon }: Props) {
  const { activeDex } = useDexContext();
  const { sealFx } = useTrackerActions();
  const { t } = useTranslation();
  const render = useDeferredRender(!deferred);

  // one band per box, clipped to the sealed slots — one moved layer beats a gradient repainted per tile
  const shineClip = useMemo(() => {
    const checklist = Boolean(activeDex?.checklist);
    const holes = captures.reduce<string[]>((all, capture, index) => {
      if (isDisplaySealed(capture, checklist, sealFx)) {
        const x = (index % BOX_COLUMNS) * TILE_SIZE;
        const y = Math.floor(index / BOX_COLUMNS) * TILE_SIZE;
        all.push(`M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`);
      }
      return all;
    }, []);
    return holes.length > 0 ? `path('${holes.join('')}')` : null;
  }, [captures, activeDex?.checklist, sealFx]);

  // trailing empties are padding; unmarked slots have a null status
  const allCaught = captures.every((capture) => capture.status === 'caught');
  const sealed = captures.filter((capture) => capture.sealed).length;

  const empties = useMemo(() => Array.from({ length: BOX_SIZE - captures.length }).map((_, i) => i), [captures]);

  const paddingDigits = dexTotal >= 1000 ? 4 : 3;
  const firstPokemon = captures[0].pokemon;
  const lastPokemon = captures[captures.length - 1].pokemon;
  let title = firstPokemon.box;

  if (!title) {
    const firstNumber = firstPokemon.dex_number;
    const lastNumber = lastPokemon.dex_number;
    if (firstNumber === lastNumber) {
      title = padding(firstNumber, paddingDigits);
    } else {
      title = `${padding(firstNumber, paddingDigits)} - ${padding(lastNumber, paddingDigits)}`;
    }
  } else if (title.indexOf('reset') === 0) {
    const parts = title.split(':');
    const prefix = parts[2];

    if (firstPokemon.dex_number === lastPokemon.dex_number) {
      title = padding(firstPokemon.dex_number, paddingDigits);
    } else {
      title = `${padding(firstPokemon.dex_number, paddingDigits)} - ${padding(lastPokemon.dex_number, paddingDigits)}`;
    }

    if (prefix) {
      title = `${prefix} ${title}`;
    }
  }

  if (!render) {
    return null;
  }

  return (
    <div className={classNames('box', { 'box-all-caught': allCaught })}>
      <div className="box-header">
        <div className="box-title">
          <h1>{title}</h1>
          {allCaught && <FontAwesomeIcon className="box-all-caught-icon" icon={faLock} title={t('box.allCaught')} />}
        </div>
        {/* a checklist speaks through the tiles themselves */}
        {!activeDex?.checklist &&
          <span className={classNames('box-sealed-count', { complete: sealed === captures.length })}>
            {sealed}/{captures.length} {t('box.sealed')}
          </span>
        }
      </div>
      <div className="box-container">
        {captures.map((capture) => <Pokemon capture={capture} key={capture.pokemon.id} setSelectedPokemon={setSelectedPokemon} />)}
        {empties.map((index) => <Pokemon capture={null} key={index} setSelectedPokemon={setSelectedPokemon} />)}
        {shineClip &&
          <div className="box-shine" style={{ clipPath: shineClip }}>
            <div className="box-shine-band" />
          </div>
        }
      </div>
    </div>
  );
}
