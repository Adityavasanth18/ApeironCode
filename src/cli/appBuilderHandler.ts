import readline from 'node:readline/promises';

import {ConfigStore} from '../config/config.js';
import {buildApp} from '../appBuilder/appBuilder.js';
import {formatAppReport} from '../appBuilder/appReport.js';

export interface NewCliOptions {
  stack?: string;
  style?: string;
  dir?: string;
  yes?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
  uiSmoke?: boolean;
  requireUiSmoke?: boolean;
}

/**
 * `apeironcode new` / `apeironcode build` handler (Phase 20C). Deterministic
 * template-based app creation — no API key or model required. Writes are
 * approval-gated: auto in bypass/trusted mode or with `--yes`, otherwise a
 * single bundled y/N prompt. Non-interactive without `--yes` declines.
 */
export const runNewCommand = async (cwd: string, idea: string | undefined, options: NewCliOptions): Promise<void> => {
  const trimmed = (idea ?? '').trim();
  if (!trimmed && !options.dir) {
    process.stdout.write(
      'Describe the app to create, e.g.\n' +
        '  apeironcode new "premium todo app"\n' +
        '  apeironcode new "CRM dashboard" --stack dashboard\n' +
        '  apeironcode new "landing page for an AI startup" --style premium-saas\n',
    );
    return;
  }

  const configStore = new ConfigStore(cwd);
  const resolved = await configStore.load();
  const autoApprove =
    resolved.effective.approvalMode === 'bypass' || resolved.effective.approvalMode === 'trusted';

  const approve = async (bundle: {title: string; body: string; risk: string}): Promise<boolean> => {
    process.stdout.write(`\n${bundle.body}\n`);
    if (options.dryRun) return false;
    if (autoApprove || options.yes) {
      process.stdout.write('Auto-approved (approval mode allows it).\n');
      return true;
    }
    if (!process.stdin.isTTY) {
      process.stdout.write('Non-interactive terminal: declining (re-run with --yes to create the app).\n');
      return false;
    }
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    try {
      const answer = (await rl.question('Create this app? [y/N] ')).trim().toLowerCase();
      return answer === 'y' || answer === 'yes';
    } finally {
      rl.close();
    }
  };

  const result = await buildApp(trimmed || 'app', {
    cwd,
    dir: options.dir,
    stack: options.stack,
    style: options.style,
    dryRun: options.dryRun,
    overwrite: options.overwrite,
    uiSmoke: options.uiSmoke,
    requireUiSmoke: options.requireUiSmoke,
    // Command validation (Vite build) is left to the user via the open
    // instructions; the CLI never auto-installs dependencies.
    runCommands: false,
    approve,
  });

  process.stdout.write(`${formatAppReport(result)}\n`);
  if (result.status === 'blocked-existing' || result.status === 'write-error' || result.uiSmokeRequiredFailed) {
    process.exitCode = 1;
  }
};
