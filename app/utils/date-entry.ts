// the catch date's text box (DateInput) edits as three fields, YYYY/MM/DD, rather than as one string reformatted around
// the caret: the caret stays where the edit was, typing over a full field replaces the digit after the caret, deleting
// a digit leaves the other fields where they are, and a slash only ever stands between two fields

const CAPS = [4, 2, 2];
// besides the box's own slash: an IME's full-width ones, and a date written out in Japanese (2026年8月21日, 日 ending it)
const SEPARATORS = new Set(['/', '-', '.', ' ', '／', '－', '．', '　', '年', '月']);

export interface DateEdit {
  text: string;
  caret: number;
}

// one to three fields of digits, as the text shows them between its slashes
type Fields = string[];
// a field, and an offset into it
type Caret = [number, number];

// full-width digits, from an IME left on, are digits too
function digitOf (char: string): string | null {
  if (char >= '0' && char <= '9') {
    return char;
  }
  if (char >= '０' && char <= '９') {
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  }
  return null;
}

// a position in the text as a field and an offset; a slash's left is the end of the field before it
function locate (fields: Fields, position: number): Caret {
  let start = 0;
  for (let i = 0; i < fields.length; i++) {
    const end = start + fields[i].length;
    if (position <= end || i === fields.length - 1) {
      return [i, Math.max(0, Math.min(position - start, fields[i].length))];
    }
    start = end + 1;
  }
  return [0, 0];
}

function positionOf (fields: Fields, [field, offset]: Caret): number {
  let position = offset;
  for (let i = 0; i < field; i++) {
    position += fields[i].length + 1;
  }
  return position;
}

// into a field with room; over the digit after the caret in a full one; at a full field's end, on into the next
function typeDigit (fields: Fields, [field, offset]: Caret, digit: string): Caret {
  for (;;) {
    const text = fields[field];
    if (text.length < CAPS[field]) {
      fields[field] = text.slice(0, offset) + digit + text.slice(offset);
      return [field, offset + 1];
    }
    if (offset < CAPS[field]) {
      fields[field] = text.slice(0, offset) + digit + text.slice(offset + 1);
      return [field, offset + 1];
    }
    if (field === CAPS.length - 1) {
      return [field, offset];
    }
    field += 1;
    offset = 0;
    if (fields.length <= field) {
      fields.push('');
    }
  }
}

// at the end of a field with something in it, on to the next, a lone month or day digit taking its zero (8/ → 08/)
function typeSeparator (fields: Fields, [field, offset]: Caret): Caret {
  if (field === CAPS.length - 1 || offset !== fields[field].length || fields[field] === '') {
    return [field, offset];
  }
  if (field > 0 && fields[field].length === 1) {
    fields[field] = `0${fields[field]}`;
  }
  if (fields.length <= field + 1) {
    fields.push('');
  }
  return [field + 1, 0];
}

function type (fields: Fields, caret: Caret, text: string): Caret {
  for (const char of text) {
    const digit = digitOf(char);
    if (digit) {
      caret = typeDigit(fields, caret, digit);
    } else if (SEPARATORS.has(char)) {
      caret = typeSeparator(fields, caret);
    }
  }
  return caret;
}

// the digits between two positions go; the slashes stay, so nothing after the gap moves into it
function removeRange (fields: Fields, from: number, to: number): Caret {
  const caret = locate(fields, from);
  let start = 0;
  for (let i = 0; i < fields.length; i++) {
    const text = fields[i];
    const cutFrom = Math.max(0, from - start);
    const cutTo = Math.min(text.length, to - start);
    if (cutTo > cutFrom) {
      fields[i] = text.slice(0, cutFrom) + text.slice(cutTo);
    }
    start += text.length + 1;
  }
  return caret;
}

// a digit before the caret goes; just past a slash, the slash goes if nothing follows it, or else the digit before it
function backspace (fields: Fields, position: number): Caret {
  const [field, offset] = locate(fields, position);
  if (offset > 0) {
    fields[field] = fields[field].slice(0, offset - 1) + fields[field].slice(offset);
    return [field, offset - 1];
  }
  if (field === 0) {
    return [0, 0];
  }
  if (fields.slice(field).every((text) => text === '')) {
    fields.length = field;
  } else {
    fields[field - 1] = fields[field - 1].slice(0, -1);
  }
  return [field - 1, fields[field - 1].length];
}

// Delete's mirror of backspace
function forwardDelete (fields: Fields, position: number): Caret {
  const [field, offset] = locate(fields, position);
  if (offset < fields[field].length) {
    fields[field] = fields[field].slice(0, offset) + fields[field].slice(offset + 1);
  } else if (field < fields.length - 1) {
    if (fields.slice(field + 1).every((text) => text === '')) {
      fields.length = field + 1;
    } else {
      fields[field + 1] = fields[field + 1].slice(1);
    }
  }
  return [field, offset];
}

// empty fields at the end go, unless the caret is in one (a slash just typed, waiting for its digits)
function settle (fields: Fields, caret: Caret): DateEdit {
  while (fields.length > 1 && fields.length - 1 > caret[0] && fields[fields.length - 1] === '') {
    fields.pop();
  }
  return { text: fields.join('/'), caret: positionOf(fields, caret) };
}

// text the box didn't edit itself (an IME's composition) read afresh, as if typed into an empty box: digits flow from
// one field into the next, and a separator after a lone month digit makes it that month (2026/8/21)
export function readDate (raw: string): string {
  const fields: Fields = [''];
  type(fields, [0, 0], raw);
  return fields.join('/');
}

// the runs of digits in a pasted text, whatever stands between them
function digitRuns (raw: string): string[] {
  return [...raw].map((char) => digitOf(char) ?? ' ').join('').split(' ').filter((run) => run !== '');
}

// a whole date as it's pasted or dropped, written any of the ways one is (2026/8/21, 2026-08-21, 2026.8.21, 20260821,
// 2026年8月21日, a timestamp's 2026-08-21T…), year first; or null
function pastedDate (raw: string): string | null {
  const runs = digitRuns(raw);
  if (runs.length === 1 && runs[0].length === 8) {
    return `${runs[0].slice(0, 4)}/${runs[0].slice(4, 6)}/${runs[0].slice(6)}`;
  }
  if (runs.length >= 3 && runs[0].length === 4 && runs[1].length <= 2 && runs[2].length <= 2) {
    return `${runs[0]}/${runs[1].padStart(2, '0')}/${runs[2].padStart(2, '0')}`;
  }
  return null;
}

// a whole date typed without its last zero (2026/08/5) is that date, once the box is left; anything else as it is
export function padDate (text: string): string {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  return match ? `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}` : text;
}

// an edit the box was about to make (a beforeinput), made on the fields instead; null leaves it to the box, for an
// IME's composition, which can't be stopped and is read afresh once it ends
export function editDate (text: string, start: number, end: number, inputType: string, data: string | null): DateEdit | null {
  const fields: Fields = text === '' ? [''] : text.split('/');
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const selected = to > from;

  switch (inputType) {
    case 'insertText':
    case 'insertReplacementText':
    case 'insertFromPaste':
    case 'insertFromDrop':
    case 'insertFromYank': {
      const inserted = data ?? '';
      // a whole date pasted or dropped is the date, wherever the caret was. One in another order (12/25/2026), or more
      // digits than a date has, would be typed over the date digit by digit, into some other date: it's refused
      if (inputType !== 'insertText') {
        const whole = pastedDate(inserted);
        if (whole) {
          return { text: whole, caret: whole.length };
        }
        const runs = digitRuns(inserted);
        if (runs.length >= 3 || runs.join('').length > 8) {
          return { text, caret: from };
        }
      }
      let caret = selected ? removeRange(fields, from, to) : locate(fields, from);
      caret = type(fields, caret, inserted);
      return settle(fields, caret);
    }
    case 'deleteContentBackward':
      return settle(fields, selected ? removeRange(fields, from, to) : backspace(fields, from));
    case 'deleteContentForward':
      return settle(fields, selected ? removeRange(fields, from, to) : forwardDelete(fields, from));
    case 'deleteWordBackward': {
      if (selected) {
        return settle(fields, removeRange(fields, from, to));
      }
      const [, offset] = locate(fields, from);
      return settle(fields, offset > 0 ? removeRange(fields, from - offset, from) : backspace(fields, from));
    }
    case 'deleteWordForward': {
      if (selected) {
        return settle(fields, removeRange(fields, from, to));
      }
      const [field, offset] = locate(fields, from);
      const rest = fields[field].length - offset;
      return settle(fields, rest > 0 ? removeRange(fields, from, from + rest) : forwardDelete(fields, from));
    }
    case 'deleteSoftLineBackward':
    case 'deleteHardLineBackward':
      return settle(fields, removeRange(fields, 0, to));
    case 'deleteSoftLineForward':
    case 'deleteHardLineForward':
      return settle(fields, removeRange(fields, from, text.length));
    case 'deleteByCut':
    case 'deleteByDrag':
    case 'deleteContent':
      return settle(fields, removeRange(fields, from, to));
    case 'historyUndo':
    case 'historyRedo':
      // the box's own history is of edits it never made; Ctrl+Z leaves the date be
      return { text, caret: from };
    default:
      return null;
  }
}

// a whole, real date as stored (2024-02-30 isn't one), or null
export function dateIso (text: string): string | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}
