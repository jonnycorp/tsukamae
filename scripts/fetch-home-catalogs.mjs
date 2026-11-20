'use strict';

// dev-only: decides which HOME dex slots Sword/Shield and Scarlet/Violet can hold (sent from Pokémon HOME) and writes
// data/home-catalogs.json. Both lists come from Pokémon Showdown's formats-data (text-parsed, never executed): a slot is
// in a game unless its entry is marked isNonstandard (Past, Future, CAP, Custom, LGPE) or is missing altogether. The gen 8
// mod file lists every species, so an absent entry there means the game never had it.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOWDOWN = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data';
const SOURCES = {
  sword_shield: `${SHOWDOWN}/mods/gen8/formats-data.ts`,
  scarlet_violet: `${SHOWDOWN}/formats-data.ts`,
};

// the app's one Paldean Tauros slot is three Showdown breeds
const SHOWDOWN_IDS = {
  '128:paldea': ['taurospaldeacombat', 'taurospaldeablaze', 'taurospaldeaaqua'],
};

// the app's own dexes of each game, every slot of which must be in that game's list
const OWN_DEXES = {
  sword_shield: ['sword-shield-regional', 'sword-shield-expansion-regional'],
  scarlet_violet: ['paldea-full', 'scarlet-violet-regional', 'kitakami', 'blueberry'],
};

// copied from app/utils/champions.ts: a regional form is its own slot, any other form reads as its species
const REGIONAL_FORMS = new Set(['alola', 'galar', 'hisui', 'paldea']);
const slotKey = (national, form) => (form && REGIONAL_FORMS.has(form) ? `${national}:${form}` : String(national));

const showdownId = (name) => name.replace('♀', 'f').replace('♂', 'm').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

const readJson = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'));

// id -> isNonstandard value, or null for a standard entry
function parseFormatsData (text) {
  const entries = new Map();
  for (const match of text.matchAll(/^\t([a-z0-9]+): \{\n([\s\S]*?)^\t\},?$/gm)) {
    const flag = /isNonstandard:\s*"([^"]+)"/.exec(match[2]);
    entries.set(match[1], flag ? flag[1] : null);
  }
  return entries;
}

const compareKeys = (a, b) => {
  const [na, fa = ''] = a.split(':');
  const [nb, fb = ''] = b.split(':');
  return Number(na) - Number(nb) || fa.localeCompare(fb);
};

const home = await readJson('data/dexes/home-national/pokemon.json');
const slots = home.map((p) => ({ key: slotKey(p.national_id, p.form), id: showdownId(p.name) + (p.form ?? ''), name: p.name, form: p.form }));

const result = {
  source: { ...SOURCES, fetched: new Date().toISOString().slice(0, 10) },
};
let failed = false;

for (const [game, url] of Object.entries(SOURCES)) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`FAILED ${response.status} ${url}`);
    process.exit(1);
  }
  const entries = parseFormatsData(await response.text());
  const unmapped = [];
  const flagged = new Map();
  const keys = [];
  for (const slot of slots) {
    const ids = SHOWDOWN_IDS[slot.key] ?? [slot.id];
    const found = ids.filter((id) => entries.has(id));
    if (found.length === 0) {
      unmapped.push(`${slot.key} ${slot.name} (${ids.join('/')})`);
      continue;
    }
    const flags = found.map((id) => entries.get(id));
    if (flags.some((f) => f === null)) {
      keys.push(slot.key);
    } else {
      for (const f of new Set(flags)) {
        flagged.set(f, (flagged.get(f) ?? 0) + 1);
      }
    }
    for (const f of flags) {
      if (f === 'Unobtainable') {
        console.log(`${game}: ${slot.key} ${slot.name} is Unobtainable`);
      }
    }
  }
  keys.sort(compareKeys);
  result[game] = keys;

  console.log(`${game}: ${keys.length} of ${slots.length} slots in the game (${slots.length - keys.length} not)`);
  console.log(`  entries parsed: ${entries.size}; slots not in the game by flag:`, Object.fromEntries(flagged));
  if (unmapped.length > 0) {
    console.log(`  ${unmapped.length} slots with no Showdown entry (counted as not in the game)`);
    if (game === 'scarlet_violet' || unmapped.length < 40) {
      console.log('   ', unmapped.join(', '));
    }
  }

  const keySet = new Set(keys);
  for (const dex of OWN_DEXES[game]) {
    const missing = (await readJson(`data/dexes/${dex}/pokemon.json`))
      .map((p) => slotKey(p.national_id, p.form))
      .filter((key) => !keySet.has(key));
    if (missing.length > 0) {
      failed = true;
      console.error(`  MISMATCH: ${dex} has ${missing.length} slots not in ${game}: ${[...new Set(missing)].join(', ')}`);
    } else {
      console.log(`  ok: every slot of ${dex} is in ${game}`);
    }
  }
}

if (failed) {
  console.error('Validation failed, nothing written');
  process.exit(1);
}

const list = (keys) => `[\n${keys.map((k) => `    ${JSON.stringify(k)}`).join(',\n')}\n  ]`;
const json = `{\n  "source": ${JSON.stringify(result.source)},\n  "sword_shield": ${list(result.sword_shield)},\n  "scarlet_violet": ${list(result.scarlet_violet)}\n}\n`;
await writeFile(join(ROOT, 'data/home-catalogs.json'), json);
console.log('Wrote data/home-catalogs.json');
