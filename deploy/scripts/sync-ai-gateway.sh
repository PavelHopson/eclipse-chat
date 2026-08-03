#!/usr/bin/env bash
set -euo pipefail

AI_HUB_REPOSITORY="https://github.com/PavelHopson/eclipse-ai-hub.git"
AI_HUB_COMMIT="af191f7d224514f715554cb9e4efbd3bebc7856f"
AI_HUB_PATH="${ECLIPSE_AI_HUB_GATEWAY_PATH:-/var/www/eclipse-ai-hub-gateway}"
GATEWAY_ENV_FILE="${AI_GATEWAY_ENV_FILE:-/etc/eclipse-ai-gateway.env}"
CHAT_ENV_FILE="${ECLIPSE_CHAT_ENV_FILE:-/var/www/eclipse-chat/apps/server/.env}"
CANARY_PERCENT="${ECLIPSE_AI_HUB_CANARY_PERCENT:-10}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "AI gateway sync must run as root" >&2
  exit 1
fi
if [[ ! "$AI_HUB_PATH" =~ ^/[A-Za-z0-9._/-]+$ || ! "$GATEWAY_ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ || ! "$CHAT_ENV_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "AI gateway paths contain unsupported characters" >&2
  exit 1
fi
if [[ ! "$CANARY_PERCENT" =~ ^[0-9]+$ || "$CANARY_PERCENT" -gt 100 ]]; then
  echo "ECLIPSE_AI_HUB_CANARY_PERCENT must be an integer from 0 to 100" >&2
  exit 1
fi
if [[ ! -r "$CHAT_ENV_FILE" ]]; then
  echo "Eclipse Chat environment is not readable: $CHAT_ENV_FILE" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local file="$2"
  local value
  value="$(awk -v key="$key" 'index($0, key "=") == 1 { value = substr($0, length(key) + 2) } END { print value }' "$file")"
  value="${value%$'\r'}"
  if [[ ${#value} -ge 2 && ( ( "${value:0:1}" == '"' && "${value: -1}" == '"' ) || ( "${value:0:1}" == "'" && "${value: -1}" == "'" ) ) ]]; then
    value="${value:1:${#value}-2}"
  fi
  REPLY="$value"
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local temp_file
  temp_file="$(mktemp)"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$file" > "$temp_file"
  printf '%s=%s\n' "$key" "$value" >> "$temp_file"
  cat "$temp_file" > "$file"
  rm -f "$temp_file"
}

write_env_line() {
  local key="$1"
  local value="$2"
  printf '%s=' "$key"
  printf '%q' "$value"
  printf '\n'
}

echo "    Installing Eclipse AI Hub gateway at pinned commit ${AI_HUB_COMMIT:0:12}"
install -d -o root -g root -m 0755 "$AI_HUB_PATH"
if ! git -C "$AI_HUB_PATH" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$AI_HUB_PATH" init --quiet
fi
if git -C "$AI_HUB_PATH" remote get-url origin >/dev/null 2>&1; then
  git -C "$AI_HUB_PATH" remote set-url origin "$AI_HUB_REPOSITORY"
else
  git -C "$AI_HUB_PATH" remote add origin "$AI_HUB_REPOSITORY"
fi
git -C "$AI_HUB_PATH" fetch --quiet --no-tags --depth=1 origin "$AI_HUB_COMMIT"
git -C "$AI_HUB_PATH" checkout --quiet --detach --force "$AI_HUB_COMMIT"
if [[ "$(git -C "$AI_HUB_PATH" rev-parse HEAD)" != "$AI_HUB_COMMIT" ]]; then
  echo "Pinned AI Hub commit verification failed" >&2
  exit 1
fi

read_env_value "OMNIROUTE_API_KEY" "$CHAT_ENV_FILE"
OMNIROUTE_API_KEY="$REPLY"
if [[ -z "$OMNIROUTE_API_KEY" ]]; then
  echo "OMNIROUTE_API_KEY is required in the Chat server environment" >&2
  exit 1
fi

SERVICE_TOKEN=""
SERVICE_CLIENTS=""
if [[ -f "$GATEWAY_ENV_FILE" ]]; then
  if [[ "$(stat -c '%U' "$GATEWAY_ENV_FILE")" != "root" || "$(stat -c '%a' "$GATEWAY_ENV_FILE")" =~ [1-7]$ ]]; then
    echo "Existing gateway environment has unsafe ownership or permissions" >&2
    exit 1
  fi
  read_env_value "AI_GATEWAY_SERVICE_CLIENTS" "$GATEWAY_ENV_FILE"
  SERVICE_CLIENTS="$REPLY"
  read_env_value "AI_GATEWAY_SERVICE_TOKEN" "$GATEWAY_ENV_FILE"
  LEGACY_SERVICE_TOKEN="$REPLY"
  read_env_value "AI_GATEWAY_SERVICE_TOKENS" "$GATEWAY_ENV_FILE"
  LEGACY_ROTATION_TOKENS="$REPLY"
  if [[ -n "$SERVICE_CLIENTS" ]]; then
    if [[ -n "$LEGACY_SERVICE_TOKEN" || -n "$LEGACY_ROTATION_TOKENS" ]]; then
      echo "Gateway environment mixes scoped and legacy service credentials" >&2
      exit 1
    fi
    SERVICE_TOKEN="$(
      SERVICE_CLIENTS_JSON="$SERVICE_CLIENTS" \
      CLIENT_ID="eclipse-chat" \
      node "$AI_HUB_PATH/gateway/scripts/service-clients.mjs" primary-token-if-present
    )"
  else
    if [[ -n "$LEGACY_ROTATION_TOKENS" ]]; then
      echo "Gateway legacy credential rotation must finish before migration" >&2
      exit 1
    fi
    SERVICE_TOKEN="$LEGACY_SERVICE_TOKEN"
  fi
fi
if [[ ${#SERVICE_TOKEN} -lt 32 ]]; then
  SERVICE_TOKEN="$(openssl rand -hex 32)"
fi
SERVICE_CLIENTS="$(
  SERVICE_CLIENTS_JSON="$SERVICE_CLIENTS" \
  CLIENT_ID="eclipse-chat" \
  CLIENT_TOKENS="$SERVICE_TOKEN" \
  CLIENT_SCOPES="models:read,telemetry:read,chat:write" \
  CLIENT_REQUESTS_PER_MINUTE="120" \
  node "$AI_HUB_PATH/gateway/scripts/service-clients.mjs" upsert
)"

umask 077
GATEWAY_ENV_TEMP="$(mktemp)"
trap 'rm -f "$GATEWAY_ENV_TEMP"' EXIT
{
  write_env_line "AI_GATEWAY_HOST" "127.0.0.1"
  write_env_line "AI_GATEWAY_PORT" "8810"
  write_env_line "AI_GATEWAY_SERVICE_CLIENTS" "$SERVICE_CLIENTS"
  write_env_line "AI_GATEWAY_UPSTREAM_BASE_URL" "http://127.0.0.1:20128/api/v1"
  write_env_line "AI_GATEWAY_UPSTREAM_API_KEY" "$OMNIROUTE_API_KEY"
  write_env_line "AI_GATEWAY_MODELS" "auto/best-chat"
  write_env_line "AI_GATEWAY_REQUESTS_PER_MINUTE" "120"
  write_env_line "AI_GATEWAY_TELEMETRY_FILE" "/var/lib/eclipse-ai-gateway/telemetry.json"
  write_env_line "AI_GATEWAY_TELEMETRY_RETENTION_HOURS" "168"
  write_env_line "AI_GATEWAY_SLO_AVAILABILITY_PERCENT" "99"
  write_env_line "AI_GATEWAY_SLO_P95_LATENCY_MS" "15000"
} > "$GATEWAY_ENV_TEMP"
install -o root -g www-data -m 0640 "$GATEWAY_ENV_TEMP" "$GATEWAY_ENV_FILE"

ECLIPSE_AI_HUB_GATEWAY_PATH="$AI_HUB_PATH" \
  AI_GATEWAY_ENV_FILE="$GATEWAY_ENV_FILE" \
  bash "$AI_HUB_PATH/deploy/scripts/sync-gateway-supervisor.sh"

set -a
source "$GATEWAY_ENV_FILE"
set +a
cd "$AI_HUB_PATH"
AI_GATEWAY_SMOKE_BASE_URL="http://127.0.0.1:8810" \
  AI_GATEWAY_SERVICE_TOKEN="$SERVICE_TOKEN" \
  AI_GATEWAY_SMOKE_COMPLETION=1 \
  node gateway/scripts/smoke.mjs

upsert_env_value "ECLIPSE_AI_HUB_BASE_URL" "http://127.0.0.1:8810/v1" "$CHAT_ENV_FILE"
upsert_env_value "ECLIPSE_AI_HUB_SERVICE_TOKEN" "$SERVICE_TOKEN" "$CHAT_ENV_FILE"
upsert_env_value "ECLIPSE_AI_HUB_MODELS" "auto/best-chat" "$CHAT_ENV_FILE"
upsert_env_value "ECLIPSE_AI_HUB_CANARY_PERCENT" "$CANARY_PERCENT" "$CHAT_ENV_FILE"

echo "    Eclipse AI Hub gateway is ready; Chat canary configured at ${CANARY_PERCENT}%"
