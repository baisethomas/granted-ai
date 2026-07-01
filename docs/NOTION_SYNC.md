# Notion knowledgebase sync — setup

The `doc-keeper` agent (run via `/sync-docs`) publishes system-state updates to the Notion knowledgebase through the Notion API. This is a one-time setup.

## 1. Create a Notion internal integration

1. Go to https://www.notion.so/my-integrations → **New integration**.
2. Name it e.g. `Granted doc-keeper`, associate it with your workspace, give it **content read + update + insert** capabilities.
3. Copy the **Internal Integration Token** (starts with `ntn_`).

## 2. Share the knowledgebase page with the integration

Open your Notion knowledgebase page → **•••** menu → **Connections** → add the `Granted doc-keeper` integration. Without this, the API returns 404/permission errors even with a valid token.

## 3. Get the page ID

From the page URL: `https://www.notion.so/<workspace>/<Title>-<32-char-hex>` — the trailing 32-hex string is the page ID (add hyphens to UUID form if a call requires it).

## 4. Add both to `.env` (never commit)

```
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_KB_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.env` is gitignored. Do not paste the token into chat, a doc, or `.env.example`.

## 5. Verify

```bash
curl -s https://api.notion.com/v1/pages/$NOTION_KB_PAGE_ID \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" | head
```
A 200 with the page object means you're wired up. After this, `/sync-docs` can publish to Notion. If the env vars are absent, the doc-keeper falls back to printing a paste-ready block instead of failing.
