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
pg_dump \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  | gzip -9 > "$OUT"

# Sanity check — пустой файл значит pg_dump молча упал.
if [[ ! -s "$OUT" ]]; then
  echo "ERROR: backup file empty: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

# Ротация: удаляем backups старше KEEP_DAYS дней.
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete

SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT" 2>/dev/null || echo "?")
echo "Backup OK: $OUT ($SIZE bytes), keeping ${KEEP_DAYS}d"
