import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {detectProject} from '../../src/repair/projectDetector.js';
import {detectCheckCommands, detectInstallCommand} from '../../src/repair/commandDetector.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-detect-'));
});
afterEach(async () => {
  await fs.rm(dir, {recursive: true, force: true});
});

const writePkg = (scripts: Record<string, string>, deps: Record<string, string> = {}): Promise<void> =>
  fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({scripts, dependencies: deps}), 'utf8');

describe('project detector', () => {
  it('detects npm and scripts', async () => {
    await writePkg({typecheck: 'tsc', lint: 'eslint .', test: 'vitest', build: 'tsup'});
    await fs.writeFile(path.join(dir, 'package-lock.json'), '{}');
    const info = await detectProject(dir);
    expect(info.packageManager).toBe('npm');
    expect(info.scripts.typecheck).toBe('typecheck');
    expect(info.scripts.build).toBe('build');
  });

  it('detects pnpm/yarn/bun from lockfiles', async () => {
    await writePkg({});
    await fs.writeFile(path.join(dir, 'pnpm-lock.yaml'), '');
    expect((await detectProject(dir)).packageManager).toBe('pnpm');
    await fs.rm(path.join(dir, 'pnpm-lock.yaml'));
    await fs.writeFile(path.join(dir, 'yarn.lock'), '');
    expect((await detectProject(dir)).packageManager).toBe('yarn');
    await fs.rm(path.join(dir, 'yarn.lock'));
    await fs.writeFile(path.join(dir, 'bun.lockb'), '');
    expect((await detectProject(dir)).packageManager).toBe('bun');
  });

  it('detects frameworks (next/vite/typescript)', async () => {
    await writePkg({}, {next: '14'});
    expect((await detectProject(dir)).framework).toBe('next');
    await writePkg({}, {vite: '5'});
    expect((await detectProject(dir)).framework).toBe('vite');
    await writePkg({});
    await fs.writeFile(path.join(dir, 'tsconfig.json'), '{}');
    expect((await detectProject(dir)).framework).toBe('typescript');
  });

  it('does not crash without package.json or git', async () => {
    const info = await detectProject(dir);
    expect(info.hasPackageJson).toBe(false);
    expect(info.framework).toBe('unknown');
    expect(info.isGitRepo).toBe(false);
  });
});

describe('command detector', () => {
  it('orders checks and gates build/e2e behind includeAll', async () => {
    await writePkg({typecheck: 'tsc', lint: 'eslint', test: 'vitest', build: 'tsup', 'test:e2e': 'vitest e2e'});
    await fs.writeFile(path.join(dir, 'package-lock.json'), '{}');
    const info = await detectProject(dir);
    const normal = detectCheckCommands(info).map((c) => c.kind);
    expect(normal).toEqual(['typecheck', 'lint', 'test']);
    const all = detectCheckCommands(info, {includeAll: true}).map((c) => c.kind);
    expect(all).toEqual(['typecheck', 'lint', 'test', 'build', 'e2e']);
  });

  it('suggests install only when node_modules missing', async () => {
    await writePkg({test: 'vitest'});
    const info = await detectProject(dir);
    expect(detectInstallCommand(info)?.command).toBe('npm install');
    await fs.mkdir(path.join(dir, 'node_modules'));
    expect(detectInstallCommand(await detectProject(dir))).toBeUndefined();
  });
});
