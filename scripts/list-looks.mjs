'use strict';

// dev-only, rerun after the sheet gains forms (yarn sprites:forms): the forms a mon can be shown as, its looks
// (utils/looks), written to data/looks.json. They're the forms the sheet draws (app/styles/pokesprite.scss) under each
// species, a regional form's own under it (Galarian Darmanitan's Zen Mode), but for the giant forms, which follow the
// record (utils/gigantamax), and the regional forms themselves, which are slots of their own. Each is named as PokéAPI's
// tables name it, in English and in kana, and says which of PokéAPI's official artwork is its own where it has some
// (fetch-artwork.mjs saves Mega Charizard X's as 6-mega-x), for the review's lens

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_HOST = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const REGIONAL = ['alola', 'galar', 'hisui', 'paldea'];
const EN = '9';
// ja-Hrkt, in kana as the species' own names are
const JA = '1';

async function table (name) {
  const response = await fetch(`${CSV_HOST}/${name}.csv`);
  if (!response.ok) {
    throw new Error(`GET ${name}.csv failed with ${response.status}`);
  }
  const [header, ...rows] = (await response.text()).trim().split(/\r?\n/);
  const keys = header.split(',');
  return rows.map((row) => Object.fromEntries(row.split(',').map((value, i) => [keys[i], value])));
}

// ---- what the sheet draws: each species' forms in its plain rules (not a game family's, a female's or a shiny's)

const sheet = await readFile(join(ROOT, 'app', 'styles', 'pokesprite.scss'), 'utf8');
const drawn = new Map();
for (const [, form, national] of sheet.matchAll(/^\.pkicon\.form-([a-z0-9-]+)\.pkicon-(\d+) \{/gm)) {
  drawn.set(Number(national), [...(drawn.get(Number(national)) ?? []), form]);
}

// ---- PokéAPI's names for them

console.log('Fetching PokéAPI\'s pokemon, pokemon_forms, pokemon_form_names, items and item_names tables...');
const [varieties, forms, formNames, items, itemNames] = await Promise.all(
  ['pokemon', 'pokemon_forms', 'pokemon_form_names', 'items', 'item_names'].map(table),
);
const varietyById = new Map(varieties.map((variety) => [variety.id, variety]));
const speciesOf = (form) => Number(varietyById.get(form.pokemon_id).species_id);
const namesOf = new Map();
for (const row of formNames) {
  namesOf.set(`${row.pokemon_form_id}:${row.local_language_id}`, row.form_name || row.pokemon_name);
}

// the sheet's names that PokéAPI spells otherwise: Ruby and Sapphire's contest costumes, Urshifu's Rapid Strike and
// Calyrex's riders
const ALIASES = {
  25: { beautiful: 'belle', clever: 'phd', cool: 'rock-star', cute: 'pop-star', tough: 'libre' },
  892: { rapid: 'rapid-strike' },
  898: { 'ice-rider': 'ice', 'shadow-rider': 'shadow' },
};
// Alcremie's: a cream and a sweet, the sweet left out of the sheet's name where it's the strawberry, as it is on the
// base form (Vanilla Cream)
const SWEETS = ['strawberry', 'berry', 'love', 'star', 'clover', 'flower', 'ribbon'];
const CREAMS = ['vanilla-cream', 'ruby-cream', 'matcha-cream', 'mint-cream', 'lemon-cream', 'salted-cream', 'ruby-swirl', 'caramel-swirl', 'rainbow-swirl'];
const creamOf = (form) => CREAMS.find((cream) => form === cream || form.startsWith(`${cream}-`)) ?? 'vanilla-cream';
const sweetOf = (form) => SWEETS.find((sweet) => form.endsWith(`-${sweet}`)) ?? 'strawberry';
const pokeapiForm = (national, form) => (national === 869 ? `${creamOf(form)}-${sweetOf(form)}-sweet` : ALIASES[national]?.[form] ?? form);

// in kana, where PokéAPI has no Japanese name: the partners of Let's Go, the spiky-eared Pichu of HeartGold and
// SoulSilver, and Legends: Arceus's nobles
const KANA = {
  '25:starter': 'あいぼう',
  '133:starter': 'あいぼう',
  '172:spiky-eared': 'ギザみみ',
  '59:hisui-noble': 'キングウインディ',
  '101:hisui-noble': 'キングマルマイン',
  '549:hisui-noble': 'クイーンドレディア',
  '713:hisui-noble': 'キングクレベース',
  '900:noble': 'キングバサギリ',
};

// Alcremie's sweets in kana, which PokéAPI's form names carry only for the strawberry
const itemById = new Map(items.map((item) => [item.id, item.identifier]));
const sweetKana = new Map();
for (const row of itemNames) {
  const item = itemById.get(row.item_id);
  if (row.local_language_id === JA && item?.endsWith('-sweet')) {
    sweetKana.set(item.replace(/-sweet$/, ''), row.name);
  }
}

// a variety's own part of its name, past what it shares with its species' default (charizard-mega-x: mega-x), as
// fetch-artwork.mjs names its artwork (keep the two in sync): all of it but the species where nothing's left (Minior's
// red core, minior-red, against the red meteor's minior-red-meteor)
function suffixOf (variety, base) {
  const own = variety.identifier.split('-');
  const shared = base.identifier.split('-');
  let i = 0;
  while (i < own.length && own[i] === shared[i]) {
    i++;
  }
  return own.slice(Math.max(1, i)).join('-') || own.slice(1).join('-');
}

const formsBySpecies = new Map();
for (const form of forms) {
  const national = speciesOf(form);
  formsBySpecies.set(national, [...(formsBySpecies.get(national) ?? []), form]);
}

// a form's names and art, or null where PokéAPI doesn't have it
function described (national, pokeapi) {
  const form = (formsBySpecies.get(national) ?? []).find((entry) => entry.form_identifier === pokeapi);
  if (!form) {
    return null;
  }
  const variety = varietyById.get(form.pokemon_id);
  const base = varieties.find((entry) => entry.species_id === variety.species_id && entry.is_default === '1');
  // a variety's giant form, as PokéAPI's tables have one for a variety that isn't the species' default
  const giant = variety.is_default === '1' ? null : varieties.find((entry) => entry.identifier === `${variety.identifier}-gmax`);
  return {
    order: Number(form.order),
    en: namesOf.get(`${form.id}:${EN}`) || null,
    ja: namesOf.get(`${form.id}:${JA}`) || null,
    art: variety.is_default === '1' ? null : suffixOf(variety, base),
    giantArt: giant ? suffixOf(giant, base) : null,
  };
}

// each slot's base form, named where PokéAPI names it (Unown's A, Vivillon's Meadow Pattern): its default, but for the
// species whose base the sheet draws as another (East Sea Shellos, Active Mode Xerneas). Basculin's has no name, a HOME
// dex drawing it White-Striped, which Red-Striped is a look of there (EXTRA)
const BASES = { 422: 'east', 423: 'east', 716: 'active', 550: null, '555:galar': 'galar-standard' };
const defaultForm = (national) => (formsBySpecies.get(national) ?? []).find((form) =>
  form.is_default === '1' && varietyById.get(form.pokemon_id).is_default === '1')?.form_identifier;
function baseOf (key, national, region) {
  const pokeapi = key in BASES ? BASES[key] : region ?? defaultForm(national);
  const known = typeof pokeapi === 'string' ? described(national, national === 869 ? 'vanilla-cream-strawberry-sweet' : pokeapi) : null;
  if (!known?.en) {
    return null;
  }
  return { en: known.en, ja: national === 869 ? `${known.ja}・${sweetKana.get('strawberry')}` : known.ja };
}

// looks the sheet draws as a species' base form, offered where a game family's icon covers it (styles/pokesprite.scss)
const EXTRA = { 550: [{ form: 'red-striped', family: 'home' }] };
// the looks a game family's icon draws a species' base as (White-Striped Basculin in HOME's), standing in for its base
// there rather than beside it
const BASE_IN = { 550: { 'white-striped': 'home' } };
// the looks PokéAPI's default artwork shows rather than the base the sheet draws (West Sea Shellos, whose base is drawn
// East): theirs, written '', and the base's none
const DEFAULT_ART = { 422: 'west', 423: 'west', 550: 'red-striped' };

// ---- each slot's looks: a species' (its key its national number), or a regional form's (555:galar), as champions.ts
// slotKey keys them

const missing = [];
const looks = {};
const slots = new Map();
// each look's place in PokéAPI's order
const order = new Map();
for (const [national, list] of [...drawn].sort((a, b) => a[0] - b[0])) {
  const shown = list.filter((form) => !form.includes('gigantamax') && !REGIONAL.includes(form));
  for (const { form, family } of [...(EXTRA[national] ?? []), ...shown.map((name) => ({ form: name }))]) {
    // a regional form's own, where the species has that regional form (Alola Cap Pikachu is Pikachu's)
    const region = REGIONAL.find((name) => form.startsWith(`${name}-`) && list.includes(name));
    const key = region ? `${national}:${region}` : String(national);
    if (!slots.has(key)) {
      slots.set(key, { national, region });
    }
    const known = form.endsWith('noble') ? { en: 'Noble', ja: null, art: null, order: Infinity } : described(national, pokeapiForm(national, form));
    let ja = KANA[`${national}:${form}`] ?? known?.ja ?? null;
    if (national === 869) {
      ja = `${described(national, `${creamOf(form)}-strawberry-sweet`).ja}・${sweetKana.get(sweetOf(form))}`;
    }
    if (!known?.en || !ja) {
      missing.push(`${key} ${form}`);
    }
    // its own giant form, where Gigantamax gives it one apart from its species' (Rapid Strike Urshifu's), its sprite
    // the species' where the sheet draws only that (Low Key Toxtricity's)
    const giant = known?.giantArt ? { form: list.includes(`${form}-gigantamax`) ? `${form}-gigantamax` : 'gigantamax', art: known.giantArt } : null;
    const art = DEFAULT_ART[national] === form ? '' : known?.art;
    const look = {
      form,
      en: known?.en ?? form,
      ja: ja ?? form,
      ...(typeof art === 'string' ? { art } : {}),
      ...(family ? { family } : {}),
      ...(BASE_IN[national]?.[form] ? { baseIn: BASE_IN[national][form] } : {}),
      ...(giant ? { giant } : {}),
    };
    order.set(look, known?.order ?? Infinity);
    looks[key] = [...(looks[key] ?? []), look];
  }
}

const out = {};
for (const [key, { national, region }] of slots) {
  // in PokéAPI's order, Alcremie's by cream and then sweet, as they're browsed for one of a given colour
  const byFlavour = (a, b) => CREAMS.indexOf(creamOf(a.form)) - CREAMS.indexOf(creamOf(b.form)) ||
    SWEETS.indexOf(sweetOf(a.form)) - SWEETS.indexOf(sweetOf(b.form));
  out[key] = { base: baseOf(key, national, region), forms: looks[key].sort(national === 869 ? byFlavour : (a, b) => order.get(a) - order.get(b)) };
}

const lines = Object.entries(out).map(([key, { base, forms }]) => [
  `  "${key}": {`,
  `    "base": ${JSON.stringify(base)},`,
  '    "forms": [',
  forms.map((look) => `      ${JSON.stringify(look)}`).join(',\n'),
  '    ]',
  '  }',
].join('\n'));
await writeFile(join(ROOT, 'data', 'looks.json'), `{\n${lines.join(',\n')}\n}\n`);
console.log(`${Object.values(out).reduce((n, slot) => n + slot.forms.length, 0)} looks for ${slots.size} slots`);
if (missing.length > 0) {
  console.warn(`Named after the sheet, PokéAPI having no name for them:\n  ${missing.join('\n  ')}`);
}
