import {describe, expect, it, vi, afterEach} from 'vitest';

import {isLocalBaseUrl} from '../../src/providers/localEndpoint.js';
import {createOpenAICompatibleProvider} from '../../src/providers/openaiCompatible.js';

const makeProvider = (baseUrl: string, apiKey: string | null) =>
  createOpenAICompatibleProvider({
    defaultModels: ['m'],
    displayName: 'OpenAI Compatible',
    name: 'openaiCompatible',
    requireApiKeyWhenRemote: true,
    missingApiKeyEnvVar: 'OPENAI_API_KEY',
  })({apiKey, baseUrl});

const drain = async (gen: AsyncGenerator<unknown>): Promise<void> => {
  for await (const _chunk of gen) void _chunk;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isLocalBaseUrl', () => {
  it('treats loopback and dev hosts as local', () => {
    for (const url of [
      'http://localhost:11434/v1',
      'http://127.0.0.1:1234/v1',
      'http://0.0.0.0:8000/v1',
      'http://[::1]:8080/v1',
      'http://host.docker.internal:1234/v1',
      'http://127.0.0.5:5000/v1',
      'http://my-box.local:1234/v1',
    ]) {
      expect(isLocalBaseUrl(url), url).toBe(true);
    }
  });

  it('treats remote and malformed URLs as non-local', () => {
    for (const url of [
      'https://api.openai.com/v1',
      'https://models.github.ai/inference',
      'https://example.com',
      'not a url',
      '',
      undefined,
    ]) {
      expect(isLocalBaseUrl(url), String(url)).toBe(false);
    }
  });
});

describe('OpenAI-compatible local endpoint key handling', () => {
  it('does not require an API key for a local endpoint and sends no Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader() {
          let done = false;
          return {
            read() {
              if (done) return Promise.resolve({done: true, value: undefined});
              done = true;
              return Promise.resolve({
                done: false,
                value: new TextEncoder().encode('data: [DONE]\n'),
              });
            },
            releaseLock() {},
          };
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = makeProvider('http://localhost:11434/v1', null);
    await drain(provider.stream({model: 'm', messages: [{role: 'user', content: 'hi'}]}));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as {headers: Record<string, string>};
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('requires an API key for a remote endpoint with a clean error and no request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = makeProvider('https://api.example.com/v1', null);
    let error: Error | undefined;
    try {
      await drain(provider.stream({model: 'm', messages: [{role: 'user', content: 'hi'}]}));
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain('OPENAI_API_KEY');
    expect((error as {code?: string}).code).toBe('PROVIDER_AUTH_ERROR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an Authorization header when a key is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader() {
          let done = false;
          return {
            read() {
              if (done) return Promise.resolve({done: true, value: undefined});
              done = true;
              return Promise.resolve({done: false, value: new TextEncoder().encode('data: [DONE]\n')});
            },
            releaseLock() {},
          };
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = makeProvider('https://api.example.com/v1', 'sk-secret-value');
    await drain(provider.stream({model: 'm', messages: [{role: 'user', content: 'hi'}]}));

    const init = fetchMock.mock.calls[0]![1] as {headers: Record<string, string>};
    expect(init.headers.Authorization).toBe('Bearer sk-secret-value');
  });
});
