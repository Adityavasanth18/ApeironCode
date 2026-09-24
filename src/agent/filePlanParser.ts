import {
  FilePlanSchema,
  buildFilePlanCorrectionText,
  formatZodIssues,
  validateFilePlanSemantics,
  type FilePlanSemanticOptions,
} from './filePlanSchema.js';
import {
  coercePlanShape,
  extractBalancedObject,
  extractBalancedObjects,
  extractFencedJson,
  repairLooseJson,
  unwrapToolCallEnvelope,
} from './filePlanRepair.js';
import type {FilePlan} from './filePlanProtocol.js';

export type ParseOptions = FilePlanSemanticOptions;

export type FilePlanParseStage = 'json' | 'schema' | 'semantic';

export type ParseResult =
  | {ok: true; plan: FilePlan; strategy: string}
  | {ok: false; stage: FilePlanParseStage; errors: string[]; correctionText: string};

/**
 * Yield candidate JSON strings from raw model output, cheapest/most-likely
 * first: the raw text, a fenced block, the largest balanced object, and tolerant
 * repairs of each.
 */
const candidateJsonStrings = (input: string): Array<{strategy: string; text: string}> => {
  const trimmed = input.trim();
  const candidates: Array<{strategy: string; text: string}> = [{strategy: 'direct', text: trimmed}];

  const fenced = extractFencedJson(input);
  if (fenced) candidates.push({strategy: 'fenced', text: fenced});

  // All top-level balanced objects, largest first (the real plan tends to be the
  // largest), so prose like `{ not json }` before the plan does not win.
  const balanced = [...extractBalancedObjects(input)].sort((a, b) => b.length - a.length);
  for (const text of balanced) candidates.push({strategy: 'balanced', text});

  const fencedBalanced = fenced ? extractBalancedObject(fenced) : undefined;
  if (fencedBalanced) candidates.push({strategy: 'fenced-balanced', text: fencedBalanced});

  // Tolerant repairs of each distinct candidate.
  const repaired: Array<{strategy: string; text: string}> = [];
  for (const candidate of candidates) {
    const fixed = repairLooseJson(candidate.text);
    if (fixed && fixed !== candidate.text) {
      repaired.push({strategy: `${candidate.strategy}+repair`, text: fixed});
    }
  }
  return [...candidates, ...repaired];
};

/**
 * Robustly parse a model's file-plan response (Phase 20B, Task A).
 *
 * Strategy order: direct JSON → fenced block → largest balanced object →
 * tolerant repair (comments/trailing commas/smart quotes) → tool-call envelope
 * unwrap → shape coercion → zod schema → semantic safety validation. No single
 * strict `JSON.parse` failure kills the workflow, and failures return exact,
 * model-facing validation errors plus a ready-to-send correction prompt.
 */
export const parseFilePlanResponse = (input: string, options: ParseOptions = {}): ParseResult => {
  if (!input || !input.trim()) {
    const errors = ['empty response: expected a JSON file plan'];
    return {ok: false, stage: 'json', errors, correctionText: buildFilePlanCorrectionText(errors)};
  }

  let parsedAny: {value: unknown; strategy: string} | undefined;
  for (const candidate of candidateJsonStrings(input)) {
    try {
      parsedAny = {value: JSON.parse(candidate.text), strategy: candidate.strategy};
      break;
    } catch {
      // try next strategy
    }
  }

  if (!parsedAny) {
    const errors = ['response was not valid JSON after fence/balance/repair extraction'];
    return {ok: false, stage: 'json', errors, correctionText: buildFilePlanCorrectionText(errors)};
  }

  const coerced = coercePlanShape(unwrapToolCallEnvelope(parsedAny.value));

  const schemaResult = FilePlanSchema.safeParse(coerced);
  if (!schemaResult.success) {
    const errors = formatZodIssues(schemaResult.error);
    return {ok: false, stage: 'schema', errors, correctionText: buildFilePlanCorrectionText(errors)};
  }

  const semanticErrors = validateFilePlanSemantics(schemaResult.data, options);
  if (semanticErrors.length > 0) {
    return {
      ok: false,
      stage: 'semantic',
      errors: semanticErrors,
      correctionText: buildFilePlanCorrectionText(semanticErrors),
    };
  }

  // schemaResult.data is structurally a FilePlan (patch is an extra optional field).
  const plan: FilePlan = schemaResult.data;
  return {ok: true, plan, strategy: parsedAny.strategy};
};
