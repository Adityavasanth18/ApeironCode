import type {AppTemplate, TemplateFile, TemplateVariables} from '../types.js';
import {designSystemCss, htmlHead, readme} from './shared.js';

const indexHtml = (vars: TemplateVariables): string => `${htmlHead(vars.appName)}
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">${vars.appName}</div>
      <nav aria-label="Sidebar">
        <a href="#" class="active">Overview</a>
        <a href="#">Customers</a>
        <a href="#">Reports</a>
        <a href="#">Settings</a>
      </nav>
    </aside>
    <main class="main">
      <header class="topbar">
        <h1>Overview</h1>
        <button class="btn" id="refresh">Refresh data</button>
      </header>
      <section class="stats" id="stats" aria-label="Key metrics"></section>
      <section class="card table-card">
        <h2>Recent customers</h2>
        <table class="table">
          <thead><tr><th>Name</th><th>Plan</th><th>Status</th><th>MRR</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
        <p id="empty" class="empty-state" hidden>No data to show.</p>
      </section>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>
`;

const stylesCss = (vars: TemplateVariables): string => `${designSystemCss(vars.style)}
.layout { display: grid; grid-template-columns: 16rem 1fr; min-height: 100vh; }
.sidebar { background: var(--surface); border-right: 1px solid var(--border); padding: var(--space-6); }
.sidebar .brand { font-weight: 700; margin-bottom: var(--space-6); }
.sidebar nav { display: grid; gap: var(--space-1); }
.sidebar nav a { color: var(--muted); text-decoration: none; padding: var(--space-2) var(--space-3); border-radius: var(--radius); }
.sidebar nav a.active, .sidebar nav a:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--fg); }
.main { padding: var(--space-8); }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-6); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-6); }
.stat .value { font-size: 1.75rem; font-weight: 700; }
.stat .label { color: var(--muted); font-size: .9rem; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: var(--space-3); border-bottom: 1px solid var(--border); }
.table th { color: var(--muted); font-weight: 600; font-size: .85rem; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: .8rem; background: color-mix(in srgb, var(--accent) 18%, transparent); }
@media (max-width: 720px) { .layout { grid-template-columns: 1fr; } .sidebar { display: none; } }
`;

const appJs = (): string => `'use strict';
(function () {
  // Local sample data (frontend-only, no backend).
  var customers = [
    {name: 'Acme Co', plan: 'Pro', status: 'Active', mrr: 240},
    {name: 'Globex', plan: 'Team', status: 'Active', mrr: 120},
    {name: 'Initech', plan: 'Starter', status: 'Trial', mrr: 0},
    {name: 'Umbrella', plan: 'Pro', status: 'Active', mrr: 240},
    {name: 'Hooli', plan: 'Team', status: 'Past due', mrr: 120}
  ];

  function money(n) { return '$' + n.toLocaleString(); }

  function renderStats() {
    var mrr = customers.reduce(function (sum, c) { return sum + c.mrr; }, 0);
    var active = customers.filter(function (c) { return c.status === 'Active'; }).length;
    var stats = [
      {label: 'Customers', value: String(customers.length)},
      {label: 'Active', value: String(active)},
      {label: 'MRR', value: money(mrr)},
      {label: 'Avg / customer', value: money(Math.round(mrr / customers.length))}
    ];
    var el = document.getElementById('stats');
    el.innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="value">' + s.value + '</div><div class="label">' + s.label + '</div></div>';
    }).join('');
  }

  function renderRows() {
    var rows = document.getElementById('rows');
    var empty = document.getElementById('empty');
    empty.hidden = customers.length > 0;
    rows.innerHTML = customers.map(function (c) {
      return '<tr><td>' + c.name + '</td><td>' + c.plan + '</td><td><span class="badge">' + c.status + '</span></td><td>' + money(c.mrr) + '</td></tr>';
    }).join('');
  }

  document.getElementById('refresh').addEventListener('click', function () {
    customers = customers.slice().sort(function () { return Math.random() - 0.5; });
    renderStats();
    renderRows();
  });

  renderStats();
  renderRows();
})();
`;

export const dashboardStaticTemplate: AppTemplate = {
  id: 'dashboard-static',
  name: 'Static Dashboard',
  stack: 'static',
  kind: 'dashboard',
  description: 'A responsive, frontend-only dashboard UI with local sample data.',
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
