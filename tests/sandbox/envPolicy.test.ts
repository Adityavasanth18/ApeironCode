import {describe, expect, it} from 'vitest';

import {buildCommandEnv, redactCommandText} from '../../src/sandbox/envPolicy.js';

describe('command environment policy', () => {
  it('passes a minimal environment and removes secrets', () => {
    const env = buildCommandEnv({
      PATH: '/bin',
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'sk-supersecret',
      CUSTOM_TOKEN: 'secret',
      HOME: '/home/user',
    });
    expect(env).toEqual({NODE_ENV: 'test', PATH: '/bin'});
  });

  it('redacts named and shaped secrets', () => {
    const output = redactCommandText('OPENAI_API_KEY=sk-abcdefgh ghp_abcdefgh github_pat_abcdefgh');
    expect(output).not.toContain('abcdefgh');
    expect(output).toContain('[redacted]');
  });
});
