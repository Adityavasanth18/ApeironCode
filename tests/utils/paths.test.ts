import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  getAppHomeDir,
  getGlobalConfigPath,
  getIgnoreFilePath,
  getProjectConfigDir,
} from '../../src/utils/paths.js';

describe('ApeironCode paths', () => {
  const originalHome = process.env.HOME;
  let home: string;

  beforeEach(() => {
    home = path.join(os.tmpdir(), 'apeironcode-paths-home');
    process.env.HOME = home;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it('uses the canonical ApeironCode home and config path', () => {
    expect(getAppHomeDir()).toBe(path.join(home, '.apeironcode-agent'));
    expect(getGlobalConfigPath()).toBe(
      path.join(home, '.apeironcode-agent', 'config.json'),
    );
  });

  it('uses canonical project config and ignore paths', () => {
    const project = path.join(os.tmpdir(), 'apeironcode-project');
    expect(getProjectConfigDir(project)).toBe(
      path.join(project, '.apeironcode-agent'),
    );
    expect(getIgnoreFilePath(project)).toBe(
      path.join(project, '.apeironcodeignore'),
    );
  });
});
