import type {AppTemplate, TemplateFile, TemplateVariables} from '../types.js';
import {designSystemCss, htmlHead, readme} from './shared.js';

const indexHtml = (vars: TemplateVariables): string => `${htmlHead(vars.appName)}
<body>
  <header class="nav">
    <div class="container nav-inner">
      <span class="brand">${vars.appName}</span>
      <nav aria-label="Primary">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a class="btn" href="#cta" id="nav-cta">Get started</a>
      </nav>
    </div>
  </header>
  <main>
    <section class="hero container">
      <h1>${vars.appName}</h1>
      <p class="lead">${vars.description}</p>
      <div class="hero-actions">
        <a class="btn" href="#cta">Start free</a>
        <a class="btn secondary" href="#features">See features</a>
      </div>
    </section>
    <section id="features" class="features container">
      <article class="card"><h3>Fast</h3><p>Loads instantly with zero bloat.</p></article>
      <article class="card"><h3>Polished</h3><p>Accessible, responsive, premium by default.</p></article>
      <article class="card"><h3>Local-first</h3><p>Your data stays yours.</p></article>
    </section>
    <section id="cta" class="cta container">
      <div class="card cta-card">
        <h2>Ready to start?</h2>
        <p>Join the waitlist and we'll be in touch.</p>
        <form id="waitlist" class="waitlist" autocomplete="off">
          <label class="visually-hidden" for="email">Email</label>
          <input id="email" class="input" type="email" placeholder="you@example.com" required />
          <button class="btn" type="submit">Join waitlist</button>
        </form>
        <p id="waitlist-status" class="muted" role="status"></p>
      </div>
    </section>
  </main>
  <footer class="container footer"><p>&copy; ${new Date().getFullYear()} ${vars.appName}. Built with ApeironCode.</p></footer>
  <script src="app.js"></script>
</body>
</html>
`;

const stylesCss = (vars: TemplateVariables): string => `${designSystemCss(vars.style)}
.nav { position: sticky; top: 0; backdrop-filter: blur(8px); background: color-mix(in srgb, var(--bg) 85%, transparent); border-bottom: 1px solid var(--border); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; padding-block: var(--space-3); }
.brand { font-weight: 700; }
.nav nav { display: flex; align-items: center; gap: var(--space-4); }
.nav nav a:not(.btn) { color: var(--muted); text-decoration: none; }
.hero { text-align: center; padding-block: var(--space-12); }
.lead { font-size: 1.125rem; max-width: 40rem; margin-inline: auto; }
.hero-actions { display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--space-4); padding-block: var(--space-8); }
.cta { padding-block: var(--space-12); }
.cta-card { text-align: center; max-width: 36rem; margin-inline: auto; }
.waitlist { display: flex; gap: var(--space-2); margin-top: var(--space-4); }
.waitlist .input { flex: 1; }
.footer { padding-block: var(--space-8); text-align: center; }
@media (max-width: 390px) { .waitlist { flex-direction: column; } }
`;

const appJs = (): string => `'use strict';
(function () {
  var form = document.getElementById('waitlist');
  var email = document.getElementById('email');
  var status = document.getElementById('waitlist-status');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var value = email.value.trim();
    if (!value) return;
    status.textContent = 'Thanks! ' + value + ' is on the waitlist (demo only).';
    email.value = '';
  });
})();
`;

export const staticLandingTemplate: AppTemplate = {
  id: 'static-landing',
  name: 'Static Landing Page',
  stack: 'static',
  kind: 'landing',
  description: 'A premium static landing page with hero, features, and a mock waitlist.',
  requiresCommands: false,
  render: (vars): TemplateFile[] => [
    {path: 'index.html', content: indexHtml(vars)},
    {path: 'styles.css', content: stylesCss(vars)},
    {path: 'app.js', content: appJs()},
    {path: 'README.md', content: readme(vars.appName, vars.description, ['open index.html'])},
  ],
  validation: () => [
    {kind: 'files-exist', name: 'files created'},
    {kind: 'linked-assets', name: 'linked assets exist', entry: 'index.html'},
    {kind: 'node-check', name: 'JavaScript syntax', file: 'app.js'},
    {kind: 'design-checklist', name: 'design checklist', entry: 'index.html'},
  ],
  openInstructions: (slug) => [`open ${slug}/index.html`],
};
