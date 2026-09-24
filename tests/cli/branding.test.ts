import {describe, expect, it, vi} from 'vitest';

import {buildProgram} from '../../src/cli/commands.js';
import {APP_DIR_NAME} from '../../src/utils/paths.js';

const createProgram = () => {
  const handlers = new Proxy({}, {
    get() {
      return vi.fn(() => Promise.resolve());
    },
  });
  return buildProgram(handlers as never);
};

describe('Phase 15A brand migration', () => {
  it('CLI program is named apeironcode', () => {
    const program = createProgram();
    expect(program.name()).toBe('apeironcode');
  });

  it('CLI description references the ApeironCode brand', () => {
    const program = createProgram();
    expect(program.description()).toContain('ApeironCode');
  });

  it('help output advertises the ApeironCode product name', () => {
    const program = createProgram();
    program.exitOverride();
    program.configureOutput({writeErr: () => undefined, writeOut: () => undefined});
    expect(program.helpInformation()).toContain('ApeironCode');
  });

  it('paths utility exposes the ApeironCode project directory name', () => {
    expect(APP_DIR_NAME).toBe('.apeironcode-agent');
  });

  it('package.json exposes the apeironcode binary', async () => {
    const pkg = await import('../../package.json', {with: {type: 'json'}});
    const data = (pkg as {default: {name: string; bin: Record<string, string>}}).default;
    expect(data.name).toBe('apeironcode');
    expect(data.bin).toHaveProperty('apeironcode');
    expect(Object.keys(data.bin)).toEqual(['apeironcode']);
  });
});
