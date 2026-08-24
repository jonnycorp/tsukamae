'use strict';

// fails the build if any theme × mode can render text below its target ratio

import { PALETTE_PRESETS, contrastRatio, hexToRgba, resolvePalette } from '../app/palette/tokens.ts';
import { CONTRAST_PAIRS } from '../app/palette/contrast-pairs.ts';

const failures = [];
let checks = 0;

for (const [theme, overrides] of Object.entries(PALETTE_PRESETS)) {
  const palette = resolvePalette(overrides);
  for (const pair of CONTRAST_PAIRS) {
    const fg = pair.fg.startsWith('#') ? hexToRgba(pair.fg) : palette[pair.fg];
    if (!fg) {
      failures.push(`${theme}: unknown token ${pair.fg}`);
      continue;
    }
    for (const bgName of pair.bg) {
      const bg = palette[bgName];
      if (!bg) {
        failures.push(`${theme}: unknown token ${bgName}`);
        continue;
      }
      checks++;
      const ratio = contrastRatio(fg, bg, bg);
      if (ratio < pair.target) {
        failures.push(`${theme} (${pair.mode}) ${pair.label}: ${pair.fg} on ${bgName} = ${ratio.toFixed(2)}:1, needs ${pair.target}`);
      }
    }
  }
}

console.log(`Checked ${checks} colour pairs across ${Object.keys(PALETTE_PRESETS).length} themes.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} contrast failure(s):`);
  for (const line of failures) {
    console.error('  ', line);
  }
  process.exit(1);
}
console.log('All pairs meet their target.');
