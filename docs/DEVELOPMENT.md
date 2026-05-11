# Eclipse Chat — Local Development

Гайд по локальной разработке текущего MVP. Production deployment
(Docker Compose, Caddy, PostgreSQL, MinIO) — **в roadmap**, см.
[ROADMAP § v1.4](../ROADMAP.md#v14--производственный-deployment).

---

## Требования

- Node.js 20+ (рекомендуется LTS)
- npm 10+ (идёт с Node.js)
- Git

**Не нужно:** Docker, PostgreSQL, Redis — для MVP используется SQLite
файлом на диске.

---

## Первый запуск

```bash
git clone https://github.com/PavelHopson/eclipse-chat.git
cd eclipse-chat

# 1. Установка зависимостей всех workspaces
npm install

# 2. .env для бэкенда
cp apps/server/.env.example apps/server/.env
# Открой и подставь:
#   JWT_SECRET=<любая случайная строка ≥32 символа>
#   DATABASE_URL=file:./prisma/dev.db
#   CORS_ORIGIN=http://localhost:5173
#   PORT=3001 (опционально)

# 3. Создать таблицы в SQLite
npm run db:push

# 4. Засидить начальный канал #general
npm run db:seed
```

После этого `apps/server/prisma/dev.db` создан и в нём один канал.

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
| `npm run build` | Production build обоих workspaces (`apps/server/dist`, `apps/web/dist`) |
| `npm run dev:server` | Backend в watch-режиме на :3001 |
| `npm run dev:web` | Frontend (Vite) на :5173 |
| `npm run db:push` | Применить `schema.prisma` к SQLite (без миграций) |
| `npm run db:seed` | Засидить начальные данные (канал #general) |

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

## Структура БД (SQLite)

Файл: `apps/server/prisma/dev.db` (в `.gitignore`).

Текущие таблицы:
- `User` — учётки
- `RefreshToken` — refresh-токены (хеш SHA-256)
- `Channel` — каналы
- `Message` — сообщения

Schema: `apps/server/prisma/schema.prisma`.

**Очистить dev-данные:**
```bash
rm apps/server/prisma/dev.db
npm run db:push
npm run db:seed
```

**Посмотреть содержимое:**
```bash
npm run db:studio -w @eclipse-chat/server
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

Не выполнен `npm run db:push` либо `prisma generate` (запускается
автоматически на `postinstall`, но иногда падает на медленных дисках).

Решение:
```bash
npm run db:generate -w @eclipse-chat/server
```

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
