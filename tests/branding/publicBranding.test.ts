import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('public ApeironCode branding', () => {
  it('uses ApeironCode metadata and exposes only the apeironcode binary', () => {
    const pkg = JSON.parse(read('package.json')) as {
      bin: Record<string, string>;
      description: string;
      displayName: string;
    };

    expect(pkg.displayName).toBe('ApeironCode');
    expect(pkg.description).toMatch(/local-first/i);
    expect(pkg.bin).toEqual({apeironcode: './dist/cli/index.js'});
  });

  it('presents a CLI-only public alpha', () => {
    const readme = read('README.md');
    expect(readme).toContain('ApeironCode');
    expect(readme).toMatch(/CLI-only public release/i);
    expect(readme).toMatch(/VS Code extension is not part of this public alpha/i);
  });
});
