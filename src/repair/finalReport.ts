import type {CheckCommand, CheckResult, ProjectInfo} from './types.js';

export type RepairStatus =
  | 'green'
  | 'no-checks'
  | 'gave-up'
  | 'rejected'
  | 'invalid-plan'
  | 'dry-run';

export interface RepairAttemptRecord {
  attempt: number;
  failingCommand: string;
  primaryIssue: string;
  contextFiles: string[];
  planApplied: boolean;
  rolledBack: boolean;
  blockedCommands: string[];
  note?: string;
}

export interface RepairLoopResult {
  project: ProjectInfo;
  plannedChecks: CheckCommand[];
  dryRun: boolean;
  attempts: RepairAttemptRecord[];
  finalChecks: CheckResult[];
  status: RepairStatus;
  checkpoints: string[];
  summary: string;
}

const STATUS_LABEL: Record<RepairStatus, string> = {
  green: 'All selected checks pass.',
  'no-checks': 'No runnable checks were detected.',
  'gave-up': 'Stopped after the repair attempt limit without going green.',
  rejected: 'Stopped: approval was declined; no changes were applied.',
  'invalid-plan': 'Stopped: the model returned an invalid plan after correction; no changes were applied.',
  'dry-run': 'Dry run: detected project and planned checks; nothing was run or changed.',
};

/**
 * Format the final repair report for `apeironcode fix` (Phase 20B). Honest about
 * what was done — never claims green unless checks actually pass.
 */
export const formatRepairReport = (result: RepairLoopResult): string => {
  const lines: string[] = [];
  lines.push('ApeironCode fix');
  lines.push('');
  lines.push(`Project: ${result.project.framework} · ${result.project.packageManager}`);

  lines.push('');
  lines.push(result.plannedChecks.length > 0 ? 'Planned checks:' : 'Planned checks: none');
  for (const check of result.plannedChecks) lines.push(`  • ${check.command}`);

  if (result.dryRun) {
    lines.push('');
    lines.push(STATUS_LABEL['dry-run']);
    return lines.join('\n');
  }

  if (result.attempts.length > 0) {
    lines.push('');
    lines.push('Repair attempts:');
    for (const attempt of result.attempts) {
      lines.push(`  ${attempt.attempt}. ${attempt.failingCommand} — ${attempt.primaryIssue}`);
      if (attempt.contextFiles.length > 0) {
        lines.push(`     Context selected: ${attempt.contextFiles.join(', ')}`);
      }
      lines.push(
        `     ${attempt.planApplied ? 'applied plan' : 'no changes applied'}` +
          `${attempt.rolledBack ? ' (rolled back after failed apply)' : ''}`,
      );
      if (attempt.blockedCommands.length > 0) {
        lines.push(`     Blocked high-risk commands: ${attempt.blockedCommands.join(', ')}`);
      }
      if (attempt.note) lines.push(`     ${attempt.note}`);
    }
  }

  lines.push('');
  lines.push('Final check status:');
  for (const check of result.finalChecks) {
    lines.push(`  ${check.ok ? '✓' : '✗'} ${check.command}`);
  }

  if (result.checkpoints.length > 0) {
    lines.push('');
    lines.push(`Checkpoint(s) created: ${result.checkpoints.join(', ')}`);
    lines.push('A rollback command is planned for a future release.');
  }

  lines.push('');
  lines.push(result.summary || STATUS_LABEL[result.status]);
  return lines.join('\n');
};
