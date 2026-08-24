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
#   bash deploy/scripts/deploy.sh
#
# Шаги:
#   [1/12] git fetch + reset --hard origin/master
#   [2/12] write release.json (commit/branch/timestamp metadata)
#   [3/12] npm ci (из корня — workspaces)
#   [4/12] prisma generate + migrate deploy
#   [5/12] build server + web into staging directories and preflight routes
#   [6/12] sync nginx snippets (с auto-rollback при nginx -t fail)
#   [7/12] sync supervisor program (если изменилось)
#   [8/12] atomically activate staged build
#   [9/12] set ownership (www-data)
#  [10/12] deploy and smoke the private Eclipse AI Hub gateway canary
#  [11/12] supervisorctl restart eclipse-chat-server
#  [12/12] smoke test (version + health + supervisor + uploads MIME)

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
CHAT_ENV_PREVIOUS="$DEPLOY_PATH/apps/server/.env.deploy-previous"
BUILD_ACTIVATED=0
CHAT_ENV_BACKED_UP=0

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
    local exit_code=$?

    if [[ $exit_code -eq 0 || $BUILD_ACTIVATED -ne 1 ]]; then
        return
    fi

    set +e
    echo "❌ Deploy failed after build activation. Restoring previous build..."
    sudo supervisorctl stop eclipse-chat-server >/dev/null 2>&1 || true

    if [[ $CHAT_ENV_BACKED_UP -eq 1 && -f "$CHAT_ENV_PREVIOUS" ]]; then
        cp -p -- "$CHAT_ENV_PREVIOUS" "$CHAT_ENV"
        rm -f -- "$CHAT_ENV_PREVIOUS"
        echo "Previous Chat environment restored"
    fi

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

trap rollback_activated_build EXIT

if [[ ! -d "$DEPLOY_PATH" ]]; then
    echo "❌ $DEPLOY_PATH не существует."
    echo "Это первый deploy? Запусти deploy/initial-setup.sh с правильными env vars."
    exit 1
fi

cd "$DEPLOY_PATH"

echo "═══════════════════════════════════════════════════"
echo " Eclipse Chat — deploy starting"
echo " Path:   $DEPLOY_PATH"
echo " Time:   $(date -Iseconds)"
echo "═══════════════════════════════════════════════════"

echo
echo "==> [1/12] git fetch + reset --hard origin/master"
git fetch origin master
git reset --hard origin/master
echo "    HEAD: $(git log -1 --oneline)"

echo
echo "==> [2/12] write release.json"
cat > release.json <<JSON
{
  "branch": "$(git branch --show-current)",
  "commit": "$(git rev-parse HEAD)",
  "commit_short": "$(git rev-parse --short HEAD)",
  "subject": $(git log -1 --pretty=%s | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))"),
  "deployed_at": "$(date -Iseconds)"
}
JSON
cat release.json

echo
echo "==> [3/12] npm ci (workspaces — из корня репо)"
# WHY no --omit=optional: rollup использует platform-specific native modules
# (@rollup/rollup-linux-x64-gnu и др.) через optional dependencies. Если их
# не установить — vite build падает с MODULE_NOT_FOUND. См. npm bug #4828.
npm ci
echo "    Auditing production dependencies (High/Critical block deploy)..."
npm audit --omit=dev --audit-level=high

echo
echo "==> [4/12] prisma generate + migrate deploy"
cd apps/server
npx prisma generate
npx prisma migrate deploy
cd "$DEPLOY_PATH"

echo
echo "==> [5/12] build staged server + web and preflight routes"
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
echo "==> [6/12] sync nginx snippets (с auto-rollback)"
bash "$SCRIPT_DIR/sync-nginx.sh"

echo
echo "==> [7/12] sync supervisor program"
bash "$SCRIPT_DIR/sync-supervisor.sh"

echo
echo "==> [8/12] atomically activate staged build"
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
echo "==> [9/12] set ownership www-data"
chown -R www-data:www-data "$DEPLOY_PATH/apps/web/dist" || true
chown -R www-data:www-data "$DEPLOY_PATH/apps/server/dist" || true
chown -R www-data:www-data "$DEPLOY_PATH/apps/server/prisma" || true
# uploads должна быть writable для node (www-data) при загрузке файлов
if [[ -d "$DEPLOY_PATH/uploads" ]]; then
    chown -R www-data:www-data "$DEPLOY_PATH/uploads"
fi

echo
echo "==> [10/12] deploy Eclipse AI Hub gateway and configure 10% canary"
if [[ ! -f "$CHAT_ENV" ]]; then
    echo "Chat environment is missing: $CHAT_ENV"
    exit 1
fi
cp -p -- "$CHAT_ENV" "$CHAT_ENV_PREVIOUS"
CHAT_ENV_BACKED_UP=1
echo "    Applying rollback-safe Sentinel Office producer state"
sudo --preserve-env=OFFICE_INGEST_SENTINEL_ENABLED,OFFICE_INGEST_SENTINEL_SECRET,OFFICE_INGEST_SENTINEL_KEY_ID,OFFICE_INGEST_SENTINEL_PRODUCER_ID,OFFICE_INGEST_SENTINEL_WORKSPACE_ID \
    node "$SCRIPT_DIR/configure-office-ingest.mjs" "$CHAT_ENV"
unset OFFICE_INGEST_SENTINEL_ENABLED OFFICE_INGEST_SENTINEL_SECRET OFFICE_INGEST_SENTINEL_KEY_ID OFFICE_INGEST_SENTINEL_PRODUCER_ID OFFICE_INGEST_SENTINEL_WORKSPACE_ID
# The server runs as www-data. Keep secrets root-owned, group-readable only,
# and verify access before restart so a permissions regression fails early.
sudo chown root:www-data "$CHAT_ENV"
sudo chmod 0640 "$CHAT_ENV"
if ! sudo -u www-data test -r "$CHAT_ENV"; then
    echo "Chat environment is not readable by www-data after provisioning"
    exit 1
fi
bash "$SCRIPT_DIR/sync-ai-gateway.sh"

echo
echo "==> [11/12] restart eclipse-chat-server"
sudo supervisorctl restart eclipse-chat-server

echo
echo "==> [12/12] smoke test (wait 4s for server start)"
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
    rm -f -- "$CHAT_ENV_PREVIOUS"
    CHAT_ENV_BACKED_UP=0
    BUILD_ACTIVATED=0
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
