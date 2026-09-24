export type SandboxBackendId = 'docker' | 'firejail' | 'podman';

export type SandboxMode = 'auto' | 'docker' | 'native' | 'none';
export type CommandRisk = 'safe' | 'medium' | 'high' | 'blocked';
export type CommandNetworkPolicy = 'off' | 'ask' | 'on';
export type CommandFilesystemPolicy = 'workspace-only' | 'read-only' | 'unrestricted-blocked';

export interface CommandPolicyDecision {
  blockedReasons: string[];
  filesystem: CommandFilesystemPolicy;
  network: CommandNetworkPolicy;
  reason: string;
  requiresApproval: boolean;
  requiresSandbox: boolean;
  risk: CommandRisk;
}

export interface SandboxBackendStatus {
  available: boolean;
  command: string;
  detail: string;
  id: SandboxBackendId;
}

export interface SandboxStatus {
  backends: SandboxBackendStatus[];
  configuredMode: SandboxMode;
  dockerDaemonReachable: boolean;
  effectiveMode: 'docker' | 'native fallback' | 'native' | 'disabled' | 'unavailable';
  image: string;
  limitations: string[];
  mode: SandboxMode;
}

export interface SandboxRunOptions {
  cwd: string;
  workspace?: string;
  timeout?: number; // milliseconds, default 20000
  env?: Record<string, string>;
  network?: CommandNetworkPolicy;
  signal?: AbortSignal;
}

export interface SandboxExecutionResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  backend: SandboxBackendId | 'local';
  policy?: CommandPolicyDecision;
  warning?: string;
  containerId?: string; // Container/process ID if applicable
  reason?: string; // Error reason if not ok
}

export class SandboxExecutionError extends Error {
  constructor(
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly backend: SandboxBackendId | 'local',
  ) {
    super(`Sandbox execution failed with exit code ${exitCode}`);
    this.name = 'SandboxExecutionError';
  }
}
