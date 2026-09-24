import {execa} from 'execa';

import {buildCommandEnv, redactCommandText} from '../envPolicy.js';
import {isPathInside} from '../pathPolicy.js';
import type {SandboxExecutionResult, SandboxRunOptions} from '../types.js';

export class NativeCommandRunner {
  async run(command: string, options: SandboxRunOptions): Promise<SandboxExecutionResult> {
    const started = Date.now();
    const workspace = options.workspace ?? options.cwd;
    if (!isPathInside(workspace, options.cwd)) {
      return {backend: 'local', durationMs: 0, exitCode: 1, ok: false, reason: 'workspace_escape', stderr: 'Working directory is outside the workspace.', stdout: ''};
    }
    try {
      const result = await execa('sh', ['-lc', command], {
        cwd: options.cwd,
        env: buildCommandEnv(process.env, options.env),
        reject: false,
        signal: options.signal,
        timeout: options.timeout ?? 20_000,
      });
      if (result.timedOut || result.exitCode === undefined) {
        return {
          backend: 'local',
          durationMs: Date.now() - started,
          exitCode: 124,
          ok: false,
          reason: 'timeout',
          stderr: `Command timed out after ${options.timeout ?? 20_000}ms`,
          stdout: redactCommandText(result.stdout ?? ''),
          warning: 'Running natively. Approval-gated, but not OS-sandboxed.',
        };
      }
      return {
        backend: 'local',
        durationMs: Date.now() - started,
        exitCode: result.exitCode ?? 1,
        ok: result.exitCode === 0,
        reason: result.exitCode === 0 ? undefined : `Command exited with code ${result.exitCode}`,
        stderr: redactCommandText(result.stderr ?? ''),
        stdout: redactCommandText(result.stdout ?? ''),
        warning: 'Running natively. Approval-gated, but not OS-sandboxed.',
      };
    } catch (error) {
      const message = redactCommandText(error instanceof Error ? error.message : String(error));
      const timedOut = /timed out|timeout|SIGTERM|SIGKILL/iu.test(message);
      return {
        backend: 'local',
        durationMs: Date.now() - started,
        exitCode: timedOut ? 124 : 1,
        ok: false,
        reason: timedOut ? 'timeout' : 'execution_error',
        stderr: timedOut ? `Command timed out after ${options.timeout ?? 20_000}ms` : message,
        stdout: '',
        warning: 'Running natively. Approval-gated, but not OS-sandboxed.',
      };
    }
  }
}
