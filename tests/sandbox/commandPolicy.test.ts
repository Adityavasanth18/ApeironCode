import {describe, expect, it} from 'vitest';

import {evaluateCommandPolicy} from '../../src/sandbox/commandPolicy.js';

const decide = (command: string) => evaluateCommandPolicy({
  command,
  cwd: '/workspace/project',
  workspace: '/workspace/project',
});

describe('command policy', () => {
  it('keeps validation offline and sandboxed', () => {
    expect(decide('npm test')).toMatchObject({
      network: 'off',
      requiresSandbox: true,
      risk: 'safe',
    });
  });

  it('requires approval and network ask for installs', () => {
    expect(decide('npm install')).toMatchObject({
      network: 'ask',
      requiresApproval: true,
      risk: 'medium',
    });
  });

  it.each([
    'cat ../secret.txt',
    'rm -rf .',
    'printf x > .git/config',
    'rm .env',
  ])('blocks unsafe workspace command: %s', (command) => {
    const decision = decide(command);
    expect(decision.risk).toBe('blocked');
    expect(decision.blockedReasons.length).toBeGreaterThan(0);
  });
});
