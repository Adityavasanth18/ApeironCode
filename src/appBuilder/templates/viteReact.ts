import type {AppTemplate, TemplateFile, TemplateVariables} from '../types.js';
import {designSystemCss, readme} from './shared.js';

const packageJson = (vars: TemplateVariables): string => `${JSON.stringify({
  name: vars.appSlug,
  private: true,
  version: '0.1.0',
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'tsc -b && vite build',
    typecheck: 'tsc --noEmit',
    preview: 'vite preview',
  },
  dependencies: {react: '^18.3.1', 'react-dom': '^18.3.1'},
  devDependencies: {
    '@types/react': '^18.3.3',
    '@types/react-dom': '^18.3.0',
    '@vitejs/plugin-react': '^4.3.1',
    typescript: '^5.5.0',
    vite: '^5.4.0',
  },
}, null, 2)}\n`;

const tsconfig = (): string => `${JSON.stringify({
  compilerOptions: {
    target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', resolveJsonModule: true,
    isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: true,
  },
  include: ['src'],
}, null, 2)}\n`;

const viteConfig = (): string => `import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({plugins: [react()]});
`;

const indexHtml = (vars: TemplateVariables): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${vars.appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const mainTsx = (): string => `import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;

const appTsx = (vars: TemplateVariables): string => `import {useState} from 'react';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export function App(): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');

  const add = (event: React.FormEvent): void => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setTodos((prev) => [...prev, {id: Date.now(), text: value, done: false}]);
    setText('');
  };

  return (
    <main className="container app">
      <h1>${vars.appName}</h1>
      <p>${vars.description}</p>
      <form className="add-form" onSubmit={add}>
        <label className="visually-hidden" htmlFor="new-todo">New task</label>
        <input id="new-todo" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task…" />
        <button className="btn" type="submit">Add</button>
      </form>
      {todos.length === 0 ? (
        <p className="empty-state">No tasks yet. Add your first one above.</p>
      ) : (
        <ul className="list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? 'done' : ''}>
              <span className="label" onClick={() => setTodos((p) => p.map((t) => (t.id === todo.id ? {...t, done: !t.done} : t)))}>
                {todo.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
`;

export const viteReactTemplate: AppTemplate = {
  id: 'vite-react',
  name: 'Vite + React (TypeScript)',
  stack: 'vite-react',
  kind: 'custom',
  description: 'A React + TypeScript app scaffolded with Vite. Requires npm install to run.',
  requiresCommands: true,
  render: (vars): TemplateFile[] => [
    {path: 'package.json', content: packageJson(vars)},
    {path: 'tsconfig.json', content: tsconfig()},
    {path: 'vite.config.ts', content: viteConfig()},
    {path: 'index.html', content: indexHtml(vars)},
    {path: 'src/main.tsx', content: mainTsx()},
    {path: 'src/App.tsx', content: appTsx(vars)},
    {path: 'src/styles.css', content: `${designSystemCss(vars.style)}\n.app { padding-block: var(--space-12); max-width: 34rem; }\n.add-form { display: flex; gap: var(--space-2); margin-bottom: var(--space-6); }\n.add-form .input { flex: 1; }\n.list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }\n.list li { padding: var(--space-3) var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }\n.list li.done .label { text-decoration: line-through; color: var(--muted); }\n.list .label { cursor: pointer; }\n`},
    {path: 'README.md', content: readme(vars.appName, vars.description, ['cd ' + vars.appSlug, 'npm install', 'npm run dev'])},
  ],
  validation: () => [
    {kind: 'files-exist', name: 'files created'},
    {kind: 'command', name: 'build', command: 'npm run build'},
    {kind: 'command', name: 'typecheck', command: 'npm run typecheck'},
  ],
  openInstructions: (slug) => [`cd ${slug}`, 'npm install', 'npm run dev'],
};
