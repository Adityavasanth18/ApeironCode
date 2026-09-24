import readline from 'node:readline/promises';

import {ConfigStore} from '../config/config.js';
import {listCheckpoints, loadCheckpoint, rollbackCheckpoint, type CheckpointInfo} from '../repair/checkpoint.js';

export interface RollbackCliOptions {
  last?: boolean;
  yes?: boolean;
}

const formatList = (infos: CheckpointInfo[]): string => {
  if (infos.length === 0) return 'No checkpoints found. Checkpoints are created before `apeironcode fix` applies changes.';
  const lines = ['Checkpoints (newest first):'];
  for (const info of infos) {
    lines.push(`  ${info.id}  ·  ${info.fileCount} file(s)  ·  ${info.createdAt.toISOString()}`);
  }
  lines.push('');
  lines.push('Restore one with: apeironcode rollback <id>   (or: apeironcode rollback --last)');
  return lines.join('\n');
};

/**
 * `apeironcode rollback` (Phase 20E, Task H). Restores files from a Phase 20B
 * checkpoint. Subcommand `list` shows checkpoints; `--last` or an explicit id
 * restores. Confirmation is required unless `--yes`/trusted/bypass. Only files
 * recorded in the checkpoint are touched.
 */
export const runRollbackCommand = async (
  cwd: string,
  idOrSub: string | undefined,
  options: RollbackCliOptions,
): Promise<void> => {
  const infos = await listCheckpoints(cwd);

  if (idOrSub === 'list') {
    process.stdout.write(`${formatList(infos)}\n`);
    return;
  }

  let targetId = idOrSub && idOrSub !== 'list' ? idOrSub : undefined;
  if (!targetId && options.last) targetId = infos[0]?.id;

  if (!targetId) {
    process.stdout.write(`${formatList(infos)}\n`);
    if (options.last && infos.length === 0) process.exitCode = 1;
    return;
  }

  const checkpoint = await loadCheckpoint(cwd, targetId);
  if (!checkpoint) {
    process.stdout.write(`Checkpoint "${targetId}" not found.\n${formatList(infos)}\n`);
    process.exitCode = 1;
    return;
  }

  const resolved = await new ConfigStore(cwd).load();
  const autoApprove =
    resolved.effective.approvalMode === 'bypass' || resolved.effective.approvalMode === 'trusted' || Boolean(options.yes);

  process.stdout.write(`Rollback ${checkpoint.id} will restore ${checkpoint.snapshots.length} file(s):\n`);
  for (const snapshot of checkpoint.snapshots) {
    process.stdout.write(`  ${snapshot.content === null ? 'delete (was new)' : 'restore'} ${snapshot.path}\n`);
  }

  if (!autoApprove) {
    if (!process.stdin.isTTY) {
      process.stdout.write('Non-interactive terminal: re-run with --yes to roll back.\n');
      process.exitCode = 1;
      return;
    }
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    try {
      const answer = (await rl.question('Proceed with rollback? [y/N] ')).trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') {
        process.stdout.write('Rollback cancelled. Nothing changed.\n');
        return;
      }
    } finally {
      rl.close();
    }
  }

  const restored = await rollbackCheckpoint(cwd, checkpoint);
  process.stdout.write(`Restored ${restored.length} file(s) from ${checkpoint.id}.\n`);
};
