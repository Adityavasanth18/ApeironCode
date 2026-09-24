import {DEMO_DISCLAIMER, type DemoScenarioMeta, type DemoScenarioResult} from './types.js';

const check = (ok: boolean): string => (ok ? '✓' : '✗');

/**
 * Render the `apeironcode demo` menu (no scenario argument): explains demo mode
 * and lists the runnable scenarios.
 */
export const formatDemoMenu = (scenarios: DemoScenarioMeta[]): string => {
  const lines: string[] = [];
  lines.push('ApeironCode Demo');
  lines.push('');
  lines.push('Deterministic, no-key examples. No API key, model, or Ollama required.');
  lines.push('');
  lines.push('Scenarios');
  for (const scenario of scenarios) {
    lines.push(`  ${scenario.title}`);
    lines.push(`    ${scenario.description}`);
    lines.push(`    → ${scenario.command}`);
  }
  lines.push('');
  lines.push(DEMO_DISCLAIMER);
  return lines.join('\n');
};

/**
 * Render a completed demo scenario result: plan, files, validation, findings,
 * and an honest disclaimer.
 */
export const formatDemoResult = (result: DemoScenarioResult): string => {
  const lines: string[] = [];
  lines.push(`ApeironCode Demo · ${result.title}`);
  lines.push('');
  lines.push(`Workspace: ${result.workspaceDir}`);
  lines.push('');

  lines.push('Plan');
  for (const step of result.plan) lines.push(`  • ${step}`);
  lines.push('');

  if (result.filesCreated.length > 0) {
    lines.push(`Files created: ${result.filesCreated.join(', ')}`);
  }
  if (result.filesChanged.length > 0) {
    lines.push(`Files changed: ${result.filesChanged.join(', ')}`);
  }
  if (result.beforeAfter) {
    lines.push('');
    lines.push('Before (excerpt)');
    for (const line of result.beforeAfter.before) lines.push(`  - ${line}`);
    lines.push('After (excerpt)');
    for (const line of result.beforeAfter.after) lines.push(`  + ${line}`);
  }
  lines.push('');

  lines.push('Validation');
  for (const step of result.validation) {
    lines.push(`  ${check(step.ok)} ${step.name} — ${step.detail}`);
  }

  if (result.findings && result.findings.length > 0) {
    lines.push('');
    lines.push('Review findings');
    for (const finding of result.findings) {
      lines.push(`  [${finding.category}] ${finding.message}`);
    }
  }

  lines.push('');
  lines.push(result.summary);
  if (result.openHint) {
    lines.push(`Next: ${result.openHint} (in ${result.workspaceDir})`);
  }
  lines.push('');
  lines.push(DEMO_DISCLAIMER);
  return lines.join('\n');
};
