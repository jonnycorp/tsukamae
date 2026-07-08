'use strict';

// Dev-only script: snapshots the structure of every supported living dex
// (plus the games and dex-type catalogs) from the live pokedextracker.com API
// into static JSON files in data/. All personal progress is stripped —
// data/dexes/*/pokemon.json only describes dex structure, so a fresh clone
// always starts with an empty tracker.
//
// The pokedextracker API only exposes a dex's pokemon list through a user's
// dex, so each catalog entry is snapshotted from the site's own example
// account (ashketchum10 — the dexes linked on the original home page). The
// example account has one dex per published dex type; old-gen "Full National"
// dexes have no example dex and are deliberately not bundled (they're
// effectively uncompletable due to event-exclusive mons).
//
// To bundle another dex (e.g. when a new generation lands), add an entry to
// DEX_MANIFEST and rerun: yarn dataset

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_HOST = 'https://pokedextracker.com/api';
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const EXAMPLE_USER = 'ashketchum10';

// Ordered newest-generation-first; this order is preserved in the in-app
// catalog picker. `key` names the data/dexes/<key>/ folder and is referenced
// by saved progress files — never rename a key once released.
const DEX_MANIFEST = [
  { key: 'home-national', slug: 'home-national-living-dex', name: 'HOME National Dex' },
  { key: 'home-national-gigantamax', slug: 'shinies', name: 'HOME National Dex + Gigantamax Forms' },
  { key: 'paldea-full', slug: 'scarlet-expansion-living-dex', name: 'Scarlet & Violet Full Paldea Dex (with DLC)' },
  { key: 'kitakami', slug: 'scarlet-kitakami-living-dex', name: 'Scarlet & Violet Kitakami Dex (The Teal Mask)' },
  { key: 'blueberry', slug: 'scarlet-blueberry-living-dex', name: 'Scarlet & Violet Blueberry Dex (The Indigo Disk)' },
  { key: 'scarlet-violet-regional', slug: 'scarlet-regional-living-dex', name: 'Scarlet & Violet Regional Dex' },
  { key: 'legends-arceus-regional', slug: 'legends-arceus-regional-living-dex', name: 'Legends: Arceus Regional Dex' },
  { key: 'bdsp-regional', slug: 'brilliant-diamond-regional-living-dex', name: 'Brilliant Diamond & Shining Pearl Regional Dex' },
  { key: 'bdsp-national', slug: 'brilliant-diamond-national-living-dex', name: 'Brilliant Diamond & Shining Pearl National Dex' },
  { key: 'sword-shield-expansion-regional', slug: 'sword-expansion-pass-regional-living-dex', name: 'Sword & Shield (Expansion Pass) Regional Dex' },
  { key: 'sword-shield-regional', slug: 'sword-regional-living-dex', name: 'Sword & Shield Regional Dex' },
  { key: 'sword-shield-national', slug: 'sword-national-living-dex', name: 'Sword & Shield Full National Dex' },
  { key: 'lets-go-regional', slug: 'lets-go-pikachu-regional-living-dex', name: 'Let’s Go, Pikachu & Eevee Regional Dex' },
  { key: 'ultra-sun-ultra-moon-regional', slug: 'ultra-sun-regional-living-dex', name: 'Ultra Sun & Ultra Moon Regional Dex' },
  { key: 'sun-moon-regional', slug: 'sun-regional-living-dex', name: 'Sun & Moon Regional Dex' },
  { key: 'oras-regional', slug: 'omega-ruby-regional-living-dex', name: 'Omega Ruby & Alpha Sapphire Regional Dex' },
  { key: 'x-y-regional', slug: 'x-regional-living-dex', name: 'X & Y Regional Dex' },
];

async function get (path) {
  const response = await fetch(API_HOST + path);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return response.json();
}

const [games, dexTypes] = await Promise.all([get('/games'), get('/dex-types')]);

// Curate the games list into "Caught In" dropdown options: where a mon was
// caught from. Expansion-pass entries are redundant as catch sources, and the
// API has no concept of Pokémon GO or traded mons, so those are appended.
const EXTRA_ORIGINS = [
  { id: 'go', name: 'Pokémon GO' },
  { id: 'trade', name: 'Trade (stranger)' },
  { id: 'other', name: 'Other' },
];
const origins = games
  .filter((game) => !game.id.endsWith('_expansion_pass'))
  .map((game) => ({ id: game.id, name: game.name }))
  .concat(EXTRA_ORIGINS);

await mkdir(DATA_DIR, { recursive: true });
await writeFile(join(DATA_DIR, 'games.json'), JSON.stringify(origins, null, 2));
await writeFile(join(DATA_DIR, 'dex-types.json'), JSON.stringify(dexTypes, null, 2));
console.log(`Wrote ${origins.length} origin games to data/games.json`);
console.log(`Wrote ${dexTypes.length} dex types to data/dex-types.json`);

for (const { key, slug, name } of DEX_MANIFEST) {
  const [dex, captures] = await Promise.all([
    get(`/users/${EXAMPLE_USER}/dexes/${slug}`),
    get(`/users/${EXAMPLE_USER}/dexes/${slug}/captures`),
  ]);

  // Strip all personal progress: keep only the ordered pokemon structure.
  const pokemon = captures.map((capture) => capture.pokemon);

  // Shininess is a display flag on the user's own dex in this app, not a
  // property of the catalog entry (the example account's "shinies" dex is
  // only used for its Gigantamax-forms structure).
  const meta = {
    key,
    name,
    game: dex.game,
    dex_type: dex.dex_type,
    total: dex.total,
  };

  const dir = join(DATA_DIR, 'dexes', key);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(join(dir, 'pokemon.json'), JSON.stringify(pokemon));
  console.log(`Wrote ${pokemon.length} pokemon to data/dexes/${key}/ (dex total: ${dex.total})`);
}
