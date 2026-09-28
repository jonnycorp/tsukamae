'use strict';

// fails if any theme × mode renders text below its target ratio, or tile text that could pass for the gift red

import { PALETTE_BASES, PALETTE_PRESETS, contrastRatio, deltaE, hexToRgba, hueGap, resolvePalette, toLch } from '../app/palette/tokens.ts';
import { CONTRAST_PAIRS, GIFT_DISTINCT } from '../app/palette/contrast-pairs.ts';

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

const gift = hexToRgba(PALETTE_BASES.gift);
const giftHue = toLch(gift).h;
let distinctChecks = 0;

for (const [theme, overrides] of Object.entries(PALETTE_PRESETS)) {
  if ('gift' in overrides) {
    failures.push(`${theme}: overrides the gift red, which has to stay constant across themes`);
    continue;
  }
  const palette = resolvePalette(overrides);
  for (const name of GIFT_DISTINCT.tokens) {
    const rival = palette[name];
    if (!rival) {
      failures.push(`${theme}: unknown token ${name}`);
      continue;
    }
    distinctChecks++;
    const { C, h } = toLch(rival);
    const gap = hueGap(h, giftHue);
    const distance = deltaE(gift, rival);
    if (distance < GIFT_DISTINCT.minDeltaE) {
      failures.push(`${theme} gift red vs ${name}: ΔE ${distance.toFixed(1)}, needs ${GIFT_DISTINCT.minDeltaE}`);
    } else if (gap < GIFT_DISTINCT.minHueGap && C > GIFT_DISTINCT.chromaFloor) {
      failures.push(`${theme} gift red vs ${name}: hue gap ${gap.toFixed(1)}° at chroma ${C.toFixed(1)}, needs ${GIFT_DISTINCT.minHueGap}° above chroma ${GIFT_DISTINCT.chromaFloor}`);
    }
  }
}

console.log(`Checked ${checks} colour pairs and ${distinctChecks} gift-red separations across ${Object.keys(PALETTE_PRESETS).length} themes.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} contrast failure(s):`);
  for (const line of failures) {
    console.error('  ', line);
  }
  process.exit(1);
}
console.log('All pairs meet their target.');
