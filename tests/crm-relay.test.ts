import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import { McpError, ResultSchema, type CallToolResult, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createBridge } from '../src/bridge.js';
import { CRM_NATIVE_READ_FIXTURES, CRM_WIRE_FIXTURES, UUID } from './support/crm-contracts.js';
import { startFakeUpstream, VALID_KEY, type FakeUpstream, type FakeUpstreamOptions } from './support/fake-upstream.js';

/** Real SDK transports against controlled wire responses, not hosted owner/OAuth certification. */
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function connect(
  options: FakeUpstreamOptions,
  credential = VALID_KEY,
  customFetch?: FetchLike,
): Promise<{ client: Client; fake: FakeUpstream; logs: string[] }> {
  const fake = await startFakeUpstream({ ...options, apiKey: credential });
  cleanups.push(() => fake.close());
  const logs: string[] = [];
  const bridge = await createBridge({
    config: { url: fake.url, apiKey: credential, timeoutMs: 5_000 },
    log: (line) => logs.push(line),
    ...(customFetch && { fetch: customFetch }),
  });
  const [local, remote] = InMemoryTransport.createLinkedPair();
  await bridge.server.connect(remote);
  const client = new Client({ name: 'crm-relay-contract', version: '1.0.0' });
  await client.connect(local);
  cleanups.push(async () => {
    await client.close();
    await bridge.close();
  });
  return { client, fake, logs };
}

function result(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ data }) }],
    structuredContent: { data },
    _meta: { 'relay-fixture/original-receipt': true },
    'x-relay-fixture-response': { revision: 2 },
  };
}

async function rejected(promise: Promise<unknown>): Promise<McpError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(McpError);
  return error as McpError;
}

function rpcError(code: number, message: string, data: Record<string, unknown>): Error {
  return Object.assign(new Error(message), { code, data });
}

async function collect(client: Client): Promise<Tool[]> {
  const tools: Tool[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.request(
      { method: 'tools/list', ...(cursor === undefined ? {} : { params: { cursor } }) },
      ResultSchema,
    );
    expect(Array.isArray(page.tools)).toBe(true);
    tools.push(...(page.tools as Tool[]));
    expect(page.nextCursor === undefined || typeof page.nextCursor === 'string').toBe(true);
    cursor = page.nextCursor as string | undefined;
    if (cursor !== undefined) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
    }
  } while (cursor !== undefined);
  return tools;
}

describe('native CRM relay contracts', () => {
  it('discovers all owner tools across opaque cursors and an empty intermediate page without changing schemas', async () => {
    const cursors = ['catalog%2B/ñ:documents==', 'catalog?opportunity=cursor&2', 'catalog:ticket/3=='];
    const { client, fake } = await connect({
      listTools: (params) => {
        const cursor = params?.cursor;
        if (cursor === undefined)
          return { tools: CRM_WIRE_FIXTURES.slice(0, 7).map(({ tool }) => tool), nextCursor: cursors[0] };
        if (cursor === cursors[0]) return { tools: [], nextCursor: cursors[1] };
        if (cursor === cursors[1])
          return { tools: CRM_WIRE_FIXTURES.slice(7, 13).map(({ tool }) => tool), nextCursor: cursors[2] };
        expect(cursor).toBe(cursors[2]);
        return { tools: CRM_WIRE_FIXTURES.slice(13).map(({ tool }) => tool) };
      },
    });
    const tools = await collect(client);
    expect(tools).toEqual(CRM_WIRE_FIXTURES.map(({ tool }) => tool));
    expect(tools).toHaveLength(16);
    expect(fake.requests.filter(({ method }) => method === 'tools/list').map(({ body }) => body)).toEqual([
      expect.objectContaining({ params: {} }),
      expect.objectContaining({ params: { cursor: cursors[0] } }),
      expect.objectContaining({ params: { cursor: cursors[1] } }),
      expect.objectContaining({ params: { cursor: cursors[2] } }),
    ]);
  });

  it('uses exactly the hosted read or write discovery and never promotes aliases or unavailable Proposal tools', async () => {
    const reads = CRM_WIRE_FIXTURES.filter(({ scope }) => scope.endsWith(':read')).map(({ tool }) => tool);
    const all = CRM_WIRE_FIXTURES.map(({ tool }) => tool);
    const read = await connect({ listTools: () => ({ tools: reads }) }, 'fact_test_read_fixture');
    const write = await connect({ listTools: () => ({ tools: all }) }, 'fact_test_write_fixture');
    expect(await collect(read.client)).toEqual(reads);
    expect(await collect(write.client)).toEqual(all);
    expect(reads).toHaveLength(5);
    expect(all.map(({ name }) => name)).not.toContain('create_client');
    expect(all.map(({ name }) => name)).not.toContain('list_opportunity_proposals');
    for (const { fake } of [read, write]) {
      expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(0);
    }
  });

  it('forwards all sixteen operation arguments without translating public UUIDs, omitted fields, nulls, CAS or intent keys', async () => {
    const receipt = result({ id: UUID.document, version: 8 });
    const { client, fake } = await connect({ callTool: () => receipt });
    for (const fixture of CRM_WIRE_FIXTURES) {
      const response = await client.request(
        { method: 'tools/call', params: { name: fixture.tool.name, arguments: fixture.arguments } },
        ResultSchema,
      );
      expect(response).toEqual(receipt);
    }
    expect(fake.requests.filter(({ method }) => method === 'tools/call').map(({ body }) => body)).toEqual(
      CRM_WIRE_FIXTURES.map(({ tool, arguments: args }) =>
        expect.objectContaining({ params: { name: tool.name, arguments: args } }),
      ),
    );
    expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(16);
  });

  it('preserves signed owner data cursors independently of tools/list discovery cursors', async () => {
    const cursor = 'owner-filter:C7%2B/sandbox==signed';
    const pages = [
      result({
        opportunity_id: UUID.opportunity,
        items: [
          {
            id: UUID.document,
            document_type: 'quote',
            document_id: UUID.producer,
            is_primary: false,
            status: 'linked',
            version: 7,
            document: null,
          },
        ],
        next_cursor: cursor,
        total: 2,
        pending_count: 0,
      }),
      result({
        opportunity_id: UUID.opportunity,
        items: [
          {
            id: UUID.other,
            document_type: 'contract',
            document_id: UUID.producer,
            is_primary: false,
            status: 'linked',
            version: 3,
            document: null,
          },
        ],
        next_cursor: null,
        total: 2,
        pending_count: 0,
      }),
    ];
    let calls = 0;
    const { client, fake } = await connect({
      callTool: (params) => {
        expect(params.name).toBe('list_opportunity_documents');
        expect(params.arguments).toEqual({
          id: UUID.opportunity,
          filters: '{}',
          ...(calls === 0 ? {} : { cursor }),
          limit: 1,
        });
        return pages[calls++]!;
      },
    });
    for (const args of [
      { id: UUID.opportunity, filters: '{}', limit: 1 },
      { id: UUID.opportunity, filters: '{}', cursor, limit: 1 },
    ]) {
      expect(
        await client.request(
          { method: 'tools/call', params: { name: 'list_opportunity_documents', arguments: args } },
          ResultSchema,
        ),
      ).toEqual(pages[calls - 1]);
    }
    expect(calls).toBe(2);
    expect(fake.requests.filter(({ method }) => method === 'tools/list')).toHaveLength(0);
  });

  it('returns decimal strings by currency and independent association/document revisions without numeric coercion', async () => {
    const summary = result({
      opportunity_id: UUID.opportunity,
      version: 7,
      currencies: [
        {
          currency: 'EUR',
          forecast: '1234567890123456.1234',
          quoted: '12345678901234567890.99',
          invoiced: '120.00',
          paid: '0.00',
        },
        { currency: 'USD', forecast: '0.0000', quoted: '12.30', invoiced: '0.00', paid: '0.00' },
      ],
    });
    const link = result({
      id: UUID.other,
      version: 3,
      opportunity_id: UUID.opportunity,
      document_type: 'quote',
      document_id: UUID.document,
      is_primary: false,
      status: 'linked',
      document: {
        id: UUID.document,
        type: 'quote',
        version: 17,
        state: 'draft',
        number: null,
        currency: 'EUR',
        quoted_amount: '12345678901234567890.99',
        invoiced_amount: '0.00',
        paid_amount: '0.00',
        financial_applicability: 'applicable',
        valid_from: null,
        valid_until: null,
      },
    });
    const { client } = await connect({
      callTool: ({ name }) => (name === 'get_opportunity_financial_summary' ? summary : link),
    });
    expect(
      await client.request(
        {
          method: 'tools/call',
          params: { name: 'get_opportunity_financial_summary', arguments: { id: UUID.opportunity } },
        },
        ResultSchema,
      ),
    ).toEqual(summary);
    expect(
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'link_opportunity_document',
            arguments: {
              id: UUID.opportunity,
              document_type: 'quote',
              document_id: UUID.document,
              is_primary: false,
              idempotency_key: 'original-link',
            },
          },
        },
        ResultSchema,
      ),
    ).toEqual(link);
  });

  it('preserves typed permission, CAS, validation and Retry-After errors without automatic retries', async () => {
    const cases = [
      {
        code: -32005,
        message: 'insufficient_scope',
        data: { http_status: 403, code: 'insufficient_scope', scope: 'customer_service:write' },
      },
      {
        code: -32008,
        message: 'El ticket cambió; vuelve a cargarlo antes de guardar.',
        data: {
          http_status: 409,
          code: 'crm_version_conflict',
          subcode: 'service_ticket_version_conflict',
          param: 'expected_version',
        },
      },
      {
        code: -32008,
        message: 'Los datos del ticket no son válidos.',
        data: {
          http_status: 422,
          code: 'business_rule_violation',
          subcode: 'service_ticket_invalid_data',
          param: 'document_version',
        },
      },
      {
        code: -32006,
        message: 'rate_limit_exceeded',
        data: { http_status: 429, code: 'rate_limit_exceeded', retry_after: 17 },
      },
    ];
    let attempts = 0;
    const { client, fake } = await connect({
      callTool: () => {
        const error = cases[attempts++]!;
        throw rpcError(error.code, error.message, error.data);
      },
    });
    for (const expected of cases) {
      const error = await rejected(
        client.callTool({
          name: 'attach_service_ticket_document',
          arguments: {
            id: UUID.ticket,
            expected_version: 7,
            document_id: UUID.document,
            document_version: 3,
            idempotency_key: 'same-original-intent',
          },
        }),
      );
      expect(error.code).toBe(expected.code);
      expect(error.message).toBe(`MCP error ${expected.code}: ${expected.message}`);
      expect(error.data).toEqual(expected.data);
    }
    expect(attempts).toBe(cases.length);
    expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(cases.length);
  });

  it('leaves ambiguous effects unconfirmed and missing native owners unavailable instead of returning empty success', async () => {
    const failures = [
      {
        code: -32008,
        message: 'El resultado todavía no está confirmado.',
        data: {
          http_status: 409,
          code: 'crm_effect_unconfirmed',
          subcode: 'crm_opportunity_documents_effect_unconfirmed',
        },
      },
      {
        code: -32008,
        message: 'El dueño documental todavía no dispone de una proyección autorizada completa.',
        data: { http_status: 503, code: 'resource_unavailable', subcode: 'crm_contract_document_owner_unavailable' },
      },
    ];
    let attempts = 0;
    const { client } = await connect({
      callTool: () => {
        const failure = failures[attempts++]!;
        throw rpcError(failure.code, failure.message, failure.data);
      },
    });
    for (const expected of failures) {
      const error = await rejected(
        client.callTool({
          name: 'link_opportunity_document',
          arguments: {
            id: UUID.opportunity,
            document_type: 'contract',
            document_id: UUID.document,
            is_primary: false,
            idempotency_key: 'ambiguous-original',
          },
        }),
      );
      expect(error.data).toEqual(expected.data);
      expect(error.code).toBe(expected.code);
    }
    expect(attempts).toBe(2);
  });

  it('refreshes hosted discovery and preserves a current revocation even after a write tool was previously listed', async () => {
    let active = true;
    const revoked = { http_status: 403, code: 'client_revoked', hint: 'La conexión fue revocada.' };
    const { client, fake } = await connect({
      listTools: () => ({ tools: active ? CRM_WIRE_FIXTURES.map(({ tool }) => tool) : [] }),
      callTool: () => {
        throw rpcError(-32002, 'client_revoked', revoked);
      },
    });
    expect(await collect(client)).toHaveLength(16);
    active = false;
    expect(await collect(client)).toEqual([]);
    const error = await rejected(
      client.callTool({
        name: 'detach_service_ticket_document',
        arguments: {
          id: UUID.ticket,
          expected_version: 7,
          attachment_id: UUID.other,
          idempotency_key: 'prepared-before-revocation',
        },
      }),
    );
    expect(error.data).toEqual(revoked);
    expect(error.code).toBe(-32002);
    expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(1);
  });

  it('relays an existing opaque bearer credential without inferring scopes, sandbox or implementing a second OAuth flow', async () => {
    const credential = 'oauth_fixture_access_token';
    const read = CRM_WIRE_FIXTURES.filter(({ scope }) => scope === 'crm_documents:read').map(({ tool }) => tool);
    const { client, fake, logs } = await connect({ listTools: () => ({ tools: read }) }, credential);
    expect(await collect(client)).toEqual(read);
    for (const request of fake.requests) expect(request.headers.authorization).toBe(`Bearer ${credential}`);
    expect(fake.requests.map(({ method }) => method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
    ]);
    expect(logs.join('\n')).not.toContain(credential);
    expect(logs.join('\n')).not.toContain('test mode:');
    expect(logs.join('\n')).not.toContain('live mode:');
  });

  it('does not redispatch a write when the original upstream response is lost after the request reached its owner', async () => {
    const response = result({ id: UUID.ticket, version: 8 });
    const lostAcknowledgment: FetchLike = async (url, init) => {
      const incoming = await fetch(url, init);
      const wire = typeof init?.body === 'string' ? (JSON.parse(init.body) as { method?: string }) : {};
      if (wire.method === 'tools/call') throw new TypeError('original ACK lost');
      return incoming;
    };
    const { client, fake } = await connect({ callTool: () => response }, VALID_KEY, lostAcknowledgment);
    const error = await rejected(
      client.callTool({
        name: 'move_service_ticket_to_stage',
        arguments: {
          id: UUID.ticket,
          expected_version: 7,
          pipeline_id: UUID.producer,
          stage_id: UUID.other,
          idempotency_key: 'original-stage-intent',
        },
      }),
    );
    expect(error.code).toBe(-32603);
    expect(error.message).toContain('original ACK lost');
    expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(1);
  });
});

describe('native OAuth and Original hosted relay', () => {
  it('uses the active tenant bearer for every CRM context read without caching a prior company context', async () => {
    let token = 'tenant-a-access-token';
    const contexts = [
      {
        company_id: UUID.document,
        credential_id: UUID.producer,
        environment: 'live',
        scopes: ['crm_access_context:read'],
        authorization_version: 'tenant-a-v1',
      },
      {
        company_id: UUID.other,
        credential_id: UUID.ticket,
        environment: 'test',
        scopes: ['crm_access_context:read', 'crm_activities:read'],
        authorization_version: 'tenant-b-v1',
      },
      {
        company_id: UUID.document,
        credential_id: UUID.producer,
        environment: 'live',
        scopes: ['crm_access_context:read'],
        authorization_version: 'tenant-a-v1',
      },
    ];
    let contextRead = 0;
    const fake = await startFakeUpstream({
      currentBearer: () => token,
      listTools: () => ({ tools: [CRM_NATIVE_READ_FIXTURES[0]!.tool] }),
      callTool: ({ name }) => {
        expect(name).toBe('get_crm_credential_context');
        return result(contexts[contextRead++]!);
      },
    });
    cleanups.push(() => fake.close());
    const bridge = await createBridge({
      config: { apiKey: undefined, oauthBearer: () => token, url: fake.url, timeoutMs: 5_000 },
    });
    const [local, remote] = InMemoryTransport.createLinkedPair();
    await bridge.server.connect(remote);
    const client = new Client({ name: 'tenant-context-relay', version: '1.0.0' });
    await client.connect(local);
    cleanups.push(async () => {
      await client.close();
      await bridge.close();
    });

    const contextFixture = CRM_NATIVE_READ_FIXTURES[0]!;
    const readContext = async () =>
      client.request(
        {
          method: 'tools/call',
          params: { name: contextFixture.tool.name, arguments: contextFixture.arguments },
        },
        ResultSchema,
      );

    const first = await readContext();
    token = 'tenant-b-access-token';
    const second = await readContext();
    token = 'tenant-a-access-token';
    const third = await readContext();

    expect([first, second, third].map((response) => (response.structuredContent as { data: unknown }).data)).toEqual(
      contexts,
    );
    const calls = fake.requests.filter(({ method }) => method === 'tools/call');
    expect(calls.map(({ headers }) => headers.authorization)).toEqual([
      'Bearer tenant-a-access-token',
      'Bearer tenant-b-access-token',
      'Bearer tenant-a-access-token',
    ]);
    expect(calls).toHaveLength(3);
  });

  it('takes the current actual bearer for each request and preserves context and four readonly tool schemas', async () => {
    let token = 'native-current-access-token';
    const fake = await startFakeUpstream({
      currentBearer: () => token,
      listTools: () => ({ tools: CRM_NATIVE_READ_FIXTURES.map(({ tool }) => tool) }),
      callTool: ({ name }) =>
        name === 'get_crm_credential_context'
          ? result({
              company_id: UUID.other,
              credential_id: UUID.producer,
              client_id: UUID.document,
              environment: 'test',
              scopes: ['crm_access_context:read', 'crm_activities:write'],
              authorization_version: 'owner-C7-current',
            })
          : result({
              state: 'confirmed',
              original_body_sha256: 'a'.repeat(64),
              original_response: {
                status: 201,
                body: '{ "data": { "state":"confirmed", "effect_id":"019fb222-2222-7222-8222-333333333333", "activity_id":"019fb222-2222-7222-8222-222222222222", "activity":null } }',
              },
            }),
    });
    cleanups.push(() => fake.close());
    const logs: string[] = [];
    const bridge = await createBridge({
      config: { apiKey: undefined, oauthBearer: () => token, url: fake.url, timeoutMs: 5_000 },
      log: (line) => logs.push(line),
    });
    const [local, remote] = InMemoryTransport.createLinkedPair();
    await bridge.server.connect(remote);
    const client = new Client({ name: 'native-oauth-relay-test', version: '1.0.0' });
    await client.connect(local);
    cleanups.push(async () => {
      await client.close();
      await bridge.close();
    });
    token = 'native-replacement-access-token';
    expect(await collect(client)).toEqual(CRM_NATIVE_READ_FIXTURES.map(({ tool }) => tool));
    for (const fixture of CRM_NATIVE_READ_FIXTURES) {
      const response = await client.request(
        { method: 'tools/call', params: { name: fixture.tool.name, arguments: fixture.arguments } },
        ResultSchema,
      );
      expect(response).toHaveProperty('structuredContent.data');
      if (fixture.tool.name !== 'get_crm_credential_context') {
        expect((response.structuredContent as { data: Record<string, unknown> }).data.original_response).toEqual({
          status: 201,
          body: '{ "data": { "state":"confirmed", "effect_id":"019fb222-2222-7222-8222-333333333333", "activity_id":"019fb222-2222-7222-8222-222222222222", "activity":null } }',
        });
      }
    }
    const calls = fake.requests.filter(({ method }) => method === 'tools/call');
    expect(calls).toHaveLength(5);
    expect(calls.every(({ headers }) => headers.authorization === `Bearer ${token}`)).toBe(true);
    expect(calls.map(({ body }) => body)).toEqual(
      CRM_NATIVE_READ_FIXTURES.map((fixture) =>
        expect.objectContaining({ params: { name: fixture.tool.name, arguments: fixture.arguments } }),
      ),
    );
    expect(logs.join(' ')).not.toContain(token);
    expect(logs.join(' ')).not.toContain('test mode');
  });

  it('returns revoked OAuth once without refreshing or resending a tool call', async () => {
    let token = 'native-current-access-token';
    const fake = await startFakeUpstream({ currentBearer: () => 'native-current-access-token' });
    cleanups.push(() => fake.close());
    const bridge = await createBridge({
      config: { apiKey: undefined, oauthBearer: () => token, url: fake.url, timeoutMs: 5_000 },
    });
    const [local, remote] = InMemoryTransport.createLinkedPair();
    await bridge.server.connect(remote);
    const client = new Client({ name: 'revoked-oauth-relay', version: '1.0.0' });
    await client.connect(local);
    cleanups.push(async () => {
      await client.close();
      await bridge.close();
    });
    token = 'revoked-native-token';
    const fixture = CRM_NATIVE_READ_FIXTURES[1]!;
    const error = await rejected(
      client.request(
        { method: 'tools/call', params: { name: fixture.tool.name, arguments: fixture.arguments } },
        ResultSchema,
      ),
    );
    expect(error.code).toBe(-32001);
    expect(error.data).toMatchObject({ code: 'invalid_token' });
    expect(error.message).toContain('FACTUAREA_OAUTH_BEARER');
    expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(1);
    expect(fake.requests.filter(({ method }) => method === 'initialize')).toHaveLength(1);
  });

  it.each(['pending', 'in_progress', 'unconfirmed', 'missing'])(
    'preserves %s without redispatching any mutation',
    async (state) => {
      const receipt = result({ state, original_body_sha256: 'a'.repeat(64), original_response: null });
      const { client, fake } = await connect({ callTool: () => receipt });
      const fixture = CRM_NATIVE_READ_FIXTURES[3]!;
      expect(
        await client.request(
          { method: 'tools/call', params: { name: fixture.tool.name, arguments: fixture.arguments } },
          ResultSchema,
        ),
      ).toEqual(receipt);
      expect(fake.requests.filter(({ method }) => method === 'tools/call')).toHaveLength(1);
    },
  );
});
