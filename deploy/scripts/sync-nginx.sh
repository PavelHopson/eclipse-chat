#!/usr/bin/env bash
# Eclipse Chat — синхронизация nginx snippets из репо на prod.
#
# Идемпотентен: при повторном запуске копирует только изменённые файлы,
# делает nginx -t, reload. При ошибке nginx -t автоматически восстанавливает
# предыдущие версии из backup — это защищает Star CRM от broken config.
#
# Source of truth: deploy/nginx/*.conf
# Target: /etc/nginx/snippets/
#
# Запускается из deploy.sh или вручную:
#   sudo bash deploy/scripts/sync-nginx.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_SRC_DIR="$SCRIPT_DIR/../nginx"
NGINX_TARGET_DIR="/etc/nginx/snippets"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Pairs "backup:target" чтобы откатить если nginx -t упадёт
declare -a BACKUPS=()
CHANGED=0

echo "→ sync-nginx.sh: $NGINX_SRC_DIR → $NGINX_TARGET_DIR"

if [[ ! -d "$NGINX_SRC_DIR" ]]; then
    echo "❌ Source directory $NGINX_SRC_DIR not found"
    exit 1
fi

# Убеждаемся что target exists
sudo mkdir -p "$NGINX_TARGET_DIR"

# Explicit Chat-owned snippets only; never manage other products' configuration.
for name in eclipse-chat.conf eclipse-chat-livekit.conf; do
    src="$NGINX_SRC_DIR/$name"
    [[ -f "$src" ]] || { echo "Missing Chat nginx snippet: $name"; exit 1; }
    name=$(basename "$src")
    target="$NGINX_TARGET_DIR/$name"

    if [[ -f "$target" ]] && cmp -s "$src" "$target"; then
        echo "  = $name (unchanged)"
        continue
    fi

    if [[ -f "$target" ]]; then
        backup="$target.bak.$TIMESTAMP"
        sudo cp "$target" "$backup"
        BACKUPS+=("$backup:$target")
        echo "  ↑ $name (changed, backup → $(basename "$backup"))"
    else
        echo "  + $name (new)"
    fi

    sudo cp "$src" "$target"
    CHANGED=1
done

if [[ $CHANGED -eq 0 ]]; then
    echo "✓ All nginx snippets already in sync — no action needed"
    exit 0
fi

# Test config
echo "→ Running nginx -t..."
if ! sudo nginx -t 2>&1; then
    echo "❌ nginx -t failed. Rolling back changed snippets..."
    for entry in "${BACKUPS[@]}"; do
        backup="${entry%%:*}"
        target="${entry#*:}"
        sudo cp "$backup" "$target"
        echo "  restored $target from $(basename "$backup")"
    done
    echo "❌ ABORT: Star CRM защищён (config rollback'нут к предыдущей версии)"
    exit 1
fi

# Reload
echo "→ Reloading nginx..."
sudo systemctl reload nginx
echo "✓ nginx synced and reloaded"

# Backup retention is a separate maintenance operation, never part of a release.
