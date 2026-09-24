/* eslint-disable @typescript-eslint/require-await -- deterministic async test stubs */
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {buildApp} from '../../src/appBuilder/appBuilder.js';
import {runUiSmoke} from '../../src/uiSmoke/runUiSmoke.js';

/**
 * Optional REAL Playwright browser smoke. Skipped unless
 * APEIRONCODE_RUN_BROWSER_E2E=1 so the default test run stays stable without a
 * browser installed. Run with: `npm run test:ui-smoke`.
 */
const RUN = process.env.APEIRONCODE_RUN_BROWSER_E2E === '1';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-browser-e2e-'));
});
afterEach(async () => {
  await fs.rm(root, {recursive: true, force: true});
});

describe.skipIf(!RUN)('real browser UI smoke (opt-in)', () => {
  it('passes the UI smoke for a generated static todo app', async () => {
    await buildApp('premium todo app', {cwd: root, dir: 'todo', approve: async () => true});
    const result = await runUiSmoke(path.join(root, 'todo'), {screenshot: true});
    // If Chromium is genuinely unavailable, the runner reports skipped — which
    // is an honest result, not a failure.
    expect(['passed', 'skipped']).toContain(result.status);
    if (result.status === 'skipped') {
      expect(result.summary).toMatch(/Chromium|browser/i);
    } else {
      expect(result.consoleErrors).toEqual([]);
      expect(result.interactions.every((i) => i.ok)).toBe(true);
    }
  }, 60_000);
});