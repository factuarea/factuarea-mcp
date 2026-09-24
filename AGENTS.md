# AGENTS.md

Guidance for coding agents working on this repository. Humans will find it useful too;
[CONTRIBUTING.md](CONTRIBUTING.md) has the full picture.

## What this repository is

- `@factuarea/mcp`: a **local stdio MCP server that relays** every request to the hosted
  Factuarea MCP server (`https://mcp.factuarea.com`), authenticated with an API key.
- `server.json`: the MCP Registry manifest for `com.factuarea/mcp`.

The tools, their schemas, the fiscal guardrails, scopes and idempotency live in the hosted
server, which is **not** in this repository. Do not re-implement any of them here.

## Commands

Node 22.12+ for development (`.nvmrc`).

| Task             | Command                                   |
| ---------------- | ----------------------------------------- |
| Install          | `npm ci`                                  |
| Tests            | `npm test`                                |
| Types            | `npm run typecheck`                       |
| Lint / format    | `npm run lint` · `npm run format`         |
| Build            | `npm run build`                           |
| Stdio smoke test | `npm run build && npm run smoke`          |
| Package contents | `npm run build && npm run verify:package` |

Before handing work back, run tests, typecheck, lint and `npm run format:check`; if you
touched `src/`, also build and run the smoke test.

## Rules

1. **Relay, do not interpret.** Forward requests and results as they are. Errors keep the
   hosted server's `code`, `message` and `data`; the one deliberate addition is the
   `FACTUAREA_API_KEY` hint on authentication failures (`src/errors.ts`).
2. **Never write to stdout** outside the MCP transport — it corrupts the protocol. Log to
   stderr through the `log` callback.
3. **Defaults live in `src/defaults.ts`.** A new environment variable must be read in
   `src/config.ts`, declared in `server.json` and documented in both READMEs
   (`README.md` and `README.es.md`); the tests in `tests/manifest.test.ts` and
   `tests/docs.test.ts` fail otherwise.
4. **Do not hand-edit versions.** `package.json`, `server.json` and `CHANGELOG.md` are
   bumped together by Changesets. Add a changeset (`npx changeset`) for any change to the
   published package.
5. **Test behaviour against the fake upstream** (`tests/support/fake-upstream.ts`), not
   against production. Never call `https://mcp.factuarea.com` from tests.
6. **Secrets.** Never commit an API key, a registry private key or an `.env` file. Use
   placeholders such as `fact_test_xxxxxxxxxxxxxxxxxxxxxxxx` in docs and tests.
7. **Two READMEs, one content.** `README.md` (English) and `README.es.md` (Spanish) say
   the same thing; a change to one is made to the other in the same pull request. Every
   other document is in English, apart from Spanish names that belong to the product
   (tool titles, guardrails, prompts).
8. **Stay within the public documentation.** The README describes what
   [docs.factuarea.com](https://docs.factuarea.com) already publishes. Do not document
   internals of the hosted server (its code, tests, infrastructure or unreleased features)
   here; link to the portal instead of copying long catalogues.

## This repository is public

Commits, pull requests, issues and reviews are permanent and visible to everyone, and
GitHub keeps earlier edits of a pull request description. Write them about the change:

- No secrets and no customer data — not even in a failing test's output.
- No hostnames, accounts or settings of our infrastructure beyond the public endpoints
  (`mcp.factuarea.com`, `app.factuarea.com`, `docs.factuarea.com`).
- No references to private repositories, their issues or pull requests, internal tickets
  or conversations.
- No business context: customers, plans under negotiation, revenue, team matters.
- Commits and pull requests carry no tool attribution: no `Co-Authored-By` trailers for
  tools, no "generated with" footers, no session links. The author is whoever submits the
  change and answers for it.

## Useful references

- MCP guide: <https://docs.factuarea.com/mcp>
- Tool catalog: <https://docs.factuarea.com/mcp/tools>
- MCP error codes: <https://docs.factuarea.com/errors/index-mcp>
- Documentation for agents: <https://docs.factuarea.com/llms.txt>
- MCP TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>
