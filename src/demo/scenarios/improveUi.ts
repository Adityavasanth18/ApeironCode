import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {DemoScenarioResult} from '../types.js';
import {checkLinkedAssets} from '../validate.js';

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pricing</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="card">
    <h1>Pro plan</h1>
    <p class="price">$12<span>/mo</span></p>
    <ul>
      <li>Unlimited projects</li>
      <li>Priority support</li>
      <li>Local-first privacy</li>
    </ul>
    <button>Get started</button>
  </main>
</body>
</html>
`;

const UGLY_CSS = `body { font-family: Times New Roman; background: #fff; color: #000; }
.card { width: 300px; border: 1px solid #000; padding: 10px; }
.price { font-size: 20px; }
button { background: gray; color: white; padding: 5px; }
`;

const PREMIUM_CSS = `:root {
  --bg: #0b0d12; --surface: #151922; --fg: #eef1f6; --muted: #9aa4b2; --accent: #14b8a6;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center;
  font-family: ui-sans-serif, system-ui, sans-serif; background: radial-gradient(1200px 600px at 50% -10%, #1b2230, var(--bg));
  color: var(--fg); padding: 2rem; }
.card { width: min(22rem, 100%); background: linear-gradient(180deg, var(--surface), #11151d);
  border: 1px solid #232a36; border-radius: 1rem; padding: 2rem; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
h1 { margin: 0 0 .25rem; font-size: 1.25rem; letter-spacing: -0.01em; }
.price { font-size: 2.75rem; font-weight: 700; margin: .5rem 0 1rem; }
.price span { font-size: 1rem; color: var(--muted); font-weight: 500; }
ul { list-style: none; padding: 0; margin: 0 0 1.5rem; display: grid; gap: .6rem; color: var(--muted); }
li::before { content: "✓ "; color: var(--accent); font-weight: 700; }
button { width: 100%; padding: .8rem 1rem; border: 0; border-radius: .7rem; cursor: pointer;
  background: linear-gradient(180deg, var(--accent), #0e8f80); color: #02110e; font-weight: 700;
  transition: transform .08s ease; }
button:hover { transform: translateY(-1px); }
`;

/**
 * Deterministically create a plain "ugly" pricing card, then apply a premium
 * restyle and confirm the page's linked assets still resolve.
 */
export const runImproveUiDemo = async (workspaceDir: string): Promise<DemoScenarioResult> => {
  await fs.mkdir(workspaceDir, {recursive: true});
  await fs.writeFile(path.join(workspaceDir, 'index.html'), INDEX_HTML, 'utf8');
  await fs.writeFile(path.join(workspaceDir, 'styles.css'), UGLY_CSS, 'utf8');

  const before = UGLY_CSS.split('\n').filter(Boolean).slice(0, 4);

  await fs.writeFile(path.join(workspaceDir, 'styles.css'), PREMIUM_CSS, 'utf8');
  const after = PREMIUM_CSS.split('\n').filter(Boolean).slice(0, 4);

  const exists = async (rel: string): Promise<boolean> =>
    fs.access(path.join(workspaceDir, rel)).then(() => true).catch(() => false);

  return {
    scenario: 'improve-ui',
    title: 'Improve the UI (make it premium)',
    workspaceDir,
    plan: [
      'Create index.html and a plain styles.css',
      'Rewrite styles.css with a premium dark theme (gradients, spacing, depth)',
      'Verify no CSS/JS references are missing after the change',
    ],
    filesCreated: ['index.html', 'styles.css'],
    filesChanged: ['styles.css'],
    validation: [await checkLinkedAssets(exists, INDEX_HTML)],
    beforeAfter: {before, after},
    openHint: 'open index.html',
    summary: 'Restyled the pricing card from plain to premium; all linked assets resolve. Open index.html.',
  };
};
