import {promises as fs} from 'node:fs';
import path from 'node:path';

import {redactOutput, truncateOutput} from './checkRunner.js';
import type {FailureSummary} from './failureClassifier.js';
import type {CheckResult, ProjectInfo} from './types.js';

export interface ContextFile {
  path: string;
  content: string;
  reason: string;
}

export interface RepairContextPacket {
  files: ContextFile[];
  failingCommand: string;
  errorExcerpt: string;
  project: string;
  /** Human-readable explanation of why each file was selected. */
  trace: string[];
}

const CONFIG_CANDIDATES = ['tsconfig.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs', '.eslintrc.json', 'eslint.config.js'];
const MAX_FILE_BYTES = 16_000;
const ENV_RE = /(?:^|\/)\.env(?:\.|$)/u;

const readFileSafe = async (cwd: string, rel: string): Promise<string | undefined> => {
  if (ENV_RE.test(rel)) return undefined; // never include .env in context
  try {
    const content = await fs.readFile(path.join(cwd, rel), 'utf8');
    return redactOutput(truncateOutput(content, MAX_FILE_BYTES));
  } catch {
    return undefined;
  }
};

// Guess a related test file for a source file, and vice versa.
const relatedCandidates = (file: string): string[] => {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  if (/\.(test|spec)$/u.test(base)) {
    return [base.replace(/\.(test|spec)$/u, '') + ext, base.replace(/\.(test|spec)$/u, '') + '.ts'];
  }
  return [`${base}.test${ext}`, `${base}.spec${ext}`, base.replace(/^src\//u, 'tests/') + `.test${ext}`];
};

/**
 * Build a focused, secret-free context packet for one repair attempt
 * (Phase 20B, Task E). Includes package.json, relevant config, the failing
 * file(s) and related test files, the failing command, and a short error
 * excerpt — never the whole repo and never `.env`.
 */
export const buildRepairContext = async (
  info: ProjectInfo,
  failure: FailureSummary,
  failed: CheckResult,
): Promise<RepairContextPacket> => {
  const files: ContextFile[] = [];
  const trace: string[] = [];
  const added = new Set<string>();

  const add = async (rel: string, reason: string): Promise<void> => {
    if (added.has(rel)) return;
    const content = await readFileSafe(info.cwd, rel);
    if (content === undefined) return;
    added.add(rel);
    files.push({path: rel, content, reason});
    trace.push(`${rel} (${reason})`);
  };

  if (info.hasPackageJson) await add('package.json', 'project manifest and scripts');
  for (const candidate of CONFIG_CANDIDATES) {
    if (files.length >= 6) break;
    await add(candidate, 'project configuration');
  }

  for (const file of failure.files) {
    await add(file, 'file referenced by the error');
    for (const related of relatedCandidates(file)) await add(related, 'related test/source file');
  }

  return {
    files,
    failingCommand: failed.command,
    errorExcerpt: redactOutput(truncateOutput(failed.output, 3_000)),
    project: info.framework,
    trace,
  };
};

/** Render the "Context selected: … because …" explanation for reports. */
export const formatContextTrace = (packet: RepairContextPacket): string =>
  packet.files.length === 0
    ? 'Context selected: none (no readable files found)'
    : `Context selected: ${packet.files.map((f) => f.path).join(', ')}`;
