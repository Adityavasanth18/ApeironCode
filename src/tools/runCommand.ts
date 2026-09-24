import {z} from 'zod';

import {ensureApproved} from '../safety/approvals.js';
import {assessCommand} from '../safety/commandGuard.js';
import {AppError} from '../utils/errors.js';
import {truncate} from '../utils/format.js';
import {SandboxManager} from '../sandbox/manager.js';
import {evaluateCommandPolicy, toApprovalRisk} from '../sandbox/commandPolicy.js';
import {formatPolicySummary} from '../sandbox/manager.js';
import {createEventTimestamp} from '../core/events/events.js';
import {commandSessionManager} from './commandSessions.js';
import {defineTool} from './types.js';

const RunCommandInputSchema = z.object({
  background: z.boolean().default(false),
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeout: z.number().int().positive().max(60_000).default(20_000),
});

export const runCommandTool = defineTool({
  description: 'Run an approved shell command with safety checks.',
  inputSchema: RunCommandInputSchema,
  name: 'run_command',
  requiresApproval: true,
  riskLevel: 'high',
  async run(rawInput, context) {
    const input = RunCommandInputSchema.parse(rawInput);
    const cwd = input.cwd ?? context.cwd;
    const policy = evaluateCommandPolicy({command: input.command, cwd, workspace: context.cwd});
    const assessment = assessCommand(input.command);

    if (policy.risk === 'blocked' || !assessment.allowed) {
      throw new AppError([...policy.blockedReasons, ...assessment.reasons].join(' ') || policy.reason, 'COMMAND_BLOCKED');
    }

    await ensureApproved(context.approvalManager, {
      details: formatPolicySummary(policy),
      kind: 'command',
      message: truncate(input.command, 240),
      resource: input.command,
      requiresExtraConfirmation: policy.risk === 'high' || assessment.requiresExtraConfirmation,
      riskLevel: toApprovalRisk(policy.risk),
      scope: 'project',
      title: 'Approve shell command',
    });

    if (input.background) {
      if (policy.risk !== 'medium') {
        throw new AppError('Background commands must be classified as medium server/dev commands.', 'COMMAND_BLOCKED');
      }
      const session = commandSessionManager.start(input.command, cwd);
      return {
        metadata: {
          command: session.command,
          cwd: session.cwd,
          exitCode: session.exitCode ?? null,
          pid: session.pid ?? null,
          sessionId: session.id,
          startedAt: session.startedAt,
          status: session.status,
        },
        ok: true,
        output: JSON.stringify(session, null, 2),
        summary: `Started background command session ${session.id}`,
      };
    }

    const sandboxManager = new SandboxManager({
      allowFallbackToLocal: true,
      mode: context.config.sandbox.mode,
      workspace: context.cwd,
    });

    try {
      context.eventBus?.emit({
        backend: 'local',
        command: input.command,
        cwd,
        timestamp: createEventTimestamp(),
        type: 'sandbox.execution_started',
      });

      const result = await sandboxManager.executeCommand(input.command, {
        cwd,
        network: policy.network === 'ask' ? 'on' : policy.network,
        timeout: input.timeout,
        signal: context.signal,
        workspace: context.cwd,
      });

      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');

      if (!result.ok) {
        context.eventBus?.emit({
          backend: result.backend,
          durationMs: result.durationMs,
          exitCode: result.exitCode,
          output: combinedOutput,
          timestamp: createEventTimestamp(),
          type: 'sandbox.execution_completed',
        });
      }

      return {
        ok: result.ok,
        output: combinedOutput,
        summary: `Command exited with code ${result.exitCode}`,
        metadata: {
          background: false,
          backend: result.backend,
          command: input.command,
          cwd,
          durationMs: result.durationMs,
          exitCode: result.exitCode,
          policy: result.policy,
          warning: result.warning,
        },
      };
    } finally {
      await sandboxManager.dispose();
    }
  },
});
