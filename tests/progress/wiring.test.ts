import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {buildApp} from '../../src/appBuilder/appBuilder.js';
import {buildAppApprovalBundle, formatAppReport} from '../../src/appBuilder/appReport.js';
import {getTemplateById} from '../../src/appBuilder/templateRegistry.js';
import {buildApprovalBundle as buildRepairBundle} from '../../src/repair/approvalBundle.js';
import {buildFixProgress} from '../../src/cli/fixProgress.js';
import {formatCompletionPanel} from '../../src/progress/completionPanel.js';
import type {RepairLoopResult} from '../../src/repair/finalReport.js';
import type {FailureSummary} from '../../src/repair/failureClassifier.js';
import type {FilePlan} from '../../src/agent/filePlanProtocol.js';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-wire-'));
});
afterEach(async () => {
  await fs.rm(root, {recursive: true, force: true});
});

describe('app builder live wiring', () => {
  it('approval bundle uses the 2.0 format with a diff preview', () => {
    const template = getTemplateById('static-todo')!;
    const vars = {appName: 'X', appSlug: 'x', description: 'x', style: 'minimal' as const, features: []};
    const files = template.render(vars);
    const bundle = buildAppApprovalBundle(
      {appName: 'X', appSlug: 'x', description: 'x', kind: 'todo', stack: 'static', style: 'minimal', features: [], downgraded: false, notes: []},
      template, './x', files,
    );
    expect(bundle.body).toMatch(/Create \d+ files/);
    expect(bundle.body).toContain('Diff preview');
    expect(bundle.body).toMatch(/Options:/);
  });

  it('build report includes a Plan checklist', async () => {
    const result = await buildApp('todo app', {cwd: root, dir: 'todo', approve: () => Promise.resolve(true)});
    expect(result.progress).toBeDefined();
    const report = formatAppReport(result);
    expect(report).toContain('Plan');
    expect(report).toMatch(/✓ Select template/);
  });
});

describe('fix live wiring', () => {
  const failure: FailureSummary = {
    primary: {kind: 'typecheck', message: 'type error', command: 'npm run typecheck', rawExcerpt: '', confidence: 'high', file: 'src/a.ts'},
    issues: [{kind: 'typecheck', message: 'type error', command: 'npm run typecheck', rawExcerpt: '', confidence: 'high'}],
    files: ['src/a.ts'],
  };
  const plan: FilePlan = {summary: 's', commands: [], validation: [], files: [{path: 'a.ts', operation: 'modify', content: 'new'}]};

  it('repair bundle includes a diff preview and options when provided', () => {
    const bundle = buildRepairBundle(failure, plan, {diffPreview: 'Diff preview\n\na.ts\n+1 -0'});
    expect(bundle.body).toContain('Diff preview');
    expect(bundle.body).toContain('Options: [Approve all]');
  });

  it('maps a failed repair result to a failure panel with next actions', () => {
    const result: RepairLoopResult = {
      project: {cwd: root, isGitRepo: false, hasPackageJson: true, hasNodeModules: true, packageManager: 'npm', framework: 'typescript', scripts: {typecheck: 'typecheck'}, typescript: true},
      plannedChecks: [{kind: 'typecheck', command: 'npm run typecheck', reason: 'x'}],
      dryRun: false, attempts: [{attempt: 1, failingCommand: 'npm run typecheck', primaryIssue: 'type error', contextFiles: [], planApplied: true, rolledBack: false, blockedCommands: []}],
      finalChecks: [{kind: 'typecheck', command: 'npm run typecheck', ok: false, exitCode: 1, output: 'error'}],
      status: 'gave-up', checkpoints: ['.apeironcode/checkpoints/ckpt-1'], summary: 'gave up',
    };
    const {run, nextActions} = buildFixProgress(result);
    expect(run.status).toBe('failed');
    const panel = formatCompletionPanel(run, {nextActions});
    expect(panel).toContain('Stopped with partial progress');
    expect(panel).toContain('apeironcode fix --until-green');
    expect(panel).toContain('apeironcode rollback --last');
  });

  it('maps a green result to a Done panel', () => {
    const result: RepairLoopResult = {
      project: {cwd: root, isGitRepo: false, hasPackageJson: true, hasNodeModules: true, packageManager: 'npm', framework: 'typescript', scripts: {}, typescript: true},
      plannedChecks: [{kind: 'typecheck', command: 'npm run typecheck', reason: 'x'}],
      dryRun: false, attempts: [], finalChecks: [{kind: 'typecheck', command: 'npm run typecheck', ok: true, exitCode: 0, output: ''}],
      status: 'green', checkpoints: [], summary: 'green',
    };
    const {run} = buildFixProgress(result);
    expect(run.status).toBe('passed');
    expect(formatCompletionPanel(run)).toContain('Done.');
  });
});

describe('approval safety in wiring', () => {
  it('app builder write is gated: reject changes nothing', async () => {
    const reject = vi.fn(() => Promise.resolve(false));
    const result = await buildApp('todo app', {cwd: root, dir: 'todo', approve: reject});
    expect(result.status).toBe('rejected');
    await expect(fs.access(path.join(root, 'todo'))).rejects.toThrow();
  });
});
