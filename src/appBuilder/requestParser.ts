import type {AppKind, AppRequest, AppStack, AppStyle} from './types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'app', 'application', 'for', 'with', 'and', 'to', 'of', 'create', 'build',
  'make', 'me', 'my', 'please', 'simple', 'small',
]);

/** Convert free text to a directory-safe slug. */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60) || 'app';

/** Build a Title Case display name from the idea, dropping filler words. */
const toAppName = (idea: string): string => {
  const words = idea
    .replace(/[^a-zA-Z0-9\s]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()));
  const picked = (words.length > 0 ? words : ['App']).slice(0, 5);
  return picked.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const KIND_PATTERNS: Array<{kind: AppKind; re: RegExp}> = [
  {kind: 'dashboard', re: /\b(dashboard|crm|admin|analytics|console|panel|metrics)\b/iu},
  {kind: 'landing', re: /\b(landing|startup|portfolio|marketing|homepage|product page|waitlist)\b/iu},
  {kind: 'todo', re: /\b(todo|to-do|task|tasks|habit|checklist|notes?|reminder)\b/iu},
];

const STYLE_PATTERNS: Array<{style: AppStyle; re: RegExp}> = [
  {style: 'premium-saas', re: /\b(premium|saas|professional|polished|sleek)\b/iu},
  {style: 'apple-like', re: /\b(apple|ios|iphone|cupertino)\b/iu},
  {style: 'dark', re: /\b(dark|midnight|black)\b/iu},
];

const FEATURE_PATTERNS: Array<{feature: string; re: RegExp; mock?: boolean}> = [
  {feature: 'tasks', re: /\b(task|todo|checklist|habit)\b/iu},
  {feature: 'dashboard', re: /\b(dashboard|analytics|metrics|charts?)\b/iu},
  {feature: 'login-mock', re: /\b(login|sign\s?in|auth|account|sign\s?up)\b/iu, mock: true},
  {feature: 'sample-data', re: /\b(crm|customers?|contacts?|users?|orders?|leads?)\b/iu},
  {feature: 'billing-mock', re: /\b(billing|payment|stripe|subscription|pricing)\b/iu, mock: true},
];

export interface ParseAppRequestOptions {
  stack?: string;
  style?: string;
  /** Whether next-minimal is actually available; downgrade if not. */
  nextAvailable?: boolean;
}

const detectKind = (idea: string): AppKind => {
  for (const pattern of KIND_PATTERNS) if (pattern.re.test(idea)) return pattern.kind;
  return 'custom';
};

const normalizeStack = (raw: string | undefined): AppStack | undefined => {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (value === 'static' || value === 'dashboard' || value === 'dashboard-static') return 'static';
  if (value === 'vite' || value === 'vite-react' || value === 'react') return 'vite-react';
  if (value === 'next' || value === 'next-minimal' || value === 'nextjs') return 'next-minimal';
  return undefined;
};

const detectStackFromIdea = (idea: string): AppStack | undefined => {
  if (/\bnext\.?js\b/iu.test(idea)) return 'next-minimal';
  if (/\b(react|vite)\b/iu.test(idea)) return 'vite-react';
  return undefined;
};

/**
 * Parse a free-text app idea into a deterministic, honest AppRequest
 * (Phase 20C, Task C). Auth/database/billing become mock/local UI features —
 * never claimed as real. Unsupported Next.js downgrades to Vite when next is
 * unavailable.
 */
export const parseAppRequest = (idea: string, options: ParseAppRequestOptions = {}): AppRequest => {
  const trimmed = idea.trim() || 'app';
  const kind = detectKind(trimmed);
  const notes: string[] = [];

  let style: AppStyle = 'minimal';
  if (options.style) {
    style = (normalizeStyle(options.style) ?? 'premium-saas');
  } else {
    for (const pattern of STYLE_PATTERNS) {
      if (pattern.re.test(trimmed)) {
        style = pattern.style;
        break;
      }
    }
  }

  const features: string[] = [];
  let downgraded = false;
  for (const pattern of FEATURE_PATTERNS) {
    if (pattern.re.test(trimmed) && !features.includes(pattern.feature)) {
      features.push(pattern.feature);
      if (pattern.mock) {
        downgraded = true;
        notes.push(`${pattern.feature.replace('-mock', '')} is a mock/local UI only (no real backend in this phase)`);
      }
    }
  }

  // Stack resolution: explicit flag → idea hint → kind default.
  let stack = normalizeStack(options.stack) ?? detectStackFromIdea(trimmed);
  if (!stack) {
    stack = kind === 'dashboard' || kind === 'landing' || kind === 'todo' || kind === 'custom' ? 'static' : 'static';
  }
  if (stack === 'next-minimal' && !options.nextAvailable) {
    stack = 'vite-react';
    downgraded = true;
    notes.push('Next.js is not available in this phase yet; using Vite + React instead');
  }

  const appName = toAppName(trimmed);
  return {
    appName,
    appSlug: slugify(appName),
    description: trimmed,
    kind,
    stack,
    style,
    features,
    downgraded,
    notes,
  };
};

const normalizeStyle = (raw: string): AppStyle | undefined => {
  const value = raw.toLowerCase();
  if (value === 'premium-saas' || value === 'premium' || value === 'saas') return 'premium-saas';
  if (value === 'apple-like' || value === 'apple') return 'apple-like';
  if (value === 'dark') return 'dark';
  if (value === 'minimal') return 'minimal';
  return undefined;
};
