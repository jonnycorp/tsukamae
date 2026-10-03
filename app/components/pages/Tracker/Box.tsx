import classNames from 'classnames';
import { memo, useMemo } from 'react';

import { BOX_SIZE, dexNumber } from '../../../utils/pokemon';
import { Pokemon } from './Pokemon';
import { shineClip as clipFor, useTrackerActions } from './use-tracker';
import { localizeBoxName } from '../../../i18n/names';
import { translate } from '../../../i18n/translations';
import { useDeferredRender } from '../../../hooks/use-deferred-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, Dex } from '../../../types';
import type { Dispatch, SetStateAction } from 'react';
import type { Locale } from '../../../i18n/translations';

interface Props {
  captures: Capture[];
  // frames to wait before rendering, 0 for at once; only read as it mounts
  deferFrames: number;
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
  const range = from === to ? from : translate(locale, 'common.range', { from, to });
  const prefix = first.box?.split(':')[2];
  return prefix ? translate(locale, 'box.resetTitle', { name: localizeBoxName(locale, prefix), range }) : range;
}

function sameProps (prev: Props, next: Props): boolean {
  return prev.setSelectedPokemon === next.setSelectedPokemon &&
    prev.captures.length === next.captures.length &&
    prev.captures.every((capture, i) => capture === next.captures[i]);
}

export const Box = memo(function Box ({ captures, deferFrames, setSelectedPokemon }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { sealFx, narrow } = useTrackerActions();
  const { t, locale } = useTranslation();
  const render = useDeferredRender(deferFrames === 0, deferFrames);
  const checklist = Boolean(activeDex!.checklist);

  // the clip is drawn for the 6-column grid, not the narrow list view
  const shineClip = useMemo(() => (narrow ? null : clipFor(captures, checklist, sealFx)), [captures, checklist, sealFx, narrow]);

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
            {t('box.sealedCount', { sealed, total: captures.length })}
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
