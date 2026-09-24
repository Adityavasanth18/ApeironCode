/* eslint-disable @typescript-eslint/require-await -- deterministic async test stubs */
import {describe, expect, it, vi} from 'vitest';

import {runRepairLoop, type RepairLoopDeps} from '../../src/repair/repairLoop.js';
import type {CheckCommand, CheckResult, ProjectInfo} from '../../src/repair/types.js';
import type {FilePlan} from '../../src/agent/filePlanProtocol.js';

const project: ProjectInfo = {
  cwd: '/tmp/proj',
  isGitRepo: false,
  hasPackageJson: true,
  hasNodeModules: true,
  packageManager: 'npm',
  framework: 'typescript',
  scripts: {typecheck: 'typecheck', test: 'test'},
  typescript: true,
};

const validPlan = JSON.stringify({
  summary: 'fix type',
  files: [{path: 'src/a.ts', operation: 'modify', content: 'export const a: number = 1;\n'}],
  commands: [],
  validation: [],
});

const makeChecks = (failingUntilFixed: () => boolean): RepairLoopDeps['runCheckFn'] =>
  vi.fn(async (check: CheckCommand): Promise<CheckResult> => {
    const ok = check.kind === 'typecheck' ? failingUntilFixed() : true;
    return {kind: check.kind, command: check.command, ok, exitCode: ok ? 0 : 1,
      output: ok ? '' : 'src/a.ts(1,14): error TS2322: Type string is not assignable to number.'};
  });

describe('repair loop (Phase 20B)', () => {
  it('dry-run detects checks and changes nothing', async () => {
    const applyPlan = vi.fn();
    const requestPlan = vi.fn();
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal', dryRun: true},
      {detectProjectFn: async () => project, requestPlan, approve: async () => true, applyPlan},
    );
    expect(result.status).toBe('dry-run');
    expect(result.plannedChecks.length).toBeGreaterThan(0);
    expect(applyPlan).not.toHaveBeenCalled();
    expect(requestPlan).not.toHaveBeenCalled();
  });

  it('reports no-checks when no scripts exist', async () => {
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal'},
      {
        detectProjectFn: async () => ({...project, scripts: {}}),
        requestPlan: vi.fn(), approve: async () => true, applyPlan: vi.fn(),
      },
    );
    expect(result.status).toBe('no-checks');
  });

  it('fixes a failing typecheck with a valid provider plan after approval', async () => {
    let fixed = false;
    const applyPlan = vi.fn(async () => {
      fixed = true;
      return {ok: true, errors: [], filesChanged: ['src/a.ts']};
    });
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal'},
      {
        detectProjectFn: async () => project,
        runCheckFn: makeChecks(() => fixed),
        requestPlan: vi.fn(async () => validPlan),
        approve: async () => true,
        applyPlan,
      },
    );
    expect(result.status).toBe('green');
    expect(applyPlan).toHaveBeenCalledTimes(1);
    expect(result.checkpoints.length).toBe(1);
    expect(result.attempts[0]!.planApplied).toBe(true);
  });

  it('strips high-risk commands from the applied plan even when approved (--yes)', async () => {
    let fixed = false;
    const planWithHighRisk = JSON.stringify({
      summary: 'fix', files: [{path: 'src/a.ts', operation: 'modify', content: 'export const a: number = 1;\n'}],
      commands: [{command: 'rm -rf /', reason: 'cleanup'}, {command: 'npm run typecheck', reason: 'verify'}],
      validation: [],
    });
    const applied: FilePlan[] = [];
    await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal'},
      {
        detectProjectFn: async () => project,
        runCheckFn: makeChecks(() => fixed),
        requestPlan: vi.fn(async () => planWithHighRisk),
        approve: async () => true, // simulates --yes
        applyPlan: async (plan) => {
          applied.push(plan);
          fixed = true;
          return {ok: true, errors: [], filesChanged: ['src/a.ts']};
        },
      },
    );
    const commands = applied[0]!.commands.map((c) => c.command);
    expect(commands).not.toContain('rm -rf /');
    expect(commands).toContain('npm run typecheck');
  });

  it('corrects an invalid first plan then applies the valid second', async () => {
    let fixed = false;
    const requestPlan = vi.fn()
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValue(validPlan);
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal', maxCorrections: 1},
      {
        detectProjectFn: async () => project,
        runCheckFn: makeChecks(() => fixed),
        requestPlan,
        approve: async () => true,
        applyPlan: async () => {
          fixed = true;
          return {ok: true, errors: [], filesChanged: ['src/a.ts']};
        },
      },
    );
    expect(requestPlan).toHaveBeenCalledTimes(2); // first invalid, second valid
    expect(result.status).toBe('green');
  });

  it('stops safely when the provider keeps returning invalid plans', async () => {
    const applyPlan = vi.fn();
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal', maxCorrections: 1},
      {
        detectProjectFn: async () => project,
        runCheckFn: makeChecks(() => false),
        requestPlan: vi.fn(async () => 'still not json'),
        approve: async () => true,
        applyPlan,
      },
    );
    expect(result.status).toBe('invalid-plan');
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it('changes nothing when approval is rejected', async () => {
    const applyPlan = vi.fn();
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'normal'},
      {
        detectProjectFn: async () => project,
        runCheckFn: makeChecks(() => false),
        requestPlan: vi.fn(async () => validPlan),
        approve: async () => false,
        applyPlan,
      },
    );
    expect(result.status).toBe('rejected');
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it('safe mode rejects edits to files not referenced by the error', async () => {
    // Plan edits an unrelated file; safe mode should reject and (after correction
    // also unrelated) stop without applying.
    const offTargetPlan = JSON.stringify({
      summary: 'x', files: [{path: 'src/unrelated.ts', operation: 'modify', content: 'x'}],
      commands: [], validation: [],
    });
    const applyPlan = vi.fn();
    const result = await runRepairLoop(
      {cwd: '/tmp/proj', mode: 'safe', maxCorrections: 1},
      {
        detectProjectFn: async () => project,
        runCheckFn: makeChecks(() => false),
        requestPlan: vi.fn(async () => offTargetPlan),
        approve: async () => true,
        applyPlan,
      },
    );
    expect(result.status).toBe('invalid-plan');
    expect(applyPlan).not.toHaveBeenCalled();
  });
});
