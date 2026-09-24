import type {CheckCommand, CheckResult} from './types.js';
import {SandboxManager} from '../sandbox/manager.js';
import {redactCommandText} from '../sandbox/envPolicy.js';

const MAX_OUTPUT_CHARS = 8_000;

const SECRET_PATTERNS: RegExp[] = [
  /\b(sk-[A-Za-z0-9]{8,})\b/gu,
  /\b(ghp_[A-Za-z0-9]{8,})\b/gu,
  /\b(github_pat_[A-Za-z0-9_]{8,})\b/gu,
  /\b((?:AKIA|ASIA)[A-Z0-9]{8,})\b/gu,
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----)/gu,
];

/** Redact common secret token shapes from command output before reuse. */
export const redactOutput = (text: string): string => {
  let out = redactCommandText(text);
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[redacted]');
  // Redact `KEY=value`-style secret assignments.
  out = out.replace(/((?:API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*)\S+/giu, '$1[redacted]');
  return out;
};

/** Truncate output to a safe size, keeping the head and tail (errors often at the end). */
export const truncateOutput = (text: string, max = MAX_OUTPUT_CHARS): string => {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.4));
  const tail = text.slice(text.length - Math.floor(max * 0.6));
  return `${head}\n…[${text.length - max} chars omitted]…\n${tail}`;
};

export interface RunCheckOptions {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Run a single check command and capture a redacted, truncated combined output.
 * Never throws on non-zero exit; a missing binary is reported as `ok:false`.
 */
export const runCheck = async (
  check: CheckCommand,
  options: RunCheckOptions,
): Promise<CheckResult> => {
  const manager = new SandboxManager({workspace: options.cwd});
  try {
    const result = await manager.executeCommand(check.command, {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? 120_000,
      signal: options.signal,
      workspace: options.cwd,
    });
    const combined = redactOutput(truncateOutput([result.stdout, result.stderr, result.warning].filter(Boolean).join('\n')));
    return {
      kind: check.kind,
      command: check.command,
      ok: result.exitCode === 0,
      exitCode: result.exitCode ?? null,
      output: combined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind: check.kind,
      command: check.command,
      ok: false,
      exitCode: null,
      output: redactOutput(truncateOutput(message)),
    };
  } finally {
    await manager.dispose();
  }
};
