import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {AppTemplate, TemplateFile, TemplateVariables} from './types.js';

/** A rendered file path is unsafe if it is absolute, escapes the app dir, or hits .git/.env. */
export const isUnsafeTemplatePath = (relPath: string): boolean => {
  if (!relPath.trim() || path.isAbsolute(relPath) || relPath.startsWith('~')) return true;
  const normalized = path.normalize(relPath);
  if (normalized.startsWith('..') || normalized.split(/[\\/]/u).includes('..')) return true;
  if (/(?:^|[\\/])\.git(?:[\\/]|$)/u.test(normalized)) return true;
  if (/(?:^|[\\/])\.env(?:\.|$)/u.test(normalized)) return true;
  return false;
};

export interface RenderResult {
  files: TemplateFile[];
  errors: string[];
}

/**
 * Render a template's files for the given variables and validate every output
 * path is safe (relative, inside the app dir, never `.git`/`.env`).
 */
export const renderTemplate = (template: AppTemplate, vars: TemplateVariables): RenderResult => {
  const files = template.render(vars);
  const errors: string[] = [];
  for (const file of files) {
    if (isUnsafeTemplatePath(file.path)) errors.push(`unsafe template path: ${file.path}`);
  }
  return {files, errors};
};

export interface WriteResult {
  written: string[];
  errors: string[];
}

/**
 * Write rendered files into `appDir`. Refuses to write outside the directory and
 * never overwrites existing files (callers handle overwrite policy upstream).
 */
export const writeTemplateFiles = async (
  appDir: string,
  files: TemplateFile[],
  options: {overwrite?: boolean} = {},
): Promise<WriteResult> => {
  const written: string[] = [];
  const errors: string[] = [];
  const root = path.resolve(appDir);

  for (const file of files) {
    if (isUnsafeTemplatePath(file.path)) {
      errors.push(`refused unsafe path: ${file.path}`);
      continue;
    }
    const target = path.resolve(root, file.path);
    if (target !== root && !target.startsWith(root + path.sep)) {
      errors.push(`refused path outside app dir: ${file.path}`);
      continue;
    }
    if (!options.overwrite) {
      const exists = await fs.access(target).then(() => true).catch(() => false);
      if (exists) {
        errors.push(`refused to overwrite existing file: ${file.path}`);
        continue;
      }
    }
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, file.content, 'utf8');
    written.push(file.path);
  }
  return {written, errors};
};
