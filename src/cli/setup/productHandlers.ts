import type {CliHandlers} from '../commands.js';
import type {FixCliOptions} from '../fixHandler.js';
import type {NewCliOptions} from '../appBuilderHandler.js';
import type {TestUiCliOptions} from '../testUiHandler.js';
import type {RollbackCliOptions} from '../rollbackHandler.js';
import type {ReviewResult} from '../reviewHandler.js';

/**
 * Phase 20B–20E headline product commands (`fix`, `new`/`build`, `test-ui`,
 * `review`, `rollback`). Each lazily imports its handler so the core command
 * path stays light.
 */
export const createProductHandlers = (
  cwd: string,
): Pick<CliHandlers, 'fix' | 'newApp' | 'testUi' | 'review' | 'rollback'> => ({
  async fix(options: FixCliOptions) {
    await (await import('../fixHandler.js')).runFixCommand(cwd, options);
  },
  async newApp(idea: string | undefined, options: NewCliOptions) {
    await (await import('../appBuilderHandler.js')).runNewCommand(cwd, idea, options);
  },
  async testUi(target: string | undefined, options: TestUiCliOptions) {
    await (await import('../testUiHandler.js')).runTestUiCommand(cwd, target, options);
  },
  async review(idea: string | undefined): Promise<ReviewResult> {
    return (await import('../reviewHandler.js')).runReviewCommand(cwd, idea);
  },
  async rollback(idOrSub: string | undefined, options: RollbackCliOptions) {
    await (await import('../rollbackHandler.js')).runRollbackCommand(cwd, idOrSub, options);
  },
});
