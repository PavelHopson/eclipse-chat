# Eclipse Chat — Local Development

Гайд по локальной разработке. С v0.6 (commit `<TBD-Phase1>`) перешли
с SQLite на **PostgreSQL** — нативные enum'ы, миграции через
`prisma migrate dev`, готовность к production-deploy. Production
deployment на свой сервер описан в
[docs/DEPLOY-TO-STAR-CRM.md](DEPLOY-TO-STAR-CRM.md).

---

## Требования

- **Node.js 20+** (рекомендуется LTS)
- **npm 10+** (идёт с Node.js)
- **PostgreSQL 14+** (нативно или через docker-compose.dev.yml в корне репо)
- **Git**

> **SQLite больше не поддерживается** для local dev (с v0.6). Если ты на старой
> версии и хочешь продолжать на SQLite — checkout commit `2b4ddfd` (последний с SQLite).

---

## Local PG setup — два пути

### Путь A — нативный PostgreSQL (рекомендую если PG уже стоит)

```bash
# Создать БД и user
psql -U postgres <<'SQL'
CREATE USER eclipse_chat_dev WITH PASSWORD 'dev_password';
CREATE DATABASE eclipse_chat_dev OWNER eclipse_chat_dev;
GRANT ALL PRIVILEGES ON DATABASE eclipse_chat_dev TO eclipse_chat_dev;
SQL

# Проверить что подключение работает
psql -U eclipse_chat_dev -d eclipse_chat_dev -h localhost -c "SELECT version();"
```

DATABASE_URL для `.env`:
```
DATABASE_URL="postgresql://eclipse_chat_dev:dev_password@localhost:5432/eclipse_chat_dev?schema=public"
```

### Путь B — Docker (если нет нативного PG)

```bash
# В корне репо
docker compose -f docker-compose.dev.yml up postgres -d
```

DATABASE_URL для `.env` (порт **5433**, не 5432 — чтобы не конфликтовать с нативным PG):
```
DATABASE_URL="postgresql://eclipse_chat_dev:dev_password@localhost:5433/eclipse_chat_dev?schema=public"
```

---

## Первый запуск

```bash
git clone https://github.com/PavelHopson/eclipse-chat.git
cd eclipse-chat

# 1. Установка зависимостей всех workspaces (запускает prisma generate)
npm install

# 2. .env для бэкенда — взять из примера, поправить под свой PG
cp apps/server/.env.example apps/server/.env
# Обязательно проверь:
#   DATABASE_URL  — подключение к Postgres (см. "Local PG setup" выше)
#   JWT_SECRET    — любая случайная строка для dev (в проде ≥32 символа)

# 3. Создать таблицы в PG и applied initial migration
npm run db:migrate
# При первом запуске Prisma спросит имя миграции — введи "init" (или
# любое другое осмысленное), он создаст apps/server/prisma/migrations/<timestamp>_init/

# 4. Засидить начальный канал #general + Default Server + system user
npm run db:seed
```

После этого PG-БД готова, в ней:
- `User` — 1 system user (для миграции legacy channels)
- `Server` — 1 «Default Server»
- `Channel` — 1 `#general` в Default Server
- `Member` — 1 (system user как OWNER Default Server)

---

## Запуск (два терминала)

### Терминал 1 — backend

```bash
npm run dev:server
```

Запускает Fastify на `http://localhost:3001` через `tsx watch`.
Авто-перезапуск при изменении TS-файлов.

Проверка:
```bash
curl http://localhost:3001/api/health
# {"ok":true,"service":"eclipse-chat-server","database":true}
```

### Терминал 2 — frontend

```bash
npm run dev:web
```

Запускает Vite dev-сервер на `http://localhost:5173` с proxy:
- `/api/*` → `http://127.0.0.1:3001`
- `/socket.io` → `http://127.0.0.1:3001` (с WebSocket upgrade)

Открой `http://localhost:5173` — MVP UI работает.

---

## Полезные команды

| Команда (из корня) | Что делает |
|---|---|
| `npm run typecheck` | TypeScript-проверка всех workspaces |
| `npm run build` | Production build обоих workspaces (`apps/server/dist`, `apps/web/dist`). **Frontend читает `apps/web/.env.production`** — там `VITE_BASE_PATH=/eclipse-chat/` для path-based deploy на Star CRM сервер. |
| `npm run dev:server` | Backend в watch-режиме на :3001 |
| `npm run dev:web` | Frontend (Vite) на :5173, base = `/` (dev-mode не читает `.env.production`) |
| `npm run db:migrate` | **(dev)** Применить новые изменения schema.prisma. Создаст SQL-миграцию в `prisma/migrations/<timestamp>_<name>/`. |
| `npm run db:migrate:deploy` | **(prod)** Применить existing migrations без создания новых. Используется на серверe. |
| `npm run db:push` | Применить schema **без миграций** (быстро, но не для prod). Используй только для experimental schema changes. |
| `npm run db:seed` | Засидить начальные данные (#general канал + Default Server) |
| `npm run db:studio` | GUI для просмотра PG БД на http://localhost:5555 |

### Base path в production build

Eclipse Chat планируется деплоить **под-путём** на существующий сервер (например `https://app.star-crm.ru/eclipse-chat/`). Чтобы все ассеты, REST-запросы и Socket.io получали правильный prefix, frontend читает `VITE_BASE_PATH` из env при build.

Значение **должно заканчиваться `/`** (Vite требование).

- **По умолчанию для prod build** (`apps/web/.env.production`): `VITE_BASE_PATH=/eclipse-chat/`
- **Override:** создать `apps/web/.env.production.local` (gitignored) или передать через CI env. Например для своего root-domain: `VITE_BASE_PATH=/`
- **Dev mode** (`npm run dev:web`): значение игнорируется, base всегда `/`

**Только в `apps/server`:**

| Команда | Что делает |
|---|---|
| `npm run db:generate -w @eclipse-chat/server` | Сгенерировать Prisma Client |
| `npm run db:studio -w @eclipse-chat/server` | GUI для просмотра БД (http://localhost:5555) |

---

## .env переменные (apps/server)

| Переменная | Default | Описание |
|---|---|---|
| `JWT_SECRET` | `dev-insecure-eclipse-chat` (dev only) | **Обязательно** в production. Подпись JWT. |
| `DATABASE_URL` | — (обязательно) | Prisma connection string. Для SQLite: `file:./prisma/dev.db` |
| `CORS_ORIGIN` | `http://localhost:5173` | Какому origin'у разрешать CORS + Socket.io. |
| `PORT` | `3001` | На каком порту слушать. |
| `NODE_ENV` | undefined | Если `production` и `JWT_SECRET` не задан — bootstrap упадёт. |

---

## Структура БД (PostgreSQL)

С v0.6: PG 14+ через `DATABASE_URL` в `.env`. Миграции через
`prisma migrate dev` — лежат в `apps/server/prisma/migrations/`.

Текущие таблицы:
- `User` — учётки
- `RefreshToken` — refresh-токены (хеш SHA-256)
- `Server` — серверы (контейнер каналов и членов)
- `Member` — членство пользователя в сервере (с native enum `MemberRole`)
- `Channel` — каналы внутри сервера (`serverId` теперь NOT NULL)
- `Message` — сообщения

Native enum:
- `MemberRole`: `OWNER | ADMIN | MODERATOR | MEMBER`

Schema: `apps/server/prisma/schema.prisma`.

**Очистить dev-данные:**
```bash
# Дроп БД и пересоздать
psql -U postgres -c "DROP DATABASE eclipse_chat_dev;"
psql -U postgres -c "CREATE DATABASE eclipse_chat_dev OWNER eclipse_chat_dev;"
npm run db:migrate
npm run db:seed
```

Или (если используешь Docker):
```bash
docker compose -f docker-compose.dev.yml down -v postgres
docker compose -f docker-compose.dev.yml up postgres -d
npm run db:migrate
npm run db:seed
```

**Посмотреть содержимое:**
```bash
npm run db:studio
# Откроется http://localhost:5555
```

---

## Production deployment

**На сейчас не готово.** Когда-то планировалось:
- Docker Compose с PostgreSQL + Redis + MinIO + Caddy
- HTTPS через Caddy auto-cert
- Production-grade observability

Реальное состояние: **отложено в [ROADMAP § v1.4](../ROADMAP.md#v14--производственный-deployment)**.
Сейчас работающий MVP запускается только локально через `npm run dev:*`.

Чтобы не было соблазна запустить недописанный MVP «на проде» —
никакого `docker compose up` в этом репо пока **нет**. Это honest scope.

---

## Troubleshooting

### `JWT_SECRET is required in production`

`NODE_ENV=production` + не задан `JWT_SECRET`. В dev оставь
`NODE_ENV` пустым.

### `EADDRINUSE :::3001`

Backend уже запущен в другом терминале. Останови (`Ctrl+C`) или
поменяй `PORT` в `.env`.

### `Prisma Client did not initialize yet`

Не выполнен `npm run db:migrate` либо `prisma generate` (запускается
автоматически на `postinstall`, но иногда падает на медленных дисках).

Решение:
```bash
npm run db:generate -w @eclipse-chat/server
```

### `database "eclipse_chat_dev" does not exist`

PG запущен, но БД не создана. Выполни SQL из § "Local PG setup".

### `password authentication failed for user "eclipse_chat_dev"`

Проверь:
1. `DATABASE_URL` в `apps/server/.env` совпадает с настройками PG
2. Если PG нативный — права у `eclipse_chat_dev` пользователя:
   `psql -U postgres -c "ALTER USER eclipse_chat_dev WITH PASSWORD 'dev_password';"`
3. `pg_hba.conf` разрешает `localhost` подключения с password (по умолчанию — да)

### `Migration <name> failed to apply cleanly`

Обычно при рассинхроне `prisma/migrations/` и реальной БД. Самый
безопасный путь — пересоздать БД (см. "Очистить dev-данные").

### WebSocket не подключается

Проверь:
1. Backend живой (`curl http://localhost:3001/api/health`)
2. Vite proxy жив (в логах frontend'а должен быть `/socket.io -> proxy`)
3. В DevTools → Network → WS — есть `socket.io/?EIO=4&transport=websocket`
   с кодом 101 Switching Protocols.

### Авторизация даёт 401 после ~15 минут

Это **ожидаемо** — access TTL = 15 мин. Frontend MVP делает auto-refresh
при 401 (`doRefresh()` в `App.tsx`). Если refresh тоже истёк (>7 дней) —
relogin обязателен.

---

_Updated 2026-05-11 — заменяет старый `DEPLOYMENT.md`, который описывал
несуществующий Docker/PG/Caddy/MinIO стек. Production deployment
перенесён в [ROADMAP § v1.4](../ROADMAP.md#v14--производственный-deployment)._
