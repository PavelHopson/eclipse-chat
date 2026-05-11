# @eclipse-chat/server

Fastify, Prisma (SQLite), Socket.io, JWT (короткий access + refresh в БД, хеш SHA-256).

- `POST /api/auth/register` · `POST /api/auth/login` — `accessToken` (~15m), `refreshToken` (~7d), `token` = access.
- `POST /api/auth/refresh` — body `{ "refreshToken" }`, ротация refresh.
- `POST /api/auth/logout` — только с Bearer, отзыв всех refresh.
- Socket.io: `auth.token` = access; без валидного токена `channel:join` не зачисляет в комнату.

`npm run dev` — `tsx watch`. `npm run db:push` / `db:seed` — схема и `#general`.
