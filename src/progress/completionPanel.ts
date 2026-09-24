import type {ProgressArtifact, ProgressRun} from './types.js';

const STATUS_WORD: Record<ProgressRun['status'], string> = {
  running: 'running',
  'awaiting-approval': 'awaiting approval',
  passed: 'passed',
  failed: 'failed',
  partial: 'partial',
  skipped: 'skipped',
};

const artifactLine = (artifact: ProgressArtifact): string => `  - ${artifact.label}: ${artifact.path}`;

export interface CompletionPanelOptions {
  /** Concrete follow-up commands/actions for the user. */
  nextActions?: string[];
  /** A one-line validation summary, e.g. "static passed, UI smoke skipped". */
  validationSummary?: string;
}

/**
 * Render a clean completion/failure panel for a finished workflow
 * (Phase 20E.5, Task F). Honest: never prints "Done" for a failed run, always
 * surfaces the failed step and next actions on failure.
 */
export const formatCompletionPanel = (run: ProgressRun, options: CompletionPanelOptions = {}): string => {
  const failed = run.status === 'failed';
  const filesChanged = run.files.filter((f) => f.status !== 'skipped' && f.status !== 'failed').length;
  const commandsRun = run.commands.filter((c) => c.status === 'passed' || c.status === 'failed').length;
  const lines: string[] = [];

  if (failed) {
    lines.push('Stopped with partial progress.');
    lines.push('');
    const failedTask = run.tasks.find((t) => t.status === 'failed');
    const failedCmd = run.commands.find((c) => c.status === 'failed');
    if (failedTask) lines.push(`Failed step:\n  ✗ ${failedTask.title}${failedTask.detail ? ` — ${failedTask.detail}` : ''}`);
    else if (failedCmd) lines.push(`Failed step:\n  ✗ ${failedCmd.command}`);
  } else {
    lines.push('Done.');
  }

  lines.push('');
  lines.push(`Workflow: ${run.workflow}`);
  lines.push(`Status: ${STATUS_WORD[run.status]}`);
  if (run.files.length > 0) lines.push(`Files changed: ${filesChanged}`);
  if (run.commands.length > 0) lines.push(`Commands run: ${commandsRun}`);
  if (options.validationSummary) lines.push(`Validation: ${options.validationSummary}`);

  if (run.artifacts.length > 0) {
    lines.push('Artifacts:');
    for (const artifact of run.artifacts) lines.push(artifactLine(artifact));
  }

  const next = options.nextActions ?? [];
  if (next.length > 0) {
    lines.push('');
    lines.push('Next:');
    for (const action of next) lines.push(`  - ${action}`);
  }
  return lines.join('\n');
};
