import { useState } from 'react';

import { useLabText } from './lab-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';

import type { CapturePokemon } from '../../../../types';
import type { ReactNode } from 'react';

// the official artwork, as `yarn sprites:art` saves it (scripts/fetch-artwork.mjs): never committed, so a machine
// without it shows the sprite as ever
const REGIONAL = new Set(['alola', 'galar', 'hisui', 'paldea']);
const artSrc = ({ national_id: national, form }: CapturePokemon, shiny: boolean) =>
  `/artwork/${shiny ? 'shiny/' : ''}${national}${form && REGIONAL.has(form) ? `-${form}` : ''}.png`;

interface Props {
  pokemon: CapturePokemon;
  shiny: boolean;
  // the sprite, drawn in the glass as ever when the art is off or missing
  children: ReactNode;
}

// the review's lens with the official artwork in place of the sprite: standing out of the glass over its rim, its
// silhouette cast behind it, both settling in as the mon comes up. A switch under the lens goes between the art and
// the sprite, kept through a restart; a mon with no art saved shows its sprite
export function LabLensArt ({ pokemon, shiny, children }: Props) {
  const { lt } = useLabText();
  const [art, setArt] = useLocalStorage('labLensArt', true);
  const [missing, setMissing] = useState<Set<string>>(() => new Set());
  const src = artSrc(pokemon, shiny);
  const shows = art && !missing.has(src);

  return (
    <>
      <span className="review-lens-glass">{!shows && children}</span>
      {shows && (
        <span aria-hidden="true" className="lab-art" key={src}>
          <img alt="" className="lab-art-shadow" draggable={false} src={src} />
          <img alt="" className="lab-art-img" draggable={false} onError={() => setMissing((prev) => new Set(prev).add(src))} src={src} />
        </span>
      )}
      <button className="lab-art-switch" onClick={() => setArt(!art)} type="button">
        {lt(art ? 'art.toSprite' : 'art.toArt')}
      </button>
    </>
  );
}
