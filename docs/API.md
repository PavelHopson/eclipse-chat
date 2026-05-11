# Eclipse Chat — REST API Reference

Документация **только реализованных** endpoints. Полный планируемый
набор (servers, DMs, files, reactions, и т.д.) — в [ROADMAP.md](../ROADMAP.md).

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

## Channels

Сейчас каналы **глобальные** (нет привязки к серверу). После v0.4 они
будут scope'нуты под `Server`.

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

**Errors:**
- 400 — invalid body (content пустой или >8000 символов)
- 401 — Unauthorized / Invalid token
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

- ❌ `/api/servers/*` — создание серверов, инвайты, members (v0.4)
- ❌ `/api/dm/:userId` — Direct Messages (v0.8)
- ❌ `/api/files/upload` — MinIO загрузки (v0.9)
- ❌ `/api/users/*` — поиск пользователей, profile updates (v1.0)
- ❌ `PATCH /api/messages/:id` — edit (v0.12)
- ❌ `DELETE /api/messages/:id` — delete (v0.12)
- ❌ Cursor-пагинация `?before=` для messages (v0.12)
- ❌ Response envelope `{ ok, data }` — решение: НЕ применять
  (см. ROADMAP housekeeping)

---

_Updated 2026-05-11 — синхронизировано с реальным кодом
`apps/server/src/routes/`._
