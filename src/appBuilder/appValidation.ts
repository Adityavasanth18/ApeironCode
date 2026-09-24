import {promises as fs} from 'node:fs';
import path from 'node:path';

import {redactOutput, truncateOutput} from '../repair/checkRunner.js';
import {SandboxManager} from '../sandbox/manager.js';
import {runDesignChecklist} from './designQuality.js';
import type {AppTemplate, TemplateFile, TemplateVariables} from './types.js';

export interface AppValidationStepResult {
  name: string;
  command?: string;
  passed: boolean;
  skipped?: boolean;
  outputExcerpt: string;
}

export interface AppValidationResult {
  passed: boolean;
  steps: AppValidationStepResult[];
}

const fileExists = (abs: string): Promise<boolean> =>
  fs.access(abs).then(() => true).catch(() => false);

const linkedRefs = (html: string): string[] => {
  const refs: string[] = [];
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/giu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const ref = match[1]!;
    if (/^(?:https?:)?\/\//u.test(ref) || ref.startsWith('#') || ref.startsWith('data:') || ref.startsWith('/')) continue;
    refs.push(ref.replace(/^\.\//u, ''));
  }
  return refs;
};

export interface ValidateAppOptions {
  /** Run command steps (npm build/typecheck). Only in temp/approved workspaces. */
  runCommands?: boolean;
  signal?: AbortSignal;
}

/**
 * Validate a generated app (Phase 20C, Task E). Static checks (files exist,
 * linked assets, `node --check`, design checklist) always run and need no
 * network. Command steps (Vite build/typecheck) only run when `runCommands` is
 * set; otherwise they are reported as skipped (not failed). Never fakes green.
 */
export const validateApp = async (
  appDir: string,
  template: AppTemplate,
  vars: TemplateVariables,
  files: TemplateFile[],
  options: ValidateAppOptions = {},
): Promise<AppValidationResult> => {
  const steps: AppValidationStepResult[] = [];

  for (const step of template.validation(vars)) {
    if (step.kind === 'files-exist') {
      const missing: string[] = [];
      for (const file of files) {
        if (!(await fileExists(path.join(appDir, file.path)))) missing.push(file.path);
      }
      steps.push({name: step.name, passed: missing.length === 0, outputExcerpt: missing.length ? `missing: ${missing.join(', ')}` : `${files.length} file(s)`});
    } else if (step.kind === 'linked-assets') {
      const entry = step.entry ?? 'index.html';
      const html = await fs.readFile(path.join(appDir, entry), 'utf8').catch(() => '');
      const refs = linkedRefs(html);
      const missing: string[] = [];
      for (const ref of refs) {
        if (!(await fileExists(path.join(appDir, ref)))) missing.push(ref);
      }
      steps.push({name: step.name, passed: missing.length === 0, outputExcerpt: missing.length ? `missing: ${missing.join(', ')}` : `${refs.length} reference(s)`});
    } else if (step.kind === 'node-check') {
      const file = step.file ?? 'app.js';
      const result = await runNodeCheck(appDir, file, options.signal);
      steps.push({name: step.name, passed: result.ok, outputExcerpt: result.detail});
    } else if (step.kind === 'design-checklist') {
      const checklist = runDesignChecklist(files, step.entry ?? 'index.html');
      const failed = checklist.checks.filter((c) => !c.ok).map((c) => c.name);
      steps.push({name: step.name, passed: checklist.ok, outputExcerpt: checklist.ok ? 'all design checks pass' : `failed: ${failed.join(', ')}`});
    } else if (step.kind === 'command') {
      if (!options.runCommands || !step.command) {
        steps.push({name: step.name, command: step.command, passed: true, skipped: true, outputExcerpt: 'skipped (run with install/approval)'});
        continue;
      }
      const result = await runCommandStep(appDir, step.command, options.signal);
      steps.push({name: step.name, command: step.command, passed: result.ok, outputExcerpt: result.detail});
    }
  }

  // Skipped command steps do not fail the overall result.
  const passed = steps.every((step) => step.passed || step.skipped);
  return {passed, steps};
};

const runNodeCheck = async (
  cwd: string,
  file: string,
  signal?: AbortSignal,
): Promise<{ok: boolean; detail: string}> => {
  const manager = new SandboxManager({workspace: cwd});
  try {
    const result = await manager.executeCommand(`node --check ${JSON.stringify(file)}`, {cwd, timeout: 15_000, signal, workspace: cwd});
    return result.ok
      ? {ok: true, detail: 'syntax OK'}
      : {ok: false, detail: redactOutput(truncateOutput(result.stderr || result.stdout || 'syntax error', 400)).split('\n')[0] ?? 'syntax error'};
  } catch (error) {
    return {ok: false, detail: redactOutput(truncateOutput(String(error), 400))};
  } finally {
    await manager.dispose();
  }
};

const runCommandStep = async (
  cwd: string,
  command: string,
  signal?: AbortSignal,
): Promise<{ok: boolean; detail: string}> => {
  const manager = new SandboxManager({workspace: cwd});
  try {
    const result = await manager.executeCommand(command, {cwd, timeout: 300_000, signal, workspace: cwd});
    return {ok: result.exitCode === 0, detail: redactOutput(truncateOutput([result.stdout, result.stderr, result.warning].filter(Boolean).join('\n'), 600)).split('\n').slice(-3).join(' ')};
  } catch (error) {
    return {ok: false, detail: redactOutput(truncateOutput(String(error), 400))};
  } finally {
    await manager.dispose();
  }
};

export const formatValidation = (result: AppValidationResult): string =>
  result.steps
    .map((step) => `  ${step.skipped ? '·' : step.passed ? '✓' : '✗'} ${step.name}${step.skipped ? ' (skipped)' : ''} — ${step.outputExcerpt}`)
    .join('\n');
