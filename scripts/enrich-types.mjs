'use strict';

// dev-only: writes types into every data/dexes/*/pokemon.json from PokéAPI's own tables, idempotent. A regional form
// takes its variety's types (Alolan Vulpix is ice), the first variety where a form has several (Paldean Tauros is the
// Combat Breed); a Gigantamax slot keeps its species' types

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CSV_HOST = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const DEXES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'dexes');
const REGIONAL = new Set(['alola', 'galar', 'hisui', 'paldea']);
const SAME_TYPES = new Set(['gigantamax']);

async function table (name) {
  const response = await fetch(`${CSV_HOST}/${name}.csv`);
  if (!response.ok) {
    throw new Error(`GET ${name}.csv failed with ${response.status}`);
  }
  const [header, ...rows] = (await response.text()).trim().split(/\r?\n/);
  const keys = header.split(',');
  return rows.map((row) => Object.fromEntries(row.split(',').map((value, i) => [keys[i], value])));
}

console.log('Fetching PokéAPI\'s pokemon, pokemon_types and types tables...');
const [varieties, varietyTypes, types] = await Promise.all([table('pokemon'), table('pokemon_types'), table('types')]);

const typeNames = new Map(types.map((type) => [type.id, type.identifier]));
const typesOf = new Map();
for (const row of [...varietyTypes].sort((a, b) => Number(a.slot) - Number(b.slot))) {
  const list = typesOf.get(row.pokemon_id) ?? [];
  list.push(typeNames.get(row.type_id));
  typesOf.set(row.pokemon_id, list);
}

// each species' varieties, in PokéAPI's order
const bySpecies = new Map();
for (const variety of [...varieties].sort((a, b) => Number(a.id) - Number(b.id))) {
  const list = bySpecies.get(variety.species_id) ?? [];
  list.push(variety);
  bySpecies.set(variety.species_id, list);
}

function varietyOf (mon) {
  const list = bySpecies.get(String(mon.national_id)) ?? [];
  if (!mon.form || SAME_TYPES.has(mon.form)) {
    return list.find((variety) => variety.is_default === '1');
  }
  if (REGIONAL.has(mon.form)) {
    return list.find((variety) => variety.identifier.includes(`-${mon.form}`));
  }
  throw new Error(`${mon.name}: no rule for the form "${mon.form}"`);
}

const dexKeys = (await readdir(DEXES_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const files = [];
const missing = [];
for (const key of dexKeys) {
  const path = join(DEXES_DIR, key, 'pokemon.json');
  const pokemon = JSON.parse(await readFile(path, 'utf8'));
  const enriched = pokemon.map((mon) => {
    const variety = varietyOf(mon);
    const monTypes = variety && typesOf.get(variety.id);
    if (!monTypes) {
      missing.push(`${key}: ${mon.name}${mon.form ? ` (${mon.form})` : ''}`);
    }
    return { ...mon, types: monTypes ?? [] };
  });
  files.push({ key, path, enriched });
}

if (missing.length > 0) {
  console.error(`No types for ${missing.length} slot(s); data files left untouched:`);
  for (const line of missing) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

for (const { key, path, enriched } of files) {
  await writeFile(path, JSON.stringify(enriched));
  console.log(`Wrote types for ${enriched.length} pokemon to data/dexes/${key}/pokemon.json`);
}
