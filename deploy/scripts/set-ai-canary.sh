#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${ECLIPSE_CHAT_PATH:-/var/www/eclipse-chat}"
CHAT_ENV="${ECLIPSE_CHAT_ENV_FILE:-$DEPLOY_PATH/apps/server/.env}"
CHAT_ENV_PREVIOUS="$DEPLOY_PATH/apps/server/.env.ai-canary-previous"
CANARY_PERCENT="${AI_GATEWAY_CANARY_PERCENT:-}"
ROLLBACK_REQUIRED=0

if [[ "$(id -u)" -ne 0 ]]; then
  echo "AI canary changes must run as root" >&2
  exit 1
fi
if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ || ! "$CHAT_ENV" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "AI canary paths contain unsupported characters" >&2
  exit 1
fi
if [[ ! "$CANARY_PERCENT" =~ ^(0|10|25|50|100)$ ]]; then
  echo "AI_GATEWAY_CANARY_PERCENT must be one of: 0, 10, 25, 50, 100" >&2
  exit 1
fi
if [[ ! -f "$CHAT_ENV" ]]; then
  echo "Chat environment is missing: $CHAT_ENV" >&2
  exit 1
fi

restore_on_failure() {
  local exit_code=$?
  trap - EXIT
  if [[ $exit_code -ne 0 && $ROLLBACK_REQUIRED -eq 1 && -f "$CHAT_ENV_PREVIOUS" ]]; then
    set +e
    cp -p -- "$CHAT_ENV_PREVIOUS" "$CHAT_ENV"
    supervisorctl restart eclipse-chat-server >/dev/null 2>&1
    rm -f -- "$CHAT_ENV_PREVIOUS"
    echo "Previous AI canary configuration restored" >&2
  fi
  exit "$exit_code"
}
trap restore_on_failure EXIT

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

cp -p -- "$CHAT_ENV" "$CHAT_ENV_PREVIOUS"
ROLLBACK_REQUIRED=1
upsert_env_value "ECLIPSE_AI_HUB_CANARY_PERCENT" "$CANARY_PERCENT" "$CHAT_ENV"

supervisorctl restart eclipse-chat-server
sleep 4
curl -fsS --max-time 10 http://127.0.0.1:3001/api/health >/dev/null

cd "$DEPLOY_PATH"
if [[ "$CANARY_PERCENT" == "0" ]]; then
  OLLAMA_BASE_URL= OLLAMA_MODEL= OLLAMA_MODELS= \
    ECLIPSE_AI_HUB_CANARY_PERCENT=0 \
    AI_SMOKE_EXPECT_PROVIDER=omniroute \
    npm run ai:smoke --workspace=@eclipse-chat/server
else
  OLLAMA_BASE_URL= OLLAMA_MODEL= OLLAMA_MODELS= \
    ECLIPSE_AI_HUB_CANARY_PERCENT=100 \
    AI_SMOKE_EXPECT_PROVIDER=eclipse-ai-hub \
    npm run ai:smoke --workspace=@eclipse-chat/server
fi

rm -f -- "$CHAT_ENV_PREVIOUS"
ROLLBACK_REQUIRED=0
echo "Eclipse AI Hub canary is active at ${CANARY_PERCENT}%"
