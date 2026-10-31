import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faLock, faLockOpen, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';

import { BOX_COLUMNS, BOX_SIZE, TILE_SIZE } from '../../../utils/pokemon';
import { BOX_DRAG, ENTRY_DRAG, addBox, addEntry, deleteBox, nameNewBoxes, placeBox, placeEntry, renameBox, setBoxOpen, setBoxesOpen, sortEntries } from '../../../utils/free-dex';
import { Dropdown } from '../../library/Dropdown';
import { EMPTY_METADATA } from '../../../utils/capture-fields';
import { FlipStrips } from './FlipStrips';
import { Pokemon } from './Pokemon';
import { SpeciesPicker } from './SpeciesPicker';
import { shineClip, useTrackerActions } from './use-tracker';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from 'react';
import type { FreeSort, SortReach } from '../../../utils/free-dex';
import type { FreeBox } from '../../../utils/local-data';
import type { TranslationKey } from '../../../i18n/translations';

const SORTS: FreeSort[] = ['number', 'generation', 'type', 'origin', 'language', 'ot', 'ball', 'date'];
const REACHES: SortReach[] = ['each', 'together'];

interface Props {
  captures: Capture[];
  columns: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

// a slot in a box, or (null) the first empty one in it
interface Slot {
  box: string;
  slot: number | null;
}

// an empty slot, for the shine and the flips, which place a sealed mon by its index in its box
const hole = (slot: number): Capture => ({
  ...EMPTY_METADATA,
  pokemon: { id: -1 - slot, national_id: 0, name: '', name_ja: null, form: null, box: null, dex_number: 0, generation: 0 },
  captured: false,
  status: null,
  sealed: false,
});

// a free-form dex's boxes: yours to make, name and order, each of 30 slots holding any mon you add where you put
// it, as you'd lay out a box in HOME (to copy there, or from it). Laid out, they lock, as a phone's home screen does,
// in two ways apart (utils/free-dex): the boxes' order, opened with Arrange Boxes to drag a box by its grip to another's
// place (and delete an empty one) till Done; and each box's mons, opened with its padlock to drag a mon by its grip to
// another slot (a mon there trades places) or onto an open box's name, and to sort. An open box's frame marches; a
// locked one takes no drag and no sort. An empty slot pressed adds a mon there, open or locked
export function FreeBoxes ({ captures, columns, setSelectedPokemon }: Props) {
  const { activeDex, editDexes } = useDexContext();
  const { narrow } = useTrackerActions();
  const { t } = useTranslation();
  const dex = activeDex!;
  const boxes = useMemo(() => dex.boxes ?? [], [dex.boxes]);
  const arranging = Boolean(dex.boxesOpen);
  const openBoxes = boxes.filter((box) => box.open);
  const [picking, setPicking] = useState<{ to: Slot; at: { x: number; y: number } } | null>(null);
  // where a dragged mon would land (a slot, or a box's name: slot null), or the box a dragged box would take the place of
  const [over, setOver] = useState<Slot | null>(null);
  const [boxOver, setBoxOver] = useState<string | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [sort, setSort] = useState<FreeSort>('number');
  const [reach, setReach] = useState<SortReach>('each');

  // each box's slots, its mons where their entries put them
  const grids = useMemo(() => {
    const byId = new Map(captures.map((capture) => [capture.pokemon.id, capture]));
    return boxes.map((box) => {
      const slots: (Capture | null)[] = Array.from({ length: BOX_SIZE }, () => null);
      for (const entry of dex.entries ?? []) {
        if (entry.box === box.id && entry.slot < BOX_SIZE) {
          slots[entry.slot] = byId.get(entry.id) ?? null;
        }
      }
      return slots;
    });
  }, [boxes, dex.entries, captures]);
  const padded = useMemo(() => grids.map((slots) => slots.map((capture, slot) => capture ?? hole(slot))), [grids]);
  const rows = useMemo(() => {
    const all: Capture[][][] = [];
    for (let i = 0; i < padded.length; i += columns) {
      all.push(padded.slice(i, i + columns));
    }
    return all;
  }, [padded, columns]);

  // a box made new is named as HOME names one, in the app's language; one left unnamed reads as its place
  nameNewBoxes((n) => t('free.box', { n }));
  const boxName = (box: FreeBox, i: number) => box.name || t('free.box', { n: i + 1 });

  // the new mon's popover opens once its tile is there
  const add = (species: number, to: Slot) => {
    let id = 0;
    editDexes((state) => {
      id = addEntry(state, dex.id, species, to);
    });
    setPicking(null);
    requestAnimationFrame(() => requestAnimationFrame(() => setSelectedPokemon(id)));
  };
  const pickAt = (to: Slot) => (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPicking({ to, at: { x: rect.right, y: rect.top + rect.height / 2 } });
  };

  // a mon's drag carries its entry's id, and an open box's grid takes it on the slot it's over, read from what's there:
  // an empty slot's number, or the mon's own
  const slotAt = (box: string, e: DragEvent<HTMLElement>): number | null => {
    const at = (e.target as Element).closest<HTMLElement>('[data-slot], [data-pokemon-id]');
    if (at?.dataset.slot !== undefined) {
      return Number(at.dataset.slot);
    }
    const id = Number(at?.dataset.pokemonId);
    return (dex.entries ?? []).find((entry) => entry.id === id && entry.box === box)?.slot ?? null;
  };
  const dragOver = (box: FreeBox, onName: boolean) => (e: DragEvent<HTMLElement>) => {
    if (!box.open || !e.dataTransfer.types.includes(ENTRY_DRAG)) {
      return;
    }
    const slot = onName ? null : slotAt(box.id, e);
    if (onName || slot !== null) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (over?.box !== box.id || over.slot !== slot) {
        setOver({ box: box.id, slot });
      }
    }
  };
  const drop = (box: FreeBox, onName: boolean) => (e: DragEvent<HTMLElement>) => {
    const id = Number(e.dataTransfer.getData(ENTRY_DRAG));
    const slot = onName ? null : slotAt(box.id, e);
    setOver(null);
    if (box.open && id && (onName || slot !== null)) {
      e.preventDefault();
      editDexes((state) => placeEntry(state, dex.id, id, { box: box.id, slot }));
    }
  };

  // a box's drag carries its id, and any other box takes it, the dragged one taking its place in the order
  const boxDragOver = (box: FreeBox) => (e: DragEvent<HTMLElement>) => {
    if (arranging && e.dataTransfer.types.includes(BOX_DRAG)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (boxOver !== box.id) {
        setBoxOver(box.id);
      }
    }
  };
  const boxDrop = (box: FreeBox) => (e: DragEvent<HTMLElement>) => {
    const id = e.dataTransfer.getData(BOX_DRAG);
    setBoxOver(null);
    if (arranging && id) {
      e.preventDefault();
      editDexes((state) => placeBox(state, dex.id, id, box.id));
    }
  };

  const sortOpen = () => {
    const key = t(`free.sort.${sort}` as TranslationKey);
    if (openBoxes.length > 0 && window.confirm(t('free.sortConfirm', { boxes: openBoxes.length, key }))) {
      editDexes((state) => sortEntries(state, dex.id, sort, reach));
    }
  };

  return (
    <>
      <div className="free-bar">
        <button className="free-button" onClick={pickAt({ box: openBoxes[0]?.id ?? '', slot: null })} type="button">
          <FontAwesomeIcon icon={faPlus} />{t('free.addMon')}
        </button>
        <button className="free-button" onClick={() => editDexes((state) => addBox(state, dex.id))} type="button">
          <FontAwesomeIcon icon={faPlus} />{t('free.addBox')}
        </button>
        <button
          aria-pressed={arranging}
          className={classNames('free-button', 'free-arrange', { on: arranging })}
          onClick={() => editDexes((state) => setBoxesOpen(state, dex.id, !arranging))}
          type="button"
        >
          <FontAwesomeIcon icon={arranging ? faLockOpen : faLock} />{t(arranging ? 'free.arrangeDone' : 'free.arrange')}
        </button>
        <span className={classNames('free-sort', { idle: openBoxes.length === 0 })}>
          <span className="free-sort-label">{t('free.sortBy')}</span>
          <Dropdown
            id="free-sort"
            onSelect={(next) => setSort(next as FreeSort)}
            options={SORTS.map((value) => ({ value, label: t(`free.sort.${value}` as TranslationKey) }))}
            value={sort}
          />
          <span aria-label={t('free.sortBy')} className="free-reach" role="group">
            {REACHES.map((value) => (
              <button aria-pressed={reach === value} className={classNames({ on: reach === value })} key={value} onClick={() => setReach(value)} type="button">
                {t(value === 'each' ? 'free.sortEach' : 'free.sortTogether')}
              </button>
            ))}
          </span>
          <button className="free-button" disabled={openBoxes.length === 0} onClick={sortOpen} type="button">{t('free.sortApply')}</button>
        </span>
      </div>
      <div className={classNames('box-grid', 'free-grid', { arranging })} onDragEnd={() => {
        setOver(null);
        setBoxOver(null);
      }}>
        {boxes.map((box, i) => {
          const slots = grids[i];
          const filled = slots.filter(Boolean).length;
          const sealed = slots.filter((capture) => capture?.sealed).length;
          const clip = narrow ? null : shineClip(padded[i], false);
          const lit = over?.box === box.id ? over.slot : undefined;
          return (
            <div
              className={classNames('box', 'free-box', { open: box.open, 'box-over': boxOver === box.id })}
              key={box.id}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setBoxOver(null)}
              onDragOver={boxDragOver(box)}
              onDrop={boxDrop(box)}
            >
              <div
                className={classNames('box-header', 'free-box-header', { over: lit === null })}
                onDragOver={dragOver(box, true)}
                onDrop={drop(box, true)}
              >
                {arranging &&
                  <span
                    className="free-box-grip"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(BOX_DRAG, box.id);
                      e.dataTransfer.effectAllowed = 'move';
                      const frame = e.currentTarget.closest('.free-box');
                      if (frame) {
                        e.dataTransfer.setDragImage(frame, 40, 20);
                      }
                    }}
                    title={t('free.dragBox')}
                  >
                    <FontAwesomeIcon icon={faGripVertical} />
                  </span>
                }
                {naming === box.id
                  ? (
                    <input
                      aria-label={t('free.rename')}
                      autoFocus
                      className="free-box-name-input"
                      defaultValue={box.name}
                      maxLength={16}
                      onBlur={(e) => {
                        const name = e.currentTarget.value;
                        editDexes((state) => renameBox(state, dex.id, box.id, name));
                        setNaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          e.stopPropagation();
                          setNaming(null);
                        }
                      }}
                      placeholder={t('free.box', { n: i + 1 })}
                    />
                  )
                  : <h1>{boxName(box, i)}</h1>
                }
                <span className="free-box-end">
                  <span className="box-sealed-count">{t('box.sealedCount', { sealed, total: filled })}</span>
                  <span className="free-box-tools">
                    <button
                      aria-label={t(box.open ? 'free.boxOpen' : 'free.boxLocked')}
                      aria-pressed={Boolean(box.open)}
                      className={classNames('free-box-lock', { on: box.open })}
                      onClick={() => editDexes((state) => setBoxOpen(state, dex.id, box.id, !box.open))}
                      title={t(box.open ? 'free.boxOpen' : 'free.boxLocked')}
                      type="button"
                    >
                      <FontAwesomeIcon icon={box.open ? faLockOpen : faLock} />
                    </button>
                    <button aria-label={t('free.rename')} onClick={() => setNaming(box.id)} title={t('free.rename')} type="button">
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    {arranging &&
                      <button aria-label={t('free.deleteBox')} disabled={filled > 0 || boxes.length < 2} onClick={() => editDexes((state) => deleteBox(state, dex.id, box.id))} title={t('free.deleteBox')} type="button">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    }
                  </span>
                </span>
              </div>
              <div className="box-container">
                <div className="tile-grid" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)} onDragOver={dragOver(box, false)} onDrop={drop(box, false)}>
                  {slots.map((capture, slot) => (capture
                    ? <Pokemon arrange={box.open} capture={capture} key={capture.pokemon.id} setSelectedPokemon={setSelectedPokemon} />
                    // the narrow list shows its mons alone
                    : !narrow && (
                      <button
                        aria-label={t('free.addHere')}
                        className="pokemon empty free-empty"
                        data-slot={slot}
                        key={`empty-${slot}`}
                        onClick={pickAt({ box: box.id, slot })}
                        title={t('free.addHere')}
                        type="button"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    )))}
                </div>
                {lit !== undefined && lit !== null &&
                  <span
                    aria-hidden="true"
                    className="free-over"
                    style={{ left: 1 + (lit % BOX_COLUMNS) * TILE_SIZE, top: 1 + Math.floor(lit / BOX_COLUMNS) * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
                  />
                }
                {clip &&
                  <div className="box-shine" style={{ clipPath: clip }}>
                    <div className="box-shine-band" />
                  </div>
                }
              </div>
            </div>
          );
        })}
        {!narrow && rows.map((row, r) => <FlipStrips grids={row} key={r} row={r} />)}
      </div>
      {picking && <SpeciesPicker at={picking.at} onClose={() => setPicking(null)} onPick={(species) => add(species, picking.to)} />}
    </>
  );
}
