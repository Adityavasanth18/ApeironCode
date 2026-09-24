import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {DemoScenarioResult} from '../types.js';
import {runNodeScript} from '../validate.js';

const BROKEN_SUM = `'use strict';
// Intentionally broken: subtracts instead of adds.
function sum(a, b) {
  return a - b;
}
module.exports = {sum};
`;

const FIXED_SUM = `'use strict';
function sum(a, b) {
  return a + b;
}
module.exports = {sum};
`;

const CHECK_JS = `'use strict';
const {sum} = require('./sum.js');
const cases = [[2, 3, 5], [10, 5, 15], [0, 0, 0]];
let failures = 0;
for (const [a, b, expected] of cases) {
  const actual = sum(a, b);
  if (actual !== expected) {
    console.error('FAIL sum(' + a + ',' + b + ') = ' + actual + ', expected ' + expected);
    failures++;
  }
}
if (failures > 0) {
  console.error(failures + ' test(s) failed');
  process.exit(1);
}
console.log('All ' + cases.length + ' tests passed');
`;

/**
 * Deterministically create a tiny project with a failing test, run it (red),
 * apply the known fix, and re-run (green). No provider/model involved.
 */
export const runFixTestDemo = async (workspaceDir: string): Promise<DemoScenarioResult> => {
  await fs.mkdir(workspaceDir, {recursive: true});
  await fs.writeFile(path.join(workspaceDir, 'sum.js'), BROKEN_SUM, 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'check.js'), CHECK_JS, 'utf8');

  const before = await runNodeScript(workspaceDir, 'check.js');

  // Apply the deterministic fix.
  await fs.writeFile(path.join(workspaceDir, 'sum.js'), FIXED_SUM, 'utf8');

  const after = await runNodeScript(workspaceDir, 'check.js');

  return {
    scenario: 'fix-test',
    title: 'Fix a failing test',
    workspaceDir,
    plan: [
      'Create sum.js (with a deliberate bug) and check.js (a tiny test runner)',
      'Run check.js → expect failure',
      'Fix sum.js to add instead of subtract',
      'Re-run check.js → expect pass',
    ],
    filesCreated: ['sum.js', 'check.js'],
    filesChanged: ['sum.js'],
    validation: [
      {name: 'before fix: node check.js', ok: false, detail: `${before.detail}${before.ok ? '' : ' (expected failure)'}`},
      {name: 'after fix: node check.js', ok: after.ok, detail: after.detail},
    ],
    summary: after.ok
      ? 'Reproduced a failing test, applied a deterministic fix, and the test now passes.'
      : 'Demo ran but the post-fix check did not pass in this environment.',
  };
};
