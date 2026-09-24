import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {UiSmokeResult} from './types.js';

const SECRET_RE = /\b(sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,})\b/gu;

const redact = (text: string): string =>
  text.replace(SECRET_RE, '[redacted]').replace(/((?:API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*)\S+/giu, '$1[redacted]');

const mark = (status: 'passed' | 'failed' | 'skipped', ok: boolean): string =>
  status === 'skipped' ? '○' : ok ? '✓' : '✗';

/** Human-readable UI smoke report (Phase 20D, Task B). */
export const formatUiSmokeReport = (result: UiSmokeResult): string => {
  const lines: string[] = [];
  lines.push('ApeironCode UI Smoke');
  lines.push('');
  lines.push(`Target: ${result.targetType} app`);
  lines.push(`Path: ${result.path}`);
  if (result.url) lines.push(`URL: ${result.url}`);
  lines.push('');

  if (result.status === 'skipped') {
    lines.push(`UI smoke: skipped — ${result.summary}`);
    if (/chromium|browser/iu.test(result.summary)) {
      lines.push('Run: npx playwright install chromium');
    }
    return lines.join('\n');
  }

  lines.push('Checks');
  for (const check of result.checks) lines.push(`  ${mark(result.status, check.ok)} ${check.name} — ${redact(check.detail)}`);
  if (result.screenshotPath) lines.push(`  ${mark(result.status, true)} screenshot saved: ${result.screenshotPath}`);

  if (result.interactions.length > 0) {
    lines.push('');
    lines.push('Interactions');
    for (const i of result.interactions) lines.push(`  ${mark(result.status, i.ok)} ${i.name} — ${redact(i.detail)}`);
  }

  if (result.consoleErrors.length > 0) {
    lines.push('');
    lines.push('Console errors');
    for (const error of result.consoleErrors.slice(0, 5)) lines.push(`  ✗ ${redact(error).slice(0, 200)}`);
  }
  if (result.networkFailures.length > 0) {
    lines.push('');
    lines.push('Missing/failed assets');
    for (const failure of result.networkFailures.slice(0, 5)) lines.push(`  ✗ ${redact(failure).slice(0, 200)}`);
  }

  lines.push('');
  lines.push(`Result: ${result.status}`);
  if (result.status === 'failed') {
    lines.push('');
    lines.push('Next:');
    lines.push('  apeironcode fix');
    lines.push('  apeironcode improve "fix UI smoke failures"');
  }
  return lines.join('\n');
};

const sanitizeResult = (result: UiSmokeResult): UiSmokeResult => ({
  ...result,
  consoleErrors: result.consoleErrors.map((e) => redact(e).slice(0, 500)),
  networkFailures: result.networkFailures.map((f) => redact(f).slice(0, 500)),
  checks: result.checks.map((c) => ({...c, detail: redact(c.detail).slice(0, 500)})),
  interactions: result.interactions.map((i) => ({...i, detail: redact(i.detail).slice(0, 500)})),
});

export const uiSmokeDir = (cwd: string): string => path.join(cwd, '.apeironcode', 'ui-smoke');

/**
 * Persist a UI smoke result under `.apeironcode/ui-smoke/`: a timestamped run
 * plus a `latest.json` pointer. Secrets/large logs are redacted/truncated.
 * Returns the saved report path.
 */
export const saveUiSmokeReport = async (cwd: string, result: UiSmokeResult): Promise<string> => {
  const dir = uiSmokeDir(cwd);
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const runDir = path.join(dir, 'runs', stamp);
  await fs.mkdir(runDir, {recursive: true});
  const sanitized = sanitizeResult(result);
  const reportPath = path.join(runDir, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(sanitized, null, 2), 'utf8');
  await fs.writeFile(path.join(dir, 'latest.json'), JSON.stringify(sanitized, null, 2), 'utf8');
  return reportPath;
};

/** Read the most recent saved UI smoke result, if any. */
export const readLatestUiSmoke = async (cwd: string): Promise<UiSmokeResult | undefined> => {
  try {
    return JSON.parse(await fs.readFile(path.join(uiSmokeDir(cwd), 'latest.json'), 'utf8')) as UiSmokeResult;
  } catch {
    return undefined;
  }
};
