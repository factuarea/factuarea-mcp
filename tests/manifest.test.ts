import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MCP_URL, DEFAULT_TIMEOUT_MS } from '../src/defaults.js';

// The registry refuses a version it already holds and checks the npm package's `mcpName`
// against the manifest's name, so a drift here fails a release halfway, after npm has
// already published. These assertions move that failure to the pull request.

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  name: string;
  version: string;
  mcpName: string;
};

interface EnvironmentVariable {
  name: string;
  description: string;
  isRequired: boolean;
  isSecret: boolean;
}

const manifest = JSON.parse(readFileSync('server.json', 'utf8')) as {
  name: string;
  description: string;
  version: string;
  remotes: Array<{ type: string; url: string }>;
  packages: Array<{
    registryType: string;
    identifier: string;
    version: string;
    transport: { type: string };
    environmentVariables: EnvironmentVariable[];
  }>;
};

const plugin = JSON.parse(readFileSync('plugin.json', 'utf8')) as {
  $schema: string;
  name: string;
  version: string;
  extensions: {
    'io.modelcontextprotocol': { servers: Array<Record<string, unknown>> };
    'com.factuarea': { registryName: string };
  };
};

const configSource = readFileSync('src/config.ts', 'utf8');

describe('server.json', () => {
  it('carries the registry name the npm package claims', () => {
    expect(manifest.name).toBe(pkg.mcpName);
  });

  it('is released at the package version, for both the entry and its npm package', () => {
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.packages).toHaveLength(1);
    expect(manifest.packages[0]).toMatchObject({
      registryType: 'npm',
      identifier: pkg.name,
      version: pkg.version,
      transport: { type: 'stdio' },
    });
  });

  it('points the remote at the canonical endpoint the bridge defaults to', () => {
    expect(manifest.remotes).toEqual([{ type: 'streamable-http', url: DEFAULT_MCP_URL }]);
  });

  it('keeps the description within the registry limit', () => {
    expect(manifest.description.length).toBeLessThanOrEqual(100);
  });

  it('declares exactly the environment variables the bridge reads', () => {
    const declared = manifest.packages[0]!.environmentVariables.map((variable) => variable.name).sort();
    const read = [...configSource.matchAll(/env\.(FACTUAREA_[A-Z_]+)/g)].map((match) => match[1]);

    expect(declared).toEqual([...new Set(read)].sort());
  });

  it('marks only the API key as required and secret, and documents the real timeout default', () => {
    const [apiKey, ...optional] = manifest.packages[0]!.environmentVariables;

    expect(apiKey).toMatchObject({ name: 'FACTUAREA_API_KEY', isRequired: true, isSecret: true });
    for (const variable of optional) expect(variable).toMatchObject({ isRequired: false, isSecret: false });
    expect(optional.find((v) => v.name === 'FACTUAREA_REQUEST_TIMEOUT_MS')?.description).toContain(
      String(DEFAULT_TIMEOUT_MS),
    );
  });
});

describe('plugin.json', () => {
  it('follows the Agent Plugins 1.0.0 manifest', () => {
    expect(plugin.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(plugin.name).toMatch(/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
  });

  it('is released at the package version and names the same registry entry', () => {
    expect(plugin.version).toBe(pkg.version);
    expect(plugin.extensions['com.factuarea'].registryName).toBe(manifest.name);
  });

  it('declares the same two ways to connect as server.json', () => {
    const [remote, local] = plugin.extensions['io.modelcontextprotocol'].servers;

    expect(remote).toMatchObject({ transport: 'streamable-http', url: DEFAULT_MCP_URL });
    expect(local).toMatchObject({ transport: 'stdio', command: 'npx', args: ['-y', pkg.name] });
  });
});
