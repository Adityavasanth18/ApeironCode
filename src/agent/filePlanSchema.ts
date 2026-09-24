import path from 'node:path';
import {z} from 'zod';

/**
 * Zod schema + semantic validation for file plans (Phase 20B, Task A).
 *
 * The schema validates the JSON shape; `validateFilePlanSemantics` enforces the
 * safety rules (no absolute paths, no `..` escapes, no `.git`/`.env`, operation
 * content requirements). Both produce structured, model-facing error strings so
 * a malformed plan can be corrected rather than crashing the workflow.
 */

export const FILE_PLAN_OPERATIONS = ['create', 'overwrite', 'modify', 'delete', 'rename'] as const;

export const FilePlanOperationSchema = z.enum(FILE_PLAN_OPERATIONS);

export const FilePlanFileSchema = z.object({
  path: z.string().min(1),
  operation: FilePlanOperationSchema,
  content: z.string().optional(),
  from: z.string().optional(),
  patch: z.string().optional(),
});

export const FilePlanCommandSchema = z.object({
  command: z.string().min(1),
  reason: z.string(),
});

export const FilePlanSchema = z.object({
  summary: z.string(),
  files: z.array(FilePlanFileSchema),
  commands: z.array(FilePlanCommandSchema),
  validation: z.array(z.string()),
});

export type FilePlanShape = z.infer<typeof FilePlanSchema>;

export interface FilePlanSemanticOptions {
  cwd?: string;
  /** Allow delete operations (off by default). */
  allowDelete?: boolean;
  /** Allow modifying `.env*` files (off by default). */
  allowEnv?: boolean;
  /** Max total content bytes. */
  maxContentBytes?: number;
}

const SECRET_RE = /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[a-z0-9_./+=-]{12,}/iu;
const ENV_FILE_RE = /(?:^|\/)\.env(?:\.[\w.-]+)?$/iu;
const GIT_PATH_RE = /(?:^|\/)\.git(?:\/|$)/iu;

const isAbsoluteOrEscaping = (cwd: string, filePath: string): boolean => {
  if (!filePath.trim() || path.isAbsolute(filePath) || filePath.startsWith('~')) return true;
  const resolved = path.resolve(cwd, filePath);
  const relative = path.relative(cwd, resolved);
  return relative === '' || relative.startsWith('..') || path.isAbsolute(relative);
};

/**
 * Enforce file-plan safety semantics that the JSON schema cannot express.
 * Returns an array of model-facing error strings (empty when the plan is safe).
 */
export const validateFilePlanSemantics = (
  plan: FilePlanShape,
  options: FilePlanSemanticOptions = {},
): string[] => {
  const cwd = options.cwd ?? process.cwd();
  const maxBytes = options.maxContentBytes ?? 120_000;
  const errors: string[] = [];
  let contentBytes = 0;

  if (plan.files.length === 0 && plan.commands.length === 0) {
    errors.push('plan is empty: provide at least one file change or command');
  }

  plan.files.forEach((file, index) => {
    const at = `files[${index}]`;
    if (isAbsoluteOrEscaping(cwd, file.path)) {
      errors.push(`${at}.path must be a relative path inside the workspace (no absolute paths or "..")`);
    }
    if (GIT_PATH_RE.test(file.path)) errors.push(`${at}.path must not target the .git directory`);
    if (ENV_FILE_RE.test(file.path) && !options.allowEnv) {
      errors.push(`${at}.path must not modify .env files (use --allow-env to override)`);
    }

    const needsBody = file.operation === 'create' || file.operation === 'overwrite' || file.operation === 'modify';
    if (needsBody && file.content === undefined && file.patch === undefined) {
      errors.push(`${at}.content (or .patch) is required for operation=${file.operation}`);
    }
    if (file.operation === 'delete' && file.content !== undefined) {
      errors.push(`${at}.content must not be set for operation=delete`);
    }
    if (file.operation === 'delete' && !options.allowDelete) {
      errors.push(`${at} delete requires explicit intent and is not allowed here`);
    }
    if (file.operation === 'rename') {
      if (!file.from) errors.push(`${at}.from is required for operation=rename`);
      if (file.from && isAbsoluteOrEscaping(cwd, file.from)) {
        errors.push(`${at}.from must be a relative path inside the workspace`);
      }
    }
    if (typeof file.content === 'string') {
      contentBytes += Buffer.byteLength(file.content, 'utf8');
      if (SECRET_RE.test(file.content)) errors.push(`${at}.content appears to contain a secret; remove it`);
    }
  });

  if (contentBytes > maxBytes) {
    errors.push(`total file content is too large (${contentBytes} > ${maxBytes} bytes)`);
  }

  plan.commands.forEach((command, index) => {
    if (!command.command.trim()) errors.push(`commands[${index}].command must not be empty`);
    if (SECRET_RE.test(command.command)) errors.push(`commands[${index}].command appears to contain a secret`);
  });

  return errors;
};

/**
 * Flatten zod issues into short model-facing strings like `files[0].content is required`.
 */
export const formatZodIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const at = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${at}: ${issue.message}`;
  });

/**
 * Build the correction prompt body shown to the model when a plan is invalid.
 */
export const buildFilePlanCorrectionText = (errors: string[]): string =>
  [
    'Your file plan failed validation:',
    ...errors.map((error) => `- ${error}`),
    '',
    'Required JSON shape:',
    '{"summary":"string","files":[{"path":"relative/path","operation":"create|overwrite|modify|delete|rename","content":"string optional","from":"string optional","patch":"string optional"}],"commands":[{"command":"string","reason":"string"}],"validation":["string"]}',
    '',
    'Return corrected JSON only. No prose, no markdown fences.',
  ].join('\n');
