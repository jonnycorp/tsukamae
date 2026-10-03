import type { Capture } from '../../../types';

// unscaled px; keep in sync with $tl-slot-w and $tl-slot-h in styles/timeline.scss
export const SLOT_W = 40;
export const SLOT_H = 34;
// a month with nothing in it, kept as a sliver so a short lull still reads as time passing
const EMPTY_MONTH_W = 18;
// longer lulls fold into one card, "3 YEARS LATER"
const SKIP_MONTHS = 3;
const SKIP_W = 168;
// a year's banner is about this wide (.tl-year): the next year's starts no closer
const YEAR_BANNER_W = 124;
const GAP = 8;
const EDGE = 96;

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
  // the first year shown, or the first month shown of a new year, carries the year's banner
  opensYear: boolean;
  firstOrder: number;
}

export interface SkipSegment extends Segment {
  kind: 'skip';
  // from the last pile's month to the next one's
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

// a pile grows up to the stage's height, then widens: a busy month becomes a wall rather than a tower out of sight
function pile (count: number, rowsMax: number) {
  const columns = Math.max(1, Math.ceil(count / rowsMax));
  return { columns, width: columns * SLOT_W };
}

// every marked mon that has a record to show (unobtainable ones hold none), placed by catch date: one pile per month
// from the first to the last, filling bottom up and left to right in date order
export function layoutTimeline (captures: Capture[], rowsMax: number): TimelineLayout {
  const rows = Math.max(1, rowsMax);
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

  const place = (mons: Capture[], left: number, columns: number, isDated: boolean) => {
    mons.forEach((capture, j) => {
      sprites.push({ capture, x: left + (j % columns) * SLOT_W, row: Math.floor(j / columns), order: order++, dated: isDated });
    });
  };

  // a month opening a year waits until the last banner has room, so two years a month apart don't stack their banners
  const openYear = () => {
    x = Math.max(x, bannerX + YEAR_BANNER_W);
    bannerX = x;
  };

  if (dated.length > 0) {
    const byMonth = new Map<number, Capture[]>();
    for (const { capture, key } of dated) {
      const month = byMonth.get(key);
      if (month) {
        month.push(capture);
      } else {
        byMonth.set(key, [capture]);
      }
    }
    const first = dated[0].key;
    const last = dated[dated.length - 1].key;
    let lull = 0;
    let lastYear = -1;

    const closeLull = (resumeAt: number) => {
      if (lull >= SKIP_MONTHS) {
        // "3 years later" is from one pile's month to the next, the empty months and one more
        segments.push({ kind: 'skip', months: lull + 1, x, width: SKIP_W, firstOrder: order });
        x += SKIP_W + GAP;
      } else {
        for (let k = resumeAt - lull; k < resumeAt; k++) {
          const year = Math.floor(k / 12);
          const opensYear = year !== lastYear;
          if (opensYear) {
            openYear();
          }
          segments.push({ kind: 'month', year, month: (k % 12) + 1, count: 0, opensYear, firstOrder: order, x, width: EMPTY_MONTH_W });
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
      const { columns, width } = pile(mons.length, rows);
      segments.push({ kind: 'month', year, month: (key % 12) + 1, count: mons.length, opensYear, firstOrder: order, x, width });
      lastYear = year;
      if (!peak || mons.length > peak.count) {
        peak = { year, month: (key % 12) + 1, count: mons.length };
      }
      place(mons, x, columns, true);
      x += width + GAP;
    }
  }

  if (undated.length > 0) {
    const { columns, width } = pile(undated.length, rows);
    // set apart from the dated ones
    x += dated.length > 0 ? GAP * 4 : 0;
    segments.push({ kind: 'undated', count: undated.length, firstOrder: order, x, width });
    place(undated, x, columns, false);
    x += width + GAP;
  }

  return { segments, sprites, width: x - GAP + EDGE, dated: dated.length, undated: undated.length, peak };
}
