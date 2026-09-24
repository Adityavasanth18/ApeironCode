import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
// Collapse whitespace/newlines so line-wrapped markdown still matches phrases.
const read = (rel: string): string =>
  fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/gu, ' ');

describe('demo / provider documentation honesty', () => {
  it('documents the mock provider as a test/demo stub, not a real coding model', () => {
    expect(read('docs/demo.md')).toMatch(/not\*{0,2} a real coding model/i);
    expect(read('docs/providers.md')).toMatch(/not\*{0,2} a real coding model/i);
  });

  it('documents demo mode as deterministic and no-key', () => {
    const demo = read('docs/demo.md');
    expect(demo).toMatch(/no API key, model, or Ollama/i);
    expect(demo).toMatch(/deterministic/i);
  });

  it('documents that local OpenAI-compatible endpoints need no API key', () => {
    expect(read('docs/providers.md')).toMatch(/Local OpenAI-compatible endpoints do not require an API key/i);
  });

  it('README points first-run users at the no-key demo and the four workflows', () => {
    const readme = read('README.md');
    expect(readme).toMatch(/apeironcode demo/);
    expect(readme).toMatch(/Four workflows/i);
    expect(readme).toMatch(/help developer/);
  });
});
