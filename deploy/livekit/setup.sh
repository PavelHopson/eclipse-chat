#!/usr/bin/env bash
# Eclipse Chat — LiveKit one-command setup на prod VPS (Star CRM).
#
# Что делает:
#   1. Генерирует API key/secret через `livekit-server generate-keys`
#   2. Создаёт livekit.yaml из template + подставляет ключи
#   3. Pulls + поднимает Docker compose (LiveKit + Redis)
#   4. Открывает UFW порты 7881/7882/udp + 50000-50200/udp
#   5. Копирует nginx snippet в /etc/nginx/snippets/
#   6. Вставляет include в /etc/nginx/sites-enabled/app-star-crm.conf
#   7. Тестирует nginx config + reload
#   8. Дописывает LIVEKIT_* env vars в apps/server/.env
#   9. Перезапускает supervisor
#  10. Smoke-test /api/voice/health → {enabled: true}
#
# Запуск:
#   cd /var/www/eclipse-chat/deploy/livekit
#   sudo bash setup.sh
#
# Идемпотентность: повторный запуск **не** перегенерит keys (использует
# существующий livekit.yaml). Все nginx/ufw/env проверки skipped если
# уже сделано.

set -euo pipefail

LIVEKIT_DIR="/var/www/eclipse-chat/deploy/livekit"
ENV_FILE="/var/www/eclipse-chat/apps/server/.env"
NGINX_SNIPPETS="/etc/nginx/snippets"
NGINX_SITE="/etc/nginx/sites-enabled/app-star-crm.conf"
WS_URL="wss://app.star-crm.ru/eclipse-chat/livekit"

c_blue() { printf "\033[1;34m%s\033[0m\n" "$*"; }
c_green() { printf "\033[1;32m%s\033[0m\n" "$*"; }
c_red() { printf "\033[1;31m%s\033[0m\n" "$*"; }
c_yellow() { printf "\033[1;33m%s\033[0m\n" "$*"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    c_red "Запусти под root: sudo bash setup.sh"
    exit 1
  fi
}

require_root

# --- 1. livekit.yaml ----------------------------------------------------------
c_blue "[1/10] LiveKit конфиг и ключи..."
cd "$LIVEKIT_DIR"

if [ -f "livekit.yaml" ] && grep -q "^  API" livekit.yaml 2>/dev/null; then
  c_yellow "  livekit.yaml уже существует с keys — skip генерации"
  API_KEY=$(grep -E "^  API" livekit.yaml | head -1 | awk '{print $1}' | tr -d ':')
  API_SECRET=$(grep -E "^  API" livekit.yaml | head -1 | awk '{print $2}')
else
  c_blue "  Генерирую API key/secret..."
  GEN_OUTPUT=$(docker run --rm livekit/livekit-server generate-keys 2>&1)
  API_KEY=$(echo "$GEN_OUTPUT" | grep -i "API Key" | awk '{print $NF}')
  API_SECRET=$(echo "$GEN_OUTPUT" | grep -i "API Secret" | awk '{print $NF}')
  if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    c_red "  Не удалось распарсить keys из generate-keys output:"
    echo "$GEN_OUTPUT"
    exit 1
  fi
  c_green "  Key: $API_KEY"

  cp livekit.yaml.example livekit.yaml
  # Заменяем placeholder keys
  sed -i "s|APIxxxxxxxxxxxxxxxxx: secretxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx|${API_KEY}: ${API_SECRET}|" livekit.yaml
  c_green "  livekit.yaml создан"
fi

# --- 2. UFW открытие портов --------------------------------------------------
c_blue "[2/10] UFW порты..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 7881/udp comment 'LiveKit TCP fallback' >/dev/null 2>&1 || true
  ufw allow 7882/udp comment 'LiveKit WebRTC single-port' >/dev/null 2>&1 || true
  ufw allow 50000:50200/udp comment 'LiveKit media range' >/dev/null 2>&1 || true
  ufw reload >/dev/null 2>&1 || true
  c_green "  UFW: 7881/udp, 7882/udp, 50000-50200/udp открыты"
else
  c_yellow "  UFW не установлен — пропускаем (убедись firewall сам открыт)"
fi

# --- 3. Docker compose -------------------------------------------------------
c_blue "[3/10] LiveKit Docker compose..."
docker compose -f docker-compose.livekit.yml pull
docker compose -f docker-compose.livekit.yml up -d
sleep 3
if docker ps --filter "name=eclipse-livekit" --format '{{.Status}}' | grep -q "Up"; then
  c_green "  eclipse-livekit RUNNING"
else
  c_red "  Контейнер не поднялся — смотри docker logs eclipse-livekit"
  exit 1
fi

# --- 4. nginx snippet --------------------------------------------------------
c_blue "[4/10] nginx WSS snippet..."
cp nginx.livekit.conf "$NGINX_SNIPPETS/eclipse-chat-livekit.conf"
if grep -q "eclipse-chat-livekit" "$NGINX_SITE" 2>/dev/null; then
  c_yellow "  include уже в $NGINX_SITE — skip"
else
  # Вставляем include после существующего include eclipse-chat.conf
  if grep -q "eclipse-chat.conf" "$NGINX_SITE"; then
    sed -i "/include.*eclipse-chat\.conf/a\\    include /etc/nginx/snippets/eclipse-chat-livekit.conf;" "$NGINX_SITE"
    c_green "  include добавлен в $NGINX_SITE"
  else
    c_red "  Не нашёл include eclipse-chat.conf в $NGINX_SITE — добавь LiveKit include вручную"
  fi
fi

# --- 5. nginx test + reload --------------------------------------------------
c_blue "[5/10] nginx test + reload..."
if nginx -t 2>&1 | grep -q "successful"; then
  systemctl reload nginx
  c_green "  nginx reloaded"
else
  c_red "  nginx config invalid — НЕ reloading. Запусти 'nginx -t' для деталей"
  exit 1
fi

# --- 6. backend env vars -----------------------------------------------------
c_blue "[6/10] Backend env vars..."
if grep -q "LIVEKIT_API_KEY" "$ENV_FILE" 2>/dev/null; then
  c_yellow "  LIVEKIT_* уже в .env — обновляю значения"
  sed -i "s|^LIVEKIT_API_KEY=.*|LIVEKIT_API_KEY=$API_KEY|" "$ENV_FILE"
  sed -i "s|^LIVEKIT_API_SECRET=.*|LIVEKIT_API_SECRET=$API_SECRET|" "$ENV_FILE"
  sed -i "s|^LIVEKIT_WS_URL=.*|LIVEKIT_WS_URL=$WS_URL|" "$ENV_FILE"
else
  cat >> "$ENV_FILE" <<EOF

# LiveKit voice (auto-added by setup.sh)
LIVEKIT_API_KEY=$API_KEY
LIVEKIT_API_SECRET=$API_SECRET
LIVEKIT_WS_URL=$WS_URL
EOF
  c_green "  LIVEKIT_* добавлены в $ENV_FILE"
fi

# --- 7. supervisor restart ---------------------------------------------------
c_blue "[7/10] supervisorctl restart eclipse-chat-server..."
supervisorctl restart eclipse-chat-server >/dev/null
sleep 2
if supervisorctl status eclipse-chat-server | grep -q "RUNNING"; then
  c_green "  eclipse-chat-server RUNNING"
else
  c_red "  Supervisor не запустил — смотри supervisorctl tail eclipse-chat-server stderr"
  exit 1
fi

# --- 8. smoke test -----------------------------------------------------------
c_blue "[8/10] Smoke test /api/voice/health..."
sleep 1
HEALTH=$(curl -fsS "https://app.star-crm.ru/eclipse-chat/api/voice/health" 2>&1 || echo "FAILED")
echo "  $HEALTH"
if echo "$HEALTH" | grep -q "\"enabled\":true"; then
  c_green "  /api/voice/health → enabled: true ✓"
else
  c_red "  /api/voice/health не показывает enabled:true — что-то не так"
  exit 1
fi

# --- 9. summary --------------------------------------------------------------
echo
c_green "════════════════════════════════════════════"
c_green "  LiveKit готов. Голосовые каналы активны."
c_green "════════════════════════════════════════════"
echo
echo "API Key (для записи на всякий случай):"
echo "  $API_KEY"
echo
echo "Что проверить в браузере:"
echo "  1. Открой https://app.star-crm.ru/eclipse-chat/ (инкогнито)"
echo "  2. Зайди в Голосовой канал"
echo "  3. Должен видеть VoiceRoom UI (не Placeholder)"
echo "  4. Click 'Подключиться' → разреши mic в browser"
echo "  5. Открой во втором окне с другим user'ом → тоже join"
echo "  6. Должны слышать друг друга"
echo
