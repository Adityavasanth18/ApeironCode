import {z} from 'zod';

import {ensureApproved} from '../safety/approvals.js';
import {SandboxManager, formatPolicySummary} from '../sandbox/manager.js';
import {evaluateCommandPolicy, toApprovalRisk} from '../sandbox/commandPolicy.js';
import {detectProjectCommand} from './projectCommand.js';
import {defineTool} from './types.js';

const LintRunnerInputSchema = z.object({
  command: z.string().optional(),
});

export const lintRunnerTool = defineTool({
  description: 'Run the project lint command after approval.',
  inputSchema: LintRunnerInputSchema,
  name: 'lint_runner',
  requiresApproval: true,
  riskLevel: 'high',
  async run(rawInput, context) {
    const input = LintRunnerInputSchema.parse(rawInput);
    const command = input.command ?? (await detectProjectCommand(context.cwd, 'lint'));
    const policy = evaluateCommandPolicy({command, cwd: context.cwd, workspace: context.cwd});
    if (policy.risk === 'blocked') throw new Error(policy.reason);

    await ensureApproved(context.approvalManager, {
      details: formatPolicySummary(policy),
      kind: 'command',
      message: command,
      resource: command,
      requiresExtraConfirmation: policy.risk === 'high',
      riskLevel: toApprovalRisk(policy.risk),
      scope: 'project',
      title: 'Approve lint run',
    });

    const manager = new SandboxManager({mode: context.config.sandbox.mode, workspace: context.cwd});
    const result = await manager.executeCommand(command, {cwd: context.cwd, signal: context.signal, timeout: 60_000, workspace: context.cwd});
    await manager.dispose();

    return {
      ok: result.exitCode === 0,
      output: [result.stdout, result.stderr, result.warning].filter(Boolean).join('\n'),
      summary: result.exitCode === 0 ? 'Lint passed' : 'Lint failed',
    };
  },
});
