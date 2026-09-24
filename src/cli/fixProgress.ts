import {ProgressStore} from '../progress/progressStore.js';
import type {ProgressRun} from '../progress/types.js';
import type {RepairLoopResult} from '../repair/finalReport.js';

/**
 * Map a repair-loop result to a {@link ProgressRun} plus next-action suggestions
 * for the completion/failure panel (Phase 20E.5, Tasks A/F).
 */
export const buildFixProgress = (result: RepairLoopResult): {run: ProgressRun; nextActions: string[]} => {
  const store = new ProgressStore('fix', 'Fix detected failures', {projectPath: result.project.framework});
  store.planTasks([
    {id: 'detect', title: 'Detect project & checks'},
    {id: 'run', title: 'Run checks'},
    {id: 'repair', title: 'Generate & apply repair plan'},
    {id: 'rerun', title: 'Rerun checks'},
  ]);
  store.setTask('detect', 'passed', `${result.plannedChecks.length} check(s)`);
  store.setTask('run', result.status === 'green' && result.attempts.length === 0 ? 'passed' : 'failed');
  store.setTask('repair', result.attempts.some((a) => a.planApplied) ? 'passed' : result.attempts.length > 0 ? 'failed' : 'skipped');
  store.setTask('rerun', result.status === 'green' ? 'passed' : result.status === 'gave-up' || result.status === 'invalid-plan' ? 'failed' : 'skipped');

  for (const check of result.finalChecks) {
    store.addCommand({command: check.command, status: check.ok ? 'passed' : 'failed', exitCode: check.exitCode ?? undefined, outputExcerpt: check.ok ? undefined : check.output});
  }
  for (const checkpoint of result.checkpoints) {
    store.addArtifact({kind: 'checkpoint', label: 'Checkpoint', path: checkpoint});
  }
  store.setStatus(result.status === 'green' ? 'passed' : result.status === 'rejected' ? 'skipped' : 'failed');

  const nextActions: string[] = [];
  if (result.status !== 'green') {
    nextActions.push('apeironcode fix --until-green');
    if (result.checkpoints.length > 0) nextActions.push('apeironcode rollback --last');
    nextActions.push('apeironcode test-ui   (if this is a web app)');
  }
  return {run: store.snapshot(), nextActions};
};
