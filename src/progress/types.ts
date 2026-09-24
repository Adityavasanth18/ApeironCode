/**
 * Phase 20E shared progress model.
 *
 * A workflow (fix/build/new/test-ui/improve/review/demo) emits a `ProgressRun`
 * describing its plan, files, commands, approvals, and artifacts. The model is
 * UI-agnostic: a plain-text formatter renders it for non-interactive output and
 * the Ink board renders the same data interactively.
 */

export type ProgressWorkflow = 'fix' | 'build' | 'new' | 'test-ui' | 'improve' | 'demo' | 'review';

export type TaskStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface ProgressTask {
  id: string;
  title: string;
  status: TaskStatus;
  detail?: string;
}

export type FileOperation = 'create' | 'modify' | 'delete' | 'rename' | 'read';
export type FileStatus = 'pending' | 'applied' | 'skipped' | 'failed';

export interface ProgressFile {
  path: string;
  operation: FileOperation;
  status?: FileStatus;
  additions?: number;
  deletions?: number;
}

export type CommandStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface ProgressCommand {
  command: string;
  status: CommandStatus;
  reason?: string;
  exitCode?: number;
  durationMs?: number;
  /** Short, redacted output excerpt shown on failure only. */
  outputExcerpt?: string;
}

export interface ApprovalSummary {
  title: string;
  risk: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'auto';
}

export type ArtifactKind = 'app' | 'screenshot' | 'report' | 'checkpoint' | 'ui-smoke';

export interface ProgressArtifact {
  kind: ArtifactKind;
  label: string;
  path: string;
}

export type RunStatus = 'running' | 'awaiting-approval' | 'passed' | 'failed' | 'partial' | 'skipped';

export interface ProgressRun {
  workflow: ProgressWorkflow;
  title: string;
  status: RunStatus;
  /** Project directory for the run. */
  projectPath?: string;
  /** provider/model label, when known (never required). */
  providerModel?: string;
  tasks: ProgressTask[];
  files: ProgressFile[];
  commands: ProgressCommand[];
  approvals: ApprovalSummary[];
  artifacts: ProgressArtifact[];
}

export const TASK_SYMBOL: Record<TaskStatus, string> = {
  passed: '✓',
  running: '→',
  pending: '○',
  failed: '✗',
  skipped: '–',
};

export const FILE_SYMBOL: Record<FileOperation, string> = {
  create: '+',
  modify: '~',
  delete: '-',
  rename: '»',
  read: '·',
};
