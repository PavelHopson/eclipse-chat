# @eclipse-chat/server

Fastify + Prisma (SQLite) + Socket.io + JWT — backend MVP Eclipse Chat.

## Стек

- Fastify 5 + `@fastify/cors` + `@fastify/jwt`
- Prisma 6 (sqlite)
- Socket.io 4 (на том же HTTP-сервере, что и Fastify)
- bcryptjs (password hashing) + zod (validation)

## Auth-флоу

- `POST /api/auth/register` / `POST /api/auth/login` — выдают
  `accessToken` (~15m) + `refreshToken` (~7d). Поле `token` =
  alias на access (legacy).
- `POST /api/auth/refresh` — body `{ "refreshToken" }`, **ротация**:
  старый refresh инвалидируется, выдаётся новая пара.
- `POST /api/auth/logout` — Bearer required, отзывает все refresh-токены
  текущего user'а.
- `GET /api/auth/me` — Bearer required, возвращает `{ user }`.

**Refresh-токены хранятся как SHA-256 hash** в БД (`RefreshToken.tokenHash`).
Исходный токен не утечёт даже при компрометации dev.db.

## Socket.io

- Слушает на том же HTTP-сервере, что Fastify.
- JWT передаётся в `socket.handshake.auth.token`. Невалидный токен →
  `socket.data.userId = null` (graceful, connect не отклоняется).
- События: `server:hello` (auto on connect), `client:ping`,
  `channel:join`, `channel:leave`, `message:new` (emit on POST message).
- Полная карта событий → [`docs/SOCKET_EVENTS.md`](../../docs/SOCKET_EVENTS.md).

## Команды

```bash
npm run dev          # tsx watch src/index.ts → :3001
npm run build        # tsc → apps/server/dist/
npm run typecheck    # tsc --noEmit

npm run db:push      # схема → SQLite (без миграций)
npm run db:seed      # создаёт канал #general
npm run db:generate  # перегенерить Prisma Client (обычно postinstall сам)
npm run db:studio    # GUI на :5555
```

## Структура

```
src/
├── index.ts             — bootstrap (Fastify + Socket.io + JWT + CORS)
├── db.ts                — Prisma client singleton
├── realtime.ts          — Socket.io emit helpers (emitMessageOnChannel)
├── auth/
│   ├── refresh.ts       — refresh token hash/store/find/delete
│   └── socketAuth.ts    — JWT middleware для Socket.io handshake
└── routes/
    ├── auth.ts          — /api/auth/{register,login,refresh,logout,me}
    └── channels.ts      — /api/channels, /api/channels/:id/messages
```

## Полный REST-reference

[`docs/API.md`](../../docs/API.md) — все реализованные endpoints с
примерами запросов/ответов.

## Дальше

Главный следующий шаг — **Server/Member/invite** модель (см.
[ROADMAP § v0.4](../../ROADMAP.md#v04--server--member--invite-next-in-progress)).
После — migration на PostgreSQL (v0.6).
