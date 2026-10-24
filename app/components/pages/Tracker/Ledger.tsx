import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDownWideShort, faArrowUpShortWide, faCheck, faChevronDown, faCircleExclamation, faHeart, faLock, faMinus } from '@fortawesome/free-solid-svg-icons';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES, LANGUAGE_ABBRS, ORIGIN_GAME_NAMES, unansweredFields } from '../../../utils/capture-fields';
import { BatchBar } from './BatchBar';
import { Dropdown } from '../../library/Dropdown';
import { NoResults } from './SearchResults';
import { OriginMark } from './seal-faces';
import { PokemonName, displayName } from '../../library/PokemonName';
import { boxTitle } from './Box';
import { defaultStatus } from '../../../utils/local-data';
import { dexNumber, groupBoxes, iconClass } from '../../../utils/pokemon';
import { filterMatcher, queryMatcher } from './filters';
import { groupCaptures, sortCaptures, stateOf } from './ledger-model';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { MENU_OR_MODAL } from '../../../hooks/use-hotkey';
import { locationTint, placeLabel, shownPlace } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useMark } from './use-mark';
import { useTrackerActions } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react';
import type { Capture, Dex, GameSave } from '../../../types';
import type { LedgerColumnId, LedgerContext, LedgerGroup, LedgerGroupId, LedgerSort, LedgerState } from './ledger-model';
import type { Locale, TranslationKey } from '../../../i18n/translations';
import type { TrackerFilters } from './filters';

interface Column {
  id: LedgerColumnId;
  labelKey: TranslationKey;
  // its share of the row (a grid track), and a narrower one where only the first priority shows
  width: string;
  tight?: string;
  // 1 always shows; 2 drops out of a narrow ledger, 3 out of a middling one (styles/ledger.scss)
  priority: 1 | 2 | 3;
  // a field of the record, which a checklist keeps none of and an unmarked or unobtainable slot has blank
  record?: boolean;
}

// the least widths hold the longest of each column in either language (a 12-letter OT, ジェイジェイ, チャンピオンズ内); they
// add up under the widths styles/ledger.scss drops a priority at
const COLUMNS: Column[] = [
  { id: 'number', labelKey: 'ledger.number', width: '60px', tight: '56px', priority: 1 },
  { id: 'name', labelKey: 'ledger.name', width: 'minmax(160px, 1.5fr)', tight: 'minmax(130px, 1.4fr)', priority: 1 },
  { id: 'types', labelKey: 'filter.type', width: '60px', priority: 2 },
  { id: 'status', labelKey: 'info.status', width: 'minmax(140px, .9fr)', tight: 'minmax(120px, 1fr)', priority: 1 },
  { id: 'location', labelKey: 'info.location', width: 'minmax(124px, 1.2fr)', priority: 3, record: true },
  { id: 'origin', labelKey: 'info.originGame', width: 'minmax(140px, 1.2fr)', tight: 'minmax(130px, 1.2fr)', priority: 1, record: true },
  { id: 'ball', labelKey: 'info.ball', width: '64px', priority: 2, record: true },
  { id: 'language', labelKey: 'info.language', width: '96px', priority: 3, record: true },
  { id: 'ot', labelKey: 'info.ot', width: 'minmax(110px, .8fr)', priority: 2, record: true },
  { id: 'nickname', labelKey: 'info.nickname', width: 'minmax(110px, .8fr)', priority: 3, record: true },
  { id: 'date', labelKey: 'info.catchDate', width: '120px', tight: '104px', priority: 1, record: true },
  { id: 'level', labelKey: 'info.level', width: '72px', priority: 3, record: true },
];

// the rows mount a screenful at once and the rest a frame's worth at a time, so switching to the ledger (or showing
// other rows in it) never holds the page for one long render
const FIRST_ROWS = 60;
const ROWS_PER_FRAME = 240;

// how many rows may be mounted: back to a screenful whenever `reset` changes, then up a frame at a time
function useRowBudget (total: number, reset: string): number {
  const [budget, setBudget] = useState({ reset, n: FIRST_ROWS });
  if (budget.reset !== reset) {
    setBudget({ reset, n: FIRST_ROWS });
  }
  const n = budget.reset === reset ? budget.n : FIRST_ROWS;
  useEffect(() => {
    if (n >= total) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => setBudget((prev) => ({ ...prev, n: prev.n + ROWS_PER_FRAME })));
    return () => cancelAnimationFrame(frame);
  }, [n, total]);
  return n;
}

const GROUP_OPTIONS: { id: LedgerGroupId; labelKey: TranslationKey; record?: boolean }[] = [
  { id: 'none', labelKey: 'ledger.group.none' },
  { id: 'box', labelKey: 'ledger.group.box' },
  { id: 'generation', labelKey: 'filter.generation' },
  { id: 'type', labelKey: 'filter.type' },
  { id: 'status', labelKey: 'info.status' },
  { id: 'origin', labelKey: 'info.originGame', record: true },
  { id: 'ball', labelKey: 'info.ball', record: true },
  { id: 'nature', labelKey: 'info.nature', record: true },
  { id: 'location', labelKey: 'info.location', record: true },
  { id: 'language', labelKey: 'info.language', record: true },
  { id: 'ot', labelKey: 'info.ot', record: true },
  { id: 'year', labelKey: 'ledger.group.year', record: true },
];

// what every row draws with; it changes with the dex, the language or your games, never with an edit
interface RowContext {
  dex: Dex;
  saves: GameSave[];
  locale: Locale;
  checklist: boolean;
  homeDex: boolean;
  columns: Column[];
  t: ReturnType<typeof useTranslation>['t'];
}

const STATE_KEYS: Record<LedgerState, TranslationKey> = {
  sealed: 'seal.sealed',
  caught: 'status.caught',
  temporary: 'status.temporary',
  unobtainable: 'status.unobtainable',
  unmarked: 'ledger.unmarked',
};

const blank = <span className="ledger-blank">—</span>;

function ballCell (ball: string, ctx: RowContext) {
  const name = localizeBall(ctx.locale, ball, BALL_NAMES.get(ball) ?? ball);
  return ball === 'unknown' ? <span className="ball-unknown" title={name}>?</span> : <img alt={name} src={`/balls/${ball}.png`} title={name} />;
}

const CELLS: Record<LedgerColumnId, (capture: Capture, ctx: RowContext, state: LedgerState) => ReactNode> = {
  number: (capture, ctx) => dexNumber(capture.pokemon, ctx.dex),
  name: (capture, ctx) => (
    <>
      <span className="ledger-icon"><i className={iconClass(capture.pokemon, ctx.dex)} /></span>
      <span className="ledger-name"><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></span>
      {(capture.favorite === 'favorite' || capture.favorite === 'partner') &&
        <FontAwesomeIcon className={`ledger-favorite ${capture.favorite}`} icon={faHeart} title={ctx.t(`favorite.${capture.favorite}`)} />
      }
    </>
  ),
  types: (capture, ctx) => capture.pokemon.types?.map((type) => (
    <span
      className="type-glyph"
      key={type}
      style={{ backgroundColor: `var(--type-${type})`, maskImage: `url(/types/${type}.svg)` }}
      title={ctx.t(`type.${type}`)}
    />
  )),
  status: (capture, ctx, state) => {
    const stale = state === 'sealed' ? unansweredFields(capture, capture.pokemon.gender_lock) : [];
    return (
      <>
        <span className="ledger-swatch" />
        {state === 'sealed' && <FontAwesomeIcon className="ledger-lock" icon={faLock} />}
        <span className="ledger-state">{ctx.t(STATE_KEYS[state])}</span>
        {stale.length > 0 &&
          <FontAwesomeIcon
            className="ledger-stale"
            icon={faCircleExclamation}
            title={ctx.t('seal.stale', { fields: stale.map((field) => ctx.t(field.labelKey)).join(ctx.t('common.listSeparator')) })}
          />
        }
      </>
    );
  },
  location: (capture, ctx) => {
    const place = shownPlace(capture);
    return place ? <span className="ledger-text">{placeLabel(place, ctx.saves, ctx.locale)}</span> : blank;
  },
  origin: (capture, ctx) => (capture.origin_game
    ? <><span className="ledger-mark"><OriginMark game={capture.origin_game} /></span><span className="ledger-text">{localizeOriginGame(ctx.locale, capture.origin_game, ORIGIN_GAME_NAMES.get(capture.origin_game) ?? capture.origin_game)}</span></>
    : blank),
  ball: (capture, ctx) => (capture.ball ? ballCell(capture.ball, ctx) : blank),
  language: (capture) => (capture.language ? LANGUAGE_ABBRS.get(capture.language) ?? capture.language : blank),
  ot: (capture) => (capture.ot ? <span className="ledger-text">{capture.ot}</span> : blank),
  nickname: (capture) => (capture.has_nickname && capture.nickname ? <span className="ledger-text">{capture.nickname}</span> : blank),
  date: (capture) => (capture.catch_date ? capture.catch_date.replaceAll('-', '/') : blank),
  level: (capture) => capture.level ?? blank,
};

interface RowProps {
  capture: Capture;
  ctx: RowContext;
  selected: boolean;
  onPick: (capture: Capture, e: MouseEvent) => void;
}

// one mon across the columns; an edit (or a change to whether it's selected) re-renders its own row only. Pressed, it
// does what its tile does: a marked mon's popover opens beside it, an unmarked one is marked. Its box (or Ctrl, or
// Shift for the run from the last one) selects it instead, or lets it go
const LedgerRow = memo(function LedgerRow ({ capture, ctx, selected, onPick }: RowProps) {
  const state = stateOf(capture, ctx.checklist);
  const recorded = capture.captured && capture.status !== 'unobtainable';
  // a sealed mon away from where its dex keeps them, tinted as its tile is (utils/location-moves)
  const tint = state === 'sealed' ? locationTint(capture.location, ctx.homeDex) : null;
  return (
    <div
      aria-selected={selected}
      className={classNames('ledger-row', `state-${state}`, tint && `loc-${tint}`, { sealed: state === 'sealed', checklist: ctx.checklist, selected })}
      data-copy-name={displayName(capture.pokemon.name, capture.pokemon.name_ja, ctx.locale)}
      data-pokemon-id={capture.pokemon.id}
      onClick={(e) => onPick(capture, e)}
      role="row"
    >
      <div className="ledger-cell col-select" role="cell">
        <span aria-checked={selected} className="ledger-check" role="checkbox">{selected && <FontAwesomeIcon icon={faCheck} />}</span>
      </div>
      {ctx.columns.map((column) => (
        <div className={`ledger-cell col-${column.id} p${column.priority}`} data-dock={column.id === 'status' || undefined} key={column.id} role="cell">
          {column.record && !recorded ? null : CELLS[column.id](capture, ctx, state)}
        </div>
      ))}
    </div>
  );
});

function GroupHead ({ group, open, onToggle }: { group: LedgerGroup; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  let caught = 0;
  let temporary = 0;
  let unobtainable = 0;
  let sealed = 0;
  for (const capture of group.captures) {
    if (capture.status === 'caught') {
      caught++;
    } else if (capture.status === 'temporary') {
      temporary++;
    } else if (capture.status === 'unobtainable') {
      unobtainable++;
    }
    if (capture.sealed) {
      sealed++;
    }
  }
  const total = group.captures.length;
  const share = (n: number) => `${(100 * n) / total}%`;
  return (
    <button aria-expanded={open} className="ledger-group-head" onClick={onToggle} type="button">
      <FontAwesomeIcon className="ledger-chevron" icon={faChevronDown} />
      {group.type && <span className="type-glyph" style={{ backgroundColor: `var(--type-${group.type})`, maskImage: `url(/types/${group.type}.svg)` }} />}
      {group.ball && (group.ball === 'unknown' ? <span className="ball-unknown">?</span> : <img alt="" className="ledger-group-ball" src={`/balls/${group.ball}.png`} />)}
      {group.origin && <span className="ledger-mark"><OriginMark game={group.origin} /></span>}
      <span className="ledger-group-label">{group.label}</span>
      <span className="ledger-group-count">{caught + temporary + unobtainable}<small>/{total}</small></span>
      {sealed > 0 && <span className="ledger-group-sealed"><FontAwesomeIcon icon={faLock} />{sealed}</span>}
      <span className="ledger-group-bar">
        <span className="seg-caught" style={{ width: share(caught) }} />
        <span className="seg-temporary" style={{ width: share(temporary) }} />
        <span className="seg-unobtainable" style={{ width: share(unobtainable) }} />
      </span>
      <span className="ledger-group-n">{t('filter.count', { count: total })}</span>
    </button>
  );
}

interface Props {
  captures: Capture[];
  filters: TrackerFilters;
  // rows the open popover has worked on, kept though they no longer match (useHeldTiles in Dex)
  held: number[];
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

// the dex as a table, in place of the boxes (V): the search, the view and the filters narrow it as they do the boxes;
// a column's head sorts by it (again for the other way, a third time back to the dex's order), and the rows can be
// grouped by any field, each group folding away under its head
export function Ledger ({ captures, filters, held, query, setFilters, setQuery, setSelectedPokemon }: Props) {
  const { activeDex, activeDexView, saves } = useDexContext();
  const { t, locale } = useTranslation();
  const mark = useMark();
  const dex = activeDexView!;
  const checklist = Boolean(activeDex!.checklist);
  const [sort, setSort] = useLocalStorage<LedgerSort | null>('ledgerSort', null);
  const [storedGroup, setGroup] = useLocalStorage<LedgerGroupId>('ledgerGroup', 'none');
  // a checklist keeps no records to group by
  const group = checklist && GROUP_OPTIONS.find((option) => option.id === storedGroup)?.record ? 'none' : storedGroup;
  const [collapsed, setCollapsed] = useState<{ group: LedgerGroupId; keys: Set<string> }>({ group, keys: new Set() });
  const closed = collapsed.group === group ? collapsed.keys : new Set<string>();

  const columns = useMemo(() => COLUMNS.filter((column) => !checklist || !column.record), [checklist]);
  const rowCtx = useMemo<RowContext>(
    () => ({ dex, saves, locale, checklist, homeDex: dex.game.id === 'home', columns, t }),
    [dex, saves, locale, checklist, columns, t],
  );

  // the order and the boxes don't change with an edit, but they're cheap to count again when the captures do
  const ctx = useMemo<LedgerContext>(() => {
    const boxes = groupBoxes(captures);
    const boxOf = new Map<number, number>();
    boxes.forEach((box, i) => box.forEach((capture) => boxOf.set(capture.pokemon.id, i)));
    return {
      locale,
      checklist,
      saves,
      order: new Map(captures.map((capture, i) => [capture.pokemon.id, i])),
      boxes: boxOf,
      boxTitle: (box) => boxTitle(boxes[box], dex, locale),
      name: (capture) => displayName(capture.pokemon.name, capture.pokemon.name_ja, locale),
      collator: new Intl.Collator(locale === 'ja' ? 'ja-JP' : 'en-US', { numeric: true, sensitivity: 'base' }),
    };
  }, [captures, locale, checklist, saves, dex]);

  // the rows picked for the batch bar; they stay shown, as the popover's tile does, until let go (Esc, or the bar's
  // close), so an edit that takes them out of the view (marking the Missing) can be followed by another
  const [selection, setSelection] = useState<Set<number>>(() => new Set());
  const anchorRef = useRef<number | null>(null);

  const rows = useMemo(() => {
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query, Boolean(dex.regional));
    return captures.filter((capture) => held.includes(capture.pokemon.id) || selection.has(capture.pokemon.id) || (matchesFilters(capture) && matchesQuery(capture)));
  }, [captures, filters, held, selection, query, dex.regional]);

  const groups = useMemo(() => groupCaptures(sortCaptures(rows, sort, ctx), group, ctx), [rows, sort, group, ctx]);
  // a new grouping or other rows shown start over from a screenful; an edit or a sort keeps every row mounted
  const budget = useRowBudget(rows.length, `${group}|${filters.view}|${JSON.stringify(filters.facets)}|${query}`);
  let mounted = 0;

  // the rows as they run down the table, folded groups left out: what Shift selects a run of, and Ctrl+A all of
  const order = useMemo(() => groups.flatMap((entry) => (closed.has(entry.key) ? [] : entry.captures.map((capture) => capture.pokemon.id))), [groups, closed]);
  const orderRef = useRef(order);
  useLayoutEffect(() => {
    orderRef.current = order;
  }, [order]);

  const handlePick = useCallback((capture: Capture, e: MouseEvent) => {
    const id = capture.pokemon.id;
    if (e.shiftKey || e.ctrlKey || e.metaKey || (e.target as Element).closest('.col-select')) {
      const from = e.shiftKey && anchorRef.current !== null ? orderRef.current.indexOf(anchorRef.current) : -1;
      const to = orderRef.current.indexOf(id);
      setSelection((prev) => {
        const next = new Set(prev);
        // the row pressed turns over, and a Shift run goes the same way with it
        const on = !prev.has(id);
        const run = from !== -1 && to !== -1 ? orderRef.current.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
        run.forEach((entry) => (on ? next.add(entry) : next.delete(entry)));
        return next;
      });
      anchorRef.current = id;
      return;
    }
    if (capture.captured) {
      if (!checklist) {
        setSelectedPokemon(capture.pokemon.id);
      }
      return;
    }
    mark(capture.pokemon.id, defaultStatus(activeDex!));
    if (!checklist) {
      setSelectedPokemon(capture.pokemon.id);
    }
  }, [activeDex, checklist, mark, setSelectedPokemon]);

  const cycleSort = (column: LedgerColumnId) => {
    if (sort?.column !== column) {
      setSort({ column, descending: false });
    } else if (!sort.descending) {
      setSort({ column, descending: true });
    } else {
      setSort(null);
    }
  };

  const toggleGroup = (key: string) => {
    const keys = new Set(closed);
    if (keys.has(key)) {
      keys.delete(key);
    } else {
      keys.add(key);
    }
    setCollapsed({ group, keys });
  };
  // a locate (the palette, the timeline, the almanac, a review closed on it) unfolds the group its mon is in
  const { revealHost } = useTrackerActions();
  useEffect(() => {
    revealHost.current = (pokemon) => {
      const entry = groups.find((candidate) => candidate.captures.some((capture) => capture.pokemon.id === pokemon));
      if (entry && closed.has(entry.key)) {
        const keys = new Set(closed);
        keys.delete(entry.key);
        setCollapsed({ group, keys });
      }
    };
    return () => {
      revealHost.current = null;
    };
  }, [revealHost, groups, closed, group]);
  const allClosed = groups.length > 0 && groups.every((entry) => closed.has(entry.key));
  const toggleAll = () => setCollapsed({ group, keys: allClosed ? new Set() : new Set(groups.map((entry) => entry.key)) });

  // Esc lets the selection go, Ctrl+A takes every row shown; quiet while typing, under a menu, a modal, the popover or
  // the Filters panel, whose own Esc closes it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector(`${MENU_OR_MODAL}, .pokemon-popover, .facet-panel`)) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      if (e.key === 'Escape') {
        setSelection((prev) => (prev.size > 0 ? new Set() : prev));
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelection(new Set(orderRef.current));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allSelected = order.length > 0 && order.every((id) => selection.has(id));
  // as Gmail's: with anything selected it lets the selection go, with nothing it takes every row shown
  const toggleAllShown = () => setSelection(selection.size > 0 ? new Set() : new Set(order));
  const targets = useMemo(() => captures.filter((capture) => selection.has(capture.pokemon.id)), [captures, selection]);

  const template = (priority: number) => ['40px', ...columns.filter((column) => column.priority <= priority).map((column) => (priority === 1 && column.tight) || column.width)].join(' ');
  const groupOptions = GROUP_OPTIONS.filter((option) => !checklist || !option.record).map((option) => ({ value: option.id, label: t(option.labelKey) }));

  return (
    <div
      className={classNames('ledger', { checklist, selecting: selection.size > 0 })}
      style={{ '--ledger-cols-1': template(1), '--ledger-cols-2': template(2), '--ledger-cols-3': template(3) } as CSSProperties}
    >
      <div className="ledger-toolbar">
        <span className="ledger-toolbar-label">{t('ledger.groupBy')}</span>
        <Dropdown id="ledger_group" onSelect={(value) => setGroup(value as LedgerGroupId)} options={groupOptions} triggerClassName="ledger-group-pick" value={group} />
        {group !== 'none' && groups.length > 1 &&
          <button className="ledger-tool" onClick={toggleAll} type="button">{t(allClosed ? 'ledger.expandAll' : 'ledger.collapseAll')}</button>
        }
        {sort &&
          <button className="ledger-tool ledger-unsort" onClick={() => setSort(null)} type="button">{t('ledger.dexOrder')}</button>
        }
      </div>
      {rows.length === 0
        ? <NoResults filters={filters} query={query} setFilters={setFilters} setQuery={setQuery} />
        : (
          <div className="ledger-table" role="table">
            <div className="ledger-head" role="row">
              <div className="ledger-cell col-select" role="columnheader">
                <button
                  aria-checked={allSelected ? 'true' : selection.size > 0 ? 'mixed' : 'false'}
                  aria-label={t(selection.size > 0 ? 'batch.clear' : 'batch.selectAll')}
                  className={classNames('ledger-check', { on: allSelected })}
                  onClick={toggleAllShown}
                  role="checkbox"
                  title={selection.size > 0 ? `${t('batch.clear')} (Esc)` : `${t('batch.selectAll')} (Ctrl+A)`}
                  type="button"
                >
                  {allSelected && <FontAwesomeIcon icon={faCheck} />}
                  {!allSelected && selection.size > 0 && <FontAwesomeIcon icon={faMinus} />}
                </button>
              </div>
              {columns.map((column) => {
                const sorted = sort?.column === column.id ? sort : null;
                const label = t(column.labelKey);
                return (
                  <button
                    aria-sort={sorted ? (sorted.descending ? 'descending' : 'ascending') : 'none'}
                    className={classNames('ledger-cell', `col-${column.id}`, `p${column.priority}`, { sorted })}
                    key={column.id}
                    onClick={() => cycleSort(column.id)}
                    role="columnheader"
                    title={t('ledger.sortBy', { column: label })}
                    type="button"
                  >
                    <span className="ledger-head-label">{label}</span>
                    {sorted && <FontAwesomeIcon icon={sorted.descending ? faArrowDownWideShort : faArrowUpShortWide} />}
                  </button>
                );
              })}
            </div>
            {groups.map((entry) => {
              const open = !closed.has(entry.key);
              const shown = open ? entry.captures.slice(0, Math.max(0, budget - mounted)) : [];
              mounted += shown.length;
              return (
                <div className="ledger-group" key={`${group}:${entry.key}`} role="rowgroup">
                  {group !== 'none' && <GroupHead group={entry} onToggle={() => toggleGroup(entry.key)} open={open} />}
                  {shown.map((capture) => (
                    <LedgerRow capture={capture} ctx={rowCtx} key={capture.pokemon.id} onPick={handlePick} selected={selection.has(capture.pokemon.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      {selection.size > 0 &&
        <BatchBar onClear={() => setSelection(new Set())} onSelectAll={() => setSelection(new Set(order))} shown={order.length} targets={targets} />
      }
    </div>
  );
}
