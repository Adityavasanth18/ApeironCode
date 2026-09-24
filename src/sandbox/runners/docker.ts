import {execa} from 'execa';
import path from 'node:path';

import type {SandboxExecutionResult, SandboxRunOptions} from '../types.js';
import {BaseSandboxRunner} from '../runner.js';
import {buildCommandEnv, redactCommandText} from '../envPolicy.js';

export const buildDockerArgs = (
  command: string,
  options: SandboxRunOptions,
  containerName: string,
  image = 'node:20-bookworm-slim',
): string[] => {
  const absoluteCwd = path.resolve(options.cwd);
  return [
    'run',
    '--rm',
    `--name=${containerName}`,
    options.network === 'on' ? '--network=bridge' : '--network=none',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--memory=1g',
    '--cpus=2',
    '--pids-limit=256',
    '--read-only',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=256m',
    '--workdir=/workspace',
    `--volume=${absoluteCwd}:/workspace:rw`,
    image,
    'sh',
    '-lc',
    command,
  ];
};

export class DockerSandboxRunner extends BaseSandboxRunner {
  readonly backend = 'docker' as const;
  readonly image = 'node:20-bookworm-slim';

  async run(command: string, options: SandboxRunOptions): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const containerName = `apeironcode-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const timeoutMs = options.timeout ?? 20000;

    try {
      const dockerArgs = buildDockerArgs(command, options, containerName, this.image);

      const result = await execa('docker', dockerArgs, {
        reject: false,
        timeout: timeoutMs + 5000, // Add buffer for cleanup
        signal: options.signal,
        env: buildCommandEnv(process.env, options.env),
      });

      const durationMs = Date.now() - startTime;

      return {
        ok: result.exitCode === 0,
        exitCode: result.exitCode ?? 1,
        stdout: redactCommandText(this.normalizeOutput(result.stdout ?? '')),
        stderr: redactCommandText(this.normalizeOutput(result.stderr ?? '')),
        backend: 'docker',
        containerId: containerName,
        durationMs,
        reason: result.exitCode !== 0 ? `Command exited with code ${result.exitCode}` : undefined,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Clean up container on error
      await execa('docker', ['rm', '-f', containerName], {reject: false}).catch(() => undefined);

      if (error instanceof Error) {
        if (error.message.includes('SIGTERM') || error.message.includes('SIGKILL')) {
          return {
            ok: false,
            exitCode: 124, // timeout exit code
            stdout: '',
            stderr: `Command timed out after ${timeoutMs}ms`,
            backend: 'docker',
            containerId: containerName,
            durationMs,
            reason: 'timeout',
          };
        }
      }

      return {
        ok: false,
        exitCode: 1,
        stdout: '',
        stderr: redactCommandText(error instanceof Error ? error.message : String(error)),
        backend: 'docker',
        containerId: containerName,
        durationMs,
        reason: 'execution_error',
      };
    }
  }

  override async dispose(): Promise<void> {
    // Docker runner doesn't maintain state
  }
}
