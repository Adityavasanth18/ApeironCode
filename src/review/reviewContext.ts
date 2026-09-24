import {execa} from 'execa';

import type {ChangedFile} from './reviewSummary.js';

export interface ReviewContext {
  isRepo: boolean;
  noDiff: boolean;
  diff: string;
  files: ChangedFile[];
}

const git = async (cwd: string, args: string[]): Promise<string> => {
  const result = await execa('git', args, {cwd, reject: false});
  return result.exitCode === 0 ? result.stdout : '';
};

/**
 * Gather the local git diff for review (Phase 20E, Task I). Includes unstaged
 * and staged changes vs HEAD (or the index when there is no HEAD yet). Never
 * throws; non-repos return `isRepo: false`.
 */
export const gatherReviewContext = async (cwd: string): Promise<ReviewContext> => {
  const inside = await execa('git', ['rev-parse', '--is-inside-work-tree'], {cwd, reject: false});
  if (inside.exitCode !== 0 || inside.stdout.trim() !== 'true') {
    return {isRepo: false, noDiff: true, diff: '', files: []};
  }

  const hasHead = (await execa('git', ['rev-parse', '--verify', 'HEAD'], {cwd, reject: false})).exitCode === 0;
  const base = hasHead ? ['HEAD'] : [];

  const numstat = await git(cwd, ['diff', '--numstat', ...base]);
  const files: ChangedFile[] = numstat
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [add, del, ...rest] = line.split('\t');
      return {path: rest.join('\t'), additions: Number.parseInt(add ?? '0', 10) || 0, deletions: Number.parseInt(del ?? '0', 10) || 0};
    })
    .filter((file) => file.path);

  const diff = await git(cwd, ['diff', ...base]);
  // Cap the diff size we inspect to avoid huge memory/log usage.
  const cappedDiff = diff.length > 200_000 ? diff.slice(0, 200_000) : diff;

  return {isRepo: true, noDiff: files.length === 0, diff: cappedDiff, files};
};
