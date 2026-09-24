/* eslint-disable @typescript-eslint/require-await -- deterministic async test stubs */
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {detectUiTarget} from '../../src/uiSmoke/targetDetector.js';
import {startStaticServer} from '../../src/uiSmoke/staticServer.js';
import {runUiSmoke} from '../../src/uiSmoke/runUiSmoke.js';
import {formatUiSmokeReport, saveUiSmokeReport, readLatestUiSmoke} from '../../src/uiSmoke/uiReport.js';
import {hasInteractionSpec} from '../../src/uiSmoke/interactionChecks.js';
import type {BrowserLauncher, SmokePage, UiSmokeResult} from '../../src/uiSmoke/types.js';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-uismoke-'));
});
afterEach(async () => {
  await fs.rm(dir, {recursive: true, force: true});
});

const writeStaticTodo = async (target: string): Promise<void> => {
  await fs.mkdir(target, {recursive: true});
  await fs.writeFile(path.join(target, 'index.html'),
    '<title>Todo</title><meta name="viewport" content="x"><link rel="stylesheet" href="styles.css"><h1>Todo</h1><form id="add-form"><input id="new-todo"><button type="submit" class="btn">Add</button></form><ul class="list"></ul><script src="app.js"></script>');
  await fs.writeFile(path.join(target, 'styles.css'), 'h1{}');
  await fs.writeFile(path.join(target, 'app.js'), '"use strict";');
  await fs.mkdir(path.join(target, '.apeironcode'), {recursive: true});
  await fs.writeFile(path.join(target, '.apeironcode', 'app.json'),
    JSON.stringify({createdBy: 'ApeironCode', templateId: 'static-todo', appName: 'Todo', createdAt: ''}));
};

// A deterministic in-memory page + launcher (no real browser). Models a todo
// list that grows by one after the add button is clicked.
const fakePage = (overrides: Partial<SmokePage> = {}): SmokePage => {
  let items = 0;
  return {
    textOf: async () => 'Todo',
    isVisible: async () => true,
    count: async (selector: string) => (/li/u.test(selector) ? items : 1),
    fill: async () => undefined,
    click: async () => {
      items += 1;
    },
    title: async () => 'Todo',
    ...overrides,
  };
};

const fakeLauncher = (opts: {consoleErrors?: string[]; page?: SmokePage} = {}): BrowserLauncher =>
  async () => ({
    page: opts.page ?? fakePage(),
    consoleErrors: () => opts.consoleErrors ?? [],
    networkFailures: () => [],
    screenshot: async () => true,
    close: async () => undefined,
  });

describe('targetDetector', () => {
  it('detects a static app with metadata', async () => {
    await writeStaticTodo(dir);
    const target = await detectUiTarget(dir);
    expect(target.type).toBe('static');
    expect(target.meta?.templateId).toBe('static-todo');
  });

  it('detects a Vite project and reports missing deps', async () => {
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({devDependencies: {vite: '5'}}));
    const target = await detectUiTarget(dir);
    expect(target.type).toBe('vite');
    expect(target.reason).toMatch(/dependencies not installed/);
  });

  it('returns unknown for a directory with no web entry', async () => {
    const target = await detectUiTarget(dir);
    expect(target.type).toBe('unknown');
  });
});

describe('staticServer', () => {
  it('serves files and blocks path traversal', async () => {
    await writeStaticTodo(dir);
    const server = await startStaticServer(dir);
    try {
      const ok = await fetch(`${server.url}/index.html`);
      expect(ok.status).toBe(200);
      const traversal = await fetch(`${server.url}/../../etc/passwd`);
      expect([403, 404]).toContain(traversal.status);
    } finally {
      await server.close();
    }
  });
});

describe('runUiSmoke (mocked browser)', () => {
  it('passes for a healthy static todo app', async () => {
    await writeStaticTodo(dir);
    const result = await runUiSmoke(dir, {launcher: fakeLauncher(), screenshot: false});
    expect(result.status).toBe('passed');
    expect(result.checks.find((c) => c.name === 'no console errors')?.ok).toBe(true);
    expect(result.interactions.length).toBeGreaterThan(0);
  });

  it('fails when there are console errors', async () => {
    await writeStaticTodo(dir);
    const result = await runUiSmoke(dir, {launcher: fakeLauncher({consoleErrors: ['Cannot read properties of null']}), screenshot: false});
    expect(result.status).toBe('failed');
    expect(result.consoleErrors[0]).toMatch(/Cannot read/);
  });

  it('skips honestly when no browser is available', async () => {
    await writeStaticTodo(dir);
    const result = await runUiSmoke(dir, {launcher: async () => null, screenshot: false});
    expect(result.status).toBe('skipped');
    expect(result.summary).toMatch(/Chromium is not installed/i);
  });

  it('skips with a reason for unknown targets', async () => {
    const result = await runUiSmoke(dir, {launcher: fakeLauncher()});
    expect(result.status).toBe('skipped');
    expect(result.targetType).toBe('unknown');
  });
});

describe('uiReport', () => {
  const base: UiSmokeResult = {
    status: 'passed', targetType: 'static', path: '/x', url: 'http://127.0.0.1:1',
    checks: [{name: 'page loaded', ok: true, detail: 'navigated'}], interactions: [],
    consoleErrors: [], networkFailures: [], summary: 'ok',
  };

  it('renders passed/failed/skipped distinctly', () => {
    expect(formatUiSmokeReport(base)).toContain('Result: passed');
    expect(formatUiSmokeReport({...base, status: 'failed', summary: 'bad'})).toContain('apeironcode fix');
    expect(formatUiSmokeReport({...base, status: 'skipped', summary: 'Chromium is not installed'})).toMatch(/npx playwright install chromium/);
  });

  it('redacts secrets in console errors', () => {
    const text = formatUiSmokeReport({...base, status: 'failed', consoleErrors: ['leaked sk-abcdefghijklmnop now']});
    expect(text).not.toContain('sk-abcdefghijklmnop');
    expect(text).toContain('[redacted]');
  });

  it('saves and reads back latest.json', async () => {
    await saveUiSmokeReport(dir, base);
    const latest = await readLatestUiSmoke(dir);
    expect(latest?.status).toBe('passed');
  });
});

describe('interaction specs', () => {
  it('has specs for the static templates and a generic fallback', () => {
    expect(hasInteractionSpec('static-todo')).toBe(true);
    expect(hasInteractionSpec('dashboard-static')).toBe(true);
    expect(hasInteractionSpec('static-landing')).toBe(true);
    expect(hasInteractionSpec('unknown-template')).toBe(false);
  });
});