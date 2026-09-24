/**
 * Shared types for the Phase 20B repair workflow (`apeironcode fix`).
 */

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type ProjectFramework =
  | 'next'
  | 'vite'
  | 'react'
  | 'express'
  | 'node-library'
  | 'typescript'
  | 'unknown';

export type CheckKind = 'typecheck' | 'lint' | 'test' | 'build' | 'e2e' | 'install';

export interface ProjectInfo {
  cwd: string;
  isGitRepo: boolean;
  hasPackageJson: boolean;
  hasNodeModules: boolean;
  packageManager: PackageManager;
  framework: ProjectFramework;
  /** Script names present in package.json, by check kind. */
  scripts: Partial<Record<CheckKind, string>>;
  /** True when TypeScript is configured (tsconfig present). */
  typescript: boolean;
}

export interface CheckCommand {
  kind: CheckKind;
  /** Full shell command, e.g. `npm run typecheck`. */
  command: string;
  /** Short reason shown in plans/approvals. */
  reason: string;
}

export interface CheckResult {
  kind: CheckKind;
  command: string;
  ok: boolean;
  exitCode: number | null;
  /** Combined stdout+stderr, already truncated/redacted for context use. */
  output: string;
  skipped?: boolean;
}

export type RepairIssueKind =
  | 'typecheck'
  | 'lint'
  | 'test'
  | 'build'
  | 'dependency'
  | 'syntax'
  | 'module-not-found'
  | 'unknown';

export interface RepairIssue {
  kind: RepairIssueKind;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  command: string;
  rawExcerpt: string;
  confidence: 'low' | 'medium' | 'high';
}
