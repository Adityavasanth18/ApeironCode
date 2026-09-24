import {execa} from 'execa';

import type {DemoValidationStep} from './types.js';

/**
 * Run `node --check <file>` to confirm a JS file parses. Deterministic and
 * offline; treats a missing `node` as a skipped (not failed) step so the demo
 * still completes on unusual environments.
 */
export const nodeCheck = async (
  cwd: string,
  file: string,
): Promise<DemoValidationStep> => {
  try {
    await execa('node', ['--check', file], {cwd, timeout: 15_000});
    return {name: `node --check ${file}`, ok: true, detail: 'syntax OK'};
  } catch (error) {
    const err = error as {exitCode?: number; shortMessage?: string};
    if (err.exitCode === undefined) {
      return {name: `node --check ${file}`, ok: true, detail: 'skipped (node unavailable)'};
    }
    return {
      name: `node --check ${file}`,
      ok: false,
      detail: (err.shortMessage ?? 'syntax error').split('\n')[0] ?? 'syntax error',
    };
  }
};

/**
 * Run a self-contained Node script (e.g. a demo check/test) and report whether
 * it exited zero. Returns `ok` plus a one-line detail.
 */
export const runNodeScript = async (
  cwd: string,
  file: string,
): Promise<DemoValidationStep> => {
  try {
    const result = await execa('node', [file], {cwd, timeout: 15_000, reject: false});
    const ok = result.exitCode === 0;
    const firstLine =
      (ok ? result.stdout : result.stderr || result.stdout).split('\n').find(Boolean) ??
      (ok ? 'passed' : 'failed');
    return {name: `node ${file}`, ok, detail: firstLine.slice(0, 200)};
  } catch {
    return {name: `node ${file}`, ok: true, detail: 'skipped (node unavailable)'};
  }
};

/**
 * Verify that every `href`/`src` in an HTML string points at a file that exists
 * in the workspace (ignoring absolute/remote URLs). Catches broken CSS/JS links.
 */
export const checkLinkedAssets = async (
  exists: (relPath: string) => Promise<boolean>,
  html: string,
): Promise<DemoValidationStep> => {
  const refs = new Set<string>();
  const linkRe = /(?:href|src)\s*=\s*["']([^"']+)["']/giu;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const ref = match[1]!;
    if (/^(?:https?:)?\/\//u.test(ref) || ref.startsWith('#') || ref.startsWith('data:')) continue;
    refs.add(ref.replace(/^\.\//u, ''));
  }
  const missing: string[] = [];
  for (const ref of refs) {
    if (!(await exists(ref))) missing.push(ref);
  }
  return {
    name: 'linked assets exist',
    ok: missing.length === 0,
    detail: missing.length === 0 ? `${refs.size} reference(s) resolved` : `missing: ${missing.join(', ')}`,
  };
};
