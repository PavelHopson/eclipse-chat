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

## v0.4.2 — Deployment guide для Star CRM сервера ✅ DONE

> Phase 2 завершена 11.05.2026. Commit `62de4bc`.

- [x] `docs/DEPLOY-TO-STAR-CRM.md` — пошаговый guide для деплоя
      под-путём `https://app.star-crm.ru/eclipse-chat/`:
  - Step 1: SSH + проверка инфры (Node 20+, PG 14+, RAM, порты)
  - Step 2: PG setup — изолированная БД `eclipse_chat` + role
    `eclipse_chat_user` с **никаким доступом к star_crm**
  - Step 3: git clone, npm install, `.env` с прод-секретами,
    `prisma migrate deploy`, `db seed`, `npm run build`
  - Step 4: nginx config — 3 location-блока внутри
    существующего `app.star-crm.ru` server-block, с rewrite
    префикса `/eclipse-chat/` перед `proxy_pass`
  - Step 5: supervisor program с memory limit 512MB
    (safety против OOM который положит Star CRM)
  - Step 6: 5 обязательных smoke-тестов (health, version, frontend,
    assets, browser flow)
  - Step 7: Star CRM safety check + rollback процедура
  - Step 8: процесс updates (git pull → migrate → build → restart)
  - Step 9: backup strategy + cron
  - Декомиссия — как уехать на отдельный VPS когда будем готовы
- [x] Deploy не выполнен — Pavel выполнит сам через гайд
      (SSH сейчас нет; финальный шаг под контролем владельца сервера)

---

## v0.5 — UX polish: show password + Profile + Avatar ✅ DONE (12.05.2026)

> Step 1 (show/hide password) + Step 2 (Profile + Avatar) **LIVE in prod**
> 12.05.2026 evening. `https://app.star-crm.ru/eclipse-chat/` отдаёт
> `api/version 0.5.0`. Migration `add_user_profile` applied, nginx
> reloaded, supervisor restarted.

**Step 1 — Show/hide password toggle ✅ DONE (in prod)**
- [x] Иконка-глаз справа в поле пароля AuthPage. SVG inline, без новых deps.
- [x] `aria-label` + `title` переключаются, `tabIndex=-1` чтобы Tab из email
      шёл сразу на пароль, `paddingRight: 44px` чтобы текст не лез под иконку.

**Step 2 — User Profile + Avatar ✅ DONE (in prod)**
- [x] Schema: `User.avatar String?`, `User.bio String?`
- [x] Migration `20260512120000_add_user_profile` — добавляет 2 nullable
      колонки. Apply в проде через `npm run db:migrate:deploy`.
- [x] Routes `apps/server/src/routes/users.ts`:
      - `GET /api/users/me/profile`
      - `PATCH /api/users/me/profile` (displayName + bio)
      - `POST /api/users/me/avatar` (JSON body `{ contentType, dataBase64 }` —
        НЕ multipart; решение принято потому что @fastify/multipart не
        устанавливается из-за ECONNRESET на машине Pavel'а, и avatar при
        resize до 256² webp = ~10-30 KB, base64 overhead приемлем; будущая
        Files API в v0.9 всё равно пойдёт через MinIO + presigned)
      - `DELETE /api/users/me/avatar`
- [x] Sharp resize 256x256 (cover, EXIF rotate) → WebP @ q=88
- [x] @fastify/static обслуживает `/uploads/` (fallback dev + safety в prod)
- [x] Backend payload (auth.publicUser, channels GET messages, realtime
      MessageNewPayload, POST message): теперь все включают `avatar`
- [x] Hooks `useProfile` + типизация `PublicUser` + `MessageRow.user.avatar`
- [x] Components: `Avatar.tsx` (image + инициалы fallback + стабильный
      HSL цвет по имени), `ProfileModal.tsx` (Modal с displayName + bio
      + аватар preview/upload/delete + email readonly)
- [x] AppShell header — кликабельный displayName+Avatar 24px → ProfileModal
- [x] MessageList — Avatar 32px + 5-минутная группировка сообщений того
      же автора (нет дублирующих header'ов в подряд идущих сообщениях).
      Полноценная группировка с day-separators — задача v0.6 redesign.
- [x] vite.config.ts proxy `/uploads/` → :3001 для dev parity
- [x] nginx snippet `^~ /eclipse-chat/uploads/` (alias + expires 1h)
- [x] `.env.example` — `UPLOADS_DIR=./uploads`

**Deploy steps (Pavel выполнит):**

⚠️ **Gotcha:** `npm ci` запускать из корня репо (workspaces install ставит и server, и web одновременно). НЕ из `apps/server` — иначе apps/web/node_modules пустой и `npm run build` упадёт на TypeScript «Cannot find module 'react'». Backend задеплоится, frontend bundle нет — пользователи увидят старый UI пока не пересобрать. Подтверждено инцидентом 12.05.2026 evening.

1. `cd /var/www/eclipse-chat && git pull origin master`
2. `npm ci` **из корня** (workspaces install — ставит deps для apps/server + apps/web; включая sharp + @fastify/static)
3. `mkdir -p /var/www/eclipse-chat/uploads/avatars && chown -R www-data:www-data /var/www/eclipse-chat/uploads`
4. `echo 'UPLOADS_DIR=/var/www/eclipse-chat/uploads' >> apps/server/.env` (если нет)
5. `cd apps/server && npx prisma migrate deploy && cd ..` (применит `add_user_profile`)
6. `npm run build` (из корня — workspaces build)
7. `sudo cp deploy/nginx/eclipse-chat.conf /etc/nginx/snippets/eclipse-chat.conf`
8. `sudo nginx -t && sudo systemctl reload nginx`
9. `sudo supervisorctl restart eclipse-chat-server`
10. Smoke: открыть /eclipse-chat/ в инкогнито, кликнуть displayName → должна показать модалку

---

## v0.5.1 — Visual foundation (design tokens + Eclipse почерк) ✅ DONE (12.05.2026)

> Реализовано в одну волну 12.05.2026 evening. Pavel прислал скрин с
> «выглядит прям очень стрёмно» — фундамент стал блокером для любого
> дальнейшего UI работы.

**Phase A — token system:**
- [x] `apps/web/src/styles/tokens.css` — полная палитра в CSS custom
      properties: ec-bg/surface-1..4, accent (cool sky `#5db5d9` + glow),
      accent-2 (teal-mint `#5dc8a3`), borders subtle/default/emphasis/accent,
      text strong/default/muted/dim, semantic ok/warn/danger, presence
      online/idle/dnd/offline, type scale 2xs..xl, spacing 4px base,
      radius xs..xl, shadows, motion (120/160/240ms ease), z-index scale,
      component slots (header/rail/sidebar widths). `prefers-reduced-motion`
      сбрасывает durations.
- [x] `reset.css` — минимальный, 70 строк: box-sizing, system font,
      focus-visible на accent, scrollbar thin terminal-like, selection
      на accent-soft.
- [x] `components.css` — utility-классы `.ec-btn` (--primary/--ghost/--danger/--sm),
      `.ec-field` (+ focus glow), `.ec-field-label`, `.ec-field-counter`,
      `.ec-section-label`, `.ec-badge` (+ --accent/--owner), `.ec-dot` (presence
      4 цвета), `.ec-empty` (icon+title+hint), `.ec-channel-item` (с active
      vertical bar, glow на hash). НЕ Tailwind-style single-purpose, а
      semantic component classes.
- [x] `index.css` импортирует tokens → reset → components в нужном порядке.
- [x] `index.html` — `<meta name="color-scheme" content="dark">` +
      `theme-color #0d1014` для PWA/browser chrome.

**Phase B — компоненты на tokens (полная миграция):**
- [x] **AppShell** — компактный header 52px с brand-mark (linear-gradient
      с glow), breadcrumb «brand / server / #channel», presence dot
      (online/offline на socket.connected), user-chip (avatar 26px + name)
      → ProfileModal, ghost logout button. Grid использует token-slots.
- [x] **ServerList** — rail 64px, tiles 44px с smooth radius transition
      (full → lg на hover/active), glow border на active, vertical bar
      marker слева 4×22 с glow, dashed-border «+» и «⤵» tiles → solid+soft
      bg на hover. Inline SVG иконки вместо emoji.
- [x] **ChannelList** — server-trigger как `<button>` (info icon справа),
      role badge (OWNER → warm warn-tone, ADMIN/MOD → accent-soft, MEMBER →
      muted), section-label «Каналы N», `.ec-channel-item--active` с
      vertical bar + accent hash, ec-channel-count с tnum, empty state
      «Создайте первый канал ниже», composer-row с ec-field + +-кнопкой.
- [x] **MessageInput → Composer** — multiline `<textarea>` autosize до
      200px, focused box с accent border + soft glow ring, attach button
      (disabled, title «Files — v0.9»), send button с paper-plane icon,
      hint row «⌨ Enter — отправить · Shift+Enter — новая строка» с kbd
      pills mono-шрифт.
- [x] **MessageList** — day-separators («Сегодня» / «Вчера» / «12 мая»),
      Avatar 36px + 5-min grouping (sticky-time на hover для grouped),
      hover background `surface-1`, day-aware grouping (new day reset).
- [x] **Modal** — backdrop blur(2px), `--ec-shadow-modal` с border-ring,
      X-icon вместо «×», `width` пропс, header/body/footer на tokens.
- [x] **AuthPage** — двойной radial-gradient background (cool blue +
      warm teal в углах), card с lg shadow, tabs row как pill-segmented
      control на surface-2, fields с .ec-field-label, eye-toggle стал
      аккуратнее (color на hover).
- [x] **CreateServerModal / JoinServerModal / ServerInfoModal** — все
      на .ec-btn/.ec-field, stats cards в ServerInfo (surface-2 + tnum
      на counters), copy-button с check-icon при copied.
- [x] **ProfileModal** — avatar-section в карточке (surface-2 + border),
      аккуратные labels + counters, email в mono.

**Eclipse «operator console» почерк зафиксирован:**
- Базовый цвет — `hsl(200 8% 6%)` (slight cyan undertone, не плоский `#0f0f12`)
- Accent — cool sky `#5db5d9` с glow `0 0 16px hsl(195 60% 55% / 0.35)`
- Borders — `rgba(255,255,255,0.05..0.16)` тонкие, никогда не solid `#2a2a32`
- Transitions — 120ms ease default, modal/glow 160ms
- Brand-mark — linear-gradient sky→teal, маленький glow

Bundle: 272.54 → 287.55 KB raw (+15.0 KB), 85.10 → 88.04 KB gzip (+2.94 KB).
CSS теперь отдельный chunk 9.48 KB (gzip 2.56 KB) — раньше был 0.13 KB inline.

---

## v0.5.2 — MemberList + redesigned MessageList/Composer 🆕 PLANNED

- [ ] `components/MemberList.tsx` + `hooks/useMembers.ts` — правая колонка
      со списком участников активного сервера. Sub'нуться на `member:joined`
      / `member:left` для live-update.
- [ ] Optimistic updates для send-message (показывать отправленное до
      backend-ответа, fallback при ошибке)
- [ ] Полноценная группировка MessageList: day-separators, sticky
      timestamps, hover-actions (copy, react placeholder), group bracket
      slim на левой колонке у группированных сообщений
- [ ] Composer redesign: multi-line autosize textarea, attach button
      (заглушка под v0.9 Files), hint «Enter — отправить · Shift+Enter — перенос»,
      slot под reactions/files/commands
- [ ] Invite flow polish: copy-button, share-link UX, join feedback states
- [ ] Unread / last-activity indicator на каналах + serverList badges
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

> Backend (Phase 1) завершён 11.05.2026. Commit `9d92263`.

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

## v1.4 — Производственный deployment 🟡 PARTIALLY DONE (12.05.2026)

> Eclipse Chat задеплоен на Star CRM сервер по path `https://app.star-crm.ru/eclipse-chat/`.
> Manual deploy через SSH (под root), не через CI пока что — CI workflow
> `deploy-prod.yml` написан и закоммичен, но secrets не настроены.

**Что готово:**
- [x] `/var/www/eclipse-chat/` создан, git clone, master branch tracked
- [x] PG 16 на сервере используется. БД `eclipse_chat` + role `eclipse_chat_user`
      (изолированно от star_crm, никаких cross-DB прав)
- [x] `apps/server/.env` с production secrets (DB пароль + JWT secret через `openssl rand`)
- [x] npm ci + prisma migrate deploy + prisma db seed применены
- [x] npm run build — apps/server/dist + apps/web/dist (с base `/eclipse-chat/`)
- [x] nginx snippet `/etc/nginx/snippets/eclipse-chat.conf` (3 location'а `^~`)
- [x] Snippet подключён через `include` в `sites-enabled/app-star-crm.conf`
      (перед `location /` SPA fallback Star CRM)
- [x] Supervisor program `eclipse-chat-server` RUNNING, autorestart=true
- [x] Smoke test 5/5: localhost API, nginx-proxied API, channels endpoint,
      frontend HTML, Star CRM root всё ещё 200

**Что осталось (отложено в backlog):**
- [ ] CI auto-deploy на push в master:
  - Workflow `.github/workflows/deploy-prod.yml` уже написан
  - Нужно создать GitHub Secrets: `SSH_PRIVATE_KEY_PROD`, `DEPLOY_USER_PROD`,
    `DEPLOY_HOST_PROD`, `ECLIPSE_CHAT_DB_PASSWORD`, `ECLIPSE_CHAT_JWT_SECRET`
  - Создать environment "production" с required reviewers
- [ ] **site-config divergence** — у Pavel'а `/etc/nginx/sites-available/app-star-crm.conf`
      (устаревший) и `/etc/nginx/sites-enabled/app-star-crm.conf` (актуальный,
      не symlink). Sites-enabled должен быть symlink. Привести к стандарту.
- [ ] Backup cron для `eclipse_chat` DB (см. `docs/DEPLOY-TO-STAR-CRM.md` § Step 9)
- [ ] Docker Compose для опционального деплоя на другой VPS (если переедем
      с shared Star CRM сервера)
- [ ] Production logs rotation для `/var/log/supervisor/eclipse-chat.{out,err}.log`

---

## v1.4 — Производственный deployment (полное планирование, для альтернативных серверов)

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
