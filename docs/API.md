# Eclipse Chat — REST API Reference

Документация **только реализованных** endpoints. Полный планируемый
набор (DMs, files, reactions, edit/delete и т.д.) — в [ROADMAP.md](../ROADMAP.md).

**Base URL (dev):** `http://localhost:3001`

**Защищённые endpoints** требуют:
```
Authorization: Bearer <access_token>
```

**Response format:** JSON без обёрток. Ошибки — `{ "error": "..." }`
с соответствующим HTTP-кодом. (Envelope `{ ok, data }` упоминавшийся
в ранних docs — НЕ применён, см. [ROADMAP § housekeeping](../ROADMAP.md#технический-долг-и-housekeeping).)

---

## Health / Version

### `GET /health`
Простой ping без префикса `/api`.
```json
{ "ok": true, "service": "eclipse-chat-server" }
```

### `GET /api/health`
Ping + проверка БД.
```json
{ "ok": true, "service": "eclipse-chat-server", "database": true }
```

### `GET /api/version`
```json
{ "name": "@eclipse-chat/server", "version": "0.3.0" }
```

---

## Auth

Access token живёт **15 минут**. Refresh token хранится в БД как
SHA-256 hash, ротация при каждом `/refresh`.

### `POST /api/auth/register`

```json
// Request
{
  "email": "pavel@example.com",
  "password": "atleast8chars",
  "displayName": "Pavel"
}

// Response 200
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "raw-refresh-token-string",
  "token": "eyJhbGciOi...",                  // = accessToken, legacy duplicate
  "user": {
    "id": "ckxxx",
    "email": "pavel@example.com",
    "displayName": "Pavel",
    "createdAt": "2026-05-11T16:00:00.000Z"
  }
}

// Errors
// 400 — invalid body (zod validation)
// 409 — email already registered
```

### `POST /api/auth/login`

```json
// Request
{ "email": "pavel@example.com", "password": "atleast8chars" }

// Response 200 — same shape as register
// Side effect: все предыдущие refresh-токены этого user'а инвалидируются

// Errors
// 400 — invalid body
// 401 — invalid email or password
```

### `POST /api/auth/refresh`

```json
// Request
{ "refreshToken": "raw-refresh-token-string" }

// Response 200
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "new-rotated-refresh-token",
  "token": "eyJhbGciOi..."                   // = accessToken, legacy duplicate
}

// Errors
// 400 — invalid body
// 401 — invalid refresh token (expired / not found / user deleted)
```

**Ротация:** старый refresh-token удаляется, новый выдаётся. Если клиент
теряет refresh между запросом и ответом — нужно делать login заново.

### `POST /api/auth/logout`

Требует Bearer. Body может быть пустым.

```json
// Response 200
{ "ok": true }
// Side effect: ВСЕ refresh-токены user'а удалены
```

### `GET /api/auth/me`

Требует Bearer.

```json
// Response 200
{
  "user": {
    "id": "ckxxx",
    "email": "pavel@example.com",
    "displayName": "Pavel",
    "createdAt": "2026-05-11T16:00:00.000Z"
  }
}

// Если access невалиден → 401 (без user wrapper)
```

---

## Servers (v0.4)

Сервера — контейнеры каналов и участников. Создатель автоматически
становится Member с `role = "OWNER"`. Один user — один Member на server
(unique `userId+serverId`).

`role` принимает значения: `"OWNER" | "ADMIN" | "MODERATOR" | "MEMBER"`
(хранится как String в SQLite — нативный enum появится в v0.6
после PG-миграции).

### `GET /api/servers`

Требует Bearer. Возвращает серверы, в которых current user — Member.

```json
{
  "servers": [
    {
      "id": "ckxxx",
      "name": "Default Server",
      "icon": null,
      "inviteCode": "ckcccc",
      "ownerId": "cksss",
      "createdAt": "2026-05-11T16:00:00.000Z",
      "memberCount": 1,
      "channelCount": 1,
      "role": "OWNER"
    }
  ]
}
```

### `POST /api/servers`

Требует Bearer. Body: `{ name, icon? }`. Создаёт server +
`Member(role="OWNER")` для current user в одной транзакции.

```json
// Request
{ "name": "My Server", "icon": null }

// Response 200
{
  "server": {
    "id": "ckxxx",
    "name": "My Server",
    "icon": null,
    "inviteCode": "ckcccc",
    "ownerId": "ckuser",
    "createdAt": "2026-05-11T16:00:00.000Z",
    "role": "OWNER"
  }
}

// Errors: 400 invalid body, 401 Unauthorized
```

### `GET /api/servers/:id`

Требует Bearer + membership.

```json
{
  "server": {
    "id": "ckxxx",
    "name": "My Server",
    "icon": null,
    "inviteCode": "ckcccc",
    "ownerId": "ckuser",
    "createdAt": "...",
    "memberCount": 3,
    "channelCount": 5,
    "role": "MEMBER"
  }
}

// Errors: 401 Unauthorized, 403 Not a member, 404 Server not found
```

### `DELETE /api/servers/:id`

Требует Bearer + `role = "OWNER"`. Cascade удалит channels, members,
messages.

```json
// Response 200
{ "ok": true }

// Errors: 401, 403 (not owner), 404
```

### `POST /api/servers/join/:inviteCode`

Требует Bearer. Вступление по инвайт-коду. **Idempotent**: если user
уже Member — возвращает `alreadyMember: true` без ошибки.

```json
// Response 200
{
  "server": { "id": "...", "name": "...", "icon": null, "ownerId": "..." },
  "member": { "id": "...", "role": "MEMBER" },
  "alreadyMember": false
}

// Side effect (если новое присоединение):
//   Socket emit `member:joined` в room `server:${serverId}`

// Errors: 401, 404 Invite not found
```

### `DELETE /api/servers/:id/leave`

Требует Bearer + membership + **не OWNER** (owner не может leave —
сначала delete server или transfer ownership).

```json
// Response 200
{ "ok": true }

// Side effect: Socket emit `member:left`

// Errors: 401, 403 (owner cannot leave), 404
```

### `GET /api/servers/:id/members`

Требует Bearer + membership.

```json
{
  "members": [
    {
      "id": "ckmember",
      "userId": "ckuser",
      "role": "OWNER",
      "joinedAt": "...",
      "user": { "id": "...", "displayName": "Pavel", "email": "...", "createdAt": "..." }
    }
  ]
}
```

Сортировка: по `role` (OWNER first lexicographically), затем по `joinedAt asc`.

### `GET /api/servers/:id/channels`

Требует Bearer + membership.

```json
{
  "channels": [
    {
      "id": "ckchan",
      "name": "general",
      "slug": "general",
      "position": 0,
      "createdAt": "...",
      "_count": { "messages": 42 }
    }
  ]
}
```

### `POST /api/servers/:id/channels`

Требует Bearer + membership. Любой Member может создать канал (role
permissions для ADMIN+ — в v1.0).

```json
// Request
{ "name": "announcements" }

// Response 200
{
  "channel": {
    "id": "ckchan",
    "name": "announcements",
    "slug": "announcements",
    "position": 0,
    "createdAt": "..."
  }
}

// Side effect: Socket emit `channel:created` в room `server:${serverId}`

// Errors: 400, 401, 403 (not a member), 404
```

---

## Channels (legacy + per-channel ops)

`GET /api/channels` и `POST /api/channels` — **legacy aliases** для
backward compat с фронтендом до Step 2 split. Работают на "Default
Server" (созданный seed-миграцией). Будут deprecate'нуты когда
frontend перейдёт на `/api/servers/:id/channels`.

`GET/POST /api/channels/:id/messages` остаются как сейчас (работают
по `channelId`, не зависят от server scope).

### `GET /api/channels`

Открытый endpoint (без auth).

```json
{
  "channels": [
    {
      "id": "ckxxx",
      "name": "General",
      "slug": "general",
      "createdAt": "2026-05-11T16:00:00.000Z",
      "_count": { "messages": 42 }
    }
  ]
}
```

### `POST /api/channels`

Требует Bearer.

```json
// Request
{ "name": "Announcements" }

// Response 200
{
  "channel": {
    "id": "ckxxx",
    "name": "Announcements",
    "slug": "announcements",   // auto-generated, ASCII slug с retry на коллизии
    "createdAt": "2026-05-11T16:00:00.000Z"
  }
}

// Errors
// 400 — invalid body (name пустое или >80 символов)
// 401 — Unauthorized
```

**Slug-генерация:** lowercase, NFKD-нормализация (убирает диакритику),
только `[a-z0-9-]`, max 48 символов. При коллизии — добавляется случайный
суффикс. Кириллица превращается в `channel` (TODO: нормальная
транслитерация в roadmap-housekeeping).

---

## Messages

### `GET /api/channels/:id/messages`

Открытый endpoint. Возвращает последние N сообщений в хронологическом
порядке (старые первые).

```
GET /api/channels/ckxxx/messages?take=80
```

```json
{
  "channel": { "id": "ckxxx", "name": "General", "slug": "general" },
  "messages": [
    {
      "id": "ckmmm",
      "content": "Hello",
      "createdAt": "2026-05-11T16:00:00.000Z",
      "user": { "id": "ckuuu", "displayName": "Pavel" }
    }
  ]
}
```

**Параметры:**
- `take` (optional) — сколько сообщений вернуть. Default `50`, max `100`,
  min `1`. Сейчас **без cursor-пагинации** (planned для v0.12).

**Errors:**
- 404 — канал не найден

### `POST /api/channels/:id/messages`

Требует Bearer.

```json
// Request
{ "content": "Hello, world!" }

// Response 200
{
  "message": {
    "messageId": "ckmmm",
    "content": "Hello, world!",
    "channelId": "ckxxx",
    "userId": "ckuuu",
    "displayName": "Pavel",
    "createdAt": "2026-05-11T16:00:00.000Z"
  }
}
```

**Side effect:** Socket.io emit `message:new` всем подключённым к
room `channel:${id}` с тем же payload.

**Membership check** (с v0.4): если `channel.serverId` задан, current
user должен быть Member этого server, иначе 403. Legacy каналы без
`serverId` (которых после seed-миграции не существует) — без проверки.

**Errors:**
- 400 — invalid body (content пустой или >8000 символов)
- 401 — Unauthorized / Invalid token
- 403 — Not a member of this server
- 404 — Channel not found / User not found

---

## Errors — общий формат

Все ошибки:

```json
{ "error": "Описание ошибки" }
```

| HTTP | Когда |
|---|---|
| 400 | zod validation failed |
| 401 | нет токена / токен невалиден / истёк |
| 404 | ресурс не найден |
| 409 | конфликт (e.g. email уже зарегистрирован) |

**Rate limiting** — не реализован. Запланирован для v1.4 production.

---

## Что НЕ реализовано (в [ROADMAP](../ROADMAP.md))

- ✅ `/api/servers/*` — добавлено в v0.4 (выше)
- ❌ `/api/dm/:userId` — Direct Messages (v0.8)
- ❌ `/api/files/upload` — MinIO загрузки (v0.9)
- ❌ `/api/users/*` — поиск пользователей, profile updates (v1.0)
- ❌ `PATCH /api/messages/:id` — edit (v0.12)
- ❌ `DELETE /api/messages/:id` — delete (v0.12)
- ❌ Cursor-пагинация `?before=` для messages (v0.12)
- ❌ `PATCH /api/servers/:id` — изменение имени / иконки / inviteCode (v0.4+)
- ❌ `POST /api/servers/:id/transfer-ownership` (v1.0)
- ❌ `DELETE /api/servers/:id/members/:memberId` — kick (v1.0)
- ❌ Response envelope `{ ok, data }` — решение: НЕ применять
  (см. ROADMAP housekeeping)

---

_Updated 2026-05-11 — v0.4 (Server/Member/invite) добавлен в Step 1.
Синхронизировано с реальным кодом `apps/server/src/routes/`._
