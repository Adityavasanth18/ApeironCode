import {promises as fs} from 'node:fs';
import path from 'node:path';

import {parseAppRequest, slugify, type ParseAppRequestOptions} from './requestParser.js';
import {selectTemplate} from './templateRegistry.js';
import {renderTemplate, writeTemplateFiles} from './templateRenderer.js';
import {validateApp} from './appValidation.js';
import {buildAppApprovalBundle, type AppBuildResult} from './appReport.js';
import {runUiSmoke} from '../uiSmoke/runUiSmoke.js';
import type {BrowserLauncher} from '../uiSmoke/types.js';
import {ProgressStore} from '../progress/progressStore.js';
import type {AppRequest, AppTemplate, TemplateVariables} from './types.js';

export interface BuildAppOptions extends ParseAppRequestOptions {
  cwd: string;
  /** Explicit output directory (absolute or relative to cwd). */
  dir?: string;
  dryRun?: boolean;
  /** Allow writing into a non-empty directory (still never overwrites files). */
  overwrite?: boolean;
  /** Run command validation steps (Vite build) — only in temp/approved flows. */
  runCommands?: boolean;
  /** Run a browser UI smoke after creation (static apps; skipped if no browser). */
  uiSmoke?: boolean;
  /** Require the UI smoke to pass; a skip/fail marks the build as failed. */
  requireUiSmoke?: boolean;
  /** Inject a browser launcher (tests use a deterministic one). */
  uiSmokeLauncher?: BrowserLauncher;
  signal?: AbortSignal;
  /** Approval gate. Returns true to proceed with writes. */
  approve: (bundle: {title: string; body: string; risk: 'low' | 'medium'}) => Promise<boolean>;
}

const toVars = (request: AppRequest): TemplateVariables => ({
  appName: request.appName,
  appSlug: request.appSlug,
  description: request.description,
  style: request.style,
  features: request.features,
});

const isNonEmptyDir = async (dir: string): Promise<boolean> => {
  try {
    const entries = await fs.readdir(dir);
    return entries.length > 0;
  } catch {
    return false; // does not exist → treated as empty/creatable
  }
};

const resolveAppDir = (options: BuildAppOptions, request: AppRequest): string =>
  options.dir
    ? path.resolve(options.cwd, options.dir)
    : path.resolve(options.cwd, request.appSlug);

/**
 * Build a new app from a template (Phase 20C). Deterministic: parse → select →
 * render → approve → write → validate. Never overwrites a non-empty directory
 * without `overwrite`, never writes outside the app dir, and never fakes green.
 */
export const buildApp = async (idea: string, options: BuildAppOptions): Promise<AppBuildResult> => {
  const request = parseAppRequest(idea, options);
  if (options.dir) {
    // Keep the slug aligned with an explicit directory name for nicer reports.
    request.appSlug = slugify(path.basename(path.resolve(options.cwd, options.dir)));
  }
  const template: AppTemplate = selectTemplate(request);
  const vars = toVars(request);
  const appDir = resolveAppDir(options, request);
  const relativeDir = path.relative(options.cwd, appDir);
  // Show a clean relative path when inside the workspace, otherwise the
  // absolute path (avoids ugly ../../../ chains for temp/explicit dirs).
  const displayDir = !relativeDir || relativeDir.startsWith('..') || path.isAbsolute(relativeDir)
    ? appDir
    : `./${relativeDir}`;

  const rendered = renderTemplate(template, vars);
  if (rendered.errors.length > 0) {
    return baseResult(request, template, appDir, displayDir, 'write-error', rendered.errors);
  }
  const fileList = rendered.files.map((file) => file.path);

  // Overwrite protection: a non-empty target needs explicit --overwrite.
  if ((await isNonEmptyDir(appDir)) && !options.overwrite) {
    return baseResult(request, template, appDir, displayDir, 'blocked-existing', []);
  }

  if (options.dryRun) {
    return {...baseResult(request, template, appDir, displayDir, 'dry-run', request.notes), filesCreated: fileList};
  }

  const bundle = buildAppApprovalBundle(request, template, displayDir, rendered.files);
  if (!(await options.approve(bundle))) {
    return baseResult(request, template, appDir, displayDir, 'rejected', []);
  }

  // `--overwrite` only unblocks a non-empty directory; individual existing
  // files are still never replaced (reported as refusals in notes).
  const writeResult = await writeTemplateFiles(appDir, rendered.files, {overwrite: false});
  if (writeResult.errors.length > 0 && writeResult.written.length === 0) {
    return baseResult(request, template, appDir, displayDir, 'write-error', writeResult.errors);
  }

  // Lightweight metadata so `apeironcode test-ui` can pick template-specific
  // interaction checks. `.apeironcode` is a runtime/gitignored directory.
  await fs.mkdir(path.join(appDir, '.apeironcode'), {recursive: true}).catch(() => undefined);
  await fs
    .writeFile(
      path.join(appDir, '.apeironcode', 'app.json'),
      JSON.stringify({createdBy: 'ApeironCode', templateId: template.id, appName: request.appName, createdAt: new Date().toISOString()}, null, 2),
      'utf8',
    )
    .catch(() => undefined);

  const validation = await validateApp(appDir, template, vars, rendered.files, {
    runCommands: options.runCommands,
    signal: options.signal,
  });

  let uiSmoke;
  let uiSmokeRequiredFailed = false;
  if ((options.uiSmoke || options.requireUiSmoke) && !template.requiresCommands) {
    uiSmoke = await runUiSmoke(appDir, {cwd: appDir, screenshot: true, launcher: options.uiSmokeLauncher});
    if (options.requireUiSmoke && uiSmoke.status !== 'passed') uiSmokeRequiredFailed = true;
  }

  // Build the progress run for the live board (Phase 20E.5, Task A).
  const progress = new ProgressStore('new', `Build ${request.appName}`, {projectPath: displayDir})
    .planTasks([
      {id: 'parse', title: 'Parse request'},
      {id: 'template', title: 'Select template'},
      {id: 'approve', title: 'Await approval'},
      {id: 'write', title: 'Write files'},
      {id: 'validate', title: 'Run static validation'},
      {id: 'smoke', title: 'Run UI smoke'},
    ])
    .setTask('parse', 'passed', request.kind)
    .setTask('template', 'passed', template.id)
    .setTask('approve', 'passed')
    .setTask('write', writeResult.written.length > 0 ? 'passed' : 'failed', `${writeResult.written.length} file(s)`)
    .setTask('validate', validation.passed ? 'passed' : 'failed')
    .setTask('smoke', uiSmoke ? (uiSmoke.status === 'passed' ? 'passed' : uiSmoke.status === 'failed' ? 'failed' : 'skipped') : 'skipped', uiSmoke?.summary)
    .addFiles(writeResult.written.map((p) => ({path: p, operation: 'create' as const, status: 'applied' as const})))
    .snapshot();

  return {
    request,
    template,
    appDir,
    displayDir,
    filesCreated: writeResult.written,
    validation,
    uiSmoke,
    uiSmokeRequiredFailed,
    progress,
    status: 'created',
    notes: [...request.notes, ...writeResult.errors],
  };
};

const baseResult = (
  request: AppRequest,
  template: AppTemplate,
  appDir: string,
  displayDir: string,
  status: AppBuildResult['status'],
  notes: string[],
): AppBuildResult => ({request, template, appDir, displayDir, filesCreated: [], status, notes});
