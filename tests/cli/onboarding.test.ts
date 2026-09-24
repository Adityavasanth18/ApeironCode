import {describe, expect, it} from 'vitest';

import {
  SETUP_INTENTS,
  formatDoctorNextSteps,
  formatSetupIntentMenu,
} from '../../src/cli/onboarding.js';

describe('intent-based setup menu', () => {
  it('offers exactly the five documented intents in order', () => {
    expect(SETUP_INTENTS.map((i) => i.label)).toEqual([
      'Demo mode only',
      'Free local model with Ollama',
      'Cheap cloud model',
      'Best coding model',
      'Bring my own OpenAI-compatible endpoint',
    ]);
  });

  it('renders each intent with a concrete command and no baseUrl jargon', () => {
    const menu = formatSetupIntentMenu();
    expect(menu).toContain('Choose how ApeironCode should run');
    expect(menu).toContain('apeironcode demo');
    expect(menu).toContain('apeironcode local setup');
    // First-run users are not asked about baseUrl/auth internals up front.
    expect(menu).not.toMatch(/baseUrl|Authorization header/);
    // Local endpoints are documented as key-free.
    expect(menu).toMatch(/do not need an API key/i);
  });
});

describe('doctor next steps', () => {
  it('points to demo/local/cloud when no real provider is configured', () => {
    const text = formatDoctorNextSteps({hasRealProvider: false, ollamaRunning: false});
    expect(text).toContain('No real model configured');
    expect(text).toContain('apeironcode demo');
    expect(text).toContain('apeironcode local setup');
    expect(text).toContain('apeironcode setup');
  });

  it('confirms readiness when a real provider is configured', () => {
    const text = formatDoctorNextSteps({hasRealProvider: true, ollamaRunning: true});
    expect(text).toContain('A real model is configured');
    expect(text).toContain('apeironcode fix');
  });
});
