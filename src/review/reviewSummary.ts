/**
 * Deterministic, provider-free review summary (Phase 20E, Task I).
 *
 * This is a lightweight, rule-based pass over a git diff — not a deep reviewer.
 * It groups findings into the standard sections and is honest that a configured
 * provider gives a deeper review.
 */

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface ReviewReport {
  filesChanged: ChangedFile[];
  bugs: string[];
  tests: string[];
  security: string[];
  maintainability: string[];
  nextSteps: string[];
}

const ADDED_LINE_RE = /^\+(?!\+\+)/u;

const addedLines = (diff: string): string[] =>
  diff.split('\n').filter((line) => ADDED_LINE_RE.test(line)).map((line) => line.slice(1));

const isTestFile = (path: string): boolean => /\.(test|spec)\.[jt]sx?$/u.test(path) || /(?:^|\/)tests?\//u.test(path);
const isSourceFile = (path: string): boolean => /\.[jt]sx?$/u.test(path) && !isTestFile(path);

/**
 * Produce a deterministic review from a unified diff and the changed-file list.
 * Heuristics only; never claims to catch every issue.
 */
export const buildDeterministicReview = (diff: string, files: ChangedFile[]): ReviewReport => {
  const added = addedLines(diff);
  const bugs: string[] = [];
  const security: string[] = [];
  const maintainability: string[] = [];
  const tests: string[] = [];
  const nextSteps: string[] = [];

  for (const line of added) {
    if (/[^=!<>]==[^=]/u.test(line) && !/===|!==/u.test(line)) bugs.push('Loose equality (`==`) added — prefer strict `===`.');
    if (/\bconsole\.(log|debug)\b/u.test(line)) maintainability.push('`console.log`/`debug` added — remove debug logging before shipping.');
    if (/\bTODO\b|\bFIXME\b/u.test(line)) maintainability.push('TODO/FIXME added — track it before merging.');
    if (/:\s*any\b|\bas any\b/u.test(line)) maintainability.push('`any` type added — consider a precise type.');
    if (/\beval\s*\(/u.test(line)) security.push('`eval(` added — avoid dynamic evaluation.');
    if (/\binnerHTML\s*=/u.test(line)) security.push('`innerHTML =` added — risk of XSS; sanitize or use textContent.');
    if (/\bchild_process\b|\bexecSync\b/u.test(line)) security.push('Shell/child_process usage added — validate inputs and avoid shell injection.');
    if (/(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{8,}/iu.test(line)) security.push('Possible hard-coded secret added — move it to an environment variable.');
  }

  const changedSource = files.filter((f) => isSourceFile(f.path));
  const changedTests = files.filter((f) => isTestFile(f.path));
  if (changedSource.length > 0 && changedTests.length === 0) {
    tests.push('Source files changed but no test files changed — consider adding/updating tests.');
  } else if (changedTests.length > 0) {
    tests.push(`${changedTests.length} test file(s) changed.`);
  }

  const big = files.find((f) => f.additions + f.deletions > 400);
  if (big) maintainability.push(`Large change in ${big.path} (+${big.additions}/-${big.deletions}) — consider splitting.`);

  nextSteps.push('apeironcode fix — run checks and repair failures');
  if (changedSource.length > 0) nextSteps.push('apeironcode test-ui <app> — verify rendered UI if this is a web app');
  nextSteps.push('Configure a provider (apeironcode setup) for a deeper, model-driven review');

  return {
    filesChanged: files,
    bugs: dedupe(bugs),
    tests: dedupe(tests),
    security: dedupe(security),
    maintainability: dedupe(maintainability),
    nextSteps,
  };
};

const dedupe = (items: string[]): string[] => [...new Set(items)];

const section = (title: string, items: string[]): string[] =>
  items.length === 0 ? [`${title}: none found`] : [`${title}:`, ...items.map((i) => `  - ${i}`)];

/** Render the deterministic review report as text. */
export const formatReviewReport = (report: ReviewReport, options: {deep?: boolean} = {}): string => {
  const lines: string[] = ['ApeironCode Review', ''];
  if (report.filesChanged.length === 0) {
    lines.push('No changes to review (working tree is clean).');
    return lines.join('\n');
  }
  lines.push('Files changed:');
  for (const file of report.filesChanged) lines.push(`  ~ ${file.path}  +${file.additions}/-${file.deletions}`);
  lines.push('');
  lines.push(...section('Bugs / Risks', report.bugs));
  lines.push('');
  lines.push(...section('Tests', report.tests));
  lines.push('');
  lines.push(...section('Security / Safety', report.security));
  lines.push('');
  lines.push(...section('Maintainability', report.maintainability));
  lines.push('');
  lines.push('Suggested next steps:');
  for (const step of report.nextSteps) lines.push(`  - ${step}`);
  if (!options.deep) {
    lines.push('');
    lines.push('This is a deterministic, rule-based review. Configure a provider for a deeper review.');
  }
  return lines.join('\n');
};
