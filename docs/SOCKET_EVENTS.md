# Eclipse Chat — Socket.io Events

Документация **только реализованных** событий. Полный планируемый
набор (typing, presence, reactions, member events, и т.д.) — в
[ROADMAP.md](../ROADMAP.md).

**Naming convention:** `<domain>:<action>` через двоеточие — например
`channel:join`, `message:new`. Старые docs описывали snake_case
(`join_channel`, `send_message`) — это **устарело**, реальный код
использует colon-naming.

---

## Подключение

```typescript
import { io } from 'socket.io-client';

const socket = io({
  path: '/socket.io',
  auth: { token: '<access_token>' },   // optional, но без него write-операции игнорятся
});
```

**Endpoint:** `/socket.io` на том же HTTP-сервере, что и Fastify
(порт `3001` в dev). В Vite dev-сервере есть proxy `/socket.io` → `:3001`.

**Аутентификация:**

Сервер читает `socket.handshake.auth.token` и валидирует JWT:
- **Валидный access** → `socket.data.userId = <user.id>` (можно делать
  write-операции)
- **Невалидный / истёкший / отсутствует** → `socket.data.userId = null`
  (read-only, write игнорятся)

Подключение **НЕ отклоняется** при отсутствии токена — это позволяет
клиенту сначала подключиться, получить публичные события
(`server:hello`), и потом обновить access через `/api/auth/refresh`.

---

## Текущие события (реализованы)

### Сервер → Клиент

#### `server:hello`

Эмитится автоматически при подключении (для всех — даже без auth).

```typescript
socket.on('server:hello', (p: { t: number; msg: string }) => {
  // p.t   — timestamp подключения (ms)
  // p.msg — 'Eclipse Chat'
});
```

Используется в Web MVP для индикатора "WebSocket подключён".

#### `message:new`

Эмитится **в room `channel:${channelId}`** при `POST /api/channels/:id/messages`.

```typescript
socket.on('message:new', (p: {
  messageId: string;
  content: string;
  channelId: string;
  userId: string;
  displayName: string;
  createdAt: string;       // ISO 8601
}) => {
  // Новое сообщение в канале, на который клиент подписан через channel:join
});
```

**Кто получает:** только подключённые к room `channel:${channelId}`
(подписка через `channel:join`).

### Клиент → Сервер

#### `client:ping`

Эмитится клиентом с callback. Сервер отвечает текущим timestamp.

```typescript
socket.emit('client:ping', (resp: { t: number }) => {
  // resp.t — timestamp сервера (ms)
});
```

Используется для health-check соединения. Эмитится без auth-проверки.

#### `channel:join`

Подписаться на события канала. **Требует валидный access token** в
handshake.auth — иначе игнорируется (без ошибки).

```typescript
socket.emit('channel:join', channelId);   // строка, не объект
```

После этого клиент получает `message:new` для этого канала.

#### `channel:leave`

Отписаться от канала. Работает без проверки auth (можно покинуть room
даже без валидного токена).

```typescript
socket.emit('channel:leave', channelId);
```

---

## Rooms

Текущее использование:

| Room | Формат | Кто получает |
|---|---|---|
| Канал | `channel:${channelId}` | Все клиенты, выполнившие `channel:join channelId` |

Будущие rooms (v0.4+):

| Room | Формат | Зачем (после v0.4) |
|---|---|---|
| Сервер | `server:${serverId}` | Member events (join/leave), server-wide announcements |
| Пользователь | `user:${userId}` | DM notifications, mention pings |

---

## Что НЕ реализовано (в [ROADMAP](../ROADMAP.md))

**Клиент → Сервер (планируется):**

- ❌ `message:send` (через socket вместо REST) — v0.7+
- ❌ `message:edit`, `message:delete` — v0.12
- ❌ `reaction:add`, `reaction:remove` — v0.7
- ❌ `typing:start`, `typing:stop` — v0.11

**Сервер → Клиент (планируется):**

- ❌ `message:updated` — для edit-операций — v0.12
- ❌ `message:deleted` — v0.12
- ❌ `reaction:updated` — v0.7
- ❌ `presence:update` (online/idle/dnd/offline) — v0.11
- ❌ `user:typing` — v0.11
- ❌ `member:joined`, `member:left` — v0.4 (после Server/Member)
- ❌ `dm:new` — v0.8
- ❌ `error` (generic error channel) — пока ошибки приходят как HTTP

**Старые имена (для миграции).** Если где-то в коде/docs всё ещё
встречается:
- `send_message` → должно быть POST `/api/channels/:id/messages` (или
  `message:send` в будущем)
- `join_channel` → `channel:join`
- `leave_channel` → `channel:leave`
- `message_new` → `message:new`

Это **из старых docs, не из текущего кода**. Текущий код уже на
colon-naming.

---

## Принципы дизайна socket-протокола

1. **Auth на handshake, не на каждое событие.** Один раз проверили
   JWT при connect, дальше используем `socket.data.userId`.
2. **Graceful degradation для невалидного auth.** Без токена можно
   подключиться, но write-операции игнорятся. Это позволяет UI
   подключиться **до** auth flow и показать индикатор.
3. **Rooms = isolation.** Никаких broadcast'ов всем. Каждое событие
   уходит в конкретную room.
4. **REST для mutations, Socket для notifications.** Создание /
   обновление / удаление — через REST (надёжный, retry-friendly).
   Socket — только для realtime уведомлений другим клиентам.

Пункт 4 может пересмотреться в v0.7+ если окажется что round-trip
REST → emit становится bottleneck. Но пока проще REST.

---

_Updated 2026-05-11 — синхронизировано с реальным кодом
`apps/server/src/index.ts` и `apps/server/src/realtime.ts`._
