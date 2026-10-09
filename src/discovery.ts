import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ResultSchema } from '@modelcontextprotocol/sdk/types.js';

/** A descriptor exactly as advertised, including schema extensions and server metadata. */
export interface DiscoveredTool {
  name: string;
  inputSchema: Record<string, unknown>;
  [field: string]: unknown;
}

export interface DiscoveryOptions {
  /** Omit to use the hosted server's configured page size. */
  perPage?: number;
  /** Cancellation, timeout and other SDK request options, applied to every page. */
  requestOptions?: RequestOptions;
}

export class ToolDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolDiscoveryError';
  }
}

/**
 * Read every tools/list page using an already connected client and its current identity.
 * Cursors remain opaque. A catalog restart can repeat tools, so the latest descriptor
 * wins. There is no cache or atomic snapshot promise: the server checks every tool call.
 * Protocol errors propagate unchanged; an interrupted discovery never returns a partial list.
 */
export async function discoverTools(
  client: Pick<Client, 'request'>,
  { perPage, requestOptions }: DiscoveryOptions = {},
): Promise<DiscoveredTool[]> {
  if (perPage !== undefined && (!Number.isSafeInteger(perPage) || perPage < 1)) {
    throw new RangeError('perPage must be a positive safe integer');
  }

  const tools = new Map<string, DiscoveredTool>();
  const cursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const params = {
      ...(cursor !== undefined && { cursor }),
      ...(perPage !== undefined && { per_page: perPage }),
    };
    const page = await client.request({ method: 'tools/list', params }, ResultSchema, requestOptions);
    if (!Array.isArray(page.tools)) throw new ToolDiscoveryError('tools/list did not return a tools array');

    for (const descriptor of page.tools) {
      if (
        !isRecord(descriptor) ||
        typeof descriptor.name !== 'string' ||
        descriptor.name.length === 0 ||
        !isRecord(descriptor.inputSchema)
      ) {
        throw new ToolDiscoveryError('tools/list returned an invalid tool descriptor');
      }
      tools.set(descriptor.name, descriptor as DiscoveredTool);
    }

    if (page.nextCursor === undefined) break;
    if (typeof page.nextCursor !== 'string' || page.nextCursor.length === 0) {
      throw new ToolDiscoveryError('tools/list returned an invalid nextCursor');
    }
    if (cursors.has(page.nextCursor)) throw new ToolDiscoveryError('tools/list repeated a pagination cursor');
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor !== undefined);

  return [...tools.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
