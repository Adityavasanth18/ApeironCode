import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  DEMO_SCENARIOS,
  formatDemoMenu,
  formatDemoResult,
  isDemoScenarioId,
  runDemoScenario,
} from '../../src/demo/index.js';

let workspaceRoot: string;

beforeEach(async () => {
  workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'apeiron-demo-test-'));
});

afterEach(async () => {
  await fs.rm(workspaceRoot, {recursive: true, force: true});
});

const exists = (dir: string, rel: string): Promise<boolean> =>
  fs.access(path.join(dir, rel)).then(() => true).catch(() => false);

describe('demo mode (no key required)', () => {
  it('lists four scenarios with apeironcode commands', () => {
    expect(DEMO_SCENARIOS.map((s) => s.id).sort()).toEqual(['fix-test', 'improve-ui', 'review', 'todo-app']);
    const menu = formatDemoMenu(DEMO_SCENARIOS);
    expect(menu).toContain('No API key, model, or Ollama required');
    expect(menu).toContain('apeironcode demo todo-app');
  });

  it('validates scenario ids', () => {
    expect(isDemoScenarioId('todo-app')).toBe(true);
    expect(isDemoScenarioId('nope')).toBe(false);
  });

  it('todo-app creates a working static app with passing validation', async () => {
    const dir = path.join(workspaceRoot, 'todo');
    const result = await runDemoScenario('todo-app', {workspaceDir: dir});

    expect(result.filesCreated).toEqual(['index.html', 'styles.css', 'app.js']);
    expect(await exists(dir, 'index.html')).toBe(true);
    expect(await exists(dir, 'app.js')).toBe(true);
    expect(result.validation.every((step) => step.ok)).toBe(true);
    expect(result.openHint).toBe('open index.html');
  });

  it('fix-test reproduces a failure then fixes it to green', async () => {
    const dir = path.join(workspaceRoot, 'fix');
    const result = await runDemoScenario('fix-test', {workspaceDir: dir});

    expect(result.filesChanged).toContain('sum.js');
    const before = result.validation.find((s) => s.name.startsWith('before'));
    const after = result.validation.find((s) => s.name.startsWith('after'));
    expect(before?.ok).toBe(false);
    expect(after?.ok).toBe(true);
    // The fixed file actually computes addition.
    const fixed = await fs.readFile(path.join(dir, 'sum.js'), 'utf8');
    expect(fixed).toContain('a + b');
  });

  it('improve-ui changes the stylesheet and keeps assets resolvable', async () => {
    const dir = path.join(workspaceRoot, 'ui');
    const result = await runDemoScenario('improve-ui', {workspaceDir: dir});

    expect(result.filesChanged).toEqual(['styles.css']);
    expect(result.beforeAfter).toBeDefined();
    expect(result.validation.every((step) => step.ok)).toBe(true);
    const css = await fs.readFile(path.join(dir, 'styles.css'), 'utf8');
    expect(css).toContain('gradient');
  });

  it('review returns deterministic findings with no fake-AI wording', async () => {
    const dir = path.join(workspaceRoot, 'review');
    const result = await runDemoScenario('review', {workspaceDir: dir});

    expect(result.findings && result.findings.length).toBeGreaterThan(0);
    const categories = new Set(result.findings!.map((f) => f.category));
    expect(categories.has('security')).toBe(true);
    const text = formatDemoResult(result);
    expect(text).not.toMatch(/AI (?:wrote|generated|thinks)/i);
    expect(text).toContain('Demo mode uses deterministic local examples');
  });

  it('every formatted result includes the honest disclaimer', async () => {
    for (const scenario of DEMO_SCENARIOS) {
      const dir = path.join(workspaceRoot, scenario.id);
      const result = await runDemoScenario(scenario.id, {workspaceDir: dir});
      expect(formatDemoResult(result)).toContain(
        'For real projects, configure Ollama or a cloud provider',
      );
    }
  });
});
