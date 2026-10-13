import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createBridge } from '../src/bridge.js';
import { discoverTools } from '../src/discovery.js';
import {
  CONVERT_TOOL,
  LEAD_ID,
  LEADS_TOOL,
  PEOPLE_TOOL,
  PERSON_ID,
  PIPELINE_ID,
  PIPELINES_TOOL,
  SCOPE_ERROR,
  nativeError,
} from './support/crm-tools.js';
import { startFakeUpstream, VALID_KEY, type FakeUpstreamOptions } from './support/fake-upstream.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

async function connect(options: FakeUpstreamOptions) {
  const fake = await startFakeUpstream({ capabilities: { tools: {} }, ...options });
  cleanups.push(() => fake.close());
  const bridge = await createBridge({ config: { url: fake.url, apiKey: VALID_KEY, timeoutMs: 5000 } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await bridge.server.connect(serverTransport);
  const client = new Client({ name: 'crm-fixture-client', version: '1.0.0' });
  await client.connect(clientTransport);
  cleanups.push(async () => {
    await client.close();
    await bridge.close();
  });
  return { client, fake };
}

describe('CRM through the stdio relay with a local contract fixture', () => {
  it('exhausts tools/list and preserves native per_page and opaque cursors on the HTTP wire', async () => {
    const cursor = 'v2.opaque-subject-and-fingerprint';
    const { client, fake } = await connect({
      listTools: (params) =>
        params.cursor === cursor
          ? { tools: [PIPELINES_TOOL, LEADS_TOOL] }
          : { tools: [LEADS_TOOL, PEOPLE_TOOL], nextCursor: cursor },
    });
    expect(await discoverTools(client, { perPage: 2 })).toEqual([LEADS_TOOL, PEOPLE_TOOL, PIPELINES_TOOL]);
    expect(fake.requests.filter((request) => request.method === 'tools/list').map((request) => request.body)).toEqual([
      expect.objectContaining({ params: { per_page: 2 } }),
      expect.objectContaining({ params: { cursor, per_page: 2 } }),
    ]);
  });

  it('keeps each native CRM pagination envelope and JSON-string filter without translating it', async () => {
    const responses: Record<string, unknown> = {
      list_leads: { data: { data: [{ id: LEAD_ID }], next_cursor: 'lead-opaque', has_more: true } },
      list_pipelines: { data: { items: [{ id: PIPELINE_ID }], next_cursor: null, has_more: false } },
      list_crm_contact_people: {
        data: [{ id: PERSON_ID }],
        meta: { total: 1, current_page: 1, per_page: 25, last_page: 1 },
      },
    };
    const { client, fake } = await connect({
      listTools: () => ({ tools: [LEADS_TOOL, PEOPLE_TOOL, PIPELINES_TOOL] }),
      callTool: ({ name }) => ({ content: [{ type: 'text', text: JSON.stringify(responses[name]) }] }),
    });
    const calls = [
      {
        name: 'list_leads',
        arguments: { filters: JSON.stringify({ status: 'new' }), limit: 25, cursor: 'lead-opaque' },
      },
      { name: 'list_pipelines', arguments: { status: 'active', limit: 25 } },
      { name: 'list_crm_contact_people', arguments: { page: 1, per_page: 25, typed_filters: '{}' } },
    ];
    for (const call of calls) {
      const result = await client.callTool(call);
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(responses[call.name]) }]);
    }
    expect(fake.requests.filter((request) => request.method === 'tools/call').map((request) => request.body)).toEqual(
      calls.map((params) => expect.objectContaining({ params })),
    );
  });

  it('forwards UUID, version, preview hash, confirmation and idempotency unchanged', async () => {
    const args = {
      id: LEAD_ID,
      expected_version: 7,
      strategy: 'create_contact',
      plan_hash: 'a'.repeat(64),
      confirmed: true,
      idempotency_key: 'crm-conversion-fixture',
      contact: { name: 'Fixture Contact' },
    };
    const response = {
      content: [{ type: 'text', text: JSON.stringify({ data: { id: LEAD_ID, version: 8 } }) }],
      _meta: { 'com.factuarea/idempotentReplay': true },
    };
    const { client, fake } = await connect({ listTools: () => ({ tools: [CONVERT_TOOL] }), callTool: () => response });
    expect(await client.callTool({ name: 'convert_lead', arguments: args })).toEqual(response);
    expect(fake.requests.find((request) => request.method === 'tools/call')?.body).toMatchObject({
      params: { name: 'convert_lead', arguments: args },
    });
  });

  it('uses the current server catalog without inventing aliases or retaining previous grants', async () => {
    let visible = [LEADS_TOOL, CONVERT_TOOL];
    const { client } = await connect({
      listTools: () => ({ tools: visible }),
      callTool: () => nativeError(SCOPE_ERROR),
    });
    expect((await discoverTools(client)).map((tool) => tool.name)).toEqual(['list_leads', 'convert_lead']);
    visible = [];
    expect(await discoverTools(client)).toEqual([]);
    await expect(client.callTool({ name: 'convert_lead', arguments: { id: LEAD_ID } })).rejects.toMatchObject({
      code: SCOPE_ERROR.code,
      data: SCOPE_ERROR.data,
    });
  });

  it.each([
    {
      code: -32008,
      message: 'resource_not_found',
      data: {
        code: 'resource_not_found',
        http_status: 404,
        subcode: 'crm_lead_not_found',
        hint: 'Lead no encontrado.',
      },
    },
    {
      code: -32008,
      message: 'crm_version_conflict',
      data: {
        code: 'crm_version_conflict',
        http_status: 409,
        param: 'expected_version',
        subcode: 'crm_lead_version_conflict',
        hint: 'La versión del Lead ha cambiado. Actualiza los datos y revisa la operación.',
      },
    },
    { code: -32602, message: 'El cursor de paginación no es válido o ha caducado.', data: {} },
  ])('preserves native rejection code and details (%s)', async (failure) => {
    const { client } = await connect({ listTools: () => ({ tools: [] }), callTool: () => nativeError(failure) });
    const error = await client
      .callTool({ name: 'find_lead', arguments: { id: LEAD_ID } })
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(McpError);
    expect(error).toMatchObject({ code: failure.code, data: failure.data });
    expect((error as McpError).message).toBe(`MCP error ${failure.code}: ${failure.message}`);
  });
});
