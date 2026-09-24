import path from 'node:path';

export interface PathPolicyResult {
  allowed: boolean;
  reasons: string[];
}

export const isPathInside = (workspace: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(workspace), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const OUTSIDE_PATH = /(?:^|[\s"'=])(?:\.\.\/|~\/|\/(?:Users|home|etc|usr|var|private|System|Library|Applications)(?:\/|\s|$))/u;
const GIT_INTERNAL = /(?:^|[\s"'=])(?:\.git\/|[^ ]+\/\.git\/)(?:config|hooks|objects|refs|HEAD|index)\b/u;
const ENV_MUTATION = /\b(?:rm|mv|cp|touch|truncate|sed|perl|python|node)\b[^\n]*\.env(?:\.|\s|$)/u;
const BROAD_DELETE = /\brm\b[^\n]*(?:-[^\s]*r[^\s]*f|-[^\s]*f[^\s]*r)[^\n]*(?:\s\/|\s\.{1,2}(?:\/|\s|$)|\s\*)/u;

export const checkCommandPaths = (
  command: string,
  cwd: string,
  workspace: string,
  options: {allowEnv?: boolean} = {},
): PathPolicyResult => {
  const reasons: string[] = [];
  if (!isPathInside(workspace, cwd)) reasons.push('Working directory is outside the workspace.');
  if (OUTSIDE_PATH.test(command)) reasons.push('Command appears to target a path outside the workspace.');
  if (GIT_INTERNAL.test(command)) reasons.push('Direct mutation of .git internals is blocked.');
  if (!options.allowEnv && ENV_MUTATION.test(command)) reasons.push('Editing or deleting .env files is blocked.');
  if (BROAD_DELETE.test(command)) reasons.push('Broad recursive deletion is blocked.');
  return {allowed: reasons.length === 0, reasons};
};
