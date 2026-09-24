import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridge } from './bridge.js';
import { ConfigError, loadConfig } from './config.js';
import { API_KEYS_URL, DEFAULT_MCP_URL, DEFAULT_TIMEOUT_MS, DOCS_URL, VERSION } from './defaults.js';

const USAGE = `factuarea-mcp ${VERSION}

Local stdio bridge to the hosted Factuarea MCP server (${DEFAULT_MCP_URL}).
Run it from an MCP client; it speaks JSON-RPC on stdin/stdout.

Environment:
  FACTUAREA_API_KEY             API key (fact_live_… or fact_test_…). Create one at
                                ${API_KEYS_URL}
  FACTUAREA_MCP_URL             Server endpoint. Default ${DEFAULT_MCP_URL}
  FACTUAREA_REQUEST_TIMEOUT_MS  Ceiling for a single call. Default ${DEFAULT_TIMEOUT_MS}

Docs: ${DOCS_URL}
`;

function log(line: string): void {
  process.stderr.write(`[factuarea-mcp] ${line}\n`);
}

async function main(argv: string[]): Promise<void> {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      log(error.message);
      process.exitCode = 2;
      return;
    }
    throw error;
  }

  const bridge = await createBridge({ config, log });
  const transport = new StdioServerTransport();

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await bridge.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // The client closing our stdin is the normal way a stdio server is told to stop.
  process.stdin.on('end', shutdown);

  await bridge.server.connect(transport);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  log(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
