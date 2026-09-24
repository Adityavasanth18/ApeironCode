import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {BrowserLauncher, SmokePage, SmokeSession} from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- Playwright is an optional, dynamically-imported dependency with no compile-time types. */

interface PlaywrightModule {
  chromium: {
    launch: (options?: {headless?: boolean}) => Promise<any>;
  };
}

/**
 * Dynamically load Playwright without a compile-time dependency. Using a
 * non-literal specifier prevents TypeScript/bundlers from requiring the module
 * to be installed. Returns null when Playwright is not available.
 */
const loadPlaywright = async (): Promise<PlaywrightModule | null> => {
  try {
    const specifier = 'playwright';
    const mod = (await import(specifier)) as unknown as PlaywrightModule;
    return mod?.chromium ? mod : null;
  } catch {
    return null;
  }
};

const adaptPage = (page: any): SmokePage => ({
  textOf: async (selector) => {
    const loc = page.locator(selector).first();
    if ((await loc.count()) === 0) return null;
    return (await loc.textContent())?.trim() ?? '';
  },
  isVisible: async (selector) => {
    const loc = page.locator(selector).first();
    return (await loc.count()) > 0 ? Boolean(await loc.isVisible()) : false;
  },
  count: (selector) => page.locator(selector).count(),
  fill: async (selector, value) => {
    await page.locator(selector).first().fill(value);
  },
  click: async (selector) => {
    await page.locator(selector).first().click({timeout: 5_000});
  },
  title: () => page.title(),
});

/**
 * The real Playwright-backed browser launcher (Phase 20D, Task A). Returns null
 * when Chromium cannot run so the caller reports `skipped`, never a fake pass.
 */
export const createPlaywrightLauncher = (): BrowserLauncher => async (url, options) => {
  const pw = await loadPlaywright();
  if (!pw) return null;

  let browser: any;
  try {
    browser = await pw.chromium.launch({headless: true});
  } catch {
    return null; // browser binaries not installed
  }

  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg: any) => {
    if (msg.type() === 'error') consoleErrors.push(String(msg.text()));
  });
  page.on('pageerror', (err: any) => consoleErrors.push(String(err?.message ?? err)));
  page.on('requestfailed', (req: any) => networkFailures.push(`${req.url()} (${req.failure()?.errorText ?? 'failed'})`));
  page.on('response', (res: any) => {
    if (res.status() >= 400) networkFailures.push(`${res.url()} (HTTP ${res.status()})`);
  });

  try {
    await page.goto(url, {waitUntil: 'networkidle', timeout: options.timeoutMs});
  } catch (error) {
    networkFailures.push(`navigation failed: ${String(error).slice(0, 120)}`);
  }

  const session: SmokeSession = {
    page: adaptPage(page),
    consoleErrors: () => consoleErrors,
    networkFailures: () => networkFailures,
    screenshot: async (absPath) => {
      try {
        await fs.mkdir(path.dirname(absPath), {recursive: true});
        await page.screenshot({path: absPath, fullPage: true});
        return true;
      } catch {
        return false;
      }
    },
    close: async () => {
      await browser.close().catch(() => undefined);
    },
  };
  return session;
};
