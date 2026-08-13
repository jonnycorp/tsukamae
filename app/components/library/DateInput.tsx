import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { useDebouncedCommit } from '../../hooks/use-debounced-commit';

const format = (digits: string): string => {
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
};

const toIso = (digits: string): string | null => {
  if (digits.length !== 8) {
    return null;
  }
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

interface Props {
  id: string;
  value: string | null;
  onChange: (iso: string | null) => void;
}

// yyyy/mm/dd text entry backed by the native calendar via showPicker()
export function DateInput ({ id, value, onChange }: Props) {
  const [draft, setDraft] = useState(() => (value ? value.replaceAll('-', '/') : ''));
  const pickerRef = useRef<HTMLInputElement>(null);
  const { schedule, flush, cancel } = useDebouncedCommit();

  // the committed value can move underneath while a commit is in flight
  const valueRef = useRef(value);
  valueRef.current = value;

  // adopt external changes without clobbering a partial entry in progress
  useEffect(() => {
    if ((value ?? null) !== toIso(draft.replaceAll('/', ''))) {
      setDraft(value ? value.replaceAll('-', '/') : '');
    }
  }, [value]);

  // typing commits on pause or blur, never per keystroke
  const handleTextChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    setDraft(format(digits));
    schedule(() => {
      const iso = toIso(digits);
      if (iso !== (valueRef.current ?? null)) {
        onChange(iso);
      }
    });
  };

  // a calendar pick is one deliberate act — commit now, dropping any pending typing
  const handlePick = (iso: string) => {
    if (!iso) {
      return;
    }
    cancel();
    setDraft(iso.replaceAll('-', '/'));
    if (iso !== (value ?? null)) {
      onChange(iso);
    }
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
    <div className="date-input">
      <input
        autoComplete="off"
        className="form-control"
        id={id}
        inputMode="numeric"
        maxLength={10}
        name={id}
        onBlur={flush}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="yyyy/mm/dd"
        type="text"
        value={draft}
      />
      <button className="date-input-picker" onClick={openPicker} tabIndex={-1} type="button">
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
  );
}
