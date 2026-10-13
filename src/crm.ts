import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ResultSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { discoverTools, type DiscoveredTool, type DiscoveryOptions } from './discovery.js';
import type { CrmInputs, CrmOutputs, DataEnvelope } from './crm-types.js';

export type { CrmInputs, CrmOutputs, DataEnvelope } from './crm-types.js';

/** Canonical MCP names. These identify wrappers, never register tools or grant access. */
export const CRM_TOOL_NAMES = Object.freeze([
  'search_knowledge_articles',
  'get_knowledge_article',
  'get_knowledge_article_versions',
  'list_knowledge_categories',
  'suggest_service_articles',
  'create_knowledge_article',
  'save_knowledge_article',
  'submit_knowledge_article_review',
  'approve_knowledge_article',
  'publish_knowledge_article_version',
  'unpublish_knowledge_article',
  'archive_knowledge_article',
  'link_knowledge_article',
  'recover_knowledge_article_create_receipt',
  'recover_knowledge_article_save_receipt',
  'recover_knowledge_article_submit_receipt',
  'recover_knowledge_article_approve_receipt',
  'recover_knowledge_article_publish_receipt',
  'recover_knowledge_article_unpublish_receipt',
  'recover_knowledge_article_archive_receipt',
  'recover_knowledge_article_link_receipt',
  'save_knowledge_category',
  'recover_knowledge_category_receipt',
  'get_help_center_administration',
  'publish_help_center',
  'unpublish_help_center',
  'recover_help_center_publish_receipt',
  'recover_help_center_unpublish_receipt',
] as const satisfies readonly (keyof CrmInputs)[]);

export type CrmToolName = (typeof CRM_TOOL_NAMES)[number];

const RECEIPT_TOOLS = Object.freeze({
  create_knowledge_article: 'recover_knowledge_article_create_receipt',
  save_knowledge_article: 'recover_knowledge_article_save_receipt',
  submit_knowledge_article_review: 'recover_knowledge_article_submit_receipt',
  approve_knowledge_article: 'recover_knowledge_article_approve_receipt',
  publish_knowledge_article_version: 'recover_knowledge_article_publish_receipt',
  unpublish_knowledge_article: 'recover_knowledge_article_unpublish_receipt',
  archive_knowledge_article: 'recover_knowledge_article_archive_receipt',
  link_knowledge_article: 'recover_knowledge_article_link_receipt',
  save_knowledge_category: 'recover_knowledge_category_receipt',
  publish_help_center: 'recover_help_center_publish_receipt',
  unpublish_help_center: 'recover_help_center_unpublish_receipt',
} as const satisfies Partial<Record<CrmToolName, CrmToolName>>);

export type CrmWriteToolName = keyof typeof RECEIPT_TOOLS;

/** The wire result is retained. Structured data is optional; JSON text stays text. */
export type CrmToolResult<Name extends CrmToolName> = CallToolResult & {
  structuredContent?: DataEnvelope<CrmOutputs[Name]>;
};

export type OriginalCrmWrite = {
  [Name in CrmWriteToolName]: { readonly name: Name; readonly arguments: Readonly<CrmInputs[Name]> };
}[CrmWriteToolName];

export interface CrmApplicability {
  /** Entire current catalog, including tools outside these wrappers. */
  catalog: DiscoveredTool[];
  /** Complete advertised descriptors, with native schemas and extensions untouched. */
  available: DiscoveredTool[];
  unavailable: CrmToolName[];
}

export class CrmToolUnavailableError extends Error {
  constructor(public readonly toolName: CrmToolName) {
    super(`Tool ${toolName} is unavailable for the current connection`);
    this.name = 'CrmToolUnavailableError';
  }
}

/** Discovery expresses visibility only. The native server still authorizes every call. */
export async function discoverCrmApplicability(
  client: Pick<Client, 'request'>,
  options: DiscoveryOptions = {},
): Promise<CrmApplicability> {
  const catalog = await discoverTools(client, options);
  const supported = new Set<string>(CRM_TOOL_NAMES);
  const present = new Set(catalog.map((tool) => tool.name));
  return {
    catalog,
    available: catalog.filter((tool) => supported.has(tool.name)),
    unavailable: CRM_TOOL_NAMES.filter((name) => !present.has(name)),
  };
}

/**
 * Rediscover on this connection, then forward exactly one call. No schema rewriting,
 * confirmation, key generation, retry or automatic receipt recovery occurs here.
 * Errors, masked fields, original CAS, content and server extensions pass through.
 */
export async function callCrmTool<Name extends CrmToolName>(
  client: Pick<Client, 'request'>,
  name: Name,
  args: CrmInputs[Name],
  options: DiscoveryOptions = {},
): Promise<CrmToolResult<Name>> {
  const { available } = await discoverCrmApplicability(client, options);
  if (!available.some((tool) => tool.name === name)) throw new CrmToolUnavailableError(name);
  return (await client.request(
    { method: 'tools/call', params: { name, arguments: args } },
    ResultSchema,
    options.requestOptions,
  )) as CrmToolResult<Name>;
}

/**
 * Explicit readonly reconciliation of an original write. Use the same client identity
 * and immutable original intent, including its original key. The native receipt tool
 * requires the original operation's current authority and retains its original CAS.
 */
export async function recoverCrmReceipt<Name extends CrmWriteToolName>(
  client: Pick<Client, 'request'>,
  original: { readonly name: Name; readonly arguments: Readonly<CrmInputs[Name]> },
  options: DiscoveryOptions = {},
): Promise<CrmToolResult<(typeof RECEIPT_TOOLS)[Name]>> {
  return callCrmTool(
    client,
    RECEIPT_TOOLS[original.name],
    { idempotency_key: original.arguments.idempotency_key },
    options,
  );
}
