import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { baseArt, baseLookName, lookOf, looksOf } from '../../../../utils/looks';
import { canGigantamax, gigantamaxIcon, showsGigantamax } from '../../../../utils/gigantamax';
import { displayName } from '../../../library/PokemonName';
import { monIcon } from '../../../../utils/pokemon';
import { showsShiny } from '../../../../utils/shiny';
import { spriteCuts } from './sprite-atlas';
import { useLocalStorage } from '../../../../hooks/use-local-storage';
import { useViewText } from './views-i18n';

import type { Capture, CapturePokemon, Dex } from '../../../../types';

// the official artwork, as `yarn sprites:art` saves it (scripts/fetch-artwork.mjs): never committed, so a machine
// without it shows the sprite as ever
const REGIONAL = new Set(['alola', 'galar', 'hisui', 'paldea']);
export const artSrc = ({ national_id: national, form }: CapturePokemon, shiny: boolean, variety: string | null) =>
  `/artwork/${shiny ? 'shiny/' : ''}${national}${variety ? `-${variety}` : form && REGIONAL.has(form) ? `-${form}` : ''}.png`;

// every species' other varieties with art saved (megas, Gigantamax, costumes), as the script lists them: read once,
// and there from the first frame after
type SavedArt = Record<string, string[]>;
let formsList: Promise<SavedArt> | null = null;
let formsRead: SavedArt | null = null;
export function useSavedArt (): SavedArt {
  const [saved, setSaved] = useState<SavedArt>(() => formsRead ?? {});
  useEffect(() => {
    formsList ??= fetch('/artwork/forms.json').then((res) => (res.ok ? res.json() : {}), () => ({})).then((read: SavedArt) => {
      formsRead = read;
      return read;
    });
    formsList.then(setSaved);
  }, []);
  return saved;
}

// a female's own art where she has some saved (Meowstic's), as her own sprite is drawn
const femaleArt = (mon: Pick<Capture, 'pokemon'> & Partial<Pick<Capture, 'gender'>>, saved: SavedArt) =>
  (mon.gender === 'female' && !mon.pokemon.form && saved[mon.pokemon.national_id]?.includes('female') ? 'female' : null);

// a mon's base form's art (utils/looks baseArt), a female's own where it's its species' default
function ownArt (mon: Capture, dex: Dex, saved: SavedArt) {
  const art = baseArt(mon.pokemon, dex);
  return art === null ? femaleArt(mon, saved) : art;
}

// the artwork a mon's shown with, as artSrc names it: its giant form's where its record says Gigantamax, as its tile's
// record page shows, else its look's, else its own; undefined where that has none (a Vivillon's pattern)
export function shownArt (mon: Capture, dex: Dex, saved: SavedArt): string | null | undefined {
  const look = lookOf(mon, dex);
  if (showsGigantamax(mon)) {
    return look?.giant?.art ?? 'gmax';
  }
  return look ? look.art : ownArt(mon, dex, saved);
}

// a variety's name for its chip: Mega Z, and the rest as PokéAPI has them, the words capitalised
const WORDS: Record<string, { ja: string; en: string }> = {
  mega: { ja: 'メガ', en: 'Mega' },
  gmax: { ja: 'キョダイ', en: 'G-Max' },
  x: { ja: 'X', en: 'X' },
  y: { ja: 'Y', en: 'Y' },
};
const varietyName = (variety: string, locale: 'ja' | 'en') => variety.split('-')
.map((word) => WORDS[word]?.[locale] ?? word.charAt(0).toUpperCase() + word.slice(1))
.join(locale === 'ja' && variety.startsWith('mega') ? '' : ' ');

// the lens's forms: the mon's own, its looks (utils/looks), its giant form, and, with the art on, the varieties with
// art alone (a Legends: Z-A mega, a Gen 9 form), which the sheet doesn't draw, so they're never a look
type Kind = 'own' | 'look' | 'giant' | 'art';
interface Option {
  key: string;
  kind: Kind;
  name: string;
  // its sprite, but for art alone's
  icon: string | null;
  // its artwork's variety, as artSrc names it (null or '' for its species' default), undefined where it has none (a
  // Vivillon's pattern), which shows its sprite instead
  art: string | null | undefined;
}
const OWN = 'own';
const GIANT = 'giant';
// the most a sprite takes of its chip, at most its own size
const CHIP_WIDTH = 40;
const CHIP_HEIGHT = 32;

interface Props {
  // a marked mon's record (its colours, its giant form, its look), or a mon not marked yet
  mon: Capture;
  dex: Dex;
  // keeps the form shown as its look, or its own (null); absent where there's no record to keep one beside
  onKeep?: (form: string | null) => void;
}

// the review's lens with the official artwork in place of the sprite: standing out of the glass over its rim, its
// silhouette cast behind it, both settling in as the mon comes up. A switch under the lens goes between the art and
// the sprite, kept through a restart; a mon with no art saved shows its sprite. Over the lens, its forms as a row of
// their sprites, each pressed to look at it a while (the next mon starts afresh), the one looked at named under them
// with Keep, which shows the mon as that form everywhere from then on: its look. It starts on its giant form where its
// record says Gigantamax, as its tile's record page does, else on its look; art alone is only looked at
export function ViewLensArt ({ mon, dex, onKeep }: Props) {
  const { lt, locale } = useViewText();
  const [art, setArt] = useLocalStorage('viewLensArt', true);
  const [missing, setMissing] = useState<Set<string>>(() => new Set());
  const [picked, setPicked] = useState<{ mon: number; key: string } | null>(null);
  // whether the row runs on past either end, faded there
  const [more, setMore] = useState({ start: false, end: false });
  const saved = useSavedArt();
  const rowRef = useRef<HTMLSpanElement>(null);

  const { pokemon } = mon;
  const shiny = showsShiny(mon, dex);
  const kept = lookOf(mon, dex);
  const options = useMemo(() => {
    const looks = looksOf(pokemon, dex);
    const list: Option[] = [
      {
        key: OWN,
        kind: 'own',
        name: baseLookName(pokemon, dex)?.[locale] ?? displayName(pokemon.name, pokemon.name_ja, locale),
        icon: monIcon({ ...mon, look: null }, dex),
        art: ownArt(mon, dex, saved),
      },
      ...looks.map((look): Option => ({ key: look.form, kind: 'look', name: look[locale], icon: monIcon({ ...mon, look: look.form }, dex), art: look.art })),
    ];
    if (canGigantamax(pokemon)) {
      list.push({ key: GIANT, kind: 'giant', name: lt('art.giant'), icon: gigantamaxIcon(mon, dex), art: lookOf(mon, dex)?.giant?.art ?? 'gmax' });
    }
    // what's saved that no form here shows: never another region's, a female's or an empty name, but a female's own
    // where she has one (Meowstic's mega)
    const shown = new Set([...looks.flatMap((look) => [look.art, look.giant?.art]), baseArt(pokemon, dex), 'gmax']);
    const others = art && !pokemon.form ? saved[pokemon.national_id] ?? [] : [];
    const female = femaleArt(mon, saved) !== null;
    for (const variety of others) {
      if (variety && !shown.has(variety) && !variety.startsWith('female') && ![...REGIONAL].some((region) => variety.startsWith(`${region}-`))) {
        const hers = female && others.includes(`female-${variety}`);
        list.push({ key: `art:${variety}`, kind: 'art', name: varietyName(variety, locale), icon: null, art: hers ? `female-${variety}` : variety });
      }
    }
    return list;
  }, [mon, dex, pokemon, saved, art, locale, lt]);

  const start = showsGigantamax(mon) ? GIANT : kept?.form ?? OWN;
  const key = picked?.mon === pokemon.id && options.some((option) => option.key === picked.key) ? picked.key : start;
  const option = options.find((entry) => entry.key === key) ?? options[0];
  const src = option.art === undefined ? null : artSrc(pokemon, shiny, option.art);
  const shows = art && src !== null && !missing.has(src);
  const several = options.length > 1;

  // each chip's sprite at its own size, the tall and wide ones down to the chip's
  const cuts = useMemo(() => spriteCuts(options.flatMap((entry) => (entry.icon ? [entry.icon] : []))), [options]);
  const zoomOf = (icon: string) => {
    const cut = cuts.get(icon);
    return cut ? Math.min(1, CHIP_WIDTH / cut.w, CHIP_HEIGHT / cut.h) : 1;
  };

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (row) {
      const now = { start: row.scrollLeft > 1, end: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 };
      setMore((prev) => (prev.start === now.start && prev.end === now.end ? prev : now));
    }
  }, []);

  // the row scrolled by the wheel where it runs past the lens, the page under it left where it is; and kept on the
  // form shown, as a mon comes up on one along it
  useEffect(() => {
    const row = rowRef.current;
    if (!row) {
      return undefined;
    }
    const wheel = (e: WheelEvent) => {
      if (row.scrollWidth > row.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        row.scrollLeft += e.deltaY;
      }
    };
    row.addEventListener('wheel', wheel, { passive: false });
    return () => row.removeEventListener('wheel', wheel);
  }, [several]);
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('.on');
    if (row && chip && (chip.offsetLeft < row.scrollLeft || chip.offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth)) {
      row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    }
    measure();
  }, [pokemon.id, key, options.length, measure]);

  const keepable = onKeep && (option.kind === 'own' || option.kind === 'look');
  const isKept = option.key === (kept?.form ?? OWN);

  return (
    <>
      <span className="review-lens-glass">{!shows && <i className={option.icon ?? options[0].icon!} />}</span>
      {shows && (
        <span aria-hidden="true" className="view-art" key={src}>
          <img alt="" className="view-art-shadow" draggable={false} src={src} />
          <img alt="" className="view-art-img" draggable={false} onError={() => setMissing((prev) => new Set(prev).add(src))} src={src} />
        </span>
      )}
      {several && (
        <span className="view-art-forms">
          <span className={classNames('view-art-row', { 'more-start': more.start, 'more-end': more.end })} onScroll={measure} ref={rowRef}>
            {options.map((entry) => (
              <button
                aria-label={entry.name}
                aria-pressed={entry.key === option.key}
                className={classNames(`kind-${entry.kind}`, { on: entry.key === option.key, kept: onKeep && entry.kind === 'look' && entry.key === kept?.form })}
                key={entry.key}
                onClick={() => setPicked({ mon: pokemon.id, key: entry.key })}
                title={entry.name}
                type="button"
              >
                {entry.icon ? <i className={entry.icon} style={{ zoom: zoomOf(entry.icon) }} /> : entry.name}
              </button>
            ))}
          </span>
          <span className="view-art-name">
            <span>{option.name}</span>
            {option.kind === 'art' && <small>{lt('art.only')}</small>}
            {keepable && !isKept && <button className="view-art-keep" onClick={() => onKeep(option.kind === 'look' ? option.key : null)} type="button">{lt('art.keep')}</button>}
            {keepable && isKept && option.kind === 'look' && <small className="view-art-kept"><FontAwesomeIcon icon={faCheck} />{lt('art.kept')}</small>}
          </span>
        </span>
      )}
      <button className="view-art-switch" onClick={() => setArt(!art)} type="button">
        {lt(art ? 'art.toSprite' : 'art.toArt')}
      </button>
    </>
  );
}
