import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('terminal UX docs and packaging', () => {
  it('ships docs/terminal-ux.md in the npm package', () => {
    const pkg = JSON.parse(read('package.json')) as {files: string[]};
    expect(pkg.files).toContain('docs/terminal-ux.md');
    expect(fs.existsSync(path.join(ROOT, 'docs/terminal-ux.md'))).toBe(true);
  });

  it('documents approvals, rollback, and honest limits without overclaiming', () => {
    const doc = read('docs/terminal-ux.md').replace(/\s+/gu, ' ');
    expect(doc).toMatch(/approval bundle/i);
    expect(doc).toMatch(/rollback --last/);
    expect(doc).toMatch(/not.*OS-?sandboxed/i);
    expect(doc).toMatch(/not fully autonomous/i);
    expect(doc).not.toMatch(/production-ready/i);
    expect(doc).not.toMatch(/visual perfection/i);
  });
});
