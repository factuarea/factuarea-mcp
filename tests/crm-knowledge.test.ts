import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createBridge } from '../src/bridge.js';
import {
  CRM_TOOL_NAMES,
  CrmToolUnavailableError,
  callCrmTool,
  discoverCrmApplicability,
  recoverCrmReceipt,
  type CrmInputs,
  type CrmOutputs,
  type CrmToolName,
  type OriginalCrmWrite,
} from '../src/crm.js';
import { LEADS_TOOL, nativeError } from './support/crm-tools.js';
import { startFakeUpstream, VALID_KEY, type FakeUpstreamOptions } from './support/fake-upstream.js';
import nativeFixtures from './support/knowledge-tools.json' with { type: 'json' };

// Native core descriptors transcribed from source definitions. These remain test data;
// no fixture registers hosted tools or establishes deployment/credential availability.
const tools = nativeFixtures.map((fixture) => fixture.descriptor);
const id = '019ba420-1000-7000-8000-000000000021';
const taxonomyId = '019ba420-1000-7000-8000-000000000022';
const effectId = '019ba420-1000-7000-8000-000000000023';
const key = 'same-original-key';
const receiptArgs = { idempotency_key: key };
const casArgs = { ...receiptArgs, confirmed: true as const, id, expected_version: 7 };
const editorial = { title: 'Fixture', body: 'Fixture body', editorial_locale: 'es' as const, category_ids: [] };

const inputs = {
  search_knowledge_articles: { query: '', locale: null, page: 1, per_page: 7 },
  get_knowledge_article: { id },
  get_knowledge_article_versions: { id },
  list_knowledge_categories: {},
  suggest_service_articles: {
    ticket_id: id,
    ticket_version: 3,
    query: 'Fixture',
    locale: null,
    audience: 'public',
    limit: 5,
  },
  create_knowledge_article: { ...receiptArgs, confirmed: true, expected_version: 0, slug: 'fixture', ...editorial },
  save_knowledge_article: { ...casArgs, ...editorial },
  submit_knowledge_article_review: casArgs,
  approve_knowledge_article: casArgs,
  publish_knowledge_article_version: { ...casArgs, published_version: 4, audience: 'public' },
  unpublish_knowledge_article: casArgs,
  archive_knowledge_article: casArgs,
  link_knowledge_article: { ...casArgs, target_type: 'ticket', target_id: taxonomyId, target_version: 3 },
  recover_knowledge_article_create_receipt: receiptArgs,
  recover_knowledge_article_save_receipt: receiptArgs,
  recover_knowledge_article_submit_receipt: receiptArgs,
  recover_knowledge_article_approve_receipt: receiptArgs,
  recover_knowledge_article_publish_receipt: receiptArgs,
  recover_knowledge_article_unpublish_receipt: receiptArgs,
  recover_knowledge_article_archive_receipt: receiptArgs,
  recover_knowledge_article_link_receipt: receiptArgs,
  save_knowledge_category: {
    ...receiptArgs,
    confirmed: true,
    taxonomy_id: taxonomyId,
    expected_taxonomy_version: 12,
    expected_version: null,
    name: 'Fixture',
    slug: 'fixture',
    parent_id: null,
    visibility: 'public',
    status: 'active',
  },
  recover_knowledge_category_receipt: receiptArgs,
  get_help_center_administration: {},
  publish_help_center: {
    ...receiptArgs,
    confirmed: true,
    expected_version: 0,
    slug: 'fixture',
    display_name: 'Fixture',
    locale: 'es',
    article_slugs: [],
  },
  unpublish_help_center: casArgs,
  recover_help_center_publish_receipt: receiptArgs,
  recover_help_center_unpublish_receipt: receiptArgs,
} satisfies CrmInputs;

function articleReceipt<Action extends string>(action: Action, expected_version = 7) {
  return {
    effect_id: effectId,
    operation: `knowledge_articles.${action}` as const,
    expected_version,
    article: { id, version: expected_version + 1 },
    confirmed: true as const,
  };
}
const category = { id, taxonomy_id: taxonomyId, version: 1, taxonomy_version: 13, parent_id: null };
const categoryReceipt = {
  effect_id: effectId,
  operation: 'knowledge_articles.category_save' as const,
  expected_version: null,
  expected_taxonomy_version: 12,
  category,
  confirmed: true as const,
};
const center = {
  id,
  version: 1,
  slug: 'fixture',
  display_name: 'Fixture',
  locale: 'es',
  article_slugs: [],
  enabled: true,
};
const publishReceipt = {
  effect_id: effectId,
  operation: 'public_help_centers.publish' as const,
  expected_version: 0,
  center,
  confirmed: true as const,
};
const unpublishReceipt = {
  ...publishReceipt,
  operation: 'public_help_centers.unpublish' as const,
  expected_version: 7,
  center: { ...center, version: 8, enabled: false },
};
const outputs = {
  search_knowledge_articles: { items: [{ id, version: 25 }], total: 1, page: 1, per_page: 7 },
  get_knowledge_article: { id, version: 25, published_version: null },
  get_knowledge_article_versions: { items: [{ id, version: 4, revision_number: 4 }] },
  list_knowledge_categories: {
    items: [{ ...category, name: 'Fixture', slug: 'fixture', visibility: 'public' }],
    total: 1,
  },
  suggest_service_articles: {
    items: [{ id, version: 4, revision_number: 4, published_version: 4, audience: 'public' }],
    total: 1,
    ticket_id: id,
    ticket_version: 3,
    audience: 'public',
  },
  create_knowledge_article: articleReceipt('create', 0),
  save_knowledge_article: articleReceipt('save'),
  submit_knowledge_article_review: articleReceipt('submit'),
  approve_knowledge_article: articleReceipt('approve'),
  publish_knowledge_article_version: articleReceipt('publish'),
  unpublish_knowledge_article: articleReceipt('unpublish'),
  archive_knowledge_article: articleReceipt('archive'),
  link_knowledge_article: articleReceipt('link'),
  recover_knowledge_article_create_receipt: articleReceipt('create', 0),
  recover_knowledge_article_save_receipt: articleReceipt('save'),
  recover_knowledge_article_submit_receipt: articleReceipt('submit'),
  recover_knowledge_article_approve_receipt: articleReceipt('approve'),
  recover_knowledge_article_publish_receipt: articleReceipt('publish'),
  recover_knowledge_article_unpublish_receipt: articleReceipt('unpublish'),
  recover_knowledge_article_archive_receipt: articleReceipt('archive'),
  recover_knowledge_article_link_receipt: articleReceipt('link'),
  save_knowledge_category: categoryReceipt,
  recover_knowledge_category_receipt: categoryReceipt,
  get_help_center_administration: { center: { ...center, version: 25 } },
  publish_help_center: publishReceipt,
  unpublish_help_center: unpublishReceipt,
  recover_help_center_publish_receipt: publishReceipt,
  recover_help_center_unpublish_receipt: unpublishReceipt,
} satisfies CrmOutputs;

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
  const client = new Client({ name: 'knowledge-fixture-client', version: '1.0.0' });
  await client.connect(clientTransport);
  cleanups.push(async () => {
    await client.close();
    await bridge.close();
  });
  return { client, fake };
}

describe('current knowledge and help center MCP wrappers', () => {
  it('retains the full existing catalog, native descriptors, pagination and extension metadata', async () => {
    // Extension canaries are deliberately not presented as native Factuarea metadata.
    const extended = {
      ...tools[0]!,
      outputSchema: { type: 'object' },
      _meta: { canary: true },
      'x-openapi-canary': { operationId: 'opaque-canary' },
    };
    const cursor = 'same-connection-opaque-cursor';
    const { client, fake } = await connect({
      listTools: ({ cursor: received }) =>
        received === cursor ? { tools: [extended, ...tools.slice(1)] } : { tools: [LEADS_TOOL], nextCursor: cursor },
    });
    const result = await discoverCrmApplicability(client, { perPage: 3 });
    expect(result.catalog).toEqual([LEADS_TOOL, extended, ...tools.slice(1)]);
    expect(result.available).toEqual([extended, ...tools.slice(1)]);
    expect(result.unavailable).toEqual([]);
    expect(fake.requests.filter((request) => request.method === 'tools/list').map((request) => request.body)).toEqual([
      expect.objectContaining({ params: { per_page: 3 } }),
      expect.objectContaining({ params: { cursor, per_page: 3 } }),
    ]);
    expect(tools.map((tool) => tool.name).sort()).toEqual([...CRM_TOOL_NAMES].sort());
  });

  it.each(CRM_TOOL_NAMES)('forwards %s with exact native arguments and original masked envelope', async (name) => {
    const response = { content: [{ type: 'text', text: JSON.stringify({ data: outputs[name] }) }] };
    const { client, fake } = await connect({ listTools: () => ({ tools }), callTool: () => response });
    expect(await callCrmTool(client, name, inputs[name])).toEqual(response);
    const calls = fake.requests.filter((request) => request.method === 'tools/call');
    expect(calls.map((request) => request.body)).toEqual([
      expect.objectContaining({ params: { name, arguments: inputs[name] } }),
    ]);
    expect(fake.requests.filter((request) => request.method === 'tools/list')).toHaveLength(1);
  });

  it('rediscoveries cannot retain a removed grant or fall back to an alias', async () => {
    let visible = tools;
    const { client, fake } = await connect({
      listTools: () => ({ tools: visible }),
      callTool: () => ({ content: [] }),
    });
    await callCrmTool(client, 'get_knowledge_article', { id });
    visible = [];
    await expect(callCrmTool(client, 'get_knowledge_article', { id })).rejects.toMatchObject({
      name: 'CrmToolUnavailableError',
      toolName: 'get_knowledge_article',
    });
    expect(await discoverCrmApplicability(client)).toEqual({ catalog: [], available: [], unavailable: CRM_TOOL_NAMES });
    expect(fake.requests.filter((request) => request.method === 'tools/call')).toHaveLength(1);
  });

  const originals = [
    'create_knowledge_article',
    'save_knowledge_article',
    'submit_knowledge_article_review',
    'approve_knowledge_article',
    'publish_knowledge_article_version',
    'unpublish_knowledge_article',
    'archive_knowledge_article',
    'link_knowledge_article',
    'save_knowledge_category',
    'publish_help_center',
    'unpublish_help_center',
  ] as const;
  const receipts = [
    'recover_knowledge_article_create_receipt',
    'recover_knowledge_article_save_receipt',
    'recover_knowledge_article_submit_receipt',
    'recover_knowledge_article_approve_receipt',
    'recover_knowledge_article_publish_receipt',
    'recover_knowledge_article_unpublish_receipt',
    'recover_knowledge_article_archive_receipt',
    'recover_knowledge_article_link_receipt',
    'recover_knowledge_category_receipt',
    'recover_help_center_publish_receipt',
    'recover_help_center_unpublish_receipt',
  ] as const;

  it.each(originals.map((name, i) => [name, receipts[i]!] as const))(
    'explicitly recovers %s using only its same original key through %s',
    async (name, receiptName) => {
      const original = Object.freeze({ name, arguments: Object.freeze(inputs[name]) }) as OriginalCrmWrite;
      const response = { content: [{ type: 'text', text: JSON.stringify({ data: outputs[receiptName] }) }] };
      const { client, fake } = await connect({ listTools: () => ({ tools }), callTool: () => response });
      expect(await recoverCrmReceipt(client, original)).toEqual(response);
      expect(fake.requests.filter((request) => request.method === 'tools/call').map((request) => request.body)).toEqual(
        [expect.objectContaining({ params: { name: receiptName, arguments: receiptArgs } })],
      );
      const fixture = nativeFixtures.find((fixture) => fixture.descriptor.name === receiptName)!;
      expect(fixture.requiredScope).toBe(
        nativeFixtures.find((fixture) => fixture.descriptor.name === name)!.requiredScope,
      );
      expect(fixture.descriptor.annotations.readOnlyHint).toBe(true);
    },
  );

  it('requires current receipt visibility rather than using the previous write descriptor', async () => {
    const { client, fake } = await connect({
      listTools: () => ({ tools: tools.filter((tool) => tool.name === 'save_knowledge_article') }),
    });
    await expect(
      recoverCrmReceipt(client, { name: 'save_knowledge_article', arguments: inputs.save_knowledge_article }),
    ).rejects.toBeInstanceOf(CrmToolUnavailableError);
    expect(fake.requests.filter((request) => request.method === 'tools/call')).toEqual([]);
  });

  it.each([
    {
      code: -32005,
      message: 'insufficient_scope',
      data: {
        http_status: 403,
        code: 'insufficient_scope',
        required_scope: 'knowledge_articles:write',
        provided_scopes: ['knowledge_articles:read'],
        hint: 'La credencial no dispone del scope requerido.',
      },
    },
    {
      code: -32008,
      message: 'crm_version_conflict',
      data: {
        http_status: 409,
        code: 'crm_version_conflict',
        param: 'expected_version',
        subcode: 'knowledge_article_version_conflict',
        hint: 'El artículo cambió. Revisa la versión actual antes de guardar.',
      },
    },
    { code: -32603, message: 'internal_error', data: { http_status: 500, code: 'internal_error' } },
    {
      code: -32008,
      message: 'invalid_param_value',
      data: {
        http_status: 422,
        code: 'invalid_param_value',
        param: 'confirmed',
        hint: 'Confirma explícitamente la operación con true.',
      },
    },
  ])('preserves native rejection without a retry or implicit recovery (%s)', async (failure) => {
    const { client, fake } = await connect({ listTools: () => ({ tools }), callTool: () => nativeError(failure) });
    const error = await callCrmTool(client, 'save_knowledge_article', inputs.save_knowledge_article).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(McpError);
    expect(error).toMatchObject({ code: failure.code, data: failure.data });
    expect((error as McpError).message).toBe(`MCP error ${failure.code}: ${failure.message}`);
    expect(fake.requests.filter((request) => request.method === 'tools/call')).toHaveLength(1);
  });

  it('propagates an interrupted discovery and never dispatches a partial catalog', async () => {
    const failure = new McpError(-32602, 'El cursor de paginación no es válido o ha caducado.');
    const request = vi.fn(async (request: { method: string; params?: { cursor?: string } }) => {
      if (request.params?.cursor) throw failure;
      return { tools, nextCursor: 'opaque' };
    });
    await expect(
      callCrmTool(
        { request } as unknown as Pick<Client, 'request'>,
        'save_knowledge_article',
        inputs.save_knowledge_article,
      ),
    ).rejects.toBe(failure);
    expect(request.mock.calls.every(([request]) => request.method === 'tools/list')).toBe(true);
  });

  it('leaves a timeout outcome unconfirmed without retrying the write or reading a receipt', async () => {
    const timeout = new Error('fixture timeout');
    const request = vi.fn(async (request: { method: string }) => {
      if (request.method === 'tools/list') return { tools };
      throw timeout;
    });
    await expect(
      callCrmTool({ request } as unknown as Pick<Client, 'request'>, 'publish_help_center', inputs.publish_help_center),
    ).rejects.toBe(timeout);
    expect(request.mock.calls.map(([request]) => request.method)).toEqual(['tools/list', 'tools/call']);
  });

  it('passes cancellation and timeout to discovery and the single call, leaving isError results intact', async () => {
    const options: RequestOptions = { signal: new AbortController().signal, timeout: 1234 };
    const response = { content: [{ type: 'text', text: 'native rejection' }], isError: true, _meta: { canary: true } };
    const request = vi.fn(async (request: { method: string }) =>
      request.method === 'tools/list' ? { tools } : response,
    );
    expect(
      await callCrmTool(
        { request } as unknown as Pick<Client, 'request'>,
        'save_knowledge_article',
        inputs.save_knowledge_article,
        { requestOptions: options },
      ),
    ).toBe(response);
    expect(request.mock.calls).toHaveLength(2);
    for (const call of request.mock.calls) expect((call as unknown[])[2]).toBe(options);
  });

  it('types mandatory original CAS, explicit nulls and human confirmation without fabricating output fields', () => {
    expectTypeOf<CrmInputs['create_knowledge_article']['confirmed']>().toEqualTypeOf<true>();
    expectTypeOf<CrmInputs['create_knowledge_article']['expected_version']>().toEqualTypeOf<0>();
    expectTypeOf<CrmInputs['save_knowledge_category']['expected_version']>().toEqualTypeOf<number | null>();
    expectTypeOf<CrmInputs['save_knowledge_category']['parent_id']>().toEqualTypeOf<string | null>();
    expectTypeOf<CrmInputs['recover_knowledge_article_save_receipt']>().toEqualTypeOf<{ idempotency_key: string }>();
    expectTypeOf<CrmOutputs['get_knowledge_article']['body']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<
      CrmOutputs['recover_knowledge_article_save_receipt']['operation']
    >().toEqualTypeOf<'knowledge_articles.save'>();
    expectTypeOf<CrmOutputs['get_help_center_administration']['center']>().toBeNullable();
    expectTypeOf<CrmToolName>().toEqualTypeOf<keyof CrmInputs>();
  });
});
