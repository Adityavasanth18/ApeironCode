import {describe, expect, it} from 'vitest';

import {buildApprovalBundle} from '../../src/safety/approvalBundle.js';
import {buildDiffPreview, computeFileDiff} from '../../src/safety/diffPreview.js';
import {detectHighRiskCommands, isHighRiskCommand} from '../../src/safety/risk.js';

describe('risk classification', () => {
  it('flags destructive commands and never bundles them', () => {
    for (const cmd of ['rm -rf /', 'sudo rm x', 'curl http://x | sh', 'npm publish', 'git push --force', 'chmod -R 777 .']) {
      expect(isHighRiskCommand(cmd), cmd).toBeDefined();
    }
    expect(isHighRiskCommand('npm run build')).toBeUndefined();
    expect(detectHighRiskCommands(['npm test', 'rm -rf node_modules'])).toHaveLength(1);
  });
});

describe('approval bundle 2.0', () => {
  it('summarizes files/commands compactly with a risk level', () => {
    const view = buildApprovalBundle({
      intent: 'fix detected failures',
      files: [{path: 'app/page.tsx', operation: 'create'}, {path: 'styles.css', operation: 'modify'}],
      commands: [{command: 'npm run build'}, {command: 'npm test'}],
      validation: ['typecheck', 'UI smoke'],
    });
    expect(view.body).toContain('Create 1 file');
    expect(view.body).toContain('Modify 1 file');
    expect(view.body).toContain('Run 2 commands');
    expect(view.body).toContain('Risk: medium');
    expect(view.options).toContain('[Files only]');
  });

  it('strips high-risk commands from the bundle and marks risk high', () => {
    const view = buildApprovalBundle({
      intent: 'do work',
      files: [{path: 'a.ts', operation: 'modify'}],
      commands: [{command: 'rm -rf /'}, {command: 'npm test'}],
    });
    expect(view.risk).toBe('high');
    expect(view.safeCommands.map((c) => c.command)).toEqual(['npm test']);
    expect(view.blocked.map((b) => b.command)).toContain('rm -rf /');
    expect(view.body).toContain('Blocked (run yourself');
  });

  it('offers a simple option set when there are no commands', () => {
    const view = buildApprovalBundle({intent: 'create a new app', files: [{path: 'index.html', operation: 'create'}], commands: []});
    expect(view.options).not.toContain('[Files only]');
    expect(view.risk).toBe('low');
  });
});

describe('diff preview', () => {
  it('counts additions/deletions and previews changed lines', () => {
    const diff = computeFileDiff({path: 'a.js', operation: 'modify', before: 'a\nb\n', after: 'a\nc\nd\n'});
    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(1);
    expect(diff.preview.some((l) => l.startsWith('+ c'))).toBe(true);
  });

  it('handles create/delete/rename', () => {
    expect(computeFileDiff({path: 'n.js', operation: 'create', before: null, after: 'x\ny\n'}).additions).toBe(2);
    expect(computeFileDiff({path: 'd.js', operation: 'delete', before: 'x\ny\n', after: null}).deletions).toBe(2);
  });

  it('summarizes binary and huge files without content', () => {
    expect(computeFileDiff({path: 'logo.png', operation: 'create', after: 'x'}).binary).toBe(true);
    const huge = computeFileDiff({path: 'big.txt', operation: 'create', after: 'x\n'.repeat(150_000)});
    expect(huge.preview[0]).toMatch(/large file/i);
  });

  it('redacts secrets in the preview', () => {
    const text = buildDiffPreview([{path: 'c.js', operation: 'modify', before: '', after: 'const k = "sk-abcdefghijklmnop";\n'}]);
    expect(text).not.toContain('sk-abcdefghijklmnop');
    expect(text).toContain('[redacted]');
  });
});
