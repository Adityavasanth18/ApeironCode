import os from 'node:os';
import path from 'node:path';

export const APP_DIR_NAME = '.apeironcode-agent';
export const PROJECT_CONFIG_DIR_NAME = APP_DIR_NAME;
export const PROJECT_MEMORY_FILE_NAME = 'memory.md';
export const PROJECT_CONFIG_FILE_NAME = 'config.json';
export const IGNORE_FILE_NAME = '.apeironcodeignore';

export const getUserHomeDir = (): string => os.homedir();

export const getAppHomeDir = (): string => path.join(getUserHomeDir(), APP_DIR_NAME);

export const getGlobalConfigPath = (): string =>
  path.join(getAppHomeDir(), PROJECT_CONFIG_FILE_NAME);

export const getSessionsDir = (): string => path.join(getAppHomeDir(), 'sessions');

export const getTranscriptsDir = (): string => path.join(getAppHomeDir(), 'transcripts');

export const getSessionTranscriptPath = (sessionId: string): string =>
  path.join(getTranscriptsDir(), `${sessionId}.json`);

export const getSessionBackupsDir = (sessionId: string): string =>
  path.join(getAppHomeDir(), 'backups', sessionId);

export const getSessionBackupPath = (sessionId: string, filePath: string): string =>
  path.join(getSessionBackupsDir(sessionId), filePath.replace(/[/:\\]/gu, '__'));

export const getProjectHistoryDir = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'history');

export const getProjectEditHistoryPath = (cwd: string): string =>
  path.join(getProjectHistoryDir(cwd), 'edits.jsonl');

export const getProjectBackupDir = (cwd: string): string =>
  path.join(getProjectHistoryDir(cwd), 'backups');

export const getProjectTasksDir = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'tasks');

export const getProjectSessionsDir = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'sessions');

export const getRepoMapPath = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'repo-map.json');

export const getProjectConfigDir = (cwd: string): string =>
  path.join(cwd, PROJECT_CONFIG_DIR_NAME);

export const getProjectConfigPath = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), PROJECT_CONFIG_FILE_NAME);

export const getProjectMemoryPath = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), PROJECT_MEMORY_FILE_NAME);

export const getIgnoreFilePath = (cwd: string): string =>
  path.join(cwd, IGNORE_FILE_NAME);

export const getPlanStoragePath = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'plans');

export const isSubPath = (parentPath: string, candidatePath: string): boolean => {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
};

/** Directory for background task records (Phase 16D). */
export const getProjectBgTasksDir = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'bg-tasks');

/** Directory for ApeironCode-managed agent worktrees (Phase 16D). */
export const getProjectWorktreesDir = (cwd: string): string =>
  path.join(getProjectConfigDir(cwd), 'worktrees');
