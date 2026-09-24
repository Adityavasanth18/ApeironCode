import {classifyCommandSemantics} from '../safety/shell/commandSemantics.js';
import {parseShellCommand} from '../safety/shell/parseCommand.js';
import type {CommandRisk} from './types.js';

export interface CommandClassification {
  reasons: string[];
  risk: CommandRisk;
}

const BLOCKED: Array<{pattern: RegExp; reason: string}> = [
  {pattern: /(^|\s)sudo(\s|$)/u, reason: 'sudo is blocked.'},
  {pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash|zsh)\b/u, reason: 'Remote pipe-to-shell execution is blocked.'},
  {pattern: /\bnpm\s+publish\b/u, reason: 'npm publish is blocked by default.'},
  {pattern: /\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|--mirror)\b/u, reason: 'Forced or mirrored git pushes are blocked.'},
  {pattern: /\bchmod\b[^\n]*-R[^\n]*777[^\n]*\s\/(?:\s|$)/u, reason: 'Recursive world-writable system permissions are blocked.'},
  {pattern: /\brm\b[^\n]*(?:-[^\s]*r[^\s]*f|-[^\s]*f[^\s]*r)[^\n]*\s\/(?:\s|$)/u, reason: 'Recursive deletion of the filesystem root is blocked.'},
];

const SAFE = [
  /^(?:npm\s+(?:test|run\s+(?:typecheck|lint|build)(?:\s+--.*)?)|node\s+--check\s+\S+|git\s+(?:diff|status)(?:\s|$)|(?:ls|cat|find|rg|grep|head|tail|pwd)\b)/u,
];
const MEDIUM = [
  /^(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update|upgrade)\b/u,
  /^(?:npm|pnpm|yarn|bun)\s+run\s+(?:dev|start|serve)\b/u,
];
const HIGH = [
  /\bgit\s+commit\b/u,
  /\bgit\s+branch\b[^\n]*(?:-[dD]\b|--delete\b)/u,
  /\b(?:rm|rmdir|chmod|chown)\b/u,
  /\b(?:curl|wget)\b/u,
  /\bgit\s+push\b/u,
];

export const classifyCommand = (command: string): CommandClassification => {
  const trimmed = command.trim();
  const blocked = BLOCKED.filter((rule) => rule.pattern.test(trimmed)).map((rule) => rule.reason);
  if (blocked.length > 0) return {risk: 'blocked', reasons: blocked};
  if (HIGH.some((pattern) => pattern.test(trimmed))) return {risk: 'high', reasons: ['Command has destructive, publishing, or network side effects.']};
  if (MEDIUM.some((pattern) => pattern.test(trimmed))) return {risk: 'medium', reasons: ['Command may modify dependencies or start a long-running process.']};
  if (SAFE.some((pattern) => pattern.test(trimmed))) return {risk: 'safe', reasons: ['Recognized validation or workspace read command.']};

  const semantics = classifyCommandSemantics(parseShellCommand(trimmed));
  if (semantics.riskLevel === 'critical' || semantics.riskLevel === 'high') {
    return {risk: 'high', reasons: semantics.riskReasons};
  }
  if (semantics.riskLevel === 'medium' || semantics.isFilesystemWrite || semantics.isPackageMutation) {
    return {risk: 'medium', reasons: semantics.riskReasons};
  }
  return {risk: semantics.isReadOnly ? 'safe' : 'medium', reasons: semantics.riskReasons};
};
