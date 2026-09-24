import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('app-builder docs and packaging', () => {
  it('ships docs/build-apps.md in the npm package files list', () => {
    const pkg = JSON.parse(read('package.json')) as {files: string[]};
    expect(pkg.files).toContain('docs/build-apps.md');
    expect(fs.existsSync(path.join(ROOT, 'docs/build-apps.md'))).toBe(true);
  });

  it('does not overclaim full-stack SaaS / real auth / real database', () => {
    const text = read('README.md').replace(/\s+/gu, ' ') + ' ' + read('docs/build-apps.md').replace(/\s+/gu, ' ');
    expect(text).not.toMatch(/full-stack SaaS complete/i);
    expect(text).not.toMatch(/real authentication is included|real database is included/i);
    expect(text).not.toMatch(/production-ready/i);
  });

  it('documents app building honestly (templates, mock, no key)', () => {
    const doc = read('docs/build-apps.md');
    expect(doc).toMatch(/deterministic templates/i);
    expect(doc).toMatch(/no API key/i);
    expect(doc).toMatch(/mock\b/i);
    expect(doc).toMatch(/alpha/i);
  });

  it('README has a Build an app section', () => {
    expect(read('README.md')).toMatch(/## Build an app/);
  });
});
