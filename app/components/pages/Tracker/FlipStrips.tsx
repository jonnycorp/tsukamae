import { memo } from 'react';

import { BOX_COLUMNS, BOX_GAP, BOX_WIDTH, TILE_SIZE, dexNumber } from '../../../utils/pokemon';
import { BadgeRow, CatchDateLine, NicknameLine, OTLine, SlotsLine, SpeciesLine, TypesBlock, flippingLines } from './seal-faces';
import { isDisplaySealed } from './use-tracker';
import { useDeferredRender } from '../../../hooks/use-deferred-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Capture } from '../../../types';
import type { ReactNode } from 'react';

type Line = 'names' | 'badges' | 'numbers';
const LINE_ORDER: Record<Line, number> = { names: 0, badges: 1, numbers: 2 };

// a sealed tile's layout, unscaled; keep in sync with styles/tracker.scss: a 22/49/16 name, sprite and number stack
// centred above the badges' 18px, and the 20px badge row --flip-band (14px, about 2px off the bottom) below the number
const NAME = 22;
const SPRITE = 49;
const NUMBER = 16;
const SEALED_PADDING = 18;

// where a row's window for one line sits over the tiles; below the first row and right of the first column, a tile's
// own grid line takes its first pixel. The badges' window starts where the number line's ends, its strip drawn up to
// the badges' own place, --flip-band (whole screen pixels) under the number, so the types' block, drawn across both
// windows, lines up where they meet and no pixel is drawn twice
function lineTop (line: Line, row: number): number | string {
  const top = row * TILE_SIZE + (row > 0 ? 1 : 0);
  const height = TILE_SIZE - (row > 0 ? 1 : 0);
  const stack = top + (height - SEALED_PADDING - (NAME + SPRITE + NUMBER)) / 2;
  if (line === 'names') {
    return stack;
  }
  const number = stack + NAME + SPRITE;
  return line === 'numbers' ? number : `calc(${number}px + var(--flip-numbers, 16px))`;
}

interface Props {
  // grids side by side a box apart, each in grid order: slot i sits at column i % BOX_COLUMNS
  grids: Capture[][];
  // the box grid's row these are, which the overlay spans (see .box-grid in styles/tracker.scss); unset for a lone grid
  row?: number;
  // frames to wait before rendering, 0 for at once; only read as it mounts
  deferFrames?: number;
}

function sameGrids (prev: Props, next: Props): boolean {
  return prev.row === next.row &&
    prev.grids.length === next.grids.length &&
    prev.grids.every((captures, g) => captures.length === next.grids[g].length &&
      captures.every((capture, i) => capture === next.grids[g][i]));
}

// every sealed tile's flipping lines, lifted out of the tiles into an overlay: each tile row gets one clipped window
// per line, spanning a whole row of boxes, whose faces slide as a single composited strip; the page's cost of a strip
// grows with the number of them, so they're as few and as wide as the rows allow
export const FlipStrips = memo(function FlipStrips ({ grids, row, deferFrames = 0 }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const render = useDeferredRender(deferFrames === 0, deferFrames);

  if (!render || activeDex!.checklist) {
    return null;
  }

  const windows = new Map<string, { line: Line; row: number; hold: boolean; faces: ReactNode[] }>();
  // a held line (one whose trainer's face is its record's) goes in a window of its own beside the row's other, which
  // swaps the two faces, the same picture, rather than sliding them (.flip-hold in styles/tracker.scss)
  const add = (line: Line, grid: number, index: number, faces: ReactNode, hold = false) => {
    const tileRow = Math.floor(index / BOX_COLUMNS);
    const key = `${line}-${tileRow}${hold ? '-hold' : ''}`;
    if (!windows.has(key)) {
      windows.set(key, { line, row: tileRow, hold, faces: [] });
    }
    const col = index % BOX_COLUMNS;
    const left = grid * (BOX_WIDTH + BOX_GAP) + col * TILE_SIZE + (col > 0 ? 1 : 0);
    windows.get(key)!.faces.push(
      <div className="flip-faces" key={`${grid}-${index}`} style={{ left, width: TILE_SIZE - (col > 0 ? 1 : 0) }}>{faces}</div>,
    );
  };

  grids.forEach((captures, grid) => captures.forEach((capture, index) => {
    if (!isDisplaySealed(capture, false)) {
      return;
    }
    const lines = flippingLines(capture);
    if (lines.name) {
      add('names', grid, index, <>
        <SpeciesLine capture={capture} />
        <NicknameLine capture={capture} />
        <SpeciesLine capture={capture} />
      </>);
    }
    // the number line and the badges below it each slide their own line from the record's face to the trainer's, then
    // both slide a whole block, the lines' height together, into the types and out again: each strip carries what
    // passes through it as the block moves, the catch date up through the number line on the way in and the number up
    // through the badges' on the way out (styles/tracker.scss places them). A record sealed before OT or catch date
    // were asked for holds that line's first face through the trainer's, then goes with the block
    const number = dexNumber(capture.pokemon, activeDexView!);
    const slots = <SlotsLine capture={capture} number={number} />;
    const trainerBadges = capture.catch_date ? <CatchDateLine capture={capture} /> : <BadgeRow capture={capture} />;
    if (lines.badges) {
      add('badges', grid, index, <>
        <BadgeRow capture={capture} />
        {trainerBadges}
        <TypesBlock capture={capture} />
        {slots}
        <BadgeRow capture={capture} />
      </>, !capture.catch_date);
    }
    if (lines.number) {
      add('numbers', grid, index, <>
        {slots}
        {capture.ot ? <OTLine capture={capture} /> : slots}
        {trainerBadges}
        <TypesBlock capture={capture} />
        {slots}
      </>, !capture.ot);
    }
  }));

  if (windows.size === 0) {
    return null;
  }

  return (
    // an absolutely positioned grid item's auto end line is the grid's far edge, so the span is spelled out
    <div className="flip-overlay" style={row === undefined ? undefined : { gridRow: `${row + 1} / span 1` }}>
      {/* a fixed order: moving a window restarts its strip's animation */}
      {[...windows].sort(([, a], [, b]) => a.row - b.row || LINE_ORDER[a.line] - LINE_ORDER[b.line] || Number(a.hold) - Number(b.hold)).map(([key, { line, row: tileRow, hold, faces }]) => (
        <div className={`flip-window flip-${line}${hold ? ' flip-hold' : ''}`} key={key} style={{ top: lineTop(line, tileRow) }}>
          <div className="flip-strip">{faces}</div>
        </div>
      ))}
    </div>
  );
}, sameGrids);
