import {describe, expect, it, vi} from 'vitest';

import {buildProgram} from '../../src/cli/commands.js';
import {formatAdvancedHelp, formatDeveloperHelp} from '../../src/cli/help.js';
import type {CliHandlers} from '../../src/cli/commands/types.js';

const makeHandlers = (runRoot = vi.fn(() => Promise.resolve())): CliHandlers => {
  const target: Record<string, unknown> = {runRoot};
  return new Proxy(target, {
    get(t, prop: string) {
      if (!(prop in t)) t[prop] = vi.fn(() => Promise.resolve());
      return t[prop];
    },
  }) as unknown as CliHandlers;
};

const rootHelp = (): string => {
  const program = buildProgram(makeHandlers());
  program.configureOutput({writeErr: () => undefined, writeOut: () => undefined});
  return program.helpInformation();
};

describe('beginner-focused CLI help', () => {
  it('default help lists the four workflows plus demo/doctor/setup', () => {
    const help = rootHelp();
    for (const cmd of ['fix', 'build', 'improve', 'review', 'demo', 'doctor', 'setup']) {
      expect(help, cmd).toMatch(new RegExp(`\\n  ${cmd}\\b`));
    }
  });

  it('default help does not expose the advanced command list', () => {
    const help = rootHelp();
    // These remain runnable but must not appear in the beginner command list.
    for (const hidden of ['mcp', 'team', 'skills', 'hooks', 'bridge', 'brain']) {
      expect(help.includes(`\n  ${hidden} `), hidden).toBe(false);
    }
  });

  it('developer help groups provider/model/context/workflow/github/memory', () => {
    const dev = formatDeveloperHelp();
    for (const cmd of ['provider', 'model', 'context', 'workflow', 'github', 'memory']) {
      expect(dev, cmd).toContain(cmd);
    }
  });

  it('advanced help groups mcp/skills/team/hooks/bridge/runtime', () => {
    const advanced = formatAdvancedHelp();
    for (const cmd of ['mcp', 'skills', 'team', 'hooks', 'bridge', 'runtime']) {
      expect(advanced, cmd).toContain(cmd);
    }
  });
});

describe('headline workflow commands route to the agent', () => {
  const run = async (args: string[]): Promise<{prompt: string; mode: string}> => {
    const runRoot = vi.fn(() => Promise.resolve());
    const program = buildProgram(makeHandlers(runRoot));
    await program.parseAsync(['node', 'apeironcode', ...args]);
    expect(runRoot).toHaveBeenCalledTimes(1);
    const [prompt, options] = runRoot.mock.calls[0] as unknown as [string, {mode: string}];
    return {prompt, mode: options.mode};
  };

  it('fix routes to the repair-loop handler (not the generic agent prompt)', async () => {
    const runRoot = vi.fn(() => Promise.resolve());
    const fix = vi.fn(() => Promise.resolve());
    const handlers = makeHandlers(runRoot);
    (handlers as unknown as {fix: typeof fix}).fix = fix;
    const program = buildProgram(handlers);
    await program.parseAsync(['node', 'apeironcode', 'fix', '--dry-run']);
    expect(fix).toHaveBeenCalledTimes(1);
    expect(runRoot).not.toHaveBeenCalled();
    const [options] = fix.mock.calls[0] as unknown as [{dryRun?: boolean}];
    expect(options.dryRun).toBe(true);
  });

  it('build and new route to the app-builder handler (not the generic prompt)', async () => {
    for (const cmd of ['build', 'new']) {
      const runRoot = vi.fn(() => Promise.resolve());
      const newApp = vi.fn(() => Promise.resolve());
      const handlers = makeHandlers(runRoot);
      (handlers as unknown as {newApp: typeof newApp}).newApp = newApp;
      const program = buildProgram(handlers);
      await program.parseAsync(['node', 'apeironcode', cmd, 'a todo app', '--dry-run']);
      expect(newApp, cmd).toHaveBeenCalledTimes(1);
      expect(runRoot).not.toHaveBeenCalled();
      const [idea, options] = newApp.mock.calls[0] as unknown as [string, {dryRun?: boolean}];
      expect(idea).toContain('a todo app');
      expect(options.dryRun).toBe(true);
    }
  });

  it('improve routes with mode refactor', async () => {
    const {mode} = await run(['improve', 'make', 'the', 'UI', 'premium']);
    expect(mode).toBe('refactor');
  });

  it('review delegates to the review handler and routes to the agent only when a prompt is returned', async () => {
    const runRoot = vi.fn(() => Promise.resolve());
    const review = vi.fn(() => Promise.resolve({routePrompt: 'Review the changes'}));
    const handlers = makeHandlers(runRoot);
    (handlers as unknown as {review: typeof review}).review = review;
    const program = buildProgram(handlers);
    await program.parseAsync(['node', 'apeironcode', 'review', 'security']);
    expect(review).toHaveBeenCalledTimes(1);
    expect(runRoot).toHaveBeenCalledTimes(1);
    const [, options] = runRoot.mock.calls[0] as unknown as [string, {mode: string}];
    expect(options.mode).toBe('review');
  });

  it('review does not route to the agent when the handler returns no prompt', async () => {
    const runRoot = vi.fn(() => Promise.resolve());
    const review = vi.fn(() => Promise.resolve({}));
    const handlers = makeHandlers(runRoot);
    (handlers as unknown as {review: typeof review}).review = review;
    const program = buildProgram(handlers);
    await program.parseAsync(['node', 'apeironcode', 'review']);
    expect(review).toHaveBeenCalledTimes(1);
    expect(runRoot).not.toHaveBeenCalled();
  });
});
