import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {CheckKind, PackageManager, ProjectFramework, ProjectInfo} from './types.js';

const exists = (p: string): Promise<boolean> =>
  fs.access(p).then(() => true).catch(() => false);

const detectPackageManager = async (cwd: string): Promise<PackageManager> => {
  if (await exists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if ((await exists(path.join(cwd, 'bun.lockb'))) || (await exists(path.join(cwd, 'bun.lock')))) return 'bun';
  return 'npm';
};

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const readPackageJson = async (cwd: string): Promise<PackageJson | undefined> => {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8')) as PackageJson;
  } catch {
    return undefined;
  }
};

const detectFramework = (pkg: PackageJson | undefined, typescript: boolean): ProjectFramework => {
  const deps = {...pkg?.dependencies, ...pkg?.devDependencies};
  if (deps.next) return 'next';
  if (deps.vite) return 'vite';
  if (deps.react || deps['react-dom']) return 'react';
  if (deps.express) return 'express';
  if (!pkg) return 'unknown';
  // A package with a main/exports and no app framework looks like a library.
  if (typescript) return 'typescript';
  return 'node-library';
};

// Map a project's npm scripts onto canonical check kinds by name heuristics.
const SCRIPT_MATCHERS: Array<{kind: CheckKind; re: RegExp}> = [
  {kind: 'typecheck', re: /^(typecheck|type-check|tsc|types)$/iu},
  {kind: 'lint', re: /^(lint|eslint)$/iu},
  {kind: 'test', re: /^(test|tests|test:unit)$/iu},
  {kind: 'build', re: /^(build|compile)$/iu},
  {kind: 'e2e', re: /^(test:e2e|e2e|test:acceptance)$/iu},
];

const detectScripts = (pkg: PackageJson | undefined): Partial<Record<CheckKind, string>> => {
  const scripts: Partial<Record<CheckKind, string>> = {};
  if (!pkg?.scripts) return scripts;
  for (const name of Object.keys(pkg.scripts)) {
    for (const matcher of SCRIPT_MATCHERS) {
      if (matcher.re.test(name) && !scripts[matcher.kind]) scripts[matcher.kind] = name;
    }
  }
  return scripts;
};

/**
 * Detect project type, package manager, framework, and available check scripts.
 * Never throws — missing package.json / non-git directories return a usable
 * `unknown` result so `apeironcode fix` can degrade gracefully.
 */
export const detectProject = async (cwd: string): Promise<ProjectInfo> => {
  const [pkg, isGitRepo, hasNodeModules, hasTsconfig] = await Promise.all([
    readPackageJson(cwd),
    exists(path.join(cwd, '.git')),
    exists(path.join(cwd, 'node_modules')),
    exists(path.join(cwd, 'tsconfig.json')),
  ]);

  const typescript = hasTsconfig;
  return {
    cwd,
    isGitRepo,
    hasPackageJson: Boolean(pkg),
    hasNodeModules,
    packageManager: await detectPackageManager(cwd),
    framework: detectFramework(pkg, typescript),
    scripts: detectScripts(pkg),
    typescript,
  };
};

/** Format a one-line project summary for reports. */
export const formatProjectInfo = (info: ProjectInfo): string => {
  const scripts = Object.keys(info.scripts);
  return [
    `Project: ${info.framework}`,
    `package manager: ${info.packageManager}`,
    info.hasPackageJson ? `scripts: ${scripts.length ? scripts.join(', ') : 'none'}` : 'no package.json',
    info.isGitRepo ? 'git repo' : 'not a git repo',
  ].join(' · ');
};
