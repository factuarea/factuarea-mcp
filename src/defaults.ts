/** Every default lives here, so none is written twice. */

/** Canonical endpoint of the hosted Factuarea MCP server. */
export const DEFAULT_MCP_URL = 'https://mcp.factuarea.com';

/** Hard ceiling on a single forwarded request. Bulk PDF and report tools can take a while. */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Where an account owner creates or rotates an API key. */
export const API_KEYS_URL = 'https://app.factuarea.com/settings/developers/api-keys';

/** Human documentation for connecting a client. */
export const DOCS_URL = 'https://docs.factuarea.com/mcp';

/** Name this bridge announces, both to the local client and to the hosted server. */
export const SERVER_NAME = 'factuarea';

/** Replaced at build time with the version in package.json. */
declare const __VERSION__: string;
export const VERSION: string = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0-dev';
