import type { DiscoveredTool } from '../../src/discovery.js';

export const LEAD_ID = '019ba420-1000-7000-8000-000000000001';
export const PERSON_ID = '019ba420-1000-7000-8000-000000000002';
export const PIPELINE_ID = '019ba420-1000-7000-8000-000000000003';

// Representative upstream descriptors. These fixtures never register client-side tools
// or claim that a deployed server has enabled a module for a particular credential.
export const LEADS_TOOL: DiscoveredTool = {
  name: 'list_leads',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      cursor: { type: 'string', maxLength: 4096 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      filters: { type: 'string', maxLength: 65536 },
      search: { type: 'string', maxLength: 255 },
      sort: {
        type: 'string',
        enum: ['uuid', '-uuid', 'created_at', '-created_at', 'updated_at', '-updated_at', 'score', '-score'],
      },
    },
  },
  annotations: { readOnlyHint: true },
  'x-native-extension': { retain: true },
};

export const PEOPLE_TOOL: DiscoveredTool = {
  name: 'list_crm_contact_people',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, maximum: 2147483647 },
      per_page: { type: 'integer', minimum: 1, maximum: 100 },
      typed_filters: { type: 'string', maxLength: 262144 },
    },
  },
};

export const PIPELINES_TOOL: DiscoveredTool = {
  name: 'list_pipelines',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: { type: 'string', maxLength: 255 },
      status: { type: 'string', enum: ['active', 'archived', 'all'] },
      team_id: { type: 'string', format: 'uuid' },
      sort: { type: 'string', enum: ['name_asc', 'name_desc', 'created_asc', 'created_desc'] },
      cursor: { type: 'string', minLength: 1, maxLength: 32768 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};

export const CONVERT_TOOL: DiscoveredTool = {
  name: 'convert_lead',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      expected_version: { type: 'integer', minimum: 1, maximum: 4294967295 },
      strategy: { type: 'string', enum: ['link_existing', 'create_contact'] },
      plan_hash: { type: 'string', minLength: 64, maxLength: 64, pattern: '^[0-9a-f]{64}$' },
      confirmed: { type: 'boolean' },
      idempotency_key: { type: 'string', minLength: 1, maxLength: 255, pattern: '^[ -~]+$' },
    },
    required: ['id', 'expected_version', 'strategy', 'plan_hash', 'confirmed'],
  },
};

export const SCOPE_ERROR = {
  code: -32005,
  message: 'insufficient_scope',
  data: {
    code: 'insufficient_scope',
    http_status: 403,
    required_scope: 'crm_leads:write',
    provided_scopes: ['crm_leads:read'],
    hint: 'La credencial no dispone del scope requerido.',
  },
};

export function nativeError(error: { code: number; message: string; data: Record<string, unknown> }): never {
  throw Object.assign(new Error(error.message), { code: error.code, data: error.data });
}
