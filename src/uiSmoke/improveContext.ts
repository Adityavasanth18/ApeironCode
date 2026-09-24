import {readLatestUiSmoke} from './uiReport.js';
import type {UiSmokeResult} from './types.js';

export interface ImproveUiContext {
  /** Extra prompt context describing the latest UI smoke, if any. */
  promptContext: string;
  /** Whether a latest UI smoke report was found. */
  hasReport: boolean;
  /** Failing checks/interactions worth fixing. */
  failures: string[];
}

const collectFailures = (result: UiSmokeResult): string[] => {
  const failures: string[] = [];
  for (const check of result.checks) if (!check.ok) failures.push(`check: ${check.name} (${check.detail})`);
  for (const i of result.interactions) if (!i.ok) failures.push(`interaction: ${i.name} (${i.detail})`);
  for (const error of result.consoleErrors.slice(0, 3)) failures.push(`console error: ${error}`);
  for (const f of result.networkFailures.slice(0, 3)) failures.push(`missing asset: ${f}`);
  return failures;
};

/**
 * Build UI-smoke context for `apeironcode improve` (Phase 20D, Task F). Reads
 * the latest UI smoke report from `.apeironcode/ui-smoke/` and summarizes its
 * failures so the improve workflow can target them. Returns empty context when
 * no report exists.
 */
export const buildImproveUiContext = async (cwd: string): Promise<ImproveUiContext> => {
  const result = await readLatestUiSmoke(cwd);
  if (!result) {
    return {
      promptContext: 'No UI smoke report found. Run `apeironcode test-ui` first to capture rendering/interaction issues.',
      hasReport: false,
      failures: [],
    };
  }
  const failures = collectFailures(result);
  const lines = [
    `Latest UI smoke: ${result.status}.`,
    result.screenshotPath ? `Screenshot: ${result.screenshotPath}` : undefined,
    failures.length > 0 ? 'Failures to fix:' : 'No failing checks recorded.',
    ...failures.map((f) => `- ${f}`),
  ].filter((line): line is string => Boolean(line));
  return {promptContext: lines.join('\n'), hasReport: true, failures};
};
