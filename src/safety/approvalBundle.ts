import {assessRisk, detectHighRiskCommands, type HighRiskMatch, type RiskLevel} from './risk.js';
import type {FileOperation} from '../progress/types.js';

export interface BundleFile {
  path: string;
  operation: FileOperation;
}

export interface BundleCommand {
  command: string;
  reason?: string;
}

export interface ApprovalBundleInput {
  /** Verb describing the action, e.g. "create a new app", "fix detected failures". */
  intent: string;
  files: BundleFile[];
  commands: BundleCommand[];
  validation?: string[];
}

export interface ApprovalBundleView {
  intent: string;
  risk: RiskLevel;
  /** Commands stripped from the auto-approved bundle (must run explicitly). */
  blocked: HighRiskMatch[];
  /** Commands that are safe to bundle. */
  safeCommands: BundleCommand[];
  body: string;
  options: string[];
}

const FILE_SYMBOL: Record<FileOperation, string> = {create: '+', modify: '~', delete: '-', rename: '»', read: '·'};

const summarize = (files: BundleFile[]): string[] => {
  const counts: Partial<Record<FileOperation, number>> = {};
  for (const file of files) counts[file.operation] = (counts[file.operation] ?? 0) + 1;
  const parts: string[] = [];
  for (const op of ['create', 'modify', 'delete', 'rename'] as FileOperation[]) {
    if (counts[op]) parts.push(`${op === 'create' ? 'Create' : op === 'modify' ? 'Modify' : op === 'delete' ? 'Delete' : 'Rename'} ${counts[op]} file${counts[op] === 1 ? '' : 's'}`);
  }
  return parts;
};

/**
 * Build a compact, user-friendly approval bundle (Phase 20E, Task D). High-risk
 * commands are split out (`blocked`) and never bundled; the offered options
 * adapt to whether there are file changes and commands.
 */
export const buildApprovalBundle = (input: ApprovalBundleInput): ApprovalBundleView => {
  const blocked = detectHighRiskCommands(input.commands.map((c) => c.command));
  const blockedSet = new Set(blocked.map((b) => b.command));
  const safeCommands = input.commands.filter((c) => !blockedSet.has(c.command));
  const destructiveFiles = input.files.some((f) => f.operation === 'delete' || f.operation === 'rename');
  const risk = assessRisk({
    fileCount: input.files.length,
    destructiveFiles,
    commandCount: safeCommands.length,
    highRiskCommands: blocked,
  });

  const lines: string[] = [];
  lines.push(`ApeironCode wants to ${input.intent}:`);
  lines.push('');
  for (const part of summarize(input.files)) lines.push(part);
  if (safeCommands.length > 0) lines.push(`Run ${safeCommands.length} command${safeCommands.length === 1 ? '' : 's'}`);
  lines.push('');
  lines.push(`Risk: ${risk}`);

  if (input.files.length > 0) {
    lines.push('');
    lines.push('Files:');
    for (const file of input.files) lines.push(`  ${FILE_SYMBOL[file.operation]} ${file.path}`);
  }
  if (safeCommands.length > 0) {
    lines.push('');
    lines.push('Commands:');
    for (const command of safeCommands) lines.push(`  - ${command.command}${command.reason ? `  (${command.reason})` : ''}`);
  }
  if (input.validation && input.validation.length > 0) {
    lines.push('');
    lines.push('Validation:');
    for (const step of input.validation) lines.push(`  - ${step}`);
  }
  if (blocked.length > 0) {
    lines.push('');
    lines.push('Blocked (run yourself; never auto-approved):');
    for (const b of blocked) lines.push(`  ✗ ${b.command} — ${b.reason}`);
  }

  const options = input.files.length > 0 && safeCommands.length > 0
    ? ['[Approve all]', '[View diff]', '[Files only]', '[Reject]']
    : ['[Approve]', '[View diff]', '[Reject]'];
  lines.push('');
  lines.push(`Options: ${options.join(' ')}`);

  return {intent: input.intent, risk, blocked, safeCommands, body: lines.join('\n'), options};
};
