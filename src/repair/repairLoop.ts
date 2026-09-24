import {promises as fs} from 'node:fs';
import path from 'node:path';

import {parseFilePlanResponse} from '../agent/filePlanParser.js';
import type {FilePlan} from '../agent/filePlanProtocol.js';
import {buildDiffPreview} from '../safety/diffPreview.js';
import {buildApprovalBundle, type ApprovalBundle} from './approvalBundle.js';
import {createCheckpoint, rollbackCheckpoint, checkpointRelativeDir} from './checkpoint.js';
import {detectCheckCommands, detectInstallCommand} from './commandDetector.js';
import {buildRepairContext} from './contextBuilder.js';
import {classifyFailures} from './failureClassifier.js';
import {parseCheckFailure} from './errorParser.js';
import {detectProject} from './projectDetector.js';
import {buildCorrectionPrompt, buildRepairPrompt} from './repairPlanner.js';
import {runCheck as defaultRunCheck} from './checkRunner.js';
import type {RepairAttemptRecord, RepairLoopResult, RepairStatus} from './finalReport.js';
import type {CheckCommand, CheckResult, ProjectInfo} from './types.js';

export type RepairMode = 'normal' | 'safe' | 'all' | 'until-green';

const readFileSafe = async (cwd: string, rel: string): Promise<string | null> =>
  fs.readFile(path.resolve(cwd, rel), 'utf8').catch(() => null);

export interface RepairLoopDeps {
  /** Provider call returning raw model text for a plan/correction prompt. */
  requestPlan: (prompt: string) => Promise<string>;
  /** Approval gate for the bundled plan. Returns true to apply. */
  approve: (bundle: ApprovalBundle) => Promise<boolean>;
  /** Apply an approved, validated plan. Returns changed files / errors. */
  applyPlan: (plan: FilePlan, cwd: string) => Promise<{ok: boolean; errors: string[]; filesChanged: string[]}>;
  /** Override for tests. */
  detectProjectFn?: (cwd: string) => Promise<ProjectInfo>;
  runCheckFn?: typeof defaultRunCheck;
}

export interface RepairLoopOptions {
  cwd: string;
  mode: RepairMode;
  dryRun?: boolean;
  maxAttempts?: number;
  maxCorrections?: number;
  signal?: AbortSignal;
}

const DEFAULT_ATTEMPTS: Record<RepairMode, number> = {normal: 3, safe: 2, all: 5, 'until-green': 10};

// In safe mode, restrict a plan to files referenced by the failure and forbid
// destructive operations. Returns validation errors (empty = ok).
const safeModeViolations = (plan: FilePlan, allowedFiles: Set<string>): string[] => {
  const errors: string[] = [];
  for (const file of plan.files) {
    if (file.operation === 'delete' || file.operation === 'rename') {
      errors.push(`safe mode forbids ${file.operation} (${file.path})`);
    } else if (allowedFiles.size > 0 && !allowedFiles.has(file.path)) {
      errors.push(`safe mode only allows editing files referenced by the error; ${file.path} is not one of them`);
    }
  }
  return errors;
};

const runAllChecks = async (
  checks: CheckCommand[],
  cwd: string,
  runCheck: typeof defaultRunCheck,
  signal?: AbortSignal,
): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];
  for (const check of checks) results.push(await runCheck(check, {cwd, signal}));
  return results;
};

/**
 * The Phase 20B repair loop MVP. Detects the project, runs checks, asks the
 * provider for a minimal plan on failure (with one correction attempt),
 * bundles approval, checkpoints, applies, and reruns — up to a mode-based limit.
 * Never writes without approval; high-risk commands are stripped and reported.
 */
export const runRepairLoop = async (
  options: RepairLoopOptions,
  deps: RepairLoopDeps,
): Promise<RepairLoopResult> => {
  const detectProjectFn = deps.detectProjectFn ?? detectProject;
  const runCheck = deps.runCheckFn ?? defaultRunCheck;
  const project = await detectProjectFn(options.cwd);
  const includeAll = options.mode === 'all' || options.mode === 'until-green';
  const plannedChecks = detectCheckCommands(project, {includeAll});

  const base: Omit<RepairLoopResult, 'status' | 'summary' | 'finalChecks'> = {
    project,
    plannedChecks,
    dryRun: Boolean(options.dryRun),
    attempts: [],
    checkpoints: [],
  };

  if (options.dryRun) {
    const install = detectInstallCommand(project);
    const summary = install
      ? `Dry run. Would also install dependencies first: ${install.command}.`
      : 'Dry run. No checks were run and no files were changed.';
    return {...base, status: 'dry-run', summary, finalChecks: []};
  }

  if (plannedChecks.length === 0) {
    return {
      ...base,
      status: 'no-checks',
      summary: project.hasPackageJson
        ? 'No typecheck/lint/test/build scripts were found in package.json. Nothing to run.'
        : 'No package.json and no runnable checks were found. Nothing to run.',
      finalChecks: [],
    };
  }

  const maxAttempts = options.maxAttempts ?? DEFAULT_ATTEMPTS[options.mode];
  const maxCorrections = options.maxCorrections ?? 1;
  const attempts: RepairAttemptRecord[] = [];
  const checkpoints: string[] = [];
  let status: RepairStatus = 'gave-up';

  let finalChecks = await runAllChecks(plannedChecks, options.cwd, runCheck, options.signal);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const failing = finalChecks.find((check) => !check.ok);
    if (!failing) {
      status = 'green';
      break;
    }

    const issues = parseCheckFailure(failing);
    const failure = classifyFailures(issues);
    if (!failure) {
      status = 'gave-up';
      break;
    }

    const context = await buildRepairContext(project, failure, failing);
    const allowedFiles = new Set(failure.files);

    // Ask provider for a plan, with up to maxCorrections correction passes.
    let prompt = buildRepairPrompt(failure, context, {safe: options.mode === 'safe'});
    let plan: FilePlan | undefined;
    let lastErrors: string[] = [];
    for (let pass = 0; pass <= maxCorrections; pass += 1) {
      const raw = await deps.requestPlan(prompt);
      const parsed = parseFilePlanResponse(raw, {cwd: options.cwd});
      if (parsed.ok) {
        const violations = options.mode === 'safe' ? safeModeViolations(parsed.plan, allowedFiles) : [];
        if (violations.length === 0) {
          plan = parsed.plan;
          break;
        }
        lastErrors = violations;
        prompt = buildCorrectionPrompt(violations);
      } else {
        lastErrors = parsed.errors;
        prompt = buildCorrectionPrompt(parsed.errors);
      }
    }

    if (!plan) {
      attempts.push({
        attempt, failingCommand: failing.command, primaryIssue: failure.primary.message,
        contextFiles: context.files.map((f) => f.path), planApplied: false, rolledBack: false,
        blockedCommands: [], note: `Invalid plan: ${lastErrors.slice(0, 2).join('; ')}`,
      });
      status = 'invalid-plan';
      break;
    }

    // Build a redacted diff preview (old vs planned content) for the approval
    // bundle (Phase 20E.5, Task E).
    const diffInputs = await Promise.all(
      plan.files.map(async (file) => ({
        path: file.path,
        // The diff model has no 'overwrite'; treat it as a modify.
        operation: file.operation === 'overwrite' ? 'modify' : file.operation,
        before: await readFileSafe(options.cwd, file.path),
        after: file.content ?? null,
      })),
    );
    const diffPreview = plan.files.length > 0 ? buildDiffPreview(diffInputs) : undefined;

    // Strip high-risk commands; they are blocked from the auto-applied bundle.
    const bundle = buildApprovalBundle(failure, plan, {diffPreview});
    const blocked = bundle.risk.highRiskCommands.map((c) => c.command);
    const safePlan: FilePlan = {
      ...plan,
      commands: plan.commands.filter((c) => !blocked.includes(c.command)),
    };

    const approved = await deps.approve(bundle);
    if (!approved) {
      attempts.push({
        attempt, failingCommand: failing.command, primaryIssue: failure.primary.message,
        contextFiles: context.files.map((f) => f.path), planApplied: false, rolledBack: false,
        blockedCommands: blocked,
      });
      status = 'rejected';
      break;
    }

    const checkpoint = await createCheckpoint(options.cwd, safePlan);
    checkpoints.push(checkpointRelativeDir(options.cwd, checkpoint));
    const applied = await deps.applyPlan(safePlan, options.cwd);
    let rolledBack = false;
    if (!applied.ok) {
      await rollbackCheckpoint(options.cwd, checkpoint);
      rolledBack = true;
    }

    attempts.push({
      attempt, failingCommand: failing.command, primaryIssue: failure.primary.message,
      contextFiles: context.files.map((f) => f.path), planApplied: applied.ok, rolledBack,
      blockedCommands: blocked,
      note: applied.ok ? undefined : `Apply failed: ${applied.errors.slice(0, 1).join('; ')}`,
    });

    finalChecks = await runAllChecks(plannedChecks, options.cwd, runCheck, options.signal);
  }

  if (status === 'gave-up' && finalChecks.every((c) => c.ok)) status = 'green';

  const summaryByStatus: Record<RepairStatus, string> = {
    green: 'All selected checks pass.',
    'no-checks': 'Nothing to run.',
    'gave-up': `Reached the attempt limit (${maxAttempts}) without going green. Review the remaining failures.`,
    rejected: 'Approval was declined; no changes were applied.',
    'invalid-plan': 'The provider returned an invalid plan after correction; no changes were applied. Try demo/local or a stronger provider.',
    'dry-run': 'Dry run.',
  };

  return {
    ...base,
    attempts,
    checkpoints,
    status,
    finalChecks,
    summary: summaryByStatus[status],
  };
};
