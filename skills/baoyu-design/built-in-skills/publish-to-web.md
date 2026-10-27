---
name: "publish-to-web"
description: "Publish to the web\nShare a finished design at a public HTTPS link"
---
# Publish to the web

Put a finished design on a public `https://<slug>.deed.page/` URL so the user can send a link to a teammate, client, or phone. Only do this when the user asks for a shareable or hosted link. Anything published is public, so never publish designs that contain private, customer, or unreleased material unless the user confirms it is fine.

deed.page is a static host with no account or API key. It is a third-party service: the file is uploaded to its servers.

## Process

1. **Make the file self-contained first.** Follow [Save as standalone HTML](save-as-standalone-html.md) to produce `export/<name>.html`. A published copy can't reach the project's relative JSX, images, fonts or `_ds/` folders, so publish the bundled file, not the working design.
2. **Pick a slug.** Lowercase letters, digits and hyphens, 1–63 characters. Add a random suffix so it is unlikely to be taken, e.g. `pricing-page-7f3a2c`.
3. **Publish.** If the harness has a deed.page MCP server connected (`https://deed.page/mcp`), call its `publish_site` tool with the slug and the bundled HTML as `index.html`. Otherwise use the HTTP API:

   ```bash
   curl -sS -T export/<name>.html "https://deed.page/v1/sites?slug=<slug>" -H "X-Client: baoyu-design"
   ```

   Add `-H "X-Ttl: 86400"` for a link that expires after a day (seconds).
4. **Answer the user** with the `url` from the response. A first publish also returns a `token`. It is the only key that can update or delete the page, so hand it to the user and tell them to keep it. Never write it into a design file, `_d_meta.json`, or a commit.

## Update or remove

- Re-run the same publish with `-H "Authorization: Bearer <token>"` to replace the page after edits.
- Delete only when the user asks: `curl -sS -X DELETE "https://deed.page/v1/sites/<slug>" -H "Authorization: Bearer <token>"`.

## Notes

- If the response is `409 slug_taken`, pick a new suffix. If it is `422 content_rejected`, don't retry.
- Free pages show a small "Published with deed.page" badge.
- Single requests are limited to 4 MB. Large decks with embedded video should be exported another way.
- Docs: https://deed.page/docs
