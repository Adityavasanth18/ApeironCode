import {describe, expect, it} from 'vitest';

import {ProgressStore} from '../../src/progress/progressStore.js';
import {formatProgress} from '../../src/progress/formatProgress.js';

describe('progress model', () => {
  it('plans tasks and transitions status', () => {
    const store = new ProgressStore('build', 'Build CRM dashboard', {projectPath: './crm', providerModel: 'mock'});
    store.planTasks([
      {id: 'analyze', title: 'Analyze request'},
      {id: 'template', title: 'Select template'},
      {id: 'create', title: 'Create files'},
      {id: 'validate', title: 'Run static validation'},
    ]);
    store.setTask('analyze', 'passed');
    store.setTask('template', 'passed');
    store.setTask('create', 'passed');
    store.setTask('validate', 'running');
    const run = store.snapshot();
    expect(run.tasks.find((t) => t.id === 'validate')?.status).toBe('running');
  });

  it('derives the final status from task results', () => {
    const failing = new ProgressStore('fix', 'Fix').planTasks([{id: 'a', title: 'A'}]).setTask('a', 'failed').finalize();
    expect(failing.status).toBe('failed');
    const partial = new ProgressStore('new', 'New')
      .planTasks([{id: 'a', title: 'A'}, {id: 'b', title: 'B'}])
      .setTask('a', 'passed').setTask('b', 'skipped').finalize();
    expect(partial.status).toBe('partial');
    const passed = new ProgressStore('new', 'New').planTasks([{id: 'a', title: 'A'}]).setTask('a', 'passed').finalize();
    expect(passed.status).toBe('passed');
  });

  it('renders a compact progress board with symbols', () => {
    const store = new ProgressStore('build', 'Build CRM dashboard', {projectPath: './crm'});
    store.planTasks([{id: 'create', title: 'Create files'}, {id: 'smoke', title: 'Run UI smoke'}]);
    store.setTask('create', 'passed').setTask('smoke', 'pending');
    store.addFile({path: 'index.html', operation: 'create', additions: 20, deletions: 0});
    store.addCommand({command: 'node --check app.js', status: 'passed', durationMs: 1200});
    store.addCommand({command: 'npm test', status: 'failed', exitCode: 1, durationMs: 3800, outputExcerpt: 'Failing test: should add task\nmore'});
    store.addArtifact({kind: 'screenshot', label: 'Screenshot', path: '.apeironcode/ui-smoke/latest.png'});
    const text = formatProgress(store.snapshot());
    expect(text).toContain('Task: Build CRM dashboard');
    expect(text).toContain('✓ Create files');
    expect(text).toContain('○ Run UI smoke');
    expect(text).toContain('+ index.html  +20/-0');
    expect(text).toContain('✓ node --check app.js  1.2s');
    expect(text).toContain('✗ npm test  3.8s (exit 1)');
    expect(text).toContain('Failing test: should add task');
    expect(text).toContain('Screenshot: .apeironcode/ui-smoke/latest.png');
  });

  it('keeps failure output short in normal mode and full in verbose', () => {
    const store = new ProgressStore('fix', 'Fix')
      .addCommand({command: 'npm test', status: 'failed', outputExcerpt: 'l1\nl2\nl3\nl4'});
    expect(formatProgress(store.snapshot())).not.toContain('l3');
    expect(formatProgress(store.snapshot(), {verbose: true})).toContain('l3');
  });
});
