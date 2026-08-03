# Verified GitHub Rooms

Eclipse Chat `v1.7.31` turns GitHub deliveries into verified operational events
inside a text, broadcast, or execution room. This extends the existing incoming
webhook integration; it does not add a second GitHub bridge.

## User flow

1. Open workspace administration and choose **GitHub**.
2. Enter the exact repository as `owner/repository` and select a target room.
3. Choose **Create GitHub Room**.
4. Copy the generated Payload URL and Secret. The secret is shown once.
5. Open the supplied GitHub webhook settings link, use `application/json`, keep
   SSL verification enabled, and select all events or the supported event set.
6. GitHub sends a ping. The target room shows a verified connection card.

Supported events are `push`, `pull_request`, `issues`, `workflow_run`,
`release`, and `deployment_status`. Unsupported actions return a successful
skip response so GitHub does not retry noise.

## Trust boundary

- The public receiver requires `X-Hub-Signature-256` and verifies HMAC-SHA256
  using a constant-time comparison.
- New secrets are encrypted at rest with the existing Eclipse secret key.
  A legacy plaintext secret is re-encrypted only after a valid signed delivery.
- Each integration is locked to one exact repository. A valid signature from a
  different repository is still rejected.
- `X-GitHub-Delivery` is stored with the integration snapshot. The database
  unique constraint makes retries and replay idempotent across restarts.
- The endpoint has a 1 MiB body limit and a dedicated rate limit.
- Eclipse stores only a bounded event summary. It never stores the complete
  webhook payload in `Message.externalEvent`.
- Source links are accepted only from `https://github.com`; off-domain links
  fall back to the repository page.
- Deleting an integration stops future deliveries but does not erase verified
  provenance from historical room events.

## Deploy

This release includes an additive Prisma migration:

```bash
cd /var/www/eclipse-chat
git pull origin master
npm ci
cd apps/server && npx prisma migrate deploy && cd ../..
npm run build
sudo supervisorctl restart eclipse-chat-server
bash deploy/scripts/smoke.sh
```

Do not expose the generated Secret in screenshots, logs, issues, or chat. If it
is disclosed, delete the GitHub webhook and Eclipse integration, then create a
new pair.
