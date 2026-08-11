# Smart Todo for ChatGPT and Claude

Connect Smart Todo once, then ask ChatGPT or Claude to review requests, update a site, open its preview, and deploy it.

## Connect

Use this server URL:

```text
https://cowork-api.dnalevity.com/mcp
```

Smart Todo opens its own sign-in page during connection. Sign in with the same email and password you use at [Smart Todo](https://smart-todo.dnalevity.com), review the permissions, and choose **Connect Smart Todo**.

No OpenAI or Anthropic API key is required. ChatGPT or Claude continues to use the model access included with the account where the conversation is running. The Smart Todo server receives only a short-lived, scoped Smart Todo access token; it never receives the user's ChatGPT or Claude password, session token, or API key.

### ChatGPT

1. Open **Settings** and enable **Developer mode** under the advanced app/plugin settings.
2. Create a new app/plugin and enter the Smart Todo server URL above.
3. Review the discovered tools and connect the Smart Todo account.
4. Refresh the app/plugin after its tool definitions change.

Current OpenAI availability varies by plan and workspace policy. Full custom MCP write actions are documented for Business, Enterprise, and Edu workspaces; other plans may expose only read tools. See [Developer mode and full MCP connectors in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt).

### Claude

1. Open **Customize → Connectors**.
2. Choose **Add custom connector** and enter the Smart Todo server URL above.
3. Choose **Connect**, sign in to Smart Todo, and approve the requested permissions.

For Team or Enterprise, an owner first adds the connector in organization settings; each member then connects their own Smart Todo account. See [Claude custom connector setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## What it can do

The default user tools cover the actions available in Smart Todo:

- see the connected account and accessible sites;
- search, list, and inspect requests;
- create a site-update request and reply to it;
- cancel, retry, or archive a request;
- remove or reprioritize a queued reply;
- inspect repository, branch, preview, and change status;
- let the connected ChatGPT or Claude model search and read tracked, non-sensitive tenant source files and apply a bounded unified patch;
- start a preview or sync the configured branch;
- discard local changes only with explicit destructive permission and the exact reviewed workspace revision;
- commit, push, and deploy only with explicit deployment permission and the exact reviewed workspace revision.

Administrators can separately approve tools for sites, memberships, users, and the audit log. Admin access is still checked against the user's current Smart Todo roles on every call.

The assistant should normally call `smart_todo_list_sites`, choose the returned `tenant_id`, submit or review the update, inspect `smart_todo_get_site_status`, and call `smart_todo_deploy_site` only after the user explicitly asks to deploy.

## Account and model boundary

The conversation, reasoning, and direct file-edit tool decisions use the connected person's ChatGPT or Claude account automatically. Those account credentials are not transferable to an MCP server.

There are two update paths:

- Direct conversational updates use `smart_todo_search_site_files`, `smart_todo_read_site_file`, and `smart_todo_apply_site_patch`. The connected ChatGPT or Claude model does the reasoning and Smart Todo only performs bounded source operations. Repository scripts are never executed through MCP.
- `smart_todo_create_request` starts Cowork's server-side coding agent for the existing asynchronous Smart Todo workflow. That separate coding process uses Cowork's configured model account.

A ChatGPT or Claude subscription is not an API credential and cannot be forwarded to Smart Todo. No host session token is copied or stored.

## Security model

- OAuth 2.1 authorization code flow with PKCE `S256`.
- Dynamic client registration for ChatGPT and Claude compatibility.
- Exact redirect URI and MCP resource validation.
- Fifteen-minute access tokens and rotating refresh tokens.
- Authorization codes, access tokens, and refresh tokens are stored only as SHA-256 hashes.
- Refresh-token reuse revokes the entire token family.
- Current user status, tenant membership, tenant role, and enabled site actions are checked at call time.
- Global administration is restricted to Smart Todo's configured bootstrap administrator; a tenant owner cannot use MCP to enumerate or alter other tenants.
- OAuth access tokens are accepted only at `/mcp`; they cannot be replayed against the normal Smart Todo browser API.
- Read, write, preview, sync, discard, deploy, and admin capabilities use separate scopes.
- Direct source access has its own consent scope and is limited to tracked, non-sensitive text files. It rejects hidden files, secrets, execution-control files, absolute paths, traversal, Git metadata, binaries, symlinks, submodules, and paths outside the tenant repository. Patches require deployment to be enabled for that tenant and must be bounded unified diffs.
- Applying a direct MCP patch stops the tenant's Cowork preview and permanently marks the checkout as untrusted. Cowork will not execute that source in preview, even after deployment or a later discard. Preview becomes available again only after a trusted operator reviews the checkout and manually clears the server-side marker.
- Patch, discard, and deploy operations compare the reviewed Git head and content digest, reject drift, and serialize workspace actions.

The implementation follows the [OpenAI plugin authentication guidance](https://developers.openai.com/plugins/build/auth), [Claude connector authentication guidance](https://claude.com/docs/connectors/building/authentication), and the [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Production configuration

The MCP and authorization server run with the Cowork API. These environment variables are optional when using the production URLs above:

```text
SMART_TODO_MCP_ISSUER=https://cowork-api.dnalevity.com
SMART_TODO_MCP_RESOURCE=https://cowork-api.dnalevity.com/mcp
SMART_TODO_MCP_APP_URL=https://smart-todo.dnalevity.com
SMART_TODO_MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://claude.ai
SMART_TODO_MCP_ACCESS_TTL_SECONDS=900
SMART_TODO_MCP_REFRESH_TTL_SECONDS=2592000
```

Local OAuth testing should override both issuer and resource with the exact HTTPS address exposed to the MCP client. The `resource` value must include `/mcp` and must match the URL entered in ChatGPT or Claude.

## Verification

From the Cowork repository:

```bash
python3 -m py_compile dashboard_server.py smart_todo_mcp.py portal_multi_tenant.py
python3 -m unittest discover -s tests -p 'test_smart_todo_mcp.py' -v
```

Then use MCP Inspector with the public or tunneled `/mcp` URL to verify authorization, initialization, tool listing, representative reads, and explicit write approvals before publishing changes.
