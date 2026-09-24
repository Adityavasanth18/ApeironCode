/* eslint-disable @typescript-eslint/require-await -- deterministic async test stubs */
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {buildApp} from '../../src/appBuilder/appBuilder.js';
import {formatAppReport} from '../../src/appBuilder/appReport.js';
import {buildImproveUiContext} from '../../src/uiSmoke/improveContext.js';
import {saveUiSmokeReport} from '../../src/uiSmoke/uiReport.js';
import type {BrowserLauncher} from '../../src/uiSmoke/types.js';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-ab-uismoke-'));
});
afterEach(async () => {
  await fs.rm(root, {recursive: true, force: true});
});

const approve = vi.fn(() => Promise.resolve(true));
const passingLauncher: BrowserLauncher = async () => {
  let items = 0;
  return {
    page: {
      textOf: async () => 'Todo', isVisible: async () => true,
      count: async (s: string) => (/li/u.test(s) ? items : 1),
      fill: async () => undefined, click: async () => {
        items += 1;
      }, title: async () => 'Todo',
    },
    consoleErrors: () => [], networkFailures: () => [], screenshot: async () => true, close: async () => undefined,
  };
};
const noBrowser: BrowserLauncher = async () => null;

describe('app builder UI smoke integration', () => {
  it('writes .apeironcode/app.json metadata', async () => {
    await buildApp('todo app', {cwd: root, dir: 'todo', approve});
    const meta = JSON.parse(await fs.readFile(path.join(root, 'todo', '.apeironcode', 'app.json'), 'utf8')) as {templateId: string; createdBy: string};
    expect(meta.templateId).toBe('static-todo');
    expect(meta.createdBy).toBe('ApeironCode');
  });

  it('includes a passing UI smoke in the report with --ui-smoke', async () => {
    const result = await buildApp('todo app', {cwd: root, dir: 'todo', uiSmoke: true, uiSmokeLauncher: passingLauncher, approve});
    expect(result.uiSmoke?.status).toBe('passed');
    expect(formatAppReport(result)).toContain('UI smoke passed');
  });

  it('never claims a skipped smoke passed, and does not fail the build', async () => {
    const result = await buildApp('todo app', {cwd: root, dir: 'todo', uiSmoke: true, uiSmokeLauncher: noBrowser, approve});
    expect(result.uiSmoke?.status).toBe('skipped');
    expect(result.uiSmokeRequiredFailed).toBe(false);
    expect(formatAppReport(result)).toContain('UI smoke skipped');
    expect(formatAppReport(result)).not.toContain('UI smoke passed');
  });

  it('--require-ui-smoke marks the build failed when the browser is unavailable', async () => {
    const result = await buildApp('todo app', {cwd: root, dir: 'todo', requireUiSmoke: true, uiSmokeLauncher: noBrowser, approve});
    expect(result.uiSmoke?.status).toBe('skipped');
    expect(result.uiSmokeRequiredFailed).toBe(true);
    expect(formatAppReport(result)).toContain('UI smoke was required');
  });
});

describe('improve UI smoke context', () => {
  it('reports no report found when none exists', async () => {
    const ctx = await buildImproveUiContext(root);
    expect(ctx.hasReport).toBe(false);
    expect(ctx.promptContext).toMatch(/Run `apeironcode test-ui`/);
  });

  it('summarizes failures from the latest report', async () => {
    await saveUiSmokeReport(root, {
      status: 'failed', targetType: 'static', path: root, checks: [{name: 'no console errors', ok: false, detail: '1 error(s)'}],
      interactions: [], consoleErrors: ['Cannot read properties of null'], networkFailures: ['styles.css (HTTP 404)'], summary: 'failed',
    });
    const ctx = await buildImproveUiContext(root);
    expect(ctx.hasReport).toBe(true);
    expect(ctx.failures.join(' ')).toMatch(/console error|missing asset|no console errors/i);
  });
});