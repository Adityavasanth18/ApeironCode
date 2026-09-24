/**
 * Phase 20C app-builder types.
 *
 * The app builder is deterministic: a parsed request selects a template, the
 * template renders real files, and a validator checks them. No API key or model
 * is required for template generation; AI customization is an optional layer.
 */

export type AppStack = 'static' | 'vite-react' | 'next-minimal';
export type AppKind = 'todo' | 'dashboard' | 'landing' | 'custom';
export type AppStyle = 'premium-saas' | 'minimal' | 'dark' | 'apple-like';

export interface AppRequest {
  /** Display name, e.g. "Premium Todo App". */
  appName: string;
  /** Directory-safe slug, e.g. "premium-todo-app". */
  appSlug: string;
  description: string;
  kind: AppKind;
  stack: AppStack;
  style: AppStyle;
  /** Mock/local UI features detected (e.g. "tasks", "dashboard", "login-mock"). */
  features: string[];
  /** True when the user asked for something this phase can only mock (auth/db). */
  downgraded: boolean;
  /** Human-readable notes about downgrades/assumptions (shown honestly in report). */
  notes: string[];
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateVariables {
  appName: string;
  appSlug: string;
  description: string;
  style: AppStyle;
  features: string[];
}

export type ValidationStepKind = 'files-exist' | 'linked-assets' | 'node-check' | 'design-checklist' | 'command';

export interface TemplateValidationStep {
  kind: ValidationStepKind;
  /** For 'command' steps: the script command to run (requires approval/temp). */
  command?: string;
  /** For 'node-check': the JS file to syntax-check, relative to the app dir. */
  file?: string;
  /** For 'linked-assets'/'design-checklist': the HTML entry file. */
  entry?: string;
  name: string;
}

export interface AppTemplate {
  id: string;
  name: string;
  stack: AppStack;
  kind: AppKind;
  description: string;
  /** Render deterministic files for the given variables. */
  render: (vars: TemplateVariables) => TemplateFile[];
  /** Validation steps run after files are created. */
  validation: (vars: TemplateVariables) => TemplateValidationStep[];
  /** How to open/run the app, shown in the final report. */
  openInstructions: (slug: string) => string[];
  /** True when this stack may require install/build commands (Vite/Next). */
  requiresCommands: boolean;
}
