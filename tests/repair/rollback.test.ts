import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createCheckpoint, listCheckpoints, loadCheckpoint, rollbackCheckpoint} from '../../src/repair/checkpoint.js';
import type {FilePlan} from '../../src/agent/filePlanProtocol.js';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-rollback-'));
});
afterEach(async () => {
  await fs.rm(dir, {recursive: true, force: true});
});

const plan = (files: FilePlan['files']): FilePlan => ({summary: 's', commands: [], validation: [], files});

describe('checkpoint list/load/rollback', () => {
  it('lists checkpoints newest first', async () => {
    await createCheckpoint(dir, plan([{path: 'a.ts', operation: 'create', content: 'x'}]));
    await new Promise((r) => setTimeout(r, 5));
    const second = await createCheckpoint(dir, plan([{path: 'b.ts', operation: 'create', content: 'y'}]));
    const list = await listCheckpoints(dir);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(second.id);
    expect(list[0]!.fileCount).toBe(1);
  });

  it('loads a checkpoint by id and rolls back, restoring prior state', async () => {
    await fs.writeFile(path.join(dir, 'a.ts'), 'ORIGINAL');
    const checkpoint = await createCheckpoint(dir, plan([
      {path: 'a.ts', operation: 'modify', content: 'changed'},
      {path: 'new.ts', operation: 'create', content: 'new'},
    ]));
    await fs.writeFile(path.join(dir, 'a.ts'), 'CHANGED');
    await fs.writeFile(path.join(dir, 'new.ts'), 'CREATED');

    const loaded = await loadCheckpoint(dir, checkpoint.id);
    expect(loaded).toBeDefined();
    const restored = await rollbackCheckpoint(dir, loaded!);
    expect(restored).toContain('a.ts');
    expect(await fs.readFile(path.join(dir, 'a.ts'), 'utf8')).toBe('ORIGINAL');
    // A file that did not exist before is removed (not a foreign file).
    await expect(fs.access(path.join(dir, 'new.ts'))).rejects.toThrow();
  });

  it('returns an empty list and undefined load when there are no checkpoints', async () => {
    expect(await listCheckpoints(dir)).toEqual([]);
    expect(await loadCheckpoint(dir, 'missing')).toBeUndefined();
  });

  it('only touches files recorded in the checkpoint', async () => {
    await fs.writeFile(path.join(dir, 'unrelated.txt'), 'keep');
    const checkpoint = await createCheckpoint(dir, plan([{path: 'a.ts', operation: 'create', content: 'x'}]));
    await fs.writeFile(path.join(dir, 'a.ts'), 'x');
    await rollbackCheckpoint(dir, checkpoint);
    expect(await fs.readFile(path.join(dir, 'unrelated.txt'), 'utf8')).toBe('keep');
  });
});
