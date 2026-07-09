'use strict';

// Dev-only script: enriches every data/dexes/*/pokemon.json with `name_ja` —
// the official katakana species name from PokéAPI (language `ja-Hrkt`, e.g.
// Bulbasaur → フシギダネ). Species names are per national_id, so every form of
// a mon shares its species' Japanese name.
//
// Runs as part of `yarn dataset` (after generate-dataset.mjs) and is also safe
// to run standalone; it rewrites the files in place and is idempotent.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_HOST = 'https://pokeapi.co/api/v2';
const DEXES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'dexes');
const CONCURRENCY = 20;

async function getSpeciesJaName (nationalId) {
  const response = await fetch(`${API_HOST}/pokemon-species/${nationalId}/`);
  if (!response.ok) {
    throw new Error(`GET /pokemon-species/${nationalId} failed with ${response.status}`);
  }
  const species = await response.json();
  // ja-Hrkt is the katakana name every game displays; plain `ja` duplicates it
  // for species (kanji variants only exist for flavor text, not names).
  const entry = species.names.find((name) => name.language.name === 'ja-Hrkt') ||
    species.names.find((name) => name.language.name === 'ja');
  return entry?.name ?? null;
}

// Collect every national_id used across all bundled dexes.
const dexKeys = (await readdir(DEXES_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const files = new Map(); // key -> { path, pokemon }
const nationalIds = new Set();

for (const key of dexKeys) {
  const path = join(DEXES_DIR, key, 'pokemon.json');
  const pokemon = JSON.parse(await readFile(path, 'utf8'));
  files.set(key, { path, pokemon });
  for (const mon of pokemon) {
    nationalIds.add(mon.national_id);
  }
}

console.log(`Fetching Japanese names for ${nationalIds.size} species from PokéAPI...`);

// Fetch with a small worker pool; PokéAPI is fine with modest concurrency.
const ids = [...nationalIds];
const jaNames = new Map();
let cursor = 0;
let failures = 0;

async function worker () {
  while (cursor < ids.length) {
    const id = ids[cursor++];
    try {
      jaNames.set(id, await getSpeciesJaName(id));
    } catch (err) {
      failures++;
      console.error(`  ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (failures > 0) {
  throw new Error(`${failures} species failed to fetch; data files left untouched — rerun to retry`);
}

for (const [key, { path, pokemon }] of files) {
  const enriched = pokemon.map((mon) => ({ ...mon, name_ja: jaNames.get(mon.national_id) ?? null }));
  await writeFile(path, JSON.stringify(enriched));
  console.log(`Wrote name_ja for ${enriched.length} pokemon to data/dexes/${key}/pokemon.json`);
}
