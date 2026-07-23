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
#   [1/10] git fetch + reset --hard origin/master
#   [2/10] write release.json (commit/branch/timestamp metadata)
#   [3/10] npm ci (из корня — workspaces)
#   [4/10] prisma generate + migrate deploy
#   [5/10] npm run build (server tsc + web vite)
#   [6/10] sync nginx snippets (с auto-rollback при nginx -t fail)
#   [7/10] sync supervisor program (если изменилось)
#   [8/10] set ownership (www-data)
#   [9/10] supervisorctl restart eclipse-chat-server
#  [10/10] smoke test (version + health + supervisor + uploads MIME)

set -euo pipefail

DEPLOY_PATH="${ECLIPSE_CHAT_PATH:-/var/www/eclipse-chat}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
echo "==> [1/10] git fetch + reset --hard origin/master"
git fetch origin master
git reset --hard origin/master
echo "    HEAD: $(git log -1 --oneline)"

echo
echo "==> [2/10] write release.json"
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
echo "==> [3/10] npm ci (workspaces — из корня репо)"
# WHY no --omit=optional: rollup использует platform-specific native modules
# (@rollup/rollup-linux-x64-gnu и др.) через optional dependencies. Если их
# не установить — vite build падает с MODULE_NOT_FOUND. См. npm bug #4828.
npm ci

echo
echo "==> [4/10] prisma generate + migrate deploy"
cd apps/server
npx prisma generate
npx prisma migrate deploy
cd "$DEPLOY_PATH"

echo
echo "==> [5/10] npm run build (server tsc + web vite)"
npm run build

echo
echo "==> [6/10] sync nginx snippets (с auto-rollback)"
bash "$SCRIPT_DIR/sync-nginx.sh"

echo
echo "==> [7/10] sync supervisor program"
bash "$SCRIPT_DIR/sync-supervisor.sh"

echo
echo "==> [8/10] set ownership www-data"
chown -R www-data:www-data "$DEPLOY_PATH/apps/web/dist" || true
chown -R www-data:www-data "$DEPLOY_PATH/apps/server/dist" || true
chown -R www-data:www-data "$DEPLOY_PATH/apps/server/prisma" || true
# uploads должна быть writable для node (www-data) при загрузке файлов
if [[ -d "$DEPLOY_PATH/uploads" ]]; then
    chown -R www-data:www-data "$DEPLOY_PATH/uploads"
fi

echo
echo "==> [9/10] restart eclipse-chat-server"
sudo supervisorctl restart eclipse-chat-server

echo
echo "==> [10/10] smoke test (wait 4s for server start)"
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
