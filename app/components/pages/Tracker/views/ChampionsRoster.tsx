import classNames from 'classnames';
import { useMemo, useRef, useState } from 'react';

import rosterJson from '../../../../../data/champions.json';
import { ViewTip } from './ViewTip';
import { ScopeSwitch, useViewScope, useScopedRecords } from './ViewScope';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { displayName } from '../../../library/PokemonName';
import { isCopy } from '../../../../utils/copies';
import { getCatalogDex } from '../../../../utils/local-data';
import { showsShiny } from '../../../../utils/shiny';
import { slotKey } from '../../../../utils/champions';
import { useViewText } from './views-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture, CapturePokemon } from '../../../../types';
import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { ViewKey } from './views-i18n';
import type { ViewProps } from './views-kit';
import type { PersonalDex } from '../../../../utils/local-data';

interface Roster {
  season: string;
  updated: string;
  pokemon: { national: number; form?: string; name: string }[];
}

const ROSTER = rosterJson as Roster;

// how far a roster mon has got with you: one of yours there now, one that's been (and kept its data), one you hold
// that's never gone, or none yet
type Standing = 'there' | 'been' | 'held' | 'none';
const STANDINGS: Standing[] = ['there', 'been', 'held', 'none'];
const STANDING_KEYS: Record<Standing, ViewKey> = {
  there: 'champions.there',
  been: 'champions.been',
  held: 'champions.held',
  none: 'champions.none',
};

interface Copy {
  dex: PersonalDex;
  capture: Capture;
}

interface Slot {
  key: string;
  pokemon: CapturePokemon;
  copies: Copy[];
  standing: Standing;
  shiny: number;
}

// the ring's arcs, one per standing, in the order the standings run
const RING_R = 62;
const RING_W = 14;

function standingOf (copies: Copy[]): Standing {
  if (copies.some(({ capture }) => capture.location === 'champions')) {
    return 'there';
  }
  if (copies.some(({ capture }) => capture.been_to_champions)) {
    return 'been';
  }
  return copies.length > 0 ? 'held' : 'none';
}

// the Champions roster (一覧): every mon this season's roster takes, by generation, each card showing how far it's got
// with you in the open dex (its living-dex specimen alone) or, switched, across all your dexes: there now, been, held but never gone, or none yet, with how many copies (and shiny
// ones) you have. A ring at the top counts them; the chips under it narrow the cards to one standing. A card's mon is
// gone to in the open dex when it lists it. The roster itself is data/champions.json, added to as seasons bring more
export function ChampionsRoster ({ back, onClose, onLocate }: ViewProps) {
  const { captures } = useTrackerState();
  const [scope, setScope] = useViewScope('champions');
  const records = useScopedRecords(scope);
  const { lt, locale } = useViewText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [only, setOnly] = useState<Standing | null>(null);
  const [hot, setHot] = useState<{ slot: Slot; x: number; y: number } | null>(null);

  const slots = useMemo(() => {
    const catalog = getCatalogDex('home-national').pokemonList;
    const copies = new Map<string, Copy[]>();
    for (const { dex, capture } of records) {
      if (isCopy(capture, dex)) {
        const key = slotKey(capture.pokemon.national_id, capture.pokemon.form);
        copies.set(key, [...(copies.get(key) ?? []), { dex, capture }]);
      }
    }
    return ROSTER.pokemon.flatMap((entry): Slot[] => {
      const key = slotKey(entry.national, entry.form);
      const pokemon = catalog.find((mon) => mon.national_id === entry.national && (mon.form ?? undefined) === entry.form);
      if (!pokemon) {
        return [];
      }
      const mine = copies.get(key) ?? [];
      return [{ key, pokemon, copies: mine, standing: standingOf(mine), shiny: mine.filter(({ dex, capture }) => showsShiny(capture, dex)).length }];
    });
  }, [records]);

  const counts = useMemo(() => {
    const by = new Map<Standing, number>(STANDINGS.map((standing) => [standing, 0]));
    for (const slot of slots) {
      by.set(slot.standing, by.get(slot.standing)! + 1);
    }
    return by;
  }, [slots]);

  const generations = useMemo(() => {
    const groups = new Map<number, Slot[]>();
    for (const slot of slots) {
      if (!only || slot.standing === only) {
        groups.set(slot.pokemon.generation, [...(groups.get(slot.pokemon.generation) ?? []), slot]);
      }
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [slots, only]);

  useScrollBack(pageRef, back, true);

  // where in the open dex a slot's mon is, to go to
  const inOpenDex = (slot: Slot) => captures.find((capture) => slotKey(capture.pokemon.national_id, capture.pokemon.form) === slot.key);
  const show = (slot: Slot) => (e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHot({ slot, x: rect.right, y: rect.top + rect.height / 2 });
  };
  // the cards, apart from the tip, so pointing at one re-renders none of them
  const cards = useMemo(() => generations.map(([generation, group], g) => (
    <section className="lch-gen" key={generation}>
      <h3>{lt('champions.gen', { n: generation })}<span>{group.length}</span></h3>
      <div className="lch-cards">
        {group.map((slot, i) => (
          <button
            className={`lch-card st-${slot.standing}`}
            key={slot.key}
            onBlur={() => setHot(null)}
            onClick={() => {
              const capture = inOpenDex(slot);
              if (capture) {
                onLocate(capture.pokemon.id);
              }
            }}
            onFocus={show(slot)}
            onPointerEnter={show(slot)}
            onPointerLeave={() => setHot(null)}
            style={{ '--i': Math.min(40, i + g * 4) } as CSSProperties}
            type="button"
          >
            <span className="lch-mon"><SceneMon mon={{ pokemon: slot.pokemon }} zoom={1.4} /></span>
            <span className="lch-name">{displayName(slot.pokemon.name, slot.pokemon.name_ja, locale)}</span>
            {slot.copies.length > 0 && (
              <span className="lch-badges">
                {slot.copies.length > 1 && <b>×{slot.copies.length}</b>}
                {slot.shiny > 0 && <b className="lch-shiny">✦{slot.shiny > 1 ? slot.shiny : ''}</b>}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  )), [generations, captures, locale, onLocate]); // the rest follow from these

  const placeName = (capture: Capture) => (capture.location === 'champions'
    ? lt('champions.atChampions')
    : capture.location === 'home' ? 'HOME' : lt('champions.inGame'));

  // the ring: each standing's arc, laid end to end round from the top
  const circumference = 2 * Math.PI * RING_R;
  let offset = 0;
  const arcs = STANDINGS.filter((standing) => standing !== 'none').map((standing) => {
    const length = (counts.get(standing)! / Math.max(1, slots.length)) * circumference;
    const arc = { standing, length, offset };
    offset += length;
    return arc;
  });
  const reached = counts.get('there')! + counts.get('been')!;

  return (
    <Scene hint={lt('champions.hint')} name="view-champions" onClose={onClose} quiet={Boolean(back)} title={lt('champions.title')}>
      {({ scale }) => (
        <div className="lch-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="lch-head">
            <svg aria-hidden="true" className="lch-ring" height={(RING_R + RING_W) * 2} viewBox={`${-RING_R - RING_W} ${-RING_R - RING_W} ${(RING_R + RING_W) * 2} ${(RING_R + RING_W) * 2}`} width={(RING_R + RING_W) * 2}>
              <circle className="lch-ring-track" r={RING_R} />
              {arcs.map((arc, i) => (
                <circle
                  className={`lch-ring-arc st-${arc.standing}`}
                  key={arc.standing}
                  r={RING_R}
                  style={{ '--len': arc.length, '--off': -arc.offset, '--c': circumference, '--i': i } as CSSProperties}
                />
              ))}
            </svg>
            <div className="lch-ring-text">
              <b>{reached}<small>/{slots.length}</small></b>
              <span>{lt('champions.reached')}</span>
            </div>
            <div className="lch-season">
              <div className="lch-season-top">
                <h2>{ROSTER.season}</h2>
                <ScopeSwitch onChange={setScope} scope={scope} />
              </div>
              <span>{lt('champions.updated', { date: ROSTER.updated })}</span>
              <div className="lch-chips">
                {STANDINGS.map((standing) => (
                  <button
                    aria-pressed={only === standing}
                    className={classNames('lch-chip', `st-${standing}`, { on: only === standing })}
                    key={standing}
                    onClick={() => setOnly(only === standing ? null : standing)}
                    type="button"
                  >
                    <i />
                    {lt(STANDING_KEYS[standing])}
                    <b>{counts.get(standing)}</b>
                  </button>
                ))}
              </div>
            </div>
          </header>

          {cards}

          {hot && (
            <ViewTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{displayName(hot.slot.pokemon.name, hot.slot.pokemon.name_ja, locale)}</strong>
              <small className={`lch-tip-standing st-${hot.slot.standing}`}><i />{lt(STANDING_KEYS[hot.slot.standing])}</small>
              {hot.slot.copies.length > 0
                ? (
                  <ul className="lch-tip-copies">
                    {hot.slot.copies.map(({ dex, capture }) => (
                      <li key={`${dex.id}-${capture.pokemon.id}`}>
                        <span>{dex.title}{showsShiny(capture, dex) ? ' ✦' : ''}</span>
                        <em>{placeName(capture)}{capture.been_to_champions && capture.location !== 'champions' ? ` · ${lt('champions.beenShort')}` : ''}</em>
                      </li>
                    ))}
                  </ul>
                )
                : <em>{lt('champions.noCopies')}</em>}
              {inOpenDex(hot.slot) && <em>{lt('champions.press')}</em>}
            </ViewTip>
          )}
        </div>
      )}
    </Scene>
  );
}
