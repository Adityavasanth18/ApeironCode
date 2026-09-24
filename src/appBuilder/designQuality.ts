import type {TemplateFile} from './types.js';

export interface DesignCheck {
  name: string;
  ok: boolean;
  detail: string;
}

const findFile = (files: TemplateFile[], rel: string): TemplateFile | undefined =>
  files.find((file) => file.path === rel || file.path === rel.replace(/^\.\//u, ''));

const linkedRefs = (html: string): string[] => {
  const refs: string[] = [];
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/giu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const ref = match[1]!;
    if (/^(?:https?:)?\/\//u.test(ref) || ref.startsWith('#') || ref.startsWith('data:') || ref.startsWith('/')) continue;
    refs.push(ref.replace(/^\.\//u, ''));
  }
  return refs;
};

/**
 * Run the deterministic static design checklist over rendered files
 * (Phase 20C, Task D). No browser/network: heuristics on the HTML/CSS source.
 * Generated apps should pass every relevant check.
 */
export const runDesignChecklist = (files: TemplateFile[], entry: string): {ok: boolean; checks: DesignCheck[]} => {
  const checks: DesignCheck[] = [];
  const add = (name: string, ok: boolean, detail: string): void => {
    checks.push({name, ok, detail});
  };

  const html = findFile(files, entry)?.content ?? '';
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => f.content).join('\n');

  add('entry HTML present', Boolean(html), html ? entry : `missing ${entry}`);
  add('has <title>', /<title>[^<]+<\/title>/iu.test(html), 'document title');
  add('has viewport meta', /<meta[^>]+name=["']viewport["']/iu.test(html), 'responsive viewport');

  const refs = linkedRefs(html);
  const missing = refs.filter((ref) => !findFile(files, ref));
  add('linked assets exist', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${refs.length} reference(s)`);

  const hasButtons = /<button|class=["'][^"']*\bbtn\b/iu.test(html);
  add('buttons have visible states', !hasButtons || /:hover|:focus(?:-visible)?/u.test(css), 'hover/focus states');

  const inputs = (html.match(/<input\b/giu) ?? []).length;
  const labels = (html.match(/<label\b/giu) ?? []).length;
  add('form inputs have labels', inputs === 0 || labels >= inputs, `${labels} label(s) for ${inputs} input(s)`);

  const mentionsList = /<ul|<table|class=["'][^"']*\blist\b/iu.test(html);
  add('empty state present where relevant', !mentionsList || /empty-state/u.test(html), 'empty state');

  add('no obvious horizontal overflow', /box-sizing\s*:\s*border-box/u.test(css), 'box-sizing border-box');
  add('responsive rules present', /@media/u.test(css), 'media query');

  const ok = checks.every((check) => check.ok);
  return {ok, checks};
};

export const formatDesignChecks = (checks: DesignCheck[]): string =>
  checks.map((check) => `  ${check.ok ? '✓' : '✗'} ${check.name} — ${check.detail}`).join('\n');
