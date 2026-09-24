import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {buildApp} from '../../src/appBuilder/appBuilder.js';
import {validateApp} from '../../src/appBuilder/appValidation.js';
import {getTemplateById} from '../../src/appBuilder/templateRegistry.js';
import type {TemplateVariables} from '../../src/appBuilder/types.js';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-appbuild-'));
});
afterEach(async () => {
  await fs.rm(root, {recursive: true, force: true});
});

const approveYes = vi.fn(() => Promise.resolve(true));
const approveNo = vi.fn(() => Promise.resolve(false));

describe('buildApp orchestrator', () => {
  it('creates a static todo app with passing validation, no key/model/network', async () => {
    const result = await buildApp('premium todo app', {cwd: root, dir: 'todo', approve: approveYes});
    expect(result.status).toBe('created');
    expect(result.filesCreated).toEqual(expect.arrayContaining(['index.html', 'styles.css', 'app.js']));
    expect(result.validation?.passed).toBe(true);
    expect(await fs.readFile(path.join(root, 'todo', 'index.html'), 'utf8')).toContain('<title>');
  });

  it('does not write anything on dry-run', async () => {
    const result = await buildApp('todo', {cwd: root, dir: 'dry', dryRun: true, approve: approveYes});
    expect(result.status).toBe('dry-run');
    await expect(fs.access(path.join(root, 'dry'))).rejects.toThrow();
  });

  it('refuses to write into a non-empty directory without --overwrite', async () => {
    await fs.mkdir(path.join(root, 'busy'), {recursive: true});
    await fs.writeFile(path.join(root, 'busy', 'keep.txt'), 'x');
    const result = await buildApp('todo', {cwd: root, dir: 'busy', approve: approveYes});
    expect(result.status).toBe('blocked-existing');
    // The user's file is untouched.
    expect(await fs.readFile(path.join(root, 'busy', 'keep.txt'), 'utf8')).toBe('x');
  });

  it('never overwrites an existing file even with --overwrite', async () => {
    await fs.mkdir(path.join(root, 'mix'), {recursive: true});
    await fs.writeFile(path.join(root, 'mix', 'index.html'), 'ORIGINAL');
    const result = await buildApp('todo', {cwd: root, dir: 'mix', overwrite: true, approve: approveYes});
    expect(result.status).toBe('created');
    // Pre-existing index.html is preserved; it is reported as a refusal note.
    expect(await fs.readFile(path.join(root, 'mix', 'index.html'), 'utf8')).toBe('ORIGINAL');
    expect(result.notes.join(' ')).toMatch(/refused to overwrite/i);
  });

  it('writes nothing when approval is declined', async () => {
    const result = await buildApp('todo', {cwd: root, dir: 'declined', approve: approveNo});
    expect(result.status).toBe('rejected');
    await expect(fs.access(path.join(root, 'declined'))).rejects.toThrow();
  });
});

describe('app validation', () => {
  const vars: TemplateVariables = {appName: 'X', appSlug: 'x', description: 'x', style: 'minimal', features: []};

  it('fails when JavaScript has a syntax error', async () => {
    const dir = path.join(root, 'badjs');
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(path.join(dir, 'index.html'), '<link href="styles.css"><script src="app.js"></script>');
    await fs.writeFile(path.join(dir, 'styles.css'), 'body{}');
    await fs.writeFile(path.join(dir, 'app.js'), 'function ( {');
    const files = [
      {path: 'index.html', content: '<link href="styles.css"><script src="app.js"></script>'},
      {path: 'styles.css', content: 'body{}'},
      {path: 'app.js', content: 'function ( {'},
    ];
    const result = await validateApp(dir, getTemplateById('static-todo')!, vars, files);
    expect(result.passed).toBe(false);
    expect(result.steps.find((s) => s.name === 'JavaScript syntax')?.passed).toBe(false);
  });

  it('fails when a linked CSS asset is missing on disk', async () => {
    const dir = path.join(root, 'nocss');
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(path.join(dir, 'index.html'), '<link href="styles.css"><script src="app.js"></script>');
    await fs.writeFile(path.join(dir, 'app.js'), '"use strict";');
    const files = [
      {path: 'index.html', content: '<link href="styles.css"><script src="app.js"></script>'},
      {path: 'app.js', content: '"use strict";'},
    ];
    const result = await validateApp(dir, getTemplateById('static-todo')!, vars, files);
    expect(result.steps.find((s) => s.name === 'linked assets exist')?.passed).toBe(false);
  });

  it('skips Vite command steps rather than failing when runCommands is off', async () => {
    const dir = path.join(root, 'vite');
    const template = getTemplateById('vite-react')!;
    const files = template.render(vars);
    await fs.mkdir(dir, {recursive: true});
    for (const file of files) {
      await fs.mkdir(path.dirname(path.join(dir, file.path)), {recursive: true});
      await fs.writeFile(path.join(dir, file.path), file.content);
    }
    const result = await validateApp(dir, template, vars, files, {runCommands: false});
    expect(result.passed).toBe(true);
    expect(result.steps.some((s) => s.skipped)).toBe(true);
  });
});
