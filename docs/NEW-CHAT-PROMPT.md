# Eclipse Chat — handoff prompt для нового чата

> Этот файл — **system prompt + project status + task brief** для
> продолжения работы над Eclipse Chat в свежем чате с Claude Code.
> Скопируй блок «Continuation Message» в самом конце в новый чат как
> первое сообщение.
>
> **Обновлено 2026-05-13 (после v0.5.3.2 LiveKit voice LIVE).**

---

## 🎯 SYSTEM PROMPT (роль AI в новом чате)

```
Ты — Senior Product Engineer на проекте Eclipse Chat (Pavel Hopson,
часть Eclipse Hopson ecosystem). Уровень senior+/expert: ты сам
принимаешь архитектурные решения, объясняешь trade-offs, не
спрашиваешь пользователя на каждый чих.

Твой стиль:
- Краткие ответы по делу. Pavel читает технические детали, не нужно
  объяснять «что такое JWT» или «как работает Vite»
- Таблицы для structured data, диффы для кода, чек-листы для тасков
- Перед любым destructive action на проде (migration, nginx reload,
  supervisor restart) — pause + explicit подтверждение
- После каждого значимого действия — короткий рапорт: что сделано,
  что проверено, что осталось
- Use Russian для общения, English для commit messages и кода
- Co-author tag во всех commits:
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

Convention важная: ЛЮБОЕ значимое действие в репозиториях
E:\projects\* фиксируется в E:\projects\ROADMAP.md (§1 статусы +
§5 Changelog). Per-repo ROADMAP не заменяет общий. Это правило
зафиксировано Pavel'ом 11.05.2026 и проверяется при каждой сессии.

Git flow: ветка `master` (не main!), push сразу после commit'а,
GitHub Actions workflow `deploy-prod.yml` написан но не задействован
(secrets не настроены — пока деплой через manual SSH).

Production server: cv6067007 (Star CRM VPS, Ubuntu 24.04, PG 16,
Nginx 1.24, Supervisor). Eclipse Chat живёт под path
`https://app.star-crm.ru/eclipse-chat/` рядом со Star CRM
(`/api/*`), Romark (`/romark/*`). Изолированная PG БД
`eclipse_chat` + role `eclipse_chat_user`. LiveKit voice running
в Docker (eclipse-livekit + eclipse-livekit-redis containers).

Local dev: Pavel на Windows + Git Bash, PG 18 на localhost:5433
с забытым паролем (поэтому local PG не используется — для тестов
есть Neon free tier eu-west-2, но Prisma + Neon TCP unstable,
лучше деплоить и тестить в проде).

**Anti-patterns которые НЕ делаем (зафиксировано в прошлых сессиях):**
- НЕ использовать @fastify/multipart (ECONNRESET от npm registry на
  Windows-машине Pavel'я; используем base64-over-JSON для всех uploads —
  avatars, attachments, server icons работают через этот паттерн)
- НЕ запускать `npm ci` из apps/server — ВСЕГДА из корня репо
  (иначе apps/web/node_modules не ставится → build падает на «Cannot
  find module 'react'»). Подтверждено инцидентом 12.05 утром.
- НЕ деплоить без post-verification — проверять `/api/version` +
  `curl /api/voice/health` после restart, не доверять «supervisorctl
  status RUNNING»
```

---

## 📊 PROJECT STATUS (12.05.2026 ночь, после 22 commit'ов)

Eclipse Chat достиг **feature-parity с Discord core** за один день
(12.05). LIVE in prod: `https://app.star-crm.ru/eclipse-chat/`.

### Что в продакшне работает

**Структура:**
- Server (с icon upload OWNER) / Channel TEXT+VOICE / Member (4 роли:
  OWNER/ADMIN/MODERATOR/MEMBER) с role management UI (OWNER может
  менять)
- Default Server создан, system user owner

**Сообщения:**
- send + edit (только автор) + soft-delete (автор/OWNER/ADMIN/MOD) +
  pin/unpin (OWNER/ADMIN/MOD) + copy + react (12 emoji whitelist) +
  attach (10 files max × 25 MB, image grid + lightbox + non-image
  download chips) + @mention detection + URL auto-link

**Realtime (Socket.io):**
- presence: 4 status (ONLINE/IDLE/DND/INVISIBLE) с user-controlled
  override + auto-online из socket connection
- typing indicators (`Pavel печатает…` с debounced emit)
- unread badges per channel (accent-glow pill, 99+ cap)
- optimistic send (pending state, retry on fail)
- invite-link auto-join из URL `?invite=<code>`
- browser notifications + tab title `(N) Eclipse Chat` badge

**Voice (LiveKit self-hosted на том же VPS):**
- Docker containers `eclipse-livekit` + `eclipse-livekit-redis` RUNNING
- API Key `APIabjbYLLqaDwm` + secret в `apps/server/.env`
- nginx WSS proxy на `wss://app.star-crm.ru/eclipse-chat/livekit`
- UFW open: 7881/udp (TCP fallback), 7882/udp (single-port), 50000-50200/udp (media range)
- Backend `/api/channels/:id/voice/join` issues JWT (через
  jsonwebtoken, НЕ livekit-server-sdk)
- Frontend `livekit-client` lazy-loaded chunk (134 KB gzip,
  fetched только при первом join)
- VoiceRoom UI: participant grid 168px tiles, mic/deafen/leave controls

**UX/UI:**
- Mobile/tablet responsive: drawer-based nav (rail+channels слева,
  members справа), safe-area-inset на iOS PWA, single-column chat
- Design system: tokens.css (HSL palette, cool sky accent, slight
  cyan undertone), motion.css (spring-pop, slide-fade, glass blur,
  ambient radial gradients + 48px blueprint grid), reset + components
- Search Ctrl+K: glass overlay с подсветкой match через `<mark>`

### Bundle size

- Main JS: 383 KB raw / 109 KB gzip
- CSS: 16.75 KB raw / 4.08 KB gzip
- LiveKit chunk: 513 KB raw / 134 KB gzip (lazy-loaded только для voice)
- Total initial load: ~395 KB raw / ~113 KB gzip

### Database

PostgreSQL 16 на host VPS, БД `eclipse_chat`, role `eclipse_chat_user`.
8 миграций applied:
- `init` — User, Server, Member, Channel, Message, RefreshToken
- `add_user_profile` — User.avatar + bio
- `add_channel_type` — ChannelType enum + Channel.type
- `add_message_lifecycle` — editedAt + deletedAt + pinnedAt + index
- `add_reactions` — Reaction model + unique constraint
- `add_attachments` — Attachment model + onDelete:Cascade
- `add_user_status` — UserStatus enum + User.status
- (latest)

---

## 🏗 ARCHITECTURE OVERVIEW

### Stack

- **Backend:** Node.js 20 + Fastify 5 + Prisma 6 + Socket.io 4 + zod +
  JWT (@fastify/jwt) + bcryptjs + sharp + @fastify/static
- **Frontend:** React 19 + Vite 6 + TypeScript 5.8 + socket.io-client +
  **livekit-client 2.18 (lazy-chunked)**
- **БД:** PostgreSQL 16 (native enum для MemberRole, ChannelType, UserStatus)
- **Voice:** LiveKit self-hosted Docker (livekit/livekit-server +
  redis:7-alpine, host network mode)
- **Reverse proxy:** nginx 1.24 (path-based `/eclipse-chat/*` под
  Star CRM main domain, отдельные snippet'ы для api/socket.io/uploads/livekit)
- **Process manager:** Supervisor (`eclipse-chat-server` program, autorestart)

### Структура

```
/var/www/eclipse-chat/
├── apps/server/
│   ├── prisma/
│   │   ├── schema.prisma           — 7 моделей + 3 enum
│   │   └── migrations/             — 8 applied
│   └── src/
│       ├── index.ts                — Fastify bootstrap + Socket.io
│       ├── livekit.ts              — JWT generation (no livekit-server-sdk)
│       ├── attachments.ts          — base64-pattern image/file upload
│       ├── presence.ts             — in-memory userId→Set<socketId>
│       ├── realtime.ts             — socket emitters
│       └── routes/
│           ├── auth.ts             — register/login/refresh/logout/me
│           ├── channels.ts         — legacy channels + messages CRUD + reactions agg
│           ├── messages.ts         — edit/delete/pin/unpin + reactions
│           ├── servers.ts          — servers CRUD + members + roles + icon
│           ├── users.ts            — profile + avatar + status
│           └── voice.ts            — LiveKit JWT issuance + health
├── apps/web/
│   ├── src/
│   │   ├── lib/                    — api.ts (fetch+refresh), socket.ts, storage.ts, fileToBase64.ts
│   │   ├── hooks/                  — useAuth, useServers, useChannels, useMessages, useMembers,
│   │   │                              useProfile, useSocket, useMediaQuery, useNotifications,
│   │   │                              useSearch, useVoice, useVoiceHealth
│   │   ├── components/             — Avatar, ServerList, ChannelList, MessageList, MessageInput,
│   │   │                              MemberList, Modal, ProfileModal, ServerInfoModal,
│   │   │                              CreateServerModal, JoinServerModal, VoicePlaceholder,
│   │   │                              VoiceRoom, EmojiPicker, PinnedBar, TypingIndicator,
│   │   │                              SearchOverlay, StatusMenu, Attachments, RichContent
│   │   ├── pages/                  — AuthPage, AppShell
│   │   └── styles/                 — tokens.css, reset.css, components.css, responsive.css, motion.css
│   ├── package.json
│   └── vite.config.ts              — `VITE_BASE_PATH=/eclipse-chat/` для prod
├── deploy/
│   ├── nginx/eclipse-chat.conf     — main snippet (api/socket.io/uploads/static)
│   └── livekit/
│       ├── docker-compose.livekit.yml
│       ├── livekit.yaml.example
│       ├── nginx.livekit.conf      — wss proxy snippet
│       └── setup.sh                — one-command auto-setup (10 idempotent steps)
└── docs/
    ├── LIVEKIT-SETUP.md            — manual 7-step guide
    ├── DEPLOY-TO-STAR-CRM.md       — original deploy guide v0.4
    ├── DEVELOPMENT.md              — local dev setup
    ├── API.md                      — REST endpoints (slightly stale, нужно sync)
    ├── SOCKET_EVENTS.md            — socket event names (slightly stale)
    └── NEW-CHAT-PROMPT.md          — этот файл
```

### Key architectural decisions

1. **base64-over-JSON для всех uploads** (avatars, attachments, server
   icons). Решение принято после неудачных попыток поставить
   @fastify/multipart (ECONNRESET от npm registry на dev-машине). Sharp
   resize до thumbnails, всё хранится в `UPLOADS_DIR/avatars|attachments|server-icons/`,
   nginx alias `^~ /eclipse-chat/uploads/` обслуживает с 1h cache.

2. **LiveKit JWT через jsonwebtoken** (НЕ livekit-server-sdk). LiveKit
   access token = JWT с specific claims (`iss=apiKey, sub=identity, video:{room, roomJoin, can*}`),
   HS256-signed на apiSecret. Полностью совместимо, без extra deps.

3. **livekit-client как lazy chunk.** Dynamic import в `useVoice.join()`.
   Vite автоматически split'нул в отдельный chunk. Users которые не
   открывают voice channels — никогда не fetch'ат этих 134 KB gzip.

4. **In-memory presence** (presence.ts). Map<userId, Set<socketId>> +
   serverIdsByUser для broadcast routing + grace-period 5s на disconnect
   (предотвращает flapping при reconnect). Single-instance prod-инстанс
   — для масштаба нужен Redis pub/sub, но MVP хватает.

5. **Soft-delete для messages** (deletedAt timestamp вместо row delete).
   Сохраняет thread/reply context для будущей v0.12 thread feature.

6. **Modular monolith** — оба app в одном repo (apps/server, apps/web)
   через npm workspaces. Shared types сейчас дублируются (нужно вынести
   в packages/shared когда подойдёт).

### Deploy workflow

Стандартный flow (без infra changes):

```bash
cd /var/www/eclipse-chat && git pull origin master
npm ci          # из КОРНЯ репо, не из apps/server!
cd apps/server && npx prisma migrate deploy && cd ..   # только если есть migration
npm run build
sudo supervisorctl restart eclipse-chat-server
```

Smoke post-deploy:
```bash
curl -s https://app.star-crm.ru/eclipse-chat/api/version
curl -s https://app.star-crm.ru/eclipse-chat/api/voice/health
```

LiveKit infra setup (если нужно перезапустить с нуля):
```bash
cd /var/www/eclipse-chat/deploy/livekit
sudo bash setup.sh
```

---

## 🎙 LIVE PROD KEYS / CONFIG (12.05.2026)

**LiveKit credentials (зафиксировано в `apps/server/.env` и `deploy/livekit/livekit.yaml`):**
- `LIVEKIT_API_KEY=APIabjbYLLqaDwm`
- `LIVEKIT_API_SECRET=` (см. `cat apps/server/.env | grep LIVEKIT_API_SECRET`)
- `LIVEKIT_WS_URL=wss://app.star-crm.ru/eclipse-chat/livekit`

**Containers:**
- `eclipse-livekit` (livekit/livekit-server:latest) на host network
- `eclipse-livekit-redis` (redis:7-alpine) на host network

**Open ports (UFW):**
- TCP 80/443 (HTTP/HTTPS — Star CRM existing)
- UDP 7881 (LiveKit TCP fallback)
- UDP 7882 (LiveKit WebRTC single-port)
- UDP 50000-50200 (LiveKit media range)

---

## 📝 OPEN FOLLOW-UPS / Known issues

- **`apps/web/dist/` в репо** — закоммичен исторически, должен быть в .gitignore (housekeeping)
- **`packages/shared`** пустой — Server/Channel/Message/Member типы дублируются между server и web
- **`docs/API.md` + `docs/SOCKET_EVENTS.md`** — slightly stale, нужно sync с актуальным кодом
- **CI auto-deploy `.github/workflows/deploy-prod.yml`** — написан но secrets не настроены
- **Rate limiting** на `/api/auth/*` — отсутствует, @fastify/rate-limit обещан в README но не добавлен
- **No tests** — Vitest + supertest setup отсутствует
- **Manual presence statuses без auto-detect** — IDLE не выставляется автоматически через N минут неактивности (отдельный milestone)
- **DND не глушит notifications** — пока чисто display-feature
- **Token field в auth response** — legacy для обратной совместимости с v0.3, можно убрать когда frontend split закончит миграцию на accessToken

---

## 🔮 ЧТО ХОЧЕТСЯ ДАЛЬШЕ (backlog по убыванию impact)

| Фича | Сложность | Описание |
|---|---|---|
| 💬 **DMs (Direct Messages)** | ~2ч | Приватные диалоги. Новая модель `DirectConversation` + `DirectMessage`, отдельный route, DMRoom UI (reuse useMessages с custom hook) |
| 🧵 **Message threads** | ~2-3ч | `Message.parentMessageId` self-relation, thread sidebar, отдельный hook |
| 🔎 **Mention autocomplete** | ~45 мин | Печатаешь `@` → dropdown с member-фильтрацией в composer |
| 📝 **Markdown** | ~1ч | Bold/italic/code в content render |
| 🔔 **Mention escalation** | ~20 мин | Notifications даже в активном канале если упомянули тебя |
| 📹 **Voice → Video** | Большая | Video tracks в существующих LiveKit rooms + screen sharing |
| 🤖 **Bot/operator layer** | Очень большая | v0.10 main differentiator от Discord. `Member.type HUMAN\|BOT`, API key auth, SDK |
| 🔧 **CI auto-deploy** | ~1ч | Secrets настроить в GitHub: SSH_PRIVATE_KEY_PROD, DEPLOY_HOST_PROD |
| 🧪 **Tests baseline** | ~2-3ч | Vitest для unit, supertest для integration backend routes |

---

## 📁 КЛЮЧЕВЫЕ FILES для контекста новой сессии

При старте новой сессии Claude должен прочитать (по приоритету):

1. **Этот файл** (`docs/NEW-CHAT-PROMPT.md`) — handoff brief
2. **`ROADMAP.md`** (корень репо) — что сделано/что планируется
3. **`README.md`** — статус LIVE + URL
4. **`apps/server/prisma/schema.prisma`** — модели данных
5. **`apps/server/src/index.ts`** — Fastify bootstrap + socket handlers (presence + typing)
6. **`apps/web/src/pages/AppShell.tsx`** — root UI layout, проброс hooks
7. **`apps/web/src/styles/tokens.css`** — design system primitives
8. **`E:\projects\ROADMAP.md`** (глобальный) — позиция Eclipse Chat в Eclipse Hopson экосистеме

---

## 🚀 CONTINUATION MESSAGE — копируй ЭТО в новый чат

> Ниже — готовое сообщение. Скопируй блок целиком в новый чат и
> отправь Claude'у первым.

```
Привет. Я Pavel Hopson, продолжаем работу над Eclipse Chat.

Прочитай в первую очередь:
1. E:\projects\eclipse-chat\docs\NEW-CHAT-PROMPT.md
   (там system prompt + полный project status + architecture overview
   + open follow-ups + что хочется делать дальше)
2. E:\projects\eclipse-chat\ROADMAP.md
3. E:\projects\eclipse-chat\README.md
4. E:\projects\ROADMAP.md (общая дорожная карта Eclipse Hopson)

Eclipse Chat LIVE в проде: https://app.star-crm.ru/eclipse-chat/
Статус на 12.05.2026 ночь: достиг feature-parity с Discord core за
22 commit'а / 8 миграций / 1 день. Сейчас работает:
- Auth + Servers (с иконками) + Channels TEXT/VOICE + Members с
  ролями + Role management UI
- Messages: send/edit/delete/pin/copy/react (12 emoji)/attach (image
  grid + lightbox)/mention/URL auto-link
- Realtime: presence (4 manual статуса + auto)/typing/unread/optimistic/
  invite-links/browser notifications
- Search (Ctrl+K)
- Full responsive (mobile drawers)
- Design system «operator console»: cool-sky accent + motion + glass +
  ambient
- **Реальный голос через LiveKit** (self-hosted Docker на том же VPS,
  /api/voice/health → enabled:true, UDP 7881/7882/50000-50200 open)

Stack: Node 20 + Fastify 5 + Prisma 6 + Socket.io 4 + JWT auth
+ React 19 + Vite 6 + TypeScript 5.8 + livekit-client 2.18 (lazy)
+ PostgreSQL 16. Local dev — Windows + Git Bash. Production — VPS
cv6067007 (Star CRM сервер, под root SSH).

Ветка master. Push сразу после commit. Co-author tag всегда
(Claude Opus 4.7 1M context). ROADMAP обновлять каждое значимое
действие. Стандартный deploy:
  cd /var/www/eclipse-chat && git pull origin master
  npm ci    # из корня репо!
  cd apps/server && npx prisma migrate deploy && cd ..   # если есть migration
  npm run build && sudo supervisorctl restart eclipse-chat-server

Anti-patterns (зафиксировано):
- НЕ использовать @fastify/multipart (ECONNRESET — все uploads через
  base64-over-JSON + sharp)
- НЕ запускать npm ci из apps/server (только из корня — workspaces)
- НЕ деплоить без post-verification (curl /api/version + /api/voice/health)

Что хочется делать дальше — см. секцию «backlog» в NEW-CHAT-PROMPT.md.
Скажи что выбираем, или дай новую задачу.
```

---

_Generated 2026-05-13 (после v0.5.3.2 LiveKit voice LIVE). Если за
время этой сессии в проде что-то изменилось — обновить этот файл
перед следующим handoff'ом._
