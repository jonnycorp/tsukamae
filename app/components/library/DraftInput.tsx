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

  const take = (raw: string) => {
    const next = sanitize ? sanitize(raw) : raw;
    setDraft(next);
    schedule(() => {
      // compared trimmed, as names are committed: a space typed mid-name isn't a change to write yet
      if (next.trim() !== committedRef.current) {
        onCommit(next);
      }
    });
  };

  // an IME's text is its own while it composes (rewritten under it, ５０ comes out 550): held as typed, and taken once
  // it's confirmed
  return (
    <input
      {...rest}
      className="form-control"
      onBlur={() => {
        flush();
        setFocused(false);
      }}
      onChange={(e) => {
        if ((e.nativeEvent as InputEvent).isComposing) {
          setDraft(e.target.value);
        } else {
          take(e.target.value);
        }
      }}
      onCompositionEnd={(e) => take(e.currentTarget.value)}
      onFocus={() => setFocused(true)}
      value={draft}
    />
  );
}
