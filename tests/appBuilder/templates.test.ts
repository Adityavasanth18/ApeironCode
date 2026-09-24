import {describe, expect, it} from 'vitest';

import {APP_TEMPLATES, getTemplateById, selectTemplate} from '../../src/appBuilder/templateRegistry.js';
import {renderTemplate, isUnsafeTemplatePath} from '../../src/appBuilder/templateRenderer.js';
import {runDesignChecklist} from '../../src/appBuilder/designQuality.js';
import {parseAppRequest} from '../../src/appBuilder/requestParser.js';
import type {TemplateVariables} from '../../src/appBuilder/types.js';

const vars: TemplateVariables = {
  appName: 'Test App',
  appSlug: 'test-app',
  description: 'a test app',
  style: 'premium-saas',
  features: ['tasks'],
};

describe('template registry', () => {
  it('registers all expected templates with unique ids', () => {
    const ids = APP_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['static-todo', 'static-landing', 'dashboard-static', 'vite-react']));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('selects templates by kind/stack', () => {
    expect(selectTemplate(parseAppRequest('todo app')).id).toBe('static-todo');
    expect(selectTemplate(parseAppRequest('CRM dashboard')).id).toBe('dashboard-static');
    expect(selectTemplate(parseAppRequest('landing page')).id).toBe('static-landing');
    expect(selectTemplate(parseAppRequest('React app', {stack: 'vite'})).id).toBe('vite-react');
  });

  it('getTemplateById works', () => {
    expect(getTemplateById('static-todo')?.stack).toBe('static');
    expect(getTemplateById('nope')).toBeUndefined();
  });
});

describe('template renderer', () => {
  it('renders required files for static templates', () => {
    for (const id of ['static-todo', 'static-landing', 'dashboard-static']) {
      const result = renderTemplate(getTemplateById(id)!, vars);
      expect(result.errors).toEqual([]);
      const paths = result.files.map((f) => f.path);
      expect(paths).toEqual(expect.arrayContaining(['index.html', 'styles.css', 'app.js', 'README.md']));
    }
  });

  it('renders vite-react with package.json and src files', () => {
    const result = renderTemplate(getTemplateById('vite-react')!, vars);
    const paths = result.files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(['package.json', 'src/App.tsx', 'index.html']));
  });

  it('rejects unsafe template paths', () => {
    expect(isUnsafeTemplatePath('/etc/passwd')).toBe(true);
    expect(isUnsafeTemplatePath('../escape.txt')).toBe(true);
    expect(isUnsafeTemplatePath('.git/config')).toBe(true);
    expect(isUnsafeTemplatePath('.env')).toBe(true);
    expect(isUnsafeTemplatePath('src/index.ts')).toBe(false);
  });

  it('interpolates variables into rendered content', () => {
    const result = renderTemplate(getTemplateById('static-todo')!, {...vars, appName: 'My Cool App'});
    const html = result.files.find((f) => f.path === 'index.html')!.content;
    expect(html).toContain('My Cool App');
  });
});

describe('design quality checklist', () => {
  it('passes for every static template', () => {
    for (const id of ['static-todo', 'static-landing', 'dashboard-static']) {
      const result = renderTemplate(getTemplateById(id)!, vars);
      const checklist = runDesignChecklist(result.files, 'index.html');
      expect(checklist.ok, id).toBe(true);
    }
  });

  it('fails when a linked asset is missing', () => {
    const files = [{path: 'index.html', content: '<title>x</title><meta name="viewport" content="x"><link href="styles.css"><button>Go</button>'}];
    const checklist = runDesignChecklist(files, 'index.html');
    expect(checklist.ok).toBe(false);
    expect(checklist.checks.find((c) => c.name === 'linked assets exist')?.ok).toBe(false);
  });

  it('flags missing viewport meta', () => {
    const files = [{path: 'index.html', content: '<title>x</title>'}];
    const checklist = runDesignChecklist(files, 'index.html');
    expect(checklist.checks.find((c) => c.name === 'has viewport meta')?.ok).toBe(false);
  });
});
