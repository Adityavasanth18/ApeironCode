import {staticTodoTemplate} from './templates/staticTodo.js';
import {staticLandingTemplate} from './templates/staticLanding.js';
import {dashboardStaticTemplate} from './templates/dashboardStatic.js';
import {viteReactTemplate} from './templates/viteReact.js';
import type {AppRequest, AppTemplate} from './types.js';

export const APP_TEMPLATES: AppTemplate[] = [
  staticTodoTemplate,
  staticLandingTemplate,
  dashboardStaticTemplate,
  viteReactTemplate,
];

export const getTemplateById = (id: string): AppTemplate | undefined =>
  APP_TEMPLATES.find((template) => template.id === id);

/**
 * Select a template for a parsed request (Phase 20C, Task C). Vite requests use
 * the vite-react template; otherwise the kind maps to a static template, with a
 * sensible fallback for `custom`.
 */
export const selectTemplate = (request: AppRequest): AppTemplate => {
  if (request.stack === 'vite-react' || request.stack === 'next-minimal') {
    return viteReactTemplate;
  }
  switch (request.kind) {
    case 'todo':
      return staticTodoTemplate;
    case 'dashboard':
      return dashboardStaticTemplate;
    case 'landing':
      return staticLandingTemplate;
    case 'custom':
    default:
      // A generic "app" with no clear kind gets the most universally useful
      // static starting point.
      return staticTodoTemplate;
  }
};
