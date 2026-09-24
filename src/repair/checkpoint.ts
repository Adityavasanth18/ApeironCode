import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {FilePlan} from '../agent/filePlanProtocol.js';

const CHECKPOINT_ROOT = '.apeironcode/checkpoints';
const MAX_SNAPSHOT_BYTES = 1_000_000;

export interface FileSnapshot {
  path: string;
  /** Prior content, or null if the file did not exist (so rollback can delete it). */
  content: string | null;
}

export interface Checkpoint {
  id: string;
  dir: string;
  snapshots: FileSnapshot[];
}

const readIfExists = async (abs: string): Promise<string | null> => {
  try {
    const stat = await fs.stat(abs);
    if (stat.size > MAX_SNAPSHOT_BYTES) return null; // skip huge files
    return await fs.readFile(abs, 'utf8');
  } catch {
    return null;
  }
};

/**
 * Snapshot the files a plan will modify/delete/rename before applying it
 * (Phase 20B, Task H). Stored under `.apeironcode/checkpoints/<id>` (gitignored).
 * Secrets are not specially included beyond the file's own content, and huge
 * files are skipped.
 */
export const createCheckpoint = async (cwd: string, plan: FilePlan): Promise<Checkpoint> => {
  const id = `ckpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const dir = path.join(cwd, CHECKPOINT_ROOT, id);
  await fs.mkdir(dir, {recursive: true});

  const targets = new Set<string>();
  for (const file of plan.files) {
    targets.add(file.path);
    if (file.operation === 'rename' && file.from) targets.add(file.from);
  }

  const snapshots: FileSnapshot[] = [];
  for (const rel of targets) {
    const content = await readIfExists(path.resolve(cwd, rel));
    snapshots.push({path: rel, content});
  }
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({id, snapshots}, null, 2), 'utf8');
  return {id, dir, snapshots};
};

/**
 * Restore files to their snapshotted state. Files that did not exist before are
 * removed. Used internally after a failed apply to avoid partial corrupt state.
 */
export const rollbackCheckpoint = async (cwd: string, checkpoint: Checkpoint): Promise<string[]> => {
  const restored: string[] = [];
  for (const snapshot of checkpoint.snapshots) {
    const abs = path.resolve(cwd, snapshot.path);
    if (snapshot.content === null) {
      await fs.rm(abs, {force: true});
    } else {
      await fs.mkdir(path.dirname(abs), {recursive: true});
      await fs.writeFile(abs, snapshot.content, 'utf8');
    }
    restored.push(snapshot.path);
  }
  return restored;
};

export const checkpointRelativeDir = (cwd: string, checkpoint: Checkpoint): string =>
  path.relative(cwd, checkpoint.dir) || checkpoint.dir;

export interface CheckpointInfo {
  id: string;
  dir: string;
  fileCount: number;
  createdAt: Date;
}

interface CheckpointManifest {
  id: string;
  snapshots: FileSnapshot[];
}

const readManifest = async (dir: string): Promise<CheckpointManifest | undefined> => {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')) as CheckpointManifest;
  } catch {
    return undefined;
  }
};

/**
 * List saved checkpoints (newest first) under `.apeironcode/checkpoints`
 * (Phase 20E, Task H). Returns an empty list when none exist.
 */
export const listCheckpoints = async (cwd: string): Promise<CheckpointInfo[]> => {
  const root = path.join(cwd, CHECKPOINT_ROOT);
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const infos: CheckpointInfo[] = [];
  for (const id of entries) {
    const dir = path.join(root, id);
    const manifest = await readManifest(dir);
    if (!manifest) continue;
    const stat = await fs.stat(dir).catch(() => undefined);
    infos.push({id, dir, fileCount: manifest.snapshots.length, createdAt: stat?.mtime ?? new Date(0)});
  }
  return infos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

/** Load a checkpoint (with snapshots) by id, or undefined when not found. */
export const loadCheckpoint = async (cwd: string, id: string): Promise<Checkpoint | undefined> => {
  const dir = path.join(cwd, CHECKPOINT_ROOT, id);
  const manifest = await readManifest(dir);
  if (!manifest) return undefined;
  return {id, dir, snapshots: manifest.snapshots};
};
