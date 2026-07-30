# Eclipse Chat → Eclipse AI Hub (`ai.v1`)

This integration is an opt-in canary. Without the gateway environment variables, production behavior does not change.

## Runtime topology

```text
Eclipse Chat server
  -> Eclipse AI Gateway :8810/v1
      -> OmniRoute :20128/api/v1 (or another configured OpenAI-compatible upstream)
  -> existing direct provider chain on gateway failure
```

Provider and service credentials remain server-side. The browser never receives either token.

## Configure the gateway

Use the runtime from `eclipse-ai-hub/gateway` and generate a unique service token, for example with `openssl rand -hex 32`. Configure:

```dotenv
AI_GATEWAY_HOST=127.0.0.1
AI_GATEWAY_PORT=8810
AI_GATEWAY_SERVICE_TOKEN=<random-service-token>
AI_GATEWAY_UPSTREAM_BASE_URL=http://127.0.0.1:20128/api/v1
AI_GATEWAY_UPSTREAM_API_KEY=<omniroute-client-key-if-required>
AI_GATEWAY_MODELS=auto/best-chat
```

Keep the process on loopback when it runs on the same host. For cross-host traffic, use private networking or a TLS reverse proxy; remote plaintext HTTP is rejected.

## Enable the Chat canary

The regular production deploy performs this step automatically through
`deploy/scripts/sync-ai-gateway.sh`. It fetches a pinned full AI Hub commit,
keeps the gateway on loopback, stores its environment as root-owned `0640`,
runs an authenticated completion smoke, and only then writes the Chat canary
configuration. The orchestrator restores the previous Chat environment together
with the previous build if a later deploy step fails.

Use the same service token in the Chat server environment:

```dotenv
ECLIPSE_AI_HUB_BASE_URL=http://127.0.0.1:8810/v1
ECLIPSE_AI_HUB_SERVICE_TOKEN=<same-random-service-token>
ECLIPSE_AI_HUB_MODELS=auto/best-chat
ECLIPSE_AI_HUB_CANARY_PERCENT=10
```

Restart the Chat server and verify Platform Admin → AI. `eclipse-ai-hub` must appear as a gateway before `omniroute`; token values are never returned by diagnostics.

## Smoke and rollback

```bash
curl -sS http://127.0.0.1:8810/health
curl -sS http://127.0.0.1:8810/v1/models \
  -H "Authorization: Bearer $ECLIPSE_AI_HUB_SERVICE_TOKEN"
```

`ECLIPSE_AI_HUB_CANARY_PERCENT` is required for traffic. Missing, invalid or `0`
keeps the gateway visible in sanitized diagnostics but sends it no requests. Use a
small value first; `100` is reserved for an explicit full rollout.

The Chat-side smoke command never prints prompt or credentials:

```bash
cd apps/server
ECLIPSE_AI_HUB_CANARY_PERCENT=100 \
  AI_SMOKE_EXPECT_PROVIDER=eclipse-ai-hub \
  npm run ai:smoke
```

Rollback is immediate: set `ECLIPSE_AI_HUB_CANARY_PERCENT=0` and restart Chat.
Removing all `ECLIPSE_AI_HUB_*` variables is also supported. The existing provider
chain remains available throughout the canary.
