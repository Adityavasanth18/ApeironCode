import type {SandboxExecutionResult, SandboxStatus} from './types.js';

export const formatSandboxStatus = (status: SandboxStatus): string => {
  const backendLines = status.backends.map((backend) =>
    `- ${backend.id}: ${backend.available ? 'available' : 'not available'} (${backend.detail})`,
  );
  return [
    'ApeironCode Sandbox',
    '',
    `Configured mode: ${status.configuredMode}`,
    `Effective mode: ${status.effectiveMode}`,
    `Docker daemon: ${status.dockerDaemonReachable ? 'reachable' : 'not reachable'}`,
    `Selected image: ${status.image}`,
    'Command policy: enabled',
    'Blocked commands: enabled',
    'Secrets redaction: enabled',
    'Workspace boundary: enabled',
    'Network default: off unless policy says ask/on',
    '',
    'Backends',
    ...(backendLines.length > 0 ? backendLines : ['- No sandbox backends probed.']),
    '',
    'Current limitations',
    ...status.limitations.map((limit) => `- ${limit}`),
    '',
    status.effectiveMode === 'native fallback' || status.effectiveMode === 'native'
      ? 'Warning: Commands are approval-gated but not OS-isolated in native execution.'
      : 'Docker isolation is active only for commands actually run through the Docker runner.',
    '',
    'Next:',
    '- Install Docker Desktop if Docker is unavailable.',
    '- Run: apeironcode sandbox doctor',
    '- Try: apeironcode --sandbox docker fix',
  ].join('\n');
};

export const formatSandboxExecutionResult = (result: SandboxExecutionResult): string => {
  const lines: string[] = [
    `Execution via ${result.backend}`,
    `Exit code: ${result.exitCode}`,
    `Duration: ${result.durationMs}ms`,
  ];

  if (result.containerId) {
    lines.push(`Container: ${result.containerId}`);
  }

  if (result.reason) {
    lines.push(`Reason: ${result.reason}`);
  }

  if (result.stdout) {
    lines.push('', 'stdout:', result.stdout);
  }

  if (result.stderr) {
    lines.push('', 'stderr:', result.stderr);
  }

  return lines.join('\n');
};
