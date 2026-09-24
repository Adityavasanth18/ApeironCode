import {ConfigStore} from '../config/config.js';
import {gatherReviewContext} from '../review/reviewContext.js';
import {buildDeterministicReview, formatReviewReport} from '../review/reviewSummary.js';

export interface ReviewResult {
  /** When set, the caller should route this prompt to the agent for a deeper review. */
  routePrompt?: string;
}

/**
 * `apeironcode review` (Phase 20E, Task I). Always runs a deterministic,
 * provider-free diff review and prints it. When a real provider is configured,
 * it also returns an enriched prompt so the caller can route to the agent for a
 * deeper review. No diff / non-repo is handled gracefully.
 */
export const runReviewCommand = async (cwd: string, idea: string | undefined): Promise<ReviewResult> => {
  const ctx = await gatherReviewContext(cwd);

  if (!ctx.isRepo) {
    process.stdout.write('Not a git repository — nothing to review. Run from a git repo, or use `apeironcode demo review`.\n');
    return {};
  }
  if (ctx.noDiff) {
    process.stdout.write('No changes to review (working tree is clean vs HEAD).\n');
    return {};
  }

  const resolved = await new ConfigStore(cwd).load();
  const hasRealProvider = resolved.effective.defaultProvider !== 'mock';

  const report = buildDeterministicReview(ctx.diff, ctx.files);
  process.stdout.write(`${formatReviewReport(report, {deep: false})}\n`);

  if (!hasRealProvider) {
    return {};
  }

  // A real provider is configured: route a focused prompt for a deeper review.
  const focus = idea?.trim() ? `Focus: ${idea.trim()}\n` : '';
  const fileList = ctx.files.map((f) => `${f.path} (+${f.additions}/-${f.deletions})`).join(', ');
  const prompt = [
    'Review the current git changes for bugs, tests, security, and maintainability.',
    focus,
    `Changed files: ${fileList}`,
    '',
    'Diff (truncated):',
    ctx.diff.slice(0, 60_000),
  ].join('\n');
  return {routePrompt: prompt};
};
