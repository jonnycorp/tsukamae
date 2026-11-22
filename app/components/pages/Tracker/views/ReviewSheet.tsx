import classNames from 'classnames';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CAPTURE_FIELDS, ORIGIN_GAME_NAMES, asksPlace, formatFieldValue, unansweredFields } from '../../../../utils/capture-fields';
import { CHECKS, CHECK_FIELDS, checkRecords } from './record-checks';
import { Hologram } from './GalaxyPanel';
import { Scene, SceneMon } from '../Scene';
import { asksField, givenValues, readTouches, untouched, writeTouches } from '../../../../utils/review-confirm';
import { displayName } from '../../../library/PokemonName';
import { localizeOriginGame } from '../../../../i18n/names';
import { translate } from '../../../../i18n/translations';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useKeys } from './views-kit';
import { useViewText } from './views-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';
import { useScopedRecords } from './ViewScope';

import type { CaptureField } from '../../../../utils/capture-fields';
import type { ViewKey } from './views-i18n';
import type { ViewProps } from './views-kit';
import type { ViewRecord } from './ViewScope';

// the sheet's columns: every field W asks but My Game (the four it fills are here one by one) and the place (asked as
// a sealed mon's, never in a batch still open)
const COLUMNS: CaptureField[] = CAPTURE_FIELDS.filter((field) => field.id !== 'save' && field.id !== 'location');

// a cell: still to fill (in W), given and still to confirm, done, or never asked of this mon
type CellState = 'missing' | 'given' | 'done' | 'na';

interface Row {
  record: ViewRecord;
  cells: { state: CellState; text: string; flags: string[] }[];
  // what's left on it: fields to fill and to confirm, the place as well
  left: number;
}

interface Batch {
  date: string;
  rows: Row[];
}

interface Cursor {
  row: string;
  column: number;
}

// a batch's table, apart from the panel; re-rendered as its own rows change, its cursor's row or a confirm
const BatchTable = memo(function BatchTable ({ batch, cursor, ditto, onCell, onOpen }: {
  batch: Batch;
  cursor: Cursor | null;
  ditto: boolean;
  onCell: (cursor: Cursor) => void;
  onOpen: (row: Row) => void;
}) {
  const { lt, locale } = useViewText();
  return (
    <tbody>
      {batch.rows.map((row, r) => {
        const above = batch.rows[r - 1];
        return (
          <tr className={classNames({ ready: row.left === 0, at: cursor?.row === row.record.key })} key={row.record.key}>
            <th onDoubleClick={() => onOpen(row)} scope="row" title={lt('sheet.open')}>
              <SceneMon pokemon={row.record.capture.pokemon} view={row.record.view} />
              <span>{displayName(row.record.capture.pokemon.name, row.record.capture.pokemon.name_ja, locale)}</span>
              <small>{row.left === 0 ? lt('sheet.ready') : row.left}</small>
            </th>
            {row.cells.map((cell, c) => {
              // the same as the row above: a ditto mark, so what differs down a column is what stands out
              const same = ditto && above && cell.state !== 'na' && cell.state !== 'missing' && above.cells[c].text === cell.text && above.cells[c].state !== 'missing';
              return (
                <td
                  className={classNames(`st-${cell.state}`, { flag: cell.flags.length > 0, at: cursor?.row === row.record.key && cursor.column === c })}
                  key={COLUMNS[c].id}
                  onClick={() => onCell({ row: row.record.key, column: c })}
                  onDoubleClick={() => onOpen(row)}
                >
                  {cell.state === 'na' ? '' : cell.state === 'missing' ? '！' : same ? '〃' : cell.text}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
});

// the review sheet: the open dex's records still open, a batch to a catch day (as they come over from Bank and HOME,
// a day's worth at a time), a row to a mon and a column to a field, so a batch is gone through a field at a time down
// its column, against the summary screens. A field the dex gave a value to is still yours to confirm, one at a time
// (Enter, which goes on down the column); one left empty is filled in W (W, or a double press). The row above's value
// a ditto mark (〃), so what differs down a column stands out, and a field the record check doubts is marked where
// it sits, its reason at the side with the mon's art
export function ReviewSheet ({ back, onClose, onReview }: ViewProps) {
  const { lt, locale } = useViewText();
  const { activeDex, activeDexView, saves } = useDexContext();
  const records = useScopedRecords('dex');
  const homeDex = activeDexView!.game.id === 'home';
  const dexId = activeDex!.id;
  const [touches, setTouches] = useState(() => readTouches(dexId));
  const [ditto, setDitto] = useLocalStorage('viewSheet.ditto', true);
  const [todo, setTodo] = useLocalStorage('viewSheet.todo', true);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);
  const given = useMemo(() => givenValues(activeDex?.captureDefaults, homeDex, saves), [activeDex, homeDex, saves]);

  // the record check's doubts, by mon and field
  const doubts = useMemo(() => {
    const { flags } = checkRecords(records, lt, gameName);
    const out = new Map<string, string[]>();
    for (const check of CHECKS) {
      for (const { record, why } of flags.get(check)!) {
        for (const field of CHECK_FIELDS[check]) {
          const key = `${record.key}:${field}`;
          out.set(key, [...(out.get(key) ?? []), `${lt(`check.${check}` as ViewKey)}: ${why}`]);
        }
      }
    }
    return out;
  }, [records, locale]); // gameName follows locale

  const batches = useMemo(() => {
    const byDate = new Map<string, Row[]>();
    for (const record of records) {
      const { capture } = record;
      if (!capture.captured || capture.sealed || capture.status === 'unobtainable') {
        continue;
      }
      const gate = unansweredFields(capture, capture.pokemon.gender_lock, asksPlace(capture, homeDex)).map((field) => field.id as string);
      const toTouch = untouched(capture, touches[capture.pokemon.id], given).map((field) => field.id as string);
      const cells = COLUMNS.map((field) => ({
        state: (!asksField(capture, field) ? 'na' : gate.includes(field.id) ? 'missing' : toTouch.includes(field.id) ? 'given' : 'done') as CellState,
        text: formatFieldValue(field, capture, locale, saves),
        flags: doubts.get(`${record.key}:${field.id}`) ?? [],
      }));
      const left = new Set([...gate, ...toTouch]).size;
      if (todo && left === 0 && !cells.some((cell) => cell.flags.length > 0)) {
        continue;
      }
      const date = capture.catch_date ?? '';
      byDate.set(date, [...(byDate.get(date) ?? []), { record, cells, left }]);
    }
    return [...byDate.entries()]
    .sort((a, b) => (!a[0] ? 1 : !b[0] ? -1 : b[0].localeCompare(a[0])))
    .map(([date, rows]): Batch => ({ date, rows: rows.sort((a, b) => a.record.capture.pokemon.id - b.record.capture.pokemon.id) }));
  }, [records, touches, given, doubts, todo, homeDex, locale, saves]);

  const rows = useMemo(() => batches.flatMap((batch) => batch.rows), [batches]);
  const at = cursor ? rows.findIndex((row) => row.record.key === cursor.row) : -1;
  const row = at >= 0 ? rows[at] : null;
  const cell = row && cursor ? row.cells[cursor.column] : null;
  const field = cursor ? COLUMNS[cursor.column] : null;

  const open = useCallback((target: Row) => {
    const batch = batches.find((entry) => entry.rows.includes(target))!;
    const queue = batch.rows.map((entry) => entry.record.capture.pokemon.id);
    onReview(queue, target.record.capture.pokemon.id);
  }, [batches, onReview]);

  const confirm = () => {
    if (!row || !field || cell?.state !== 'given') {
      return false;
    }
    setTouches(writeTouches(dexId, row.record.capture.pokemon.id, [field.id]));
    return true;
  };

  // the cursor kept in sight as it moves
  useEffect(() => {
    pageRef.current?.querySelector('td.at')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [cursor]);

  // arrows move the cursor (the first press puts it on the first row); Enter or Space confirms a given value and goes on
  // down the column; W opens the mon's batch in W at it; D the ditto marks; Escape lets the cursor go
  useKeys((e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || rows.length === 0) {
      return;
    }
    const move = (dr: number, dc: number) => {
      const r = Math.max(0, Math.min(rows.length - 1, (at < 0 ? 0 : at) + dr));
      const c = Math.max(0, Math.min(COLUMNS.length - 1, (cursor?.column ?? 0) + dc));
      setCursor({ row: rows[r].record.key, column: c });
    };
    const key = e.key.toLowerCase();
    if (key === 'arrowdown') {
      move(at < 0 ? 0 : 1, 0);
    } else if (key === 'arrowup') {
      move(-1, 0);
    } else if (key === 'arrowright') {
      move(0, at < 0 ? 0 : 1);
    } else if (key === 'arrowleft') {
      move(0, -1);
    } else if (key === 'enter' || key === ' ') {
      if (at < 0) {
        move(0, 0);
      } else {
        confirm();
        move(1, 0);
      }
    } else if (key === 'w' && row) {
      open(row);
    } else if (key === 'd') {
      setDitto(!ditto);
    } else if (key === 'escape' && cursor) {
      setCursor(null);
    } else {
      return;
    }
    e.preventDefault();
  });

  const onCell = useCallback((next: Cursor) => setCursor(next), []);
  const total = rows.length;
  const toConfirm = rows.reduce((n, entry) => n + entry.cells.filter(({ state }) => state === 'given').length, 0);
  const toFill = rows.reduce((n, entry) => n + entry.cells.filter(({ state }) => state === 'missing').length, 0);
  const doubted = rows.reduce((n, entry) => n + entry.cells.filter(({ flags }) => flags.length > 0).length, 0);
  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${iso}T00:00:00`));

  return (
    <Scene hint={lt('sheet.hint')} name="view-sheet" onClose={onClose} quiet={Boolean(back)} title={lt('sheet.title')}>
      {({ scale }) => (
        <div className={classNames('ls-page', { aside: row })} ref={pageRef} style={{ zoom: scale }}>
          <header className="ls-head">
            <div className="ls-figures">
              <span><b>{total}</b>{lt('sheet.rows')}</span>
              <span className="given"><b>{toConfirm}</b>{lt('sheet.toConfirm')}</span>
              <span className="missing"><b>{toFill}</b>{lt('sheet.toFill')}</span>
              <span className="flag"><b>{doubted}</b>{lt('sheet.doubted')}</span>
            </div>
            <div className="ls-switches" role="group">
              <button aria-pressed={todo} className={classNames({ on: todo })} onClick={() => setTodo(!todo)} type="button">{lt('sheet.todo')}</button>
              <button aria-pressed={ditto} className={classNames({ on: ditto })} onClick={() => setDitto(!ditto)} type="button">〃 {lt('sheet.ditto')}</button>
            </div>
          </header>

          {batches.length === 0 && <p className="ls-empty">{lt('sheet.empty')}</p>}

          {batches.map((batch) => (
            <section className="ls-batch" key={batch.date || 'undated'}>
              <h2>
                <b>{batch.date ? dateLabel(batch.date) : lt('mosaic.undated')}</b>
                <small>{lt('days.count', { n: batch.rows.length })}</small>
                <button onClick={() => open(batch.rows[0])} type="button">{lt('sheet.openBatch')}</button>
              </h2>
              <div className="ls-scroll">
                <table className="ls-table">
                  <thead>
                    <tr>
                      <th />
                      {COLUMNS.map((column, c) => (
                        <th className={classNames({ at: cursor?.column === c })} key={column.id}>{translate(locale, column.labelKey)}</th>
                      ))}
                    </tr>
                  </thead>
                  <BatchTable batch={batch} cursor={batch.rows.some((entry) => entry.record.key === cursor?.row) ? cursor : null} ditto={ditto} onCell={onCell} onOpen={open} />
                </table>
              </div>
            </section>
          ))}

          {row && field && cell && (
            <aside className="lg-panel ls-panel" key={row.record.key}>
              <Hologram record={row.record} />
              <div className="lg-panel-name">
                <small>No.{String(row.record.capture.pokemon.national_id).padStart(4, '0')}</small>
                <strong>{displayName(row.record.capture.pokemon.name, row.record.capture.pokemon.name_ja, locale)}</strong>
              </div>
              <div className={`ls-field st-${cell.state}`}>
                <small>{translate(locale, field.labelKey)}</small>
                <b>{cell.state === 'na' ? '—' : cell.text}</b>
                <em>{lt(`sheet.state.${cell.state}`)}</em>
              </div>
              {cell.flags.map((flag) => <p className="ls-doubt" key={flag}>{flag}</p>)}
              <small className="lg-panel-keys">{lt('sheet.keys')}</small>
            </aside>
          )}
        </div>
      )}
    </Scene>
  );
}
