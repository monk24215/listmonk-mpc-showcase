# listmonk-mcp

MCP server for self-hosted Listmonk. Lists, subscribers, campaigns, templates, bounces and transactional email as MCP tools.

Status: Phase 1 tools are implemented and tested against Listmonk v6.1.0 (selftest, read tools, subscriber write round-trip, read-only mode).

## Requirements

- Node.js 18+
- Listmonk v6.x with an API user (Admin -> Users -> API user)

## Setup

```bash
npm install
npm run build
cp .env.example .env   # fill in LISTMONK_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN
npm run selftest       # verifies URL, credentials and permissions before you register the server
```

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| LISTMONK_URL | yes | | Base URL of the instance, no /api |
| LISTMONK_API_USER | yes | | API user name |
| LISTMONK_API_TOKEN | yes | | API token |
| LISTMONK_MCP_READONLY | no | false | true = write and delete tools are not registered |
| MCP_TRANSPORT | no | stdio | stdio or http |
| MCP_HTTP_PORT | no | 3100 | HTTP port |
| MCP_HTTP_TOKEN | http only | | At least 24 characters |

## Tools (current)

- System: listmonk_status, listmonk_dashboard_counts, listmonk_logs, listmonk_settings_get (secrets redacted), listmonk_smtp_test
- Lists: lists_list, list_get, list_create, list_update, list_delete
- Subscribers: subscribers_search, subscriber_get, subscriber_create, subscriber_update, subscribers_lists_change, subscriber_delete
- Campaigns: campaigns_search, campaign_get, campaign_create, campaign_update, campaign_set_status, campaign_test_send, campaign_delete
- Templates: templates_list, template_get, template_create, template_update, template_delete
- Bounces: bounces_search, bounce_get, bounce_delete
- Transactional: tx_send

Read-only mode registers 14 tools (all read tools). Read-write registers 32.

Note: campaign_set_status with "running" sends email to every recipient immediately.

The full planned set is in TOOL-SPEC.md.

## Security

- Credentials come from environment variables only.
- Settings output redacts any key containing pass, secret, token, key or cred.
- Over HTTP, the /mcp/<token> URL is itself the secret. Treat it like a password.

## License

MIT