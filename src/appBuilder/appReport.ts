import type {AppValidationResult} from './appValidation.js';
import {formatValidation} from './appValidation.js';
import {buildApprovalBundle} from '../safety/approvalBundle.js';
import {buildDiffPreview} from '../safety/diffPreview.js';
import {TASK_SYMBOL, type ProgressRun} from '../progress/types.js';
import type {UiSmokeResult} from '../uiSmoke/types.js';
import type {AppRequest, AppTemplate} from './types.js';

export interface AppBuildResult {
  request: AppRequest;
  template: AppTemplate;
  appDir: string;
  displayDir: string;
  filesCreated: string[];
  validation?: AppValidationResult;
  /** UI smoke result when `--ui-smoke`/`--require-ui-smoke` was requested. */
  uiSmoke?: UiSmokeResult;
  /** True when `--require-ui-smoke` was set and the smoke did not pass. */
  uiSmokeRequiredFailed?: boolean;
  /** Progress run for the live board (Phase 20E.5). */
  progress?: ProgressRun;
  status: 'created' | 'rejected' | 'blocked-existing' | 'write-error' | 'dry-run';
  notes: string[];
}

const uiSmokeLine = (result: UiSmokeResult): string => {
  if (result.status === 'passed') return '  ✓ UI smoke passed';
  if (result.status === 'skipped') return `  ○ UI smoke skipped: ${result.summary}`;
  return `  ✗ UI smoke failed: ${result.summary}`;
};

/**
 * Build the approval bundle text for creating a new app (Phase 20C, Task F).
 */
export const buildAppApprovalBundle = (
  request: AppRequest,
  template: AppTemplate,
  displayDir: string,
  files: Array<{path: string; content: string}>,
): {title: string; body: string; risk: 'low' | 'medium'} => {
  const risk: 'low' | 'medium' = template.requiresCommands ? 'medium' : 'low';
  const validation = template.validation(toVars(request)).map((step) => step.command ?? step.name);
  // Approval bundle 2.0 (Phase 20E.5): shared compact bundle + diff preview of
  // the created files so the user sees what will be written before approving.
  const bundle = buildApprovalBundle({
    intent: `create a new app in ${displayDir}`,
    files: files.map((file) => ({path: file.path, operation: 'create'})),
    commands: [],
    validation,
  });
  const diff = buildDiffPreview(files.map((file) => ({path: file.path, operation: 'create', before: null, after: file.content})));

  const lines: string[] = [bundle.body];
  if (request.notes.length > 0) {
    lines.push('');
    lines.push('Notes:');
    for (const note of request.notes) lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push(diff);
  return {title: 'Approve new app', body: lines.join('\n'), risk: bundle.risk === 'high' ? 'medium' : (risk)};
};

const toVars = (request: AppRequest) => ({
  appName: request.appName,
  appSlug: request.appSlug,
  description: request.description,
  style: request.style,
  features: request.features,
});

/**
 * Format the final app-build report. Honest: never says a server started, never
 * claims real auth/database, and surfaces validation results as-is.
 */
export const formatAppReport = (result: AppBuildResult): string => {
  const lines: string[] = [];

  if (result.status === 'blocked-existing') {
    lines.push(`Cannot create the app: ${result.displayDir} already exists and is not empty.`);
    lines.push('Choose one:');
    lines.push(`- create in a subdirectory: apeironcode new "${result.request.description}" --dir ${result.displayDir}/${result.request.appSlug}`);
    lines.push('- re-run with --overwrite to write into it (existing files are still never silently replaced)');
    lines.push('- cancel');
    return lines.join('\n');
  }
  if (result.status === 'rejected') {
    return 'No app was created because approval was declined.';
  }
  if (result.status === 'write-error') {
    lines.push('The app could not be created cleanly:');
    for (const note of result.notes) lines.push(`- ${note}`);
    return lines.join('\n');
  }

  if (result.status === 'dry-run') {
    lines.push(`Dry run. Would create ${result.template.name}: ${result.request.appName}`);
    lines.push('');
    lines.push(`Directory: ${result.displayDir}`);
    lines.push('Files:');
    for (const file of result.filesCreated) lines.push(`  + ${file}`);
    lines.push('');
    lines.push('Nothing was written.');
    return lines.join('\n');
  }

  lines.push(`Done. Created ${result.request.appName}.`);
  if (result.progress) {
    lines.push('');
    lines.push('Plan');
    for (const task of result.progress.tasks) {
      lines.push(`  ${TASK_SYMBOL[task.status]} ${task.title}${task.detail ? `  ${task.detail}` : ''}`);
    }
  }
  lines.push('');
  lines.push(`App directory:\n${result.displayDir}`);
  lines.push('');
  lines.push('Files created:');
  for (const file of result.filesCreated) lines.push(`  + ${file}`);

  if (result.validation) {
    lines.push('');
    lines.push(result.validation.passed ? 'Validation:' : 'Validation (some checks failed):');
    lines.push(formatValidation(result.validation));
    if (result.uiSmoke) lines.push(uiSmokeLine(result.uiSmoke));
  }

  if (result.uiSmokeRequiredFailed) {
    lines.push('');
    lines.push('UI smoke was required (--require-ui-smoke) but did not pass.');
  }

  // Surface UI smoke artifacts (Phase 20E, Task G).
  if (result.uiSmoke) {
    const artifacts: string[] = [];
    if (result.uiSmoke.screenshotPath) artifacts.push(`  Screenshot: ${result.uiSmoke.screenshotPath}`);
    if (result.uiSmoke.reportPath) artifacts.push(`  Report: ${result.uiSmoke.reportPath}`);
    if (artifacts.length > 0) {
      lines.push('');
      lines.push('Artifacts:');
      lines.push(...artifacts);
    }
  }

  if (result.request.notes.length > 0) {
    lines.push('');
    lines.push('Notes (honest scope):');
    for (const note of result.request.notes) lines.push(`  - ${note}`);
  }

  lines.push('');
  lines.push('Open:');
  for (const step of result.template.openInstructions(result.displayDir)) lines.push(`  ${step}`);

  lines.push('');
  lines.push('Next:');
  if (!result.template.requiresCommands) lines.push(`  - apeironcode test-ui ${result.displayDir}   (browser UI smoke)`);
  lines.push('  - apeironcode improve "make this more premium"');
  lines.push('  - apeironcode fix');
  lines.push(`  - git add ${result.displayDir}`);
  return lines.join('\n');
};
