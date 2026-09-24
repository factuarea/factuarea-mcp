import { describe, expect, it } from 'vitest';
import { ConfigError, environmentOf, loadConfig } from '../src/config.js';
import { DEFAULT_MCP_URL, DEFAULT_TIMEOUT_MS } from '../src/defaults.js';

describe('loadConfig', () => {
  it('defaults to the canonical endpoint and timeout, with no key', () => {
    const config = loadConfig({});

    expect(config.apiKey).toBeUndefined();
    expect(config.url.href).toBe(`${DEFAULT_MCP_URL}/`);
    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('reads and trims the key, and treats a blank one as absent', () => {
    expect(loadConfig({ FACTUAREA_API_KEY: '  fact_test_abc  ' }).apiKey).toBe('fact_test_abc');
    expect(loadConfig({ FACTUAREA_API_KEY: '   ' }).apiKey).toBeUndefined();
  });

  it('accepts an https endpoint, and plain http only on loopback', () => {
    expect(loadConfig({ FACTUAREA_MCP_URL: 'https://mcp.example.test/mcp' }).url.href).toBe(
      'https://mcp.example.test/mcp',
    );
    expect(loadConfig({ FACTUAREA_MCP_URL: 'http://localhost:8000/mcp' }).url.port).toBe('8000');
    expect(loadConfig({ FACTUAREA_MCP_URL: 'http://127.0.0.1:8000/mcp' }).url.hostname).toBe('127.0.0.1');
  });

  it.each([
    ['http://mcp.factuarea.com', /must use https/],
    ['ftp://mcp.factuarea.com', /must use https/],
    ['not a url', /not a valid URL/],
  ])('rejects the endpoint %s', (value, message) => {
    expect(() => loadConfig({ FACTUAREA_MCP_URL: value })).toThrow(ConfigError);
    expect(() => loadConfig({ FACTUAREA_MCP_URL: value })).toThrow(message);
  });

  it('reads the timeout and rejects anything but a positive integer', () => {
    expect(loadConfig({ FACTUAREA_REQUEST_TIMEOUT_MS: '30000' }).timeoutMs).toBe(30_000);
    for (const value of ['0', '-5', '1.5', 'soon']) {
      expect(() => loadConfig({ FACTUAREA_REQUEST_TIMEOUT_MS: value })).toThrow(ConfigError);
    }
  });
});

describe('environmentOf', () => {
  it('reads the environment from the key prefix', () => {
    expect(environmentOf('fact_live_abc')).toBe('live');
    expect(environmentOf('fact_test_abc')).toBe('test');
    expect(environmentOf('an-oauth-access-token')).toBe('unknown');
    expect(environmentOf(undefined)).toBe('unknown');
  });
});
