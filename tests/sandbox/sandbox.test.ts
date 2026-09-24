import {describe, expect, it} from 'vitest';

import {detectSandboxStatus} from '../../src/sandbox/detector.js';
import {formatSandboxStatus} from '../../src/sandbox/format.js';

describe('sandbox status', () => {
  it('formats truthful Docker availability and policy limits', async () => {
    const status = await detectSandboxStatus(async (command) => await Promise.resolve({
      exitCode: command === 'docker' ? 0 : 1,
      stdout: command === 'docker' ? 'Docker version test' : '',
    }));

    expect(status.mode).toBe('auto');
    expect(status.effectiveMode).toBe('docker');
    expect(status.backends.find((backend) => backend.id === 'docker')?.available).toBe(true);
    expect(formatSandboxStatus(status)).toContain('Command policy: enabled');
    expect(formatSandboxStatus(status)).toContain('Docker daemon: reachable');
    expect(formatSandboxStatus(status)).toContain('Docker isolation is active only');
  });

  it('reports native fallback when Docker is unavailable', async () => {
    const status = await detectSandboxStatus(async () => await Promise.resolve({exitCode: 1}), 'auto');
    expect(status.effectiveMode).toBe('native fallback');
    expect(formatSandboxStatus(status)).toContain('not OS-isolated');
  });
});
