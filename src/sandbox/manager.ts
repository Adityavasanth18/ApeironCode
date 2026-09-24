import {execa} from 'execa';

import type {CommandSemantics} from '../safety/shell/commandSemantics.js';
import type {CommandPolicyDecision, SandboxBackendId, SandboxExecutionResult, SandboxMode, SandboxRunOptions} from './types.js';
import type {SandboxRunner} from './runner.js';
import {DockerSandboxRunner} from './runners/docker.js';
import {PodmanSandboxRunner} from './runners/podman.js';
import {FirejailSandboxRunner} from './runners/firejail.js';
import {trace} from '../utils/trace.js';
import {evaluateCommandPolicy} from './commandPolicy.js';
import {NativeCommandRunner} from './runners/nativeRunner.js';

export interface SandboxManagerOptions {
  preferredBackend?: SandboxBackendId;
  allowFallbackToLocal?: boolean;
  timeoutMs?: number;
  mode?: SandboxMode;
  workspace?: string;
}

export type SandboxFallbackPolicy = 'never' | 'safe-readonly' | 'always';

export interface SandboxFallbackDecision {
  allowed: boolean;
  warning?: string;
}

export const getSandboxFallbackDecision = (
  semantics: CommandSemantics,
  fallbackPolicy: SandboxFallbackPolicy,
): SandboxFallbackDecision => {
  if (fallbackPolicy === 'never') {
    return {
      allowed: false,
      warning: 'Sandbox unavailable and fallback policy is "never"; refusing to execute command without sandbox.',
    };
  }
  if (fallbackPolicy === 'safe-readonly') {
    if (semantics.isReadOnly && !semantics.isNetworkCommand && !semantics.isFilesystemWrite && !semantics.isDestructive) {
      return {
        allowed: true,
        warning: 'Sandbox unavailable; running read-only command locally per "safe-readonly" fallback policy.',
      };
    }
    return {
      allowed: false,
      warning: `Sandbox unavailable and command is not safe-readonly (risk=${semantics.riskLevel}); refusing fallback.`,
    };
  }
  // 'always'
  if (semantics.riskLevel === 'high' || semantics.riskLevel === 'critical' || semantics.isDestructive || semantics.isCredentialRisk) {
    return {
      allowed: true,
      warning: `Sandbox unavailable; "always" fallback policy permitted execution of risky command (risk=${semantics.riskLevel}).`,
    };
  }
  return {
    allowed: true,
    warning: 'Sandbox unavailable; falling back to local execution per "always" policy.',
  };
};

export class SandboxManager {
  private runners: Map<SandboxBackendId, SandboxRunner> = new Map();
  private availableBackend: SandboxBackendId | 'local' | null = null;

  constructor(private options: SandboxManagerOptions = {}) {}

  async getAvailableRunner(): Promise<SandboxRunner | 'local'> {
    // Return cached result if available
    if (this.availableBackend !== null) {
      if (this.availableBackend === 'local') {
        return 'local';
      }
      const cached = this.runners.get(this.availableBackend);
      if (cached) {
        return cached;
      }
    }

    const testOffline = process.env['APEIRONCODE_TEST_OFFLINE'] === '1';
    if (testOffline && this.options.allowFallbackToLocal !== false) {
      this.availableBackend = 'local';
      return 'local';
    }

    // Try preferred backend first
    if (this.options.preferredBackend) {
      const runner = await this.tryBackend(this.options.preferredBackend);
      if (runner) {
        this.availableBackend = this.options.preferredBackend;
        return runner;
      }
    }

    // Public alpha auto mode intentionally selects Docker only. Podman and
    // Firejail remain available through explicit preferredBackend usage.
    const docker = await this.tryBackend('docker');
    if (docker) {
      this.availableBackend = 'docker';
      return docker;
    }

    // Fallback to local if allowed
    if (this.options.allowFallbackToLocal !== false) {
      this.availableBackend = 'local';
      return 'local';
    }

    throw new Error('No sandbox backend available and fallback to local execution is disabled');
  }

  private async tryBackend(backendId: SandboxBackendId): Promise<SandboxRunner | null> {
    try {
      const versionResult = await execa(backendId, ['--version'], {
        reject: false,
        timeout: 2000,
      });

      if (versionResult.exitCode !== 0) {
        return null;
      }

      // Try to actually run a simple command to verify backend is working
      const runner = this.createRunner(backendId);
      const testResult = await runner.run('echo test', {cwd: '/tmp', timeout: 3000});

      if (testResult.ok) {
        this.runners.set(backendId, runner);
        return runner;
      }
    } catch {
      // Backend not available or failed
    }

    return null;
  }

  private createRunner(backend: SandboxBackendId): SandboxRunner {
    switch (backend) {
      case 'docker':
        return new DockerSandboxRunner();
      case 'podman':
        return new PodmanSandboxRunner();
      case 'firejail':
        return new FirejailSandboxRunner();
      default: {
        // Exhaustive check: if we reach here, a new backend was added without implementation
        const exhaustive: never = backend;
        return exhaustive;
      }
    }
  }

  async executeCommand(command: string, options: SandboxRunOptions): Promise<SandboxExecutionResult> {
    return trace('sandbox.execute', async () => {
      const workspace = options.workspace ?? this.options.workspace ?? options.cwd;
      const policy = evaluateCommandPolicy({command, cwd: options.cwd, workspace});
      if (policy.risk === 'blocked') {
        return {
          backend: 'local',
          durationMs: 0,
          exitCode: 126,
          ok: false,
          policy,
          reason: 'blocked_by_command_policy',
          stderr: policy.blockedReasons.join('\n'),
          stdout: '',
        };
      }
      const mode = resolveSandboxMode(this.options.mode);
      const runOptions: SandboxRunOptions = {
        ...options,
        network: policy.network === 'on' || (policy.network === 'ask' && options.network === 'on') ? 'on' : 'off',
        workspace,
      };
      if (mode === 'none') {
        return {...await new NativeCommandRunner().run(command, runOptions), policy, warning: 'Sandbox disabled. Approval-gated, but not OS-sandboxed.'};
      }
      if (mode === 'native' || !policy.requiresSandbox) {
        return {...await new NativeCommandRunner().run(command, runOptions), policy};
      }
      const runner = await this.selectRunnerForMode(mode);

      if (runner === 'local') {
        return {...await new NativeCommandRunner().run(command, runOptions), policy};
      }

      return {...await runner.run(command, runOptions), policy};
    }, {command, cwd: options.cwd});
  }

  private async selectRunnerForMode(mode: SandboxMode): Promise<SandboxRunner | 'local'> {
    if (mode === 'docker') {
      const runner = await this.tryBackend('docker');
      if (!runner) throw new Error('Docker sandbox mode requested, but Docker is not available or the daemon is unreachable.');
      return runner;
    }
    if (mode === 'auto') {
      return this.getAvailableRunner();
    }
    return 'local';
  }

  async dispose(): Promise<void> {
    for (const runner of this.runners.values()) {
      if (runner.dispose) {
        await runner.dispose().catch(() => undefined);
      }
    }
    this.runners.clear();
  }
}

export const resolveSandboxMode = (configured?: SandboxMode): SandboxMode => {
  const raw = process.env['APEIRONCODE_SANDBOX'] ?? configured ?? 'auto';
  return raw === 'docker' || raw === 'native' || raw === 'none' || raw === 'auto' ? raw : 'auto';
};

export const formatPolicySummary = (policy: CommandPolicyDecision): string =>
  `risk: ${policy.risk}\nsandbox: ${policy.requiresSandbox ? 'required/auto' : 'native'}\nnetwork: ${policy.network}\nfilesystem: ${policy.filesystem}\nreason: ${policy.reason}`;
