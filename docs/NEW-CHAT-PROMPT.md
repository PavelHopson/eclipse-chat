# Eclipse Chat — handoff prompt для нового чата

> Этот файл — **system prompt + project status + task brief** для
> продолжения работы над Eclipse Chat в свежем чате с Claude Code.
> Скопируй блок «Continuation Message» в самом конце в новый чат
> как первое сообщение.
>
> **Обновлено 2026-05-13 (после v0.12.2 Bot frontend UI + version bump).**

---

## 🎯 SYSTEM PROMPT (роль AI в новом чате)

```
Ты — Senior Product Engineer + UX Engineer на проекте Eclipse Chat
(Pavel Hopson, часть Eclipse Hopson ecosystem). Уровень senior+/expert:
сам принимаешь архитектурные решения, объясняешь trade-offs, не
спрашиваешь пользователя на каждый чих. Pavel = product owner.

# Стиль работы

- Краткие ответы по делу. Pavel читает технические детали — не
  объясняй «что такое JWT» или «как работает Vite».
- Таблицы для structured data, диффы для кода, чек-листы для задач.
- Перед любым destructive action на проде (migration, nginx reload,
  supervisor restart) — pause + explicit подтверждение.
- После каждого значимого действия — короткий рапорт: что сделано,
  что проверено, что осталось.
- Use Russian для общения, English для commit messages и кода.
- Co-author tag в каждом commit:
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

# Convention (важная, фиксирована Pavel'ом 11.05.2026)

ЛЮБОЕ значимое действие в репозиториях E:\projects\* фиксируется в
E:\projects\ROADMAP.md (§1 статусы + §5 Changelog). Per-repo ROADMAP
не заменяет общий. Это единая точка истины Eclipse Hopson экосистемы.

# Git flow

- Ветка: `master` (не main!).
- Push сразу после commit'а.
- Commit messages — содержательный subject + body с rationale,
  trade-offs, что протестировано.
- Co-author tag всегда.
- GitHub Actions workflow `deploy-prod.yml` написан но не задействован
  (secrets не настроены — Pavel деплоит manual SSH).

# Production environment

- VPS: cv6067007 (Star CRM сервер, Ubuntu 24.04, PG 16, Nginx 1.24,
  Supervisor). Eclipse Chat живёт по path
  `https://app.star-crm.ru/eclipse-chat/` рядом со Star CRM (`/api/*`),
  Romark (`/romark/*`). Изолированная PG БД `eclipse_chat` + role
  `eclipse_chat_user`.
- LiveKit running в Docker (eclipse-livekit + eclipse-livekit-redis).
- Ollama running как systemd сервис на 127.0.0.1:11434.
- Local dev — Windows + Git Bash. Pavel под root SSH на сервере.

# Anti-patterns (зафиксировано в прошлых сессиях, НЕ повторять)

- НЕ использовать @fastify/multipart (ECONNRESET от npm registry на
  Windows-машине Pavel'я; все uploads через base64-over-JSON + sharp).
- НЕ запускать `npm ci` из apps/server — ВСЕГДА из корня репо
  (иначе apps/web/node_modules не ставится → build падает на
  «Cannot find module 'react'»). Подтверждено инцидентом 12.05.
- НЕ деплоить без post-verification — проверять `/api/version` +
  smoke checks после restart, не доверять «supervisorctl status RUNNING».
- НЕ работать с prod через SSH для code change — code change всегда
  через Claude tools локально + push в master + Pavel deploy через SSH.
  Под SSH только diagnostics + recovery (systemctl restart etc).
- Sharp resize нужно ОБЯЗАТЕЛЬНО: { failOn:"none" } + sharp.metadata()
  preflight + Buffer-size guard (<800 byte = corrupt). История —
  «зелёный пиксель» bug при HEIC upload без libheif.
- Sharp без libheif не обработает iPhone HEIC. Если требуется — `apt
  install libheif1 libheif-dev` + `npm rebuild sharp`.
- nginx client_max_body_size должен быть ≥750m для image uploads (был
  20M по умолчанию — рубал avatar uploads).

# Decisions journal (что не передумывать)

- Cool-tone palette (accent cool sky hsl(195 70% 60%)), НЕ warm orange.
  Pavel явно вернул это после того как другой агент сделал Eclipse Forge
  orange. Все warm refs в bulk replace убраны.
- Schema Message.userId reuses User table — bot имеет «shadow user» 1:1
  (email bot-X@eclipse-chat.local). Нет polymorphism. Цена — auto-create
  member row при create bot.
- DM schema: nullable Message.channelId + nullable conversationId с raw
  SQL CHECK constraint (ровно одно set). Prisma не имеет check
  constraints — это нормально.
- AI provider chain: Ollama (local) → OpenRouter (free) → NVIDIA (free)
  → OpenAI (paid). Все OpenAI-compatible, auto-fallback по приоритету.
- 2FA TOTP secret шифруется AES-256-GCM с TWOFA_ENCRYPTION_KEY env.
  Recovery codes — bcrypt hashes одноразовые.
```

---

## 📊 PROJECT STATUS (13.05.2026, late evening — v0.13.0)

Eclipse Chat теперь **full-featured self-hosted operator communication
core** + AI layer + security hardening + bot/operator layer **(full stack,
backend + UI)**. LIVE in prod: `https://app.star-crm.ru/eclipse-chat/`.

### Что в продакшне работает

**Auth + Profile:**
- Sign up / login / refresh / logout / 2FA TOTP с recovery codes
- Brute-force lockout (5→15min, 10→1h, 20→24h) с anti-enumeration
- Audit log: 22 event types (auth/2fa/server/member/channel/bot)
- Profile: displayName + bio + avatar (max 20MB, HEIC support с libheif)
- Manual presence: ONLINE / IDLE / DND / INVISIBLE

**Servers + Members:**
- Server CRUD с icon + banner + brandColor (per-server CSS accent
  override) + description + welcomeMessage
- Member roles: OWNER / ADMIN / MODERATOR / MEMBER с UI management
- Invite codes + path-based deploy `?invite=<code>` auto-join
- Server settings modal с tabs (Identity / Banner)

**Channels:**
- TEXT + VOICE channels + delete + position
- Channel types separated в sidebar
- @ai mention в TEXT каналах → AI bot отвечает через 10-30 секунд
  на CPU Ollama (Qwen2.5:7b)

**Messages (TEXT каналы и DM):**
- Send / edit (автор) / soft-delete (автор + OWNER/ADMIN/MODERATOR)
- Pin/unpin (моды, для channels — не для DM)
- Reactions (12 emoji whitelist, both contexts)
- Attachments (10 files × 50MB, HEIC→JPEG conversion если libheif)
- **Markdown inline:** `**bold**`, `*italic*`/`_italic_`, `` `code` ``, `~~strike~~`
- **Emoji shortcodes:** `:smile:` → 😄 (~50 popular в whitelist)
- Mentions @user + URL auto-linking
- Edit/delete UI с inline composer + hover-actions
- **Threads (v0.13):** «Ответить в треде» из hover-actions → ThreadPanel в right
  rail (вместо MemberList). Replies скрыты из main feed (отдельный entrypoint),
  badge «N ответов в треде» на root в main. Realtime через `thread:reply:new`.

**DM (Direct Messages):**
- 1-to-1 conversations (group DMs — v0.8.1 backlog)
- DirectConversation schema с unique pair (userAId < userBId normalized)
- Sidebar с unread badges + relative time + last-message preview
- Open-or-create через MemberList «Написать в личку»

**Voice (LiveKit self-hosted Docker):**
- Real-time voice + camera + screen-share
- Voice activation modes: open / voice_activity (VAD) / push_to_talk
- WebRTC noise suppression (off/standard/aggressive)
- Audio device picker (mic + speakers через MediaDevices API)
- Master volume + per-participant volume + local mute
- AFK auto-disconnect timer (0-30 min)
- VoiceMiniBar когда ты в voice но смотришь TEXT канал
- Speaking-dots indicators в ChannelList sticky list
- Stats overlay (Ctrl+Shift+`) — ping/loss/bitrate/jitter

**AI Layer (v0.11):**
- Provider chain: Ollama → OpenRouter → NVIDIA → OpenAI
- `POST /api/channels/:id/digest/summary` — LLM-generated natural
  language резюме поверх ChannelDigest structured snapshot
- `@ai` mention в чате → fire-and-forget background reply через
  system-bot user. Throttle 20s per channel.
- UI: «✦ Резюме ИИ» button с accent-3 violet style в digest panel

**ChannelDigest (v0.9):**
- `GET /api/channels/:id/digest` — open actions / decisions / follow-ups
  / pinned messages / activity stats
- Auto-stale через socket events (action created/updated, message
  pinned) с 1.5s debounce
- ChannelDigestPanel в AppShell между ActionQueueBar и PinnedBar

**Execution layer (v0.10 — добавил другой агент):**
- ActionItem model: type TASK/DECISION/FOLLOW_UP, status OPEN/DONE,
  assignee, dueAt
- Создание из сообщения через context-menu
- ActionQueueBar в чате с filtering + SLA hints + inline-edit

**Bot/Operator layer (v0.13 — full stack + reactions):**
- Bot model с shadow-user pattern (1:1 User row)
- API keys format `ecb_<32-char-base64>` (bcrypt hashed,
  apiKeyPrefix unique для O(1) lookup)
- Routes: CRUD `/api/servers/:id/bots` (OWNER), `POST /api/bot/messages`,
  `POST /api/bot/reactions` (v0.13), `GET /api/bot/me`
- Hard cap 20 bots/server
- Audit: BOT_CREATED / BOT_DELETED / BOT_KEY_REGENERATED
- `lastUsedAt` bump на каждый successful POST /api/bot/messages
- UI: ServerSettingsModal tab «Боты» (OWNER-gated) с create form +
  список ботов + one-time key reveal modal + curl-example
- Bot badge **BOT** (violet accent hsl(252 70%)) у сообщений с `isBot=true`
  — определяется через `User.botProfile` relation на backend
- `@ai` AI assistant теперь тоже получает BOT badge (через email check
  на `system@eclipse-chat.local` — без миграции)
- `docs/BOT-API.md` — публичный API spec для bot writers

**Security hardening (v0.11.1):**
- @fastify/helmet с CSP + HSTS + X-Frame-Options
- @fastify/rate-limit: register 5/15min, login 10/15min, refresh 60/5min
- 2FA TOTP с QR + 10 recovery codes (otplib v13 functional API)
- AES-256-GCM шифрование 2FA secret в БД
- Audit log для security events

**Design system (v0.10.1 + v0.12.1):**
- Cool-tone palette (cool sky #5db5d9 accent, teal mint secondary,
  electric violet for AI)
- Type scale modular ratio 1.25, body 16px (designer-skills audit)
- Skeleton loaders для async-loaded content (MessageList)
- Aurora gradient empty states + limbus pulse glyph
- Focus rings: 2px accent + 4px halo + smooth transition
- Creative motion layer: limbus-pulse, aurora-drift, scan-line,
  orbit-sweep, levitate

**Realtime (Socket.io):**
- Presence: online/idle/dnd/offline + auto-online из socket connection
- Typing indicators
- Voice presence per server-room
- DM bumped events для sidebar resort
- Browser notifications + tab title badge
- Action item created/updated events

### Bundle size (текущее)

- Main JS: 528 KB raw / 142 KB gzip
- LiveKit chunk: 513 KB raw / 134 KB gzip (lazy-loaded только для voice)
- CSS: 52 KB raw / 10 KB gzip
- **Initial load (без voice):** ~580 KB raw / ~152 KB gzip

### Database

PostgreSQL 16, БД `eclipse_chat`, role `eclipse_chat_user`.
**12 миграций applied:**
- `init` — User, Server, Member, Channel, Message, RefreshToken
- `add_user_profile` — avatar + bio
- `add_channel_type` — TEXT/VOICE enum
- `add_message_lifecycle` — editedAt + deletedAt + pinnedAt
- `add_reactions` — Reaction model
- `add_attachments` — Attachment model
- `add_user_status` — manual presence enum
- `add_direct_messages` — DirectConversation + Message.conversationId
- `add_server_identity` — banner + brandColor + description + welcomeMessage
- `add_security_layer` — 2FA + AuditLog + lockout
- `add_bot_layer` — Bot model + AuditEventType extension

---

## 🏗 ARCHITECTURE OVERVIEW

### Stack

- **Backend:** Node.js 20 + Fastify 5 + Prisma 6 + Socket.io 4 + zod +
  JWT (@fastify/jwt) + bcryptjs + sharp + @fastify/static +
  @fastify/helmet + @fastify/rate-limit + otplib v13 + qrcode
- **Frontend:** React 19 + Vite 6 + TypeScript 5.8 + socket.io-client +
  livekit-client 2.18 (lazy chunk)
- **БД:** PostgreSQL 16 (native enums)
- **Voice:** LiveKit self-hosted Docker
- **AI:** Ollama (local) + OpenRouter (free tier) + NVIDIA Build + OpenAI
  (auto-fallback по chain)
- **Reverse proxy:** nginx 1.24 path-based `/eclipse-chat/*`
- **Process manager:** Supervisor

### Структура

```
/var/www/eclipse-chat/
├── apps/server/
│   ├── prisma/ (12 migrations)
│   ├── src/
│   │   ├── index.ts                — Fastify bootstrap + helmet + rate-limit + Socket.io + Sharp diagnostic
│   │   ├── ai/
│   │   │   ├── provider.ts         — OpenAI-compat chain (Ollama→OR→NV→OpenAI)
│   │   │   ├── prompts.ts          — digest summary + assistant prompts
│   │   │   └── assistant.ts        — @ai mention detection + reply
│   │   ├── security/
│   │   │   ├── twoFactor.ts        — otplib v13 + AES-256-GCM + recovery codes
│   │   │   ├── audit.ts            — fire-and-forget logger
│   │   │   └── loginLockout.ts     — failed attempts tracker
│   │   ├── auth/
│   │   │   ├── refresh.ts
│   │   │   ├── socketAuth.ts
│   │   │   ├── requireJwt.ts
│   │   │   └── botAuth.ts          — Bot API key middleware
│   │   ├── routes/
│   │   │   ├── auth.ts             — register/login/refresh/logout/me + 2FA gate
│   │   │   ├── twoFactor.ts        — 2FA setup/enable/disable/regen-recovery
│   │   │   ├── channels.ts         — legacy + messages CRUD + @ai trigger
│   │   │   ├── messages.ts         — edit/delete/pin + reactions (channel + DM XOR)
│   │   │   ├── servers.ts          — CRUD + icon/banner/identity + members
│   │   │   ├── users.ts            — profile + avatar
│   │   │   ├── voice.ts            — LiveKit JWT issuance + health
│   │   │   ├── dm.ts               — DM conversations + messages
│   │   │   ├── digest.ts           — channel digest + AI summary
│   │   │   ├── actions.ts          — action items
│   │   │   └── bots.ts             — bot CRUD + send messages
│   │   ├── attachments.ts          — base64 upload + sharp + HEIC→JPEG conversion
│   │   ├── voicePresence.ts        — voice presence tracker
│   │   ├── presence.ts             — online presence
│   │   ├── actionItems.ts          — serializeActionItem
│   │   └── realtime.ts             — socket emit helpers
└── apps/web/
    ├── src/
    │   ├── lib/                    — api / socket / storage / fileToBase64
    │   ├── hooks/                  — useAuth, useServers, useChannels, useMessages,
    │   │                             useMembers, useProfile, useSocket, useMediaQuery,
    │   │                             useNotifications, useSearch, useVoice, useVoiceHealth,
    │   │                             useVoicePresence, useVoiceSettings, useAudioDevices,
    │   │                             useDirectConversations, useDirectMessages,
    │   │                             useChannelDigest
    │   ├── components/             — Avatar, ServerList, ChannelList, MessageList,
    │   │                             MessageInput, MemberList, Modal, ProfileModal,
    │   │                             ServerInfoModal, ServerSettingsModal,
    │   │                             CreateServerModal, JoinServerModal,
    │   │                             VoicePlaceholder, VoiceRoom, VoiceMiniBar,
    │   │                             VoiceSettingsModal, VoiceStatsOverlay,
    │   │                             ParticipantContextMenu, EmojiPicker,
    │   │                             PinnedBar, TypingIndicator, SearchOverlay,
    │   │                             StatusMenu, Attachments, RichContent,
    │   │                             DirectConversationList, ChannelDigestPanel,
    │   │                             TwoFactorSetupModal, ActionQueueBar, icons/EclipseIcons
    │   ├── pages/                  — AuthPage, AppShell
    │   └── styles/                 — tokens.css (cold-tone, modular type),
    │                                  reset.css (focus rings),
    │                                  components.css (cool palette),
    │                                  responsive.css,
    │                                  motion.css (creative layer +
    │                                  stagger utilities + skeleton)
└── docs/
    ├── AI-SETUP.md                 — Ollama install + provider chain guide
    ├── DEPLOY-TO-STAR-CRM.md
    ├── LIVEKIT-SETUP.md
    ├── DEVELOPMENT.md
    ├── API.md (slightly stale)
    ├── SOCKET_EVENTS.md (slightly stale)
    └── NEW-CHAT-PROMPT.md          — этот файл
```

---

## 🔧 ENV VARS НА ПРОДЕ (`apps/server/.env`)

```bash
DATABASE_URL=postgres://eclipse_chat_user:...@localhost:5432/eclipse_chat
JWT_SECRET=...                                   # 32+ random bytes
UPLOADS_DIR=/var/www/eclipse-chat/uploads
PORT=3001
CORS_ORIGIN=https://app.star-crm.ru

# LiveKit (Docker self-hosted)
LIVEKIT_API_KEY=APIabjbYLLqaDwm
LIVEKIT_API_SECRET=<see deploy/livekit/livekit.yaml>
LIVEKIT_WS_URL=wss://app.star-crm.ru/eclipse-chat/livekit

# Ollama (local AI)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen2.5:7b

# 2FA (required если кто-то будет включать)
TWOFA_ENCRYPTION_KEY=<openssl rand -hex 32>

# Optional AI fallbacks
# OPENROUTER_API_KEY=sk-or-v1-...
# OPENAI_API_KEY=sk-...
# NVIDIA_API_KEY=nvapi-...

# Optional tuning
# AI_TIMEOUT_MS=120000                           # для CPU Ollama, default 60s
```

---

## 📝 OPEN FOLLOW-UPS / NEXT MILESTONES

### Срочное (P0 — Pavel ждёт фидбек)

- [x] **/api/version bump** 0.12.0 → 0.12.2 — done в Bot UI commit
- [ ] **libheif install** на проде если хочешь iPhone HEIC support:
      `sudo apt install libheif1 libheif-dev && cd /var/www/eclipse-chat && npm rebuild sharp`
- [ ] **nginx client_max_body_size** — verify проверка ≥750m включена

### Высокий приоритет (P1)

- [x] **v0.12 Bot frontend** — done в v0.12.2.
- [x] **AI assistant как Bot badge** — done в v0.13 через email check
      `system@eclipse-chat.local` в routes/channels.ts + dm.ts. Никакой
      миграции не понадобилось.
- [x] **Bot reactions API** — done в v0.13. `POST /api/bot/reactions` +
      capability check + docs/BOT-API.md обновлён.
- [x] **Markdown в messages** — done в v0.13: bold/italic/code/strike +
      emoji shortcodes (~50). RichContent.tsx переписан с unified tokenizer.
- [x] **Threads** — done в v0.13: migration `20260514000000_add_message_threads`,
      `routes/threads.ts`, `useThread` hook, `ThreadPanel` component,
      hover-action + badge в MessageList, ESC-close.
- [ ] **@-autocomplete + :-autocomplete в composer** — deferred (требует
      caret-positioning popover + ~200 LOC). Markdown и emoji работают
      без UI помощи: user пишет `:fire:` или `@Username` руками.
- [ ] **Bot inbound socket events** — bot не подключается к Socket.io,
      не получает push'ов. Нужен либо webhook outbound config, либо
      long-polling helper в docs/BOT-API.md.
- [ ] **Telegram bridge bot template** — отдельный repo / minimal Node.js
      template, не входит в основной (см. docs/BOT-API.md).
- [ ] **Thread attachments** — POST /api/messages/:id/thread сейчас принимает
      только content (без attachments). Чтобы добавить — обновить body schema
      + использовать processAttachment как в channel POST.
- [ ] **Tests baseline** — Vitest для critical paths (auth, dm, 2fa, ai,
      digest, bots, threads) + GitHub Actions CI

### Средний приоритет (P2)

- [ ] **v0.8.1 DMs extension** — group DMs, voice/video DMs, DM search,
      block user, typing indicators в DMs
- [ ] **v0.6.6 Voice quality v3** — Krisp/RNNoise DNN noise filter
      (placeholder «aggressive» mode уже в UI) + mic gain через Web Audio
      GainNode
- [ ] **Markdown rendering** в messages (bold/italic/code/links)
- [ ] **i18n EN translation** — language toggle
- [ ] **Backup cron** для eclipse_chat БД (см. docs/DEPLOY-TO-STAR-CRM.md)

### Низкий приоритет (P3)

- [ ] **CI auto-deploy** через GitHub Actions — secrets настроить:
      SSH_PRIVATE_KEY_PROD, DEPLOY_HOST_PROD
- [ ] `apps/web/dist/` в gitignore (закоммичен исторически)
- [ ] `packages/shared` наполнить (типы дублируются между server и web)
- [ ] docs/API.md + docs/SOCKET_EVENTS.md sync с актуальным кодом
- [ ] Production logs rotation

---

## 🧠 ВАЖНЫЙ КОНТЕКСТ ДЛЯ ПРОДОЛЖЕНИЯ

**Pavel в этой сессии работал over 17 коммитов подряд** — добавил:
voice quality (v0.6.1-5), DMs (v0.8), channel digest (v0.9), server
identity + cool-tone redesign (v0.10.1), AI + security (v0.11), bot
backend + image fix (v0.12), design polish (v0.12.1).

**Сейчас в прод live: v0.12.1 (commit 501c4f3).**

**Pavel установил Ollama + Qwen2.5:7b на сервере** — AI features работают
через `localhost:11434`. На CPU отвечает 15-40 секунд. Для бесплатного
fallback можно добавить OPENROUTER_API_KEY (free DeepSeek/Qwen).

**87 designer-skills установлены в `~/.claude/skills/`** — auto-trigger
по keywords («accessibility audit», «dark mode design», «motion timing»,
«empty state», «hicks law», «fitts law», и т.д.). Используй их для
consistent design quality.

**Pavel чувствителен к design quality:**
- Cool-tone обязательно. НЕ возвращаться к orange / warm.
- Креативные motion accents приветствуются (aurora drift, scan-line,
  limbus pulse).
- Pavel сравнил с Eclipse Forge Construction landing — там
  cinematic/operator console feel.

**Anti-pattern для нового agent**: НЕ стартуй с «давай я сначала
посмотрю» если просьба очевидна. Pavel ценит скорость. Прочти текущий
state и работай.

---

## 🚀 CONTINUATION MESSAGE — копируй ЭТО в новый чат

> Ниже — готовое сообщение. Скопируй блок целиком в новый чат
> и отправь Claude'у первым.

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
Версия в коде: 0.13.0 (Threads + Markdown + Bot ecosystem closure +
prefers-reduced-motion). v0.12.2 предыдущий — Bot frontend UI.

Текущее состояние:
- Auth + Profile + 2FA TOTP + audit log + brute-force lockout
- Servers (icon/banner/brandColor) + Members (4 роли) + role management
- Channels TEXT/VOICE + delete
- Messages: send/edit/delete/pin/copy/react (12 emoji)/attach (50MB)/
  mention/URL auto-link
- DMs 1-to-1 (group — backlog)
- Voice: LiveKit Docker + VAD/PTT/Open modes + screen-share + camera +
  per-participant volume + stats overlay + speaking-dots
- ChannelDigest + AI summary поверх (Ollama Qwen2.5:7b на CPU)
- @ai assistant в чате (mention triggers fire-and-forget reply через
  system-bot user — но НЕ имеет Bot row, поэтому BOT badge не показывается)
- Bot/Operator FULL STACK: backend shadow-user pattern + ecb_ API keys +
  ServerSettingsModal tab «Боты» (OWNER) + create form + one-time key
  reveal + curl-example в UI + Message BOT badge (violet)
- docs/BOT-API.md — публичный API gateway для bot writers
- Cold-tone design system + 87 designer-skills в ~/.claude/skills

Stack:
- Backend: Node 20 + Fastify 5 + Prisma 6 + Socket.io 4 + Sharp +
  Helmet + Rate-limit + otplib + LiveKit JWT
- Frontend: React 19 + Vite 6 + TS 5.8 + livekit-client 2.18 lazy
- DB: PostgreSQL 16, 12 migrations applied
- AI: Ollama (local) → OpenRouter → NVIDIA → OpenAI auto-fallback
- LiveKit + Ollama running на том же VPS (cv6067007)
- Path-based deploy под /eclipse-chat/ на app.star-crm.ru

Production:
- VPS cv6067007 (Star CRM сервер). Pavel под root SSH.
- nginx 1.24, supervisor, PG 16, Ollama systemd, Docker compose для LiveKit.
- /api/version → 0.12.2 (после deploy текущего HEAD'а), сейчас на проде 0.12.0.
- nginx client_max_body_size 750m (для uploads до 50MB × 10 attachments).

Деплой:
  cd /var/www/eclipse-chat && git pull origin master
  npm ci                                                    # из КОРНЯ!
  cd apps/server && npx prisma migrate deploy && cd ..      # если migration
  npm run build                                             # из КОРНЯ
  sudo supervisorctl restart eclipse-chat-server

Anti-patterns (не повторять):
- НЕ @fastify/multipart (ECONNRESET — все uploads через base64+sharp).
- НЕ npm ci из apps/server (только из корня — workspaces).
- НЕ деплоить без post-verification (curl /api/version + smoke).
- Sharp ОБЯЗАТЕЛЬНО с failOn:"none" + metadata preflight + Buffer
  size guard (<800 byte = corrupt). История: «зелёный пиксель» bug.
- Cool-tone palette (#5db5d9 sky), НЕ warm orange — Pavel вернул это
  явно после Eclipse Forge agent's redesign.

Что хочется делать дальше — открытые milestones:
- Telegram bridge template (отдельный repo, использует /api/bot/messages)
- AI assistant как первый Bot record (чтобы @ai badge работал consistently)
- Bot reactions API endpoint (capability declared но endpoint отсутствует)
- libheif install на сервере (если хочется iPhone HEIC support)
- Threads + mention autocomplete
- Tests baseline (Vitest)

Скажи что выбираем, или дай новую задачу.
```

---

_Generated 2026-05-13 (после v0.12.1 design polish, 17 коммитов в одной
сессии). Если за время следующей сессии в проде что-то изменилось —
обновить этот файл перед следующим handoff'ом._
