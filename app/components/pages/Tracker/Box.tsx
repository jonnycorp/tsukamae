import classNames from 'classnames';
import { memo, useMemo } from 'react';

import { BOX_COLUMNS, BOX_SIZE, TILE_SIZE, dexNumber } from '../../../utils/pokemon';
import { Pokemon } from './Pokemon';
import { isDisplaySealed, useTrackerActions } from './use-tracker';
import { localizeBoxName } from '../../../i18n/names';
import { useDeferredRender } from '../../../hooks/use-deferred-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, Dex } from '../../../types';
import type { Dispatch, SetStateAction } from 'react';
import type { Locale } from '../../../i18n/translations';

interface Props {
  captures: Capture[];
  deferred: boolean;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

// reset boxes are "reset:<number>:<prefix>" and restart the numbering under a prefix
function boxTitle (captures: Capture[], dex: Dex, locale: Locale): string {
  const first = captures[0].pokemon;
  const last = captures[captures.length - 1].pokemon;
  if (first.box && !first.box.startsWith('reset')) {
    return localizeBoxName(locale, first.box);
  }
  const from = dexNumber(first, dex);
  const to = dexNumber(last, dex);
  const range = from === to ? from : `${from} - ${to}`;
  const prefix = first.box?.split(':')[2];
  return prefix ? `${localizeBoxName(locale, prefix)} ${range}` : range;
}

function sameProps (prev: Props, next: Props): boolean {
  return prev.deferred === next.deferred &&
    prev.setSelectedPokemon === next.setSelectedPokemon &&
    prev.captures.length === next.captures.length &&
    prev.captures.every((capture, i) => capture === next.captures[i]);
}

export const Box = memo(function Box ({ captures, deferred, setSelectedPokemon }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { sealFx, narrow } = useTrackerActions();
  const { t, locale } = useTranslation();
  const render = useDeferredRender(!deferred);
  const checklist = Boolean(activeDex!.checklist);

  // one band per box, clipped to the sealed slots — a per-tile shine layer exhausts GPU memory in a checklist
  const shineClip = useMemo(() => {
    // the clip is drawn for the 6-column grid, not the narrow list view
    if (narrow) {
      return null;
    }
    const holes = captures.reduce<string[]>((all, capture, index) => {
      if (isDisplaySealed(capture, checklist, sealFx)) {
        const x = (index % BOX_COLUMNS) * TILE_SIZE;
        const y = Math.floor(index / BOX_COLUMNS) * TILE_SIZE;
        all.push(`M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`);
      }
      return all;
    }, []);
    return holes.length > 0 ? `path('${holes.join('')}')` : null;
  }, [captures, checklist, sealFx, narrow]);

  if (!render) {
    return null;
  }

  const complete = captures.every((capture) => capture.status === 'caught' || capture.status === 'unobtainable');
  const sealed = captures.filter((capture) => capture.sealed).length;

  return (
    <div className={classNames('box', { 'box-complete': complete })}>
      <div className="box-header">
        <h1>{boxTitle(captures, activeDexView!, locale)}</h1>
        {!checklist &&
          <span className={classNames('box-sealed-count', { complete: sealed === captures.length })}>
            {sealed}/{captures.length} {t('box.sealed')}
          </span>
        }
      </div>
      <div className="box-container">
        <div className="tile-grid">
          {captures.map((capture) => <Pokemon capture={capture} key={capture.pokemon.id} setSelectedPokemon={setSelectedPokemon} />)}
          {Array.from({ length: BOX_SIZE - captures.length }, (_, i) => (
            <div className="pokemon empty" key={`empty-${i}`}>
              <div className="set-captured" />
            </div>
          ))}
        </div>
        {shineClip &&
          <div className="box-shine" style={{ clipPath: shineClip }}>
            <div className="box-shine-band" />
          </div>
        }
      </div>
    </div>
  );
}, sameProps);
