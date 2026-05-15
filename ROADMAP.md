# Eclipse Chat — Roadmap

> **Источник истины** по Eclipse Chat: позиционирование, текущее состояние,
> фазы, версии в проде, открытые направления. Стоит отдельно от
> `E:\projects\ROADMAP.md` (общий cross-repo лог Pavel'ового монорепо).
> Любая фича, которой нет в текущем коде, попадает сюда.

**Текущая версия в проде:** **v0.31.0** (Team Health → Status Board pre-filter, 15.05.2026)
— https://app.star-crm.ru/eclipse-chat/

## 📌 Позиционирование (зафиксировано 15.05)

Eclipse Chat **НЕ** Discord-clone / Slack-clone / Telegram-clone.

Eclipse Chat = **operational communication infrastructure** =
**Discord × Telegram × Linear × Notion × AI Workspace**.

Главная формула: **communication + execution + memory + intelligence**.

Целевая аудитория: AI-first teams, operators, agencies, startups,
internal business teams, automation-heavy companies. **НЕ продаём AI**,
продаём: **clarity / calmness / execution / coordination / operational
visibility**. Это calm cinematic operational environment, не noisy gamer
chat и не enterprise prison.

## 🏗 Что в проде сейчас

**Phase 1 CORE (фактически закрыта):**
- Auth + 2FA TOTP + brute-force lockout + audit log
- Servers (workspaces) + Members (4 роли) + invites
- Channels: TEXT / VOICE (LiveKit) / **BROADCAST** (announcement-каналы)
- Messages: markdown / code / mentions / replies / reactions / edit / delete
  / pin / attachments (50MB) / search
- Threads (parent-message самоссылка + ThreadPanel)
- 1-to-1 DMs + **Saved Messages «Избранное»** (self-conversation)
- Voice + camera + screen-share + Voice quality v3 (Web Audio DSP)
- Bots: shadow-user pattern + ecb_ API keys + outbound webhooks
- Incident Mode: dedicated 🚨-канал + timeline + AI post-mortem

**Operational layer (Sprint 1-2 по brief, в проде):**
- **Forge Layer** (left rail: NAV / SPACES / ADD)
- **IntelligencePanel** — context-aware правый rail, 5 табов: Сводка /
  Память / Дела / Файлы / Люди (collapsible)
- **Immersive VoiceRoom** — presence layer + cinematic video stage +
  floating dock (без card-in-card)
- **Home «СЕГОДНЯ»** — operational сводка across workspace'ов
- **Execution Status Board** — server-wide доска ActionItem'ов
- **Operator slash-commands** `/task` `/decision` `/followup`
- **AI Memory «Пока тебя не было»** — delta при возврате в канал +
  AI-prose summary через Ollama
- **Layered blacks** (`#07090D` / `#0B0F14` / `#11161D` / `#141A22`) +
  atmospheric glow tokens + signal-pulse / telemetry-edge motion
- **Context Tree** (group labels OVERVIEW / COMMUNICATION в ChannelList)
- Semantic status palette (exec / warn / risk / idle / ai)

## 🗺 Phased plan (по brief Pavel'я)

| Phase | Что | Статус |
|---|---|---|
| **1 CORE** | workspaces / rooms / chat / voice / DMs / markdown / uploads | ✅ закрыта |
| **2 AI** | summaries / memory / search / transcription | 🟡 summaries+memory готовы; search+transcription — будущее |
| **3 EXECUTION** | tasks / decisions / approvals / project health | 🟡 task/decision/follow-up + Status Board готовы; approvals/health — будущее |
| **4 CLIENT MODE** | external rooms / approvals / invoices / reports | ❌ next sprint |
| **5 VERTICALS** | Construction Runtime / agencies / operations | ❌ долгосрочное |

## 📈 Sprint timeline (RU короткие версии)

| Версия | Дата | Что |
|---|---|---|
| **v0.31.0** | 15.05 | **Team Health → Status Board pre-filter** — закрывает scope cut v0.30.0. StatusBoard принимает `initialFilter` prop (overdue / unassigned / by-assignee); mount-effect применяет к state. 3 новых фильтра: «Просрочено» / «Без ответственного» toggle-chip'ы + dismissible chip с avatar для assignee. `applyBoardFilters` extracted pure-функция (AND-logic). Clicking stat-card в Team Health открывает Board с авто-применённым фильтром. 9 unit-тестов на filter combinations |
| v0.30.0 | 15.05 | **Execution Analytics — Team Health** — `GET /api/servers/:id/analytics/team-health`. Server-wide aggregate поверх ActionItem'ов: overdue / unassigned / open totals, avg resolution days (30d window), top-3 overloaded members, blocked members (3+ assigned-open). Calm card-grid dashboard «Здоровье команды» (server-wide view, доступ из ChannelList рядом со Status Board, hidden в CLIENT mode). Pure-функция `aggregateTeamHealth` + 11 unit-тестов (sort order / threshold / avg / edge cases) |
| v0.29.0 | 15.05 | **Role-aware `@`-mentions** — `ai/assistant.ts` детектор расширен с `@ai` до `@moderator/@pm/@knowledge/@sales` (+RU `@мод/@менеджер/@знания/@продажи/@кб`). При срабатывании system-bot отвечает используя role-specific system-prompt из `ai/botRoles.ts` + emit с `botRole: <role>` → MessageList рисует role-coloured BOT badge. AutocompletePopover теперь предлагает 5 AI mention'ов в `@`-suggestions (поверх members). 22 unit-теста на detector/resolver/strip |
| v0.28.0 | 15.05 | **AI Agents типология** — `Bot.role` enum (GENERIC/MODERATOR/PM/KNOWLEDGE/SALES) + per-role system-prompt templates + UI selector в BotsTab + role-chip + role-aware BOT badge в MessageList. Боты получают taxonomy: каждая роль = свой цвет, лейбл, prompt-шаблон через GET /api/bot/me для SDK integrations |
| v0.27.0 | 15.05 | Client Mode — Server.mode ENGINEERING/CLIENT + UI gates (Status Board, Дела/Файлы tabs, slash-hints hidden в CLIENT) |
| v0.26.1 | 15.05 | Картинки целиком в ленте + tabs polish (RU short) + ROADMAP refresh |
| v0.26.0 | 15.05 | Context Tree groupings (OVERVIEW + COMMUNICATION) |
| v0.25.1 | 15.05 | Layered blacks + atmospheric depth tokens |
| v0.25.0 | 15.05 | IntelligencePanel +Память/Дела/Файлы tabs |
| v0.24.1 | 15.05 | AI-prose summary в SinceLastVisit |
| v0.24.0 | 14.05 | AI Memory «Пока тебя не было» (delta digest) |
| v0.23.0 | 14.05 | Execution Status Board |
| v0.22.0 | 14.05 | Saved Messages «Избранное» |
| v0.21.0 | 14.05 | Operator slash-commands /task /decision /followup |
| v0.20.0 | 14.05 | Home «СЕГОДНЯ» (operational сводка) |
| v0.19.0 | 14.05 | BROADCAST-каналы (announcement, Discord×Telegram) |
| v0.18.2 | 14.05 | Редактирование имени сервера |
| v0.18.0 | 14.05 | Immersive VoiceRoom + collapsible right rail |
| v0.17.0→.2 | 14.05 | Operational redesign Фаза A — IntelligencePanel, Forge Layer, semantic palette, center polish |
| v0.16.0→.4 | 14.05 | Voice UI polish (камера contain, дубли, mute/deafen, speaking всех комнат, фикс состава sidebar) |
| v0.16.0 | 14.05 | Incident Mode |
| v0.15.0 | 14.05 | Voice quality v3 (Web Audio DSP «Студийный» режим) |
| v0.14.0 | 14.05 | @/: autocomplete + channel emoji/DnD + bot webhooks + Vitest |
| v0.13.1 | 14.05 | Channel rename / description |
| v0.13.0 | 14.05 | Threads + Markdown + Bot reactions API |
| v0.12.2 | 13.05 | Bot frontend UI |
| v0.12.x | 13.05 | Bot backend (shadow-user) + design polish + AI layer + security |
| v0.10.x | 13.05 | Cold-tone redesign + server identity (banner/brandColor) |
| v0.9.x  | 13.05 | ChannelDigest + image fix |
| v0.8.0  | 13.05 | 1-to-1 DMs |
| v0.6.x  | 13.05 | Voice quality controls (noise/devices/PTT/stats) |
| v0.5.x  | 12.05 | Profile + Avatar + show-password + design tokens |
| v0.4.x  | 11.05 | Servers/Members/invites + path-based deploy + PG migration |
| v0.3.0  | 10.05 | MVP (auth + channels + messages) |

## 🎯 Что делаем дальше

По рекомендованному порядку из brief Pavel'я (✅ #5 + #6 закрыты,
✅ server-side role-aware mentions, ✅ Execution Analytics base + pre-filter
wiring):

1. **Semantic search** — global operational search across messages /
   tasks / decisions / files / voice-summaries. Codex-vision #5.

2. **AI Transcription** — speech-to-text + summaries / decisions /
   tasks из voice-сессий. Vision-area #4 transcription.

3. **Group DMs + voice/video DMs** — DM-инфра уже есть, расширить
   на multi-participant.

4. **Client Mode v2** — role-based видимость каналов (internal vs
   client), softer visual, hide BOT-badges в CLIENT-режиме.

5. **Bot row + role + auto-respond** — owner создаёт Bot row с
   role=MODERATOR. Eclipse Chat сам генерит ответы через Ollama (без
   webhook), используя role-prompt + контекст канала. Это превращает
   role-aware @ai mentions в полноценных embedded room participants.

6. **Team Health v3** — trends vs prev week (нужны snapshot'ы),
   per-channel breakdown, response-time computation.

## 📋 Открытые follow-ups

- libheif на проде для iPhone HEIC (`apt install libheif1 libheif-dev`)
- Backup cron для `eclipse_chat` БД (см. `docs/DEPLOY-TO-STAR-CRM.md`)
- Telegram bridge bot template (отдельный repo)
- Integration tests (Vitest + Supertest + ephemeral PG)
- i18n EN translation
- PTT + «Студийный» edge case (enhancer слетает после PTT-цикла)
- Cross-channel files aggregator (для KNOWLEDGE-секции Context Tree)
- Approvals + blockers (для EXECUTION-секции Context Tree)
- Pricing / billing infra (Free / Pro / Business тиры) — **не сейчас**,
  до product-market fit

---

## 📜 Историческая часть ниже

> Старые milestone-описания v0.6→v0.17 оставлены для контекста — отдельные
> разделы по каждому версионному рывку. Дублируется с tabular timeline
> выше; читать только если нужны детали реализации конкретной фазы.

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

## 🧭 Operational Vision & Phase Map (Pavel, 14.05.2026)

> Зафиксировано по развёрнутому product-vision сообщению Pavel'я. Это
> **источник истины по направлению продукта**. Eclipse Chat — не «чат для
> общения», а **communication + execution + operational memory**.
> Формула: **Discord × Telegram × Linear × Notion × AI Workspace**.
> Не gaming-эстетика, не overloaded dashboard — **calm operational system**.

### 15 функциональных областей — статус на v0.20.0

| # | Область | Статус | Что осталось |
|---|---|---|---|
| 1 | **Chat core** (markdown/code/mentions/replies/reactions/edit/delete/pin/attach/search) | ✅ готово | link-embeds / previews |
| 2 | **Discord layer** (workspaces, text/voice/announcement-каналы, voice system) | ✅ готово | execution/client/AI room-типы |
| 3 | **Telegram DM** | 🟡 1-to-1 есть | **Saved Messages**, draft sync, group DM |
| 4 | **AI layer** | 🟡 digest summary + @ai | **AI memory**, semantic search, transcription, AI-actions |
| 5 | **Execution layer** | 🟡 ActionItem (task/decision/follow-up) | **kanban / Status Board**, decision-объекты с approval, project health, follow-up reminders |
| 6 | **Client mode** | ❌ | внешние комнаты, approvals, invoices, reports |
| 7 | **Telegram channel DNA** | 🟡 broadcast-каналы (v0.19) | reactions/comments-UI, highlights, AI-сводки канала |
| 8 | **Media UX** | 🟡 attachments | media groups, fullscreen viewer, streaming, drag&drop |
| 9 | **Global search** | 🟡 поиск по сообщениям | поиск по tasks/decisions/files/voice-summaries |
| 10 | **Home «TODAY»** | ✅ готово (v0.20.0) | live-обновление, AI-alerts |
| 11 | **Smart notifications / AI digest** | 🟡 базовые notifications | AI-дайджест «сегодня: N решений, M просрочено…» |
| 12 | **Files & knowledge graph** | ❌ | shared memory, связи room↔task↔decision↔file↔people |
| 13 | **Mobile** | 🟡 responsive | Telegram-level mobile UX |
| 14 | **Operator UX** (`/task` `/decision` `/summary` `/assign` `/followup`) | 🚧 в работе | slash-commands в композере |
| 15 | **Live presence** (speaking glow, typing, room activity) | ✅ готово | — |

### MVP-фазы

- **Phase 1 — CORE** (workspaces, rooms, chat, voice, DMs, markdown, uploads) — ✅ **фактически закрыта**
- **Phase 2 — AI** (summaries, memory, search, transcription) — 🟡 частично (digest + @ai)
- **Phase 3 — EXECUTION** (tasks, decisions, approvals, project health) — 🟡 частично (ActionItem-слой)
- **Phase 4 — CLIENT MODE** (external rooms, approvals, invoices, reports) — ❌

### Рекомендованный порядок дальнейших слайсов

1. **Operator slash-commands** (`/task` `/decision` `/followup` в композере) — дёшево, ActionItem-инфра есть, сразу даёт operator-feel 🚧
2. **Saved Messages** — Telegram-killer, переиспользует DM-инфру
3. **Execution kanban / Status Board** — все ActionItem'ы across channels
4. **AI Memory «Since your last visit»** — главный differentiator, нужен last-visit tracking + AI

### Codex review 14.05.2026 — strategic confirmation

Codex прислал стратегический разбор позиционирования. **Подтверждает направление**, в котором мы строим:

- **НЕ позиционировать как «Discord competitor»** — это смерть.
- **Позиционировать как**: execution & coordination system для AI-first teams / operators / agencies / startups / internal business teams.
- **Не продавать AI как фичу. Продавать**: clarity / calmness / execution / coordination / operational visibility.
- **Pricing tiers** (Free → Pro → Business) — отложено до PMF; сейчас Билл-инфра контр-продуктивна.
- **10 направлений монетизации** (Core SaaS, AI Agents, Client Portals, Vertical workflows, AI Memory, Execution Analytics, Internal Business OS, Agent Marketplace, AI Client Support, Embedded Automation) — это карта на 1-2 года, не план на сейчас.

**Actionable из Codex для кода:**
- **#3 Client Portals** = brief'овский **#5 Client Mode** (следующий слайс)
- **AI Operational Agents** = brief'овский **#6** (Bot.role + per-role prompts, дальше)
- **AI Memory System** = уже v0.24.x (база). Cross-channel knowledge graph — будущее.
- **Execution Analytics** (team health / blockers / response speed) — поверх ActionItem-данных, отдельный слайс.

**UX-copy rule** (Codex): на проде UI-копирайт «AI Summary» / «AI Memory» → переименовать в направлении «Что произошло» / «Память канала» в ближайшем UX-проходе.

---

## v0.8.1 — Execution layer: message → task / decision / follow-up ✅ DONE

**Цель:** сделать Eclipse Chat полезнее Discord не количеством кнопок, а тем,
что важные сообщения больше не теряются в ленте. Любое сообщение должно
уметь стать рабочим объектом.

**Что уже делаем сейчас:**
- [x] Prisma: `ActionItem` + `ActionItemType` (`TASK | DECISION | FOLLOW_UP`)
      + `ActionItemStatus` (`OPEN | DONE`)
- [x] Backend routes:
      - `POST /api/messages/:id/actions`
      - `PATCH /api/actions/:id`
      - `GET /api/channels/:id/actions`
- [x] Realtime events:
      - `action:item:created`
      - `action:item:updated`
- [x] Message UI: hover-actions превращают сообщение в task / decision / follow-up
- [x] Channel execution bar: компактная очередь открытых action items над лентой

---

## v0.8.2 — Action ownership / due dates 🚧 IN PROGRESS

**Цель:** превратить action items из меток на сообщениях в рабочий список,
где видно кто отвечает, что горит сегодня и что можно закрыть.

**Что делаем сейчас:**
- [x] API: `PATCH /api/actions/:id` принимает `assigneeUserId`, `dueAt`, `title`, `status`
- [x] Backend проверяет, что назначенный ответственный состоит в том же сервере
- [x] UI: action queue показывает ответственного и срок
- [x] UI: можно взять action item на себя, назначить участника, поставить срок сегодня/завтра
- [x] UI: можно закрыть action item из очереди

**Следующий слой после этого:**
- [x] editing title прямо в action queue
- [x] фильтр `my actions / all actions`
- [x] overdue / SLA hints
- [x] channel digest: open actions по типам + SLA + my count
- [ ] server memory / AI summaries поверх action layer

**Update 13.05.2026:** action queue получила inline-edit title, фильтр
`Все / Мои`, SLA-сигналы по срокам и компактный channel digest. Следующий
логичный шаг — server memory / AI summaries поверх action layer.

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

## v0.5.2 — Channel delete + Channel.type VOICE (placeholder) ✅ DONE (12.05.2026)

> Реализовано в одну волну после v0.5.1 ship'а. Pavel попросил «удалять
> каналы + голосовые». Скоп: A — структура под голос + UI разделение,
> LiveKit-интеграция отдельным milestone (v0.5.3).

**Backend:**
- [x] `enum ChannelType { TEXT, VOICE }` + `Channel.type` поле (default TEXT)
- [x] Migration `20260512200000_add_channel_type` (`CREATE TYPE` + `ALTER TABLE`)
- [x] `DELETE /api/channels/:id` — проверяет membership + требует OWNER/ADMIN
      роль; cascade удаляет messages (уже было в onDelete); emit
      `channel:deleted` на server-room
- [x] `POST /api/channels/:id/messages` — блокирует VOICE каналы 400
      «Voice channels don't support text messages»
- [x] `POST /api/servers/:id/channels` принимает `type: "TEXT" | "VOICE"`
- [x] `GET /api/servers/:id/channels` возвращает `type` в payload
- [x] `realtime.ts` — `emitChannelDeleted` + `type` в `channel:created` payload

**Frontend:**
- [x] `socket.ts` — `ChannelType`, `ChannelDeletedPayload`,
      `SocketEvents.ChannelDeleted`
- [x] `useChannels` — `deleteChannel(id)`, `createChannel(name, type)`,
      socket listener для `channel:deleted` (фильтрует list + сбрасывает
      selection); `normalizeChannel()` с legacy-fallback `type ?? "TEXT"`
- [x] `ChannelList` — разделение на «Текстовые» / «Голосовые» секции
      (каждая со своим counter), inline SVG-speaker для VOICE,
      hash для TEXT, hover-to-reveal trash icon (только для OWNER/ADMIN),
      `window.confirm` перед delete, type-toggle в composer
      (pill-segmented control TEXT / VOICE) + placeholder-текст в input
- [x] **NEW `VoicePlaceholder.tsx`** — карточка с mic-glow icon,
      «Готовим инфраструктуру» badge, чек-лист статусов (✅ Структура,
      ✅ UI и создание, ⏳ LiveKit SFU + TURN, ⏳ Voice room UI)
- [x] `AppShell` — при выборе VOICE channel рендерит VoicePlaceholder
      вместо MessageList/MessageInput; chat-header показывает speaker
      icon для voice channels (#) для text

**Bundle:** 287.55 → 297.77 KB raw (+10 KB), 88.04 → 90.03 KB gzip (+2 KB).

**Deploy (Pavel):**
```bash
cd /var/www/eclipse-chat && git pull origin master
npm ci                                  # ← Prisma client regen pakage хук
cd apps/server && npx prisma migrate deploy && cd ..
npm run build
sudo supervisorctl restart eclipse-chat-server
```

---

## v0.5.3 — LiveKit voice integration ✅ DONE (12.05.2026 ночь)

> Полная голосовая связь поверх self-hosted LiveKit. Реализовано двумя
> фазами: v0.5.3.1 (backend JWT + infra файлы, commit 5bc0ff3),
> v0.5.3.2 (frontend livekit-client + VoiceRoom + auto-setup script,
> commit b8d9f8b). Инфраструктура поднята на prod VPS — LiveKit Docker
> running, `/api/voice/health` → enabled:true.

**Backend (Phase 1 — commit 5bc0ff3):**
- [x] `apps/server/src/livekit.ts` — JWT generation через jsonwebtoken
      (без livekit-server-sdk dep — экономия, ECONNRESET bypass)
      `generateLivekitToken({identity, room, ttl, can*})`
- [x] `apps/server/src/routes/voice.ts`:
      - `POST /api/channels/:id/voice/join` — check channel.type=VOICE +
        membership; 503 если LIVEKIT_* env не настроен; возвращает
        `{wsUrl, token, roomName, identity, metadata}`
      - `GET /api/voice/health` — `{enabled, wsUrl}` для frontend
        conditional rendering
- [x] `deploy/livekit/`:
      - `docker-compose.livekit.yml` — LiveKit + Redis в host network
      - `livekit.yaml.example` — config template (port 7880 signal,
        UDP 7882 single-port + 50000-50200 range + 7881 TCP fallback)
      - `nginx.livekit.conf` — WSS proxy snippet
      - **`setup.sh`** — one-command auto-setup (10 idempotent steps):
        generate-keys, mkdir, ufw allow UDP, docker compose, nginx include
        auto-insert, env vars, supervisor restart, health smoke
- [x] `docs/LIVEKIT-SETUP.md` — manual 7-step guide для admin

**Frontend (Phase 2 — commit b8d9f8b):**
- [x] `livekit-client@^2.18` добавлен в apps/web deps
- [x] **Lazy-loaded chunk** — 513 KB raw / 134 KB gzip отдельный
      `livekit-client.esm-*.js` chunk, fetched только при первом
      `useVoice.join()`. Users без voice — никогда не платят
- [x] `useVoiceHealth` hook — singleton cached GET /api/voice/health
- [x] `useVoice` hook: join/leave/toggleMic/toggleDeafen,
      participants[] с isSpeaking из RoomEvent.ActiveSpeakersChanged,
      handles getUserMedia denied gracefully
- [x] `VoiceRoom` component — participant grid 168px tiles, Avatar 88px
      lookup по identity=userId из members, speaking-ring accent border +
      22px glow, mic-muted overlay red, controls bar (mic/deafen/leave
      44px round buttons), header с channel name + connection badge
- [x] AppShell branch: VOICE channel + voiceHealth.enabled →
      VoiceRoom; else → VoicePlaceholder

**Prod deployment 12.05 ночь:**
- Docker 29.1.3 + Compose 2.40.3 installed (`apt install docker.io docker-compose-v2`)
- `setup.sh` прошёл все 10 шагов чисто:
  - Generated API Key `APIabjbYLLqaDwm` + secret
  - eclipse-livekit + eclipse-livekit-redis containers RUNNING
  - UFW: 7881/udp, 7882/udp, 50000-50200/udp open
  - nginx WSS snippet auto-included
  - LIVEKIT_* env vars в .env
  - `/api/voice/health` → `{enabled:true, wsUrl:"wss://app.star-crm.ru/eclipse-chat/livekit"}` ✓

**Bundle final:** main 383 KB raw / 109 KB gzip + livekit chunk 513 KB raw /
134 KB gzip (lazy). CSS 16.75 KB / 4.08 KB gzip unchanged.

**Limits:**
- Single LiveKit VPS handle до ~20 одновременных participants в комнате
- Дальше — dedicated LiveKit VPS или LiveKit Cloud
- За корпоративным NAT без TCP fallback может не пройти — есть 7881/tcp
  для таких случаев

---

## v0.5.4 — MemberList + UX polish ✅ DONE (12.05.2026)

> Реализовано после v0.5.2 ship'а. Pavel выбрал в опрос «v0.5.4 MemberList +
> UX polish (реком)». Цель — чат должен ощутиться «дозревшим»: видимые
> участники с presence, оптимистичный send, hover-actions на сообщениях,
> invite copy/share, unread badges.

**Backend:**
- [x] `apps/server/src/presence.ts` — in-memory tracker `userId → Set<socketId>`
      + `serverIdsByUser` (для broadcast'а в правильные server-rooms).
      Grace-period 5s на disconnect (быстрый refresh не «флапает» offline).
      Не требует Redis для single-instance.
- [x] `index.ts`: при socket connect → `trackConnect(userId, socketId,
      serverIds)`, при disconnect → `trackDisconnect`. Emit `presence:update`
      первому connect / последнему disconnect (после grace).
- [x] `routes/servers.ts`: GET `/api/servers/:id/members` теперь возвращает
      `online: boolean` (вычисляется из `onlineUserIds()` Set) + `avatar`
      в user-payload. Join/leave routes вызывают `addServerRoom` / `removeServerRoom`
      для актуальности presence-broadcast'а из активной сессии.
- [x] `realtime.ts`: `emitMemberJoined` payload расширен `avatar` для
      моментального рендера в MemberList без reload.

**Frontend — MemberList:**
- [x] `socket.ts` — `PresenceStatus`, `PresenceUpdatePayload`,
      `SocketEvents.PresenceUpdate`, avatar в `MemberJoinedPayload`
- [x] `useMembers` hook — load + listeners на `member:joined`/`member:left`/
      `presence:update` (last обновляет flag online без reload)
- [x] `MemberList.tsx` — 232px правая колонка (4-я в grid). Группировка
      «В сети» / «Не в сети» с counters, sortBy: role (OWNER→ADMIN→MOD→
      MEMBER) → name asc. Avatar 28px с presence-dot (10px зелёный glow /
      серый), name (muted color для offline), role badge (token-aware).
- [x] AppShell: grid стал 4-column когда `showMembers = Boolean(activeServer)`,
      шапка `topbar` остаётся через grid-column 1/-1.

**Frontend — Optimistic send + hover-actions:**
- [x] `useMessages.sendMessage(content, sender)` — добавляет optimistic
      MessageRow с `id="local-..."` и `pending: true` сразу, затем POST.
      Socket `message:new` ищет matching pending (same userId + content)
      и заменяет в-place. На API error → `pending: false, failed: true`.
- [x] `retryMessage(id, sender)` — повторная отправка failed-сообщений.
- [x] `MessageList`:
      - opacity 0.6 для pending, «отправляется…» tag в header
      - failed message: red «Ошибка» pill + кнопка «Повторить»
      - hover-actions bar справа (absolute): copy-icon (clipboard.writeText
        + check-mark визуальный feedback 1.4s), «ВЫ» tag для own messages
      - actions hidden для pending/failed

**Frontend — Unread badges:**
- [x] `useChannels.unread: Record<channelId, number>` — `message:new`
      инкрементит для не-активных каналов; selecting канал сбрасывает.
      Удаление канала чистит счётчик.
- [x] `ChannelList` — unread badge (accent-glow pill с цифрой, «99+» cap)
      + bold-font name + text-strong color для unread channels.

**Frontend — Invite UX:**
- [x] `ServerInfoModal` — две кнопки: «Код» (ghost) и «Ссылка-инвайт»
      (primary). Ссылка формируется как `${origin}${BASE_URL}?invite=<code>`
      → в prod даёт `https://app.star-crm.ru/eclipse-chat/?invite=...`.
      Обе показывают check-mark при copy success.
- [x] `useServers` — auto-join из URL `?invite=<code>` после initial
      reload: POST `/api/servers/join/:code`, переключение active server,
      затем `history.replaceState` чистит `?invite=` из URL (избегаем
      повторного auto-join при reload). Idempotent (backend возвращает
      `alreadyMember: true` если уже в сервере).

**Bundle:** 297.77 → 310.70 KB raw (+12.93 KB), 90.04 → 92.89 KB gzip (+2.85 KB).

**Что НЕ сделано осознанно (отложено):**
- Message edit/delete — отдельный milestone (v0.5.5 или v0.12)
- TanStack Query — пока не нужно, useState + ручные reload справляются
- packages/shared — типы дублируются между server и web; обязательно
  при росте кодовой базы, сейчас приемлемо

**Deploy (Pavel):**
```bash
cd /var/www/eclipse-chat && git pull origin master
npm run build       # ← deps уже стоят, ни migration ни npm ci не нужны
sudo supervisorctl restart eclipse-chat-server
```

---

## v0.6 — Voice quality & controls ✅ DONE (13.05.2026)

> Реализовано после feedback'а Pavel'я с первого реального голосового звонка
> через Eclipse Chat. «Сделать как лучший аналог Discord». 4 коммита подряд,
> auto-join + шумодав + device picker + PTT + per-participant volume + voice
> presence + stats overlay.

**v0.6.1 — Settings foundation (commit `1f80a0a`):**
- [x] `useVoiceSettings` — persistent localStorage layer для noise mode
      (off/standard/aggressive), input/output device IDs, push-to-talk + key,
      per-participant volumes + mutes, master output volume.
- [x] `useAudioDevices` — enumeration + devicechange listener + setSinkId support
      detection. Permission flow для появления label'ов.
- [x] `useVoice` теперь применяет noise constraints + deviceId в
      `setMicrophoneEnabled`, `switchActiveDevice("audiooutput", id)` для всех
      audio-elements + future tracks. Per-participant volume × master в
      `applyRemoteAudioState`. PTT — global keydown/up listener с
      `isTypingTarget` guard (не активируем когда юзер печатает в input).
- [x] `VoiceSettingsModal` — tri-state шумодав segmented control, device
      pickers, master volume slider, PTT toggle + key recorder, live mic
      test с VU-meter (16 bars FFT).
- [x] `VoiceRoom` — **auto-join** при выборе VOICE канала (Discord-style,
      без явной кнопки), inline master volume slider в controls, settings
      cog button, PTT badge в header «PTT · Пробел», «ПЕРЕДАЁМ» state когда
      зажата PTT клавиша. Mic кнопка disabled в PTT mode.

**v0.6.2 — Voice presence (commit `fc81ae0`):**
- [x] `apps/server/src/voicePresence.ts` — in-memory tracker
      `socketId → {userId, channelId, serverId}` + reverse
      `channelId → Set<userId>`. trackVoiceJoin/Leave с dedup'ом для
      multiple tabs.
- [x] Socket.io events: `voice:join` (zod-style verify membership + channel
      type, ack callback), `voice:leave`, `voice:state` (snapshot для всех
      voice-каналов user'ового сервера при connect), `voice:participant:joined`
      / `voice:participant:left` — broadcast в `server:${serverId}` room.
- [x] Disconnect handler: auto-cleanup voice presence (для crashed/closed
      sockets без explicit leave).
- [x] `useVoicePresence(socket)` hook — listen на snapshot + delta events,
      Record<channelId, userId[]>. `reverseVoiceMap` helper для MemberList.
- [x] `useVoice` принимает socket param и emit'ит `voice:join`/`leave` вокруг
      LiveKit connect/disconnect.
- [x] **MemberList**: mic-glyph badge у online-юзеров кто сейчас в voice +
      tooltip «в голосовом «X»».
- [x] **ChannelList**: sticky-список голосовых участников под каждым VOICE
      channel (Avatar 16px + name + dashed-border-left). Видно даже если не
      в этом канале — как Discord.

**v0.6.3 — Per-participant volume + local mute (commit `70d7af6`):**
- [x] `ParticipantContextMenu` — fixed-positioned popover, click-outside +
      Escape close, viewport clamp. Avatar header + descriptive hint
      «Только для тебя — другие участники не увидят».
- [x] Volume slider 0..100% + reset-to-100% button + «Заглушить для меня» /
      «Включить звук» toggle.
- [x] `VoiceRoom Tile` — onContextMenu trigger (skip own tile), показывает
      volume % suffix в имени если != 100%, полупрозрачность для
      muted/quieter, dual mute overlay (mic-muted red bottom-right +
      locally-muted gray bottom-left).
- [x] Settings persistent — localStorage keeps это между сессиями.

**v0.6.4 — Voice stats overlay (commit `c1f334d`):**
- [x] `VoiceStatsOverlay` — 1Hz polling `v.getRemoteStats()` который читает
      `RTCStatsReport` `inbound-rtp` + `remote-inbound-rtp` audio.
- [x] Bitrate из `bytesReceived` delta между snapshots (× 8 / time / 1000 = kbps).
- [x] Compact grid 5-column: name / ping / loss / kbps / jitter. Color-coded
      ping (green<80ms, amber<200ms, red>=200ms).
- [x] Toggle: hotkey `Ctrl+Shift+\`` или chart-icon button в controls bar
      (становится accent при active). z-index 50 — под modals (100), над
      контентом. Click-outside НЕ закрывает (HUD, не modal).

**Bundle (cumulative):** 383→418 KB raw (+35), 109→119 KB gzip (+10). LiveKit
chunk не тронут — все voice fixes на нашем стороне.

**Что осознанно НЕ сделано (отложено в v0.6.5+ или backlog):**
- Krisp/RNNoise DNN noise filter (placeholder «aggressive» mode уже есть в
  UI — нужен только wire DNN lib). Free open-source RNNoise WASM — пет-вариант.
- Mic gain (Web Audio GainNode перед publish track) — settings layer готов
  (setMicGain существует), но требует рефакторинга publish flow (`createLocalAudioTrack`
  + `publishTrack` вместо `setMicrophoneEnabled`).
- Voice region selector — single-instance LiveKit пока хватает.
- Soundboard / custom sound effects.
- Screen share / video.

---

## v0.5.5 — Message lifecycle (edit / delete / pin) ✅ DONE (12.05.2026)

> Реализовано после v0.5.4 ship'а. Pavel сказал «продолжаем работу» —
> я выбрал v0.5.5 как low-risk high-value (LiveKit voice требует
> отдельной инфра-сессии и оставлен на v0.5.3).

**Backend:**
- [x] Schema: `Message.editedAt`, `Message.deletedAt`, `Message.pinnedAt`
      (все nullable). `@@index([channelId, pinnedAt])` для быстрого
      GET pinned. Migration `20260512220000_add_message_lifecycle`.
- [x] **`routes/messages.ts`** (новый):
      - `GET /api/channels/:id/pinned` — список pinned-сообщений канала
        (member-only), sort by pinnedAt desc
      - `PATCH /api/messages/:id` — edit, **только автор**, обновляет
        editedAt; 410 для deleted
      - `DELETE /api/messages/:id` — soft-delete, **автор OR OWNER/ADMIN/
        MODERATOR** сервера; idempotent (alreadyDeleted: true); unpin
        автоматически при delete (чтобы pin-bar не показывал «удалено»)
      - `POST /api/messages/:id/pin` — **только OWNER/ADMIN/MODERATOR**;
        idempotent (повторный pin обновляет pinnedAt); 410 для deleted
      - `DELETE /api/messages/:id/pin` — unpin, same perms
- [x] `realtime.ts`: `emitMessageUpdated`, `emitMessageDeleted`,
      `emitMessagePinned`, `emitMessageUnpinned` — все в `channel:${id}`
      room
- [x] `channels.ts` GET messages теперь возвращает `editedAt/deletedAt/
      pinnedAt` для каждого сообщения; `content` пустой для deleted
- [x] `index.ts` регистрирует `registerMessageRoutes`

**Frontend:**
- [x] `socket.ts` — 4 новых payload-типа + `SocketEvents.Message{Updated,Deleted,Pinned,Unpinned}`
- [x] `useMessages`:
      - `MessageRow` расширен `editedAt/deletedAt/pinnedAt`
      - Listeners для 4 lifecycle событий обновляют state in-place
      - `editMessage(id, content)`, `deleteMessage(id)`, `pinMessage(id)`,
        `unpinMessage(id)` методы
      - `defaultLifecycle()` helper для backward-compat с старыми payload'ами
- [x] **MessageList** расширен:
      - Inline edit: textarea с accent border + soft glow + autoFocus;
        Enter → save, Esc → cancel; replace в-place при successful edit
      - Deleted: italic muted «сообщение удалено» вместо content
      - Edited: «(изменено)» tag с title-tooltip полной даты
      - Pinned: специальный row style с warm-yellow left-border + bg tint,
        «ЗАКРЕПЛЕНО» pill в header с pin-icon (warn color)
      - Hover-actions bar: copy / edit / pin (или unpin) / delete —
        видимость зависит от роли + ownership + state. Edit только для
        своих не-deleted; delete для своих ИЛИ moderator; pin/unpin
        только для moderator
- [x] **`PinnedBar.tsx`** (новый): collapsible сверху чата, показывает
      pinned-count и list. Каждая карточка: Avatar + name + relative
      timestamp («Сегодня, 13:20») + 3-line clamp content. Авто-скрыт
      когда pinned.length === 0
- [x] `AppShell` — `PinnedBar` встроен над `MessageList` для TEXT
      channels; `currentRole` из `activeServer.role` пробрасывается в
      MessageList для perm-проверок

**Permissions matrix (UI ↔ backend):**

| Action  | Author | OWNER | ADMIN | MOD | MEMBER |
|---------|:---:|:---:|:---:|:---:|:---:|
| Copy    | ✅  | ✅  | ✅  | ✅  | ✅  |
| Edit    | ✅  | ❌  | ❌  | ❌  | ❌  |
| Delete  | ✅  | ✅  | ✅  | ✅  | ❌  |
| Pin     | ❌  | ✅  | ✅  | ✅  | ❌  |
| Unpin   | ❌  | ✅  | ✅  | ✅  | ❌  |

**Bundle:** 310.70 → 321.63 KB raw (+10.9 KB), 92.89 → 94.75 KB gzip (+1.86 KB).

**Deploy (Pavel):**
```bash
cd /var/www/eclipse-chat && git pull origin master
npm ci          # ← postinstall prisma generate
cd apps/server && npx prisma migrate deploy && cd ..
npm run build
sudo supervisorctl restart eclipse-chat-server
```

---

## v0.6.5 — Voice activation modes + AFK + speaking indicators ✅ DONE (13.05.2026)

> Реализовано после v0.6.4 prod-deploy. Commit `6f1cc3f`. Pavel сказал
> «давай продолжать разработку» → выбрал finalize-voice-block scope.

- [x] **Refactor:** `pushToTalk:boolean` → `micActivationMode: "open"
      | "voice_activity" | "push_to_talk"`. Backward-compat migration в
      loadSettings (legacy `pushToTalk=true` → `"push_to_talk"`).
- [x] **VAD (voice activity detection) gate** — Web Audio AnalyserNode
      подключён к local mic mediaStreamTrack, 50ms раз меряем peak
      amplitude, hold-time 250ms перед закрытием gate. UI: VAD slider
      0.1–30% + live VU-meter в settings когда тестируешь.
- [x] **AFK auto-disconnect** — если один в voice room > N мин → auto-leave.
      UI: range slider 0–30 мин (0 = выключено), default 5 мин (Discord
      parity). Timer rearm'ится при изменении participants.length.
- [x] **Voice persistence across channel switches** — lift `useVoice()` из
      VoiceRoom в AppShell. Voice connection переживает переключение между
      TEXT каналами (как Discord). Leave только по: explicit click / AFK /
      socket disconnect / выбор ДРУГОГО VOICE канала / выход из сервера.
- [x] **VoiceMiniBar** (новый компонент) — показывается над PinnedBar в TEXT
      канале когда ты в voice room в другом канале. «В эфире #voice-name»
      + count + mic toggle + deafen + leave + open-back button. Glow вокруг
      mic-icon когда PTT активен.
- [x] **Speaking-dots в ChannelList sticky voice users** — accent-glow
      ring у avatars говорящих + name становится accent-coloured. Только
      для voice room где ты сам (для других звук не слышишь — glow не нужен).
- [x] **VoiceSettingsModal redesign** — 3-mode segmented control для mic
      activation + VAD threshold slider с live VU-meter + AFK timeout
      slider. Убраны старые switchTrack/switchKnob.

**Bundle:** 418→429 KB raw (+11), 119→121 KB gzip (+2). Backend без изменений.

---

## v0.6.6 — Voice quality v3 (DNN noise + mic gain) — backlog

- [ ] **Krisp/RNNoise DNN noise filter** — wire поверх существующего
      «aggressive» mode placeholder. Кандидаты:
      - `@livekit/krisp-noise-filter` (требует LiveKit Cloud subscription
        или специальная лицензия — проверить для self-host)
      - `@jitsi/rnnoise-wasm` (Apache 2.0 free) — manual integration через
        AudioWorklet
      - Microsoft `noise-suppression-net` (MIT) — DNN, тяжелее
- [ ] **Mic gain** через Web Audio GainNode перед publish. Требует
      рефакторинг useVoice publish flow:
      `getUserMedia → MediaStreamSource → GainNode → MediaStreamDestination
      → new LocalAudioTrack(destination.stream.getAudioTracks()[0]) →
      room.localParticipant.publishTrack(track)`.
- [ ] **Auto-reconnect feedback** — если LiveKit reconnecting > 5s, показать
      banner «Восстанавливаем связь…» с retry button.
- [ ] **Voice channel "knock"** — knock-notification когда заходишь в
      пустой voice (опционально alert онлайн-юзерам сервера).

---

## v0.7 — Реакции (Reactions)

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

## v0.8 — Direct Messages (DMs) ✅ DONE (13.05.2026)

> Реализовано после v0.6.5 voice block close — Pavel сказал «давай продолжать
> разработку», выбрал DMs как самый крупный gap из roadmap.
> Backend commit `3916e3f`, frontend commit `1d069c0`.

**Schema (migration 20260513160000_add_direct_messages):**
- [x] `DirectConversation` model: 1-to-1 conversations, нормализованная пара
      (userAId < userBId) → unique constraint. Indices userAId/userBId +
      lastMessageAt для sidebar list sort.
- [x] `Message.channelId` стал nullable, добавлено nullable conversationId.
      XOR-invariant защищён CHECK CONSTRAINT в SQL (Prisma не имеет check
      constraints в schema, поэтому raw SQL).
- [x] Index Message(conversationId, createdAt) для history pagination.
- [x] User relations: dmsAsUserA / dmsAsUserB.

**Backend routes (`apps/server/src/routes/dm.ts`, ~420 строк):**
- [x] `GET    /api/dm/conversations` — мои convos sort by lastMessageAt
- [x] `POST   /api/dm/conversations/:userId` — get-or-create (idempotent upsert)
- [x] `GET    /api/dm/conversations/:id/messages` — paginated take=N
- [x] `POST   /api/dm/conversations/:id/messages` — send (content + attachments).
      Transaction: insert message + bump lastMessageAt. Emits dm:message:new
      в room + dm:conversation:bumped обоим participant'ам в их user-rooms.
- [x] `PATCH  /api/dm/messages/:id` — edit (author only)
- [x] `DELETE /api/dm/messages/:id` — soft-delete (author only — нет ролей в DM)

**Socket events:**
- [x] `dm:join` / `dm:leave` с server-side membership verify
- [x] `dm:message:new` / `updated` / `deleted` в room `dm:${convoId}`
- [x] `dm:reaction:added` / `removed` (reuses /api/messages/:id/reactions endpoint
      который теперь поддерживает оба контекста)
- [x] `dm:conversation:bumped` в user-specific room `user:${userId}`
- [x] Auto-subscribe socket'а к `user:${userId}` при connect

**Channel messages routes (`apps/server/src/routes/messages.ts`):**
- [x] edit/delete/pin/unpin теперь возвращают 400 если message — DM (используйте
      /api/dm/messages/:id). Pin не доступен для DM (нет ролей).
- [x] Reactions POST/DELETE поддерживают BOTH контекста: для channel msgs —
      member check; для DM — participant of conversation. Эмит в соответствующий room.

**Frontend hooks:**
- [x] `useDirectConversations(socket, currentUserId)` — list + sort by
      lastMessageAt + listen `dm:conversation:bumped` (preview + unread bump).
      `openDmWith(userId)` upsert'ит conversation и возвращает её id.
- [x] `useDirectMessages(convoId, socket, currentUserId)` — параллель
      useMessages для DM. send/edit/delete/toggleReaction → Promise<boolean>.
      Optimistic send с pending-replacement match по userId+content.
      Reuses MessageRow type.

**Frontend UI:**
- [x] `DirectConversationList` — sidebar replaces ChannelList в DM mode.
      Avatar 32px + presence-dot + name + last-msg preview + relative time +
      unread badge с accent-glow. «Вы:» префикс для own последнего message.
- [x] `ServerList` — new chat-bubble tile в начале (с unread badge).
      `dmsActive` highlight + `onDmsRequest` switch.
- [x] `MemberList` — «Написать в личку» icon-button в каждой row (hover-reveal,
      скрыта для self). `onOpenDm` callback.
- [x] `AppShell` — `inDmMode = activeServerId === null`. В DM mode renders
      DirectConversationList + DM MessageList/MessageInput. Pin/unpin отключён
      (`async () => false`). Member-list скрыт (нет server'а).
- [x] DM open-or-create через MemberList «Написать в личку» → auto switch
      в DM mode + auto-selection новой conversation.

**Bundle:** 429→444 KB raw (+15), 121→124 KB gzip (+3).

**Limits (отложено в v0.8.1):**
- Group DMs (3+ users) — текущая schema только 1-to-1.
- Voice/video в DMs — LiveKit call между двумя users.
- DM-specific search.
- Block user.
- Typing indicators в DMs (только в channels пока).

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
