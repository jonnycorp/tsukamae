'use strict';

// fails if any theme × mode renders text below its contrast target or lets two states blur together

import { auditAll } from '../app/palette/audit.ts';

const results = auditAll();
const failures = results.filter((result) => !result.pass);

console.log(`Checked ${results.length} contrast and distinctness rules across every theme × mode.`);
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const { theme, mode, rule, value, min } of failures) {
    console.error(`   ${theme} ${mode}: ${rule} = ${value.toFixed(3)}, needs ${min}`);
  }
  process.exit(1);
}
console.log('Every theme passes.');
