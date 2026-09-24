import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {AppMetadata, UiTarget} from './types.js';

const exists = (p: string): Promise<boolean> =>
  fs.access(p).then(() => true).catch(() => false);

const readAppMeta = async (dir: string): Promise<AppMetadata | undefined> => {
  try {
    const raw = await fs.readFile(path.join(dir, '.apeironcode', 'app.json'), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppMetadata>;
    if (parsed.templateId && parsed.createdBy) {
      return {
        createdBy: parsed.createdBy,
        templateId: parsed.templateId,
        appName: parsed.appName ?? 'app',
        createdAt: parsed.createdAt ?? '',
      };
    }
  } catch {
    // no metadata
  }
  return undefined;
};

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const isViteProject = async (dir: string): Promise<boolean> => {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8')) as PackageJson;
    const deps = {...pkg.dependencies, ...pkg.devDependencies};
    return Boolean(deps.vite);
  } catch {
    return false;
  }
};

/**
 * Detect what kind of UI target a directory holds (Phase 20D, Task A). Uses
 * `.apeironcode/app.json` metadata when present, then static `index.html`, then
 * a Vite package.json. Returns an `unknown` target with an honest reason when no
 * web entry is found. Never throws.
 */
export const detectUiTarget = async (targetPath: string): Promise<UiTarget> => {
  const abs = path.resolve(targetPath);
  const meta = await readAppMeta(abs);

  // A nested index.html (e.g. app created in a subfolder) is still static.
  const hasIndex = await exists(path.join(abs, 'index.html'));
  if (hasIndex) {
    return {type: 'static', path: abs, entry: 'index.html', meta};
  }

  if (await isViteProject(abs)) {
    const installed = await exists(path.join(abs, 'node_modules'));
    return {
      type: 'vite',
      path: abs,
      meta,
      reason: installed ? undefined : 'dependencies not installed (run: npm install)',
    };
  }

  return {type: 'unknown', path: abs, meta, reason: 'no index.html or Vite project found'};
};
