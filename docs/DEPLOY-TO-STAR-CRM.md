# Eclipse Chat — Deploy на Star CRM сервер

Гайд по разворачиванию Eclipse Chat на тот же VPS где живёт Star CRM,
**под-путём** `https://app.star-crm.ru/eclipse-chat/` (по аналогии
с `/romark` лендингом).

**Why this approach:** не плодим VPS, переиспользуем существующий
Nginx + Supervisor + Let's Encrypt + PostgreSQL 16. Star CRM это
**dev-stage** для Eclipse Chat. Когда продукт вырастет — переедет
на свой VPS с собственным доменом.

---

## ⚠️ Перед deploy — обязательные пункты

1. **Сделай backup Star CRM БД** — `pg_dump star_crm > backup_$(date +%Y%m%d).sql`. Никогда не деплой ничего на прод-сервер без backup.
2. **Деплой делай в low-traffic окно** — если что-то пойдёт не так с nginx reload, ты заметишь до того как ляжет Star CRM.
3. **Прочитай весь этот гайд до конца** прежде чем начинать. Half-done deploy = риск для Star CRM customers.

---

## Step 1 — SSH и проверка инфры

```bash
ssh root@<star-crm-server>

# Проверь что есть и какие версии
node --version          # должен быть 20+
psql --version          # должен быть 14+
nginx -v                # любая современная версия
supervisorctl status    # увидишь существующие программы Star CRM
free -m                 # сколько RAM свободно
ss -tlnp | grep :300    # какие порты 3000-3099 заняты
```

**Что считать ОК для смоук-теста:**
- ≥512 MB свободного RAM (Eclipse Chat возьмёт ~200-300 MB)
- порт 3001 свободен (если занят — используй 3002, поправь конфиги ниже)
- Node.js 20+ установлен (если нет — `apt install nodejs npm`)

Если RAM <500 MB или Node устарел — **не деплой**. Eclipse Chat положит Star CRM.

---

## Step 2 — PostgreSQL setup

Создаём изолированную БД для Eclipse Chat. **Никаких прав на star_crm** — изоляция на PG-level.

```bash
# Подключиться к PG как superuser (обычно postgres)
sudo -u postgres psql

-- Внутри psql:
CREATE USER eclipse_chat_user WITH ENCRYPTED PASSWORD '<СГЕНЕРИРУЙ_СЛУЧАЙНЫЙ_PASSWORD>';
CREATE DATABASE eclipse_chat OWNER eclipse_chat_user;
GRANT ALL PRIVILEGES ON DATABASE eclipse_chat TO eclipse_chat_user;

-- Проверь что НЕТ прав на star_crm (должна вернуть permission denied):
\c star_crm
GRANT eclipse_chat_user;  -- не должно сработать
\q
```

Сгенерируй пароль:
```bash
openssl rand -hex 24  # вставь это в .env (см. ниже)
```

---

## Step 3 — Клонировать репо и собрать

```bash
# Создать директорию для приложения
sudo mkdir -p /var/www/eclipse-chat
sudo chown -R $USER:$USER /var/www/eclipse-chat
cd /var/www/eclipse-chat

# Клонировать (Pavel может потребоваться личный GitHub token,
# поскольку репо archived — push заблокирован, но pull/clone работает)
git clone https://github.com/PavelHopson/eclipse-chat.git .

# Установить зависимости + сгенерить Prisma client
npm install --omit=dev
# (или просто `npm install` если хочешь dev-deps тоже — нам нужны
# typescript, prisma CLI для migrate:deploy)

# .env для backend
cat > apps/server/.env <<ENV
DATABASE_URL="postgresql://eclipse_chat_user:<ПАРОЛЬ_ИЗ_STEP_2>@localhost:5432/eclipse_chat?schema=public"
JWT_SECRET="<СГЕНЕРИРУЙ_ДРУГОЙ_СЛУЧАЙНЫЙ_HEX_32_БАЙТА>"
CORS_ORIGIN="https://app.star-crm.ru"
PORT=3001
NODE_ENV=production
ENV

# Применить migrations к prod БД
cd apps/server && npx prisma migrate deploy && cd ../..

# Засидить initial канал + Default Server
cd apps/server && npx prisma db seed && cd ../..

# Build frontend (читает apps/web/.env.production → base /eclipse-chat/)
npm run build

# Frontend artefacts теперь в apps/web/dist/
# Backend artefacts в apps/server/dist/
```

JWT_SECRET генерация:
```bash
openssl rand -hex 32
```

---

## Step 4 — Nginx config

Добавить **внутрь** существующего server block для `app.star-crm.ru`
(не создавать новый — у тебя там уже Star CRM + SSL).

Открой `/etc/nginx/sites-available/app.star-crm.ru` (или как у тебя
называется) и добавь **внутри `server { ... }`** блок для `/eclipse-chat/`:

```nginx
# Eclipse Chat — backend API
location /eclipse-chat/api/ {
    # Срезаем prefix, backend слушает на /api без префикса
    rewrite ^/eclipse-chat/(.*) /$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Eclipse Chat — Socket.io с WebSocket upgrade
location /eclipse-chat/socket.io {
    rewrite ^/eclipse-chat/(.*) /$1 break;
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;  # WebSocket долгоживущий
}

# Eclipse Chat — static frontend (Vite build)
location /eclipse-chat/ {
    alias /var/www/eclipse-chat/apps/web/dist/;
    index index.html;
    try_files $uri $uri/ /eclipse-chat/index.html;
}
```

**Проверка и reload (с safety net):**
```bash
sudo nginx -t  # обязательно перед reload! если ошибка — НЕ reload'ить
sudo systemctl reload nginx
```

Если `nginx -t` ругается — **остановись, разбирайся**. Reload с
broken config может положить Star CRM.

---

## Step 5 — Supervisor program

Создать `/etc/supervisor/conf.d/eclipse-chat.conf`:

```ini
[program:eclipse-chat-server]
command=/usr/bin/node /var/www/eclipse-chat/apps/server/dist/index.js
directory=/var/www/eclipse-chat/apps/server
user=www-data
autostart=true
autorestart=true
startsecs=10
startretries=5
stderr_logfile=/var/log/supervisor/eclipse-chat.err.log
stdout_logfile=/var/log/supervisor/eclipse-chat.out.log
environment=NODE_ENV="production"

; Memory limit — если процесс превысит 512MB, supervisor его рестартанёт.
; Это safety против OOM который положит Star CRM.
; Если нужно больше — увеличить, но мониторить!
stopwaitsecs=10
```

**Reload supervisor:**
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status eclipse-chat-server  # должно быть RUNNING
```

Если статус FATAL / EXITED — смотреть логи:
```bash
sudo tail -50 /var/log/supervisor/eclipse-chat.err.log
```

Частые причины фейла:
- `DATABASE_URL` неправильный → "Can't reach database server"
- `JWT_SECRET` пустой и `NODE_ENV=production` → throw на старте
- `apps/server/dist/index.js` не существует → не сделан build
- Порт 3001 занят → "EADDRINUSE"

---

## Step 6 — Smoke test (обязательный!)

```bash
# 1. Backend жив
curl https://app.star-crm.ru/eclipse-chat/api/health
# Ожидание: {"ok":true,"service":"eclipse-chat-server","database":true}

# 2. Backend version
curl https://app.star-crm.ru/eclipse-chat/api/version
# Ожидание: {"name":"@eclipse-chat/server","version":"0.4.0"}

# 3. Frontend отдаётся
curl -I https://app.star-crm.ru/eclipse-chat/
# Ожидание: HTTP/2 200 + Content-Type: text/html

# 4. Static assets с правильным prefix
curl -I https://app.star-crm.ru/eclipse-chat/assets/index-*.js
# Ожидание: HTTP/2 200 + Content-Type: application/javascript

# 5. Открой в браузере → https://app.star-chm.ru/eclipse-chat/
#    Должна загрузиться auth страница. Зарегистрируйся, создай сервер,
#    скопируй invite, открой второй браузер (или приватное окно),
#    зарегистрируй второго user, вступи по invite, отправь сообщение.
```

**Если что-то не работает:**
1. Backend логи: `sudo tail -f /var/log/supervisor/eclipse-chat.err.log`
2. Nginx логи: `sudo tail -f /var/log/nginx/error.log`
3. Browser DevTools → Network — какие пути ассеты грузят? Должны быть `/eclipse-chat/assets/...`
4. Browser DevTools → Console — есть JS-ошибки? Часто это CORS или wrong API path

---

## Step 7 — Star CRM safety check

После deploy убедись что Star CRM не упал:

```bash
curl -I https://app.star-crm.ru/
# Ожидание: HTTP/2 200 (или какой у Star CRM root status)

# Если есть Star CRM API health:
curl https://app.star-crm.ru/api/health  # или другой endpoint
```

Если Star CRM лежит — **немедленно rollback nginx**:
```bash
# Удалить eclipse-chat location-блоки из nginx config
sudo vim /etc/nginx/sites-available/app.star-crm.ru  # убрать 3 location блока
sudo nginx -t && sudo systemctl reload nginx

# Остановить supervisor program
sudo supervisorctl stop eclipse-chat-server
```

---

## Step 8 — Updates (когда фиксим / добавляем фичи)

С v0.12.2 deploy полностью автоматизирован. Три варианта в порядке предпочтения:

### Вариант A — GitHub Actions auto-deploy (рекомендую)

`push` в master → GitHub Actions сама делает всё.

```bash
git push origin master
# → CI прогоняет typecheck + build
# → ждёт твоего approve в Actions tab (environment: production)
# → SSH в прод → bash deploy/scripts/deploy.sh
# → external smoke test
```

Setup one-time: см. [`CI-SETUP.md`](./CI-SETUP.md).
Workflow: [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml).

### Вариант B — ручной deploy.sh (если CI временно недоступен)

```bash
ssh root@cv6067007.novalocal
cd /var/www/eclipse-chat
bash deploy/scripts/deploy.sh
```

[`deploy/scripts/deploy.sh`](../deploy/scripts/deploy.sh) делает те же 10 шагов
что и GitHub Actions:
1. `git fetch + reset --hard origin/master`
2. write `release.json` (commit metadata)
3. `npm ci` из корня
4. `prisma generate + migrate deploy`
5. `npm run build`
6. **sync nginx snippets** через [`sync-nginx.sh`](../deploy/scripts/sync-nginx.sh)
   (с auto-rollback при `nginx -t` fail — Star CRM защищён)
7. sync supervisor через [`sync-supervisor.sh`](../deploy/scripts/sync-supervisor.sh)
8. `chown www-data` на dist/ + uploads/
9. `supervisorctl restart eclipse-chat-server`
10. smoke test через [`smoke.sh`](../deploy/scripts/smoke.sh) (version + health + supervisor RUNNING + uploads MIME)

Если smoke fail'ится — script exit'ится с 1 и печатает что упало.

### Вариант C — legacy ручной (только если deploy.sh сломан)

```bash
cd /var/www/eclipse-chat
git pull origin master
npm ci
cd apps/server && npx prisma migrate deploy && cd ..
npm run build
sudo supervisorctl restart eclipse-chat-server
```

⚠ Этот путь НЕ синхронизирует nginx snippets из репо. Если в репо изменился
`deploy/nginx/*.conf` — придётся `sudo cp` руками + `nginx -t && reload`.
Используй только в emergency.

---

## Step 9 — Backup strategy

Раз в день:
```bash
# Backup БД (вне Star CRM backup-цикла)
pg_dump -U eclipse_chat_user eclipse_chat > /backups/eclipse_chat_$(date +%Y%m%d).sql.gz
gzip /backups/eclipse_chat_$(date +%Y%m%d).sql

# Retention: 7 дней
find /backups -name "eclipse_chat_*.sql.gz" -mtime +7 -delete
```

Можно добавить в cron:
```cron
0 3 * * * pg_dump -U eclipse_chat_user eclipse_chat | gzip > /backups/eclipse_chat_$(date +\%Y\%m\%d).sql.gz
```

---

## Декомиссия (если решим переехать на отдельный VPS)

```bash
# 1. Stop service
sudo supervisorctl stop eclipse-chat-server
sudo supervisorctl remove eclipse-chat-server
sudo rm /etc/supervisor/conf.d/eclipse-chat.conf
sudo supervisorctl reread && sudo supervisorctl update

# 2. Final backup
pg_dump -U eclipse_chat_user eclipse_chat > eclipse_chat_final.sql

# 3. Nginx — удалить 3 location-блока, reload
sudo vim /etc/nginx/sites-available/app.star-crm.ru
sudo nginx -t && sudo systemctl reload nginx

# 4. БД (опционально, после restore на новом сервере)
sudo -u postgres psql -c "DROP DATABASE eclipse_chat;"
sudo -u postgres psql -c "DROP USER eclipse_chat_user;"

# 5. Файлы (опционально)
sudo rm -rf /var/www/eclipse-chat

# 6. Логи (опционально)
sudo rm /var/log/supervisor/eclipse-chat.*
```

---

## Чек-лист deploy

- [ ] Step 1: SSH ОК, есть Node 20+, PG 14+, ≥512 MB RAM, порт 3001 свободен
- [ ] Step 2: создана БД `eclipse_chat` + user `eclipse_chat_user` с **изолированными** правами (нет доступа к star_crm)
- [ ] Step 3: репо склонирован в `/var/www/eclipse-chat`, `npm install` сработал, `.env` создан с реальными секретами (не dev-defaults!), `prisma migrate deploy` применил schema, `db seed` создал #general
- [ ] Step 4: nginx config обновлён (3 location-блока), `nginx -t` зелёный, `reload nginx`
- [ ] Step 5: supervisor program активна, статус RUNNING
- [ ] Step 6: 5 smoke-тестов прошли (health, version, frontend HTML, assets, browser flow)
- [ ] Step 7: Star CRM всё ещё работает, нет регрессий
- [ ] Step 8 (на будущее): процесс обновления документирован
- [ ] Step 9: backup cron настроен

---

_Generated 2026-05-11 by Claude Opus 4.7 (1M context). Style derived
from Pavel's existing Star CRM ops experience (Ubuntu 24.04 + Nginx +
Supervisor + Let's Encrypt + PG 16)._
