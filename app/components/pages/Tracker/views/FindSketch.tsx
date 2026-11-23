import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES } from '../../../../utils/capture-fields';
import { FACETS, queryMatcher } from '../filters';
import { GalaxyPanel } from './GalaxyPanel';
import { Scene, SceneMon } from '../Scene';
import { boxTitle } from '../Box';
import { displayName } from '../../../library/PokemonName';
import { groupBoxes, BOX_COLUMNS } from '../../../../utils/pokemon';
import { localizeBall } from '../../../../i18n/names';
import { romajiToKana } from './romaji';
import { translate } from '../../../../i18n/translations';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useViewText } from './views-i18n';
import { useScopedRecords } from './ViewScope';

import type { Facet, FacetId } from '../filters';
import type { KeyboardEvent } from 'react';
import type { SceneView } from '../Scene';
import type { ViewProps } from './views-kit';
import type { ViewRecord } from './ViewScope';

// the most results drawn; a search narrows to fewer than this long before anyone reads that many
const SHOWN = 120;
// the most suggestions under the box
const SUGGESTIONS = 7;

interface Chip {
  facet: FacetId;
  value: string;
}

interface Suggestion extends Chip {
  label: string;
  count: number;
}

// the search as it was left for the dex's filter (Shift+Enter), to come back to
interface FindView extends SceneView {
  text: string;
  chips: Chip[];
}

// where a mon sits in the dex's boxes, as the boxes draw them: the box's number and title, its row and column
interface Place {
  box: number;
  title: string;
  row: number;
  column: number;
}

// a facet's values as a record (or its species) has them, as one list
const valuesOf = (facet: Facet, record: ViewRecord): string[] => {
  const value = facet.value(record.capture);
  return value === null ? [] : typeof value === 'string' ? [value] : [...value];
};

// folded for a match: width, case, and hiragana as katakana
const fold = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));

// a range of numbers typed (1-151, #252-386), or null
function rangeOf (text: string): [number, number] | null {
  const match = /^#?\s*(\d{1,4})\s*[-~〜]\s*(\d{1,4})$/.exec(text.normalize('NFKC').trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

// the search: one box for everything. A name in English, in kana or in romaji (pika finds ピカチュウ), a nickname, a
// number or a range of them (1-151); and as it's typed, the dex's own values it could mean (a ball, a game, an OT, a
// nature, a type) offered under it, each taken as a chip, the chips narrowing together. The results are the mons
// themselves with where each sits in the boxes, to file it; the one picked at the side in the galaxy's glass. Enter
// shows it in the boxes where it's filed (views/spotlight.ts), its panel's link opens it; with chips, Shift+Enter
// filters the dex to them, a set and never one mon
export function FindSketch ({ back, onClose, onFilter, onLocate, onSpot }: ViewProps) {
  const { lt, locale } = useViewText();
  const { activeDex, activeDexView } = useDexContext();
  const records = useScopedRecords('dex');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => (back as FindView | null)?.text ?? '');
  const [chips, setChips] = useState<Chip[]>(() => (back as FindView | null)?.chips ?? []);
  const [at, setAt] = useState(0);
  const regional = Boolean(activeDexView?.regional);

  useEffect(() => inputRef.current?.focus(), []);

  // every mon's place in the boxes: a catalog's as its boxes are cut, a free-form dex's where its entries put them, in
  // the boxes it has (FreeBoxes), a box left unnamed going by its number alone
  const places = useMemo(() => {
    const out = new Map<string, Place>();
    if (activeDex!.free) {
      const boxes = activeDex!.boxes ?? [];
      const at = new Map(boxes.map((box, b) => [box.id, b]));
      const entries = new Map((activeDex!.entries ?? []).map((entry) => [entry.id, entry]));
      for (const record of records) {
        const entry = entries.get(record.capture.pokemon.id);
        const b = entry && at.get(entry.box);
        if (entry && b !== undefined) {
          out.set(record.key, { box: b + 1, title: boxes[b].name, row: Math.floor(entry.slot / BOX_COLUMNS) + 1, column: (entry.slot % BOX_COLUMNS) + 1 });
        }
      }
      return out;
    }
    groupBoxes(records.map((record) => ({ ...record, pokemon: record.capture.pokemon }))).forEach((box, b) => {
      const title = boxTitle(box.map(({ capture }) => capture), activeDexView!, locale);
      box.forEach((record, i) => out.set(record.key, { box: b + 1, title, row: Math.floor(i / BOX_COLUMNS) + 1, column: (i % BOX_COLUMNS) + 1 }));
    });
    return out;
  }, [records, activeDex, activeDexView, locale]);

  // the values the dex's records hold, by facet, labelled and counted, for the suggestions
  const values = useMemo(() => FACETS.filter((facet) => !facet.pressOnly).map((facet) => {
    const counts = new Map<string, number>();
    for (const record of records) {
      for (const value of valuesOf(facet, record)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return { facet, options: [...counts.entries()].map(([value, count]) => ({ value, count, label: facet.label(value, locale), folded: fold(facet.label(value, locale)) })) };
  }), [records, locale]);

  const term = text.trim();
  const kana = romajiToKana(term.replace(/\s+/g, ''));

  const suggestions = useMemo((): Suggestion[] => {
    if (!term || rangeOf(term)) {
      return [];
    }
    const wanted = [fold(term), ...(kana ? [kana] : [])];
    const found: (Suggestion & { start: boolean })[] = [];
    for (const { facet, options } of values) {
      for (const option of options) {
        const start = wanted.some((want) => option.folded.startsWith(want));
        if ((start || wanted.some((want) => want.length > 1 && option.folded.includes(want))) && !chips.some((chip) => chip.facet === facet.id && chip.value === option.value)) {
          found.push({ facet: facet.id, value: option.value, label: option.label, count: option.count, start });
        }
      }
    }
    return found.sort((a, b) => Number(b.start) - Number(a.start) || b.count - a.count).slice(0, SUGGESTIONS);
  }, [term, kana, values, chips]);

  const results = useMemo(() => {
    const range = rangeOf(term);
    const byName = term && !range ? queryMatcher(term, regional) : null;
    const byKana = kana ? queryMatcher(kana, false) : null;
    const facets = new Map<FacetId, string[]>();
    for (const chip of chips) {
      facets.set(chip.facet, [...(facets.get(chip.facet) ?? []), chip.value]);
    }
    if (!term && chips.length === 0) {
      return [];
    }
    return records.filter((record) => {
      const { capture } = record;
      if (range) {
        const number = regional ? capture.pokemon.dex_number : capture.pokemon.national_id;
        if (number < range[0] || number > range[1]) {
          return false;
        }
      } else if (byName && !byName(capture) && !byKana?.(capture)) {
        return false;
      }
      return [...facets.entries()].every(([id, selected]) => {
        const facet = FACETS.find((entry) => entry.id === id)!;
        const held = valuesOf(facet, record);
        return selected.some((value) => held.some((own) => (facet.same ? facet.same(own, value) : own === value)));
      });
    });
  }, [term, kana, chips, records, regional]);

  // the list the arrows walk: the suggestions, then the results
  const items = suggestions.length + Math.min(results.length, SHOWN);
  const picked = at >= suggestions.length ? results[at - suggestions.length] ?? null : null;

  useEffect(() => setAt(0), [term, chips]);

  useEffect(() => {
    listRef.current?.querySelector('.at')?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const take = (suggestion: Suggestion) => {
    setChips([...chips, { facet: suggestion.facet, value: suggestion.value }]);
    setText('');
    inputRef.current?.focus();
  };

  const filterDex = () => {
    if (chips.length === 0) {
      return;
    }
    const facets: Partial<Record<FacetId, string[]>> = {};
    for (const chip of chips) {
      facets[chip.facet] = [...(facets[chip.facet] ?? []), chip.value];
    }
    const left: FindView = { scroll: 0, text, chips };
    onFilter({ view: 'all', facets }, left);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      setAt(Math.max(0, Math.min(items - 1, at + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && e.shiftKey) {
      filterDex();
    } else if (e.key === 'Enter') {
      if (at < suggestions.length) {
        take(suggestions[at]);
      } else if (picked?.here) {
        onSpot(picked.capture.pokemon.id);
      }
    } else if (e.key === 'Backspace' && !text && chips.length > 0) {
      setChips(chips.slice(0, -1));
    } else if (e.key === 'Escape' && (text || chips.length > 0)) {
      setText('');
      setChips([]);
    } else {
      return;
    }
    e.preventDefault();
  };

  const facetName = (id: FacetId) => translate(locale, FACETS.find((facet) => facet.id === id)!.labelKey);
  const chipLabel = (chip: Chip) => FACETS.find((facet) => facet.id === chip.facet)!.label(chip.value, locale);

  return (
    <Scene hint={lt('find.hint')} name="view-find" onClose={onClose} quiet={Boolean(back)} title={lt('find.title')}>
      {({ scale }) => (
        <div className={classNames('lf-page', { aside: picked })} style={{ zoom: scale }}>
          <label className="lf-box">
            <FontAwesomeIcon icon={faSearch} />
            {chips.map((chip, i) => (
              <button className="lf-chip" key={`${chip.facet}:${chip.value}`} onClick={() => setChips(chips.filter((_, j) => j !== i))} type="button">
                <small>{facetName(chip.facet)}</small>{chipLabel(chip)}<FontAwesomeIcon icon={faTimes} />
              </button>
            ))}
            <input
              autoCapitalize="off"
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={chips.length ? '' : lt('find.placeholder')}
              ref={inputRef}
              spellCheck={false}
              value={text}
            />
            {kana && kana !== term && <em className="lf-kana">{kana}</em>}
          </label>

          <div className="lf-list" ref={listRef}>
            {suggestions.length > 0 && (
              <div className="lf-suggest">
                {suggestions.map((suggestion, i) => (
                  <button className={classNames({ at: at === i })} key={`${suggestion.facet}:${suggestion.value}`} onClick={() => take(suggestion)} onPointerEnter={() => setAt(i)} type="button">
                    <small>{facetName(suggestion.facet)}</small>
                    {suggestion.facet === 'ball' && <img alt="" height={24} src={`/balls/${suggestion.value}.png`} width={24} />}
                    <span>{suggestion.label}</span>
                    <b>{suggestion.count}</b>
                  </button>
                ))}
              </div>
            )}

            {(term || chips.length > 0) && (results.length > 0 || suggestions.length === 0) && (
              <p className="lf-count">
                {lt('find.count', { n: results.length })}
                {chips.length > 0 && <button onClick={filterDex} type="button">{lt('find.filter')}</button>}
              </p>
            )}

            {results.slice(0, SHOWN).map((record, i) => {
              const place = places.get(record.key);
              const { capture } = record;
              const n = suggestions.length + i;
              return (
                <button
                  className={classNames('lf-mon', { at: at === n, caught: capture.captured, sealed: capture.sealed })}
                  key={record.key}
                  onClick={() => (at === n && record.here ? onSpot(capture.pokemon.id) : setAt(n))}
                  type="button"
                >
                  <SceneMon mon={capture} view={record.view} />
                  <span className="lf-names">
                    <strong>{capture.pokemon.name_ja || capture.pokemon.name}</strong>
                    <small>No.{String(capture.pokemon.national_id).padStart(4, '0')} · {displayName(capture.pokemon.name, null, 'en')}{capture.has_nickname && capture.nickname ? ` · “${capture.nickname}”` : ''}</small>
                  </span>
                  {capture.ball && capture.ball !== 'unknown' && <img alt={localizeBall(locale, capture.ball, BALL_NAMES.get(capture.ball) ?? capture.ball)} className="lf-ball" height={26} src={`/balls/${capture.ball}.png`} width={26} />}
                  {place && (
                    <span className="lf-place">
                      <b>{lt('find.box', { n: place.box })}</b>
                      {place.title && <small>{place.title}</small>}
                      <i>{lt('find.slot', { row: place.row, column: place.column })}</i>
                    </span>
                  )}
                </button>
              );
            })}
            {results.length > SHOWN && <p className="lf-count">{lt('find.more', { n: results.length - SHOWN })}</p>}
            {!term && chips.length === 0 && <p className="lf-tips">{lt('find.tips')}</p>}
          </div>

          {picked && (
            <GalaxyPanel
              ballName={picked.capture.ball ? localizeBall(locale, picked.capture.ball, BALL_NAMES.get(picked.capture.ball) ?? picked.capture.ball) : undefined}
              key={picked.key}
              keys={false}
              kind="constellation"
              note={picked.capture.captured ? undefined : lt('mosaic.state.missing')}
              onLocate={() => onLocate(picked.capture.pokemon.id)}
              record={picked}
            />
          )}
        </div>
      )}
    </Scene>
  );
}
