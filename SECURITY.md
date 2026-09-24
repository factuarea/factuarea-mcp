# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Email
**info@factuarea.com** with "Security" in the subject and include:

- what is affected — this package, the hosted server at `https://mcp.factuarea.com`, the
  OAuth flow, or another part of Factuarea;
- the steps to reproduce it, and the impact you expect;
- whether it has been disclosed anywhere else.

We will confirm that we received your report, keep you informed while we work on a fix,
and are happy to credit you in the release notes if you wish. Please give us a reasonable
time to fix the problem before disclosing it.

## Scope

This repository contains the local stdio bridge `@factuarea/mcp` and the MCP Registry
manifest. The hosted server, the REST API and the rest of Factuarea are covered by the same
address: report them there too.

Out of scope: reports that need a compromised device or an already-leaked API key, rate
limits that work as documented, and findings from automated scanners without a
demonstrated impact.

## Supported versions

Security fixes land in the latest published version of `@factuarea/mcp`. The hosted server
is always the current version.

## Handling API keys

An API key is a password for your company's invoicing. Keep it in the MCP client's
environment configuration, never in a repository or a shared file; use a `fact_test_` key
for development; give each key only the scopes it needs; and revoke it at
[Settings → Developers → API keys](https://app.factuarea.com/settings/developers/api-keys)
the moment you suspect it leaked.
