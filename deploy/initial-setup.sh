#!/usr/bin/env bash
# Eclipse Chat — initial setup на prod-сервере.
#
# Запускается ОДИН РАЗ через `workflow_dispatch` в GitHub Actions с
# `run_initial_setup=true`. Принимает через env:
#   ECLIPSE_CHAT_DB_PASSWORD — пароль для PG-пользователя eclipse_chat_user
#   ECLIPSE_CHAT_JWT_SECRET — секрет подписи JWT в проде
#
# Что делает:
#   1. Создаёт /var/www/eclipse-chat/ и клонит repo (master branch)
#   2. Создаёт PG БД eclipse_chat + role eclipse_chat_user
#      (изолированно от star_crm, никаких прав на star_crm)
#   3. Создаёт apps/server/.env с production secrets
#   4. Устанавливает nginx snippet + ssumming его в config app.star-crm.ru
#   5. Устанавливает supervisor program и стартует backend
#   6. Запускает initial prisma migrate deploy + seed
#
# Идемпотентен — повторный запуск проверяет существование каждого ресурса.

set -e

DEPLOY_PATH="/var/www/eclipse-chat"
REPO_URL="https://github.com/PavelHopson/eclipse-chat.git"

echo "==> 1. Clone or pull repository"
if [ ! -d "$DEPLOY_PATH" ]; then
  sudo mkdir -p "$DEPLOY_PATH"
  sudo chown -R "$USER:$USER" "$DEPLOY_PATH"
  git clone "$REPO_URL" "$DEPLOY_PATH"
fi
cd "$DEPLOY_PATH"
git fetch origin master
git reset --hard origin/master

echo "==> 2. PostgreSQL setup (eclipse_chat DB + eclipse_chat_user)"
if [ -z "${ECLIPSE_CHAT_DB_PASSWORD:-}" ]; then
  echo "ERROR: ECLIPSE_CHAT_DB_PASSWORD env not set"
  exit 1
fi

# Создать user если не существует
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='eclipse_chat_user'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER eclipse_chat_user WITH ENCRYPTED PASSWORD '${ECLIPSE_CHAT_DB_PASSWORD}';"

# Сменить пароль (idempotent — на случай если уже создавали ранее с другим)
sudo -u postgres psql -c "ALTER USER eclipse_chat_user WITH ENCRYPTED PASSWORD '${ECLIPSE_CHAT_DB_PASSWORD}';"

# Создать БД если не существует
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='eclipse_chat'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE eclipse_chat OWNER eclipse_chat_user;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE eclipse_chat TO eclipse_chat_user;"

# Внутри БД — права на schema public
sudo -u postgres psql -d eclipse_chat -c "GRANT ALL ON SCHEMA public TO eclipse_chat_user;"

echo "==> 3. Create .env files"
if [ -z "${ECLIPSE_CHAT_JWT_SECRET:-}" ]; then
  echo "ERROR: ECLIPSE_CHAT_JWT_SECRET env not set"
  exit 1
fi

cat > "$DEPLOY_PATH/apps/server/.env" <<ENV
DATABASE_URL="postgresql://eclipse_chat_user:${ECLIPSE_CHAT_DB_PASSWORD}@localhost:5432/eclipse_chat?schema=public"
DIRECT_URL="postgresql://eclipse_chat_user:${ECLIPSE_CHAT_DB_PASSWORD}@localhost:5432/eclipse_chat?schema=public"
JWT_SECRET="${ECLIPSE_CHAT_JWT_SECRET}"
CORS_ORIGIN="https://app.star-crm.ru"
PORT=3001
NODE_ENV=production
ENV

echo "==> 4. npm install (full, for build) + migrate + seed"
cd "$DEPLOY_PATH"
npm ci
cd apps/server
npx prisma generate
npx prisma migrate deploy
# Idempotent seed (создаст #general если ещё нет)
npx prisma db seed || echo "⚠ seed warning (may already be applied)"
cd "$DEPLOY_PATH"
npm run build

echo "==> 5. Install nginx snippet"
sudo mkdir -p /etc/nginx/snippets
sudo cp "$DEPLOY_PATH/deploy/nginx/eclipse-chat.conf" /etc/nginx/snippets/eclipse-chat.conf

NGINX_SITE="/etc/nginx/sites-available/app.star-crm.ru"
NGINX_SITE_ALT="/etc/nginx/sites-enabled/app.star-crm.ru"
SITE_FILE=""
for f in "$NGINX_SITE" "$NGINX_SITE_ALT"; do
  if [ -f "$f" ]; then
    SITE_FILE="$f"
    break
  fi
done

if [ -z "$SITE_FILE" ]; then
  echo "WARNING: nginx site-config для app.star-crm.ru не найден. Добавь руками:"
  echo "  include /etc/nginx/snippets/eclipse-chat.conf;"
  echo "внутри server { ... } блока для app.star-crm.ru"
else
  if ! grep -q "snippets/eclipse-chat.conf" "$SITE_FILE"; then
    echo "Добавляю include в $SITE_FILE"
    # Добавляем строку перед закрывающим } блока server (последний }).
    # Простой sed на последний `}` в файле.
    sudo sed -i '0,/^}/{s|^}|    include /etc/nginx/snippets/eclipse-chat.conf;\n}|}' "$SITE_FILE"
  else
    echo "✓ include уже есть в $SITE_FILE"
  fi
fi

sudo nginx -t && sudo systemctl reload nginx || {
  echo "ERROR: nginx config invalid после изменений. Проверь конфиг и откатись."
  exit 1
}

echo "==> 6. Install supervisor program"
sudo cp "$DEPLOY_PATH/deploy/supervisor/eclipse-chat.conf" /etc/supervisor/conf.d/eclipse-chat.conf
sudo supervisorctl reread
sudo supervisorctl update
sleep 3
sudo supervisorctl status eclipse-chat-server

echo "==> 7. Set ownership"
sudo chown -R www-data:www-data "$DEPLOY_PATH/apps/server/dist"
sudo chown -R www-data:www-data "$DEPLOY_PATH/apps/web/dist"
sudo chown -R www-data:www-data "$DEPLOY_PATH/apps/server/prisma"
sudo chown www-data:www-data "$DEPLOY_PATH/apps/server/.env"
sudo chmod 600 "$DEPLOY_PATH/apps/server/.env"

echo ""
echo "INITIAL SETUP COMPLETE"
echo "Test: curl https://app.star-crm.ru/eclipse-chat/api/health"
