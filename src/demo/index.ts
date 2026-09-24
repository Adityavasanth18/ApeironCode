import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {runTodoAppDemo} from './scenarios/todoApp.js';
import {runFixTestDemo} from './scenarios/fixTest.js';
import {runImproveUiDemo} from './scenarios/improveUi.js';
import {runReviewDemo} from './scenarios/review.js';
import type {DemoScenarioId, DemoScenarioMeta, DemoScenarioResult} from './types.js';

export type {DemoScenarioId, DemoScenarioMeta, DemoScenarioResult} from './types.js';
export {DEMO_DISCLAIMER} from './types.js';
export {formatDemoResult, formatDemoMenu} from './format.js';

export const DEMO_SCENARIOS: DemoScenarioMeta[] = [
  {
    id: 'todo-app',
    title: 'Build a todo app',
    description: 'Scaffold a working static HTML/CSS/JS todo app and validate it.',
    command: 'apeironcode demo todo-app',
  },
  {
    id: 'fix-test',
    title: 'Fix a failing test',
    description: 'Reproduce a failing test, apply a deterministic fix, and re-run to green.',
    command: 'apeironcode demo fix-test',
  },
  {
    id: 'improve-ui',
    title: 'Improve the UI',
    description: 'Turn a plain page into a premium one and verify assets still resolve.',
    command: 'apeironcode demo improve-ui',
  },
  {
    id: 'review',
    title: 'Review a change',
    description: 'Run a deterministic review over a sample diff and list findings.',
    command: 'apeironcode demo review',
  },
];

export const isDemoScenarioId = (value: string): value is DemoScenarioId =>
  DEMO_SCENARIOS.some((scenario) => scenario.id === value);

/**
 * Resolve a default demo workspace path under the OS temp dir. Callers (and
 * tests) may pass an explicit directory instead.
 */
export const defaultDemoWorkspace = (scenario: DemoScenarioId): string =>
  path.join(os.tmpdir(), 'apeironcode-demo', scenario);

const RUNNERS: Record<DemoScenarioId, (dir: string) => Promise<DemoScenarioResult>> = {
  'todo-app': runTodoAppDemo,
  'fix-test': runFixTestDemo,
  'improve-ui': runImproveUiDemo,
  review: runReviewDemo,
};

/**
 * Run a deterministic, no-key demo scenario. Writes real files into a clean
 * workspace (cleared first so repeated runs are reproducible) and runs real
 * local validation. Never calls a provider, model, Ollama, or the network.
 */
export const runDemoScenario = async (
  scenario: DemoScenarioId,
  options: {workspaceDir?: string} = {},
): Promise<DemoScenarioResult> => {
  const workspaceDir = options.workspaceDir ?? defaultDemoWorkspace(scenario);
  await fs.rm(workspaceDir, {recursive: true, force: true});
  await fs.mkdir(workspaceDir, {recursive: true});
  return RUNNERS[scenario](workspaceDir);
};
