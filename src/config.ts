import { DEFAULT_MCP_URL, DEFAULT_TIMEOUT_MS } from './defaults.js';

export type Environment = 'live' | 'test' | 'unknown';

export interface BridgeConfig {
  /** Bearer credential sent to the hosted server. Absent means "start, but refuse every call". */
  apiKey: string | undefined;
  /** Streamable HTTP endpoint of the hosted server. */
  url: URL;
  /** Hard ceiling on a single forwarded request, in milliseconds. */
  timeoutMs: number;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Reads the bridge configuration from the environment.
 *
 * Throws `ConfigError` for values that would make the bridge misbehave silently:
 * an unparseable URL, a plain-HTTP URL outside loopback (the API key would travel
 * in clear text) or a timeout that is not a positive integer.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const apiKey = env.FACTUAREA_API_KEY?.trim() || undefined;

  const rawUrl = env.FACTUAREA_MCP_URL?.trim() || DEFAULT_MCP_URL;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConfigError(`FACTUAREA_MCP_URL is not a valid URL: "${rawUrl}".`);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) {
    throw new ConfigError(
      `FACTUAREA_MCP_URL must use https:// (plain http:// is only accepted for localhost), got "${rawUrl}".`,
    );
  }

  const rawTimeout = env.FACTUAREA_REQUEST_TIMEOUT_MS?.trim();
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout) {
    timeoutMs = Number(rawTimeout);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new ConfigError(
        `FACTUAREA_REQUEST_TIMEOUT_MS must be a positive integer (milliseconds), got "${rawTimeout}".`,
      );
    }
  }

  return { apiKey, url, timeoutMs };
}

/** The key prefix is the only environment switch: `fact_live_` or `fact_test_`. */
export function environmentOf(apiKey: string | undefined): Environment {
  if (apiKey?.startsWith('fact_live_')) return 'live';
  if (apiKey?.startsWith('fact_test_')) return 'test';
  return 'unknown';
}
