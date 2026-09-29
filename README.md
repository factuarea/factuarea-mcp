<p align="center">
  <a href="https://factuarea.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://docs.factuarea.com/logo/isotipo-factuarea-dark.svg">
      <img src="https://docs.factuarea.com/logo/isotipo-factuarea.svg" alt="Factuarea" width="88" height="88">
    </picture>
  </a>
</p>

<h1 align="center">Factuarea MCP</h1>

<p align="center">
  <strong>Your whole back office, one MCP server away.</strong><br>
  Invoicing with VeriFactu, purchases, catalog, tax filings, time tracking and automations<br>
  for Spanish businesses — as tools for Claude, ChatGPT, Cursor, VS Code and any MCP client.
</p>

<p align="center">
  <strong>English</strong> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@factuarea/mcp"><img src="https://img.shields.io/npm/v/@factuarea/mcp?color=465FFF&label=npm" alt="npm"></a>
  <a href="https://github.com/factuarea/factuarea-mcp/actions/workflows/ci.yml"><img src="https://github.com/factuarea/factuarea-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://registry.modelcontextprotocol.io/v0/servers?search=com.factuarea/mcp"><img src="https://img.shields.io/badge/MCP_Registry-com.factuarea%2Fmcp-465FFF" alt="MCP Registry"></a>
  <a href="https://docs.factuarea.com/mcp/tools"><img src="https://img.shields.io/badge/tools-550%2B-465FFF" alt="550+ tools"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-465FFF" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://cursor.com/en/install-mcp?name=factuarea&config=eyJ1cmwiOiJodHRwczovL21jcC5mYWN0dWFyZWEuY29tIn0="><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add Factuarea to Cursor" height="32"></a>
  <a href="https://insiders.vscode.dev/redirect/mcp/install?name=factuarea&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.factuarea.com%22%7D"><img src="https://img.shields.io/badge/VS_Code-Install_Factuarea-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install Factuarea in VS Code" height="32"></a>
</p>

---

<p align="center">
  <strong>550+</strong> tools · <strong>35</strong> domains · <strong>9</strong> fiscal guardrails · <strong>5</strong> guided workflows · <strong>live</strong> and <strong>sandbox</strong> environments
</p>

[Factuarea](https://factuarea.com) is an invoicing and management platform for businesses
and freelancers in Spain. This is its official
[Model Context Protocol](https://modelcontextprotocol.io) server — the same service the
Factuarea team runs in production, not a wrapper built on top of it. Whatever you can do in
the Factuarea dashboard or through its REST API, your agent can do in conversation: from
issuing a VeriFactu invoice to checking who clocked in this morning.

## Connect

The server lives at **`https://mcp.factuarea.com`**. Add it to your client and sign in with
your Factuarea account — no installation, no key to copy. On the consent screen you pick the
company, the environment (**live** or **test**) and exactly which permissions to grant.

| Client                       | Setup                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude** (web and desktop) | _Settings → Connectors → Add custom connector_ and paste the URL                                                                                                                    |
| **Claude Code**              | `claude mcp add --transport http factuarea https://mcp.factuarea.com`, then `/mcp` → _Authenticate_ — or install the [official plugin](https://github.com/factuarea/claude-plugins) |
| **ChatGPT**                  | Add a custom connector (developer mode) with the URL and OAuth                                                                                                                      |
| **Cursor**                   | The _Add to Cursor_ button, or `{ "mcpServers": { "factuarea": { "url": "https://mcp.factuarea.com" } } }` in `~/.cursor/mcp.json`                                                  |
| **VS Code**                  | The _Install_ button, or `{ "servers": { "factuarea": { "type": "http", "url": "https://mcp.factuarea.com" } } }` in `.vscode/mcp.json`                                             |
| **Any other client**         | Streamable HTTP with OAuth 2.1 (dynamic client registration and PKCE)                                                                                                               |

MCP access is **included in every Factuarea plan**, also during the trial.

<details>
<summary><strong>No browser available?</strong> Use an API key (scheduled jobs, CI, servers)</summary>

<br>

Create a key under [Settings → Developers → API keys](https://app.factuarea.com/settings/developers/api-keys),
choosing its scopes, and send it as a bearer token:

```bash
claude mcp add --transport http factuarea https://mcp.factuarea.com \
  --header "Authorization: Bearer fact_test_xxxxxxxxxxxxxxxxxxxxxxxx"
```

`fact_test_…` keys operate on the sandbox; `fact_live_…` keys on the real company.

</details>

<details>
<summary><strong>Client that only runs local servers?</strong> Use the npm package</summary>

<br>

`@factuarea/mcp` is a small stdio server that forwards every request to
`https://mcp.factuarea.com` with your API key. It is the setup for the Claude Desktop
configuration file, agent frameworks and any client without remote-server support.
Node 20 or later.

```json
{
  "mcpServers": {
    "factuarea": {
      "command": "npx",
      "args": ["-y", "@factuarea/mcp"],
      "env": { "FACTUAREA_API_KEY": "fact_test_xxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

| Variable                       | Meaning                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `FACTUAREA_API_KEY`            | Your API key. Without it the server still starts, and each call replies with how to create one.        |
| `FACTUAREA_MCP_URL`            | Server endpoint. Default `https://mcp.factuarea.com`; only `https://` is accepted outside `localhost`. |
| `FACTUAREA_REQUEST_TIMEOUT_MS` | Time limit per call. Default `120000`.                                                                 |

The package contains no business logic of its own: tools, rules and permissions are always
the server's, so the local and the remote connection behave the same. Versions are published
from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).

</details>

## Ask it things like

> _"Invoice Talleres Ruiz for yesterday's delivery note and email it to them."_
>
> _"Which invoices from this quarter are still unpaid? Send each customer a reminder."_
>
> _"Turn quote 2026-014 into an invoice, but move the due date to the 30th."_
>
> _"Register this supplier invoice and mark it as paid by bank transfer."_
>
> _"Raise every price in the wholesale price list by 5 %."_
>
> _"Prepare the Modelo 303 workbook for the third quarter."_
>
> _"Why didn't WooCommerce order #1042 produce an invoice?"_
>
> _"Who on the team hasn't clocked in today?"_
>
> _"Create a task in project DEV for tomorrow and assign it to Ana."_

## What it covers

|                         |                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧾 **Sales**            | Invoices from draft to paid — sending, scheduling, reminders, payments, voiding and rectificativas — plus quotes, pro-formas, signed delivery notes and recurring invoices                        |
| 📥 **Purchases**        | Supplier invoices with attachments, payments, overdue and pending lists                                                                                                                           |
| 📦 **Catalog**          | Contacts that are customers, suppliers or both; products with variants, presentations and stock; supplier offers; price lists; numbering series; taxes                                            |
| 🏛️ **Compliance**       | VeriFactu records, events and certificates; FacturaE e-invoices to public administrations through FACe; Modelo 303, 347 and 130                                                                   |
| ⏱️ **Team**             | Employees, work schedules, the working-time register required by RD-ley 8/2019, absences, presence and holidays                                                                                   |
| ✅ **Tasks & projects** | Projects with board columns and custom fields; tasks with assignees, labels, comments, attachments and subtasks; timers and time entries you can bill on an invoice; the agenda and notifications |
| ⚙️ **Automation**       | Webhooks and events, a rule engine with dry runs, WooCommerce and Shopify stores, Stripe auto-invoicing                                                                                           |
| 🏢 **Advisors**         | Managed companies for gestorías, API keys, email and request logs                                                                                                                                 |

Every tool, its domain and the permission it needs: **[docs.factuarea.com/mcp/tools](https://docs.factuarea.com/mcp/tools)**.

Alongside the tools, the server publishes **9 fiscal guides** as resources
(`factuarea://guardrails/…`: issuing, voiding versus rectifying, invoice types, lines and
amounts, VAT regime keys, series, buyer identification, VeriFactu prerequisites, multiple
companies) and **5 guided workflows** as prompts: issuing an invoice, fixing a failed one,
registering a customer by tax ID, connecting an online store and tracing an order that was
never invoiced.

## Designed for an agent that handles real money

**It will not break the fiscal record.** Some mistakes cannot be undone once an invoice
exists for the tax agency: deleting an issued invoice instead of voiding it, editing one that
is no longer a draft, annulling a rectificativa. The server refuses those calls before
anything runs, and the refusal (`mcp_guardrail_violation`) names the broken rule
(`rule_id`) and the guide that explains the right path (`guardrail_uri`), so the agent can
correct course on its own.

**A retry never creates a second invoice.** Operations that cannot be undone accept an
`idempotency_key`. If the agent repeats the call after a timeout, it gets the original
result back, marked as a replay, instead of a duplicate document.

**It only sees what you allowed.** Each credential lists only the tools its scopes permit,
and every call is checked again. Third-party apps connected through OAuth get a curated
catalog; the most sensitive operations — VeriFactu writes, GDPR erasure, payments, API keys
and managed companies — need the owner's own API key. No credential reaches data of a
company it was not granted.

**Practise on a copy first.** A test credential works on a sandbox twin of your company that
inherits its plan: nothing is sent to the AEAT, no email reaches your customers, no webhook
leaves, and FACe submissions are simulated.

## Security and privacy

OAuth 2.1 with PKCE and rotating refresh tokens; API keys shown once, stored hashed, with
optional expiry and IP allowlist; connected apps can be revoked from the dashboard.
Privacy policy: [factuarea.com/privacidad](https://factuarea.com/privacidad).
Vulnerabilities: please follow [SECURITY.md](SECURITY.md).

## More from Factuarea for developers

- **[Documentation](https://docs.factuarea.com)** — REST API reference, guides, error codes and [`llms.txt`](https://docs.factuarea.com/llms.txt)
- **SDKs** — [TypeScript](https://github.com/factuarea/factuarea-node) and [PHP](https://github.com/factuarea/factuarea-php)
- **[CLI](https://github.com/factuarea/factuarea-cli)** — the API from your terminal
- **[Claude Code plugins](https://github.com/factuarea/claude-plugins)** — this server plus skills for building an integration
- **Integrations** — [n8n](https://github.com/factuarea/factuarea-n8n-nodes) and [WooCommerce](https://github.com/factuarea/factuarea-woocommerce)

## Questions

<details>
<summary>Do I need to know how to program?</summary>

No. Connect the server in Claude or ChatGPT and ask in plain language. The API key and npm
package are only for automated setups.

</details>

<details>
<summary>Are invoices created this way valid for VeriFactu?</summary>

They are the same invoices you would create in the dashboard. If VeriFactu is enabled for
your company, Factuarea registers them with the AEAT exactly as it does for any other invoice.

</details>

<details>
<summary>Can I try it without touching my real data?</summary>

Yes: choose _test_ on the consent screen or use a `fact_test_` key. The agent then works on
an isolated sandbox company.

</details>

<details>
<summary>Can the agent see other companies I have access to?</summary>

Only the one you chose when connecting. To work with another company, connect again and
select it.

</details>

<details>
<summary>I found a bug or I'm missing a tool.</summary>

[Open an issue](https://github.com/factuarea/factuarea-mcp/issues/new/choose) — it is the
right place even when the problem is in the hosted server. For account questions, contact
[support](https://docs.factuarea.com/support).

</details>

## Contributing

This repository holds the npm package and the registry manifests; the server itself runs on
Factuarea's platform. Read [CONTRIBUTING.md](CONTRIBUTING.md) to set up the project
(and [AGENTS.md](AGENTS.md) if you work with a coding agent), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before taking part. Changes are listed in the
[CHANGELOG](CHANGELOG.md).

## License

The code in this repository is [MIT](LICENSE). Using the hosted server and Factuarea is
subject to Factuarea's terms of service.
