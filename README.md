<div align="center">

# ⚡ Eclipse Chat

### Self-hosted real-time chat platform

**Серверы · Каналы · DMs · Реакции · Файлы · Голос**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

> **Статус:** 🏗️ В разработке — архитектура и планирование

</div>

---

## Что это

Eclipse Chat — self-hosted мессенджер с функционалом Discord: серверы, каналы, личные сообщения, реакции, загрузка файлов и голосовой чат. Полная автономность — никаких облачных зависимостей, работает в локальной сети без интернета.

**Зачем ещё один Discord-клон?**
- Полный контроль над данными и сервером
- Открытый исходный код — можно добавить любую фичу
- Стек на TypeScript — легко поддерживать и расширять
- Без ограничений на участников, файлы, историю

---

## Стек

| Слой | Технологии |
|------|-----------|
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Zustand |
| **Backend** | Node.js · Fastify · Socket.io · Prisma ORM |
| **БД** | PostgreSQL 17 · Redis 7 *(target stack)* · SQLite *(current MVP)* |
| **Файлы** | MinIO (self-hosted S3-совместимый, planned) |
| **Auth** | JWT (access + refresh tokens) |
| **Голос/Видео** | LiveKit (v2, planned) |
| **Инфра** | Docker · Docker Compose · Caddy *(target deploy)* |

### Монорепо (каркас)

В корне — `package.json` с [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) (`apps/*`, `packages/*`):

- `apps/server` — рабочий MVP backend: Fastify, Prisma, JWT, Socket.io
- `apps/web` — рабочий MVP web client: auth, channels, realtime chat
- `packages/shared` — общий код и типы (пока каркас)

### Запуск (MVP)

1. `apps/server/.env` — из `.env.example` (SQLite `prisma/dev.db`, `JWT_SECRET`, `CORS_ORIGIN`).
2. `npm run db:push` из **корня** `eclipse-chat` (создать таблицы Prisma).
3. Два терминала:

| Команда | Порт | Описание |
|---------|------|----------|
| `npm run dev:server` | 3001 | Fastify, Prisma, JWT, Socket.io |
| `npm run dev:web` | 5173 | Vite + React, прокси `/api` и WebSocket `/socket.io` → 3001 |

**API:** `GET /api/health` (`database` — пинг БД).

**Auth:** `POST /api/auth/register` · `POST /api/auth/login` — ответ JSON: `accessToken`, `refreshToken`, поле `token` = access (короткоживущий, **15m**), `user`. `POST /api/auth/refresh` body `{ "refreshToken" }` — ротация refresh, новая пара. `GET /api/auth/me` (Bearer) · `POST /api/auth/logout` (Bearer) — сбрасывает все refresh-сессии пользователя. Клиент хранит `eclipse_chat_access` / `eclipse_chat_refresh` (старый ключ `eclipse_chat_token` мигрирует в access при старте).

**Каналы:** `GET /api/channels`, `POST /api/channels` (JSON `{ "name" }`, нужен JWT), `GET /api/channels/:id/messages`, `POST /api/channels/:id/messages` (JSON `{ "content" }`).

**Socket.io:** `auth: { token: access }` (опционально). Без валидного access `channel:join` **игнорируется**; `server:hello` и `message:new` как раньше. Эмит: `channel:join` / `channel:leave` с `channelId` (с авторизованного сокета — join в комнату `channel:…`).

После `db:push` — **`npm run db:seed`** (канал **#general**). Локальная БД: `apps/server/prisma/dev.db` (в `.gitignore`).

`npm run typecheck` — TypeScript по workspace.

---

## Возможности

### Current MVP

- [x] Monorepo skeleton (`apps/server`, `apps/web`, `packages/shared`)
- [x] Регистрация, логин, access/refresh JWT, logout, `GET /api/auth/me`
- [x] Базовые каналы: список, создание, история сообщений, отправка сообщений
- [x] Realtime поток через Socket.io (`message:new`, join/leave channel room)
- [x] Web-клиент с auth flow, channel list и message composer

### Focus now — next product step

- [ ] Поднять `Server` / `Member` / invite model как first-class сущности
- [ ] Вынести web из single-file MVP в нормальные layout / store / api / socket модули
- [ ] Подготовить миграцию с локального SQLite MVP к PostgreSQL + Redis target stack
- [ ] Свести `docs/*`, Prisma schema и runtime-код в одну честную модель без расхождений

### v1.1 — UX, privacy and operator layer

- [ ] SVG icon system для социальных/брендовых интеграций и провайдеров (reference: `thesvg`)
- [ ] Privacy QA checklist перед voice/video: WebRTC, DNS, fingerprint, proxy-leak checks
- [ ] AI assistant prompt refresh по GPT-5.5 guide: короче инструкции, сильнее output contract
- [ ] Cost-control профили для summary/digest/assistant через сжатые режимы ответов (`caveman`)
- [ ] Chat-driven operator/bot layer: control surface для задач, bridge в Telegram/Discord, long-term memory hooks

### v1 — MVP

- [x] Архитектура и документация *(текущий этап)*
- [x] Аутентификация (регистрация, вход, JWT access/refresh, logout, Socket.io с токеном)
- [x] Базовые каналы и сообщения (list/create/history/post)
- [x] Realtime доставка новых сообщений в канале
- [ ] Серверы (создание, инвайт-ссылки, вступление, список участников)
- [ ] Текстовые каналы (создание, переименование, удаление)
- [ ] Optimistic UI и подтверждение доставки/ошибок для сообщений
- [ ] Личные сообщения (DMs)
- [ ] Реакции на сообщения (emoji picker)
- [ ] Загрузка файлов и изображений (drag & drop, превью)
- [ ] Уведомления о новых сообщениях
- [ ] Онлайн-статусы пользователей
- [ ] Docker Compose для self-host

### v2 — Расширение

- [ ] Голосовые каналы (LiveKit WebRTC)
- [ ] Видеозвонки
- [ ] Роли и права (admin, moderator, member)
- [ ] Поиск по сообщениям и серверам
- [ ] Pinned messages
- [ ] Thread-ответы на сообщения
- [ ] Bots API и automation hooks (webhook интеграции, system actions, AI operators)
- [ ] P2P передача файлов по LAN без сервера (протокол [LocalSend](https://github.com/localsend/localsend))
- [ ] Мобильный PWA

---

## Архитектура

```
eclipse-chat/
├── backend/                  # Node.js + Fastify API
│   ├── src/
│   │   ├── routes/           # REST endpoints
│   │   │   ├── auth.ts       # POST /auth/register, /auth/login, /auth/refresh
│   │   │   ├── servers.ts    # CRUD серверов, инвайты
│   │   │   ├── channels.ts   # CRUD каналов
│   │   │   ├── messages.ts   # История сообщений (пагинация)
│   │   │   ├── users.ts      # Профиль, поиск
│   │   │   └── files.ts      # Upload → MinIO
│   │   ├── socket/           # Socket.io обработчики
│   │   │   ├── index.ts      # Инициализация, auth middleware
│   │   │   ├── messages.ts   # send_message, edit_message, delete_message
│   │   │   ├── reactions.ts  # add_reaction, remove_reaction
│   │   │   ├── presence.ts   # user_online, user_offline, typing
│   │   │   └── servers.ts    # server_member_join, server_member_leave
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT verify fastify hook
│   │   │   └── rateLimit.ts  # @fastify/rate-limit
│   │   ├── services/
│   │   │   ├── jwt.ts        # sign / verify / refresh
│   │   │   ├── storage.ts    # MinIO upload / presigned URL
│   │   │   └── redis.ts      # presence, rate limit, pub/sub
│   │   ├── prisma/
│   │   │   └── schema.prisma # модели БД
│   │   └── index.ts          # точка входа
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                 # React 19 SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx       # Список серверов (иконки слева)
│   │   │   │   ├── ChannelList.tsx   # Каналы текущего сервера
│   │   │   │   └── MemberList.tsx    # Участники (справа)
│   │   │   ├── chat/
│   │   │   │   ├── MessageList.tsx   # Виртуальный список сообщений
│   │   │   │   ├── Message.tsx       # Одно сообщение + реакции
│   │   │   │   ├── MessageInput.tsx  # Ввод + файлы + emoji
│   │   │   │   └── TypingIndicator.tsx
│   │   │   ├── modals/
│   │   │   │   ├── CreateServer.tsx
│   │   │   │   ├── JoinServer.tsx
│   │   │   │   └── UserSettings.tsx
│   │   │   └── ui/               # Переиспользуемые: Button, Avatar, Badge...
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Chat.tsx          # Основной layout после авторизации
│   │   ├── store/
│   │   │   ├── auth.ts           # Zustand: user, tokens
│   │   │   ├── servers.ts        # Zustand: список серверов, активный
│   │   │   ├── channels.ts       # Zustand: каналы, активный
│   │   │   ├── messages.ts       # Zustand: сообщения по channelId
│   │   │   └── presence.ts       # Zustand: онлайн-статусы
│   │   ├── socket/
│   │   │   └── client.ts         # Socket.io клиент + типизированные события
│   │   ├── api/
│   │   │   └── index.ts          # axios инстанс + все REST методы
│   │   └── hooks/
│   │       ├── useSocket.ts      # подключение и переподключение
│   │       └── useMessages.ts    # загрузка + infinite scroll
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml        # postgres + redis + minio + backend + frontend + caddy
├── docker-compose.dev.yml    # локальная разработка без caddy
└── docs/
    ├── API.md                # REST endpoints
    ├── SOCKET_EVENTS.md      # Socket.io события
    └── DEPLOYMENT.md         # Гайд по деплою
```

---

## База данных (Prisma Schema)

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  email        String    @unique
  passwordHash String
  avatar       String?
  status       UserStatus @default(OFFLINE)
  createdAt    DateTime  @default(now())

  members      Member[]
  messages     Message[]
  reactions    Reaction[]
  dmsSent      DirectMessage[] @relation("DMSender")
  dmsReceived  DirectMessage[] @relation("DMReceiver")
  refreshTokens RefreshToken[]
}

model Server {
  id          String   @id @default(cuid())
  name        String
  icon        String?
  inviteCode  String   @unique @default(cuid())
  ownerId     String
  createdAt   DateTime @default(now())

  channels    Channel[]
  members     Member[]
}

model Member {
  id        String   @id @default(cuid())
  userId    String
  serverId  String
  role      MemberRole @default(MEMBER)
  joinedAt  DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  server    Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)

  @@unique([userId, serverId])
}

model Channel {
  id        String      @id @default(cuid())
  name      String
  type      ChannelType @default(TEXT)
  serverId  String
  position  Int         @default(0)
  createdAt DateTime    @default(now())

  server    Server    @relation(fields: [serverId], references: [id], onDelete: Cascade)
  messages  Message[]
}

model Message {
  id         String    @id @default(cuid())
  content    String
  fileUrl    String?
  fileName   String?
  edited     Boolean   @default(false)
  authorId   String
  channelId  String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  author     User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  channel    Channel    @relation(fields: [channelId], references: [id], onDelete: Cascade)
  reactions  Reaction[]
}

model Reaction {
  id        String   @id @default(cuid())
  emoji     String
  userId    String
  messageId String

  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId, emoji])
}

model DirectMessage {
  id         String   @id @default(cuid())
  content    String
  fileUrl    String?
  senderId   String
  receiverId String
  createdAt  DateTime @default(now())

  sender     User @relation("DMSender", fields: [senderId], references: [id], onDelete: Cascade)
  receiver   User @relation("DMReceiver", fields: [receiverId], references: [id], onDelete: Cascade)
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum UserStatus  { ONLINE IDLE DND OFFLINE }
enum MemberRole  { OWNER ADMIN MODERATOR MEMBER }
enum ChannelType { TEXT VOICE }
```

---

## Socket.io события

### Клиент → Сервер

| Событие | Данные | Описание |
|---------|--------|----------|
| `join_channel` | `{ channelId }` | Подписаться на канал |
| `leave_channel` | `{ channelId }` | Отписаться от канала |
| `send_message` | `{ channelId, content, fileUrl? }` | Отправить сообщение |
| `edit_message` | `{ messageId, content }` | Редактировать сообщение |
| `delete_message` | `{ messageId }` | Удалить сообщение |
| `add_reaction` | `{ messageId, emoji }` | Добавить реакцию |
| `remove_reaction` | `{ messageId, emoji }` | Убрать реакцию |
| `typing_start` | `{ channelId }` | Начал печатать |
| `typing_stop` | `{ channelId }` | Перестал печатать |

### Сервер → Клиент

| Событие | Данные | Описание |
|---------|--------|----------|
| `message_new` | `Message` | Новое сообщение |
| `message_updated` | `Message` | Сообщение отредактировано |
| `message_deleted` | `{ messageId }` | Сообщение удалено |
| `reaction_updated` | `{ messageId, reactions }` | Реакции обновились |
| `user_typing` | `{ channelId, userId, username }` | Кто-то печатает |
| `presence_update` | `{ userId, status }` | Статус пользователя |
| `member_joined` | `{ serverId, member }` | Новый участник сервера |
| `member_left` | `{ serverId, userId }` | Участник покинул сервер |

---

## REST API

### Auth
```
POST /api/auth/register   — регистрация
POST /api/auth/login      — вход, возвращает access + refresh tokens
POST /api/auth/refresh    — обновить access token
POST /api/auth/logout     — инвалидировать refresh token
```

### Серверы
```
GET    /api/servers            — мои серверы
POST   /api/servers            — создать сервер
GET    /api/servers/:id        — инфо о сервере
DELETE /api/servers/:id        — удалить (только owner)
POST   /api/servers/join/:code — вступить по инвайт-коду
DELETE /api/servers/:id/leave  — покинуть сервер
GET    /api/servers/:id/members
```

### Каналы
```
GET    /api/servers/:id/channels
POST   /api/servers/:id/channels
PATCH  /api/channels/:id
DELETE /api/channels/:id
```

### Сообщения
```
GET  /api/channels/:id/messages?before=<cursor>&limit=50
```

### Файлы
```
POST /api/files/upload   — multipart, возвращает { url, fileName }
```

### DMs
```
GET  /api/dm/:userId          — история переписки
POST /api/dm/:userId          — отправить сообщение (также через Socket)
```

---

## Быстрый старт (когда будет реализовано)

```bash
git clone https://github.com/PavelHopson/eclipse-chat.git
cd eclipse-chat
cp .env.example .env
# Отредактировать .env: JWT_SECRET, пароли БД
docker compose up --build
```

Открыть **http://localhost:5173**

---

## Разработка

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev   # :3000

# Frontend
cd frontend
npm install
npm run dev   # :5173
```

---

## Лицензия

[MIT](LICENSE)

---

<div align="center">
<sub>Сделано в Eclipse Forge</sub>
</div>
