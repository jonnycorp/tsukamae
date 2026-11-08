import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_CATALOG_KEY, getCatalogDex } from '../../../utils/local-data';
import { EMPTY_METADATA } from '../../../utils/capture-fields';
import { displayName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { padding } from '../../../utils/formatting';
import { placeBeside } from './Scene';
import { queryMatcher } from './filters';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { KeyboardEvent } from 'react';

// how many matches show at once
const MATCHES = 10;
const GAP = 10;

interface Props {
  // the point it opens beside: the empty slot pressed, or the toolbar's button
  at: { x: number; y: number };
  onPick: (species: number) => void;
  onClose: () => void;
}

// a free-form dex's way to add a mon: any of HOME's national catalog, forms each their own, found by name in
// either language (or kana) or by number as the search finds them, then picked with a press or ↑ ↓ and Enter. Escape or
// a press outside closes it
export function SpeciesPicker ({ at, onPick, onClose }: Props) {
  const { activeDexView } = useDexContext();
  const { t, locale } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [hot, setHot] = useState(0);

  const matches = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    const match = queryMatcher(query, false);
    return getCatalogDex(DEFAULT_CATALOG_KEY).pokemonList
    .filter((pokemon) => match({ ...EMPTY_METADATA, pokemon, captured: false, status: null, sealed: false } as Capture))
    .slice(0, MATCHES);
  }, [query]);

  useLayoutEffect(() => {
    if (ref.current) {
      placeBeside(ref.current, at.x, at.y, GAP);
    }
  }, [at, matches.length]);

  // placed by its slot, it doesn't follow one that moves: a scroll under it or a resized window closes it, as the move
  // menu's does
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = (e: Event) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) {
        onClose();
      }
    };
    // Esc closes it from anywhere in it: a press on its edge or its "no matches" line takes the focus off the input,
    // whose own Esc goes no further
    const handleKeyDown = (e: Event) => {
      if (!(e instanceof window.KeyboardEvent)) {
        return;
      }
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setHot((current) => Math.max(0, Math.min(matches.length - 1, current + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && matches[hot]) {
      e.preventDefault();
      onPick(matches[hot].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div className="species-picker" ref={ref} role="dialog">
      <input
        aria-label={t('free.addMon')}
        autoFocus
        className="species-picker-input"
        onChange={(e) => {
          setQuery(e.target.value);
          setHot(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t('free.pickPlaceholder')}
        value={query}
      />
      {query.trim() !== '' && (
        <ul className="species-picker-list" role="listbox">
          {matches.length === 0 && <li className="species-picker-none">{t('free.pickNone')}</li>}
          {matches.map((pokemon, i) => (
            <li key={pokemon.id}>
              <button
                aria-selected={i === hot}
                className={classNames('species-picker-option', { hot: i === hot })}
                onClick={() => onPick(pokemon.id)}
                onPointerEnter={() => setHot(i)}
                role="option"
                type="button"
              >
                <span className="species-picker-icon"><i className={iconClass(pokemon, activeDexView!)} /></span>
                <span className="species-picker-name">{displayName(pokemon.name, pokemon.name_ja, locale)}</span>
                {pokemon.form && <span className="species-picker-form">{pokemon.form}</span>}
                <span className="species-picker-number">#{padding(pokemon.national_id, 4)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
