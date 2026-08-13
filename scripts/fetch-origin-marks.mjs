'use strict';

// dev-only, one-time: downloads HOME-style origin marks + the Champions icon into public/marks/<id>.png

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const POKESPRITE_HOST = 'https://raw.githubusercontent.com/msikma/pokesprite/master/misc/origin-marks/home';
const BULBAGARDEN_HOST = 'https://archives.bulbagarden.net/media/upload';

// pokesprite stops at gen 8; Paldea, Z-A and Champions come from Bulbagarden archives
const MARKS = {
  pentagon: `${POKESPRITE_HOST}/pentagon.png`,
  clover: `${POKESPRITE_HOST}/clover.png`,
  'lets-go': `${POKESPRITE_HOST}/lets-go.png`,
  galar: `${POKESPRITE_HOST}/galar.png`,
  sinnoh: `${POKESPRITE_HOST}/sinnoh-gen8.png`,
  hisui: `${POKESPRITE_HOST}/hisui.png`,
  go: `${POKESPRITE_HOST}/go.png`,
  // gen-9 summary-screen variants — the HOME ones are white-on-transparent, invisible on light tiles
  paldea: `${BULBAGARDEN_HOST}/8/89/Paldea_icon.png`,
  za: `${BULBAGARDEN_HOST}/a/a7/Z-A_icon.png`,
  // upstream has a baked white background; the committed copy was hand-cleared — re-running clobbers that
  champions: 'https://archives.bulbagarden.net/wiki/Special:FilePath/HOME_Champions_icon.png',
};

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'marks');

await mkdir(OUT_DIR, { recursive: true });

let ok = 0;
const failed = [];

for (const [id, url] of Object.entries(MARKS)) {
  const response = await fetch(url);
  if (!response.ok) {
    failed.push(`${id} (${response.status} ${url})`);
    continue;
  }
  await writeFile(join(OUT_DIR, `${id}.png`), Buffer.from(await response.arrayBuffer()));
  ok++;
}

console.log(`Wrote ${ok} origin marks to public/marks/`);
if (failed.length > 0) {
  console.error('FAILED:');
  for (const f of failed) {
    console.error(' ', f);
  }
  process.exit(1);
}
