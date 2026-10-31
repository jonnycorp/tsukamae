import { BALLS, LANGUAGES, ORIGIN_GAMES } from './capture-fields';
import { BOX_SIZE } from './pokemon';
import { DEFAULT_CATALOG_KEY, FREE_ID_BASE, freshEntry, getCatalogDex, newId } from './local-data';
import { speciesKey } from './copies';

import type { AppState, FreeBox, FreeEntry, PersonalDex } from './local-data';

// what changes a free-form dex's boxes, each a change to the app's state that the dex context saves whole. A dex
// is replaced rather than changed in place, so what reads it (the tracker, the boxes) sees a new one.
//
// Two kinds of lock keep a layout from being undone by accident, each opened and closed like a phone's home screen: the
// boxes' order (the dex's boxesOpen), and each box's mons (its open). A locked box takes no drag in or out and no sort,
// and nothing placed for you (a mon added from the toolbar, records moved in) lands in it; a mon added to one of its
// empty slots by hand still can. Locked is the default; a box made new starts open, with nothing in it to keep

export type FreeSort = 'number' | 'generation' | 'type' | 'origin' | 'language' | 'ot' | 'ball' | 'date';

// within each open box on its own, or across all of them together in their order
export type SortReach = 'each' | 'together';

// what a grip carries as it's dragged (Pokemon.tsx, FreeBoxes.tsx): a mon's entry's id, or a box's id
export const ENTRY_DRAG = 'application/x-tsukamae-entry';
export const BOX_DRAG = 'application/x-tsukamae-box';

type Slot = Pick<FreeEntry, 'box' | 'slot'>;

function withDex (state: AppState, dexId: string, change: (dex: PersonalDex) => Partial<PersonalDex>) {
  state.dexes = state.dexes.map((dex) => (dex.id === dexId ? { ...dex, ...change(dex) } : dex));
}

// past every catalog's ids and every entry before it, a record key of its own
function nextId (dex: PersonalDex): number {
  const used = [...(dex.entries ?? []).map((entry) => entry.id), ...Object.keys(dex.progress).map(Number)];
  return Math.max(FREE_ID_BASE - 1, ...used.filter(Number.isFinite)) + 1;
}

// a new box's name, as HOME names its boxes when they're made ("Box 3"), kept as it moves: in the app's language, which
// the boxes' view and the new-dex dialog set
let boxName = (n: number) => `Box ${n}`;

export function nameNewBoxes (namer: (n: number) => string) {
  boxName = namer;
}

// the `n`th box, as it's made: named, and open
export const newBox = (n: number): FreeBox => ({ id: newId('box'), name: boxName(n), open: true });

const isOpen = (dex: PersonalDex, boxId: string) => Boolean((dex.boxes ?? []).find((box) => box.id === boxId)?.open);

// `count` empty slots in order from a box on (null: new boxes at the end), its own first and then the open ones after
// it, with new boxes at the end for what doesn't fit; a locked box is passed over
function openSlots (dex: PersonalDex, count: number, from: string | null): { boxes: FreeBox[]; slots: Slot[] } {
  const boxes = [...(dex.boxes ?? [])];
  const taken = new Set((dex.entries ?? []).map((entry) => `${entry.box}:${entry.slot}`));
  const slots: Slot[] = [];
  const at = boxes.findIndex((box) => box.id === from);
  for (let i = at === -1 ? boxes.length : at; slots.length < count; i++) {
    if (i >= boxes.length) {
      boxes.push(newBox(boxes.length + 1));
    }
    if (!boxes[i].open) {
      continue;
    }
    for (let slot = 0; slot < BOX_SIZE && slots.length < count; slot++) {
      if (!taken.has(`${boxes[i].id}:${slot}`)) {
        slots.push({ box: boxes[i].id, slot });
      }
    }
  }
  return { boxes, slots };
}

// a new mon: at the empty slot given (any box's, as it's put there by hand), or else in the first empty slot of an open
// box from that box on; its record starts as a mark does, with the dex's defaults. Its entry's id, for its popover
export function addEntry (state: AppState, dexId: string, species: number, at: { box: string; slot: number | null }): number {
  let id = 0;
  withDex(state, dexId, (dex) => {
    id = nextId(dex);
    const empty = at.slot !== null && !(dex.entries ?? []).some((entry) => entry.box === at.box && entry.slot === at.slot);
    const { boxes, slots } = empty ? { boxes: dex.boxes ?? [], slots: [{ box: at.box, slot: at.slot! }] } : openSlots(dex, 1, at.box);
    dex.progress[id] = freshEntry(dex, state.saves ?? [], species);
    return { boxes, entries: [...(dex.entries ?? []), { id, species, ...slots[0] }] };
  });
  return id;
}

// a mon dropped on a slot: there, the one there (if any) going to where it came from; dropped on a box's name, the first
// empty slot in it, if it has one. Only between open boxes
export function placeEntry (state: AppState, dexId: string, entryId: number, to: { box: string; slot: number | null }) {
  withDex(state, dexId, (dex) => {
    const entries = dex.entries ?? [];
    const moving = entries.find((entry) => entry.id === entryId);
    if (!moving || !isOpen(dex, moving.box) || !isOpen(dex, to.box)) {
      return {};
    }
    let target = to.slot;
    if (target === null) {
      const taken = new Set(entries.filter((entry) => entry.box === to.box).map((entry) => entry.slot));
      target = Array.from({ length: BOX_SIZE }, (_, slot) => slot).find((slot) => !taken.has(slot)) ?? null;
    }
    if (target === null || (moving.box === to.box && moving.slot === target)) {
      return {};
    }
    const there = entries.find((entry) => entry.box === to.box && entry.slot === target);
    return {
      entries: entries.map((entry) => {
        if (entry === moving) {
          return { ...entry, box: to.box, slot: target! };
        }
        return entry === there ? { ...entry, box: moving.box, slot: moving.slot } : entry;
      }),
    };
  });
}

// released: entries and records gone, a sealed one kept (it's unsealed by hand first, as anywhere)
export function removeEntries (state: AppState, dexId: string, ids: number[]) {
  withDex(state, dexId, (dex) => {
    const gone = new Set(ids.filter((id) => !dex.progress[id]?.sealed));
    gone.forEach((id) => delete dex.progress[id]);
    return { entries: (dex.entries ?? []).filter((entry) => !gone.has(entry.id)) };
  });
}

// a new box at the end, open
export function addBox (state: AppState, dexId: string) {
  withDex(state, dexId, (dex) => ({ boxes: [...(dex.boxes ?? []), newBox((dex.boxes ?? []).length + 1)] }));
}

// an empty name shows as its place ("Box 3")
export function renameBox (state: AppState, dexId: string, boxId: string, name: string) {
  withDex(state, dexId, (dex) => ({ boxes: (dex.boxes ?? []).map((box) => (box.id === boxId ? { ...box, name: name.trim() } : box)) }));
}

// the boxes' order opened to arrange, or locked again
export function setBoxesOpen (state: AppState, dexId: string, open: boolean) {
  withDex(state, dexId, () => ({ boxesOpen: open }));
}

// a box's mons opened to arrange and sort, or locked again
export function setBoxOpen (state: AppState, dexId: string, boxId: string, open: boolean) {
  withDex(state, dexId, (dex) => ({ boxes: (dex.boxes ?? []).map((box) => (box.id === boxId ? { ...box, open } : box)) }));
}

// only while the boxes' order is open, only an empty box, and never the last one
export function deleteBox (state: AppState, dexId: string, boxId: string) {
  withDex(state, dexId, (dex) => {
    const boxes = dex.boxes ?? [];
    if (!dex.boxesOpen || boxes.length < 2 || (dex.entries ?? []).some((entry) => entry.box === boxId)) {
      return {};
    }
    return { boxes: boxes.filter((box) => box.id !== boxId) };
  });
}

// a box dragged to where another stands, taking its place in the order; only while the boxes' order is open
export function placeBox (state: AppState, dexId: string, boxId: string, ontoId: string) {
  withDex(state, dexId, (dex) => {
    const boxes = [...(dex.boxes ?? [])];
    const from = boxes.findIndex((box) => box.id === boxId);
    const to = boxes.findIndex((box) => box.id === ontoId);
    if (!dex.boxesOpen || from === -1 || to === -1 || from === to) {
      return {};
    }
    boxes.splice(to, 0, ...boxes.splice(from, 1));
    return { boxes };
  });
}

// the open boxes' mons in an order: by number as HOME's national dex runs (its forms in their places), generation or
// first type (as the filters list them), origin game (newest first), language, OT, ball or catch date, each then by
// number; within each open box from its first slot, or across all of them together in their order. Locked boxes stand
// as they are
export function sortEntries (state: AppState, dexId: string, by: FreeSort, reach: SortReach) {
  const catalog = getCatalogDex(DEFAULT_CATALOG_KEY).pokemonList;
  const species = new Map(catalog.map((mon, i) => [mon.id, { mon, place: i }]));
  const ranks = (ids: string[]) => new Map(ids.map((id, i) => [id, i]));
  const origins = ranks(ORIGIN_GAMES.map((game) => game.id));
  const languages = ranks(LANGUAGES.map((language) => language.id));
  const balls = ranks(BALLS.map((ball) => ball.id));
  const types = ranks(['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);
  const collator = new Intl.Collator('ja-JP');
  withDex(state, dexId, (dex) => {
    const record = (entry: FreeEntry) => dex.progress[entry.id];
    const last = (value: number | undefined) => value ?? Number.MAX_SAFE_INTEGER;
    const text = (a: string | null | undefined, b: string | null | undefined) => (a && b ? collator.compare(a, b) : Number(!a) - Number(!b));
    const mon = (entry: FreeEntry) => species.get(entry.species)?.mon;
    const key: Record<FreeSort, (a: FreeEntry, b: FreeEntry) => number> = {
      number: () => 0,
      generation: (a, b) => last(mon(a)?.generation) - last(mon(b)?.generation),
      type: (a, b) => last(types.get(mon(a)?.types?.[0] ?? '')) - last(types.get(mon(b)?.types?.[0] ?? '')),
      origin: (a, b) => last(origins.get(record(a)?.origin_game ?? '')) - last(origins.get(record(b)?.origin_game ?? '')),
      language: (a, b) => last(languages.get(record(a)?.language ?? '')) - last(languages.get(record(b)?.language ?? '')),
      ot: (a, b) => text(record(a)?.ot, record(b)?.ot),
      ball: (a, b) => last(balls.get(record(a)?.ball ?? '')) - last(balls.get(record(b)?.ball ?? '')),
      date: (a, b) => text(record(a)?.catch_date, record(b)?.catch_date),
    };
    const order = (a: FreeEntry, b: FreeEntry) => key[by](a, b) || last(species.get(a.species)?.place) - last(species.get(b.species)?.place) || a.id - b.id;
    const open = (dex.boxes ?? []).filter((box) => box.open);
    const laid = new Map<number, Slot>();
    const lay = (boxes: FreeBox[]) => {
      const ids = new Set(boxes.map((box) => box.id));
      [...(dex.entries ?? [])].filter((entry) => ids.has(entry.box)).sort(order).forEach((entry, i) => {
        laid.set(entry.id, { box: boxes[Math.floor(i / BOX_SIZE)].id, slot: i % BOX_SIZE });
      });
    };
    if (reach === 'together') {
      lay(open);
    } else {
      open.forEach((box) => lay([box]));
    }
    return { entries: (dex.entries ?? []).map((entry) => ({ ...entry, ...laid.get(entry.id) })) };
  });
}

// records taken out of a dex (the main one) into a free-form dex, sealed ones as they are: each its own entry there in
// the first empty slots of open boxes from the one picked (null: new boxes at the end), its slot here left unmarked.
// Those its species can't be found for in HOME's catalog stay. The ids moved
export function moveToFree (state: AppState, fromId: string, ids: number[], toId: string, into: string | null): number[] {
  const from = state.dexes.find((dex) => dex.id === fromId);
  const to = state.dexes.find((dex) => dex.id === toId);
  if (!from || !to?.free || from.free || from.checklist) {
    return [];
  }
  const national = new Map(getCatalogDex(DEFAULT_CATALOG_KEY).pokemonList.map((mon) => [speciesKey(mon), mon.id]));
  const listed = new Map(getCatalogDex(from.catalogKey).pokemonList.map((mon) => [mon.id, mon]));
  const moving = ids
  .map((id) => ({ id, record: from.progress[id], species: listed.has(id) ? national.get(speciesKey(listed.get(id)!)) : undefined }))
  .filter(({ record, species }) => record && record.status !== 'unobtainable' && species !== undefined);
  if (moving.length === 0) {
    return [];
  }
  withDex(state, toId, (dex) => {
    const { boxes, slots } = openSlots(dex, moving.length, into);
    const first = nextId(dex);
    const added = moving.map(({ record, species }, i) => {
      dex.progress[first + i] = { ...record };
      return { id: first + i, species: species!, ...slots[i] };
    });
    return { boxes, entries: [...(dex.entries ?? []), ...added] };
  });
  withDex(state, fromId, (dex) => {
    moving.forEach(({ id }) => delete dex.progress[id]);
    return {};
  });
  return moving.map(({ id }) => id);
}
