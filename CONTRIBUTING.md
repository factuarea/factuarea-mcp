# Contributing

Thanks for helping. Bug reports, fixes and documentation improvements are all welcome.

## Where a problem belongs

This repository holds two things: the local stdio bridge published as `@factuarea/mcp`,
and the manifest that lists the server in the MCP Registry. The tools themselves — their
names, schemas, guardrails, scopes and results — are served by the hosted server at
`https://mcp.factuarea.com`, which is part of the Factuarea platform and is not in this
repository.

Open an issue here either way. If a tool misbehaves, say which one, what you sent and what
came back (with the `code` of any error); we route it to the hosted server. Never paste an
API key, and prefer a `fact_test_` key when you reproduce something.

## Layout

```
src/
  index.ts      CLI entry: flags, configuration, stdio transport, shutdown
  config.ts     environment variables → BridgeConfig, with validation
  defaults.ts   every default value, in one place
  bridge.ts     the local MCP server and the relay of each request
  upstream.ts   the connection to the hosted server (lazy, retried on failure)
  errors.ts     how an upstream failure becomes the error the local client sees
tests/
  support/fake-upstream.ts   an in-process stand-in for the hosted server
scripts/
  smoke-stdio.mjs      boots the build over stdio with no credentials
  verify-package.mjs   checks what `npm publish` would ship
  sync-manifest.mjs    keeps server.json on the package version
server.json     the MCP Registry manifest (com.factuarea/mcp)
```

## Development

The toolchain needs **Node 22.12 or newer** (`.nvmrc`); the published package runs on
Node 20 and later.

```bash
npm ci
npm test               # unit and relay tests
npm run typecheck
npm run lint
npm run format         # prettier --write
npm run build
npm run smoke          # the built server, over stdio, with no key
npm run inspect        # MCP Inspector against the local build
```

To try the bridge against a real account, set `FACTUAREA_API_KEY` to a `fact_test_` key
and run `npm run inspect`, or point `FACTUAREA_MCP_URL` at another deployment.

## Conventions that matter

- **No business logic in the bridge.** It relays; it does not validate invoices, rename
  tools, or rewrite results. Anything fiscal belongs in the hosted server, where the REST
  API and the dashboard share it.
- **Pass things through untouched.** Results are forwarded as the server wrote them and
  errors keep their `code`, `message` and `data`. The only exception is an authentication
  failure, which gains a sentence about fixing `FACTUAREA_API_KEY`.
- **stdout is the protocol.** Diagnostics go to stderr.
- **One place per default.** New defaults go in `src/defaults.ts`; a new environment
  variable goes in `src/config.ts`, `server.json` and the table of both READMEs — the tests
  check that they agree.
- **Two READMEs.** `README.md` and `README.es.md` carry the same content in English and
  Spanish; update both in the same pull request.
- **Tests for behaviour.** A change in what the bridge does comes with a test against the
  fake upstream in `tests/`.

## Pull requests

- Keep a pull request to one change, and describe the behaviour before and after.
- Add a changeset (`npx changeset`) when the change affects the published package;
  documentation-only and CI-only changes do not need one.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
  (`fix:`, `feat:`, `docs:`, `chore:`…).
- CI must be green: typecheck, lint, formatting, tests, build, package contents, the stdio
  smoke test on Node 20, 22 and 24, and the registry's validation of `server.json`.

## Releases

Releases are automated by [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Merged changesets are collected into a **Version Packages** pull request, which bumps
   `package.json`, `server.json` and `CHANGELOG.md` together.
2. Merging it publishes `@factuarea/mcp` to npm with provenance through Trusted
   Publishing, creates the GitHub release, and announces the version to the MCP Registry
   as `com.factuarea/mcp`.

### One-time setup

- **npm.** Trusted Publishing can only be attached to a package that exists, so the first
  version is published by hand by an owner of the `@factuarea` npm organisation
  (`npm publish --access public`). Then, on npmjs.com, add a Trusted Publisher for
  `@factuarea/mcp`: owner `factuarea`, repository `factuarea-mcp`, workflow `release.yml`.
- **MCP Registry.** The `com.factuarea/*` namespace is proven with a DNS record. Generate
  an Ed25519 key pair, publish a TXT record on the apex `factuarea.com` with the value
  `v=MCPv1; k=ed25519; p=<public key in base64>`, and store the private key (hex) as the
  repository secret `MCP_REGISTRY_PRIVATE_KEY`. The record goes on the apex, not on a
  subdomain, and a stale record must be removed when the key rotates.

If a release publishes to npm but the registry step fails, the version is already on npm:
fix the key or the secret and run `mcp-publisher login dns …` and `mcp-publisher publish`
from a checkout of the release commit.

## Code of conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
