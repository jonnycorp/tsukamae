import { memo } from 'react';

import { BOX_COLUMNS, BOX_GAP, BOX_WIDTH, TILE_SIZE, dexNumber } from '../../../utils/pokemon';
import { DISPLAY_PAGES } from '../../../utils/display-modes';
import { FacePageBlock, HUB_BALL_Y, HUB_SLOTS, hubMoons } from './face-pages';
import { NicknameLine, SpeciesLine, flipsName } from './seal-faces';
import { isDisplaySealed } from './use-tracker';
import { useDeferredRender } from '../../../hooks/use-deferred-render';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDisplayContext } from '../../../hooks/contexts/use-local-storage-context';

import type { Capture } from '../../../types';
import type { ReactNode } from 'react';

// the name, and the lower block: the number line and the badges together, a page at a time
type Line = 'names' | 'lower';
const LINE_ORDER: Record<Line, number> = { names: 0, lower: 1 };

// a sealed tile's layout, unscaled; keep in sync with styles/tracker.scss: a 22/49/16 name, sprite and number stack
// centred above the badges' 18px, the lower block from the number line's top down over the badges
const NAME = 22;
const SPRITE = 49;
const NUMBER = 16;
const SEALED_PADDING = 18;

// where a row's window for one line sits over the tiles; below the first row and right of the first column, a tile's
// own grid line takes its first pixel
function lineTop (line: Line, row: number): number {
  const top = row * TILE_SIZE + (row > 0 ? 1 : 0);
  const height = TILE_SIZE - (row > 0 ? 1 : 0);
  const stack = top + (height - SEALED_PADDING - (NAME + SPRITE + NUMBER)) / 2;
  return line === 'names' ? stack : stack + NAME + SPRITE;
}

interface Props {
  // grids side by side a box apart, each in grid order: slot i sits at column i % columns
  grids: Capture[][];
  // tiles across each grid: a box's six, or a chunk of search results' row of boxes' worth
  columns?: number;
  // the box grid's row these are, which the overlay spans (see .box-grid in styles/tracker.scss); unset for a lone grid
  row?: number;
  // frames to wait before rendering, 0 for at once; only read as it mounts
  deferFrames?: number;
}

function sameGrids (prev: Props, next: Props): boolean {
  return prev.row === next.row &&
    prev.columns === next.columns &&
    prev.grids.length === next.grids.length &&
    prev.grids.every((captures, g) => captures.length === next.grids[g].length &&
      captures.every((capture, i) => capture === next.grids[g][i]));
}

// every sealed tile's flipping lines, lifted out of the tiles into an overlay: each tile row gets one clipped window
// per line, spanning a whole row of boxes, whose faces slide as a single composited strip; the page's cost of a strip
// grows with the number of them, so they're as few and as wide as the rows allow
export const FlipStrips = memo(function FlipStrips ({ grids, columns = BOX_COLUMNS, row, deferFrames = 0 }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { display } = useDisplayContext();
  const render = useDeferredRender(deferFrames === 0, deferFrames);

  if (!render || activeDex!.checklist) {
    return null;
  }

  // the mode's pages, with the first again at the end for the strip to wrap onto; a lone page (Orbit's hub) stands still
  const pages = DISPLAY_PAGES[display];
  const strip = pages.length > 1 ? [...pages, pages[0]] : pages;
  const trainer = pages.includes('trainer');
  // Orbit's hub: each row's moons by their slot, every tile's moon in a slot circling as one group (a copy behind the
  // balls and one before them), so a row costs two moving layers a slot however many tiles it has
  const hubAt = pages.indexOf('hub');
  const moons = new Map<number, ReactNode[][]>();
  const windows = new Map<string, { line: Line; row: number; faces: ReactNode[] }>();
  const add = (line: Line, grid: number, index: number, faces: ReactNode) => {
    const tileRow = Math.floor(index / columns);
    const key = `${line}-${tileRow}`;
    if (!windows.has(key)) {
      windows.set(key, { line, row: tileRow, faces: [] });
    }
    const col = index % columns;
    const left = grid * (BOX_WIDTH + BOX_GAP) + col * TILE_SIZE + (col > 0 ? 1 : 0);
    windows.get(key)!.faces.push(
      <div className="flip-faces" key={`${grid}-${index}`} style={{ left, width: TILE_SIZE - (col > 0 ? 1 : 0) }}>{faces}</div>,
    );
  };

  grids.forEach((captures, grid) => captures.forEach((capture, index) => {
    if (!isDisplaySealed(capture, false)) {
      return;
    }
    // the name flips to the nickname for the trainer's page, or shows the nickname steadily in a mode without one
    // (Orbit), the tile leaving its line to the strip either way; the lower block goes a page at a time
    if (flipsName(capture)) {
      add('names', grid, index, trainer
        ? <>
          <SpeciesLine capture={capture} />
          <NicknameLine capture={capture} />
          <SpeciesLine capture={capture} />
        </>
        : <NicknameLine capture={capture} />);
    }
    const number = dexNumber(capture.pokemon, activeDexView!);
    add('lower', grid, index, <>
      {strip.map((page, i) => <FacePageBlock capture={capture} key={i} number={number} page={page} />)}
    </>);
    if (hubAt >= 0) {
      const col = index % columns;
      const centre = grid * (BOX_WIDTH + BOX_GAP) + col * TILE_SIZE + (col > 0 ? 1 : 0) + (TILE_SIZE - (col > 0 ? 1 : 0)) / 2;
      const tileRow = Math.floor(index / columns);
      const slots = moons.get(tileRow) ?? Array.from({ length: HUB_SLOTS }, (): ReactNode[] => []);
      hubMoons(capture).forEach((node, k) => {
        if (node) {
          slots[k].push(<span className="hub-moon" key={`${grid}-${index}`} style={{ left: centre - 7, top: HUB_BALL_Y - 7 }}>{node}</span>);
        }
      });
      moons.set(tileRow, slots);
    }
  }));

  if (windows.size === 0) {
    return null;
  }

  // a row's moons in each slot, behind the balls or before them
  const moonGroups = (tileRow: number, side: 'back' | 'front') => moons.get(tileRow)?.map((slot, k) => slot.length > 0 && (
    <div className={`hub-moons ${side} slot-${k}`} key={`${side}-${k}`} style={{ top: `calc(${hubAt} * var(--flip-face))` }}>{slot}</div>
  ));

  return (
    // an absolutely positioned grid item's auto end line is the grid's far edge, so the span is spelled out
    <div className="flip-overlay" style={row === undefined ? undefined : { gridRow: `${row + 1} / span 1` }}>
      {/* a fixed order: moving a window restarts its strip's animation */}
      {[...windows].sort(([, a], [, b]) => a.row - b.row || LINE_ORDER[a.line] - LINE_ORDER[b.line]).map(([key, { line, row: tileRow, faces }]) => (
        <div className={`flip-window flip-${line}`} key={key} style={{ top: lineTop(line, tileRow) }}>
          <div className="flip-strip">
            {line === 'lower' && moonGroups(tileRow, 'back')}
            {faces}
            {line === 'lower' && moonGroups(tileRow, 'front')}
          </div>
        </div>
      ))}
    </div>
  );
}, sameGrids);
