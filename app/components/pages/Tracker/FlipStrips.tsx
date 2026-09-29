import { memo } from 'react';

import { BOX_COLUMNS, BOX_GAP, BOX_WIDTH, TILE_SIZE, dexNumber } from '../../../utils/pokemon';
import { BadgeRow, CatchDateLine, NicknameLine, OTLine, SlotsLine, SpeciesLine, flippingLines } from './seal-faces';
import { isDisplaySealed, useTrackerActions } from './use-tracker';
import { useDeferredRender } from '../../../hooks/use-deferred-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Capture } from '../../../types';
import type { ReactNode } from 'react';

type Line = 'names' | 'badges' | 'numbers';
const LINE_ORDER: Record<Line, number> = { names: 0, badges: 1, numbers: 2 };

// a sealed tile's layout, unscaled; keep in sync with styles/tracker.scss: a 22/49/16 name, sprite and number stack
// centred above the badges' 18px, and the 20px badge row 2px off the bottom
const NAME = 22;
const SPRITE = 49;
const NUMBER = 16;
const BADGES = 20;
const BADGES_BOTTOM = 2;
const SEALED_PADDING = 18;

// where a row's window for one line sits over the tiles; below the first row and right of the first column, a tile's
// own grid line takes its first pixel
function lineTop (line: Line, row: number): number {
  const top = row * TILE_SIZE + (row > 0 ? 1 : 0);
  const height = TILE_SIZE - (row > 0 ? 1 : 0);
  const stack = top + (height - SEALED_PADDING - (NAME + SPRITE + NUMBER)) / 2;
  if (line === 'names') {
    return stack;
  }
  return line === 'numbers' ? stack + NAME + SPRITE : top + height - BADGES_BOTTOM - BADGES;
}

interface Props {
  // grids side by side a box apart, each in grid order: slot i sits at column i % BOX_COLUMNS
  grids: Capture[][];
  // the box grid's row these are, which the overlay spans (see .box-grid in styles/tracker.scss); unset for a lone grid
  row?: number;
  deferred?: boolean;
}

function sameGrids (prev: Props, next: Props): boolean {
  return prev.row === next.row &&
    prev.deferred === next.deferred &&
    prev.grids.length === next.grids.length &&
    prev.grids.every((captures, g) => captures.length === next.grids[g].length &&
      captures.every((capture, i) => capture === next.grids[g][i]));
}

// every sealed tile's flipping lines, lifted out of the tiles into an overlay: each tile row gets one clipped window
// per line, spanning a whole row of boxes, whose faces slide as a single composited strip; the page's cost of a strip
// grows with the number of them, so they're as few and as wide as the rows allow
export const FlipStrips = memo(function FlipStrips ({ grids, row, deferred = false }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { sealFx } = useTrackerActions();
  const render = useDeferredRender(!deferred);

  if (!render || activeDex!.checklist) {
    return null;
  }

  const windows = new Map<string, { line: Line; row: number; faces: ReactNode[] }>();
  const add = (line: Line, grid: number, index: number, faces: ReactNode) => {
    const tileRow = Math.floor(index / BOX_COLUMNS);
    const key = `${line}-${tileRow}`;
    if (!windows.has(key)) {
      windows.set(key, { line, row: tileRow, faces: [] });
    }
    const col = index % BOX_COLUMNS;
    const left = grid * (BOX_WIDTH + BOX_GAP) + col * TILE_SIZE + (col > 0 ? 1 : 0);
    windows.get(key)!.faces.push(
      <div className="flip-faces" key={`${grid}-${index}`} style={{ left, width: TILE_SIZE - (col > 0 ? 1 : 0) }}>{faces}</div>,
    );
  };

  grids.forEach((captures, grid) => captures.forEach((capture, index) => {
    if (!isDisplaySealed(capture, false, sealFx)) {
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
    if (lines.badges) {
      add('badges', grid, index, <>
        <BadgeRow capture={capture} />
        <CatchDateLine capture={capture} />
        <BadgeRow capture={capture} />
      </>);
    }
    if (lines.number) {
      const number = dexNumber(capture.pokemon, activeDexView!);
      add('numbers', grid, index, <>
        <SlotsLine capture={capture} number={number} />
        <OTLine capture={capture} />
        <SlotsLine capture={capture} number={number} />
      </>);
    }
  }));

  if (windows.size === 0) {
    return null;
  }

  return (
    // an absolutely positioned grid item's auto end line is the grid's far edge, so the span is spelled out
    <div className="flip-overlay" style={row === undefined ? undefined : { gridRow: `${row + 1} / span 1` }}>
      {/* a fixed order: moving a window restarts its strip's animation */}
      {[...windows].sort(([, a], [, b]) => a.row - b.row || LINE_ORDER[a.line] - LINE_ORDER[b.line]).map(([key, { line, row: tileRow, faces }]) => (
        <div className={`flip-window flip-${line}`} key={key} style={{ top: lineTop(line, tileRow) }}>
          <div className="flip-strip">{faces}</div>
        </div>
      ))}
    </div>
  );
}, sameGrids);
