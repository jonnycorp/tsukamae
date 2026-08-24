import { useEffect, useRef, useState } from 'react';

import { useDebouncedCommit } from '../../hooks/use-debounced-commit';

import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  // the committed value, as its display string
  value: string;
  onCommit: (raw: string) => void;
  // runs on every keystroke, before the draft is shown
  sanitize?: (raw: string) => string;
}

// keystrokes stay local; the app-wide write + refresh happens on pause, blur or unmount
export function DraftInput ({ value, onCommit, sanitize, ...rest }: Props) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const { schedule, flush } = useDebouncedCommit();

  // committed value can move underneath (save pick restamps OT, commit normalizes)
  const committedRef = useRef(value);
  committedRef.current = value;

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  return (
    <input
      {...rest}
      className="form-control"
      onBlur={() => {
        flush();
        setFocused(false);
      }}
      onChange={(e) => {
        const next = sanitize ? sanitize(e.target.value) : e.target.value;
        setDraft(next);
        schedule(() => {
          if (next !== committedRef.current) {
            onCommit(next);
          }
        });
      }}
      onFocus={() => setFocused(true)}
      value={draft}
    />
  );
}
