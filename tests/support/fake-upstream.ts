import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';

export const VALID_KEY = 'fact_test_fakefakefakefakefakefake';

export const GUARDRAIL_ERROR = {
  code: -32008,
  message: 'mcp_guardrail_violation',
  data: {
    http_status: 422,
    code: 'mcp_guardrail_violation',
    subcode: 'anular-o-rectificar',
    guardrail_uri: 'factuarea://guardrails/anular-o-rectificar',
    rule_id: 'BR-INV-002',
  },
};

export const SEARCH_INVOICES_TOOL = {
  name: 'search_invoices',
  title: 'Buscar facturas',
  description: 'Busca facturas de la empresa.',
  inputSchema: { type: 'object', properties: { status: { type: 'string' } } },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  _meta: { 'com.factuarea/scope': 'invoices:read' },
  // Not modelled by the SDK: proves the bridge does not strip what it does not know.
  'x-factuarea-category': 'read',
};

export const DELETE_INVOICE_TOOL = {
  name: 'delete_invoice',
  title: 'Eliminar factura',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string' }, idempotency_key: { type: 'string' } },
    required: ['id'],
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
};

export interface RecordedRequest {
  method: string | undefined;
  headers: IncomingHttpHeaders;
  body: unknown;
}

export interface FakeUpstream {
  url: URL;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

export interface FakeUpstreamOptions {
  apiKey?: string;
  capabilities?: ServerCapabilities;
  instructions?: string;
}

/**
 * A stand-in for the hosted server: stateless Streamable HTTP, Bearer authentication
 * answered with the same 401 envelope the real server sends, and a handful of tools,
 * prompts and resources shaped like Factuarea's.
 */
export async function startFakeUpstream(options: FakeUpstreamOptions = {}): Promise<FakeUpstream> {
  const apiKey = options.apiKey ?? VALID_KEY;
  const capabilities = options.capabilities ?? { tools: {}, prompts: {}, resources: {} };
  const requests: RecordedRequest[] = [];

  const http = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const body = JSON.parse(await readBody(req)) as { method?: string };
    requests.push({ method: body.method, headers: req.headers, body });

    if (req.headers.authorization !== `Bearer ${apiKey}`) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="mcp", error="invalid_token"',
      });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32001,
            message: 'invalid_token',
            data: { http_status: 401, code: 'invalid_token', hint: 'Token inválido o revocado.' },
          },
        }),
      );
      return;
    }

    const server = buildServer(capabilities, options.instructions);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;

  return {
    url: new URL(`http://127.0.0.1:${port}/`),
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        http.closeAllConnections();
        http.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function buildServer(capabilities: ServerCapabilities, instructions: string | undefined): Server {
  const server = new Server(
    { name: 'factuarea-public', version: '1.0.0' },
    { capabilities, ...(instructions && { instructions }) },
  );

  if (capabilities.tools) {
    server.setRequestHandler(ListToolsRequestSchema, (request) =>
      request.params?.cursor === 'page-2'
        ? { tools: [DELETE_INVOICE_TOOL] }
        : { tools: [SEARCH_INVOICES_TOOL], nextCursor: 'page-2' },
    );

    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args = {} } = request.params;
      switch (name) {
        case 'search_invoices':
          return {
            content: [{ type: 'text', text: JSON.stringify(args) }],
            _meta: { 'com.factuarea/idempotentReplay': true },
          };
        case 'delete_invoice':
          throw Object.assign(new Error(GUARDRAIL_ERROR.message), {
            code: GUARDRAIL_ERROR.code,
            data: GUARDRAIL_ERROR.data,
          });
        case 'send_invoice':
          return { content: [{ type: 'text', text: 'El destinatario no tiene email.' }], isError: true };
        case 'export_report': {
          const token = request.params._meta?.progressToken;
          if (token !== undefined) {
            for (const progress of [1, 2]) {
              await extra.sendNotification({
                method: 'notifications/progress',
                params: { progressToken: token, progress, total: 2 },
              });
            }
          }
          return { content: [{ type: 'text', text: 'done' }] };
        }
        default:
          throw Object.assign(new Error(`Tool ${name} not found`), { code: -32602 });
      }
    });
  }

  if (capabilities.prompts) {
    server.setRequestHandler(ListPromptsRequestSchema, () => ({
      prompts: [
        {
          name: 'emitir_factura',
          description: 'Emitir una factura de principio a fin.',
          arguments: [{ name: 'cliente', required: false }],
        },
      ],
    }));
    server.setRequestHandler(GetPromptRequestSchema, (request) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: `Emite una factura para ${request.params.arguments?.cliente ?? '?'}` },
        },
      ],
    }));
  }

  if (capabilities.resources) {
    server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: [
        { uri: 'factuarea://guardrails/anular-o-rectificar', name: 'anular-o-rectificar', mimeType: 'text/markdown' },
      ],
    }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({ resourceTemplates: [] }));
    server.setRequestHandler(ReadResourceRequestSchema, (request) => ({
      contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text: '# Anular o rectificar' }],
    }));
  }

  return server;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
