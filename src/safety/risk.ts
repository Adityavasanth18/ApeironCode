/**
 * Shared high-risk command classification (Phase 20E, Task D).
 *
 * These commands are never bundled into an auto-approved plan. They must be run
 * by the user explicitly, even under `--yes`/trusted/bypass.
 */

export interface HighRiskMatch {
  command: string;
  reason: string;
}

const HIGH_RISK_PATTERNS: Array<{re: RegExp; label: string}> = [
  {re: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/u, label: 'recursive force delete (rm -rf)'},
  {re: /\bsudo\b/u, label: 'sudo'},
  {re: /\bchmod\s+-R\b|\bchown\s+-R\b/u, label: 'broad permission change'},
  {re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash|zsh)\b/u, label: 'pipe-to-shell'},
  {re: /\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/u, label: 'package publish'},
  {re: /\bgit\s+push\b.*--force|\bgit\s+push\s+-f\b/u, label: 'force push'},
  {re: /\bgit\s+push\b/u, label: 'git push'},
];

export const isHighRiskCommand = (command: string): HighRiskMatch | undefined => {
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.re.test(command)) return {command, reason: pattern.label};
  }
  return undefined;
};

export const detectHighRiskCommands = (commands: string[]): HighRiskMatch[] =>
  commands.map(isHighRiskCommand).filter((match): match is HighRiskMatch => Boolean(match));

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskInputs {
  fileCount: number;
  destructiveFiles: boolean;
  commandCount: number;
  highRiskCommands: HighRiskMatch[];
}

/** Derive an overall risk level from a planned change set. */
export const assessRisk = (inputs: RiskInputs): RiskLevel => {
  if (inputs.highRiskCommands.length > 0) return 'high';
  if (inputs.destructiveFiles && inputs.fileCount > 8) return 'high';
  if (inputs.destructiveFiles || inputs.commandCount > 0 || inputs.fileCount > 8) return 'medium';
  return 'low';
};
