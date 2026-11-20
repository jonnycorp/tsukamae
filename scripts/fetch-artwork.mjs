'use strict';

// dev-only, and never committed (public/artwork/ is ignored): the official artwork for every mon the dexes list, from
// PokéAPI's sprites repository, for the review's art lens (lab/LabLensArt.tsx). Saved as public/artwork/<national>.png,
// a regional form as <national>-<form>.png; with --shiny, the shiny artwork too, under public/artwork/shiny/. Every
// other variety of those species too (megas, Gigantamax, the rest), as <national>-<variety>.png (6-mega-x, 6-gmax),
// listed by species in public/artwork/forms.json. A file already there is kept, so a run after a new season or
// generation fetches only what's new

import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEXES_DIR = join(ROOT, 'data', 'dexes');
const OUT_DIR = join(ROOT, 'public', 'artwork');
const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv';
const ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const REGIONAL = new Set(['alola', 'galar', 'hisui', 'paldea']);
const CONCURRENCY = 12;
const SHINY = process.argv.includes('--shiny');

const exists = (path) => access(path).then(() => true, () => false);

console.log('Fetching PokéAPI\'s pokemon table...');
const response = await fetch(CSV);
if (!response.ok) {
  throw new Error(`GET pokemon.csv failed with ${response.status}`);
}
const [header, ...rows] = (await response.text()).trim().split(/\r?\n/);
const keys = header.split(',');
const varieties = rows.map((row) => Object.fromEntries(row.split(',').map((value, i) => [keys[i], value])));

// a species' default variety, or its regional form's (the first, where a form has several)
function varietyOf (national, form) {
  const list = varieties.filter((variety) => variety.species_id === String(national)).sort((a, b) => Number(a.id) - Number(b.id));
  if (!form || !REGIONAL.has(form)) {
    return list.find((variety) => variety.is_default === '1');
  }
  return list.find((variety) => variety.identifier.includes(`-${form}`));
}

// every mon (species and regional form) any dex lists
const wanted = new Map();
for (const entry of await readdir(DEXES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }
  const pokemon = JSON.parse(await readFile(join(DEXES_DIR, entry.name, 'pokemon.json'), 'utf8'));
  for (const mon of pokemon) {
    const form = mon.form && REGIONAL.has(mon.form) ? mon.form : null;
    const name = form ? `${mon.national_id}-${form}` : String(mon.national_id);
    if (!wanted.has(name)) {
      wanted.set(name, { national: mon.national_id, form, label: mon.name });
    }
  }
}

// a variety's own part of its name, past what it shares with its species' default (charizard-mega-x: mega-x)
function suffixOf (variety, base) {
  const own = variety.identifier.split('-');
  const shared = base.identifier.split('-');
  let i = 0;
  while (i < own.length && own[i] === shared[i]) {
    i++;
  }
  return own.slice(Math.max(1, i)).join('-');
}

const jobs = [];
for (const national of new Set([...wanted.values()].map((mon) => mon.national))) {
  const list = varieties.filter((variety) => variety.species_id === String(national));
  const base = list.find((variety) => variety.is_default === '1');
  for (const variety of list) {
    if (variety === base) {
      continue;
    }
    const form = suffixOf(variety, base);
    if (REGIONAL.has(form)) {
      continue;
    }
    const job = { url: `${ART}/${variety.id}.png`, path: join(OUT_DIR, `${national}-${form}.png`), national, form };
    jobs.push(job);
    if (SHINY) {
      jobs.push({ url: `${ART}/shiny/${variety.id}.png`, path: join(OUT_DIR, 'shiny', `${national}-${form}.png`) });
    }
  }
}
for (const [name, mon] of wanted) {
  const variety = varietyOf(mon.national, mon.form);
  if (!variety) {
    console.warn(`  no PokéAPI variety for ${mon.label}${mon.form ? ` (${mon.form})` : ''}, skipped`);
    continue;
  }
  jobs.push({ url: `${ART}/${variety.id}.png`, path: join(OUT_DIR, `${name}.png`) });
  if (SHINY) {
    jobs.push({ url: `${ART}/shiny/${variety.id}.png`, path: join(OUT_DIR, 'shiny', `${name}.png`) });
  }
}

await mkdir(join(OUT_DIR, 'shiny'), { recursive: true });
const todo = [];
for (const job of jobs) {
  if (!(await exists(job.path))) {
    todo.push(job);
  }
}
console.log(`${jobs.length - todo.length} already here, fetching ${todo.length}...`);

let done = 0;
const failed = [];
let cursor = 0;
async function worker () {
  while (cursor < todo.length) {
    const job = todo[cursor++];
    const res = await fetch(job.url);
    if (res.ok) {
      await writeFile(job.path, Buffer.from(await res.arrayBuffer()));
    } else {
      failed.push(`${job.url} (${res.status})`);
    }
    if (++done % 100 === 0) {
      console.log(`  ${done}/${todo.length}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// the forms list: every other variety whose art is here
const forms = {};
for (const job of jobs) {
  if (job.form && (await exists(job.path))) {
    (forms[job.national] ??= []).push(job.form);
  }
}
await writeFile(join(OUT_DIR, 'forms.json'), JSON.stringify(forms));

console.log(`Done: ${todo.length - failed.length} saved to public/artwork/.`);
if (failed.length > 0) {
  console.warn(`${failed.length} not found:\n  ${failed.join('\n  ')}`);
}
