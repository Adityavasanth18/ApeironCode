import path from 'node:path';

import type {CodingIntent} from './codingIntent.js';
import {parseFilePlanResponse as robustParseFilePlanResponse} from './filePlanParser.js';

export type FilePlanOperation = 'create' | 'overwrite' | 'modify' | 'delete' | 'rename';

export interface FilePlanFileChange {
  content?: string;
  from?: string;
  operation: FilePlanOperation;
  path: string;
  /** Optional unified-diff patch (Phase 20B). Reserved for patch-based edits. */
  patch?: string;
}

export interface FilePlanCommand {
  command: string;
  reason: string;
}

export interface FilePlan {
  commands: FilePlanCommand[];
  files: FilePlanFileChange[];
  summary: string;
  validation: string[];
}

export type FilePlanParseResult =
  | {ok: true; plan: FilePlan}
  | {error: string; ok: false};

export interface FilePlanValidationResult {
  errors: string[];
  ok: boolean;
  requiresApproval: boolean;
  requiresCommandApproval: boolean;
}

export interface FilePlanPromptOptions {
  maxContentBytes?: number;
}

// Phase 18A, Task D: visual/UI repair prompts (premium, iPhone-like, polished,
// layout, overflow, responsive, "not visually good", "ui/ux is bad") need a
// full layout correction, not a color-only tweak. The directive forces the
// model to fix structure + CSS comprehensively while preserving JS.
const VISUAL_REPAIR_RE =
  /\b(premium|iphone|ios|polished|beautiful|sleek|gorgeous|layout|overflow|responsive|circular|rounded|centered|too\s+wide|not\s+(?:visually|premium|good)|ui\/?ux|visually\s+(?:bad|weak|poor)|ui\s+is\s+bad)\b/iu;

export const wantsVisualRepair = (prompt: string): boolean => VISUAL_REPAIR_RE.test(prompt);

/** Strong, concrete visual-repair directive appended for premium/UI prompts. */
export const buildPremiumUiDirective = (): string =>
  [
    'PREMIUM UI REPAIR REQUIREMENTS (this is a visual/layout task, not a color tweak):',
    '- Apply a FULL layout correction, not color-only changes.',
    '- Update the HTML structure when the layout requires it (do not only touch CSS).',
    '- Rewrite the CSS comprehensively: spacing, sizing, alignment, grid/flex layout.',
    '- Preserve all existing JavaScript behavior; do not break event handlers or logic.',
    '- Guarantee NO overflow: use box-sizing:border-box and a bounded container.',
    '- Keep linked CSS/JS paths correct relative to the entry HTML you are editing.',
    '- Use modern design tokens (CSS variables), a bounded mobile-like container, and consistent spacing.',
    '- Make buttons/controls accessible with clear labels where possible.',
    '- For an iPhone-style calculator: dark/true-black background, 4-column grid, orange operators,',
    '  light-gray AC, circular/rounded buttons, the 0 button spanning two columns, centered + responsive.',
    '- End the summary with exactly how to open/run the result.',
  ].join('\n');

const SECRET_RE = /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[a-z0-9_./+=-]{12,}/iu;
const BINARY_EXT_RE = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|mp4|mov|wasm|woff2?|ttf)$/iu;

export function buildFilePlanPrompt(
  intent: CodingIntent,
  workspaceSnapshot: string,
  userPrompt: string,
  options: FilePlanPromptOptions = {},
): string {
  const maxBytes = options.maxContentBytes ?? 120_000;
  const premiumDirective = wantsVisualRepair(userPrompt) ? ['', buildPremiumUiDirective()] : [];
  return [
    'You are generating a structured file plan for a coding agent runtime.',
    'Return only JSON. Do not call tools. Do not wrap file operations in tool-call JSON.',
    'The runtime will validate, preview, ask approval, and execute the plan.',
    '',
    `Intent: ${intent.kind}`,
    `User request: ${userPrompt}`,
    `Workspace snapshot:\n${workspaceSnapshot || '(empty workspace)'}`,
    '',
    'Return this shape:',
    '{"summary":"string","files":[{"path":"relative/path.ext","operation":"create|overwrite|modify|delete|rename","content":"string optional","from":"string optional"}],"commands":[{"command":"string","reason":"string"}],"validation":["string"]}',
    '',
    'Rules:',
    `- Keep total file content under ${maxBytes} bytes.`,
    '- Use relative workspace paths only.',
    '- For create/overwrite/modify include complete file content.',
    '- Do not include secrets, tokens, or API keys.',
    '- Include commands only when useful, with a reason.',
    '- For full-stack apps, prefer a phased plan summary and only phase-1 files if the first phase is small.',
    ...premiumDirective,
  ].join('\n');
}

export function parseFilePlanResponse(text: string): FilePlanParseResult {
  // Delegate to the robust multi-strategy parser (Phase 20B, Task A). The
  // legacy shape `{ok, plan} | {ok:false, error}` is preserved for existing
  // callers; semantic safety checks here stay permissive (allowDelete) because
  // executeFilePlan re-validates with the caller's real options.
  const result = robustParseFilePlanResponse(text, {allowDelete: true, allowEnv: true});
  if (result.ok) return {ok: true, plan: result.plan};
  const prefix = result.stage === 'json'
    ? 'Invalid file plan JSON'
    : 'File plan JSON did not match the required shape';
  return {error: `${prefix}: ${result.errors.join('; ')}`, ok: false};
}

const isUnsafePath = (cwd: string, filePath: string): boolean => {
  if (!filePath.trim() || path.isAbsolute(filePath) || filePath.startsWith('~')) return true;
  const resolved = path.resolve(cwd, filePath);
  const relative = path.relative(cwd, resolved);
  return relative === '' || relative.startsWith('..') || path.isAbsolute(relative);
};

export function validateFilePlan(
  plan: FilePlan,
  cwd: string,
  options: {allowDelete?: boolean; maxContentBytes?: number} = {},
): FilePlanValidationResult {
  const errors: string[] = [];
  const maxBytes = options.maxContentBytes ?? 120_000;
  let contentBytes = 0;

  if (plan.files.length === 0 && plan.commands.length === 0) {
    errors.push('File plan is empty; ask a clarification instead of executing nothing.');
  }

  for (const file of plan.files) {
    if (isUnsafePath(cwd, file.path)) errors.push(`Unsafe path: ${file.path}`);
    if (BINARY_EXT_RE.test(file.path)) errors.push(`Binary file plans are not supported: ${file.path}`);
    if ((file.operation === 'create' || file.operation === 'overwrite' || file.operation === 'modify') && file.content === undefined) {
      errors.push(`${file.operation} requires content for ${file.path}`);
    }
    if (file.operation === 'delete' && !options.allowDelete) {
      errors.push(`Delete requires explicit user intent: ${file.path}`);
    }
    if (file.operation === 'rename') {
      if (!file.from) errors.push(`Rename requires from for ${file.path}`);
      if (file.from && isUnsafePath(cwd, file.from)) errors.push(`Unsafe rename source: ${file.from}`);
    }
    if (file.content) {
      contentBytes += Buffer.byteLength(file.content, 'utf8');
      if (SECRET_RE.test(file.content)) errors.push(`Potential secret detected in ${file.path}`);
    }
  }

  if (contentBytes > maxBytes) errors.push(`File plan content is too large (${contentBytes} bytes).`);
  for (const command of plan.commands) {
    if (!command.command.trim()) errors.push('Command plan contains an empty command.');
    if (SECRET_RE.test(command.command)) errors.push('Potential secret detected in command plan.');
  }

  return {
    errors,
    ok: errors.length === 0,
    requiresApproval: plan.files.length > 0 || plan.commands.length > 0,
    requiresCommandApproval: plan.commands.length > 0,
  };
}

export function formatFilePlanPreview(plan: FilePlan): string {
  const lines = [`Plan: ${plan.summary}`];
  if (plan.files.length > 0) {
    lines.push('Files:');
    for (const file of plan.files) {
      const source = file.operation === 'rename' && file.from ? ` from ${file.from}` : '';
      lines.push(`- ${file.operation} ${file.path}${source}`);
    }
  }
  if (plan.commands.length > 0) {
    lines.push('Commands:');
    for (const command of plan.commands) lines.push(`- ${command.command} (${command.reason})`);
  }
  if (plan.validation.length > 0) {
    lines.push('Validation:');
    for (const item of plan.validation) lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

export function isFilePlanSafe(plan: FilePlan): boolean {
  return !plan.files.some((file) => file.operation === 'delete') &&
    !plan.commands.some((command) => /\b(?:rm\s+-rf|sudo|curl\s+.*\|\s*sh)\b/iu.test(command.command));
}
