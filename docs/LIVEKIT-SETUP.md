# Eclipse Chat — LiveKit voice setup на prod

Полное руководство по запуску self-hosted LiveKit на VPS Star CRM
для голосовых каналов Eclipse Chat.

## Что мы строим

| Компонент | Где живёт | Порты |
|---|---|---|
| LiveKit server (Docker) | `127.0.0.1` на host (network_mode: host) | 7880 (signal HTTP), 7881 (TCP fallback), 7882 (UDP single-port), 50000-50200 (UDP range — media) |
| LiveKit Redis (Docker) | `127.0.0.1:6379` | localhost only |
| nginx WSS proxy | существующий `app.star-crm.ru` | path `^~ /eclipse-chat/livekit` → `127.0.0.1:7880` |
| Backend JWT | `apps/server/src/routes/voice.ts` | через nginx → eclipse-chat-server |
| Frontend `livekit-client` | `apps/web` | через WSS на `wss://app.star-crm.ru/eclipse-chat/livekit` |

Голосовая media идёт **напрямую** между browser и LiveKit-сервером через
UDP-порты (7882 + 50000-50200), bypass'ая nginx. Это правильно — UDP не
proxy'ится HTTP-сервером.

## Pre-flight

На VPS должно быть установлено:

- Docker + Docker Compose (`docker --version`, `docker compose version`)
- nginx (уже есть — Star CRM uses it)
- UFW (стандартно)
- Публичный IP сервера cv6067007 — нужен для NAT traversal

```bash
docker --version           # должен быть 20.10+
docker compose version     # должен быть v2+
ip -4 addr show eth0       # узнать public IP
```

## Step 1 — Подготовка LiveKit конфига

```bash
ssh root@cv6067007
cd /var/www/eclipse-chat/deploy/livekit
cp livekit.yaml.example livekit.yaml
```

**Сгенерировать API key + secret** (одной командой, через сам LiveKit-контейнер):

```bash
docker run --rm livekit/livekit-server generate-keys
# Получишь:
# API Key: APIxxxxxxxxxxxxxxxxx
# API Secret: secretxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Внести их в `livekit.yaml` — секция `keys`:

```yaml
keys:
  APIxxxxxxxxxxxxxxxxx: secretxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

И в `rtc.use_external_ip: true` — оставить как есть; LiveKit сам определит
external IP при первом запуске.

## Step 2 — Открыть UDP порты в UFW

```bash
sudo ufw allow 7881/udp   comment 'LiveKit TCP fallback'
sudo ufw allow 7882/udp   comment 'LiveKit WebRTC single-port'
sudo ufw allow 50000:50200/udp comment 'LiveKit WebRTC media range'
sudo ufw reload
sudo ufw status numbered  # verify
```

⚠️ **Без UDP портов voice не работает** — только signal-канал (WSS)
будет connect'нут, media tracks не пройдут.

## Step 3 — Запустить LiveKit Docker

```bash
cd /var/www/eclipse-chat/deploy/livekit
docker compose -f docker-compose.livekit.yml pull
docker compose -f docker-compose.livekit.yml up -d
docker compose -f docker-compose.livekit.yml logs -f livekit
# жми Ctrl+C когда увидишь "starting LiveKit server" + "rtc server starting"
```

Проверь healthcheck:

```bash
curl -s http://127.0.0.1:7880   # должен ответить, не 404
docker ps | grep livekit         # eclipse-livekit RUNNING (healthy)
```

## Step 4 — nginx WSS proxy

```bash
sudo cp /var/www/eclipse-chat/deploy/livekit/nginx.livekit.conf \
        /etc/nginx/snippets/eclipse-chat-livekit.conf
```

Подключить в `/etc/nginx/sites-enabled/app-star-crm.conf` **внутри**
existing `server` блока, желательно рядом с `include eclipse-chat.conf;`:

```nginx
include /etc/nginx/snippets/eclipse-chat-livekit.conf;
```

Тест + reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Проверь:

```bash
# Должен вернуть либо 426 Upgrade Required (хорошо, signal canal),
# либо handshake-error, но НЕ 404/502.
curl -s -o /dev/null -w "%{http_code}\n" https://app.star-crm.ru/eclipse-chat/livekit
```

## Step 5 — Backend env vars

```bash
cd /var/www/eclipse-chat
cat >> apps/server/.env <<'EOF'

# LiveKit voice
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=secretxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LIVEKIT_WS_URL=wss://app.star-crm.ru/eclipse-chat/livekit
EOF
```

Перезапустить supervisor:

```bash
sudo supervisorctl restart eclipse-chat-server
sudo supervisorctl status eclipse-chat-server
```

## Step 6 — Smoke test (backend готов?)

```bash
# Открытый health endpoint показывает что LiveKit env настроен
curl -s https://app.star-crm.ru/eclipse-chat/api/voice/health
# должен вернуть: {"enabled":true,"wsUrl":"wss://app.star-crm.ru/eclipse-chat/livekit"}

# JWT issuance — требует auth. Test'и из browser DevTools под залогиненным user'ом:
fetch('/eclipse-chat/api/channels/<voice-channel-id>/voice/join', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + localStorage.getItem('eclipse_chat_access') }
}).then(r => r.json()).then(console.log);
# Должен вернуть { wsUrl, token, roomName, identity, metadata }
```

## Step 7 — Frontend integration (v0.5.3.2 — следующий PR)

После Step 1-6 готовы, frontend будет требовать `livekit-client`:

```bash
cd /var/www/eclipse-chat
npm install --workspace apps/web livekit-client
npm run build
sudo supervisorctl restart eclipse-chat-server
```

Затем приходит follow-up PR от Claude с реальным `VoiceRoom` компонентом
который заменит `VoicePlaceholder` для voice channels.

## Сetup checklist

- [ ] Docker compose поднят, контейнер `eclipse-livekit` healthy
- [ ] UFW open: 7881/udp, 7882/udp, 50000:50200/udp
- [ ] `livekit.yaml` keys сгенерированы и внесены
- [ ] nginx snippet подключён, `nginx -t` clean, reload OK
- [ ] `/api/voice/health` → `enabled: true`
- [ ] `apps/server/.env` имеет LIVEKIT_API_KEY/SECRET/WS_URL
- [ ] supervisor restart прошёл, `/api/version` всё ещё 0.5.0
- [ ] Готов к Step 7 (livekit-client install + frontend PR)

## Troubleshooting

**LiveKit container restart loop:**
- `docker logs eclipse-livekit` — проверь livekit.yaml синтаксис
- Если "address already in use" — порт 7880 занят, проверь `ss -tlnp | grep 7880`

**Backend logs "Voice service not configured" → 503 на /voice/join:**
- `apps/server/.env` не подхватился. Проверь supervisorctl restart прошёл,
  посмотри `sudo supervisorctl tail -100 eclipse-chat-server`. Должно быть
  «LIVEKIT_WS_URL» в env.

**nginx 502 на /eclipse-chat/livekit:**
- LiveKit Docker не запущен ИЛИ port 7880 не listen на 127.0.0.1.
  `curl http://127.0.0.1:7880` должен ответить.

**Voice connects но media tracks не идут:**
- UFW не открыт. Проверь `sudo ufw status numbered`.
- ИЛИ external IP неверный в livekit.yaml. Перезапусти контейнер,
  LiveKit logs покажут детектированный external IP.

## Стоимость / нагрузка

LiveKit на single VPS — до ~20 одновременных participants в комнате без
проблем. Дальше — нужен dedicated LiveKit VPS (или Cloud сервис livekit.io).
Для Eclipse Chat MVP (несколько одновременных voice channels с 2-5 человек)
ресурсов Star CRM VPS более чем достаточно. RAM использование ~50-100 MB,
CPU пик при активных tracks 5-15%.
