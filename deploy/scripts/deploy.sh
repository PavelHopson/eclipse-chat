#!/usr/bin/env bash
# Eclipse Chat — deploy orchestrator.
#
# Запускается на проде (cv6067007.novalocal) из директории клонированного репо
# `/var/www/eclipse-chat/`. GitHub Actions workflow вызывает этот script
# через SSH. Также можно запустить руками если deploy через CI временно
# недоступен:
#
#   ssh root@<prod>
#   cd /var/www/eclipse-chat
#   ECLIPSE_RELEASE_SHA=<validated-full-SHA> bash deploy/scripts/deploy.sh
#
# Шаги:
#   [1/13] git fetch + reset --hard origin/master
#   [2/13] npm ci (из корня — workspaces)
#   [3/13] prisma generate + migrate deploy
#   [4/13] build server + web into staging directories and preflight routes
#   [5/13] sync nginx snippets (с auto-rollback при nginx -t fail)
#   [6/13] sync supervisor program (если изменилось)
#   [7/13] atomically activate staged build
#   [8/13] set ownership (www-data)
#   [9/13] verify existing Chat runtime environment without provisioning integrations
#  [10/13] supervisorctl restart eclipse-chat-server
#  [11/13] configure and verify signed LiveKit webhooks
#  [12/13] smoke test (version + health + supervisor + uploads MIME)
#  [13/13] atomically commit release.json after the smoke succeeds

set -euo pipefail

DEPLOY_PATH="${ECLIPSE_CHAT_PATH:-/var/www/eclipse-chat}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIST="$DEPLOY_PATH/apps/server/dist"
SERVER_STAGE="$DEPLOY_PATH/apps/server/dist.next"
SERVER_PREVIOUS="$DEPLOY_PATH/apps/server/dist.previous"
WEB_DIST="$DEPLOY_PATH/apps/web/dist"
WEB_STAGE="$DEPLOY_PATH/apps/web/dist.next"
WEB_PREVIOUS="$DEPLOY_PATH/apps/web/dist.previous"
CHAT_ENV="$DEPLOY_PATH/apps/server/.env"
BUILD_ACTIVATED=0
RELEASE_METADATA_NEXT="$DEPLOY_PATH/.release.json.next"
LIVEKIT_DIR="$DEPLOY_PATH/deploy/livekit"
LIVEKIT_CONFIG="$LIVEKIT_DIR/livekit.yaml"
LIVEKIT_CONFIG_BACKUP="$LIVEKIT_DIR/.livekit.yaml.pre-release"
LIVEKIT_CONFIG_CHANGED=0

assert_managed_build_path() {
    case "$1" in
        "$SERVER_DIST"|"$SERVER_STAGE"|"$SERVER_PREVIOUS"|\
        "$WEB_DIST"|"$WEB_STAGE"|"$WEB_PREVIOUS")
            ;;
        *)
            echo "❌ Refusing to manage unexpected build path: $1"
            exit 1
            ;;
    esac
}

remove_managed_build_path() {
    assert_managed_build_path "$1"
    rm -rf -- "$1"
}

rollback_activated_build() {
    local exit_code="${1:-$?}"

    if [[ $exit_code -eq 0 || $BUILD_ACTIVATED -ne 1 ]]; then
        return
    fi

    set +e
    echo "❌ Deploy failed after build activation. Restoring previous build..."
    sudo supervisorctl stop eclipse-chat-server >/dev/null 2>&1 || true

    if [[ -d "$SERVER_PREVIOUS" ]]; then
        remove_managed_build_path "$SERVER_DIST"
        mv "$SERVER_PREVIOUS" "$SERVER_DIST"
    fi
    if [[ -d "$WEB_PREVIOUS" ]]; then
        remove_managed_build_path "$WEB_DIST"
        mv "$WEB_PREVIOUS" "$WEB_DIST"
    fi

    sudo supervisorctl start eclipse-chat-server >/dev/null 2>&1 || true
    echo "✓ Previous build restored"
}

rollback_livekit_webhook() {
    local exit_code="${1:-$?}"
    if [[ $exit_code -eq 0 || $LIVEKIT_CONFIG_CHANGED -ne 1 ]]; then
        return
    fi

    set +e
    echo "❌ Deploy failed after LiveKit webhook activation. Restoring previous config..."
    if [[ -f "$LIVEKIT_CONFIG_BACKUP" ]]; then
        mv -f -- "$LIVEKIT_CONFIG_BACKUP" "$LIVEKIT_CONFIG"
        (cd "$LIVEKIT_DIR" && docker compose -f docker-compose.livekit.yml up -d --force-recreate livekit) >/dev/null 2>&1 || true
    fi
    echo "✓ Previous LiveKit config restored"
}

finish_deploy() {
    local exit_code=$?
    rm -f -- "$RELEASE_METADATA_NEXT" || true
    rollback_livekit_webhook "$exit_code"
    rollback_activated_build "$exit_code"
}

trap finish_deploy EXIT

if [[ ! -d "$DEPLOY_PATH" ]]; then
    echo "❌ $DEPLOY_PATH не существует."
    echo "Это первый deploy? Запусти deploy/initial-setup.sh с правильными env vars."
    exit 1
fi

cd "$DEPLOY_PATH"

case "${ECLIPSE_SKIP_DB_MIGRATION:-0}" in
    0) PREVIOUS_RELEASE_SHA="" ;;
    1)
        [[ -f release.json ]] || { echo "Cannot skip database migration without previous release metadata"; exit 1; }
        PREVIOUS_RELEASE_SHA=$(node -e '
          const fs = require("node:fs");
          try {
            const value = JSON.parse(fs.readFileSync("release.json", "utf8")).commit;
            if (!/^[0-9a-f]{40}$/.test(value)) process.exit(1);
            process.stdout.write(value);
          } catch { process.exit(1); }
        ') || { echo "Cannot verify previous deployed SHA"; exit 1; }
        ;;
    *) echo "ECLIPSE_SKIP_DB_MIGRATION must be 0 or 1"; exit 1 ;;
esac

echo "═══════════════════════════════════════════════════"
echo " Eclipse Chat — deploy starting"
echo " Path:   $DEPLOY_PATH"
echo " Time:   $(date -Iseconds)"
echo "═══════════════════════════════════════════════════"

echo
echo "==> [1/13] git fetch + reset --hard origin/master"
[[ "${ECLIPSE_RELEASE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo "Missing validated release SHA"; exit 1; }
git fetch origin master
[[ "$(git rev-parse origin/master)" == "$ECLIPSE_RELEASE_SHA" ]] || { echo "Refusing stale release"; exit 1; }
git reset --hard "$ECLIPSE_RELEASE_SHA"
if [[ "${ECLIPSE_SKIP_DB_MIGRATION:-0}" == "1" ]]; then
    git cat-file -e "$PREVIOUS_RELEASE_SHA^{commit}" 2>/dev/null || { echo "Previous deployed SHA is unavailable"; exit 1; }
    git merge-base --is-ancestor "$PREVIOUS_RELEASE_SHA" "$ECLIPSE_RELEASE_SHA" || { echo "Previous release is not an ancestor"; exit 1; }
    if ! git diff --quiet "$PREVIOUS_RELEASE_SHA" "$ECLIPSE_RELEASE_SHA" -- \
        apps/server/prisma/schema.prisma apps/server/prisma/migrations; then
        echo "Refusing migration skip: Prisma schema or migrations changed"
        exit 1
    fi
    echo "    Verified no Prisma schema/migration change since $PREVIOUS_RELEASE_SHA"
fi
echo "    HEAD: $(git log -1 --oneline)"

echo
echo "==> [2/13] npm ci (workspaces — из корня репо)"
# WHY no --omit=optional: rollup использует platform-specific native modules
# (@rollup/rollup-linux-x64-gnu и др.) через optional dependencies. Если их
# не установить — vite build падает с MODULE_NOT_FOUND. См. npm bug #4828.
npm ci
echo "    Auditing production dependencies (High/Critical block deploy)..."
npm audit --omit=dev --audit-level=high

echo
echo "==> [3/13] prisma generate + database schema deployment"
cd apps/server
npx prisma generate
if [[ "${ECLIPSE_SKIP_DB_MIGRATION:-0}" == "1" ]]; then
    echo "    Skipping prisma migrate deploy after exact release-diff verification"
else
    npx prisma migrate deploy
fi
cd "$DEPLOY_PATH"

echo
echo "==> [4/13] build staged server + web and preflight routes"
remove_managed_build_path "$SERVER_STAGE"
remove_managed_build_path "$WEB_STAGE"

(
    cd "$DEPLOY_PATH/apps/server"
    npx tsc -p tsconfig.json --outDir dist.next
)
(
    cd "$DEPLOY_PATH/apps/web"
    npx tsc -b
    VITE_BASE_PATH="${VITE_BASE_PATH:-/eclipse-chat/}" \
        npx vite build --outDir dist.next
)

node --check "$SERVER_STAGE/index.js"
npm test --workspace=@eclipse-chat/server -- \
    tests/route-registration.test.ts

echo
echo "==> [5/13] sync nginx snippets (с auto-rollback)"
bash "$SCRIPT_DIR/sync-nginx.sh"

echo
echo "==> [6/13] sync supervisor program"
bash "$SCRIPT_DIR/sync-supervisor.sh"

echo
echo "==> [7/13] atomically activate staged build"
remove_managed_build_path "$SERVER_PREVIOUS"
remove_managed_build_path "$WEB_PREVIOUS"

if [[ -d "$SERVER_DIST" ]]; then
    mv "$SERVER_DIST" "$SERVER_PREVIOUS"
fi
if [[ -d "$WEB_DIST" ]]; then
    mv "$WEB_DIST" "$WEB_PREVIOUS"
fi

BUILD_ACTIVATED=1
mv "$SERVER_STAGE" "$SERVER_DIST"
mv "$WEB_STAGE" "$WEB_DIST"

echo
echo "==> [8/13] set ownership www-data"
chown -R www-data:www-data "$DEPLOY_PATH/apps/web/dist" || true
chown -R www-data:www-data "$DEPLOY_PATH/apps/server/dist" || true
chown -R www-data:www-data "$DEPLOY_PATH/apps/server/prisma" || true
# uploads должна быть writable для node (www-data) при загрузке файлов
if [[ -d "$DEPLOY_PATH/uploads" ]]; then
    chown -R www-data:www-data "$DEPLOY_PATH/uploads"
fi

echo
echo "==> [9/13] verify existing Chat runtime environment"
if [[ ! -f "$CHAT_ENV" ]]; then
    echo "Chat environment is missing: $CHAT_ENV"
    exit 1
fi
# Routine Chat releases do not deploy other products or rewrite integration
# credentials/canary state. Provisioning requires a separately scoped operation.
[[ "$(readlink -f "$CHAT_ENV")" == "$CHAT_ENV" ]] || { echo "Unsafe Chat environment path"; exit 1; }
[[ "$(stat -c %u "$CHAT_ENV")" == "0" ]] || { echo "Unsafe Chat environment owner"; exit 1; }
CHAT_ENV_MODE=$(stat -c %a "$CHAT_ENV")
[[ "$((8#$CHAT_ENV_MODE & 0037))" -eq 0 ]] || { echo "Unsafe Chat environment permissions"; exit 1; }
if ! sudo -u www-data test -r "$CHAT_ENV"; then
    echo "Chat environment is not readable by www-data"
    exit 1
fi

echo
echo "==> [10/13] restart eclipse-chat-server"
sudo supervisorctl restart eclipse-chat-server
sleep 4

echo
echo "==> [11/13] configure and verify signed LiveKit webhooks"
[[ -f "$LIVEKIT_CONFIG" ]] || { echo "LiveKit config is missing: $LIVEKIT_CONFIG"; exit 1; }
[[ -f "$LIVEKIT_DIR/docker-compose.livekit.yml" ]] || { echo "LiveKit compose file is missing"; exit 1; }
[[ "$(readlink -f "$LIVEKIT_CONFIG")" == "$LIVEKIT_CONFIG" ]] || { echo "Unsafe LiveKit config path"; exit 1; }
[[ "$(stat -c %u "$LIVEKIT_CONFIG")" == "0" ]] || { echo "Unsafe LiveKit config owner"; exit 1; }
chmod 600 "$LIVEKIT_CONFIG"
BACKEND_LIVEKIT_API_KEY=$(
    cd "$DEPLOY_PATH/apps/server"
    node --input-type=module -e 'import "dotenv/config"; const key=process.env.LIVEKIT_API_KEY || ""; if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) process.exit(1); process.stdout.write(key)'
) || { echo "Cannot read a valid LiveKit API key from the backend environment"; exit 1; }

LIVEKIT_CONFIG_TEMP=$(mktemp "$LIVEKIT_DIR/.livekit.yaml.next-XXXXXX")
awk -v api_key="$BACKEND_LIVEKIT_API_KEY" '
function emit_webhook() {
    print "webhook:"
    print "  api_key: " api_key
    print "  urls:"
    print "    - https://app.star-crm.ru/eclipse-chat/api/webhooks/livekit"
    emitted=1
}
BEGIN { in_webhook=0; emitted=0 }
/^webhook:[[:space:]]*(#.*)?$/ { emit_webhook(); in_webhook=1; next }
in_webhook && /^[^[:space:]#][^:]*:/ { in_webhook=0 }
!in_webhook { print }
END { if (!emitted) { print ""; emit_webhook() } }
' "$LIVEKIT_CONFIG" > "$LIVEKIT_CONFIG_TEMP"

if ! cmp -s "$LIVEKIT_CONFIG" "$LIVEKIT_CONFIG_TEMP"; then
    rm -f -- "$LIVEKIT_CONFIG_BACKUP"
    cp --preserve=mode,ownership -- "$LIVEKIT_CONFIG" "$LIVEKIT_CONFIG_BACKUP"
    chown --reference="$LIVEKIT_CONFIG" "$LIVEKIT_CONFIG_TEMP"
    chmod --reference="$LIVEKIT_CONFIG" "$LIVEKIT_CONFIG_TEMP"
    LIVEKIT_CONFIG_CHANGED=1
    mv -f -- "$LIVEKIT_CONFIG_TEMP" "$LIVEKIT_CONFIG"
    (cd "$LIVEKIT_DIR" && docker compose -f docker-compose.livekit.yml up -d --force-recreate livekit)
else
    rm -f -- "$LIVEKIT_CONFIG_TEMP"
fi

LIVEKIT_STATE=""
for _ in $(seq 1 15); do
    LIVEKIT_STATE=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' eclipse-livekit 2>/dev/null || true)
    if [[ "$LIVEKIT_STATE" == "healthy" || "$LIVEKIT_STATE" == "running" ]]; then break; fi
    sleep 2
done
[[ "$LIVEKIT_STATE" == "healthy" || "$LIVEKIT_STATE" == "running" ]] || { echo "LiveKit did not recover after webhook config update"; exit 1; }
grep -Fqx "  api_key: $BACKEND_LIVEKIT_API_KEY" "$LIVEKIT_CONFIG" || { echo "LiveKit webhook signing key mismatch"; exit 1; }
grep -Fqx "    - https://app.star-crm.ru/eclipse-chat/api/webhooks/livekit" "$LIVEKIT_CONFIG" || { echo "LiveKit webhook URL mismatch"; exit 1; }

# End-to-end signature smoke uses the backend env without printing a token or
# secret. An unknown participant must traverse raw-body verification, current
# DB ACL and exact-session RoomService removal before the release can proceed.
(
    cd "$DEPLOY_PATH/apps/server"
    node --input-type=module <<'NODE'
import "dotenv/config";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
if (!apiKey || !apiSecret) process.exit(1);
const body = JSON.stringify({
  event: "participant_joined",
  id: "deploy-signature-smoke",
  room: { name: "eclipse-deploy-signature-smoke" },
  participant: {
    identity: "deploy-smoke:123e4567-e89b-42d3-a456-426614174000",
    metadata: JSON.stringify({ userId: "deploy-smoke" }),
  },
});
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign({ iss: apiKey, nbf: now, exp: now + 60, sha256: createHash("sha256").update(body).digest("base64") }, apiSecret, { algorithm: "HS256" });
const response = await fetch("https://app.star-crm.ru/eclipse-chat/api/webhooks/livekit", { method: "POST", headers: { authorization: token, "content-type": "application/webhook+json" }, body });
if (response.status !== 200 || (await response.json()).action !== "removed") process.exit(1);
NODE
)
echo "    LiveKit webhook config, container health and signed endpoint verified"

echo
echo "==> [12/13] smoke test (wait 4s for server start)"
sleep 4
# Версия — каноничный источник: apps/server/package.json.
# Backend загружает manifest один раз при старте. Smoke читает текущий файл
# отдельно, поэтому обнаружит старый Node-процесс или неверный nginx upstream,
# даже если новая сборка уже лежит на диске.
EXPECTED_VERSION=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"' \
    "$DEPLOY_PATH/apps/server/package.json" | \
    head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
echo "    Expected version (from package.json): $EXPECTED_VERSION"

if SMOKE_EXPECTED_VERSION="$EXPECTED_VERSION" bash "$SCRIPT_DIR/smoke.sh"; then
    echo
    echo "==> [13/13] atomically commit release metadata"
    cat > "$RELEASE_METADATA_NEXT" <<JSON
{
  "branch": "$(git branch --show-current)",
  "commit": "$(git rev-parse HEAD)",
  "commit_short": "$(git rev-parse --short HEAD)",
  "subject": $(git log -1 --pretty=%s | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))"),
  "deployed_at": "$(date -Iseconds)"
}
JSON
    cat "$RELEASE_METADATA_NEXT"
    mv -f -- "$RELEASE_METADATA_NEXT" "$DEPLOY_PATH/release.json"
    BUILD_ACTIVATED=0
    LIVEKIT_CONFIG_CHANGED=0
    rm -f -- "$LIVEKIT_CONFIG_BACKUP"
    echo
    echo "═══════════════════════════════════════════════════"
    echo " ✓ DEPLOY COMPLETE"
    echo " HEAD: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
    echo "═══════════════════════════════════════════════════"
else
    echo
    echo "═══════════════════════════════════════════════════"
    echo " ❌ DEPLOY COMPLETED BUT SMOKE FAILED"
    echo " Server is running но что-то ломано. Check logs:"
    echo "   sudo tail -100 /var/log/supervisor/eclipse-chat.err.log"
    echo "═══════════════════════════════════════════════════"
    exit 1
fi
