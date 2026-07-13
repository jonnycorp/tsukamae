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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_HOST = 'https://pokedextracker.com/api';
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const EXAMPLE_USER = 'ashketchum10';

// --pokeapi-only: regenerate just the PokéAPI-sourced dexes below, without
// re-snapshotting the pokedextracker catalogs (avoids upstream drift).
const POKEAPI_ONLY = process.argv.includes('--pokeapi-only');

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

const [apiGames, dexTypes] = await Promise.all([get('/games'), get('/dex-types')]);

// Games pokedextracker doesn't know about (site development stalled after SV).
// Shaped like real API game objects so PokéAPI-sourced dexes can use them as
// `meta.game`; also injected into the origins list so full reruns keep them.
const SYNTHETIC_GAMES = [
  {
    id: 'legends_za',
    name: 'Legends: Z-A',
    game_family: {
      id: 'legends_za',
      generation: 9,
      regional_total: 0,
      national_total: 0,
      regional_support: false,
      national_support: false,
      order: 24,
      published: true,
    },
    order: 42,
  },
];

// Newest first: synthetic games slot in right after HOME.
const games = [...apiGames];
games.splice(1, 0, ...SYNTHETIC_GAMES);

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
if (!POKEAPI_ONLY) {
  await writeFile(join(DATA_DIR, 'games.json'), JSON.stringify(origins, null, 2));
  await writeFile(join(DATA_DIR, 'dex-types.json'), JSON.stringify(dexTypes, null, 2));
  console.log(`Wrote ${origins.length} origin games to data/games.json`);
  console.log(`Wrote ${dexTypes.length} dex types to data/dex-types.json`);
}

for (const { key, slug, name } of POKEAPI_ONLY ? [] : DEX_MANIFEST) {
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

// --- PokéAPI-sourced dexes --------------------------------------------------
// pokedextracker never published these dexes, but its games catalog already
// carries the game, so `game`/`game_family` stay real API objects. Only the
// ordered species list comes from PokéAPI; per-mon fields (name, name_ja,
// debut game_family) are joined from the bundled home-national dex, and
// species-level entries use id = national_id (pokedextracker's convention).

const POKEAPI_HOST = 'https://pokeapi.co/api/v2';

// Synthetic dex_type ids start at 100, far above pokedextracker's own (≤ 22).
const POKEAPI_DEX_MANIFEST = [
  {
    key: 'legends-z-a-regional',
    pokedex: 'lumiose-city',
    gameId: 'legends_za',
    name: 'Legends: Z-A Lumiose City Dex',
    dexType: { id: 100, name: 'Lumiose City', description: 'Lumiose City dex only' },
  },
  {
    key: 'legends-z-a-mega-dimension',
    pokedex: 'hyperspace',
    gameId: 'legends_za',
    name: 'Legends: Z-A Mega Dimension Dex (DLC)',
    dexType: { id: 101, name: 'Mega Dimension', description: 'Mega Dimension dex only' },
  },
];

async function getPokeapi (path) {
  const response = await fetch(POKEAPI_HOST + path);
  if (!response.ok) {
    throw new Error(`GET ${POKEAPI_HOST}${path} failed with ${response.status}`);
  }
  return response.json();
}

const speciesByNationalId = new Map();
const homeNational = JSON.parse(await readFile(join(DATA_DIR, 'dexes', 'home-national', 'pokemon.json'), 'utf8'));
for (const mon of homeNational) {
  if (mon.form === null && !speciesByNationalId.has(mon.national_id)) {
    speciesByNationalId.set(mon.national_id, mon);
  }
}

for (const { key, pokedex, gameId, name, dexType } of POKEAPI_DEX_MANIFEST) {
  const dex = await getPokeapi(`/pokedex/${pokedex}`);
  const game = games.find((entry) => entry.id === gameId);
  if (!game) {
    throw new Error(`game ${gameId} not found in the pokedextracker games catalog`);
  }

  const pokemon = [...dex.pokemon_entries]
    .sort((a, b) => a.entry_number - b.entry_number)
    .map((entry) => {
      const nationalId = Number(/\/(\d+)\/?$/.exec(entry.pokemon_species.url)[1]);
      const species = speciesByNationalId.get(nationalId);
      if (!species) {
        throw new Error(`no bundled species for national id ${nationalId} (${entry.pokemon_species.name})`);
      }
      return {
        id: nationalId,
        national_id: nationalId,
        name: species.name,
        game_family: species.game_family,
        form: null,
        box: null,
        dex_number: entry.entry_number,
        name_ja: species.name_ja,
      };
    });

  const meta = {
    key,
    name,
    game,
    dex_type: { ...dexType, game_family_id: game.game_family.id, order: 0, tags: ['regional'] },
    total: pokemon.length,
  };

  const dir = join(DATA_DIR, 'dexes', key);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(join(dir, 'pokemon.json'), JSON.stringify(pokemon));
  console.log(`Wrote ${pokemon.length} pokemon to data/dexes/${key}/ (from PokéAPI ${pokedex}, game_family ${game.game_family.id})`);
}
