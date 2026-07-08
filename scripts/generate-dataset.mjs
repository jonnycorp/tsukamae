'use strict';

// Dev-only script: snapshots the structure of a national living dex (plus the
// games list) from the live pokedextracker.com API into static JSON files in
// data/. All personal progress is stripped — data/dex.json only describes the
// dex structure, so a fresh clone always starts with an empty tracker.
//
// Usage: node scripts/generate-dataset.mjs [username] [slug]
// Defaults to the public example dex used on the original site's home page.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_HOST = 'https://pokedextracker.com/api';
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

const username = process.argv[2] || 'ashketchum10';
const slug = process.argv[3] || 'home-national-living-dex';

async function get (path) {
  const response = await fetch(API_HOST + path);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return response.json();
}

const [dex, captures, games] = await Promise.all([
  get(`/users/${username}/dexes/${slug}`),
  get(`/users/${username}/dexes/${slug}/captures`),
  get('/games'),
]);

// Strip all personal progress: keep only the ordered pokemon structure.
const pokemon = captures.map((capture) => capture.pokemon);

// Curate the games list into origin-dropdown options: where a mon currently
// lives. Expansion-pass entries are redundant as origins, and the API has no
// concept of Pokémon GO or traded mons, so those are appended manually.
const EXTRA_ORIGINS = [
  { id: 'go', name: 'Pokémon GO' },
  { id: 'trade', name: 'Trade (stranger)' },
  { id: 'other', name: 'Other' },
];
const origins = games
  .filter((game) => !game.id.endsWith('_expansion_pass'))
  .map((game) => ({ id: game.id, name: game.name }))
  .concat(EXTRA_ORIGINS);

const meta = {
  title: dex.title,
  slug: dex.slug,
  shiny: dex.shiny,
  game: dex.game,
  dex_type: dex.dex_type,
  regional: dex.regional,
  total: dex.total,
};

await mkdir(DATA_DIR, { recursive: true });
await writeFile(join(DATA_DIR, 'dex.json'), JSON.stringify(pokemon));
await writeFile(join(DATA_DIR, 'dex-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
await writeFile(join(DATA_DIR, 'games.json'), JSON.stringify(origins, null, 2));

console.log(`Wrote ${pokemon.length} pokemon to data/dex.json (dex total: ${dex.total})`);
console.log(`Wrote ${origins.length} origin games to data/games.json`);
console.log('Wrote data/dex-meta.json');
