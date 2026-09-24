# Changelog

## 0.1.0

First release.

- `@factuarea/mcp`: a local stdio server that relays every request to the hosted Factuarea
  MCP server (`https://mcp.factuarea.com`) with an API key, for clients that only launch
  local processes. Forwards cancellation and progress, keeps the server's errors exactly as
  sent, starts without a key and explains how to get one, refuses to send a key over plain
  HTTP, and reconnects after a network failure.
- MCP Registry manifest `com.factuarea/mcp`, listing the hosted endpoint and the npm package.
