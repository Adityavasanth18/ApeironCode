import type {AppTemplate, TemplateFile, TemplateVariables} from '../types.js';
import {designSystemCss, htmlHead, readme} from './shared.js';

const indexHtml = (vars: TemplateVariables): string => `${htmlHead(vars.appName)}
<body>
  <main class="container app">
    <header class="app-header">
      <h1>${vars.appName}</h1>
      <p>${vars.description}</p>
    </header>
    <form id="add-form" class="add-form" autocomplete="off">
      <label class="visually-hidden" for="new-todo">New task</label>
      <input id="new-todo" class="input" type="text" placeholder="Add a task…" />
      <button class="btn" type="submit">Add</button>
    </form>
    <section aria-live="polite">
      <ul id="list" class="list" aria-label="Tasks"></ul>
      <p id="empty" class="empty-state">No tasks yet. Add your first one above.</p>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const stylesCss = (vars: TemplateVariables): string => `${designSystemCss(vars.style)}
.app { padding-block: var(--space-12); max-width: 34rem; }
.app-header { margin-bottom: var(--space-6); }
.add-form { display: flex; gap: var(--space-2); margin-bottom: var(--space-6); }
.add-form .input { flex: 1; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
.list li {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4); background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.list li.done .label { text-decoration: line-through; color: var(--muted); }
.list .label { flex: 1; cursor: pointer; }
.list .remove { background: transparent; border: 0; color: var(--muted); cursor: pointer; font-size: 1.1rem; }
.list .remove:hover { color: var(--fg); }
`;

const appJs = (): string => `'use strict';
(function () {
  var form = document.getElementById('add-form');
  var input = document.getElementById('new-todo');
  var list = document.getElementById('list');
  var empty = document.getElementById('empty');

  function refreshEmpty() {
    empty.style.display = list.children.length === 0 ? 'block' : 'none';
  }

  function addTodo(text) {
    var li = document.createElement('li');
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = text;
    label.addEventListener('click', function () { li.classList.toggle('done'); });
    var remove = document.createElement('button');
    remove.className = 'remove';
    remove.setAttribute('aria-label', 'Remove task');
    remove.textContent = '\\u00d7';
    remove.addEventListener('click', function () { li.remove(); refreshEmpty(); });
    li.appendChild(label);
    li.appendChild(remove);
    list.appendChild(li);
    refreshEmpty();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = '';
    input.focus();
  });

  refreshEmpty();
})();
`;

export const staticTodoTemplate: AppTemplate = {
  id: 'static-todo',
  name: 'Static Todo App',
  stack: 'static',
  kind: 'todo',
  description: 'A polished static HTML/CSS/JS todo app. No install required.',
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
