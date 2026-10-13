import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/** Wire fixtures for existing owner operations; not a local discovery catalogue or business implementation. */
export interface CrmWireFixture {
  tool: Tool & { 'x-relay-fixture': { revision: number; source: 'owner-contract' } };
  scope: string;
  arguments: Record<string, unknown>;
}

export const UUID = {
  opportunity: '019fb222-2222-7222-8222-222222222222',
  document: '019fb222-2222-7222-8222-111111111111',
  producer: '019fb222-2222-7222-8222-333333333333',
  ticket: '019fb222-2222-7222-8222-444444444444',
  other: '019fb222-2222-7222-8222-555555555555',
} as const;

const uuid = {
  type: 'string',
  format: 'uuid',
  pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
};
const opaqueUuid = { type: 'string', format: 'uuid' };
const version = { type: 'integer', minimum: 1 };
const documentVersion = { ...version, maximum: Number('9223372036854775806') };
const idempotencyKey = { type: 'string', minLength: 1, maxLength: 255, pattern: '^[ -~]+$' };

function fixture(
  name: string,
  scope: string,
  properties: NonNullable<Tool['inputSchema']['properties']>,
  required: string[],
  args: Record<string, unknown>,
  write = false,
): CrmWireFixture {
  return {
    scope,
    tool: {
      name,
      inputSchema: {
        type: 'object',
        properties: write ? { ...properties, idempotency_key: idempotencyKey } : properties,
        required,
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: !write,
        destructiveHint: false,
        idempotentHint: !write,
        openWorldHint: false,
      },
      // A deliberate extension proves the generic relay preserves fields it does not model.
      'x-relay-fixture': { revision: 1, source: 'owner-contract' },
    },
    arguments: args,
  };
}

export const CRM_WIRE_FIXTURES: CrmWireFixture[] = [
  fixture(
    'list_commercial_documents',
    'crm_documents:read',
    {
      search: { type: ['string', 'null'], maxLength: 255 },
      page: documentVersion,
      per_page: { type: 'integer', minimum: 1, maximum: 100 },
      sort: { type: 'string', enum: ['id', 'title', 'version'] },
      archived: { type: 'boolean' },
    },
    [],
    { search: null, page: 2, per_page: 10, sort: 'id', archived: false },
  ),
  fixture('get_commercial_document', 'crm_documents:read', { id: uuid }, ['id'], { id: UUID.document }),
  fixture(
    'upload_commercial_document',
    'crm_documents:write',
    {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      producer_reference_id: uuid,
      claimed_mime: { type: 'string', minLength: 1, maxLength: 255 },
    },
    ['title', 'producer_reference_id', 'claimed_mime'],
    {
      title: 'Documento comercial',
      producer_reference_id: UUID.producer,
      claimed_mime: 'application/pdf',
      idempotency_key: 'document-upload-original',
    },
    true,
  ),
  fixture(
    'replace_commercial_document_version',
    'crm_documents:write',
    {
      expected_version: documentVersion,
      producer_reference_id: uuid,
      claimed_mime: { type: 'string', minLength: 1, maxLength: 255 },
      id: uuid,
    },
    ['expected_version', 'producer_reference_id', 'claimed_mime', 'id'],
    {
      expected_version: 7,
      producer_reference_id: UUID.producer,
      claimed_mime: 'application/pdf',
      id: UUID.document,
      idempotency_key: 'replace-original',
    },
    true,
  ),
  fixture(
    'share_commercial_document',
    'crm_documents:write',
    {
      expected_version: documentVersion,
      grant_type: { type: 'string', enum: ['user', 'team'] },
      grantee_id: opaqueUuid,
      expires_at: { type: ['string', 'null'], format: 'date-time' },
      id: uuid,
    },
    ['expected_version', 'grant_type', 'grantee_id', 'id'],
    {
      expected_version: 7,
      grant_type: 'user',
      grantee_id: UUID.other,
      expires_at: null,
      id: UUID.document,
      idempotency_key: 'share-original',
    },
    true,
  ),
  fixture(
    'revoke_commercial_document_share',
    'crm_documents:write',
    { expected_version: documentVersion, share_id: uuid, id: uuid },
    ['expected_version', 'share_id', 'id'],
    { expected_version: 7, share_id: UUID.other, id: UUID.document, idempotency_key: 'revoke-original' },
    true,
  ),
  fixture(
    'archive_commercial_document',
    'crm_documents:write',
    { expected_version: documentVersion, id: uuid },
    ['expected_version', 'id'],
    { expected_version: 7, id: UUID.document, idempotency_key: 'archive-original' },
    true,
  ),
  fixture(
    'list_opportunity_documents',
    'crm_opportunitydocuments:read',
    {
      id: uuid,
      filters: { type: 'string', maxLength: 262144, contentMediaType: 'application/json' },
      cursor: { type: 'string', minLength: 1, maxLength: 8192 },
      limit: version,
    },
    ['id'],
    {
      id: UUID.opportunity,
      filters: '{"document_type":"quote","is_primary":false}',
      cursor: 'owner-cursor%2B/opaque',
      limit: 25,
    },
  ),
  fixture(
    'list_opportunity_document_candidates',
    'crm_opportunitydocuments:read',
    {
      document_type: { type: 'string', enum: ['quote', 'invoice', 'contract', 'recurring_schedule'] },
      search: { type: 'string', maxLength: 100, default: '' },
      cursor: { type: ['string', 'null'], minLength: 1, maxLength: 32768 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      id: {
        ...uuid,
        pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
      },
    },
    ['document_type', 'id'],
    { document_type: 'quote', search: '', cursor: null, limit: 25, id: UUID.opportunity },
  ),
  fixture(
    'create_opportunity_quote',
    'crm_opportunitydocuments:write',
    {
      id: uuid,
      contact_id: { anyOf: [uuid, { type: 'null' }] },
      quote_draft: {
        type: 'object',
        additionalProperties: false,
        properties: {
          date: { type: 'string', format: 'date' },
          expiry_date: { type: ['string', 'null'], format: 'date' },
          recipient: {
            type: 'object',
            additionalProperties: false,
            required: ['kind'],
            properties: {
              kind: { type: 'string', enum: ['unassigned', 'commercial_counterparty', 'business_contact'] },
              id: { anyOf: [uuid, { type: 'null' }] },
            },
            oneOf: [
              { properties: { kind: { const: 'unassigned' }, id: { type: 'null' } } },
              { properties: { kind: { const: 'commercial_counterparty' }, id: uuid }, required: ['id'] },
              { properties: { kind: { const: 'business_contact' }, id: uuid }, required: ['id'] },
            ],
          },
          series_id: { anyOf: [opaqueUuid, { type: 'null' }] },
          client_id: { anyOf: [opaqueUuid, { type: 'null' }] },
          notes: { type: ['string', 'null'] },
          terms: { type: ['string', 'null'] },
          expected_root_version: version,
          expected_line_version: version,
        },
        required: ['date', 'recipient'],
      },
    },
    ['id', 'quote_draft'],
    {
      id: UUID.opportunity,
      contact_id: null,
      quote_draft: {
        date: '2026-10-09',
        recipient: { kind: 'unassigned', id: null },
        notes: null,
        terms: '',
        expected_root_version: 7,
        expected_line_version: 3,
      },
      idempotency_key: 'quote-original',
    },
    true,
  ),
  fixture(
    'link_opportunity_document',
    'crm_opportunitydocuments:write',
    {
      id: uuid,
      document_type: { type: 'string', enum: ['quote', 'invoice', 'contract', 'recurring_schedule'] },
      document_id: opaqueUuid,
      is_primary: { type: 'boolean' },
    },
    ['id', 'document_type', 'document_id', 'is_primary'],
    {
      id: UUID.opportunity,
      document_type: 'quote',
      document_id: UUID.document,
      is_primary: false,
      idempotency_key: 'link-original',
    },
    true,
  ),
  fixture(
    'unlink_opportunity_document',
    'crm_opportunitydocuments:write',
    { id: uuid, expected_version: version, link_id: uuid },
    ['id', 'expected_version', 'link_id'],
    { id: UUID.opportunity, expected_version: 7, link_id: UUID.other, idempotency_key: 'unlink-original' },
    true,
  ),
  fixture('get_opportunity_financial_summary', 'crm_opportunitydocuments:read', { id: uuid }, ['id'], {
    id: UUID.opportunity,
  }),
  fixture(
    'move_service_ticket_to_stage',
    'customer_service:write',
    {
      id: uuid,
      expected_version: version,
      pipeline_id: uuid,
      stage_id: uuid,
      waiting_reason: { anyOf: [{ type: 'string', enum: ['waiting_customer'] }, { type: 'null' }] },
      customer_message_id: { anyOf: [uuid, { type: 'null' }] },
    },
    ['id', 'expected_version', 'pipeline_id', 'stage_id'],
    {
      id: UUID.ticket,
      expected_version: 7,
      pipeline_id: UUID.producer,
      stage_id: UUID.other,
      waiting_reason: null,
      customer_message_id: UUID.document,
      idempotency_key: 'stage-original',
    },
    true,
  ),
  fixture(
    'attach_service_ticket_document',
    'customer_service:write',
    { id: uuid, expected_version: version, document_id: uuid, document_version: version },
    ['id', 'expected_version', 'document_id', 'document_version'],
    {
      id: UUID.ticket,
      expected_version: 7,
      document_id: UUID.document,
      document_version: 3,
      idempotency_key: 'attachment-original',
    },
    true,
  ),
  fixture(
    'detach_service_ticket_document',
    'customer_service:write',
    { id: uuid, expected_version: version, attachment_id: uuid },
    ['id', 'expected_version', 'attachment_id'],
    { id: UUID.ticket, expected_version: 7, attachment_id: UUID.other, idempotency_key: 'detachment-original' },
    true,
  ),
];

/** Fixtures of implemented hosted Native Original read tools; the relay does not register them locally. */
export const CRM_NATIVE_READ_FIXTURES: CrmWireFixture[] = [
  fixture('get_crm_credential_context', 'crm_access_context:read', {}, [], {}),
  ...[
    ['get_lead_create_original', 'crm_leads:write'],
    ['get_opportunity_create_original', 'crm_opportunities:write'],
    ['get_crm_activity_create_original', 'crm_activities:write'],
    ['get_opportunity_stage_original', 'crm_opportunities:write'],
  ].map(([name, scope]) =>
    fixture(
      name!,
      scope!,
      {
        idempotency_key: idempotencyKey,
        original_body_sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
        ...(name === 'get_opportunity_stage_original' ? { id: uuid } : {}),
      },
      ['idempotency_key', 'original_body_sha256', ...(name === 'get_opportunity_stage_original' ? ['id'] : [])],
      {
        idempotency_key: 'retained original intent',
        original_body_sha256: 'a'.repeat(64),
        ...(name === 'get_opportunity_stage_original' ? { id: UUID.opportunity } : {}),
      },
    ),
  ),
];
