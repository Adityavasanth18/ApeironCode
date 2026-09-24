/**
 * Phase 20D UI smoke types.
 *
 * The UI smoke opens a generated app in a real browser (Playwright, when
 * available), checks it actually renders, has no console errors / missing
 * assets, and passes template-specific interactions. Playwright is optional: if
 * the browser cannot run, the result is `skipped` — never a fake pass.
 */

export type UiTargetType = 'static' | 'vite' | 'unknown';

export interface AppMetadata {
  createdBy: string;
  templateId: string;
  appName: string;
  createdAt: string;
}

export interface UiTarget {
  type: UiTargetType;
  path: string;
  /** Entry HTML for static apps, relative to path. */
  entry?: string;
  /** Parsed `.apeironcode/app.json` metadata, when present. */
  meta?: AppMetadata;
  /** Why an unknown/vite target cannot be smoked right now (honest message). */
  reason?: string;
}

export interface UiCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface UiInteraction {
  name: string;
  ok: boolean;
  detail: string;
}

export type UiSmokeStatus = 'passed' | 'failed' | 'skipped';

export interface UiSmokeResult {
  status: UiSmokeStatus;
  targetType: UiTargetType;
  path: string;
  url?: string;
  checks: UiCheck[];
  interactions: UiInteraction[];
  consoleErrors: string[];
  networkFailures: string[];
  screenshotPath?: string;
  reportPath?: string;
  /** One-line outcome (e.g. the skip reason). */
  summary: string;
}

/**
 * Minimal browser page abstraction the smoke runner and interaction specs use.
 * A Playwright `Page` is adapted to this; tests provide a deterministic fake so
 * unit tests never need a real browser.
 */
export interface SmokePage {
  /** Visible text content of the first element matching a CSS selector, or null. */
  textOf: (selector: string) => Promise<string | null>;
  /** Whether at least one element matches the selector and is visible. */
  isVisible: (selector: string) => Promise<boolean>;
  /** Count of elements matching the selector. */
  count: (selector: string) => Promise<number>;
  /** Type text into the first element matching the selector. */
  fill: (selector: string, value: string) => Promise<void>;
  /** Click the first element matching the selector. */
  click: (selector: string) => Promise<void>;
  /** The document <title>. */
  title: () => Promise<string>;
}

/**
 * A launched browser session against a URL: a page plus collected diagnostics
 * and a screenshot capability. `close()` tears everything down.
 */
export interface SmokeSession {
  page: SmokePage;
  consoleErrors: () => string[];
  networkFailures: () => string[];
  screenshot: (absPath: string) => Promise<boolean>;
  close: () => Promise<void>;
}

/** Launches a browser session for a URL, or null when no browser is available. */
export type BrowserLauncher = (
  url: string,
  options: {timeoutMs: number},
) => Promise<SmokeSession | null>;
