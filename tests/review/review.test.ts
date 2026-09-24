import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {buildDeterministicReview, formatReviewReport} from '../../src/review/reviewSummary.js';
import {gatherReviewContext} from '../../src/review/reviewContext.js';

describe('deterministic review', () => {
  it('handles no changes', () => {
    const text = formatReviewReport(buildDeterministicReview('', []));
    expect(text).toMatch(/No changes to review/);
  });

  it('flags loose equality, eval, console.log, and missing tests', () => {
    const diff = [
      '+if (x == 1) {}',
      '+eval("danger")',
      '+console.log("debug")',
    ].join('\n');
    const report = buildDeterministicReview(diff, [{path: 'src/a.ts', additions: 3, deletions: 0}]);
    expect(report.bugs.join(' ')).toMatch(/Loose equality/);
    expect(report.security.join(' ')).toMatch(/eval/);
    expect(report.maintainability.join(' ')).toMatch(/console\.log/);
    expect(report.tests.join(' ')).toMatch(/no test files changed/);
  });

  it('notes when test files are included', () => {
    const report = buildDeterministicReview('+test', [{path: 'tests/a.test.ts', additions: 1, deletions: 0}]);
    expect(report.tests.join(' ')).toMatch(/test file\(s\) changed/);
  });

  it('always offers next steps and a provider note', () => {
    const text = formatReviewReport(buildDeterministicReview('+x', [{path: 'a.ts', additions: 1, deletions: 0}]));
    expect(text).toMatch(/Suggested next steps/);
    expect(text).toMatch(/Configure a provider/);
  });
});

describe('review context (git)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-review-'));
  });
  afterEach(async () => {
    await fs.rm(dir, {recursive: true, force: true});
  });

  it('reports non-repo gracefully', async () => {
    const ctx = await gatherReviewContext(dir);
    expect(ctx.isRepo).toBe(false);
    expect(ctx.noDiff).toBe(true);
  });
});
