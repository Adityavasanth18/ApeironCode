import {describe, expect, it} from 'vitest';

import {parseCheckFailure} from '../../src/repair/errorParser.js';
import {classifyFailures} from '../../src/repair/failureClassifier.js';
import {redactOutput} from '../../src/repair/checkRunner.js';
import type {CheckResult} from '../../src/repair/types.js';

const result = (kind: CheckResult['kind'], output: string): CheckResult => ({
  kind, command: `npm run ${kind}`, ok: false, exitCode: 1, output,
});

describe('error parser', () => {
  it('extracts TypeScript file/line/column', () => {
    const issues = parseCheckFailure(result('typecheck',
      "src/foo.ts(12,5): error TS2304: Cannot find name 'bar'."));
    const ts = issues.find((i) => i.kind === 'typecheck');
    expect(ts?.file).toBe('src/foo.ts');
    expect(ts?.line).toBe(12);
    expect(ts?.column).toBe(5);
    expect(ts?.confidence).toBe('high');
  });

  it('detects module-not-found as a high-confidence root cause', () => {
    const issues = parseCheckFailure(result('build',
      "Error: Cannot find module './missing.js'\n    at ..."));
    expect(issues[0]!.kind).toBe('module-not-found');
    expect(issues[0]!.message).toContain('missing.js');
  });

  it('extracts failing test names for test runs', () => {
    const issues = parseCheckFailure(result('test',
      ' ❯ tests/a.test.ts (1)\n   × adds two todos 3ms\n   Tests 1 failed'));
    expect(issues.some((i) => i.kind === 'test' && /adds two todos/.test(i.message))).toBe(true);
  });

  it('extracts ESLint errors with location', () => {
    const issues = parseCheckFailure(result('lint',
      '/repo/src/a.ts\n  10:5  error  Unexpected console statement  no-console\n'));
    const lint = issues.find((i) => i.kind === 'lint');
    expect(lint?.line).toBe(10);
  });

  it('falls back to an unknown/low-confidence issue', () => {
    const issues = parseCheckFailure(result('build', 'some opaque failure output'));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.confidence).toBe('low');
  });

  it('redacts secrets in output', () => {
    expect(redactOutput('token=ghp_abcdefgh12345678 failed')).not.toContain('ghp_abcdefgh12345678');
    expect(redactOutput('OPENAI_API_KEY=sk-abcdefghijklmnop')).toContain('[redacted]');
  });
});

describe('failure classifier', () => {
  it('prefers module-not-found over a generic build failure', () => {
    const issues = parseCheckFailure(result('build',
      "Cannot find module 'x'\nsome other noise"));
    const summary = classifyFailures(issues);
    expect(summary?.primary.kind).toBe('module-not-found');
  });
});
