import type {RepairIssue} from './types.js';

export interface FailureSummary {
  /** The single most actionable issue to fix first. */
  primary: RepairIssue;
  issues: RepairIssue[];
  /** Distinct files referenced by the issues (for context selection). */
  files: string[];
}

const CONFIDENCE_RANK = {high: 3, medium: 2, low: 1} as const;
// Prefer root-cause kinds first.
const KIND_RANK: Record<RepairIssue['kind'], number> = {
  syntax: 6,
  'module-not-found': 5,
  dependency: 4,
  typecheck: 3,
  test: 2,
  build: 1,
  lint: 1,
  unknown: 0,
};

/**
 * Rank parsed issues to pick the first actionable root cause and collect the
 * files involved. Higher kind rank and confidence win; a known file breaks ties.
 */
export const classifyFailures = (issues: RepairIssue[]): FailureSummary | undefined => {
  if (issues.length === 0) return undefined;
  const sorted = [...issues].sort((a, b) => {
    const kind = KIND_RANK[b.kind] - KIND_RANK[a.kind];
    if (kind !== 0) return kind;
    const conf = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (conf !== 0) return conf;
    return (b.file ? 1 : 0) - (a.file ? 1 : 0);
  });
  const files = [...new Set(issues.map((issue) => issue.file).filter((f): f is string => Boolean(f)))];
  return {primary: sorted[0]!, issues: sorted, files};
};

export const formatIssueLine = (issue: RepairIssue): string => {
  const loc = issue.file ? ` in ${issue.file}${issue.line ? `:${issue.line}` : ''}` : '';
  return `[${issue.kind}] ${issue.message}${loc}`;
};
