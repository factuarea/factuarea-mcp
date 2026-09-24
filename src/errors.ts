import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { API_KEYS_URL, DOCS_URL } from './defaults.js';

/**
 * A JSON-RPC error handed to the local client with an explicit code, message and data.
 *
 * The SDK answers a failed request with `error.code`, `error.message` and `error.data`
 * of whatever the handler threw. `McpError` would not do here: its constructor prefixes
 * the message ("MCP error -32008: …"), so re-throwing one received from the hosted
 * server would reach the local client with the prefix twice.
 */
export class ForwardedError extends Error {
  override name = 'ForwardedError';

  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

/** Code the hosted server uses for authentication failures (`invalid_token`). */
export const AUTH_ERROR_CODE = -32001;

const MCP_ERROR_PREFIX = /^MCP error -?\d+: /;
const HTTP_ERROR_PREFIX = /^Streamable HTTP error: (?:Error POSTing to endpoint: )?/;

export function missingApiKeyError(): ForwardedError {
  return new ForwardedError(
    AUTH_ERROR_CODE,
    `FACTUAREA_API_KEY is not set. Create an API key at ${API_KEYS_URL} ` +
      `(a fact_test_ key works on the isolated sandbox) and add it to this server's environment. ` +
      `Clients that support remote servers can skip the key and connect over OAuth instead: ${DOCS_URL}`,
    { code: 'missing_api_key' },
  );
}

/**
 * Translates whatever the upstream call threw into the error the local client receives.
 *
 * A JSON-RPC error from the hosted server keeps its code, message and data untouched: the
 * server already writes them for the caller (`mcp_guardrail_violation` carries the rule and
 * the resource that explains it) and a paraphrase would only drift. Only an authentication
 * failure gains a sentence, because the fix for it lives in this bridge's configuration.
 */
export function toForwardedError(error: unknown, url: URL): ForwardedError {
  if (error instanceof ForwardedError) return error;

  if (error instanceof McpError) {
    return withAuthHint(new ForwardedError(error.code, error.message.replace(MCP_ERROR_PREFIX, ''), error.data));
  }

  if (error instanceof StreamableHTTPError) {
    const status = typeof error.code === 'number' ? error.code : undefined;
    const body = error.message.replace(HTTP_ERROR_PREFIX, '');
    const envelope = parseJsonRpcError(body);
    if (envelope) {
      return withAuthHint(new ForwardedError(envelope.code, envelope.message, envelope.data), status);
    }
    return withAuthHint(
      new ForwardedError(
        status === 401 ? AUTH_ERROR_CODE : ErrorCode.InternalError,
        `The Factuarea MCP server answered HTTP ${status ?? 'error'}${body ? `: ${truncate(body)}` : ''}`,
        { http_status: status },
      ),
      status,
    );
  }

  const reason = error instanceof Error ? describeCause(error) : String(error);
  return new ForwardedError(
    ErrorCode.InternalError,
    `Could not reach the Factuarea MCP server at ${url.href}: ${reason}`,
  );
}

function withAuthHint(error: ForwardedError, httpStatus?: number): ForwardedError {
  const isAuthFailure = httpStatus === 401 || (error.code === AUTH_ERROR_CODE && error.message === 'invalid_token');
  if (!isAuthFailure) return error;
  return new ForwardedError(
    error.code,
    `${error.message} — Factuarea rejected FACTUAREA_API_KEY. Check that the key is complete and not revoked, ` +
      `or create a new one at ${API_KEYS_URL}.`,
    error.data,
  );
}

interface JsonRpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

function parseJsonRpcError(body: string): JsonRpcErrorShape | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) return undefined;
  const candidate = (parsed as { error: unknown }).error;
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  const { code, message, data } = candidate as Record<string, unknown>;
  if (typeof code !== 'number' || !Number.isSafeInteger(code) || typeof message !== 'string') return undefined;
  return data === undefined ? { code, message } : { code, message, data };
}

function describeCause(error: Error): string {
  const cause = (error as Error & { cause?: unknown }).cause;
  return cause instanceof Error ? `${error.message} (${cause.message})` : error.message;
}

function truncate(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
