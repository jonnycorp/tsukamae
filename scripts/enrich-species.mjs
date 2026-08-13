'use strict';

// dev-only: writes name_ja, legendary_class and gender_lock into every data/dexes/*/pokemon.json, idempotent

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_HOST = 'https://pokeapi.co/api/v2';
const DEXES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'dexes');
const CONCURRENCY = 20;

async function getSpecies (nationalId) {
  const response = await fetch(`${API_HOST}/pokemon-species/${nationalId}/`);
  if (!response.ok) {
    throw new Error(`GET /pokemon-species/${nationalId} failed with ${response.status}`);
  }
  const species = await response.json();

  // ja-Hrkt is the katakana name every game displays
  const entry = species.names.find((name) => name.language.name === 'ja-Hrkt') ||
    species.names.find((name) => name.language.name === 'ja');

  // mythical wins — PokéAPI flags a handful as both
  const legendaryClass = species.is_mythical ? 'mythical' : species.is_legendary ? 'legendary' : null;

  // gender_rate is eighths female: -1 genderless, 0 male-only, 8 female-only; null = both possible
  const genderLock = species.gender_rate === -1 ? 'genderless' :
    species.gender_rate === 0 ? 'male' :
      species.gender_rate === 8 ? 'female' : null;

  return { nameJa: entry?.name ?? null, legendaryClass, genderLock };
}

// collect every national_id used across the bundled dexes
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

console.log(`Fetching species data for ${nationalIds.size} species from PokéAPI...`);

// small worker pool; PokéAPI is fine with modest concurrency
const ids = [...nationalIds];
const species = new Map();
let cursor = 0;
let failures = 0;

async function worker () {
  while (cursor < ids.length) {
    const id = ids[cursor++];
    try {
      species.set(id, await getSpecies(id));
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

let legendary = 0;
let mythical = 0;

for (const [key, { path, pokemon }] of files) {
  const enriched = pokemon.map((mon) => {
    const entry = species.get(mon.national_id);
    return {
      ...mon,
      name_ja: entry?.nameJa ?? null,
      legendary_class: entry?.legendaryClass ?? null,
      gender_lock: entry?.genderLock ?? null,
    };
  });
  await writeFile(path, JSON.stringify(enriched));
  console.log(`Wrote species data for ${enriched.length} pokemon to data/dexes/${key}/pokemon.json`);
}

for (const entry of species.values()) {
  if (entry.legendaryClass === 'legendary') {
    legendary++;
  } else if (entry.legendaryClass === 'mythical') {
    mythical++;
  }
}

console.log(`Species classes: ${legendary} legendary, ${mythical} mythical`);
