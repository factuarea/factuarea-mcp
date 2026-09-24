import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  ResultSchema,
  type Implementation,
  type Result,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';
import { VERSION } from './defaults.js';

export interface UpstreamInfo {
  capabilities: ServerCapabilities;
  instructions: string | undefined;
  server: Implementation | undefined;
}

/**
 * The connection to the hosted Factuarea MCP server.
 *
 * The hosted server is stateless, so a "connection" is only the initialize handshake:
 * every later call is an independent authenticated POST. A failed handshake is not
 * cached — the next call tries again, which is what lets the bridge recover from a
 * network blip without being restarted.
 */
export class Upstream {
  #client: Promise<Client> | undefined;

  constructor(
    private readonly options: {
      url: URL;
      apiKey: string;
      timeoutMs: number;
      fetch?: FetchLike;
    },
  ) {}

  async connect(): Promise<UpstreamInfo> {
    const client = await this.#connected();
    return {
      capabilities: client.getServerCapabilities() ?? {},
      instructions: client.getInstructions(),
      server: client.getServerVersion(),
    };
  }

  /**
   * Sends one request and returns the result exactly as the hosted server wrote it.
   *
   * `ResultSchema` is a loose object on purpose: parsing with the per-method schemas would
   * strip every field the SDK does not model yet, and a proxy must not decide which of the
   * server's fields a client gets to see.
   */
  async request(method: string, params: Record<string, unknown> | undefined, options: RequestOptions): Promise<Result> {
    const client = await this.#connected();
    return client.request(params === undefined ? { method } : { method, params }, ResultSchema, options);
  }

  async close(): Promise<void> {
    const pending = this.#client;
    this.#client = undefined;
    if (!pending) return;
    try {
      await (await pending).close();
    } catch {
      // A handshake that never completed has nothing to close.
    }
  }

  #connected(): Promise<Client> {
    this.#client ??= this.#open().catch((error: unknown) => {
      this.#client = undefined;
      throw error;
    });
    return this.#client;
  }

  async #open(): Promise<Client> {
    const client = new Client({ name: 'factuarea-mcp', version: VERSION });
    const transport = new StreamableHTTPClientTransport(this.options.url, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'User-Agent': `factuarea-mcp/${VERSION} node/${process.versions.node}`,
        },
      },
      ...(this.options.fetch && { fetch: this.options.fetch }),
    });
    await client.connect(transport, { timeout: this.options.timeoutMs });
    return client;
  }
}
