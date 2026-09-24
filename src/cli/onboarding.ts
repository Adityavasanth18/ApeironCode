/**
 * Intent-based onboarding copy for `setup` and `doctor`.
 *
 * New users should pick *how they want to run* ApeironCode, not a provider's
 * internal baseUrl/auth details. Each intent maps to a single concrete command.
 */

export interface SetupIntent {
  id: number;
  label: string;
  detail: string;
  command: string;
}

export const SETUP_INTENTS: SetupIntent[] = [
  {
    id: 1,
    label: 'Demo mode only',
    detail: 'No API key, model, or Ollama. Deterministic local examples.',
    command: 'apeironcode demo',
  },
  {
    id: 2,
    label: 'Free local model with Ollama',
    detail: 'Run a model on your machine. Private and free.',
    command: 'apeironcode local setup',
  },
  {
    id: 3,
    label: 'Cheap cloud model',
    detail: 'Use GitHub Models (free tier) with a GitHub token.',
    command: 'apeironcode setup --provider github-models',
  },
  {
    id: 4,
    label: 'Best coding model',
    detail: 'Use a top cloud model (e.g. Anthropic Claude) with an API key.',
    command: 'apeironcode setup --provider anthropic',
  },
  {
    id: 5,
    label: 'Bring my own OpenAI-compatible endpoint',
    detail: 'Point at any OpenAI-compatible server. Local endpoints need no key.',
    command: 'apeironcode setup --provider openaiCompatible',
  },
];

export const formatSetupIntentMenu = (): string => {
  const lines: string[] = [];
  lines.push('Choose how ApeironCode should run:');
  lines.push('');
  for (const intent of SETUP_INTENTS) {
    lines.push(`  ${intent.id}. ${intent.label}`);
    lines.push(`     ${intent.detail}`);
    lines.push(`     → ${intent.command}`);
  }
  lines.push('');
  lines.push('Not sure? Start with `apeironcode demo` — it needs nothing.');
  lines.push('Local OpenAI-compatible endpoints (localhost/127.0.0.1) do not need an API key.');
  return lines.join('\n');
};

export interface OnboardingState {
  /** A real (non-mock) provider that can actually run is configured. */
  hasRealProvider: boolean;
  ollamaRunning: boolean;
}

/**
 * Friendly next-steps appended to `doctor` output. Always points to a usable
 * path: demo (always works), local (Ollama), or real (cloud).
 */
export const formatDoctorNextSteps = (state: OnboardingState): string => {
  const lines: string[] = [];
  lines.push('Next steps');
  if (state.hasRealProvider) {
    lines.push('  ✓ A real model is configured. Try: apeironcode fix');
  } else {
    lines.push('  ✗ No real model configured.');
    lines.push('    → Demo (no key):   apeironcode demo todo-app');
    lines.push(
      state.ollamaRunning
        ? '    → Local (Ollama):  apeironcode local setup'
        : '    → Local (Ollama):  apeironcode local setup   (Ollama not detected)',
    );
    lines.push('    → Cloud provider:  apeironcode setup');
  }
  return lines.join('\n');
};
