/**
 * Low-level text → candidate-JSON extraction and tolerant repair (Phase 20B,
 * Task A). These helpers never throw; they return candidate strings/objects for
 * the parser to validate. Repair stays conservative — we do not "fix" content in
 * ways that could change a plan's meaning.
 */

/** Extract the body of the first ```json (or bare ```) fenced block, if any. */
export const extractFencedJson = (text: string): string | undefined => {
  const fenced = text.match(/```(?:json|json5)?\s*([\s\S]*?)```/iu);
  return fenced?.[1]?.trim();
};

/**
 * Collect every top-level balanced `{...}` object substring, respecting string
 * literals and escapes. Nested objects are not returned separately. Order is
 * left-to-right.
 */
export const extractBalancedObjects = (text: string): string[] => {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
};

/**
 * The largest top-level balanced object substring, or undefined when none.
 */
export const extractBalancedObject = (text: string): string | undefined => {
  const objects = extractBalancedObjects(text);
  if (objects.length === 0) return undefined;
  return objects.reduce((longest, current) => (current.length > longest.length ? current : longest));
};

/**
 * Tolerant cleanup of near-JSON: strip `//` and block comments, remove trailing
 * commas, and normalize smart quotes. Returns a new string; never throws.
 */
export const repairLooseJson = (input: string): string => {
  let out = input;
  // Normalize smart quotes to straight quotes.
  out = out.replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'");
  // Strip block comments.
  out = out.replace(/\/\*[\s\S]*?\*\//gu, '');
  // Strip line comments that are not inside a string (best-effort: only when the
  // `//` is preceded by whitespace, a comma, or a brace/bracket).
  out = out.replace(/(^|[\s,{}[\]])\/\/[^\n]*/gu, '$1');
  // Remove trailing commas before } or ].
  out = out.replace(/,(\s*[}\]])/gu, '$1');
  return out.trim();
};

interface JsonObject {
  [key: string]: unknown;
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Unwrap a known tool-call envelope to the inner plan object. Models sometimes
 * wrap the plan as `{tool: "...", arguments: {...}}` / `{input: {...}}` /
 * `{file_plan: {...}}` / `{plan: {...}}`. `arguments`/`input` may be a JSON
 * string. Returns the inner object, or the value itself when no envelope.
 */
export const unwrapToolCallEnvelope = (value: unknown): unknown => {
  if (!isObject(value)) return value;
  for (const key of ['file_plan', 'filePlan', 'plan', 'arguments', 'input']) {
    if (key in value) {
      const inner = value[key];
      if (typeof inner === 'string') {
        try {
          return JSON.parse(inner) as unknown;
        } catch {
          return inner;
        }
      }
      if (isObject(inner)) return inner;
    }
  }
  return value;
};

/**
 * Coerce common "almost right" plan shapes into the canonical object so schema
 * validation can succeed:
 * - a single file object → wrapped in an array
 * - `commands` as a string or array of strings → `{command, reason}` objects
 * - missing `commands`/`validation` → empty arrays
 */
export const coercePlanShape = (value: unknown): unknown => {
  if (!isObject(value)) return value;
  const out: JsonObject = {...value};

  if (isObject(out.files)) out.files = [out.files];

  if (out.commands === undefined) out.commands = [];
  else if (typeof out.commands === 'string') {
    out.commands = [{command: out.commands, reason: ''}];
  } else if (Array.isArray(out.commands)) {
    out.commands = (out.commands as unknown[]).map((entry: unknown) =>
      typeof entry === 'string' ? {command: entry, reason: ''} : entry,
    );
  }

  if (out.validation === undefined) out.validation = [];
  else if (typeof out.validation === 'string') out.validation = [out.validation];

  return out;
};
