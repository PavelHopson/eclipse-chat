#!/usr/bin/env bash
# Eclipse Chat — daily Postgres backup (v0.63).
#
# Дампит eclipse_chat БД в /var/backups/eclipse-chat/ gzip'нутым SQL'ом,
# ротация — 14 дней. Запускается cron'ом (см. deploy/cron.d/eclipse-chat
# или /etc/cron.d/eclipse-chat-backup).
#
# Manual run:
#   sudo /var/www/eclipse-chat/deploy/scripts/backup-db.sh
#
# Recovery:
#   gunzip < /var/backups/eclipse-chat/eclipse_chat-YYYY-MM-DD.sql.gz \
#     | psql -U eclipse_chat_user -d eclipse_chat
#
# ENV (опционально, есть defaults):
#   ECLIPSE_BACKUP_DIR   default: /var/backups/eclipse-chat
#   ECLIPSE_DB_USER      default: eclipse_chat_user
#   ECLIPSE_DB_NAME      default: eclipse_chat
#   ECLIPSE_BACKUP_KEEP  default: 14 (days)
#
# Exit 0 при успехе. Логи — stdout/stderr, cron шлёт почту root'у на ошибки.

set -euo pipefail

BACKUP_DIR="${ECLIPSE_BACKUP_DIR:-/var/backups/eclipse-chat}"
DB_USER="${ECLIPSE_DB_USER:-eclipse_chat_user}"
DB_NAME="${ECLIPSE_DB_NAME:-eclipse_chat}"
KEEP_DAYS="${ECLIPSE_BACKUP_KEEP:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TS=$(date +%F)
OUT="$BACKUP_DIR/${DB_NAME}-${TS}.sql.gz"

# pg_dump --no-owner / --no-acl делает дампы portable — можно restore'нуть
# в любую БД с правильной ролью. --clean / --if-exists даёт чистый replay.
#
# `sudo -u postgres` обходит peer-auth проблему: OS user `postgres` ↔ PG
# superuser `postgres` через Unix socket peer. Альтернатива — `.pgpass`
# или PGPASSWORD env, но они требуют secret management. Superuser имеет
# доступ к любой БД, ECLIPSE_DB_USER в этом скрипте больше не нужен.
sudo -u postgres pg_dump \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  "$DB_NAME" \
  | gzip -9 > "$OUT"

# `set -o pipefail` НЕ ловит pg_dump exit code, если gzip успешно
# обработал error-stream (что всегда). Проверяем PIPESTATUS[0] явно.
PG_EXIT="${PIPESTATUS[0]}"
if [[ "$PG_EXIT" -ne 0 ]]; then
  echo "ERROR: pg_dump exited with $PG_EXIT" >&2
  rm -f "$OUT"
  exit 1
fi

# Пустой gzip-stream даёт ~20 bytes header, не 0 — `! -s` это пропустит.
# Реальный дамп даже минимальной БД ≫ 100 bytes. Threshold = 100.
SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT" 2>/dev/null || echo 0)
if [[ "$SIZE" -lt 100 ]]; then
  echo "ERROR: backup suspiciously small ($SIZE bytes), likely pg_dump failed" >&2
  rm -f "$OUT"
  exit 1
fi

# Ротация: удаляем backups старше KEEP_DAYS дней.
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete

echo "Backup OK: $OUT ($SIZE bytes), keeping ${KEEP_DAYS}d"
