# Read a prospect and prepare a CRM change

This journey is conditional on the tools returned by the current connection. It does
not announce that a module is enabled, and it does not start synchronization or send
anything. Follow the [CRM skill](../SKILL.md) and each advertised schema.

## Connect and discover

Load the plugin's remote `mcp.json` in a compatible host and complete the existing
Factuarea OAuth consent for the intended company and environment. The host manages its
credentials. For stdio, configure an API key using the repository README instead.

With an already connected JavaScript MCP client:

```ts
import { discoverTools } from '@factuarea/mcp/discovery';

const tools = await discoverTools(client, {
  requestOptions: { signal: abortController.signal, timeout: 30_000 },
});
const listLeads = tools.find((tool) => tool.name === 'list_leads');
```

If the required tool is absent, explain that it is unavailable for this connection.
Do not invent another name. Without this helper, repeat `tools/list` with the returned
`nextCursor` until it is absent. A new discovery starts without a cursor.

## Read the context

If its discovered schema permits these arguments, list leads:

```json
{
  "name": "list_leads",
  "arguments": { "filters": "{}", "limit": 25 }
}
```

Parse the text content as the server's JSON envelope, then follow `data.next_cursor`
while `data.has_more` is true. Keep the filters and sort consistent between pages.
Use `find_lead` for the selected public UUID, and read available history before a
proposal. A person record can be found with `list_crm_contact_people`, using numbered
pages rather than the lead cursor. Use `list_pipelines` and `get_pipeline` to find the
actual pipeline and stage identifiers. Do not assume a default stage or owner.

## Prepare and review

For an authorized lead update, obtain the current version and send the exact fields
required by `update_lead`. For conversion, discover `preview_lead_conversion` and
`convert_lead`, then prepare the intended strategy and contact/role choices with the
native preview. Present the proposed target and consequences. A conversion uses the
selected lead's UUID, current `expected_version`, fresh `plan_hash`, and user-confirmed
effect. Include `idempotency_key` only as supported by that schema.

Preserving a lead relationship, assigning a customer role, linking an existing fiscal
contact and creating a contact are different choices. Do not choose customer status
or create an opportunity on the user's behalf just to complete a workflow.

After the authorized operation, read the changed record and report the native result.
On conflict, permission rejection or unknown timeout outcome, stop dependent effects
and use the native details to reconcile. An API-key fixture passing locally proves
relay behavior; deployed module availability, real tenant enforcement and a host's
OAuth credential/refresh flow require their own evidence.
