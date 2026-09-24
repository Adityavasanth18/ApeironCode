import type {Command} from 'commander';

import type {CliHandlers} from './commands/types.js';
import type {DoctorCliOptions} from './args.js';
import {collectOptions} from './commands.js';

/**
 * Commands shown in the default `apeironcode --help`. Everything else still
 * works but is grouped under `apeironcode help developer` / `help advanced` so
 * the first-run surface stays focused on the four killer workflows plus the
 * three onboarding commands.
 */
export const BEGINNER_COMMANDS = [
  'new',
  'fix',
  'build',
  'improve',
  'review',
  'demo',
  'doctor',
  'setup',
  'help',
] as const;

const BEGINNER_SET = new Set<string>(BEGINNER_COMMANDS);

interface HelpGroup {
  title: string;
  intro: string;
  rows: Array<{command: string; description: string}>;
  footer?: string;
}

const DEVELOPER_GROUP: HelpGroup = {
  title: 'ApeironCode developer commands',
  intro: 'Everyday commands for configuring providers and driving the agent.',
  rows: [
    {command: 'provider', description: 'list, test, and configure model providers'},
    {command: 'model', description: 'list and recommend models for the active provider'},
    {command: 'context', description: 'inspect repo context, budget, and selected files'},
    {command: 'workflow', description: 'list and run typed multi-step workflows'},
    {command: 'test-ui', description: 'browser UI smoke for a generated app (needs Chromium)'},
    {command: 'github', description: 'issues, PRs, and CI inspection (dry-run by default)'},
    {command: 'memory', description: 'review and manage durable project memory'},
    {command: 'session(s)', description: 'manage saved local sessions and history'},
    {command: 'config', description: 'inspect or update local configuration'},
    {command: 'revert', description: 'undo the last edit or a specific edit id'},
  ],
  footer: 'Run `apeironcode <command> --help` for details.',
};

const ADVANCED_GROUP: HelpGroup = {
  title: 'ApeironCode advanced / experimental commands',
  intro: 'Power features. Some are experimental and may change.',
  rows: [
    {command: 'mcp', description: 'manage Model Context Protocol servers'},
    {command: 'skills', description: 'discover, create, and run scoped skills'},
    {command: 'team', description: 'run isolated multi-agent team workspaces'},
    {command: 'hooks', description: 'manage lifecycle hooks'},
    {command: 'bridge', description: 'editor/IDE bridge integration'},
    {command: 'runtime', description: 'inspect runtime routing and intent'},
    {command: 'sandbox', description: 'inspect optional sandbox backends'},
    {command: 'rollback', description: 'restore files from a fix checkpoint (rollback list / --last)'},
    {command: 'plugins', description: 'list loaded plugins and their tools'},
    {command: 'brain', description: 'preview and manage optional Project Brain files'},
    {command: 'permissions', description: 'manage permission rules'},
    {command: 'debug', description: 'safe local debugging snapshots'},
  ],
  footer: 'Run `apeironcode <command> --help` for details.',
};

export const formatHelpGroup = (group: HelpGroup): string => {
  const width = Math.max(...group.rows.map((row) => row.command.length));
  const lines: string[] = [group.title, '', group.intro, ''];
  for (const row of group.rows) {
    lines.push(`  ${row.command.padEnd(width)}  ${row.description}`);
  }
  if (group.footer) {
    lines.push('');
    lines.push(group.footer);
  }
  return lines.join('\n');
};

export const formatDeveloperHelp = (): string => formatHelpGroup(DEVELOPER_GROUP);
export const formatAdvancedHelp = (): string => formatHelpGroup(ADVANCED_GROUP);

/**
 * Register the headline workflow commands (fix/new/build/improve/review/
 * rollback) plus `help developer` / `help advanced`, and restrict the default
 * `--help` listing to beginner commands. Every other command stays registered
 * and functional.
 */
export const registerWorkflowAndHelp = (program: Command, handlers: CliHandlers): void => {
  // `fix` runs the Phase 20B repair loop (detect → check → propose → approve →
  // apply → rerun), not the generic agent prompt.
  program
    .command('fix')
    .description('detect failures, propose approval-gated fixes, and rerun checks')
    .argument('[description...]', 'optional note about what to fix')
    .option('--all', 'include build/e2e checks and allow more attempts')
    .option('--safe', 'restrict edits to files referenced by errors; max 2 attempts')
    .option('--until-green', 'keep attempting until checks pass (up to 10)')
    .option('--dry-run', 'detect project and list checks without running or writing')
    .option('--commit', '(planned) commit after a successful fix')
    .option('--yes', 'approve the repair bundle without prompting')
    .action(async (_parts: string[] | undefined, options: Record<string, boolean>) => {
      await handlers.fix({
        all: options.all,
        safe: options.safe,
        untilGreen: options.untilGreen,
        dryRun: options.dryRun,
        commit: options.commit,
        yes: options.yes,
      });
    });

  // `new` and `build` create a real app from a deterministic template
  // (Phase 20C). No API key or model required for template generation.
  const appBuilder = (name: 'new' | 'build', summary: string): void => {
    program
      .command(name)
      .description(summary)
      .argument('[idea...]', 'what to build, e.g. "premium todo app"')
      .option('--stack <stack>', 'static | dashboard | vite | next')
      .option('--style <style>', 'premium-saas | minimal | dark | apple-like')
      .option('--dir <dir>', 'output directory (default: slug of the idea)')
      .option('--dry-run', 'show the plan and files without writing anything')
      .option('--overwrite', 'allow writing into a non-empty directory (never replaces files silently)')
      .option('--ui-smoke', 'run a browser UI smoke after creating the app (needs Chromium)')
      .option('--no-ui-smoke', 'do not run the browser UI smoke')
      .option('--require-ui-smoke', 'fail if the UI smoke cannot run or does not pass')
      .option('--yes', 'create without an interactive prompt')
      .action(async (parts: string[] | undefined, options: Record<string, string | boolean | undefined>) => {
        await handlers.newApp((parts ?? []).join(' ') || undefined, {
          stack: options.stack as string | undefined,
          style: options.style as string | undefined,
          dir: options.dir as string | undefined,
          dryRun: Boolean(options.dryRun),
          overwrite: Boolean(options.overwrite),
          uiSmoke: Boolean(options.uiSmoke),
          requireUiSmoke: Boolean(options.requireUiSmoke),
          yes: Boolean(options.yes),
        });
      });
  };
  appBuilder('new', 'create a new app from a template (no API key needed)');
  appBuilder('build', 'build a new app from a template, e.g. build "a todo app"');

  // `improve` routes to the agent like the other workflows, but first attaches
  // the latest UI smoke report (Phase 20D, Task F) so it can target rendering /
  // interaction failures. No-provider handling falls through to runRoot's
  // existing first-run guidance.
  program
    .command('improve')
    .description('improve UI or code quality; attaches the latest UI smoke report as context')
    .argument('[description...]', 'what to improve')
    .action(async (parts: string[] | undefined, _options: unknown, command: Command) => {
      const idea = (parts ?? []).join(' ').trim();
      const {buildImproveUiContext} = await import('../uiSmoke/improveContext.js');
      const ctx = await buildImproveUiContext(process.cwd());
      const base = idea
        ? `Improve this: ${idea}`
        : 'Improve the UI/code quality of this project where it is weakest.';
      const prompt = ctx.hasReport ? `${base}\n\nUI smoke context:\n${ctx.promptContext}` : base;
      await handlers.runRoot(prompt, collectOptions({mode: 'refactor'}, command));
    });

  // `review` always runs a deterministic, provider-free diff review; with a real
  // provider configured it additionally routes a deeper review to the agent.
  program
    .command('review')
    .description('review the current git changes (deterministic; deeper with a provider)')
    .argument('[focus...]', 'optional focus, e.g. "security"')
    .action(async (parts: string[] | undefined, _options: unknown, command: Command) => {
      const result = await handlers.review((parts ?? []).join(' ') || undefined);
      if (result.routePrompt) {
        await handlers.runRoot(result.routePrompt, collectOptions({mode: 'review'}, command));
      }
    });

  program
    .command('rollback')
    .description('restore files from a checkpoint created before an approved fix')
    .argument('[id]', 'checkpoint id, or "list"')
    .option('--last', 'roll back the most recent checkpoint')
    .option('--yes', 'skip the confirmation prompt')
    .action(async (id: string | undefined, options: {last?: boolean; yes?: boolean}) => {
      await handlers.rollback(id, {last: options.last, yes: options.yes});
    });

  program
    .command('demo')
    .description('run a deterministic no-key demo (no API key, model, or Ollama)')
    .argument('[scenario]', 'todo-app | fix-test | improve-ui | review')
    .action(async (scenario: string | undefined) => {
      await handlers.demo(scenario);
    });

  program
    .command('test-ui')
    .description('open a generated app in a browser and run a UI smoke (needs Chromium)')
    .argument('[path]', 'app directory (default: current directory)')
    .option('--screenshot', 'save a screenshot (default on when a browser runs)')
    .option('--no-screenshot', 'do not save a screenshot')
    .option('--json', 'print the result as JSON')
    .option('--port <port>', 'static server port (default: ephemeral)')
    .option('--timeout <ms>', 'navigation timeout in milliseconds')
    .action(async (target: string | undefined, options: {screenshot?: boolean; json?: boolean; port?: string; timeout?: string}) => {
      await handlers.testUi(target, options);
    });

  const local = program.command('local').description('free local model (Ollama) setup and diagnostics');
  local
    .command('setup')
    .description('configure a free local model with Ollama')
    .action(async () => {
      await handlers.setup({local: true});
    });
  local
    .command('doctor')
    .description('diagnose local model / Ollama setup')
    .action(async (options: DoctorCliOptions, command: Command) => {
      await handlers.doctor(collectOptions(options, command));
    });

  program
    .command('real')
    .description('cloud provider setup')
    .command('setup')
    .description('choose and configure a real cloud provider')
    .action(async () => {
      await handlers.setup({});
    });

  // A single `help [topic]` command so commander's `help <command>` still works
  // while adding the curated `developer` / `advanced` groups.
  program
    .command('help')
    .description('show help; topics: developer, advanced, or a command name')
    .argument('[topic]', 'developer | advanced | <command>')
    .action((topic: string | undefined) => {
      if (!topic) {
        program.outputHelp();
        return;
      }
      if (topic === 'developer') {
        process.stdout.write(`${formatDeveloperHelp()}\n`);
        return;
      }
      if (topic === 'advanced') {
        process.stdout.write(`${formatAdvancedHelp()}\n`);
        return;
      }
      const sub = program.commands.find((c) => c.name() === topic);
      if (sub) {
        sub.outputHelp();
        return;
      }
      process.stdout.write(
        `Unknown help topic "${topic}". Try: developer, advanced, or a command name.\n`,
      );
    });

  // Restrict only the root program's help to beginner commands. Subcommand help
  // is unchanged. Hidden commands stay hidden everywhere (default behavior).
  program.configureHelp({
    visibleCommands: (cmd: Command) => {
      const visible = cmd.commands.filter((c) => !(c as {_hidden?: boolean})._hidden);
      if (cmd === program) {
        return visible.filter((c) => BEGINNER_SET.has(c.name()));
      }
      return visible;
    },
  });
};
