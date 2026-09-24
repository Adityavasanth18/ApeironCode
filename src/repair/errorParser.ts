import {redactOutput} from './checkRunner.js';
import type {CheckResult, RepairIssue, RepairIssueKind} from './types.js';

const shortExcerpt = (text: string, max = 600): string => {
  const redacted = redactOutput(text).trim();
  return redacted.length <= max ? redacted : `${redacted.slice(0, max)}…`;
};

// TypeScript: `src/foo.ts(12,5): error TS2304: Cannot find name 'x'.`
const TS_ERROR_RE = /(?<file>[^\s(]+)\((?<line>\d+),(?<col>\d+)\):\s*error\s+TS\d+:\s*(?<message>.+)/u;
// ESLint stylish: a file path line followed by `  12:5  error  msg  rule`.
const ESLINT_LOC_RE = /^\s*(?<line>\d+):(?<col>\d+)\s+error\s+(?<message>.+?)(?:\s{2,}[\w./-]+)?\s*$/u;
// Vitest/Jest failing test names.
const TEST_FAIL_RE = /(?:^|\s)(?:×|✕|FAIL|✗)\s+(?<name>.+?)(?:\s+\d+\s*ms)?\s*$/u;
// Module not found.
const MODULE_NOT_FOUND_RE =
  /(?:Cannot find module|Module not found|ERR_MODULE_NOT_FOUND).*?['"]?(?<module>[@\w./-]+)['"]?/u;
const SYNTAX_ERR_RE = /SyntaxError:\s*(?<message>.+)/u;

const firstMatch = (lines: string[], re: RegExp): RegExpMatchArray | undefined => {
  for (const line of lines) {
    const m = line.match(re);
    if (m) return m;
  }
  return undefined;
};

/**
 * Parse a failed check's output into structured issues (Phase 20B, Task D).
 * Prefers the first actionable root cause, groups duplicates, keeps excerpts
 * short, and redacts secrets. Returns at least one issue for a failed check.
 */
export const parseCheckFailure = (result: CheckResult): RepairIssue[] => {
  const lines = result.output.split('\n');
  const issues: RepairIssue[] = [];
  const seen = new Set<string>();

  const push = (issue: RepairIssue): void => {
    const key = `${issue.kind}:${issue.file ?? ''}:${issue.line ?? ''}:${issue.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push(issue);
  };

  // Module-not-found and syntax errors are high-confidence root causes; surface first.
  const moduleMatch = firstMatch(lines, MODULE_NOT_FOUND_RE);
  if (moduleMatch?.groups?.module) {
    push({
      kind: 'module-not-found',
      message: `Cannot find module '${moduleMatch.groups.module}'`,
      command: result.command,
      rawExcerpt: shortExcerpt(moduleMatch[0]),
      confidence: 'high',
    });
  }

  const syntaxMatch = firstMatch(lines, SYNTAX_ERR_RE);
  if (syntaxMatch?.groups?.message) {
    push({
      kind: 'syntax',
      message: `SyntaxError: ${syntaxMatch.groups.message}`,
      command: result.command,
      rawExcerpt: shortExcerpt(syntaxMatch[0]),
      confidence: 'high',
    });
  }

  // TypeScript errors with file/line/column.
  for (const line of lines) {
    const m = line.match(TS_ERROR_RE);
    if (m?.groups) {
      push({
        kind: 'typecheck',
        file: m.groups.file,
        line: Number(m.groups.line),
        column: Number(m.groups.col),
        message: m.groups.message!.trim(),
        command: result.command,
        rawExcerpt: shortExcerpt(line),
        confidence: 'high',
      });
    }
  }

  // ESLint errors: track the most recent file header line.
  let eslintFile: string | undefined;
  for (const line of lines) {
    if (/^(?:\/|\.\/|[A-Za-z]:\\|[\w.-]+\/).*\.\w+\s*$/u.test(line.trim()) && !line.includes(':')) {
      eslintFile = line.trim();
      continue;
    }
    const m = line.match(ESLINT_LOC_RE);
    if (m?.groups && result.kind === 'lint') {
      push({
        kind: 'lint',
        file: eslintFile,
        line: Number(m.groups.line),
        column: Number(m.groups.col),
        message: m.groups.message!.trim(),
        command: result.command,
        rawExcerpt: shortExcerpt(line),
        confidence: eslintFile ? 'medium' : 'low',
      });
    }
  }

  // Failing test names.
  if (result.kind === 'test') {
    for (const line of lines) {
      const m = line.match(TEST_FAIL_RE);
      if (m?.groups?.name && !/\d+\s+(?:passed|failed)/u.test(m.groups.name)) {
        push({
          kind: 'test',
          message: `Failing test: ${m.groups.name.trim()}`,
          command: result.command,
          rawExcerpt: shortExcerpt(line),
          confidence: 'medium',
        });
      }
    }
  }

  if (issues.length === 0) {
    const kind: RepairIssueKind = result.kind === 'install' ? 'dependency' : (result.kind as RepairIssueKind);
    push({
      kind: ['typecheck', 'lint', 'test', 'build'].includes(result.kind) ? kind : 'unknown',
      message: `${result.command} failed (exit ${result.exitCode ?? 'n/a'})`,
      command: result.command,
      rawExcerpt: shortExcerpt(result.output.split('\n').slice(-12).join('\n')),
      confidence: 'low',
    });
  }

  return issues;
};
