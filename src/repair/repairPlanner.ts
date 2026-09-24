import type {RepairContextPacket} from './contextBuilder.js';
import type {FailureSummary} from './failureClassifier.js';
import {formatIssueLine} from './failureClassifier.js';

const SCHEMA_LINE =
  '{"summary":"string","files":[{"path":"relative/path","operation":"create|overwrite|modify|delete|rename","content":"full file content"}],"commands":[{"command":"string","reason":"string"}],"validation":["string"]}';

export interface BuildRepairPromptOptions {
  safe?: boolean;
}

/**
 * Build the model prompt asking for a MINIMAL file plan that fixes the primary
 * failure. The runtime owns the workflow; the model only proposes a small patch.
 */
export const buildRepairPrompt = (
  failure: FailureSummary,
  context: RepairContextPacket,
  options: BuildRepairPromptOptions = {},
): string => {
  const fileSections = context.files
    .map((file) => `--- ${file.path} (${file.reason}) ---\n${file.content}`)
    .join('\n\n');

  return [
    'You are a coding agent runtime fixing a failing check. Return ONLY a JSON file plan.',
    'Do not call tools. Do not wrap the plan in tool-call JSON. Do not add prose or markdown.',
    '',
    `Failing command: ${context.failingCommand}`,
    'Issues:',
    ...failure.issues.slice(0, 6).map((issue) => `- ${formatIssueLine(issue)}`),
    '',
    'Error output (truncated):',
    context.errorExcerpt,
    '',
    'Relevant files:',
    fileSections || '(no files could be read)',
    '',
    'Return this exact JSON shape:',
    SCHEMA_LINE,
    '',
    'Rules:',
    '- Make the smallest change that fixes the failure.',
    '- For modify/overwrite include the COMPLETE new file content.',
    '- Use relative workspace paths only. Never touch .git or .env.',
    options.safe ? '- SAFE MODE: only modify files referenced by the error. No delete, rename, or install.' : '- Include rerun commands only when useful.',
    '- Do not include secrets.',
  ].join('\n');
};

/**
 * Build the short correction prompt (Phase 20B, Task B) shown after an invalid
 * plan: only the validation errors plus the schema, asking for corrected JSON.
 */
export const buildCorrectionPrompt = (validationErrors: string[]): string =>
  [
    'Your previous file plan was invalid:',
    ...validationErrors.map((error) => `- ${error}`),
    '',
    'Required JSON shape:',
    SCHEMA_LINE,
    '',
    'Return corrected JSON only. No prose, no markdown.',
  ].join('\n');
