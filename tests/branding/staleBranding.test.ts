import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_PREFIXES = [
  'docs/',
  'src/',
  'tests/',
  'scripts/',
  'examples/',
  '.github/',
];
const PUBLIC_FILES = new Set([
  'README.md',
  'package.json',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'action.yml',
]);

describe('legacy branding regression gate', () => {
  it('has no former product names in public tracked files', () => {
    const formerBrand = ['Open', 'Code'].join('');
    const formerCommand = formerBrand.toLowerCase();
    const legacyPattern = new RegExp([
      formerBrand,
      formerCommand,
      ['open', 'code'].join('-'),
      `${formerCommand}-agent`,
      formerCommand.toUpperCase(),
      `@${formerCommand}`,
    ].join('|'), 'u');
    const trackedFiles = execFileSync('git', ['ls-files'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).split('\n').filter(Boolean);

    const violations = trackedFiles
      .filter((file) => fs.existsSync(path.join(ROOT, file)))
      .filter((file) =>
        PUBLIC_FILES.has(file)
        || PUBLIC_PREFIXES.some((prefix) => file.startsWith(prefix)))
      .filter((file) =>
        legacyPattern.test(file)
        || legacyPattern.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));

    expect(violations).toEqual([]);
  });
});
