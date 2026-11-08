import classNames from 'classnames';
import { memo, useMemo } from 'react';

import { BOX_SIZE, dexNumber } from '../../../utils/pokemon';
import { Pokemon } from './Pokemon';
import { findTheme } from '../../../palette/themes';
import { sealClip as clipFor, sealTintClips, useTrackerActions } from './use-tracker';
import { localizeBoxName } from '../../../i18n/names';
import { translate } from '../../../i18n/translations';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, Dex } from '../../../types';
import type { Dispatch, SetStateAction } from 'react';
import type { Locale } from '../../../i18n/translations';

interface Props {
  captures: Capture[];
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

// reset boxes are "reset:<number>:<prefix>" and restart the numbering under a prefix; `dash`, a theme's own between the
// numbers of a range (its rangeDash), in place of the language's
export function boxTitle (captures: Capture[], dex: Dex, locale: Locale, dash?: string): string {
  const first = captures[0].pokemon;
  const last = captures[captures.length - 1].pokemon;
  if (first.box && !first.box.startsWith('reset')) {
    return localizeBoxName(locale, first.box);
  }
  const from = dexNumber(first, dex);
  const to = dexNumber(last, dex);
  const range = from === to ? from : dash ? `${from}${dash}${to}` : translate(locale, 'common.range', { from, to });
  const prefix = first.box?.split(':')[2];
  return prefix ? translate(locale, 'box.resetTitle', { name: localizeBoxName(locale, prefix), range }) : range;
}

function sameProps (prev: Props, next: Props): boolean {
  return prev.setSelectedPokemon === next.setSelectedPokemon &&
    prev.captures.length === next.captures.length &&
    prev.captures.every((capture, i) => capture === next.captures[i]);
}

export const Box = memo(function Box ({ captures, setSelectedPokemon }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { narrow } = useTrackerActions();
  const { locale } = useTranslation();
  const { theme } = useThemeContext();
  const checklist = Boolean(activeDex!.checklist);

  // the clip is drawn for the 6-column grid, not the narrow list view
  const sealClip = useMemo(() => (narrow ? null : clipFor(captures, checklist)), [captures, checklist, narrow]);
  // and one for each place its sealed tiles away from where the dex keeps them are in
  const homeDex = activeDexView!.game.id === 'home';
  const tintClips = useMemo(() => (narrow ? [] : sealTintClips(captures, checklist, homeDex)), [captures, checklist, homeDex, narrow]);

  const complete = captures.every((capture) => capture.status === 'caught' || capture.status === 'unobtainable');

  // the title alone: what's sealed shows at a glance on the tiles, so no count of it sits beside the name
  return (
    <div className={classNames('box', { 'box-complete': complete })}>
      <div className="box-header">
        <h1>{boxTitle(captures, activeDexView!, locale, findTheme(theme).rangeDash?.[locale])}</h1>
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
        {sealClip &&
          <div className="seal-material" style={{ clipPath: sealClip }}>
            <div className="seal-flow" />
          </div>
        }
        {tintClips.map(({ tint, clip: tintClip }) => (
          <div className="seal-material" data-tint={tint} key={tint} style={{ clipPath: tintClip }}>
            <div className="seal-flow" />
          </div>
        ))}
      </div>
    </div>
  );
}, sameProps);
