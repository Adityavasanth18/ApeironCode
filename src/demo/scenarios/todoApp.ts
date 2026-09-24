import {promises as fs} from 'node:fs';
import path from 'node:path';

import type {DemoScenarioResult} from '../types.js';
import {checkLinkedAssets, nodeCheck} from '../validate.js';

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ApeironCode Demo · Todo</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="app">
    <h1>Todo</h1>
    <form id="add-form">
      <input id="new-todo" type="text" placeholder="Add a task…" autocomplete="off" />
      <button type="submit">Add</button>
    </form>
    <ul id="list" class="list"></ul>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const STYLES_CSS = `:root { color-scheme: light dark; --bg: #0f1115; --fg: #e6e9ef; --accent: #14b8a6; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg);
  display: grid; place-items: start center; min-height: 100vh; padding: 2rem; }
.app { width: min(28rem, 100%); }
h1 { margin: 0 0 1rem; }
form { display: flex; gap: .5rem; margin-bottom: 1rem; }
input { flex: 1; padding: .6rem .8rem; border-radius: .5rem; border: 1px solid #333; background: #181b22; color: var(--fg); }
button { padding: .6rem 1rem; border: 0; border-radius: .5rem; background: var(--accent); color: #02110e; font-weight: 600; cursor: pointer; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
.list li { display: flex; align-items: center; gap: .6rem; padding: .6rem .8rem; background: #181b22; border-radius: .5rem; }
.list li.done span { text-decoration: line-through; opacity: .55; }
`;

const APP_JS = `'use strict';
(function () {
  var form = document.getElementById('add-form');
  var input = document.getElementById('new-todo');
  var list = document.getElementById('list');

  function addTodo(text) {
    var li = document.createElement('li');
    var span = document.createElement('span');
    span.textContent = text;
    li.appendChild(span);
    li.addEventListener('click', function () { li.classList.toggle('done'); });
    list.appendChild(li);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = '';
    input.focus();
  });
})();
`;

/**
 * Deterministically scaffold a small working static todo app and validate that
 * its JS parses and its HTML asset links resolve.
 */
export const runTodoAppDemo = async (workspaceDir: string): Promise<DemoScenarioResult> => {
  await fs.mkdir(workspaceDir, {recursive: true});
  const files: Array<[string, string]> = [
    ['index.html', INDEX_HTML],
    ['styles.css', STYLES_CSS],
    ['app.js', APP_JS],
  ];
  for (const [name, content] of files) {
    await fs.writeFile(path.join(workspaceDir, name), content, 'utf8');
  }

  const exists = async (rel: string): Promise<boolean> =>
    fs.access(path.join(workspaceDir, rel)).then(() => true).catch(() => false);

  const validation = [
    await nodeCheck(workspaceDir, 'app.js'),
    await checkLinkedAssets(exists, INDEX_HTML),
  ];

  return {
    scenario: 'todo-app',
    title: 'Build a todo app',
    workspaceDir,
    plan: [
      'Create index.html (markup + links to styles.css and app.js)',
      'Create styles.css (calm dark theme)',
      'Create app.js (add/complete tasks)',
      'Validate: node --check app.js and confirm linked assets exist',
    ],
    filesCreated: files.map(([name]) => name),
    filesChanged: [],
    validation,
    openHint: 'open index.html',
    summary: `Created a working static todo app (${files.length} files). Open index.html in a browser.`,
  };
};
