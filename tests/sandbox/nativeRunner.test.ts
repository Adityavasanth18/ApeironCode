import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {NativeCommandRunner} from '../../src/sandbox/runners/nativeRunner.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, {force: true, recursive: true})));
});

describe('native command runner', () => {
  it('rejects cwd outside the workspace', async () => {
    const runner = new NativeCommandRunner();
    const result = await runner.run('pwd', {cwd: '/tmp', workspace: '/workspace/project'});
    expect(result.reason).toBe('workspace_escape');
  });

  it('redacts output and reports native isolation honestly', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'apeiron-native-'));
    dirs.push(workspace);
    const runner = new NativeCommandRunner();
    const result = await runner.run('printf "GITHUB_TOKEN=ghp_abcdefgh"', {cwd: workspace, workspace});
    expect(result.ok).toBe(true);
    expect(result.stdout).not.toContain('ghp_abcdefgh');
    expect(result.warning).toContain('not OS-sandboxed');
  });

  it('enforces timeouts', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'apeiron-native-'));
    dirs.push(workspace);
    const runner = new NativeCommandRunner();
    const result = await runner.run('sleep 2', {cwd: workspace, timeout: 20, workspace});
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
  });
});
