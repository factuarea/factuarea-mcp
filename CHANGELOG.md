# Changelog

## 0.1.1

### Patch Changes

- [#3](https://github.com/factuarea/factuarea-mcp/pull/3) [`a390bda`](https://github.com/factuarea/factuarea-mcp/commit/a390bdaaeefb0aebe48afb0185e34d4b990bb6f7) Thanks [@Chelu97](https://github.com/Chelu97)! - Update the README in English and Spanish for the new tasks and projects tools: the tool and domain counts, a "Tasks & projects" row in "What it covers" and an example request.

## 0.1.0

First release.

- `@factuarea/mcp`: a local stdio server that relays every request to the hosted Factuarea
  MCP server (`https://mcp.factuarea.com`) with an API key, for clients that only launch
  local processes. Forwards cancellation and progress, keeps the server's errors exactly as
  sent, starts without a key and explains how to get one, refuses to send a key over plain
  HTTP, and reconnects after a network failure.
- MCP Registry manifest `com.factuarea/mcp`, listing the hosted endpoint and the npm package.
