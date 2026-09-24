import path from 'node:path';

import {runUiSmoke} from '../uiSmoke/runUiSmoke.js';
import {formatUiSmokeReport, saveUiSmokeReport} from '../uiSmoke/uiReport.js';

export interface TestUiCliOptions {
  screenshot?: boolean;
  json?: boolean;
  port?: string;
  timeout?: string;
}

/**
 * `apeironcode test-ui [path]` handler (Phase 20D). Detects the target, runs the
 * browser smoke (skipped honestly when Chromium is unavailable), saves a
 * report/screenshot under the app's `.apeironcode/ui-smoke/`, and prints a
 * human or JSON report. Exits non-zero only on a real failure (not skipped).
 */
export const runTestUiCommand = async (
  cwd: string,
  targetArg: string | undefined,
  options: TestUiCliOptions,
): Promise<void> => {
  const targetPath = path.resolve(cwd, targetArg ?? '.');

  const result = await runUiSmoke(targetPath, {
    cwd: targetPath,
    port: options.port ? Number.parseInt(options.port, 10) : undefined,
    timeoutMs: options.timeout ? Number.parseInt(options.timeout, 10) : undefined,
    screenshot: options.screenshot,
  });

  // Persist the report (best-effort; never block on storage errors).
  try {
    result.reportPath = await saveUiSmokeReport(targetPath, result);
  } catch {
    // ignore storage errors
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatUiSmokeReport(result)}\n`);
  }

  if (result.status === 'failed') process.exitCode = 1;
};
