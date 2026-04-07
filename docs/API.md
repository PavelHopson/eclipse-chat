# Eclipse Chat — REST API Reference

Base URL: `http://localhost:3000/api`

Все защищённые endpoints требуют заголовка:
```
Authorization: Bearer <access_token>
```

---

## Auth

### POST /auth/register
```json
// Request
{ "username": "pavel", "email": "p@example.com", "password": "secret123" }

// Response 201
{ "ok": true, "data": { "user": { "id": "...", "username": "pavel" }, "accessToken": "...", "refreshToken": "..." } }
```

### POST /auth/login
```json
// Request
{ "email": "p@example.com", "password": "secret123" }

// Response 200
{ "ok": true, "data": { "user": {...}, "accessToken": "...", "refreshToken": "..." } }
```

### POST /auth/refresh
```json
// Request
{ "refreshToken": "..." }

// Response 200
{ "ok": true, "data": { "accessToken": "..." } }
```

### POST /auth/logout
```json
// Request (Authorization required)
{ "refreshToken": "..." }

// Response 200
{ "ok": true }
```

---

## Servers

### GET /servers
```json
// Response 200
{
  "ok": true,
  "data": [
    { "id": "...", "name": "Eclipse Forge", "icon": null, "inviteCode": "abc123", "ownerId": "...", "_count": { "members": 5 } }
  ]
}
```

### POST /servers
```json
// Request
{ "name": "My Server", "icon": "https://..." }

// Response 201
{ "ok": true, "data": { "id": "...", "name": "My Server", "inviteCode": "xyz789", ... } }
```

### POST /servers/join/:inviteCode
```json
// Response 200
{ "ok": true, "data": { "server": {...}, "member": {...} } }
```

### GET /servers/:id/members
```json
// Response 200
{
  "ok": true,
  "data": [
    { "id": "...", "role": "OWNER", "user": { "id": "...", "username": "pavel", "avatar": null, "status": "ONLINE" } }
  ]
}
```

---

## Channels

### GET /servers/:serverId/channels
```json
// Response 200
{
  "ok": true,
  "data": [
    { "id": "...", "name": "general", "type": "TEXT", "position": 0 }
  ]
}
```

### POST /servers/:serverId/channels
```json
// Request
{ "name": "announcements", "type": "TEXT" }

// Response 201
{ "ok": true, "data": { "id": "...", "name": "announcements", ... } }
```

---

## Messages

### GET /channels/:channelId/messages
```
?before=<messageId>  — курсор для пагинации
&limit=50            — по умолчанию 50, макс 100
```
```json
// Response 200
{
  "ok": true,
  "data": {
    "messages": [
      {
        "id": "...",
        "content": "Привет!",
        "fileUrl": null,
        "edited": false,
        "createdAt": "2026-04-07T10:00:00Z",
        "author": { "id": "...", "username": "pavel", "avatar": null },
        "reactions": [{ "emoji": "👍", "count": 3, "me": true }]
      }
    ],
    "hasMore": true
  }
}
```

---

## Files

### POST /files/upload
```
Content-Type: multipart/form-data
field: file (max 25MB)
```
```json
// Response 201
{ "ok": true, "data": { "url": "https://...", "fileName": "image.png", "size": 12345 } }
```

---

## Direct Messages

### GET /dm/:userId
```
?before=<messageId>&limit=50
```
```json
// Response 200
{ "ok": true, "data": { "messages": [...], "hasMore": false } }
```

---

## Errors

Все ошибки в формате:
```json
{ "ok": false, "error": "Описание ошибки" }
```

| Код | Значение |
|-----|---------|
| 400 | Неверные данные запроса |
| 401 | Не авторизован / токен истёк |
| 403 | Нет прав |
| 404 | Ресурс не найден |
| 409 | Конфликт (дубликат email/username) |
| 429 | Rate limit превышен |
| 500 | Ошибка сервера |
