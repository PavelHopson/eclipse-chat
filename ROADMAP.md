# Eclipse Chat — Roadmap

> Что обещано, но ещё не реализовано. Этот файл — единый реестр
> «потерянных» обещаний из ранних README/docs + новых направлений.
> Любая фича, которой нет в текущем MVP, должна попасть сюда —
> иначе она забудется.

**Текущее состояние:** MVP с `auth + channels + messages + Socket.io` —
описан в [README.md](README.md). Всё что ниже — будущее.

---

## 🎯 Vision

Eclipse Chat — это **не очередной Discord-клон**. Это:

- **Self-hosted communication core** — все данные у владельца
- **Control surface для команд и операторов** — серверы, каналы, инвайты
- **Будущий слой для AI/bot/operator workflows** — Member может быть
  не только User, но и Bot/Operator (см. §v0.10 ниже)
- **Privacy/control-first** — нет облачных зависимостей, нет телеметрии

Этот фокус определяет приоритеты: модель «Server → Member → Channel
→ Message» важнее голоса/видео; bot-layer важнее красивых эмодзи;
self-host важнее красивого облачного UX.

---

## v0.4 — Server / Member / Invite ✅ DONE

> Backend (Step 1) + Frontend (Step 2) завершены 11.05.2026.
> Eclipse Chat теперь полноценный self-hosted чат с серверами,
> каналами и членством — фундамент для всех последующих фич.

**Цель:** превратить чат из «одной общей комнаты» в полноценные
сервера со своим membership.

**Backend (Step 1 — готов):**
- [x] Prisma models: `Server`, `Member` (с FK на User)
- [x] `MemberRole` хранится как String (SQLite limitation) — валидация
      через zod (`"OWNER" | "ADMIN" | "MODERATOR" | "MEMBER"`). Нативный
      enum появится в v0.6 после PG-миграции.
- [x] `Channel.serverId` (nullable temporarily — поднимется до NOT NULL
      в v0.6 после backfill) + `Channel.position`
- [x] Routes: `GET /api/servers`, `POST /api/servers`,
      `GET /api/servers/:id`, `DELETE /api/servers/:id` (only OWNER),
      `POST /api/servers/join/:inviteCode` (idempotent — повторный join
      возвращает `alreadyMember: true`),
      `DELETE /api/servers/:id/leave` (OWNER cannot leave),
      `GET /api/servers/:id/members`, `GET /api/servers/:id/channels`,
      `POST /api/servers/:id/channels`
- [x] Invite codes: `Server.inviteCode` уникальный (cuid)
- [x] Backward compat: `GET/POST /api/channels` работают на Default
      Server (legacy aliases). Будут deprecate в Step 2.
- [x] `POST /api/channels/:id/messages` проверяет membership
      (если `channel.serverId` задан → must be Member)
- [x] Socket: автоподписка на rooms `server:${serverId}` при connect
- [x] Socket events: `channel:created`, `member:joined`, `member:left`
- [x] Idempotent seed-migration: existing `Channel` + existing users
      → Default Server. Если users не было — создаётся system user
      (`system@eclipse-chat.local`, невалидный password hash) как owner.

**Frontend (Step 2 ✅ done):**
- [x] `apps/web/src/App.tsx` свёлся с 557 строк до ~25 строк
      (минимальный routing)
- [x] `lib/` — `storage.ts` (token storage + legacy migration),
      `api.ts` (fetch wrapper с single-flight refresh + `apiJson<T>`
      helper + `ApiError`), `socket.ts` (Socket.io client + типизированные
      payload-типы + `SocketEvents` const)
- [x] `hooks/` — `useAuth` (view + login/register/logout + socketRev),
      `useSocket` (Socket с пересозданием при socketRev++),
      `useServers` (list + active + create/join/leave/delete + reload),
      `useChannels` (per active server + создание + socket
      `channel:created` подписка), `useMessages` (per channel + socket
      `channel:join`/`leave`/`message:new` + send)
- [x] `components/` — `ServerList` (sidebar с rounded squares,
      active marker, кнопки + / ⤵), `ChannelList` (header → server info
      modal, список каналов с message count, форма создания канала),
      `MessageList` (auto-scroll-to-bottom если был у дна, time HH:MM),
      `MessageInput` (Enter to send, Shift+Enter newline), `Modal`
      (общий контейнер с backdrop + Esc close), `CreateServerModal`,
      `JoinServerModal` (вставка inviteCode, обработка `alreadyMember`),
      `ServerInfoModal` (показывает invite, role, counts, **Leave/Delete**
      кнопки по role)
- [x] `pages/` — `AuthPage` (login + register с tabs), `AppShell`
      (grid layout: topbar + ServerList rail + ChannelList + chat area)
- [x] Обработка socket events `channel:created`, `member:joined`,
      `member:left` — через hook'и. **NB:** на `member:joined`/`left`
      пока нет UI-реакции (MemberList не реализован — отложен), но
      socket автоподписка на server-rooms работает.

**Migration outcome (Step 1 уже применён локально):** existing
`Channel` (включая seed `#general`) перенесены в `Server` "Default
Server". В пустой dev.db создаётся system user как owner. Существующие
пользователи автоматически становятся Member of Default Server
(первый — OWNER, остальные — MEMBER).

---

## v0.4.1 — Path-based deploy готовность ✅ DONE

> Подготовка к деплою под-путём на Star CRM сервер
> (`https://app.star-crm.ru/eclipse-chat/`). Commit `c13c3d2`.

- [x] `apps/web/vite.config.ts` — `base` конфигурируемый через `VITE_BASE_PATH` env
  + динамические proxy paths для dev (с rewrite если base != `/`)
- [x] `apps/web/.env.production` — `VITE_BASE_PATH=/eclipse-chat/` (default
      для production builds, git-committed; локальный override через
      `.env.production.local`)
- [x] `lib/api.ts` — `apiPath()` helper, все вызовы используют
      `${import.meta.env.BASE_URL}api/...`
- [x] `lib/socket.ts` — `SOCKET_PATH = ${BASE_URL}socket.io`
- [x] `hooks/useAuth.ts` — direct fetch в login/register через `apiPath()`
- [x] `docs/DEVELOPMENT.md` — раздел про base path в prod
- [x] Build verify: default (no env) → `/assets/...`,
      production → `/eclipse-chat/assets/...`

**Dev experience не сломан** — `npm run dev:web` работает на
`http://localhost:5173/` как раньше. Path-based активируется только
при `npm run build` (через `.env.production`).

---

## v0.5 — Frontend дальнейший split / MemberList / optimistic updates

> v0.5 переехала: первоначальный «split App.tsx 557 строк» уже выполнен
> внутри v0.4 Step 2. Здесь остаются follow-up'ы которые **не были
> критичны** для функционирующего MVP.

**Что осталось:**
- [ ] `components/MemberList.tsx` + `hooks/useMembers.ts` — правая колонка
      со списком участников активного сервера. Sub'нуться на `member:joined`
      / `member:left` для live-update.
- [ ] Optimistic updates для send-message (показывать отправленное до
      backend-ответа, fallback при ошибке)
- [ ] TanStack Query — пересмотреть после v0.7 Reactions если ручные
      `reload()` устанут.
- [ ] `packages/shared` наполнить — Server/Channel/Message/Member типы
      + Socket event const'ы общими (сейчас дублируются между server и web).

Целевая структура:

```
apps/web/src/
├── lib/
│   ├── api.ts          — fetch wrapper + auto-refresh + JSON parse
│   ├── storage.ts      — token storage (LS_ACCESS / LS_REFRESH / legacy migration)
│   └── socket.ts       — Socket.io client init + auth + room subscription
├── hooks/
│   ├── useAuth.ts      — login / logout / register / refresh / me state
│   ├── useServers.ts   — active server, server list (после v0.4)
│   ├── useChannels.ts  — channels of active server
│   └── useMessages.ts  — messages of active channel + socket subscription
├── components/
│   ├── ServerList.tsx
│   ├── ChannelList.tsx
│   ├── MessageList.tsx
│   ├── MessageInput.tsx
│   └── MemberList.tsx
├── pages/
│   ├── AuthPage.tsx    — login / register UI
│   └── AppShell.tsx    — main layout после auth
└── App.tsx             — только routing + providers (стянется до 30-50 строк)
```

**Не добавляем:** Redux, RTK Query, Tailwind (пока). Простой Zustand
можно подключить когда state будет реально cross-component. Сейчас
useState + кастомные хуки достаточно.

---

## v0.6 — PostgreSQL миграция ✅ DONE

> Backend (Phase 1) завершён 11.05.2026. Commit `<TBD-Phase1>`.

- [x] `apps/server/prisma/schema.prisma` — provider `postgresql`,
      native enum `MemberRole`, `Channel.serverId` теперь NOT NULL
- [x] `docker-compose.dev.yml` — PostgreSQL 17 + Redis 7 (опционально,
      для тех у кого нет нативного PG; порты 5433/6380 чтобы не
      конфликтовать с локальным PG)
- [x] `apps/server/.env.example` — оба варианта подключения
      (native :5432 и docker :5433)
- [x] `package.json` — `db:migrate` (dev), `db:migrate:deploy` (prod),
      `db:studio` (GUI). `db:push` оставлен как escape-hatch.
- [x] `docs/DEVELOPMENT.md` — раздел "Local PG setup" с двумя путями
      (native + docker), troubleshooting password/db errors
- [x] Pavel выполнит initial migration сам через `npm run db:migrate`
      при первом запуске; migration SQL коммитится в репо
      (`prisma/migrations/<timestamp>_init/migration.sql`)
- [x] Legacy `apps/server/prisma/prisma/dev.db` остаётся в .gitignore
      (на диске после перехода не используется, можно удалить вручную)

**Breaking change:** SQLite больше не поддерживается. Если кто-то на
старой версии хочет SQLite — checkout commit `2b4ddfd` (последний
с SQLite provider).

---

## v0.7 — Реакции (Reactions)

- [ ] Prisma: `Reaction` model (userId, messageId, emoji, unique constraint)
- [ ] Routes: реакции через Socket.io (`reaction:add`, `reaction:remove`)
- [ ] Backend emit: `reaction:updated` с агрегацией `{ emoji, count, me }`
- [ ] Frontend: emoji picker, кнопка добавить реакцию, hover-preview списка

---

## v0.8 — Direct Messages (DMs)

- [ ] Prisma: `DirectMessage` model (senderId, receiverId, content)
- [ ] Routes: `GET /api/dm/:userId`, `POST /api/dm/:userId`
- [ ] Socket: rooms `dm:${userIdA}:${userIdB}` (sorted)
- [ ] Frontend: DM tab отдельно от серверов, список собеседников

---

## v0.9 — Загрузка файлов

- [ ] MinIO setup в `docker-compose.dev.yml`
- [ ] Routes: `POST /api/files/upload` (multipart, max 25MB), presigned URLs
- [ ] `Message.fileUrl`, `Message.fileName` (поля уже есть в README, добавить
      в Prisma)
- [ ] Frontend: drag & drop, превью изображений, прогресс загрузки

---

## v0.10 — Operator / Bot layer (ключевой стратегический шаг)

**Цель:** превратить Eclipse Chat из чата в **control surface** для
AI-агентов и операторов. Это то что отличает Eclipse Chat от очередного
Discord-клона.

- [ ] Prisma: `Bot` model (id, name, ownerId, apiKey, capabilities)
- [ ] Prisma: `Member.type` enum: `HUMAN | BOT` (либо nullable `userId` +
      nullable `botId` с unique check)
- [ ] Bot auth: API key через `Authorization: Bot <key>`
- [ ] Bot lifecycle hooks: `bot:command:received`, `bot:message:sent`,
      webhooks at server level
- [ ] Bot SDK: `@eclipse-chat/bot` (npm package, TypeScript)
- [ ] Готовые шаблоны ботов:
  - Telegram bridge (вход/выход в Eclipse Chat ↔ Telegram чат)
  - AI Assistant (RAG по истории канала, summary, digest)
  - Operator (long-running task tracker с уведомлениями)
- [ ] Memory hooks: интеграция с MemOS/LanceDB/Mem0 (см.
      `eclipse-library` § Memory)

**Это main differentiator** Eclipse Chat от Discord/Mattermost/Rocket.Chat
— все они либо вообще не имеют bot-first архитектуры, либо она
прикручена сбоку. У нас bot/operator = first-class concept с самого
дизайна модели.

---

## v0.11 — Presence / Status / Typing

- [ ] `User.status` enum: `ONLINE | IDLE | DND | OFFLINE` (в Prisma)
- [ ] Redis pub/sub для presence (или БД с `lastSeenAt` если без Redis)
- [ ] Socket events: `presence:update`, `typing:start`, `typing:stop`
- [ ] Frontend: индикаторы онлайн в MemberList, "Pavel печатает..."
      в нижней панели канала

---

## v0.12 — Message lifecycle (edit / delete / pinned / threads)

- [ ] Routes: `PATCH /api/messages/:id` (edit), `DELETE /api/messages/:id`
- [ ] `Message.edited` boolean + `Message.editedAt`
- [ ] Pinned messages: `Channel.pinnedMessageIds` или отдельная таблица
- [ ] Thread-ответы: `Message.parentMessageId` self-relation
- [ ] Socket events: `message:updated`, `message:deleted`
- [ ] Frontend: edit-mode in MessageInput, кнопка delete с конфирмом,
      pin-list в шапке канала, thread sidebar

---

## v1.0 — Roles & permissions

- [ ] `MemberRole` enum: `OWNER | ADMIN | MODERATOR | MEMBER`
- [ ] Permission checks в каждом mutation-эндпоинте (`canDeleteChannel`,
      `canKickMember` и т.д.)
- [ ] Frontend: server settings page, member management UI
- [ ] Permission helper в `@eclipse-chat/shared`

---

## v1.1 — UX, privacy, operator polish

Из текущего «v1.1» из старого README:

- [ ] **SVG icon system** для социальных/брендовых интеграций и
      провайдеров — использовать [thesvg](https://github.com/glincker/thesvg)
      или статически из `Eclipse Forge brand-icons`
- [ ] **Privacy QA checklist** перед voice/video: WebRTC leak check,
      DNS leak check, fingerprint check, proxy-leak check (см.
      `eclipse-library` § Privacy)
- [ ] **AI assistant prompt refresh** по GPT-5.5 guide: короче
      инструкции, сильнее output contract
- [ ] **Cost-control профили** для summary/digest/assistant — сжатые
      режимы (`caveman` mode) — экономит токены при digest по каналу
- [ ] **Chat-driven operator/bot layer** — control surface для задач,
      bridge в Telegram/Discord, long-term memory hooks (продолжение v0.10)

---

## v1.2 — Voice channels (LiveKit)

- [ ] LiveKit self-hosted setup
- [ ] `Channel.type = VOICE` (enum: `TEXT | VOICE`)
- [ ] Routes: `POST /api/channels/:id/voice/join` (returns LiveKit token)
- [ ] Frontend: voice channel UI, mute/unmute, participants list
- [ ] Privacy gate (см. v1.1)

---

## v1.3 — Video calls

- [ ] Video tracks в существующих voice channels
- [ ] Screen sharing
- [ ] Frontend: video grid layout

---

## v1.4 — Производственный deployment

Из текущего `docs/DEPLOYMENT.md` (он на сейчас ложь — у нас даже
docker-compose.yml нет). Сюда переезжает всё что там описано:

- [ ] `docker-compose.yml` (production)
- [ ] `docker-compose.dev.yml` (local без HTTPS)
- [ ] `Dockerfile` для apps/server + apps/web
- [ ] Caddy reverse proxy с автоматическим HTTPS
- [ ] PostgreSQL 17 в Compose
- [ ] Redis 7 в Compose
- [ ] MinIO в Compose
- [ ] Backup scripts (`pg_dump`)
- [ ] `.env.example` в корне со всеми переменными
- [ ] `docs/DEPLOYMENT.md` (полноценный — НЕ тот что есть сейчас)

---

## v2.0 — Расширения

- [ ] **Поиск по сообщениям и серверам** — full-text search (Postgres tsvector или Meilisearch)
- [ ] **Bots API + webhooks** — продолжение v0.10
- [ ] **P2P передача файлов по LAN** без сервера, на базе протокола
      [LocalSend](https://github.com/localsend/localsend) — для команд
      в одной сети без интернета
- [ ] **Мобильный PWA** — installable, push notifications через VAPID
- [ ] **Federation** (mатрица-стиль) — серверы между разными инстансами
      могут общаться

---

## Технический долг и housekeeping

**Найдено в аудите 2026-05-11:**

- [ ] `apps/web/dist/` закоммичен в репо — добавить в `.gitignore` и
      удалить из git
- [ ] `apps/web/README.md` всё ещё содержал "пакет пустой — это якорь
      монорепо" (исправлено в Step 0)
- [ ] Дубль поля `token` в auth response (для legacy совместимости) —
      убрать после v0.5 когда frontend split закончит миграцию на
      `accessToken`
- [ ] `packages/shared` пустой — наполнить типами после v0.4 (Server,
      Member shapes) и v0.5 (Socket event names как const)
- [ ] **Нет rate limiting** на auth-роутах. README обещал `@fastify/rate-limit`
      — добавить перед v1.4 production deployment (минимально на
      `/api/auth/login` и `/api/auth/register`)
- [ ] **Нет тестов** — после v0.4 добавить минимальный test suite на
      backend (Vitest для unit, supertest для integration)
- [ ] **Response envelope** — docs/API.md в старой версии описывал
      `{ ok: true, data: {...} }` envelope, но реальный код его не
      использует. Решение: НЕ применять envelope сейчас, проще без.
      Если когда-то понадобится — это разовая миграция всех роутов.
- [ ] **`token` поле в auth-response** оставлено для legacy. Убрать
      когда frontend split (v0.5) закончит миграцию на `accessToken`.

---

## Принципы расстановки приоритетов

1. **Server/Member раньше voice/video.** Без модели сервера всё
   остальное бессмысленно.
2. **Operator layer раньше fancy UX.** Это main differentiator от
   Discord-клонов.
3. **Self-host раньше cloud.** Не делать SaaS-фичи до production deploy.
4. **Honest scope.** Если в roadmap что-то лежит >6 месяцев без движения —
   удалить, не врать.

---

_Updated 2026-05-11 — переписано в рамках Step 0 (docs sync) после
аудита расхождений README ↔ docs ↔ код._
