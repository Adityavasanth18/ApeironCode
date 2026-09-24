import {execa} from 'execa';

import type {SandboxBackendId, SandboxBackendStatus, SandboxMode, SandboxStatus} from './types.js';
import {resolveSandboxMode} from './manager.js';

export type SandboxProbe = (command: string, args: string[]) => Promise<{exitCode: number; stdout?: string}>;

const defaultProbe: SandboxProbe = async (command, args) => {
  const result = await execa(command, args, {reject: false, timeout: 2000});
  return {exitCode: result.exitCode ?? 1, stdout: result.stdout};
};

const backends: Array<{args: string[]; command: string; id: SandboxBackendId}> = [
  {args: ['--version'], command: 'docker', id: 'docker'},
  {args: ['--version'], command: 'podman', id: 'podman'},
  {args: ['--version'], command: 'firejail', id: 'firejail'},
];

const IMAGE = 'node:20-bookworm-slim';

export const detectSandboxStatus = async (
  probe: SandboxProbe = defaultProbe,
  configured?: SandboxMode,
): Promise<SandboxStatus> => {
  const statuses: SandboxBackendStatus[] = [];
  for (const backend of backends) {
    try {
      const result = await probe(backend.command, backend.args);
      const available = result.exitCode === 0;
      statuses.push({
        available,
        command: backend.command,
        detail: available ? (result.stdout?.split('\n')[0] ?? 'available') : 'not available',
        id: backend.id,
      });
    } catch (error) {
      statuses.push({
        available: false,
        command: backend.command,
        detail: error instanceof Error ? error.message : 'not available',
        id: backend.id,
      });
    }
  }
  const docker = statuses.find((status) => status.id === 'docker');
  let dockerDaemonReachable = false;
  try {
    dockerDaemonReachable = (await probe('docker', ['ps'])).exitCode === 0;
  } catch {
    dockerDaemonReachable = false;
  }
  const mode = resolveSandboxMode(configured);
  const effectiveMode = mode === 'none'
    ? 'disabled'
    : mode === 'native'
      ? 'native'
      : docker?.available && dockerDaemonReachable
        ? 'docker'
        : mode === 'docker' ? 'unavailable' : 'native fallback';

  return {
    backends: statuses,
    configuredMode: mode,
    dockerDaemonReachable,
    effectiveMode,
    image: IMAGE,
    limitations: [
      'Command policy is always evaluated before command execution.',
      'Docker sandboxing is used only when Docker is available and selected.',
      'Native fallback is approval-gated but not OS-isolated.',
      'Network-on commands require explicit policy/approval metadata.',
      'Secrets are redacted from command logs and not passed to Docker by default.',
    ],
    mode,
  };
};
