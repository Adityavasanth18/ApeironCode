/**
 * Local endpoint detection for OpenAI-compatible providers.
 *
 * A local base URL (localhost, loopback, or a common dev host) points at a
 * model server the user runs themselves (Ollama's OpenAI shim, LM Studio,
 * llama.cpp, vLLM, etc.). These do not need an API key, so ApeironCode must not
 * demand one. Remote endpoints still require a key so we fail fast with a clear
 * message instead of sending an unauthenticated request.
 */

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'host.docker.internal',
]);

/**
 * True when `baseUrl` targets a local/loopback/dev model server.
 *
 * Unparseable or empty URLs are treated as non-local (return `false`) so we
 * never accidentally drop an API-key requirement for a malformed remote URL.
 */
export const isLocalBaseUrl = (baseUrl: string | undefined | null): boolean => {
  if (!baseUrl) return false;
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (LOCAL_HOSTNAMES.has(hostname)) return true;
  // *.local mDNS hostnames and 127.0.0.0/8 loopback range.
  if (hostname.endsWith('.local')) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(hostname)) return true;
  return false;
};
