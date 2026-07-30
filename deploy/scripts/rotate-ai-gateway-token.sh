#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${ECLIPSE_CHAT_PATH:-/var/www/eclipse-chat}"
GATEWAY_PATH="${ECLIPSE_AI_HUB_GATEWAY_PATH:-/var/www/eclipse-ai-hub-gateway}"
GATEWAY_ENV="${AI_GATEWAY_ENV_FILE:-/etc/eclipse-ai-gateway.env}"
CHAT_ENV="${ECLIPSE_CHAT_ENV_FILE:-$DEPLOY_PATH/apps/server/.env}"
GATEWAY_BACKUP="${GATEWAY_ENV}.rotation-previous"
CHAT_BACKUP="${CHAT_ENV}.rotation-previous"
ROTATION_STARTED=0

if [[ "$(id -u)" -ne 0 ]]; then
  echo "AI gateway token rotation must run as root" >&2
  exit 1
fi
for path in "$DEPLOY_PATH" "$GATEWAY_PATH" "$GATEWAY_ENV" "$CHAT_ENV"; do
  if [[ ! "$path" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    echo "AI gateway rotation path contains unsupported characters" >&2
    exit 1
  fi
done
if [[ ! -r "$GATEWAY_ENV" || ! -r "$CHAT_ENV" ]]; then
  echo "Gateway or Chat environment is missing" >&2
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
  printf '%s=%q\n' "$key" "$value" >> "$temp_file"
  cat "$temp_file" > "$file"
  rm -f -- "$temp_file"
}

delete_env_value() {
  local key="$1"
  local file="$2"
  local temp_file
  temp_file="$(mktemp)"
  awk -v key="$key" 'index($0, key "=") != 1 { print }' "$file" > "$temp_file"
  cat "$temp_file" > "$file"
  rm -f -- "$temp_file"
}

restore_on_failure() {
  local exit_code=$?
  trap - EXIT
  if [[ $exit_code -ne 0 && $ROTATION_STARTED -eq 1 ]]; then
    set +e
    cp -p -- "$GATEWAY_BACKUP" "$GATEWAY_ENV"
    cp -p -- "$CHAT_BACKUP" "$CHAT_ENV"
    supervisorctl restart eclipse-ai-gateway >/dev/null 2>&1
    supervisorctl restart eclipse-chat-server >/dev/null 2>&1
    rm -f -- "$GATEWAY_BACKUP" "$CHAT_BACKUP"
    echo "Previous gateway and Chat credentials restored" >&2
  fi
  exit "$exit_code"
}
trap restore_on_failure EXIT

read_env_value "AI_GATEWAY_SERVICE_TOKEN" "$GATEWAY_ENV"
OLD_GATEWAY_TOKEN="$REPLY"
read_env_value "AI_GATEWAY_SERVICE_TOKENS" "$GATEWAY_ENV"
EXISTING_ROTATION_TOKENS="$REPLY"
read_env_value "ECLIPSE_AI_HUB_SERVICE_TOKEN" "$CHAT_ENV"
OLD_CHAT_TOKEN="$REPLY"
if [[ -n "$EXISTING_ROTATION_TOKENS" || ${#OLD_GATEWAY_TOKEN} -lt 32 || "$OLD_GATEWAY_TOKEN" != "$OLD_CHAT_TOKEN" ]]; then
  echo "Gateway and Chat credentials are not in a safe singular-token state" >&2
  exit 1
fi

umask 077
NEW_TOKEN="$(openssl rand -hex 32)"
cp -p -- "$GATEWAY_ENV" "$GATEWAY_BACKUP"
cp -p -- "$CHAT_ENV" "$CHAT_BACKUP"
ROTATION_STARTED=1

echo "    Stage 1/3: enable bounded dual-token grace window"
upsert_env_value "AI_GATEWAY_SERVICE_TOKENS" "$NEW_TOKEN,$OLD_GATEWAY_TOKEN" "$GATEWAY_ENV"
supervisorctl restart eclipse-ai-gateway
sleep 3
set -a
source "$GATEWAY_ENV"
set +a
cd "$GATEWAY_PATH"
AI_GATEWAY_SMOKE_BASE_URL="http://127.0.0.1:${AI_GATEWAY_PORT:-8810}" node gateway/scripts/smoke.mjs

echo "    Stage 2/3: switch Eclipse Chat to the new credential"
upsert_env_value "ECLIPSE_AI_HUB_SERVICE_TOKEN" "$NEW_TOKEN" "$CHAT_ENV"
supervisorctl restart eclipse-chat-server
sleep 4
curl -fsS --max-time 10 http://127.0.0.1:3001/api/health >/dev/null
cd "$DEPLOY_PATH/apps/server"
OLLAMA_BASE_URL= OLLAMA_MODEL= OLLAMA_MODELS= \
  ECLIPSE_AI_HUB_CANARY_PERCENT=100 \
  AI_SMOKE_EXPECT_PROVIDER=eclipse-ai-hub \
  npm run ai:smoke

echo "    Stage 3/3: revoke the previous credential"
upsert_env_value "AI_GATEWAY_SERVICE_TOKEN" "$NEW_TOKEN" "$GATEWAY_ENV"
delete_env_value "AI_GATEWAY_SERVICE_TOKENS" "$GATEWAY_ENV"
unset AI_GATEWAY_SERVICE_TOKENS
set -a
source "$GATEWAY_ENV"
set +a
supervisorctl restart eclipse-ai-gateway
sleep 3
cd "$GATEWAY_PATH"
AI_GATEWAY_SMOKE_BASE_URL="http://127.0.0.1:${AI_GATEWAY_PORT:-8810}" \
  AI_GATEWAY_SMOKE_COMPLETION=1 \
  node gateway/scripts/smoke.mjs
OLD_TOKEN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
  -H "Authorization: Bearer $OLD_GATEWAY_TOKEN" \
  "http://127.0.0.1:${AI_GATEWAY_PORT:-8810}/v1/models")"
if [[ "$OLD_TOKEN_STATUS" != "401" ]]; then
  echo "Previous gateway credential was not revoked" >&2
  exit 1
fi

cd "$DEPLOY_PATH/apps/server"
OLLAMA_BASE_URL= OLLAMA_MODEL= OLLAMA_MODELS= \
  ECLIPSE_AI_HUB_CANARY_PERCENT=100 \
  AI_SMOKE_EXPECT_PROVIDER=eclipse-ai-hub \
  npm run ai:smoke

rm -f -- "$GATEWAY_BACKUP" "$CHAT_BACKUP"
ROTATION_STARTED=0
echo "AI gateway service token rotation completed; previous credential revoked"
