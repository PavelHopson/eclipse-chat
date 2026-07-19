#!/usr/bin/env bash
# Eclipse Chat — post-deploy smoke checks.
#
# Запускается после restart supervisor program. Проверяет что система живая:
#   1. /api/version отвечает + JSON shape ok
#   2. /api/health отвечает с ok:true и database:true
#   3. Supervisor program в статусе RUNNING
#   4. /uploads/* отдаётся с MIME image/* (а не text/html — типичный регресс
#      при пропавшем nginx location, см. session 13.05 evening)
#
# Exit 0 если всё ок, exit 1 если что-то упало (CI остановит дальнейшие шаги).
#
# Env vars:
#   SMOKE_BASE_URL — default https://app.star-crm.ru/eclipse-chat
#   SMOKE_EXPECTED_VERSION — если задано, проверит совпадение с /api/version
#   SMOKE_UPLOADS_DIR — default /var/www/eclipse-chat/uploads (для поиска probe файла)

set -uo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://app.star-crm.ru/eclipse-chat}"
UPLOADS_DIR="${SMOKE_UPLOADS_DIR:-/var/www/eclipse-chat/uploads}"
EXPECTED_VERSION="${SMOKE_EXPECTED_VERSION:-}"
if [[ -z "$EXPECTED_VERSION" && -f "apps/server/package.json" ]]; then
    EXPECTED_VERSION=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"' \
        apps/server/package.json | head -n 1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
fi
EXIT=0
FAILED=()

pass() {
    echo "  ✓ $1"
}

fail() {
    echo "  ❌ $1"
    FAILED+=("$1")
    EXIT=1
}

echo "→ Eclipse Chat smoke test"
echo "  Base URL: $BASE_URL"
if [[ -n "$EXPECTED_VERSION" ]]; then
    echo "  Expected version: $EXPECTED_VERSION"
fi

# === 1. /api/version ===
echo "→ Check /api/version"
VERSION_JSON=$(curl -sf --max-time 10 "$BASE_URL/api/version" 2>&1) || {
    fail "/api/version unreachable: $VERSION_JSON"
    VERSION_JSON=""
}
if [[ -n "$VERSION_JSON" ]]; then
    if echo "$VERSION_JSON" | grep -q '"version"'; then
        pass "/api/version returns JSON: $VERSION_JSON"
        if [[ -n "$EXPECTED_VERSION" ]]; then
            if echo "$VERSION_JSON" | grep -q "\"version\":\"$EXPECTED_VERSION\""; then
                pass "Version matches expected $EXPECTED_VERSION"
            else
                fail "Version mismatch: expected $EXPECTED_VERSION, got $VERSION_JSON"
            fi
        fi
    else
        fail "/api/version response missing 'version' field: $VERSION_JSON"
    fi
fi

# === 2. /api/health ===
echo "→ Check /api/health"
HEALTH=$(curl -sf --max-time 10 "$BASE_URL/api/health" 2>&1) || {
    fail "/api/health unreachable: $HEALTH"
    HEALTH=""
}
if [[ -n "$HEALTH" ]]; then
    if echo "$HEALTH" | grep -q '"ok":true'; then
        pass "/api/health ok:true"
    else
        fail "/api/health ok != true: $HEALTH"
    fi
    if echo "$HEALTH" | grep -q '"database":true'; then
        pass "/api/health database:true"
    else
        fail "/api/health database != true: $HEALTH"
    fi
fi

# === 3. Supervisor program RUNNING ===
echo "→ Check supervisor program"
if command -v supervisorctl &>/dev/null; then
    STATUS=$(sudo supervisorctl status eclipse-chat-server 2>&1 || true)
    if echo "$STATUS" | grep -q "RUNNING"; then
        pass "supervisor: $STATUS"
    else
        fail "supervisor eclipse-chat-server не RUNNING: $STATUS"
    fi
else
    echo "  ⚠ supervisorctl недоступен — пропускаем (вероятно запуск с CI machine, не с prod)"
fi

# === 4. Uploads MIME — самая важная проверка (баг 13.05 evening) ===
echo "→ Check uploads MIME (regression guard)"
PROBE=""
if [[ -d "$UPLOADS_DIR" ]]; then
    PROBE=$(find "$UPLOADS_DIR" -name '*.webp' -type f 2>/dev/null | head -1)
fi

if [[ -n "$PROBE" ]]; then
    REL="${PROBE#$UPLOADS_DIR/}"
    URL="$BASE_URL/uploads/$REL"
    # curl -sI капитализирует header названия, нормализуем lowercase
    HEADERS=$(curl -sI --max-time 5 "$URL" 2>&1)
    MIME=$(echo "$HEADERS" | awk -F': ' 'tolower($1)=="content-type" {print $2}' | tr -d '\r\n ')
    SIZE=$(echo "$HEADERS" | awk -F': ' 'tolower($1)=="content-length" {print $2}' | tr -d '\r\n ')
    if [[ "$MIME" == image/* ]]; then
        pass "uploads MIME: $MIME, size $SIZE bytes ($REL)"
    elif [[ "$MIME" == "text/html" ]]; then
        fail "uploads MIME = text/html — nginx /uploads/ location МИССИНГ! Запусти deploy/scripts/sync-nginx.sh"
    else
        fail "uploads MIME wrong: '$MIME' (expected image/*, got $MIME, $SIZE bytes)"
    fi
else
    echo "  ⚠ no .webp probe files в $UPLOADS_DIR — uploads MIME check пропущен"
    echo "    (это нормально на свежем сервере без загруженных файлов)"
fi

# === Final report ===
echo ""
if [[ $EXIT -eq 0 ]]; then
    echo "✓ ALL SMOKE CHECKS PASSED"
else
    echo "❌ SMOKE FAILED (${#FAILED[@]} check(s)):"
    for f in "${FAILED[@]}"; do
        echo "  - $f"
    done
fi
exit $EXIT
