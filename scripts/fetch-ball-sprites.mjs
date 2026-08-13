'use strict';

// dev-only, one-time: downloads pokesprite ball icons into public/balls/<id>.png

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ballsJson from '../data/balls.json' with { type: 'json' };

const SPRITE_HOST = 'https://raw.githubusercontent.com/msikma/pokesprite/master/items/ball';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'balls');

// balls.json ids are <name>_ball; pokesprite files are the bare name
const slug = (id) => id.replace(/_ball$/, '').replaceAll('_', '-');

await mkdir(OUT_DIR, { recursive: true });

let ok = 0;
const failed = [];

for (const ball of ballsJson) {
  if (ball.id === 'unknown') {
    continue;
  }
  const url = `${SPRITE_HOST}/${slug(ball.id)}.png`;
  const response = await fetch(url);
  if (!response.ok) {
    failed.push(`${ball.id} (${response.status} ${url})`);
    continue;
  }
  await writeFile(join(OUT_DIR, `${ball.id}.png`), Buffer.from(await response.arrayBuffer()));
  ok++;
}

console.log(`Wrote ${ok} ball sprites to public/balls/`);
if (failed.length > 0) {
  console.error('FAILED:');
  for (const f of failed) {
    console.error(' ', f);
  }
  process.exit(1);
}
