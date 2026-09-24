import {describe, expect, it, vi} from 'vitest';

import {buildProgram} from '../../src/cli/commands.js';

const createProgram = () => {
  const calls: Record<string, ReturnType<typeof vi.fn>> = {};
  const handlers = new Proxy({}, {
    get(_target, property: string) {
      calls[property] ??= vi.fn(() => Promise.resolve());
      return calls[property];
    },
  });
  const program = buildProgram(handlers as never);
  program.exitOverride();
  program.configureOutput({writeErr: () => undefined, writeOut: () => undefined});
  return {calls, program};
};

describe('CLI smoke acceptance E2E', () => {
  it('renders root help without invoking a handler', () => {
    const {program} = createProgram();

    expect(() => program.parse(['node', 'apeironcode', '--help'])).toThrow();
    expect(program.helpInformation()).toContain('ApeironCode');
  });

  it('routes provider and connector inspection commands', async () => {
    const {calls, program} = createProgram();

    await program.parseAsync(['node', 'apeironcode', 'provider', 'list']);
    await program.parseAsync(['node', 'apeironcode', 'provider', 'env', 'gemini']);
    await program.parseAsync(['node', 'apeironcode', 'connector', 'list']);
    await program.parseAsync(['node', 'apeironcode', 'connector', 'env', 'linear']);

    expect(calls.providerList).toHaveBeenCalledTimes(1);
    expect(calls.providerEnv).toHaveBeenCalledWith('gemini');
    expect(calls.connectorList).toHaveBeenCalledTimes(1);
    expect(calls.connectorEnv).toHaveBeenCalledWith('linear');
  });

  it('routes eval, doctor, and debug commands without real services', async () => {
    const {calls, program} = createProgram();

    await program.parseAsync(['node', 'apeironcode', 'eval', 'list']);
    await program.parseAsync(['node', 'apeironcode', 'doctor']);
    await program.parseAsync(['node', 'apeironcode', 'debug', 'config']);

    expect(calls.evalList).toHaveBeenCalledTimes(1);
    expect(calls.doctor).toHaveBeenCalledWith(expect.objectContaining({dangerouslySkipApprovals: false}));
    expect(calls.debugConfig).toHaveBeenCalledTimes(1);
  });
});
