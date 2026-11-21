import { canvas } from './texture';

import type { SceneMaker } from './scene';

// Game Boy 2's world: a route seen from above as a pocket game drew it, in a handheld's colour, every tile 16 of its
// pixels square and every pixel four of the window's. Short grass with its tufts, tall grass, round trees, a sandy
// path winding through, ponds with their banks and flowers by the way; the route scrolls slowly left a whole pixel at a
// time as the old screens did, the water's crests shifting a pixel now and then. Tiles are drawn once each (and once
// for each way water meets the land round it) and the route laid from them, so a frame is only a copy of it shifted
const TILE = 16;
const PIXEL = 4;
// pixels of the game a second
const SPEED = 4;

const C = {
  grass: '#8fd46c', grassDark: '#5aa64a', grassDeep: '#2f6a32',
  tall: '#4c9e3e', tallLight: '#86cf5a', tallDark: '#22562a',
  sand: '#eedc9c', sandDark: '#c9ae66', sandEdge: '#a8884a',
  water: '#4f9ae8', waterLight: '#a6d8ff', waterDark: '#2a5ca8', foam: '#e2f4ff',
  leaf: '#3f9a46', leafLight: '#7acb5a', leafDark: '#1f5a2c', outline: '#173a1e', trunk: '#8a5a2c', trunkDark: '#5a3818',
  red: '#f05a50', white: '#fff8f0', yellow: '#ffd84a',
};

type Kind = 'grass' | 'tall' | 'sand' | 'water' | 'tree' | 'flower';

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (x: number, y: number) => {
  const [x0, y0] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - x0, y - y0];
  const [sx, sy] = [fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)];
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

// what the route has at a tile: a path winding along it, ponds and stands of trees and tall grass either side
function kindAt (x: number, y: number, rows: number): Kind {
  const path = Math.round(rows * 0.5 + (smooth(x * 0.07, 3) - 0.5) * rows * 0.5);
  if (y === path || y === path + 1) {
    return 'sand';
  }
  const n = smooth(x * 0.16, y * 0.16 + 10);
  const m = smooth(x * 0.11 + 40, y * 0.14);
  if (Math.abs(y - path) > 2 && m < 0.3) {
    return 'water';
  }
  if (n > 0.66 || y <= 0 || y >= rows - 1) {
    return 'tree';
  }
  if (n < 0.3) {
    return 'tall';
  }
  return hash(x + 0.5, y + 0.5) < 0.07 ? 'flower' : 'grass';
}

// a tile drawn a pixel at a time; `land` for water says which sides meet land (up, right, down, left as bits 1 2 4 8)
function drawTile (kind: Kind, land: number, frame: number): HTMLCanvasElement {
  const [c, ctx] = canvas(TILE);
  const px = (x: number, y: number, colour: string, w = 1, h = 1) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  };
  const grassBase = () => {
    px(0, 0, C.grass, TILE, TILE);
    // two tufts, a little v of darker blades each
    for (const [x, y] of [[3, 4], [10, 11]]) {
      px(x, y, C.grassDark);
      px(x + 2, y, C.grassDark);
      px(x + 1, y + 1, C.grassDark);
    }
  };
  if (kind === 'grass') {
    grassBase();
  } else if (kind === 'flower') {
    grassBase();
    for (const [x, y, petal] of [[4, 5, C.red], [11, 10, C.white]] as [number, number, string][]) {
      px(x - 1, y, petal);
      px(x + 1, y, petal);
      px(x, y - 1, petal);
      px(x, y + 1, petal);
      px(x, y, C.yellow);
    }
  } else if (kind === 'tall') {
    px(0, 0, C.tall, TILE, TILE);
    // rows of blades, each a peak with a lit side and a shaded one
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * 4 + (row % 2) * 2;
        const y = row * 4;
        px(x + 1, y, C.tallLight);
        px(x, y + 1, C.tallLight);
        px(x + 2, y + 1, C.tallDark);
        px(x, y + 2, C.tallLight, 1, 1);
        px(x + 3, y + 2, C.tallDark, 1, 2);
      }
    }
  } else if (kind === 'sand') {
    px(0, 0, C.sand, TILE, TILE);
    for (const [x, y] of [[3, 3], [12, 6], [6, 12], [10, 14]]) {
      px(x, y, C.sandDark);
    }
  } else if (kind === 'tree') {
    grassBase();
    // a round crown with its outline, lit from the top left, on a short trunk
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const dx = x + 0.5 - 8;
        const dy = y + 0.5 - 7;
        const d = Math.hypot(dx, dy * 1.05);
        if (d < 7.5) {
          const light = (-dx - dy) / 7.5;
          px(x, y, d > 6.6 ? C.outline : light > 0.55 ? C.leafLight : light < -0.45 ? C.leafDark : C.leaf);
        }
      }
    }
    for (const [x, y] of [[5, 4], [9, 8], [6, 9]]) {
      px(x, y, C.leafDark);
      px(x + 1, y, C.leafDark);
    }
    px(6, 14, C.outline, 4, 2);
    px(7, 13, C.trunk, 2, 2);
    px(7, 14, C.trunkDark, 1, 1);
  } else {
    px(0, 0, C.water, TILE, TILE);
    // crests: short light strokes that shift a pixel each frame
    for (const [x, y] of [[2, 4], [9, 9], [4, 13]]) {
      px((x + frame) % (TILE - 4), y, C.waterLight, 3, 1);
    }
    // its banks: grass's edge, then a dark line where the water drops away and a pale line of foam
    const sides = [[0, 0, TILE, 1], [TILE - 1, 0, 1, TILE], [0, TILE - 1, TILE, 1], [0, 0, 1, TILE]];
    for (let s = 0; s < 4; s++) {
      if (land & (1 << s)) {
        const [x, y, w, h] = sides[s];
        const inX = s === 1 ? -1 : s === 3 ? 1 : 0;
        const inY = s === 0 ? 1 : s === 2 ? -1 : 0;
        px(x, y, C.grassDeep, w, h);
        px(x + inX, y + inY, C.waterDark, w, h);
        px(x + 2 * inX, y + 2 * inY, C.foam, w, h);
      }
    }
  }
  return c;
}

export const routeScene: SceneMaker = (back) => {
  const ctx = back.getContext('2d')!;
  const tiles = new Map<string, HTMLCanvasElement>();
  const tile = (kind: Kind, land: number, frame: number) => {
    const key = `${kind} ${land} ${frame}`;
    if (!tiles.has(key)) {
      tiles.set(key, drawTile(kind, land, frame));
    }
    return tiles.get(key)!;
  };
  let [cols, rows, scale] = [0, 0, PIXEL];
  // the route laid a screen and a tile wide, redrawn when it has moved a whole tile on or the water's crests shift
  const [map, mctx] = canvas(1);
  let laid = '';

  const lay = (first: number, frame: number) => {
    const key = `${first} ${frame}`;
    if (key === laid) {
      return;
    }
    laid = key;
    for (let x = 0; x <= cols; x++) {
      for (let y = 0; y < rows; y++) {
        const kind = kindAt(first + x, y, rows);
        let land = 0;
        if (kind === 'water') {
          [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy], s) => {
            if (kindAt(first + x + dx, y + dy, rows) !== 'water') {
              land |= 1 << s;
            }
          });
        }
        mctx.drawImage(tile(kind, land, kind === 'water' ? frame : 0), x * TILE, y * TILE);
      }
    }
  };

  return {
    resize (width, height, dpr) {
      back.width = Math.round(width * dpr);
      back.height = Math.round(height * dpr);
      scale = PIXEL * dpr;
      cols = Math.ceil(back.width / (TILE * scale)) + 1;
      rows = Math.ceil(back.height / (TILE * scale));
      map.width = (cols + 1) * TILE;
      map.height = rows * TILE;
      laid = '';
    },
    draw (t) {
      const along = Math.floor(t * SPEED);
      const first = Math.floor(along / TILE);
      lay(first, Math.floor(t * 1.5) % (TILE - 4));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(map, -(along % TILE) * scale, 0, map.width * scale, map.height * scale);
    },
    dispose () {
      tiles.clear();
    },
  };
};
