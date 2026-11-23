'use strict';

// dev-only (yarn sprites:forms): the icons pokesprite has and the sheet lacks, cut into cells after its last, with their
// rules in styles/pokesprite.scss. Forms a look can wear (Pikachu's caps, Arceus's and Silvally's types, the riders),
// the female icons a female record shows (utils/pokemon iconClass), shinies the sheet never had, and a few it drew
// wrong. The sheet's icons are pokesprite's recoloured (outlines lifted off black, shades retouched), so each species'
// new icons take the colours its own base icon took. The sheet is written under the next version's name, the old one
// removed; run yarn sprites:themes and yarn sprites:fit after. A rerun adds nothing the sheet already has

import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decode, encode } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = join(ROOT, 'app', 'styles', 'pokesprite.scss');
// the other files that name the sheet, renamed with it
const NAMED_IN = ['app/components/pages/Tracker/views/sprite-atlas.ts', 'electron/main.js', 'README.md'];
const SOURCE = 'https://raw.githubusercontent.com/msikma/pokesprite/master';
const GEN7 = 'pokemon-gen7x';
const GEN8 = 'pokemon-gen8';
// the sheet's grid: an icon a cell, cut to the mon at its top left
const CELL_WIDTH = 67;
const CELL_HEIGHT = 56;
const CONCURRENCY = 8;

const TYPES = ['bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'poison', 'psychic', 'rock', 'steel', 'water'];
const CREAMS = ['vanilla-cream', 'ruby-cream', 'matcha-cream', 'mint-cream', 'lemon-cream', 'salted-cream', 'ruby-swirl', 'caramel-swirl', 'rainbow-swirl'];
const SWEETS = ['berry', 'love', 'star', 'clover', 'flower', 'ribbon'];

// by species: its name in pokesprite; forms to add, each in both colours, named as pokesprite names them (the sheet's
// strawberry Alcremie go by cream alone, as they did); a female icon in both colours; shinies of icons the sheet has
// only in regular colours, by the sheet's form ('' for none) to pokesprite's; and shinies it drew wrong, drawn again
// (Castform's weathers and Magearna were copies of their regular icons, Hippopotas and Hippowdon their female ones).
// Gen 7 and older from the set the sheet's own came from, the rest (and the Origin formes, only there) from gen 8's
const SPECIES = [
  { national: 25, slug: 'pikachu', forms: ['original-cap', 'hoenn-cap', 'sinnoh-cap', 'unova-cap', 'kalos-cap', 'alola-cap', 'partner-cap', 'world-cap', 'starter'], female: true },
  { national: 133, slug: 'eevee', forms: ['starter'] },
  { national: 172, slug: 'pichu', forms: ['spiky-eared'] },
  { national: 202, slug: 'wobbuffet', female: true },
  { national: 351, slug: 'castform', redraw: ['rainy', 'snowy', 'sunny'] },
  { national: 449, slug: 'hippopotas', female: true, redraw: [''] },
  { national: 450, slug: 'hippowdon', female: true, redraw: [''] },
  { national: 483, slug: 'dialga', forms: ['origin'], set: GEN8 },
  { national: 484, slug: 'palkia', forms: ['origin'], set: GEN8 },
  { national: 493, slug: 'arceus', forms: TYPES },
  { national: 521, slug: 'unfezant', female: true },
  { national: 592, slug: 'frillish', female: true },
  { national: 593, slug: 'jellicent', female: true },
  { national: 649, slug: 'genesect', forms: ['burn', 'chill', 'douse', 'shock'] },
  { national: 658, slug: 'greninja', forms: ['ash'] },
  { national: 668, slug: 'pyroar', female: true },
  { national: 678, slug: 'meowstic', female: true },
  { national: 718, slug: 'zygarde', forms: ['10', 'complete'] },
  { national: 741, slug: 'oricorio', forms: ['pom-pom', 'pau', 'sensu'] },
  { national: 745, slug: 'lycanroc', forms: ['midnight', 'dusk'] },
  { national: 746, slug: 'wishiwashi', forms: ['school'] },
  { national: 773, slug: 'silvally', forms: TYPES },
  { national: 774, slug: 'minior', forms: ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] },
  { national: 800, slug: 'necrozma', forms: ['dusk', 'dawn', 'ultra'] },
  { national: 801, slug: 'magearna', redraw: [''] },
  { national: 845, slug: 'cramorant', shinies: { gulping: 'gulping', gorging: 'gorging' } },
  { national: 869, slug: 'alcremie', forms: CREAMS.flatMap((cream) => SWEETS.map((sweet) => `${cream}-${sweet}`)) },
  { national: 876, slug: 'indeedee', female: true },
  { national: 891, slug: 'kubfu', shinies: { '': '' } },
  // its Rapid Strike icon is its Single Strike one, in pokesprite as in the sheet
  { national: 892, slug: 'urshifu', shinies: { '': '', rapid: '', gigantamax: 'gmax', 'rapid-gigantamax': 'rapid-strike-gmax' } },
  { national: 893, slug: 'zarude', forms: ['dada'] },
  { national: 898, slug: 'calyrex', forms: ['ice-rider', 'shadow-rider'] },
  { national: 902, slug: 'basculegion', female: true },
];

const pad = (national) => String(national).padStart(3, '0');
const setOf = (species) => species.set ?? (species.national <= 809 ? GEN7 : GEN8);
const iconPath = (species, form, shiny, female = false) =>
  `${setOf(species)}/${shiny ? 'shiny' : 'regular'}/${female ? 'female/' : ''}${species.slug}${form ? `-${form}` : ''}.png`;

// ---- images: RGBA, cut to what they draw

const crop = ({ width, pixels }, x, y, w, h) => {
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    pixels.copy(out, row * w * 4, ((y + row) * width + x) * 4, ((y + row) * width + x + w) * 4);
  }
  return { width: w, height: h, pixels: out };
};

function trim (image) {
  const { width, height, pixels } = image;
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0 ? null : crop(image, left, top, right - left + 1, bottom - top + 1);
}

const sameImage = (a, b) => a.width === b.width && a.height === b.height && a.pixels.equals(b.pixels);

// ---- pokesprite's icons, fetched once each

const downloads = new Map();
function fetchIcon (path) {
  if (!downloads.has(path)) {
    downloads.set(path, (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`${SOURCE}/${path}`);
          if (res.status === 404) {
            return null;
          }
          if (!res.ok) {
            throw new Error(`GET ${path} failed with ${res.status}`);
          }
          const image = decode(Buffer.from(await res.arrayBuffer()));
          if (!image) {
            throw new Error(`${path}: not a PNG this can read`);
          }
          return trim(image);
        } catch (error) {
          if (attempt === 3) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
        }
      }
    })());
  }
  return downloads.get(path);
}

async function inBatches (items, work) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await work(items[i]);
    }
  }));
  return results;
}

// ---- the sheet and its rules

const styles = readFileSync(STYLES, 'utf8');
const named = /url\('\/(pokesprite-v(\d+)\.png)'\)/.exec(styles);
if (!named) {
  throw new Error('pokesprite.scss names no pokesprite-vN.png');
}
const [, oldName, version] = named;
const newName = `pokesprite-v${Number(version) + 1}.png`;
const sheet = decode(join(ROOT, 'public', oldName));
if (!sheet) {
  throw new Error(`${oldName}: not a PNG this can read`);
}
const columns = sheet.width / CELL_WIDTH;

const RULE = /^(\.pkicon[^ ]*\.pkicon-\d+) \{ width: (\d+)px; height: (\d+)px; background-position: (-?\d+)px (-?\d+)px; \}$/;
const lines = styles.split('\n');
// each rule's cell, by its selector; a cell drawn here carries its image
const rules = new Map();
let lastCell = -1;
lines.forEach((line, at) => {
  const match = RULE.exec(line);
  if (match) {
    const [, selector, w, h, x, y] = match;
    const cell = { x: -Number(x), y: -Number(y), w: Number(w), h: Number(h), at };
    if (cell.x % CELL_WIDTH || cell.y % CELL_HEIGHT) {
      throw new Error(`${selector} sits off the sheet's grid`);
    }
    rules.set(selector, cell);
    lastCell = Math.max(lastCell, (cell.y / CELL_HEIGHT) * columns + cell.x / CELL_WIDTH);
  }
});
// the sheet's cells as they were, any of which a new icon the same can share (a female icon a shiny was drawn as)
const sheetCells = [...rules].map(([selector, { x, y, w, h }]) => ({ selector, x, y, w, h, image: crop(sheet, x, y, w, h) }));
const cellOf = (selector) => {
  const cell = rules.get(selector);
  return cell && (cell.image ?? crop(sheet, cell.x, cell.y, cell.w, cell.h));
};

// ---- what to add or draw again, each from its file in pokesprite

const jobs = [];
for (const species of SPECIES) {
  const n = pad(species.national);
  const add = (selector, form, shiny, female = false) => {
    if (!rules.has(selector)) {
      jobs.push({ species, selector, shiny, female, path: iconPath(species, form, shiny, female) });
    }
  };
  // first, as a species' base shiny is what its other shinies take their colours from
  for (const form of species.redraw ?? []) {
    jobs.push({ species, selector: `.pkicon${form ? `.form-${form}` : ''}.color-shiny.pkicon-${n}`, shiny: true, redraw: true, base: !form, path: iconPath(species, form, true) });
  }
  for (const form of species.forms ?? []) {
    add(`.pkicon.form-${form}.pkicon-${n}`, form, false);
    add(`.pkicon.form-${form}.color-shiny.pkicon-${n}`, form, true);
  }
  if (species.female) {
    add(`.pkicon.gender-female.pkicon-${n}`, '', false, true);
    add(`.pkicon.gender-female.color-shiny.pkicon-${n}`, '', true, true);
  }
  for (const [form, file] of Object.entries(species.shinies ?? {})) {
    add(`.pkicon${form ? `.form-${form}` : ''}.color-shiny.pkicon-${n}`, file, true);
  }
}

// a species' colours in the sheet, from its base icon in each: each of pokesprite's colours to the one the sheet drew
// most where pokesprite drew it. None where the two aren't one drawing (the sheet's Dialga is gen 7's, its Origin forme
// gen 8's)
async function recolourOf (species, shiny) {
  const theirs = await fetchIcon(iconPath(species, '', shiny));
  const ours = cellOf(`.pkicon${shiny ? '.color-shiny' : ''}.pkicon-${pad(species.national)}`);
  if (!theirs || !ours || theirs.width !== ours.width || theirs.height !== ours.height) {
    return new Map();
  }
  const votes = new Map();
  let disagree = 0;
  for (let o = 0; o < theirs.pixels.length; o += 4) {
    const from = theirs.pixels.readUInt32BE(o);
    const to = ours.pixels.readUInt32BE(o);
    if ((from & 0xff) === 0 || (to & 0xff) === 0) {
      disagree += (from & 0xff) === (to & 0xff) ? 0 : 1;
      continue;
    }
    const tally = votes.get(from) ?? new Map();
    tally.set(to, (tally.get(to) ?? 0) + 1);
    votes.set(from, tally);
  }
  if (disagree > theirs.width * theirs.height / 50) {
    return new Map();
  }
  return new Map([...votes].map(([from, tally]) => [from, [...tally].sort((a, b) => b[1] - a[1])[0][0]]));
}
const palettes = new Map();
const paletteFor = (species, shiny) => {
  const key = `${species.national}-${shiny}`;
  if (!palettes.has(key)) {
    palettes.set(key, recolourOf(species, shiny));
  }
  return palettes.get(key);
};

function recolour (image, colours) {
  const pixels = Buffer.from(image.pixels);
  for (let o = 0; o < pixels.length; o += 4) {
    const from = pixels.readUInt32BE(o);
    if ((from & 0xff) > 0 && colours.has(from)) {
      pixels.writeUInt32BE(colours.get(from), o);
    }
  }
  return { ...image, pixels };
}

console.log(`Fetching ${jobs.length} icons from pokesprite...`);
const icons = await inBatches(jobs, (job) => fetchIcon(job.path));

// each icon in a cell of its own, or one it shares: another new one the same (Alcremie's shinies are one per sweet,
// whatever the cream), or one of its species' in the sheet. A base shiny drawn again takes the regular icon's colours,
// the sheet's own shiny being the wrong one
const cells = [];
const added = [];
const redrawn = new Map();
const missing = [];
for (const [i, job] of jobs.entries()) {
  if (!icons[i]) {
    missing.push(job.path);
    continue;
  }
  const image = recolour(icons[i], await paletteFor(job.species, job.shiny && !job.base));
  if (image.width > CELL_WIDTH || image.height > CELL_HEIGHT) {
    throw new Error(`${job.path}: ${image.width}x${image.height} is past a cell's ${CELL_WIDTH}x${CELL_HEIGHT}`);
  }
  if (job.redraw && sameImage(cellOf(job.selector), image)) {
    continue;
  }
  const n = pad(job.species.national);
  let cell = sheetCells.find((other) => other.selector.endsWith(`.pkicon-${n}`) && sameImage(other.image, image)) ??
    cells.find((other) => sameImage(other.image, image));
  if (!cell) {
    const index = lastCell + 1 + cells.length;
    cell = { image, x: (index % columns) * CELL_WIDTH, y: Math.floor(index / columns) * CELL_HEIGHT, w: image.width, h: image.height };
    cells.push(cell);
  }
  if (job.redraw) {
    const { at } = rules.get(job.selector);
    rules.set(job.selector, { ...cell, image, at });
    redrawn.set(at, job.selector);
  } else {
    added.push({ job, cell });
  }
}
if (added.length === 0 && redrawn.size === 0) {
  console.log('The sheet has every icon listed; nothing to add.');
  process.exit(0);
}

// ---- the sheet, grown by the rows the new cells take

const rows = Math.ceil((lastCell + 1 + cells.length) / columns);
const height = Math.max(sheet.height, rows * CELL_HEIGHT);
const pixels = Buffer.alloc(sheet.width * height * 4);
sheet.pixels.copy(pixels);
for (const { image, x, y } of cells) {
  for (let row = 0; row < image.height; row++) {
    image.pixels.copy(pixels, ((y + row) * sheet.width + x) * 4, row * image.width * 4, (row + 1) * image.width * 4);
  }
}
writeFileSync(join(ROOT, 'public', newName), encode({ width: sheet.width, height, pixels }));
rmSync(join(ROOT, 'public', oldName));

// ---- the rules: one drawn again where it was, a female one first in its species' run (a Legends: Arceus icon after
// it wins over it, as that dex's look), the rest last (a form over the Legends: Arceus icon, as a look picked)

const ruleLine = (selector, { x, y, w, h }) =>
  `${selector} { width: ${w}px; height: ${h}px; background-position: ${x ? `-${x}` : '0'}px ${y ? `-${y}` : '0'}px; }`;
const before = new Map();
const after = new Map();
for (const { job, cell } of added) {
  const n = pad(job.species.national);
  const run = [...rules].filter(([selector]) => selector.endsWith(`.pkicon-${n}`)).map(([, rule]) => rule.at);
  if (run.length === 0 || Math.max(...run) - Math.min(...run) !== run.length - 1) {
    throw new Error(`pokesprite.scss has no single run of rules for ${n}`);
  }
  const [at, list] = job.female ? [Math.min(...run), before] : [Math.max(...run), after];
  list.set(at, [...(list.get(at) ?? []), ruleLine(job.selector, cell)]);
}
const out = lines.flatMap((line, at) => [
  ...(before.get(at) ?? []),
  redrawn.has(at) ? ruleLine(redrawn.get(at), rules.get(redrawn.get(at))) : line,
  ...(after.get(at) ?? []),
]);
writeFileSync(STYLES, out.join('\n').replaceAll(oldName, newName));
for (const file of NAMED_IN) {
  const path = join(ROOT, file);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll(oldName, newName));
}

console.log(`${added.length} rules added and ${redrawn.size} drawn again, in ${cells.length} new cells: public/${newName} (${sheet.width}x${height}), ${oldName} removed`);
if (missing.length > 0) {
  console.warn(`Not in pokesprite, skipped:\n  ${missing.join('\n  ')}`);
}
console.log('Now run yarn sprites:themes and yarn sprites:fit.');
