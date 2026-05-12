<div align="center">

# ⚡ Eclipse Chat

### Self-hosted communication core

**Серверы · Каналы · Сообщения · Realtime · Operator-friendly**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

> **Статус:** 🟢 **LIVE in production** (с 12.05.2026)
> → [`https://app.star-crm.ru/eclipse-chat/`](https://app.star-crm.ru/eclipse-chat/)
>
> v0.4 (Server / Member / invite end-to-end) завершён + path-based deploy
> на VPS Star CRM. Дальше — v0.5 UX polish (show password + user profile
> с avatar). Полная карта в [ROADMAP.md](ROADMAP.md).

</div>

---

## Что это

Eclipse Chat — self-hosted чат с прицелом на:

1. **Свои данные у владельца** — no cloud, no telemetry, no third-party SDK
2. **Каналы и серверы как control surface** — для команд и операторов
3. **Bot/operator-friendly архитектура** — Member может быть не только
   человеком, но и ботом/AI-агентом (см. §v0.10 в [ROADMAP](ROADMAP.md))
4. **Сначала текст и модель, потом голос/видео** — приоритет
   фундаментальной модели Server → Member → Channel → Message

Это **не Discord-клон**. Discord-визуал — это поверхность, под ней —
платформа для операторских workflow.

---

## Текущий стек (реальный, проверенный)

| Слой | Технологии |
|------|-----------|
| **Frontend** | React 19 · TypeScript 5 · Vite 6 · socket.io-client |
| **Backend** | Node.js · Fastify 5 · Socket.io 4 · Prisma 6 · JWT (`@fastify/jwt`) · zod |
| **БД** | SQLite (через Prisma) — migration на PostgreSQL в v0.6 |
| **Auth** | JWT access (15 мин) + refresh token (SHA-256 hash в БД, ротация) |

**Что в roadmap но ещё НЕТ:** PostgreSQL, Redis, MinIO, LiveKit, Tailwind,
Zustand, Docker Compose, Caddy — всё в [ROADMAP.md](ROADMAP.md).

---

## Структура (monorepo)

```
eclipse-chat/
├── apps/
│   ├── server/         — Fastify + Prisma + Socket.io backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   — 4 модели: User, RefreshToken, Channel, Message
│   │   │   └── seed.ts         — создаёт #general
│   │   ├── src/
│   │   │   ├── index.ts        — Fastify + Socket.io bootstrap
│   │   │   ├── db.ts           — Prisma client
│   │   │   ├── realtime.ts     — emit helpers (message:new)
│   │   │   ├── auth/
│   │   │   │   ├── refresh.ts      — refresh token hash/store/find/delete
│   │   │   │   └── socketAuth.ts   — JWT middleware для Socket.io
│   │   │   └── routes/
│   │   │       ├── auth.ts         — register / login / refresh / logout / me
│   │   │       └── channels.ts     — каналы и сообщения
│   │   └── package.json
│   └── web/            — React 19 SPA
│       ├── src/
│       │   ├── App.tsx           — MVP single-file (split в v0.5)
│       │   ├── main.tsx
│       │   └── index.css         — inline styles, без Tailwind пока
│       ├── vite.config.ts        — dev proxy /api + /socket.io → :3001
│       └── package.json
└── packages/
    └── shared/         — заглушка, наполнится в v0.4 (общие типы)
```

Корень — `package.json` с [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces).

---

## Что работает сейчас (Current MVP)

### Backend (`apps/server`)

- ✅ `GET /health` — service ping
- ✅ `GET /api/health` — ping + DB check
- ✅ `GET /api/version` — `@eclipse-chat/server v0.3.0`
- ✅ `POST /api/auth/register` — создаёт User + выдаёт access (15m) + refresh
- ✅ `POST /api/auth/login` — выдаёт access + refresh (инвалидирует все
  предыдущие refresh)
- ✅ `POST /api/auth/refresh` — body `{ refreshToken }`, ротирует refresh,
  выдаёт новую пару
- ✅ `POST /api/auth/logout` — отзывает все refresh-токены user'а
- ✅ `GET /api/auth/me` — текущий user по Bearer
- ✅ `GET /api/channels` — список всех каналов
- ✅ `POST /api/channels` — создание (со slug-генерацией + auto-retry на
  коллизии)
- ✅ `GET /api/channels/:id/messages?take=N` — последние N (max 100,
  default 50)
- ✅ `POST /api/channels/:id/messages` — отправка сообщения + Socket emit
- ✅ Socket.io: handshake auth через JWT, rooms `channel:${id}`,
  emit `message:new`, `channel:join`/`channel:leave`

**Refresh-токены хранятся как SHA-256 hash в БД** — это правильно,
исходный токен не утечёт даже при компрометации dev.db.

### Frontend (`apps/web`)

- ✅ Auth flow: вход / регистрация / logout / автоматический refresh при 401
- ✅ Список каналов + создание канала
- ✅ Выбор канала + загрузка истории + отправка сообщения
- ✅ Realtime: новые сообщения через Socket.io
- ✅ Token storage в localStorage с миграцией legacy ключа
  `eclipse_chat_token` → `eclipse_chat_access`

Сейчас весь web в одном `App.tsx` (557 строк). **Split в v0.5** —
см. [ROADMAP](ROADMAP.md).

---

## Запуск (local dev)

См. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — пошаговая инструкция.

Коротко:

```bash
# 1. .env
cp apps/server/.env.example apps/server/.env
# подставить JWT_SECRET и (опционально) CORS_ORIGIN

# 2. Подготовка БД (из корня)
npm install
npm run db:push      # создать таблицы SQLite
npm run db:seed      # канал #general

# 3. Два терминала
npm run dev:server   # :3001  Fastify + Socket.io
npm run dev:web      # :5173  Vite (proxy /api + /socket.io → :3001)
```

Открыть **http://localhost:5173** — там MVP UI.

---

## REST API и Socket.io

- [docs/API.md](docs/API.md) — все реализованные REST endpoints с
  примерами запросов/ответов
- [docs/SOCKET_EVENTS.md](docs/SOCKET_EVENTS.md) — все реализованные
  Socket.io события (правильный colon-naming: `channel:join`, `message:new`)

**Не реализованные events / endpoints** (servers, DMs, reactions,
files, typing, presence, edit/delete) — в [ROADMAP.md](ROADMAP.md).

---

## Prisma schema (реальная, не из планов)

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  displayName   String
  createdAt     DateTime       @default(now())
  messages      Message[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Channel {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  createdAt DateTime  @default(now())
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  content   String
  createdAt DateTime @default(now())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  channelId String
  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
}
```

**Будущее расширение** (`Server`, `Member`, `Reaction`, `DirectMessage`,
enums `MemberRole`/`ChannelType`/`UserStatus`) — в
[ROADMAP § v0.4](ROADMAP.md#v04--server--member--invite-next-in-progress).

---

## Скрипты

| Команда (из корня) | Описание |
|---|---|
| `npm run typecheck` | TypeScript по всем workspaces |
| `npm run build` | Production build server + web |
| `npm run dev:server` | Backend на :3001 (tsx watch) |
| `npm run dev:web` | Frontend на :5173 (Vite + proxy) |
| `npm run db:push` | Prisma schema → SQLite |
| `npm run db:seed` | Канал #general |

---

## Дальше

Полная дорожная карта — [**ROADMAP.md**](ROADMAP.md).

**Главный следующий шаг (v0.4):** `Server` / `Member` / invite-flow.
Без него Eclipse Chat — одна общая комната, что не соответствует vision
«self-hosted communication core».

---

## Лицензия

[MIT](LICENSE)

---

<div align="center">
<sub>Сделано в Eclipse Forge</sub>
</div>
