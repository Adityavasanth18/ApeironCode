import {
  FILE_SYMBOL,
  TASK_SYMBOL,
  type CommandStatus,
  type ProgressCommand,
  type ProgressFile,
  type ProgressRun,
} from './types.js';

const COMMAND_SYMBOL: Record<CommandStatus, string> = {
  passed: '✓',
  running: '→',
  pending: '○',
  failed: '✗',
  skipped: '–',
};

const RUN_LABEL: Record<ProgressRun['status'], string> = {
  running: 'running',
  'awaiting-approval': 'awaiting approval',
  passed: 'passed',
  failed: 'failed',
  partial: 'partial',
  skipped: 'skipped',
};

const formatDuration = (ms?: number): string => (ms === undefined ? '' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

const formatFileLine = (file: ProgressFile): string => {
  const diff =
    file.additions !== undefined || file.deletions !== undefined
      ? `  +${file.additions ?? 0}/-${file.deletions ?? 0}`
      : '';
  const skipped = file.status === 'skipped' ? '  (unchanged)' : file.status === 'failed' ? '  (failed)' : '';
  return `  ${FILE_SYMBOL[file.operation]} ${file.path}${diff}${skipped}`;
};

const formatCommandLine = (command: ProgressCommand, verbose: boolean): string[] => {
  const lines: string[] = [];
  const duration = formatDuration(command.durationMs);
  const exit = command.status === 'failed' && command.exitCode !== undefined ? ` (exit ${command.exitCode})` : '';
  lines.push(`  ${COMMAND_SYMBOL[command.status]} ${command.command}${duration ? `  ${duration}` : ''}${exit}`);
  // Show a short excerpt on failure only; full output is debug-only.
  if (command.status === 'failed' && command.outputExcerpt) {
    const excerpt = verbose ? command.outputExcerpt : command.outputExcerpt.split('\n').slice(0, 2).join('\n');
    for (const line of excerpt.split('\n')) lines.push(`      ${line}`);
  }
  return lines;
};

export interface FormatProgressOptions {
  /** Verbose/debug mode shows full command excerpts. */
  verbose?: boolean;
}

/**
 * Render a {@link ProgressRun} as a compact, non-interactive progress board
 * (Phase 20E, Tasks A/B/F). Normal mode stays compact; verbose shows fuller
 * command excerpts. Secrets are expected to be redacted by producers.
 */
export const formatProgress = (run: ProgressRun, options: FormatProgressOptions = {}): string => {
  const lines: string[] = [];
  lines.push(`Task: ${run.title}`);
  const meta: string[] = [];
  if (run.projectPath) meta.push(run.projectPath);
  if (run.providerModel) meta.push(run.providerModel);
  if (meta.length > 0) lines.push(meta.join(' · '));

  if (run.tasks.length > 0) {
    lines.push('');
    lines.push('Plan');
    for (const task of run.tasks) {
      lines.push(`  ${TASK_SYMBOL[task.status]} ${task.title}${task.detail ? `  ${task.detail}` : ''}`);
    }
  }

  if (run.files.length > 0) {
    lines.push('');
    lines.push('Files');
    for (const file of run.files) lines.push(formatFileLine(file));
  }

  if (run.commands.length > 0) {
    lines.push('');
    lines.push('Commands');
    for (const command of run.commands) lines.push(...formatCommandLine(command, Boolean(options.verbose)));
  }

  if (run.approvals.length > 0) {
    lines.push('');
    lines.push('Approvals');
    for (const approval of run.approvals) lines.push(`  ${approval.title} — risk ${approval.risk} (${approval.status})`);
  }

  if (run.artifacts.length > 0) {
    lines.push('');
    lines.push('Artifacts');
    for (const artifact of run.artifacts) lines.push(`  ${artifact.label}: ${artifact.path}`);
  }

  lines.push('');
  lines.push(`Status: ${RUN_LABEL[run.status]}`);
  return lines.join('\n');
};
