import type { Capture } from '../../../types';

// unscaled px, as the stage draws them at 100%; keep in sync with $tl-slot-w and $tl-slot-h in styles/timeline.scss
export const SLOT_W = 40;
export const SLOT_H = 34;
// between the day stacks of a month
const DAY_GAP = 4;
// a month with nothing in it, kept as a sliver so a short lull still reads as time passing
const EMPTY_MONTH_W = 18;
// longer lulls fold into one card, "3 YEARS LATER"
const SKIP_MONTHS = 3;
const SKIP_W = 168;
// how far a skip card reaches above the spine (.tl-skip); a scene with one is at least this tall
const SKIP_TOP = 130;
// a year's banner is about this wide (.tl-year) at 100%: the next year's starts no closer
const YEAR_BANNER_W = 124;
const GAP = 8;
const EDGE = 96;
// the undated pile is no day's stack: it stands as tall as the tallest of them (at least this), and widens past it
const UNDATED_ROWS = 8;

// a real calendar date: a hand-edited 2017-13-05 would otherwise file itself under the next year, or not at all
const DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export interface TimelineSprite {
  capture: Capture;
  x: number;
  row: number;
  // chronological, so the cascade lands them in date order; undated ones come last
  order: number;
  // false on the "???" pile: no catch date, or one that isn't a date
  dated: boolean;
}

// a day's stack: where it stands, relative to its month, and which day it is
export interface DayColumn {
  dx: number;
  day: number;
}

interface Segment {
  x: number;
  width: number;
}

export interface MonthSegment extends Segment {
  kind: 'month';
  year: number;
  // 1-12
  month: number;
  count: number;
  days: DayColumn[];
  // the first year shown, or the first month shown of a new year, carries the year's banner
  opensYear: boolean;
  firstOrder: number;
}

export interface SkipSegment extends Segment {
  kind: 'skip';
  // from the last stack's month to the next one's
  months: number;
  firstOrder: number;
}

export interface UndatedSegment extends Segment {
  kind: 'undated';
  count: number;
  firstOrder: number;
}

export type TimelineSegment = MonthSegment | SkipSegment | UndatedSegment;

export interface TimelineLayout {
  segments: TimelineSegment[];
  sprites: TimelineSprite[];
  width: number;
  // how tall the scene stands above the spine, unscaled: its tallest stack, or a skip card
  height: number;
  dated: number;
  undated: number;
  // the busiest month, if any month has a mon
  peak: { year: number; month: number; count: number } | null;
}

interface Dated {
  capture: Capture;
  key: number;
  index: number;
  date: string;
}

// every marked mon that has a record to show (unobtainable ones hold none), placed by catch date: a stack per day, the
// days of a month side by side, from the first month to the last. A busy day stands tall rather than widening, so a
// stack's height is that day's count at a glance; the stage zooms out to take in the tallest
export function layoutTimeline (captures: Capture[]): TimelineLayout {
  const dated: Dated[] = [];
  const undated: Capture[] = [];
  captures.forEach((capture, index) => {
    if (!capture.captured || capture.status === 'unobtainable') {
      return;
    }
    const match = capture.catch_date ? DATE.exec(capture.catch_date) : null;
    if (match) {
      dated.push({ capture, key: Number(match[1]) * 12 + Number(match[2]) - 1, index, date: capture.catch_date! });
    } else {
      undated.push(capture);
    }
  });
  // dex order breaks a tie on the same day
  dated.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);

  const segments: TimelineSegment[] = [];
  const sprites: TimelineSprite[] = [];
  let x = EDGE;
  let peak: TimelineLayout['peak'] = null;
  let order = 0;
  let bannerX = -Infinity;
  // in rows
  let tallest = 0;
  let skipped = false;

  // a month opening a year waits until the last banner has room, so two years a month apart don't stack their banners
  const openYear = () => {
    x = Math.max(x, bannerX + YEAR_BANNER_W);
    bannerX = x;
  };

  if (dated.length > 0) {
    const byMonth = new Map<number, Dated[]>();
    for (const entry of dated) {
      const month = byMonth.get(entry.key);
      if (month) {
        month.push(entry);
      } else {
        byMonth.set(entry.key, [entry]);
      }
    }
    const first = dated[0].key;
    const last = dated[dated.length - 1].key;
    let lull = 0;
    let lastYear = -1;

    const closeLull = (resumeAt: number) => {
      if (lull >= SKIP_MONTHS) {
        // "3 years later" is from one stack's month to the next, the empty months and one more
        segments.push({ kind: 'skip', months: lull + 1, x, width: SKIP_W, firstOrder: order });
        x += SKIP_W + GAP;
        skipped = true;
      } else {
        for (let k = resumeAt - lull; k < resumeAt; k++) {
          const year = Math.floor(k / 12);
          const opensYear = year !== lastYear;
          if (opensYear) {
            openYear();
          }
          segments.push({ kind: 'month', year, month: (k % 12) + 1, count: 0, days: [], opensYear, firstOrder: order, x, width: EMPTY_MONTH_W });
          lastYear = year;
          x += EMPTY_MONTH_W + GAP;
        }
      }
      lull = 0;
    };

    for (let key = first; key <= last; key++) {
      const mons = byMonth.get(key);
      if (!mons) {
        lull++;
        continue;
      }
      closeLull(key);
      const year = Math.floor(key / 12);
      const opensYear = year !== lastYear;
      if (opensYear) {
        openYear();
      }
      const firstOrder = order;
      // the month's days in order, already sorted: a run of one date is one stack
      const days: DayColumn[] = [];
      for (let start = 0; start < mons.length;) {
        let end = start;
        while (end < mons.length && mons[end].date === mons[start].date) {
          end++;
        }
        const dx = days.length * (SLOT_W + DAY_GAP);
        days.push({ dx, day: Number(mons[start].date.slice(8, 10)) });
        for (let row = 0; row < end - start; row++) {
          sprites.push({ capture: mons[start + row].capture, x: x + dx, row, order: order++, dated: true });
        }
        tallest = Math.max(tallest, end - start);
        start = end;
      }
      const width = days.length * SLOT_W + (days.length - 1) * DAY_GAP;
      segments.push({ kind: 'month', year, month: (key % 12) + 1, count: mons.length, days, opensYear, firstOrder, x, width });
      lastYear = year;
      if (!peak || mons.length > peak.count) {
        peak = { year, month: (key % 12) + 1, count: mons.length };
      }
      x += width + GAP;
    }
  }

  if (undated.length > 0) {
    const rows = Math.max(tallest, UNDATED_ROWS);
    const columns = Math.ceil(undated.length / rows);
    // set apart from the dated ones
    x += dated.length > 0 ? GAP * 4 : 0;
    segments.push({ kind: 'undated', count: undated.length, firstOrder: order, x, width: columns * SLOT_W });
    undated.forEach((capture, j) => {
      sprites.push({ capture, x: x + (j % columns) * SLOT_W, row: Math.floor(j / columns), order: order++, dated: false });
    });
    tallest = Math.max(tallest, Math.ceil(undated.length / columns));
    x += columns * SLOT_W + GAP;
  }

  const height = Math.max(tallest * SLOT_H, skipped ? SKIP_TOP : 0);
  return { segments, sprites, width: x - GAP + EDGE, height, dated: dated.length, undated: undated.length, peak };
}
