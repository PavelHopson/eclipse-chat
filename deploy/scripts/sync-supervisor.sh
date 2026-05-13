#!/usr/bin/env bash
# Eclipse Chat — синхронизация supervisor program config из репо на prod.
#
# Идемпотентен: копирует только изменённые файлы, делает reread+update.
# Если конфиг изменился — supervisor сам перезапустит program при `update`.
# Если конфиг unchanged — никаких действий, supervisor продолжает работать.
#
# Запускается из deploy.sh или вручную:
#   sudo bash deploy/scripts/sync-supervisor.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../supervisor"
TARGET_DIR="/etc/supervisor/conf.d"
CHANGED=0

echo "→ sync-supervisor.sh: $SRC_DIR → $TARGET_DIR"

if [[ ! -d "$SRC_DIR" ]]; then
    echo "❌ Source directory $SRC_DIR not found"
    exit 1
fi

for src in "$SRC_DIR"/*.conf; do
    [[ -f "$src" ]] || continue
    name=$(basename "$src")
    target="$TARGET_DIR/$name"

    if [[ -f "$target" ]] && cmp -s "$src" "$target"; then
        echo "  = $name (unchanged)"
        continue
    fi

    sudo cp "$src" "$target"
    echo "  + synced $name"
    CHANGED=1
done

if [[ $CHANGED -eq 0 ]]; then
    echo "✓ All supervisor configs already in sync"
    exit 0
fi

echo "→ supervisorctl reread + update..."
sudo supervisorctl reread
sudo supervisorctl update
echo "✓ supervisor synced"
