import type {SmokePage, UiCheck, UiInteraction} from './types.js';

/**
 * Generic page checks that apply to any web target: a non-empty title and a
 * visible main heading. Asset/console checks are handled by the runner from
 * collected diagnostics.
 */
export const runGenericChecks = async (page: SmokePage): Promise<UiCheck[]> => {
  const checks: UiCheck[] = [];
  const title = (await page.title().catch(() => '')) ?? '';
  checks.push({name: 'title found', ok: title.trim().length > 0, detail: title || '(empty title)'});

  const headingVisible = await page.isVisible('h1').catch(() => false);
  const headingText = (await page.textOf('h1').catch(() => null)) ?? '';
  checks.push({name: 'main heading visible', ok: headingVisible, detail: headingText || 'no <h1>'});
  return checks;
};

type InteractionSpec = (page: SmokePage) => Promise<UiInteraction[]>;

const todoSpec: InteractionSpec = async (page) => {
  const interactions: UiInteraction[] = [];
  const hasInput = await page.count('input').catch(() => 0);
  const hasButton = await page.count('button, .btn').catch(() => 0);
  interactions.push({name: 'task input present', ok: hasInput > 0, detail: `${hasInput} input(s)`});
  interactions.push({name: 'add button present', ok: hasButton > 0, detail: `${hasButton} button(s)`});

  if (hasInput > 0 && hasButton > 0) {
    const before = await page.count('.list li, ul li, li').catch(() => 0);
    try {
      await page.fill('#new-todo, input', 'Buy milk');
      await page.click('#add-form button, button[type="submit"], .btn');
      const after = await page.count('.list li, ul li, li').catch(() => 0);
      interactions.push({name: 'Add task updates list', ok: after > before, detail: `${before} → ${after} item(s)`});
    } catch (error) {
      interactions.push({name: 'Add task updates list', ok: false, detail: String(error).slice(0, 120)});
    }
  }
  return interactions;
};

const dashboardSpec: InteractionSpec = async (page) => {
  const cards = await page.count('.stat, .card').catch(() => 0);
  const rows = await page.count('table tr, .list li').catch(() => 0);
  return [
    {name: 'dashboard cards visible', ok: cards > 0, detail: `${cards} card(s)`},
    {name: 'data table/list visible', ok: rows > 0, detail: `${rows} row(s)`},
  ];
};

const landingSpec: InteractionSpec = async (page) => {
  const cta = await page.count('a.btn, .btn').catch(() => 0);
  const nav = await page.count('nav a').catch(() => 0);
  const heroVisible = await page.isVisible('h1').catch(() => false);
  return [
    {name: 'hero heading visible', ok: heroVisible, detail: heroVisible ? 'visible' : 'missing'},
    {name: 'CTA present', ok: cta > 0, detail: `${cta} CTA(s)`},
    {name: 'nav anchors present', ok: nav > 0, detail: `${nav} link(s)`},
  ];
};

const SPECS: Record<string, InteractionSpec> = {
  'static-todo': todoSpec,
  'dashboard-static': dashboardSpec,
  'static-landing': landingSpec,
};

export const hasInteractionSpec = (templateId: string | undefined): boolean =>
  Boolean(templateId && templateId in SPECS);

/**
 * Run template-specific interaction checks. Unknown/absent template ids run no
 * interactions (the generic checks still apply).
 */
export const runInteractions = async (
  templateId: string | undefined,
  page: SmokePage,
): Promise<UiInteraction[]> => {
  const spec = templateId ? SPECS[templateId] : undefined;
  if (!spec) return [];
  return spec(page);
};
