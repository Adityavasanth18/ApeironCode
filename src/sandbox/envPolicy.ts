const ALLOWED_ENV = new Set([
  'CI',
  'COLORTERM',
  'FORCE_COLOR',
  'LANG',
  'LC_ALL',
  'NODE_ENV',
  'NO_COLOR',
  'PATH',
  'TERM',
  'TMPDIR',
]);

const SECRET_NAME = /(?:^|_)(?:API_?KEY|KEY|PASSWORD|SECRET|TOKEN)(?:$|_)/iu;
const SECRET_VALUES = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/gu,
  /\bghp_[A-Za-z0-9]{8,}\b/gu,
  /\bgithub_pat_[A-Za-z0-9_]{8,}\b/gu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{8,}\b/gu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu,
];

export const isSecretEnvName = (name: string): boolean =>
  SECRET_NAME.test(name)
  || [
    'ANTHROPIC_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'DEEPSEEK_API_KEY',
    'GEMINI_API_KEY',
    'GITHUB_TOKEN',
    'GROQ_API_KEY',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
  ].includes(name.toUpperCase());

export const buildCommandEnv = (
  source: Record<string, string | undefined> = process.env,
  overrides: Record<string, string> = {},
): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && ALLOWED_ENV.has(name) && !isSecretEnvName(name)) env[name] = value;
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (!isSecretEnvName(name)) env[name] = value;
  }
  return env;
};

export const redactCommandText = (text: string): string => {
  let redacted = text.replace(
    /((?:[A-Z0-9_]*(?:API_?KEY|KEY|PASSWORD|SECRET|TOKEN)[A-Z0-9_]*)\s*[:=]\s*)[^\s"'`]+/giu,
    '$1[redacted]',
  );
  for (const pattern of SECRET_VALUES) redacted = redacted.replace(pattern, '[redacted]');
  return redacted;
};
