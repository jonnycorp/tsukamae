import classNames from 'classnames';
import { useEffect, useState } from 'react';

import { useLabText } from './lab-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';

import type { CapturePokemon } from '../../../../types';
import type { ReactNode } from 'react';

// the official artwork, as `yarn sprites:art` saves it (scripts/fetch-artwork.mjs): never committed, so a machine
// without it shows the sprite as ever
const REGIONAL = new Set(['alola', 'galar', 'hisui', 'paldea']);
const artSrc = ({ national_id: national, form }: CapturePokemon, shiny: boolean, variety: string | null) =>
  `/artwork/${shiny ? 'shiny/' : ''}${national}${variety ? `-${variety}` : form && REGIONAL.has(form) ? `-${form}` : ''}.png`;

// every species' other varieties with art saved (megas, Gigantamax, costumes), as the script lists them: read once
let formsList: Promise<Record<string, string[]>> | null = null;
const loadForms = () => {
  formsList ??= fetch('/artwork/forms.json').then((res) => (res.ok ? res.json() : {}), () => ({}));
  return formsList;
};

// a variety's name for its chip: Mega X, G-Max, and the rest as PokéAPI has them, the words capitalised
const WORDS: Record<string, { ja: string; en: string }> = {
  mega: { ja: 'メガ', en: 'Mega' },
  gmax: { ja: 'キョダイ', en: 'G-Max' },
  x: { ja: 'X', en: 'X' },
  y: { ja: 'Y', en: 'Y' },
};
const varietyName = (variety: string, locale: 'ja' | 'en') => variety.split('-')
.map((word) => WORDS[word]?.[locale] ?? word.charAt(0).toUpperCase() + word.slice(1))
.join(locale === 'ja' && variety.startsWith('mega') ? '' : ' ');

interface Props {
  pokemon: CapturePokemon;
  // its record says Gigantamax: the giant form's art first, where there is one
  giant: boolean;
  shiny: boolean;
  // the sprite, drawn in the glass as ever when the art is off or missing
  children: ReactNode;
}

// the review's lens with the official artwork in place of the sprite: standing out of the glass over its rim, its
// silhouette cast behind it, both settling in as the mon comes up. A switch under the lens goes between the art and
// the sprite, kept through a restart; a mon with no art saved shows its sprite. Over the lens, its species' other forms
// (a mega, its giant form, a costume), each pressed to look at it a while; the next mon starts on its own again
export function LabLensArt ({ pokemon, giant, shiny, children }: Props) {
  const { lt, locale } = useLabText();
  const [art, setArt] = useLocalStorage('labLensArt', true);
  const [missing, setMissing] = useState<Set<string>>(() => new Set());
  const [forms, setForms] = useState<Record<string, string[]>>({});
  const [picked, setPicked] = useState<{ mon: string; variety: string | null } | null>(null);
  useEffect(() => {
    loadForms().then(setForms);
  }, []);

  const mon = `${pokemon.national_id}-${pokemon.form ?? ''}`;
  const varieties = pokemon.form ? [] : forms[pokemon.national_id] ?? [];
  const variety = picked?.mon === mon ? picked.variety : giant && varieties.includes('gmax') ? 'gmax' : null;
  const src = artSrc(pokemon, shiny, variety);
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
      {art && varieties.length > 0 && (
        <span className="lab-art-forms">
          {[null, ...varieties].map((option) => (
            <button
              className={classNames({ on: option === variety })}
              key={option ?? ''}
              onClick={() => setPicked({ mon, variety: option })}
              type="button"
            >
              {option ? varietyName(option, locale) : lt('art.base')}
            </button>
          ))}
        </span>
      )}
      <button className="lab-art-switch" onClick={() => setArt(!art)} type="button">
        {lt(art ? 'art.toSprite' : 'art.toArt')}
      </button>
    </>
  );
}
