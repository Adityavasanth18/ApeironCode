import {describe, expect, it} from 'vitest';

import {parseAppRequest, slugify} from '../../src/appBuilder/requestParser.js';

describe('app request parser', () => {
  it('slugifies ideas into directory-safe names', () => {
    expect(slugify('Premium Todo App!')).toBe('premium-todo-app');
    expect(slugify('   ')).toBe('app');
  });

  it('detects todo apps', () => {
    const r = parseAppRequest('premium todo app');
    expect(r.kind).toBe('todo');
    expect(r.stack).toBe('static');
    expect(r.style).toBe('premium-saas');
    expect(r.appSlug).toBe('premium-todo');
  });

  it('routes CRM/dashboard/admin to dashboard', () => {
    expect(parseAppRequest('CRM dashboard for small business').kind).toBe('dashboard');
    expect(parseAppRequest('admin analytics panel').kind).toBe('dashboard');
  });

  it('routes landing/startup/portfolio to landing', () => {
    expect(parseAppRequest('landing page for an AI startup').kind).toBe('landing');
    expect(parseAppRequest('personal portfolio site').kind).toBe('landing');
  });

  it('routes React/Vite to vite-react', () => {
    expect(parseAppRequest('a React task app').stack).toBe('vite-react');
    expect(parseAppRequest('build with Vite').stack).toBe('vite-react');
  });

  it('downgrades Next.js to Vite when next is unavailable', () => {
    const r = parseAppRequest('Next.js dashboard', {nextAvailable: false});
    expect(r.stack).toBe('vite-react');
    expect(r.downgraded).toBe(true);
    expect(r.notes.join(' ')).toMatch(/Next\.js is not available/i);
  });

  it('treats auth/billing as mock features and is honest about it', () => {
    const r = parseAppRequest('SaaS task manager with login and billing');
    expect(r.features).toContain('login-mock');
    expect(r.features).toContain('billing-mock');
    expect(r.downgraded).toBe(true);
    expect(r.notes.join(' ')).toMatch(/mock\/local UI only/i);
  });

  it('honors explicit --stack and --style', () => {
    const r = parseAppRequest('todo', {stack: 'vite', style: 'dark'});
    expect(r.stack).toBe('vite-react');
    expect(r.style).toBe('dark');
  });
});
