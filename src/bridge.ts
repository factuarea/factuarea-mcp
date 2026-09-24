import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type ServerCapabilities,
  type ServerResult,
} from '@modelcontextprotocol/sdk/types.js';
import { environmentOf, type BridgeConfig } from './config.js';
import { API_KEYS_URL, SERVER_NAME, VERSION } from './defaults.js';
import { missingApiKeyError, toForwardedError } from './errors.js';
import { Upstream, type UpstreamInfo } from './upstream.js';

/**
 * The capabilities this bridge can relay, and the requests each one brings.
 *
 * Deliberately absent: `listChanged` and resource `subscribe`. The hosted server is
 * stateless and pushes no notifications, so advertising either would promise the local
 * client an event that can never arrive.
 */
const RELAYED = {
  tools: [ListToolsRequestSchema, CallToolRequestSchema],
  prompts: [ListPromptsRequestSchema, GetPromptRequestSchema],
  resources: [ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema],
  completions: [CompleteRequestSchema],
} as const;

type RelayedCapability = keyof typeof RELAYED;

/** Declared when the hosted server could not be asked (no key yet, or unreachable at startup). */
const FALLBACK_CAPABILITIES: RelayedCapability[] = ['tools', 'prompts', 'resources'];

export interface BridgeOptions {
  config: BridgeConfig;
  /** Diagnostics sink. stdout belongs to the protocol, so the CLI points this at stderr. */
  log?: (line: string) => void;
  fetch?: FetchLike;
}

export interface Bridge {
  server: Server;
  close(): Promise<void>;
}

/**
 * Builds a local MCP server that relays every request to the hosted Factuarea server.
 *
 * It never refuses to start: without a key, or with the hosted server unreachable, it
 * still answers `initialize` and then turns each call into an error that says what to
 * fix. A server that exits at startup leaves the user with "server disconnected" and a
 * log file; one that answers says why in the client itself.
 */
export async function createBridge({ config, log = () => {}, fetch }: BridgeOptions): Promise<Bridge> {
  const upstream = config.apiKey
    ? new Upstream({ url: config.url, apiKey: config.apiKey, timeoutMs: config.timeoutMs, ...(fetch && { fetch }) })
    : undefined;

  let info: UpstreamInfo | undefined;
  if (!upstream) {
    log(
      `FACTUAREA_API_KEY is not set: every call will be refused until a key is configured. Create one at ${API_KEYS_URL}`,
    );
  } else {
    try {
      info = await upstream.connect();
      log(describeConnection(config, info));
    } catch (error) {
      log(`Could not connect yet, will retry on the first call: ${toForwardedError(error, config.url).message}`);
    }
  }

  const relayed = info ? relayedCapabilities(info.capabilities) : FALLBACK_CAPABILITIES;
  const capabilities: ServerCapabilities = Object.fromEntries(relayed.map((name) => [name, {}]));

  const server = new Server(
    { name: SERVER_NAME, version: VERSION },
    { capabilities, ...(info?.instructions && { instructions: info.instructions }) },
  );

  for (const capability of relayed) {
    for (const schema of RELAYED[capability]) {
      server.setRequestHandler(schema, async (request, extra) => {
        if (!upstream) throw missingApiKeyError();

        const { _meta, ...params } = (request.params ?? {}) as Record<string, unknown>;
        const { progressToken, ...meta } = (_meta ?? {}) as Record<string, unknown>;
        if (Object.keys(meta).length > 0) params._meta = meta;

        try {
          const result = await upstream.request(request.method, params, {
            signal: extra.signal,
            timeout: config.timeoutMs,
            // The SDK mints its own progress token upstream; relay each update under the local one.
            ...(progressToken !== undefined && {
              resetTimeoutOnProgress: true,
              onprogress: (progress) => {
                void extra.sendNotification({
                  method: 'notifications/progress',
                  params: { ...progress, progressToken: progressToken as string | number },
                });
              },
            }),
          });
          return result as ServerResult;
        } catch (error) {
          throw toForwardedError(error, config.url);
        }
      });
    }
  }

  return {
    server,
    async close() {
      await server.close();
      await upstream?.close();
    },
  };
}

function relayedCapabilities(capabilities: ServerCapabilities): RelayedCapability[] {
  return (Object.keys(RELAYED) as RelayedCapability[]).filter((name) => capabilities[name] !== undefined);
}

function describeConnection(config: BridgeConfig, info: UpstreamInfo): string {
  const environment = environmentOf(config.apiKey);
  const mode =
    environment === 'test'
      ? 'test mode: isolated sandbox, no AEAT transmission, no real emails'
      : environment === 'live'
        ? 'live mode: real company data'
        : 'credential is not a fact_live_/fact_test_ API key';
  const server = info.server ? ` (${info.server.name} ${info.server.version})` : '';
  return `Connected to ${config.url.href}${server} — ${mode}.`;
}
