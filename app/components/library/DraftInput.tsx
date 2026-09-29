import { useEffect, useRef, useState } from 'react';

import { useDebouncedCommit } from '../../hooks/use-debounced-commit';

import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onCommit: (raw: string) => void;
  sanitize?: (raw: string) => string;
}

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
          // compared trimmed, as names are committed: a space typed mid-name isn't a change to write yet
          if (next.trim() !== committedRef.current) {
            onCommit(next);
          }
        });
      }}
      onFocus={() => setFocused(true)}
      value={draft}
    />
  );
}
