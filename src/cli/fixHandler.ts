import readline from 'node:readline/promises';

import {ConfigStore} from '../config/config.js';
import {providerRegistry} from '../providers/registry.js';
import type {ModelProvider} from '../providers/types.js';
import {ApprovalManager} from '../safety/approvals.js';
import {createDefaultToolRegistry} from '../tools/registry.js';
import {executeFilePlan} from '../agent/filePlanExecutor.js';
import type {FilePlan} from '../agent/filePlanProtocol.js';
import {runRepairLoop, type RepairMode} from '../repair/repairLoop.js';
import {formatRepairReport} from '../repair/finalReport.js';
import type {ApprovalBundle} from '../repair/approvalBundle.js';

export interface FixCliOptions {
  all?: boolean;
  safe?: boolean;
  untilGreen?: boolean;
  dryRun?: boolean;
  commit?: boolean;
  yes?: boolean;
}

const resolveMode = (options: FixCliOptions): RepairMode => {
  if (options.safe) return 'safe';
  if (options.untilGreen) return 'until-green';
  if (options.all) return 'all';
  return 'normal';
};

const streamProviderText = async (
  provider: ModelProvider,
  model: string,
  prompt: string,
): Promise<string> => {
  let text = '';
  for await (const chunk of provider.stream({
    messages: [{content: prompt, role: 'user'}],
    model,
    temperature: 0.2,
    tools: [],
  })) {
    if (chunk.type === 'token') text += chunk.token ?? '';
  }
  return text;
};

/**
 * `apeironcode fix` handler (Phase 20B). Owns the repair workflow via
 * `runRepairLoop`; the provider only proposes minimal plans. Dry-run never
 * constructs a provider or writes anything. Approval is required before changes:
 * auto in bypass/trusted mode, otherwise a single bundled y/N prompt.
 */
export const runFixCommand = async (cwd: string, options: FixCliOptions): Promise<void> => {
  const configStore = new ConfigStore(cwd);
  const resolved = await configStore.load();
  const config = resolved.effective;
  const mode = resolveMode(options);

  if (options.commit) {
    process.stdout.write('--commit is planned for Phase 20E ship workflow and is not active yet.\n');
  }

  const autoApprove = config.approvalMode === 'bypass' || config.approvalMode === 'trusted';

  const approve = async (bundle: ApprovalBundle): Promise<boolean> => {
    process.stdout.write(`\n${bundle.body}\n`);
    if (autoApprove || options.yes) {
      process.stdout.write('Auto-approved (approval mode allows it).\n');
      return true;
    }
    if (!process.stdin.isTTY) {
      process.stdout.write('Non-interactive terminal: declining repair plan (use --yes or set approval mode).\n');
      return false;
    }
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    try {
      const answer = (await rl.question('Approve this repair plan? [y/N] ')).trim().toLowerCase();
      return answer === 'y' || answer === 'yes';
    } finally {
      rl.close();
    }
  };

  const applyPlan = async (
    plan: FilePlan,
    planCwd: string,
  ): Promise<{ok: boolean; errors: string[]; filesChanged: string[]}> => {
    // The loop already obtained bundled approval, so apply with a bypass manager
    // (writes still go through ToolRegistry).
    const toolRegistry = createDefaultToolRegistry();
    const result = await executeFilePlan(plan, {
      approvalManager: new ApprovalManager('bypass'),
      config,
      cwd: planCwd,
      toolRegistry,
    });
    return {ok: result.ok, errors: result.errors, filesChanged: result.filesChanged};
  };

  // Dry-run never constructs a provider.
  const requestPlan = async (prompt: string): Promise<string> => {
    const provider = providerRegistry.createActive(config);
    return streamProviderText(provider, config.defaultModel, prompt);
  };

  const result = await runRepairLoop(
    {cwd, mode, dryRun: Boolean(options.dryRun)},
    {requestPlan, approve, applyPlan},
  );

  process.stdout.write(`${formatRepairReport(result)}\n`);

  // Completion/failure panel with next actions (Phase 20E.5, Task F).
  if (result.status !== 'dry-run' && result.status !== 'no-checks') {
    const {buildFixProgress} = await import('./fixProgress.js');
    const {formatCompletionPanel} = await import('../progress/completionPanel.js');
    const {run, nextActions} = buildFixProgress(result);
    process.stdout.write(`\n${formatCompletionPanel(run, {nextActions})}\n`);
  }

  if (result.status !== 'green' && result.status !== 'dry-run' && result.status !== 'no-checks') {
    process.exitCode = 1;
  }
};
