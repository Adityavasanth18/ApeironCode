import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createCheckpoint, rollbackCheckpoint} from '../../src/repair/checkpoint.js';
import {buildApprovalBundle, assessPlanRisk} from '../../src/repair/approvalBundle.js';
import type {FilePlan} from '../../src/agent/filePlanProtocol.js';
import type {FailureSummary} from '../../src/repair/failureClassifier.js';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-ckpt-'));
});
afterEach(async () => {
  await fs.rm(dir, {recursive: true, force: true});
});

describe('checkpoint and rollback', () => {
  it('snapshots existing files and restores them on rollback', async () => {
    await fs.writeFile(path.join(dir, 'a.ts'), 'original\n');
    const plan: FilePlan = {
      summary: 's', validation: [], commands: [],
      files: [{path: 'a.ts', operation: 'modify', content: 'changed'}, {path: 'new.ts', operation: 'create', content: 'new'}],
    };
    const checkpoint = await createCheckpoint(dir, plan);
    // Simulate a bad apply.
    await fs.writeFile(path.join(dir, 'a.ts'), 'corrupted');
    await fs.writeFile(path.join(dir, 'new.ts'), 'leftover');

    await rollbackCheckpoint(dir, checkpoint);
    expect(await fs.readFile(path.join(dir, 'a.ts'), 'utf8')).toBe('original\n');
    // A file that did not exist before is removed on rollback.
    await expect(fs.access(path.join(dir, 'new.ts'))).rejects.toThrow();
  });

  it('writes the checkpoint under .apeironcode/checkpoints', async () => {
    const plan: FilePlan = {summary: 's', validation: [], commands: [], files: [{path: 'a.ts', operation: 'create', content: 'x'}]};
    const checkpoint = await createCheckpoint(dir, plan);
    expect(checkpoint.dir).toContain(path.join('.apeironcode', 'checkpoints'));
    await expect(fs.access(path.join(checkpoint.dir, 'manifest.json'))).resolves.toBeUndefined();
  });
});

describe('approval bundle risk', () => {
  const failure: FailureSummary = {
    primary: {kind: 'typecheck', message: 'type error', command: 'npm run typecheck', rawExcerpt: '', confidence: 'high', file: 'src/a.ts', line: 1},
    issues: [{kind: 'typecheck', message: 'type error', command: 'npm run typecheck', rawExcerpt: '', confidence: 'high'}],
    files: ['src/a.ts'],
  };

  it('flags high-risk commands and blocks them', () => {
    const plan: FilePlan = {
      summary: 's', validation: [], files: [{path: 'a.ts', operation: 'modify', content: 'x'}],
      commands: [{command: 'rm -rf /', reason: 'cleanup'}, {command: 'npm run typecheck', reason: 'verify'}],
    };
    const risk = assessPlanRisk(plan);
    expect(risk.level).toBe('high');
    expect(risk.highRiskCommands.map((c) => c.command)).toContain('rm -rf /');
    const bundle = buildApprovalBundle(failure, plan);
    expect(bundle.body).toContain('HIGH-RISK');
    expect(bundle.body).toContain('Risk: high');
  });

  it('builds a low-risk bundle for a single file modify', () => {
    const plan: FilePlan = {summary: 's', validation: [], commands: [], files: [{path: 'src/a.ts', operation: 'modify', content: 'x'}]};
    const bundle = buildApprovalBundle(failure, plan);
    expect(bundle.risk.level).toBe('low');
    expect(bundle.body).toContain('modify src/a.ts');
    expect(bundle.body).toContain('Issues:');
  });
});
