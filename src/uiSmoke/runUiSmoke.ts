import path from 'node:path';

import {detectUiTarget} from './targetDetector.js';
import {startStaticServer} from './staticServer.js';
import {runGenericChecks, runInteractions} from './interactionChecks.js';
import {createPlaywrightLauncher} from './playwrightRunner.js';
import {uiSmokeDir} from './uiReport.js';
import type {BrowserLauncher, UiCheck, UiSmokeResult, UiTarget} from './types.js';

export interface RunUiSmokeOptions {
  /** Where to store screenshots/reports (defaults to the target path). */
  cwd?: string;
  port?: number;
  timeoutMs?: number;
  screenshot?: boolean;
  /** Override the browser launcher (tests inject a deterministic one). */
  launcher?: BrowserLauncher;
}

const skipped = (target: UiTarget, summary: string): UiSmokeResult => ({
  status: 'skipped',
  targetType: target.type,
  path: target.path,
  checks: [],
  interactions: [],
  consoleErrors: [],
  networkFailures: [],
  summary,
});

/**
 * Run the UI smoke for a target directory (Phase 20D). Static apps are served
 * locally and opened in a browser; Vite/unknown targets without a runnable
 * entry are reported as skipped with an honest reason. If no browser is
 * available, the result is `skipped` — never a fake pass.
 */
export const runUiSmoke = async (
  targetPath: string,
  options: RunUiSmokeOptions = {},
): Promise<UiSmokeResult> => {
  const target = await detectUiTarget(targetPath);
  const cwd = options.cwd ?? target.path;

  if (target.type === 'unknown') {
    return skipped(target, target.reason ?? 'no web UI target found');
  }
  if (target.type === 'vite') {
    // Running a Vite dev server requires installed deps; this phase does not
    // auto-install. Report honestly instead of guessing.
    return skipped(target, target.reason ?? 'Vite dev server smoke requires installed dependencies (run: npm install)');
  }

  const launcher = options.launcher ?? createPlaywrightLauncher();
  const timeoutMs = options.timeoutMs ?? 30_000;

  const server = await startStaticServer(target.path, options.port ?? 0);
  try {
    const session = await launcher(`${server.url}/${target.entry ?? 'index.html'}`, {timeoutMs});
    if (!session) {
      return {...skipped(target, 'Chromium is not installed'), url: server.url};
    }
    try {
      const checks: UiCheck[] = [];
      checks.push({name: 'page loaded', ok: true, detail: 'navigated'});
      checks.push(...(await runGenericChecks(session.page)));

      const consoleErrors = session.consoleErrors();
      const networkFailures = session.networkFailures();
      checks.push({name: 'no missing assets', ok: networkFailures.length === 0, detail: networkFailures.length ? `${networkFailures.length} failure(s)` : 'all assets loaded'});
      checks.push({name: 'no console errors', ok: consoleErrors.length === 0, detail: consoleErrors.length ? `${consoleErrors.length} error(s)` : 'clean'});

      const interactions = await runInteractions(target.meta?.templateId, session.page);

      let screenshotPath: string | undefined;
      if (options.screenshot !== false) {
        const abs = path.join(uiSmokeDir(cwd), 'latest.png');
        if (await session.screenshot(abs)) screenshotPath = abs;
      }

      const ok = checks.every((c) => c.ok) && interactions.every((i) => i.ok);
      return {
        status: ok ? 'passed' : 'failed',
        targetType: target.type,
        path: target.path,
        url: server.url,
        checks,
        interactions,
        consoleErrors,
        networkFailures,
        screenshotPath,
        summary: ok ? 'all checks passed' : 'one or more checks failed',
      };
    } finally {
      await session.close();
    }
  } finally {
    await server.close();
  }
};
