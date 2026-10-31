import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { dateIso, editDate, padDate, readDate } from '../../utils/date-entry';
import { useDebouncedCommit } from '../../hooks/use-debounced-commit';
import { useTranslation } from '../../hooks/use-translation';

import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

const shown = (iso: string | null): string => (iso ? iso.replaceAll('-', '/') : '');

interface Props {
  id: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  // dates to offer under the field (the review's catch date: the latest you've given), each a press away; ↓ from the
  // field goes to them. `keyboard` says whether a pick was made from the keys, which the review goes on from
  recent?: string[];
  onRecentPicked?: (keyboard: boolean) => void;
}

// YYYY/MM/DD typed as three fields (utils/date-entry.ts): each edit is made on the fields rather than by the box, so
// the caret stays where it was and the digits beside an edit stay put
export function DateInput ({ id, value, onChange, recent = [], onRecentPicked }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => shown(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  // where the caret goes once an edit has rendered, as React writing the value back puts it at the end
  const caretRef = useRef<number | null>(null);
  const { schedule, flush, cancel } = useDebouncedCommit();

  // the committed value can move underneath while a commit is in flight
  const valueRef = useRef(value);
  valueRef.current = value;
  const textRef = useRef(text);
  textRef.current = text;

  // adopt external changes without clobbering a partial entry in progress
  useEffect(() => {
    if ((value ?? null) !== dateIso(textRef.current)) {
      setText(shown(value));
    }
  }, [value]);

  // only an emptied field or a whole, real date is committed: a partial or impossible one (2024/02/30) would erase the
  // stored date
  const edit = (next: string, caret: number) => {
    caretRef.current = caret;
    setText(next);
    schedule(() => {
      const iso = next === '' ? null : dateIso(next);
      if ((iso !== null || next === '') && iso !== (valueRef.current ?? null)) {
        onChange(iso);
      }
    });
  };
  const editRef = useRef(edit);
  editRef.current = edit;

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    caretRef.current = null;
    if (input && caret !== null && document.activeElement === input) {
      input.setSelectionRange(caret, caret);
    }
  });

  useEffect(() => {
    const input = inputRef.current!;
    const handleBeforeInput = (e: InputEvent) => {
      // a paste or a drop may carry its text in dataTransfer rather than data
      const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? null;
      const result = editDate(textRef.current, input.selectionStart ?? 0, input.selectionEnd ?? 0, e.inputType, data);
      if (!result) {
        return;
      }
      e.preventDefault();
      if (result.text === textRef.current) {
        input.setSelectionRange(result.caret, result.caret);
      } else {
        editRef.current(result.text, result.caret);
      }
    };
    // an IME's composition can't be stopped as it goes, so what it leaves is read afresh once it ends
    const handleCompositionEnd = () => {
      const next = readDate(input.value);
      editRef.current(next, next.length);
    };
    input.addEventListener('beforeinput', handleBeforeInput);
    input.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      input.removeEventListener('beforeinput', handleBeforeInput);
      input.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, []);

  // only what the box edited by itself gets here: a composition, shown as it goes, or anything editDate left to it
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if ((e.nativeEvent as InputEvent).isComposing) {
      setText(e.target.value);
      return;
    }
    const next = readDate(e.target.value);
    edit(next, next.length);
  };

  // a month or a day typed as one digit is that one once the box is left (2026/8/5); anything else unfinished goes back
  // to the stored date
  const handleBlur = () => {
    const padded = padDate(text);
    const iso = padded === text ? null : dateIso(padded);
    if (iso) {
      cancel();
      setText(padded);
      if (iso !== (valueRef.current ?? null)) {
        onChange(iso);
      }
      return;
    }
    flush();
    if (text !== '' && !dateIso(text)) {
      setText(shown(valueRef.current));
    }
  };

  const handlePick = (iso: string) => {
    if (!iso) {
      return;
    }
    cancel();
    setText(shown(iso));
    if (iso !== (value ?? null)) {
      onChange(iso);
    }
  };

  const recentRef = useRef<HTMLDivElement>(null);
  const recentButtons = () => [...(recentRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  const handleFieldKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && recent.length > 0) {
      e.preventDefault();
      recentButtons()[0]?.focus();
    }
  };
  // ← → along them, ↑ back to the field
  const handleRecentKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = recentButtons();
    const at = buttons.indexOf(e.currentTarget);
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      inputRef.current?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      buttons[(at + (e.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  };
  const handleRecent = (iso: string, e: MouseEvent<HTMLButtonElement>) => {
    handlePick(iso);
    // a click from Enter or Space has no pointer behind it, and the keys stay in the field: the date picked leaves the
    // list (a mon's own date isn't offered), and its button with it
    const keyboard = e.detail === 0;
    if (keyboard) {
      inputRef.current?.focus();
    }
    onRecentPicked?.(keyboard);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) {
      return;
    }
    picker.value = value ?? '';
    picker.showPicker();
  };

  return (
    <>
      <div className="date-input">
        <input
          autoComplete="off"
          className="form-control"
          id={id}
          inputMode="numeric"
          maxLength={10}
          name={id}
          onBlur={handleBlur}
          onChange={handleChange}
          onKeyDown={handleFieldKeyDown}
          placeholder={t('common.datePlaceholder')}
          ref={inputRef}
          type="text"
          value={text}
        />
        <button aria-label={t('common.pickDate')} className="date-input-picker" onClick={openPicker} tabIndex={-1} title={t('common.pickDate')} type="button">
          <FontAwesomeIcon icon={faCalendarDays} />
        </button>
        <input
          className="date-input-native"
          onChange={(e) => handlePick(e.target.value)}
          ref={pickerRef}
          tabIndex={-1}
          type="date"
        />
      </div>
      {recent.length > 0 &&
      <div aria-label={t('common.recentDates')} className="date-recent" ref={recentRef} role="group">
        <FontAwesomeIcon icon={faClockRotateLeft} title={t('common.recentDates')} />
        {recent.map((iso) => (
          <button className="date-recent-pick" key={iso} onClick={(e) => handleRecent(iso, e)} onKeyDown={handleRecentKeyDown} type="button">
            {shown(iso)}
          </button>
        ))}
      </div>
      }
    </>
  );
}
