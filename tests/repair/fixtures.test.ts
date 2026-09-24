import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {describe, expect, it} from 'vitest';

import {detectProject} from '../../src/repair/projectDetector.js';
import {detectCheckCommands} from '../../src/repair/commandDetector.js';
import {runCheck} from '../../src/repair/checkRunner.js';
import {parseCheckFailure} from '../../src/repair/errorParser.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'repair');
const fixture = (name: string): string => path.join(FIXTURES, name);

describe('repair fixtures (deterministic, no provider)', () => {
  it('classifies the ts-error fixture as a typescript project with a typecheck script', async () => {
    const info = await detectProject(fixture('ts-error'));
    expect(info.hasPackageJson).toBe(true);
    expect(info.scripts.typecheck).toBeDefined();
    expect(detectCheckCommands(info)[0]!.kind).toBe('typecheck');
  });

  it('runs the failing-test fixture and parses the failure (real node check)', async () => {
    const info = await detectProject(fixture('failing-test'));
    const [check] = detectCheckCommands(info);
    expect(check?.kind).toBe('test');
    const result = await runCheck(check!, {cwd: fixture('failing-test')});
    expect(result.ok).toBe(false);
    const issues = parseCheckFailure(result);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('detects module-not-found in the module-not-found fixture (real node build)', async () => {
    const info = await detectProject(fixture('module-not-found'));
    const [check] = detectCheckCommands(info, {includeAll: true});
    const result = await runCheck(check!, {cwd: fixture('module-not-found')});
    expect(result.ok).toBe(false);
    const issues = parseCheckFailure(result);
    expect(issues.some((i) => i.kind === 'module-not-found')).toBe(true);
  });

  it('treats no-package-json and unknown-project gracefully', async () => {
    const noPkg = await detectProject(fixture('no-package-json'));
    expect(noPkg.hasPackageJson).toBe(false);
    expect(detectCheckCommands(noPkg)).toEqual([]);
    const unknown = await detectProject(fixture('unknown-project'));
    expect(unknown.hasPackageJson).toBe(false);
    expect(unknown.framework).toBe('unknown');
  });
});
