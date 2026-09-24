import {describe, expect, it} from 'vitest';

import {ROOT_MENU_OPTIONS, describeProviderStatus, formatRootMenu} from '../../src/ui/rootHome.js';

describe('root home menu', () => {
  it('offers the seven beginner options with explicit commands', () => {
    expect(ROOT_MENU_OPTIONS).toHaveLength(7);
    const menu = formatRootMenu({projectName: 'my-app', providerStatus: 'demo/none'});
    expect(menu).toContain('Project : my-app');
    expect(menu).toContain('Status  : Ready');
    for (const cmd of ['apeironcode fix', 'apeironcode new', 'apeironcode improve', 'apeironcode review', 'apeironcode setup', 'apeironcode demo']) {
      expect(menu, cmd).toContain(cmd);
    }
  });

  it('describes provider status in beginner terms', () => {
    expect(describeProviderStatus('mock', 'mock-coder')).toBe('demo/none');
    expect(describeProviderStatus('ollama', 'qwen')).toMatch(/local/);
    expect(describeProviderStatus('anthropic', 'claude')).toMatch(/configured/);
  });
});
