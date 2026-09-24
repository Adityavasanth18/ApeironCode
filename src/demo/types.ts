/**
 * Deterministic, no-key demo mode types.
 *
 * Demo mode never calls a provider, model, Ollama, or the network. Each scenario
 * writes real files into a demo workspace and runs real local validation so a
 * brand-new user can see ApeironCode's plan → write → validate flow in under a
 * minute without any API credits.
 */

export type DemoScenarioId = 'todo-app' | 'fix-test' | 'improve-ui' | 'review';

export interface DemoValidationStep {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DemoFinding {
  category: 'bug risk' | 'maintainability' | 'security' | 'suggestion';
  message: string;
}

export interface DemoScenarioResult {
  scenario: DemoScenarioId;
  title: string;
  /** Absolute path to the demo workspace where files were written. */
  workspaceDir: string;
  /** Human-readable plan steps shown before applying changes. */
  plan: string[];
  /** Files newly created, relative to workspaceDir. */
  filesCreated: string[];
  /** Files modified in place, relative to workspaceDir. */
  filesChanged: string[];
  /** Real local validation results (e.g. `node --check`, a test run). */
  validation: DemoValidationStep[];
  /** Review findings, for the `review` scenario. */
  findings?: DemoFinding[];
  /** "before" / "after" file snapshots, for `improve-ui`. */
  beforeAfter?: {before: string[]; after: string[]};
  /** A short hint such as `open index.html`. */
  openHint?: string;
  /** One-line outcome summary. */
  summary: string;
}

export interface DemoScenarioMeta {
  id: DemoScenarioId;
  title: string;
  description: string;
  command: string;
}

export const DEMO_DISCLAIMER =
  'Demo mode uses deterministic local examples. For real projects, configure Ollama or a cloud provider.';
