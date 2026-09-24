import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { ForwardedError, missingApiKeyError, toForwardedError } from '../src/errors.js';

const URL_ = new URL('https://mcp.factuarea.com');

describe('toForwardedError', () => {
  it('keeps a server error as it came, minus the SDK prefix', () => {
    const error = toForwardedError(new McpError(-32008, 'mcp_guardrail_violation', { rule_id: 'BR-INV-002' }), URL_);

    expect(error).toBeInstanceOf(ForwardedError);
    expect(error.code).toBe(-32008);
    expect(error.message).toBe('mcp_guardrail_violation');
    expect(error.data).toEqual({ rule_id: 'BR-INV-002' });
  });

  it('reads the JSON-RPC envelope out of an HTTP error body', () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32029, message: 'rate_limited', data: { retry_after: 3 } },
    });
    const error = toForwardedError(new StreamableHTTPError(429, `Error POSTing to endpoint: ${body}`), URL_);

    expect(error.code).toBe(-32029);
    expect(error.message).toBe('rate_limited');
    expect(error.data).toEqual({ retry_after: 3 });
  });

  it('adds the fix to an authentication failure without touching its code or data', () => {
    const body = JSON.stringify({ error: { code: -32001, message: 'invalid_token', data: { http_status: 401 } } });
    const error = toForwardedError(new StreamableHTTPError(401, `Error POSTing to endpoint: ${body}`), URL_);

    expect(error.code).toBe(-32001);
    expect(error.message).toMatch(/^invalid_token — Factuarea rejected FACTUAREA_API_KEY/);
    expect(error.data).toEqual({ http_status: 401 });
  });

  it('describes an HTTP failure whose body is not JSON-RPC', () => {
    const error = toForwardedError(
      new StreamableHTTPError(502, 'Error POSTing to endpoint: <html>Bad gateway</html>'),
      URL_,
    );

    expect(error.code).toBe(ErrorCode.InternalError);
    expect(error.message).toBe('The Factuarea MCP server answered HTTP 502: <html>Bad gateway</html>');
    expect(error.data).toEqual({ http_status: 502 });
  });

  it('names the endpoint when the network fails', () => {
    const error = toForwardedError(new TypeError('fetch failed', { cause: new Error('ENOTFOUND') }), URL_);

    expect(error.code).toBe(ErrorCode.InternalError);
    expect(error.message).toBe(
      'Could not reach the Factuarea MCP server at https://mcp.factuarea.com/: fetch failed (ENOTFOUND)',
    );
  });

  it('leaves an already-forwarded error alone', () => {
    const original = missingApiKeyError();
    expect(toForwardedError(original, URL_)).toBe(original);
  });
});
