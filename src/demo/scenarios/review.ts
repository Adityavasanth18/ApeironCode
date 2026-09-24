import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {DemoFinding, DemoScenarioResult} from '../types.js';

const SAMPLE_DIFF = `--- a/src/login.js
+++ b/src/login.js
@@
-function authenticate(user, password) {
-  const query = "SELECT * FROM users WHERE name = '" + user + "'";
-  const row = db.querySync(query);
-  if (row.password == password) {
-    return true;
-  }
-}
+function authenticate(user, password) {
+  const query = "SELECT * FROM users WHERE name = '" + user + "'";
+  const row = db.querySync(query);
+  if (row.password == password) {
+    return true;
+  }
+}
`;

// Deterministic findings derived from the sample diff above. These are static
// rule-based observations, not model output.
const FINDINGS: DemoFinding[] = [
  {
    category: 'security',
    message:
      'SQL injection: user input is concatenated into the query string. Use a parameterized query (db.query("… WHERE name = ?", [user])).',
  },
  {
    category: 'security',
    message:
      'Password compared in plaintext with `==`. Store and compare a salted hash (e.g. bcrypt.compare), and use strict equality.',
  },
  {
    category: 'bug risk',
    message:
      'authenticate() returns undefined on the failure path; callers treating the result as a boolean get a falsy value by accident, not by design. Return false explicitly.',
  },
  {
    category: 'maintainability',
    message:
      'Synchronous db.querySync blocks the event loop. Prefer an async query and propagate errors.',
  },
  {
    category: 'suggestion',
    message:
      'Add a unit test covering a wrong password and a missing user before changing auth behavior.',
  },
];

/**
 * Deterministic code review over a fixed sample diff. No provider/model: the
 * findings are static, rule-based observations written into the workspace so a
 * user can see the review output format.
 */
export const runReviewDemo = async (workspaceDir: string): Promise<DemoScenarioResult> => {
  await fs.mkdir(workspaceDir, {recursive: true});
  await fs.writeFile(path.join(workspaceDir, 'sample.diff'), SAMPLE_DIFF, 'utf8');

  return {
    scenario: 'review',
    title: 'Review a change',
    workspaceDir,
    plan: [
      'Load a fixed sample diff (sample.diff)',
      'Apply deterministic review rules: security, bug risk, maintainability',
      'Report findings and suggested changes',
    ],
    filesCreated: ['sample.diff'],
    filesChanged: [],
    validation: [
      {name: 'diff parsed', ok: true, detail: '1 file, rule-based review'},
    ],
    findings: FINDINGS,
    summary: `Reviewed sample.diff and produced ${FINDINGS.length} deterministic findings (2 security, 1 bug risk, 1 maintainability, 1 suggestion).`,
  };
};
