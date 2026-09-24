import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('UI smoke docs and packaging', () => {
  it('ships docs/ui-smoke.md in the npm package', () => {
    const pkg = JSON.parse(read('package.json')) as {files: string[]};
    expect(pkg.files).toContain('docs/ui-smoke.md');
    expect(fs.existsSync(path.join(ROOT, 'docs/ui-smoke.md'))).toBe(true);
  });

  it('documents Chromium install and honest skip, without overclaiming', () => {
    const doc = read('docs/ui-smoke.md').replace(/\s+/gu, ' ');
    expect(doc).toMatch(/npx playwright install chromium/);
    expect(doc).toMatch(/skipped/i);
    expect(doc).toMatch(/not a full QA replacement/i);
    expect(doc).not.toMatch(/visual perfection/i);
    expect(doc).not.toMatch(/catches all UI bugs/i);
  });

  it('gitignores UI smoke artifacts', () => {
    expect(read('.gitignore')).toMatch(/\.apeironcode\/ui-smoke\//);
  });
});
