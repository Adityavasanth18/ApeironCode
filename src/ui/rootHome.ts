/**
 * Beginner-friendly root home menu (Phase 20E, Task C).
 *
 * Rendered at interactive startup so `apeironcode` does not feel like a raw
 * chatbot. Pure view-model: returns text; the input box still works underneath.
 */

export interface RootHomeContext {
  projectName: string;
  /** Resolved provider status label: configured/local/demo/none. */
  providerStatus: string;
}

export interface RootMenuOption {
  key: string;
  label: string;
  command: string;
}

export const ROOT_MENU_OPTIONS: RootMenuOption[] = [
  {key: '1', label: 'Fix failing code', command: 'apeironcode fix'},
  {key: '2', label: 'Build a new app', command: 'apeironcode new "a todo app"'},
  {key: '3', label: 'Improve UI/UX', command: 'apeironcode improve "make the UI premium"'},
  {key: '4', label: 'Review changes', command: 'apeironcode review'},
  {key: '5', label: 'Explain this repo', command: 'apeironcode repo'},
  {key: '6', label: 'Setup provider', command: 'apeironcode setup'},
  {key: '7', label: 'Run demo (no key)', command: 'apeironcode demo'},
];

/**
 * Describe the configured provider in beginner terms.
 */
export const describeProviderStatus = (provider: string | undefined, model: string | undefined): string => {
  if (!provider || provider === 'mock' || model === 'mock-coder') return 'demo/none';
  if (provider === 'ollama' || provider === 'openaiCompatible') return `local (${provider})`;
  return `configured (${provider})`;
};

/**
 * Render the beginner home menu. Compact and scannable; commands are explicit so
 * the screen works even without interactive selection.
 */
export const formatRootMenu = (context: RootHomeContext): string => {
  const width = Math.max(...ROOT_MENU_OPTIONS.map((o) => o.label.length));
  const lines: string[] = [];
  lines.push(`Project : ${context.projectName}`);
  lines.push(`Provider: ${context.providerStatus}`);
  lines.push('Status  : Ready');
  lines.push('');
  lines.push('What do you want to do?');
  for (const option of ROOT_MENU_OPTIONS) {
    lines.push(`  [${option.key}] ${option.label.padEnd(width)}   ${option.command}`);
  }
  lines.push('');
  lines.push('Type a prompt, pick a command above, or /help for everything.');
  return lines.join('\n');
};
