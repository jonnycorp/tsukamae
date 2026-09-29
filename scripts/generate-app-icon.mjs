'use strict';

// dev-only: writes the app icon (electron/icon.ico for Windows, electron/icon.png for macOS) from upstream's pixel-art
// Poké Ball, the red-and-white original of the landing page's logo

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'electron');

// upstream pokedextracker's public/pokeball.svg, cell for cell: its shapes all sit on a 16-cell grid
const ART = [
  '................',
  '......####......',
  '....##pRRR##....',
  '...#ppppRRRR#...',
  '..#RppppRRRRR#..',
  '..#RRppRRRRRR#..',
  '.#RRRRRRRRRRRR#.',
  '.#RRRRRRRRRRRR#.',
  '.#dRRRR##RRRRd#.',
  '.#wdRR#WW#RRdw#.',
  '..#wdd#WW#ddw#..',
  '..#wwww##wwww#..',
  '...#wwwwwwww#...',
  '....##wwww##....',
  '......####......',
  '................',
];
const PALETTE = {
  '#': [0x30, 0x30, 0x30],
  R: [0xff, 0x00, 0x00],
  p: [0xff, 0x7d, 0x81],
  W: [0xff, 0xff, 0xff],
  w: [0xd1, 0xcf, 0xd8],
  d: [0x51, 0x4f, 0x60],
};
const CELLS = ART.length;

// the cell each output pixel shows along one axis; whole multiples of the grid scale it evenly
function cellsFor (size) {
  if (size % CELLS === 0) {
    return Array.from({ length: size }, (_, i) => Math.floor(i / (size / CELLS)));
  }
  if (size !== 24) {
    throw new Error(`no pixel mapping for ${size}px`);
  }
  // 24px can't scale 16 cells evenly: the margins stay one pixel, and cells 2, 4, 6 and 7 of each half are doubled,
  // mirrored, which keeps the ball round and its button centred
  const half = [0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7];
  return [...half, ...half.map((cell) => CELLS - 1 - cell).reverse()];
}

function render (size) {
  const cells = cellsFor(size);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = PALETTE[ART[cells[y]][cells[x]]];
      if (color) {
        pixels.set([...color, 255], (y * size + x) * 4);
      }
    }
  }
  return { size, pixels };
}

function png ({ size, pixels }) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  // 8-bit RGBA
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// every size as a classic 32-bit bitmap with its 1-bit mask, which everything that reads .ico accepts (NSIS included)
function bitmap ({ size, pixels }) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  // colour rows and mask rows together
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const color = Buffer.alloc(size * size * 4);
  const maskStride = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskStride * size);
  for (let y = 0; y < size; y++) {
    // bottom-up, BGRA
    const row = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4);
      color.set([b, g, r, a], (row * size + x) * 4);
      if (a === 0) {
        mask[row * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return Buffer.concat([header, color, mask]);
}

function ico (images) {
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);
  const entries = images.map(bitmap);
  let offset = directory.length;
  images.forEach(({ size }, i) => {
    const at = 6 + 16 * i;
    // 0 stands for 256
    directory[at] = size % 256;
    directory[at + 1] = size % 256;
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(entries[i].length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entries[i].length;
  });
  return Buffer.concat([directory, ...entries]);
}

writeFileSync(join(OUT_DIR, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256].map(render)));
// electron-builder makes the macOS .icns from this
writeFileSync(join(OUT_DIR, 'icon.png'), png(render(1024)));
console.log('Wrote electron/icon.ico and electron/icon.png');
