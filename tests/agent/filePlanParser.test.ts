import {describe, expect, it} from 'vitest';

import {parseFilePlanResponse} from '../../src/agent/filePlanParser.js';

const validPlan = {
  summary: 'Add a file',
  files: [{path: 'src/a.ts', operation: 'create', content: 'export const a = 1;\n'}],
  commands: [{command: 'npm run typecheck', reason: 'verify types'}],
  validation: ['typecheck passes'],
};

describe('parseFilePlanResponse (robust)', () => {
  it('parses direct JSON', () => {
    const result = parseFilePlanResponse(JSON.stringify(validPlan));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.files[0]!.path).toBe('src/a.ts');
      expect(result.strategy).toBe('direct');
    }
  });

  it('parses fenced ```json blocks with surrounding prose', () => {
    const text = `Sure! Here is the plan:\n\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\`\nLet me know.`;
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(['fenced', 'balanced', 'fenced-balanced']).toContain(result.strategy);
  });

  it('extracts the largest balanced object from surrounding text', () => {
    const text = `prose { not json } more ${JSON.stringify(validPlan)} trailing`;
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
  });

  it('repairs trailing commas and comments', () => {
    const text = `{
      // plan
      "summary": "x",
      "files": [{"path": "a.ts", "operation": "create", "content": "x",}],
      "commands": [],
      "validation": [],
    }`;
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
  });

  it('unwraps a tool-call envelope (arguments as JSON string)', () => {
    const text = JSON.stringify({tool: 'apply_plan', arguments: JSON.stringify(validPlan)});
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.summary).toBe('Add a file');
  });

  it('unwraps a file_plan envelope (object)', () => {
    const text = JSON.stringify({file_plan: validPlan});
    expect(parseFilePlanResponse(text).ok).toBe(true);
  });

  it('normalizes a single file object into an array', () => {
    const text = JSON.stringify({summary: 's', files: validPlan.files[0], commands: [], validation: []});
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.files).toHaveLength(1);
  });

  it('normalizes missing commands/validation to empty arrays', () => {
    const text = JSON.stringify({summary: 's', files: validPlan.files});
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.commands).toEqual([]);
      expect(result.plan.validation).toEqual([]);
    }
  });

  it('normalizes commands given as strings', () => {
    const text = JSON.stringify({summary: 's', files: validPlan.files, commands: ['npm test'], validation: []});
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.commands[0]!.command).toBe('npm test');
  });

  it('returns exact schema errors for missing create content', () => {
    const text = JSON.stringify({summary: 's', files: [{path: 'a.ts', operation: 'create'}], commands: [], validation: []});
    const result = parseFilePlanResponse(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('semantic');
      expect(result.errors.join(' ')).toMatch(/content.*required/i);
      expect(result.correctionText).toContain('Return corrected JSON only');
    }
  });

  it('rejects absolute and parent-escaping paths', () => {
    const abs = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: '/etc/passwd', operation: 'create', content: 'x'}], commands: [], validation: []}),
    );
    expect(abs.ok).toBe(false);
    const escape = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: '../outside.ts', operation: 'create', content: 'x'}], commands: [], validation: []}),
    );
    expect(escape.ok).toBe(false);
  });

  it('rejects .git and .env targets by default', () => {
    const git = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: '.git/config', operation: 'modify', content: 'x'}], commands: [], validation: []}),
    );
    expect(git.ok).toBe(false);
    const env = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: '.env', operation: 'overwrite', content: 'x'}], commands: [], validation: []}),
    );
    expect(env.ok).toBe(false);
    const envAllowed = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: '.env', operation: 'overwrite', content: 'x'}], commands: [], validation: []}),
      {allowEnv: true},
    );
    expect(envAllowed.ok).toBe(true);
  });

  it('rejects delete with content and allows delete only with allowDelete', () => {
    const withContent = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: 'a.ts', operation: 'delete', content: 'x'}], commands: [], validation: []}),
      {allowDelete: true},
    );
    expect(withContent.ok).toBe(false);
    const blocked = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: 'a.ts', operation: 'delete'}], commands: [], validation: []}),
    );
    expect(blocked.ok).toBe(false);
    const allowed = parseFilePlanResponse(
      JSON.stringify({summary: 's', files: [{path: 'a.ts', operation: 'delete'}], commands: [], validation: []}),
      {allowDelete: true},
    );
    expect(allowed.ok).toBe(true);
  });

  it('does not crash on non-JSON garbage', () => {
    const result = parseFilePlanResponse('I cannot help with that.');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe('json');
  });
});
