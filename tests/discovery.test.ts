import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import { discoverTools, ToolDiscoveryError } from '../src/discovery.js';
import { LEADS_TOOL, PEOPLE_TOOL, PIPELINES_TOOL } from './support/crm-tools.js';

function source(pages: Array<Record<string, unknown> | Error>) {
  const request = vi.fn(async (_request: unknown, _schema: unknown, _options?: RequestOptions) => {
    void _request;
    void _schema;
    void _options;
    const page = pages.shift();
    if (page instanceof Error) throw page;
    return page ?? { tools: [] };
  });
  return { client: { request } as unknown as Pick<Client, 'request'>, request };
}

describe('discoverTools', () => {
  it('exhausts opaque pages and keeps schemas, metadata and the latest duplicate descriptor', async () => {
    const opaque = 'v2.do-not-decode+company-user-client/fingerprint';
    const revised = { ...LEADS_TOOL, description: 'New catalog descriptor', _meta: { native: true } };
    const { client, request } = source([
      { tools: [LEADS_TOOL], nextCursor: opaque },
      { tools: [revised, PEOPLE_TOOL], nextCursor: 'another-opaque-cursor' },
      { tools: [PIPELINES_TOOL] },
    ]);
    expect(await discoverTools(client, { perPage: 2 })).toEqual([revised, PEOPLE_TOOL, PIPELINES_TOOL]);
    expect(request.mock.calls.map(([request]) => request)).toEqual([
      { method: 'tools/list', params: { per_page: 2 } },
      { method: 'tools/list', params: { cursor: opaque, per_page: 2 } },
      { method: 'tools/list', params: { cursor: 'another-opaque-cursor', per_page: 2 } },
    ]);
  });

  it('uses the current client again without caching a previously available tool', async () => {
    const { client, request } = source([{ tools: [LEADS_TOOL] }, { tools: [] }]);
    expect(await discoverTools(client)).toEqual([LEADS_TOOL]);
    expect(await discoverTools(client)).toEqual([]);
    expect(request.mock.calls.map(([request]) => request)).toEqual([
      { method: 'tools/list', params: {} },
      { method: 'tools/list', params: {} },
    ]);
  });

  it('passes cancellation and timeout to every page', async () => {
    const signal = new AbortController().signal;
    const requestOptions = { signal, timeout: 1234 };
    const { client, request } = source([{ tools: [], nextCursor: 'opaque' }, { tools: [] }]);
    await discoverTools(client, { requestOptions });
    expect(request.mock.calls.map((call) => call[2])).toEqual([requestOptions, requestOptions]);
  });

  it('propagates the original native error instead of returning a partial catalog', async () => {
    const error = new McpError(-32602, 'El cursor de paginación no es válido o ha caducado.');
    const { client } = source([{ tools: [LEADS_TOOL], nextCursor: 'other-client-cursor' }, error]);
    await expect(discoverTools(client)).rejects.toBe(error);
  });

  it.each([
    [{ tools: [], nextCursor: '' }],
    [{ tools: [], nextCursor: null }],
    [{ tools: 'invalid' }],
    [{ tools: [{ name: 'missing_schema' }] }],
    [{ tools: [{ name: '', inputSchema: {} }] }],
    [{ tools: [{ name: 'invalid_schema', inputSchema: [] }] }],
    [
      { tools: [], nextCursor: 'repeat' },
      { tools: [LEADS_TOOL], nextCursor: 'repeat' },
    ],
    [
      { tools: [], nextCursor: 'a' },
      { tools: [], nextCursor: 'b' },
      { tools: [], nextCursor: 'a' },
    ],
  ])('rejects a malformed or cyclic catalog without exposing partial results (%#)', async (...pages) => {
    const { client } = source(pages);
    await expect(discoverTools(client)).rejects.toBeInstanceOf(ToolDiscoveryError);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid page size before sending a request (%s)',
    async (perPage) => {
      const { client, request } = source([]);
      await expect(discoverTools(client, { perPage })).rejects.toBeInstanceOf(RangeError);
      expect(request).not.toHaveBeenCalled();
    },
  );
});
