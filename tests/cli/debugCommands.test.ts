import {describe, expect, it, vi} from 'vitest';

import {buildProgram} from '../../src/cli/commands.js';
import type {CliHandlers} from '../../src/cli/commands/types.js';

describe('debug CLI commands', () => {
  it('routes debug commands to safe handlers', async () => {
    const handlers = {
      debugConfig: vi.fn(),
      debugLogs: vi.fn(),
      debugTokens: vi.fn(),
      debugTraces: vi.fn(),
      sessionExport: vi.fn(),
    } as unknown as CliHandlers;
    const program = buildProgram(handlers);
    await program.parseAsync(['node', 'apeironcode', 'debug', 'traces', '--last', '7']);
    await program.parseAsync(['node', 'apeironcode', 'debug', 'logs', '--last', '9']);
    await program.parseAsync(['node', 'apeironcode', 'debug', 'tokens']);
    await program.parseAsync(['node', 'apeironcode', 'debug', 'config']);
    await program.parseAsync(['node', 'apeironcode', 'session', 'export', 'abc123', '--format', 'html', '--output', 'out.html']);
    expect(handlers.debugTraces).toHaveBeenCalledWith({last: 7});
    expect(handlers.debugLogs).toHaveBeenCalledWith({last: 9});
    expect(handlers.debugTokens).toHaveBeenCalled();
    expect(handlers.debugConfig).toHaveBeenCalled();
    expect(handlers.sessionExport).toHaveBeenCalledWith('abc123', {format: 'html', output: 'out.html'});
  });
});
