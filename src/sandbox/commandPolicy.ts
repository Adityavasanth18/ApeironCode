import {classifyCommand} from './commandClassifier.js';
import {checkCommandPaths} from './pathPolicy.js';
import type {CommandPolicyDecision} from './types.js';

export interface CommandPolicyInput {
  allowEnv?: boolean;
  command: string;
  cwd: string;
  workspace: string;
}

export const evaluateCommandPolicy = (input: CommandPolicyInput): CommandPolicyDecision => {
  const classification = classifyCommand(input.command);
  const paths = checkCommandPaths(input.command, input.cwd, input.workspace, {allowEnv: input.allowEnv});
  const blockedReasons = [
    ...(classification.risk === 'blocked' ? classification.reasons : []),
    ...paths.reasons,
  ];
  if (blockedReasons.length > 0) {
    return {
      blockedReasons,
      filesystem: 'unrestricted-blocked',
      network: 'off',
      reason: blockedReasons.join(' '),
      requiresApproval: true,
      requiresSandbox: false,
      risk: 'blocked',
    };
  }

  const network = /\b(?:curl|wget|npm|pnpm|yarn|bun)\s+(?:install|add|update|upgrade)\b/u.test(input.command)
    ? 'ask'
    : 'off';
  return {
    blockedReasons: [],
    filesystem: classification.risk === 'safe' && /^(?:ls|cat|find|rg|grep|git\s+(?:diff|status))/u.test(input.command.trim())
      ? 'read-only'
      : 'workspace-only',
    network,
    reason: classification.reasons.join(' ') || `Classified as ${classification.risk}.`,
    requiresApproval: classification.risk !== 'safe' || network === 'ask',
    requiresSandbox: !/^(?:ls|cat|find|rg|grep|git\s+(?:diff|status))/u.test(input.command.trim()),
    risk: classification.risk,
  };
};

export const toApprovalRisk = (risk: CommandPolicyDecision['risk']): 'low' | 'medium' | 'high' =>
  risk === 'safe' ? 'low' : risk === 'medium' ? 'medium' : 'high';
