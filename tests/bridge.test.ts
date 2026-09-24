import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import { McpError, ResultSchema, type Progress } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createBridge, type Bridge } from '../src/bridge.js';
import type { BridgeConfig } from '../src/config.js';
import { VERSION } from '../src/defaults.js';
import {
  DELETE_INVOICE_TOOL,
  GUARDRAIL_ERROR,
  SEARCH_INVOICES_TOOL,
  VALID_KEY,
  startFakeUpstream,
  type FakeUpstream,
  type FakeUpstreamOptions,
} from './support/fake-upstream.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function upstream(options?: FakeUpstreamOptions): Promise<FakeUpstream> {
  const fake = await startFakeUpstream(options);
  cleanups.push(() => fake.close());
  return fake;
}

interface Connected {
  client: Client;
  bridge: Bridge;
  logs: string[];
}

async function connect(config: Partial<BridgeConfig> & { url: URL }, fetch?: FetchLike): Promise<Connected> {
  const logs: string[] = [];
  const bridge = await createBridge({
    config: { apiKey: VALID_KEY, timeoutMs: 5_000, ...config },
    log: (line) => logs.push(line),
    ...(fetch && { fetch }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await bridge.server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  cleanups.push(async () => {
    await client.close();
    await bridge.close();
  });
  return { client, bridge, logs };
}

async function rejection(promise: Promise<unknown>): Promise<McpError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(McpError);
  return error as McpError;
}

describe('relaying to the hosted server', () => {
  it('lists tools page by page, keeping every field the server sent', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });

    const first = await client.request({ method: 'tools/list' }, ResultSchema);
    expect(first).toEqual({ tools: [SEARCH_INVOICES_TOOL], nextCursor: 'page-2' });

    const second = await client.request({ method: 'tools/list', params: { cursor: 'page-2' } }, ResultSchema);
    expect(second).toEqual({ tools: [DELETE_INVOICE_TOOL] });
  });

  it('forwards a tool call with its arguments and returns the result with its _meta', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });

    const result = await client.callTool({ name: 'search_invoices', arguments: { status: 'paid' } });

    expect(result.content).toEqual([{ type: 'text', text: '{"status":"paid"}' }]);
    expect(result._meta).toEqual({ 'com.factuarea/idempotentReplay': true });
  });

  it('authenticates every upstream request with the API key and identifies itself', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });
    await client.listTools();

    expect(fake.requests.map((request) => request.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
    ]);
    for (const request of fake.requests) {
      expect(request.headers.authorization).toBe(`Bearer ${VALID_KEY}`);
      expect(request.headers['user-agent']).toMatch(new RegExp(`^factuarea-mcp/${VERSION.replace(/\./g, '\\.')} `));
    }
  });

  it('hands over a JSON-RPC error with its code, message and data untouched', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });

    const error = await rejection(client.callTool({ name: 'delete_invoice', arguments: { id: 'inv_1' } }));

    expect(error.code).toBe(GUARDRAIL_ERROR.code);
    // One prefix, added by the local client — not a second one carried over from the bridge.
    expect(error.message).toBe(`MCP error ${GUARDRAIL_ERROR.code}: ${GUARDRAIL_ERROR.message}`);
    expect(error.data).toEqual(GUARDRAIL_ERROR.data);
  });

  it('passes a tool-level failure through as a result, not as a protocol error', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });

    const result = await client.callTool({ name: 'send_invoice', arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'El destinatario no tiene email.' }]);
  });

  it('relays progress notifications under the local client’s own token', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });
    const updates: Progress[] = [];

    await client.callTool({ name: 'export_report', arguments: {} }, undefined, {
      onprogress: (progress) => updates.push(progress),
    });

    expect(updates.map(({ progress, total }) => ({ progress, total }))).toEqual([
      { progress: 1, total: 2 },
      { progress: 2, total: 2 },
    ]);
  });

  it('relays prompts', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });

    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(['emitir_factura']);

    const prompt = await client.getPrompt({ name: 'emitir_factura', arguments: { cliente: 'Acme S.L.' } });
    expect(prompt.messages[0]?.content).toEqual({ type: 'text', text: 'Emite una factura para Acme S.L.' });
  });

  it('relays resources', async () => {
    const fake = await upstream();
    const { client } = await connect({ url: fake.url });

    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toEqual(['factuarea://guardrails/anular-o-rectificar']);

    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates).toEqual([]);

    const read = await client.readResource({ uri: 'factuarea://guardrails/anular-o-rectificar' });
    expect(read.contents).toEqual([
      { uri: 'factuarea://guardrails/anular-o-rectificar', mimeType: 'text/markdown', text: '# Anular o rectificar' },
    ]);
  });

  it('advertises the hosted server’s instructions and only the capabilities it has', async () => {
    const fake = await upstream({
      capabilities: { tools: { listChanged: true } },
      instructions: 'Usa search_* primero.',
    });
    const { client } = await connect({ url: fake.url });

    expect(client.getInstructions()).toBe('Usa search_* primero.');
    // listChanged is dropped: the hosted server is stateless and never sends the notification.
    expect(client.getServerCapabilities()).toEqual({ tools: {} });
    expect(client.getServerVersion()).toMatchObject({ name: 'factuarea', version: VERSION });
  });

  it('reports the environment the key belongs to', async () => {
    const fake = await upstream();
    const { logs } = await connect({ url: fake.url });

    expect(logs).toEqual([expect.stringContaining('test mode: isolated sandbox')]);
  });
});

describe('when something is missing or wrong', () => {
  it('starts without a key and refuses each call with what to do about it', async () => {
    const fake = await upstream();
    const { client, logs } = await connect({ url: fake.url, apiKey: undefined });

    expect(client.getServerCapabilities()).toEqual({ tools: {}, prompts: {}, resources: {} });
    const error = await rejection(client.listTools());

    expect(error.code).toBe(-32001);
    expect(error.message).toContain('FACTUAREA_API_KEY is not set');
    expect(error.message).toContain('https://app.factuarea.com/settings/developers/api-keys');
    expect(error.data).toEqual({ code: 'missing_api_key' });
    expect(logs).toEqual([expect.stringContaining('FACTUAREA_API_KEY is not set')]);
    expect(fake.requests).toEqual([]);
  });

  it('explains a rejected key, keeping the server’s own code and data', async () => {
    const fake = await upstream({ apiKey: 'fact_test_someoneelsesxxxxxxxxxxxx' });
    const { client, logs } = await connect({ url: fake.url });

    const error = await rejection(client.listTools());

    expect(error.code).toBe(-32001);
    expect(error.message).toContain('invalid_token — Factuarea rejected FACTUAREA_API_KEY');
    expect(error.data).toEqual({ http_status: 401, code: 'invalid_token', hint: 'Token inválido o revocado.' });
    expect(logs[0]).toContain('Could not connect yet');
  });

  it('recovers when the hosted server was unreachable at startup', async () => {
    const fake = await upstream();
    let failures = 1;
    const flaky: FetchLike = (url, init) => {
      if (failures-- > 0) return Promise.reject(new TypeError('fetch failed'));
      return fetch(url, init);
    };
    const { client, logs } = await connect({ url: fake.url }, flaky);

    expect(logs[0]).toContain('Could not connect yet');
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['search_invoices']);
  });

  it('names the endpoint it could not reach', async () => {
    const fake = await upstream();
    const down: FetchLike = () => Promise.reject(new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') }));
    const { client } = await connect({ url: fake.url }, down);

    const error = await rejection(client.listTools());

    expect(error.message).toContain(`Could not reach the Factuarea MCP server at ${fake.url.href}`);
    expect(error.message).toContain('ECONNREFUSED');
  });
});
