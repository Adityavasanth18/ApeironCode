import type {FilePlan} from '../agent/filePlanProtocol.js';
import {formatIssueLine, type FailureSummary} from './failureClassifier.js';
import {classifyCommand} from '../sandbox/commandClassifier.js';
import {evaluateCommandPolicy} from '../sandbox/commandPolicy.js';

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  highRiskCommands: Array<{command: string; reason: string}>;
}

export const assessPlanRisk = (plan: FilePlan): RiskAssessment => {
  const highRiskCommands: Array<{command: string; reason: string}> = [];
  for (const command of plan.commands) {
    const classification = classifyCommand(command.command);
    if (classification.risk === 'high' || classification.risk === 'blocked') {
      highRiskCommands.push({command: command.command, reason: classification.reasons.join(' ')});
    }
  }
  const destructiveFiles = plan.files.some((f) => f.operation === 'delete' || f.operation === 'rename');
  const manyFiles = plan.files.length > 8;
  let level: RiskAssessment['level'] = 'low';
  if (highRiskCommands.length > 0 || (destructiveFiles && manyFiles)) level = 'high';
  else if (destructiveFiles || plan.commands.length > 0 || manyFiles) level = 'medium';
  return {level, highRiskCommands};
};

export interface ApprovalBundle {
  title: string;
  body: string;
  risk: RiskAssessment;
}

/**
 * Build a single bundled approval preview for a repair attempt (Phase 20B,
 * Task G): the detected issues, the files to change, and the commands to rerun —
 * one approval, not one-per-file.
 */
export interface ApprovalBundleExtras {
  /** Rendered diff preview (Phase 20E.5) shown before approval. */
  diffPreview?: string;
}

export const buildApprovalBundle = (
  failure: FailureSummary,
  plan: FilePlan,
  extras: ApprovalBundleExtras = {},
): ApprovalBundle => {
  const risk = assessPlanRisk(plan);
  const lines: string[] = [];
  lines.push('ApeironCode wants to fix detected failures:');
  lines.push('');
  lines.push('Issues:');
  for (const issue of failure.issues.slice(0, 6)) lines.push(`- ${formatIssueLine(issue)}`);
  lines.push('');
  lines.push('Files:');
  for (const file of plan.files) {
    const from = file.operation === 'rename' && file.from ? ` (from ${file.from})` : '';
    lines.push(`- ${file.operation} ${file.path}${from}`);
  }
  if (plan.files.length === 0) lines.push('- (no file changes)');
  if (plan.commands.length > 0) {
    lines.push('');
    lines.push('Commands after change:');
    for (const command of plan.commands) {
      const policy = evaluateCommandPolicy({
        command: command.command,
        cwd: process.cwd(),
        workspace: process.cwd(),
      });
      lines.push(`- ${command.command}`);
      lines.push(`  risk: ${policy.risk} | sandbox: ${policy.requiresSandbox ? 'auto/docker when available' : 'native'} | network: ${policy.network}`);
    }
  }
  if (risk.highRiskCommands.length > 0) {
    lines.push('');
    lines.push('HIGH-RISK commands (blocked unless explicitly approved):');
    for (const hr of risk.highRiskCommands) lines.push(`- ${hr.command} — ${hr.reason}`);
  }
  lines.push('');
  lines.push(`Risk: ${risk.level}`);
  if (extras.diffPreview) {
    lines.push('');
    lines.push(extras.diffPreview);
  }
  lines.push('');
  lines.push('Options: [Approve all] [View diff] [Reject]');
  return {title: 'Approve repair plan', body: lines.join('\n'), risk};
};
