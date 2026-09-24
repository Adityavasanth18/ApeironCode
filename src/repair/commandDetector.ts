import type {CheckCommand, CheckKind, PackageManager, ProjectInfo} from './types.js';

const RUN_PREFIX: Record<PackageManager, string> = {
  npm: 'npm run',
  pnpm: 'pnpm',
  yarn: 'yarn',
  bun: 'bun run',
};

const TEST_PREFIX: Record<PackageManager, string> = {
  npm: 'npm test',
  pnpm: 'pnpm test',
  yarn: 'yarn test',
  bun: 'bun test',
};

const runScript = (pm: PackageManager, script: string): string =>
  script === 'test' ? TEST_PREFIX[pm] : `${RUN_PREFIX[pm]} ${script}`;

// Order in which checks run. e2e only when explicitly requested.
const CHECK_ORDER: CheckKind[] = ['typecheck', 'lint', 'test', 'build', 'e2e'];

export interface DetectCommandsOptions {
  /** Include slower checks (build/e2e). Set by `--all` / `--until-green`. */
  includeAll?: boolean;
}

/**
 * Build the ordered list of validation commands to run for a project. Uses the
 * detected scripts; `build`/`e2e` are only included when `includeAll` is set.
 * Returns an empty list when no runnable checks exist.
 */
export const detectCheckCommands = (
  info: ProjectInfo,
  options: DetectCommandsOptions = {},
): CheckCommand[] => {
  const commands: CheckCommand[] = [];
  for (const kind of CHECK_ORDER) {
    if ((kind === 'build' || kind === 'e2e') && !options.includeAll) continue;
    const script = info.scripts[kind];
    if (!script) continue;
    commands.push({
      kind,
      command: runScript(info.packageManager, script),
      reason: `run ${kind} (${script})`,
    });
  }
  return commands;
};

/**
 * Decide whether `install` should run before checks: only when a package.json
 * exists but node_modules is missing. Returns the install command or undefined.
 */
export const detectInstallCommand = (info: ProjectInfo): CheckCommand | undefined => {
  if (!info.hasPackageJson || info.hasNodeModules) return undefined;
  const installCommands: Record<PackageManager, string> = {
    npm: 'npm install',
    pnpm: 'pnpm install',
    yarn: 'yarn install',
    bun: 'bun install',
  };
  return {
    kind: 'install',
    command: installCommands[info.packageManager],
    reason: 'install dependencies (node_modules missing)',
  };
};
