import pc from 'picocolors';

const isDebugEnabled = process.env.APEIRONCODE_AGENT_DEBUG === '1';

export const logger = {
  debug(message: string, payload?: unknown): void {
    if (!isDebugEnabled) {
      return;
    }

    const prefix = pc.dim('[apeironcode:debug]');
    process.stderr.write(`${prefix} ${message}\n`);

    if (payload !== undefined) {
      process.stderr.write(`${pc.dim(JSON.stringify(payload, null, 2))}\n`);
    }
  },
  info(message: string): void {
    process.stderr.write(`${pc.cyan('[apeironcode]')} ${message}\n`);
  },
  warn(message: string): void {
    process.stderr.write(`${pc.yellow('[apeironcode]')} ${message}\n`);
  },
  error(message: string): void {
    process.stderr.write(`${pc.red('[apeironcode]')} ${message}\n`);
  },
};
