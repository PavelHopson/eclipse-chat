# Eclipse Chat — Roadmap

> **Источник истины** по Eclipse Chat: позиционирование, текущее состояние,
> фазы, версии в проде, открытые направления. Стоит отдельно от
> `E:\projects\ROADMAP.md` (общий cross-repo лог Pavel'ового монорепо).
> Любая фича, которой нет в текущем коде, попадает сюда.

**Текущая версия в проде:** **v1.1.9** (StatusBoard + TeamHealth
dashboards cyber polish — продолжение polish track по Pavel
«продолжай»).

**Изменения v1.1.9:**

**StatusBoard (Доска задач kanban):**
- Eyebrow `Execution` → `EXECUTION_BOARD //` (monospace 0.18em)
- Title uppercase 0.08em display font (Orbitron)
- Column heads (Открыто / В работе / На ревью / Сделано) monospace
  0.65rem 0.18em
- Cards `.ec-corner-brackets` — top-right + bottom-left tactical
  brackets on hover

**TeamHealth (Здоровье команды):**
- chatTitle uppercase 0.08em display font
- 5 stat values → Orbitron + tabular-nums
- 5 stat labels → monospace 0.6rem 0.16em
- 5 stat cards → `.ec-corner-brackets`
- Section headers («Кто перегружен» / «За эту неделю» / «По
  комнатам») — monospace 0.7rem 0.18em + `◆` filled diamond
  prefix color-coded (risk-red / exec-green / accent-cyan)
- «Обновить» → `.ec-shimmer-sweep` UPPERCASE

**Сборка**: 6 files changed, +50/-28. CSS bundle unchanged
100.15 KB (только inline + className concats — все classes уже в
tokens.css).

**Предыдущие версии:** v1.1.8 (HomeToday «Сегодня»
cinematic polish — продолжение polish track по Pavel «делаем
дальше»).

**Изменения v1.1.8:**

HomeToday — первый экран после login'а, заходим ежедневно. До
v1.1.8 ещё не получал cyber polish.

**(1) Header eyebrow** «Операционная сводка» → «ОПЕРАТИВНАЯ_СВОДКА //»
(uppercase monospace 0.18em tracking).

**(2) Header h2** «Сегодня, {name}» → «Сегодня · {name}» uppercase
0.1em tracking + display font (Orbitron).

**(3) Stat cards** (7 шт: Задач / Просрочено / Инцидентов / Голос /
Одобрений / Активные комнаты / AI-алерты) получают `.ec-corner-
brackets` — top-right + bottom-left tactical-corner accents на
hover. Inset border-left color-coding сохранён.

**(4) Stat values** — Orbitron display font для чисел (-0.02em
tracking), monospace 0.6rem 0.16em для labels. Tabular-nums
сохранены.

**(5) Section titles** — `<h3>` monospace 0.7rem 0.18em tracking +
glyph `▸` → `◆` (filled diamond, consistent с sidebar diamonds
из v1.1.5).

**(6) «Обновить» button** — `.ec-shimmer-sweep` class + UPPERCASE
text. Idle: «ОБНОВИТЬ» / loading: «СИНХРОНИЗАЦИЯ…».

**Сборка**: 5 files changed, +44/-32. CSS bundle unchanged 100.15
KB (только inline style + className changes — все classes уже в
tokens.css из предыдущих slice'ов).

**Предыдущие версии:** v1.1.7 (real telemetry pills +
cipher shimmer typing — продолжение polish track по Pavel
«продолжай»).

**Изменения v1.1.7:**

**(1) Real telemetry pills** — backend `/api/health` теперь
включает live `mem` + `cpu`:
- `mem.percent` = system used / total в %
- `cpu.percent` = delta-busy/delta-total между samples (fallback на
  loadavg для первого вызова)
- `mem.processRss/heap`, `cpu.cores/load1m` — debug detail

Frontend новый `hooks/useTelemetry.ts` polls /api/health каждые
10s (cache:no-store), exposes `{memPercent, cpuPercent, pgActive,
online}` + status thresholds (ok<70, warn 70-89, risk≥90).

AppShell topbar pills читают live values:
- СЕТЬ — combined socket isReady + health endpoint online (3
  состояния: СТАБИЛЬНА / ДЕГРАД / ОБРЫВ)
- ПАМ / ЦП — real percent с color по threshold + tooltip с
  raw % + pg.active
- На проде сейчас показывают ПАМ 10.6% / ЦП ~17% (vs fake 12%/04%
  до v1.1.7)

**(2) `.ec-telemetry-pill--risk` variant** — для percent ≥ 90:
красно-розовая палитра + pulsing box-shadow (1.6s) — обращает
внимание когда система под нагрузкой. Respects reduced-motion.

**(3) Cipher shimmer typing indicator** (`.ec-cipher-bars`):
5-bar vertical equalizer (130ms stagger height oscillation +
cyan glow box-shadow) заменил 3-dot loader в TypingIndicator.
Выглядит как audio/cipher data-stream. Используется для всех
typing states (humans + bots).

**Сборка**: 8 files changed, +267/-14 (включая новый useTelemetry
hook). CSS bundle 99.04 → 100.15 KB raw (+1.11 KB), gzip 18.48 →
18.68 KB. Build 2.73s.

**Предыдущие версии:** v1.1.6 (composer / chat header /
modal cyber framing — продолжение polish track по Pavel feedback
«хорошо, продолжай делать дизайн»).

**Изменения v1.1.6:**

**(1) Composer status strip scan dots** — после «ВВОД ПОТОКА» /
«ОЖИДАНИЕ СИГНАЛА» появляются 3 fade-dot indicator (1.6s loop,
sequential delays, scale + box-shadow pulse). Subtle live-pulse.

**(2) Composer send button enhanced glow** (`.ec-composer-send`):
- Hover gradient sweep ::before (translateX -110 → 110%, 600ms)
- Triple-layered hover shadow: 28px outer halo + 1px border shine
  + 18px cyan glow

**(3) Composer box focus state** — atmospheric box-shadow halo
(32px cyan) появляется при focus-within сверху existing border-
accent. Композер «оживает» когда курсор внутри.

**(4) Chat title icon drop-shadow glow** — все channel-icon SVG в
header'е получают 4px cyan drop-shadow.

**(5) Generic Modal cyber framing** (Modal.tsx применяется ко всем
modals — CreateChannel / CreateServer / JoinServer / Confirm
/ etc):
- Modal header → `.ec-holo-edge` (1px holographic top-line)
- Title → uppercase + 0.18em tracking + display font (Orbitron
  fallback Inter)

**(6) ServerHubModal tabs** → `.ec-hud-tab` class на Обзор /
Оформление / Настройки / Боты. Active tab получает top-fade
gradient + 2px glowing bottom bar (consistent с sidebar HUD tabs
из v1.1.5).

**Сборка**: 8 files changed, +104/-8. CSS bundle 97.36 → 99.04 KB
raw (+1.68 KB), gzip 18.19 → 18.48 KB. Build 2.95s.

**Предыдущие версии:** v1.1.5 (cinematic delta усиление
+ BotsTab card layout bug fix — Pavel screenshot после v1.1.4:
«мало изменений вижу, продолжаем»).

**Изменения v1.1.5:**

**(0) BotsTab layout bug fix**: grid template `auto 1fr auto` →
`auto minmax(0, 1fr) minmax(0, 280px)`. Без `minmax(0, …)` col 2
(description) сжимался до 1 буквы в столбец когда col 3 (7 action
кнопок) запрашивал max-content (~700px). 280px cap для col 3
заставляет кнопки wrap'аться в 2-3 рядa vertically.

**(1) AI message distinct card** (`.ec-message-row--ai` в
tokens.css): violet linear-gradient bg + 2px violet border-left +
radial top-right corner glow halo. Hover bumps opacity. Bot
сообщения теперь мгновенно отличаются от human messages без
зависимости от bot-badge label. JSX в MessageList применяет class
когда `m.user.isBot`. Existing `.ec-avatar-halo--ai` сохранён.

**(2) Section labels diamond accents** (sidebar group headings):
- «ПОТОКИ ДАННЫХ» → cyan diamond glow (default)
- «ВЕЩАНИЕ» → violet diamond glow (`--diamond-violet` variant)
- «ГОЛОСОВЫЕ СВЯЗИ» → mint diamond glow (`--diamond-mint` variant)
Rotated 5×5px square + 6px box-shadow accent.

**(3) HUD tabs stronger active state** (`.ec-hud-tab` в
tokens.css): active tab получает top-fade gradient pseudo (cyan
0.12 → transparent) + 2px bottom accent bar с 8px cyan glow.
Применён к sidebar tabs (КАНАЛЫ / ЗАДАЧИ / ДАННЫЕ).

**(4) Server header holographic bottom-edge**
(`.ec-server-header-edge`): 1px gradient line под server-header
в sidebar (`var(--ec-holo-cyan)`).

**Сборка**: 8 files changed, +141/-12. CSS bundle 95.55 → 97.36 KB
raw (+1.81 KB), gzip 17.91 → 18.19 KB. Build 2.73s.

**Предыдущие версии:** v1.1.4 (ECLIPSE_CHAT rebrand +
cinematic polish pass — Pavel feedback «надо дизайн доработать»
после v1.1.3 LIVE).

**Изменения v1.1.4:**

**(0) Brand rename**: `ECLIPSE_OS` → `ECLIPSE_CHAT` в topbar
(Pavel preference).

**(1) Shimmer brand caption** (tokens.css `.ec-shimmer-text`):
animated gradient sweep по тексту brand title через
`background-clip: text` + `background-position` keyframes (4.5s
linear infinite, respects prefers-reduced-motion).

**(2) Cyber breadcrumb framing** (tokens.css `.ec-breadcrumb-cyber`):
заменил старый `/ name / #channel` на monospace «УЗЕЛ // <server>
/ #<channel>» с accent-цветом для active channel и opacity-ed
separator. AppShell.tsx topbar получает new structure.

**(3) Shimmer-sweep CTA hover** (tokens.css `.ec-shimmer-sweep`):
horizontal gradient sweep `translateX(-110% → 110%)` за 700ms
ease-out. Применён к «+ СОЗДАТЬ КОМНАТУ» и «+ НОВАЯ ТАБЛИЦА»
buttons в ChannelList footer.

**(4) Composer attach rotate** (tokens.css `.ec-rotate-hover`):
paperclip svg крутится на 90° при hover (320ms ease-out). Subtle
personality для composer.

**(5) MemberList full tactical-view redesign**:
- Header «Участники X/Y» → «ТАКТИЧЕСКИЙ ВИД» с violet map-icon
  (`--ec-accent-3`) + violet count-badge (X/Y) через
  `.ec-tactical-header` class.
- Per-row badge: вместо conditional ec-badge (showed только
  OWNER/ADMIN/MOD) — все 10 ролей получают 3-char monospace tag
  (OWN/ADM/MOD/ARC/DEV/OPR/MEM/CLI/VWR/GST) через
  `.ec-status-pill` variants (owner=orange, admin/mod=accent
  cyan, остальные=neutral dim).
- Row container получает `.ec-corner-brackets` — top-right +
  bottom-left tactical-corner accents opacity:0 → :hover 0.75.
- Wrap container получает `.ec-tactical-grid` — subtle 24px
  dot-grid bg (rgba 0.025 lines) создаёт sci-fi подложку.

**Сборка**: 9 files changed, +307/-76. CSS bundle 93→95.55 KB raw
(+2 KB), gzip 17.1→17.91 KB. Build 5.14s.

**Deferred в v1.1.5+**:
- Animated voice waveform (нужен refactor Attachments.tsx —
  существующий статичен через Web Audio peaks pre-computed).
- Light/Eclipse theme через `filter: invert(1) hue-rotate()`
  (mockup имел 3-mode ThemeContext).

**Предыдущие версии:** v1.1.3 (latest), v1.1.2, v1.1.1
(Eclipse_OS full visual adoption — v1.1.0 был too minimal по
Pavel'у («ну такое»). Полная adoption из AI Studio mockup'а:

**(1) Vocabulary correction** — все English labels из v1.1.0
переключены на **Russian cyberpunk** (mockup был на русском, не
английском как я ошибочно интерпретировал):
- CHANNELS → КАНАЛЫ / TASKS → ЗАДАЧИ / DATA → ДАННЫЕ
- DATA STREAMS → ПОТОКИ ДАННЫХ / BROADCAST → ВЕЩАНИЕ /
  VOICE LINKS → ГОЛОСОВЫЕ СВЯЗИ
- TACTICAL VIEW → ТАКТИЧЕСКИЙ ВИД / LINKED_NODES → СВЯЗАННЫЕ_УЗЛЫ /
  SLEEP_STATE → СПЯЩИЙ_РЕЖИМ
- INITIALIZE TRANSMISSION → ВВОД СООБЩЕНИЯ / TRANSMIT → ПЕРЕДАТЬ
- + INITIALIZE ROOM → + СОЗДАТЬ КОМНАТУ

**(2) Atmospheric background grid** (tokens.css): `.ec-shell::before`
overlay с 60×60 cyan grid lines + radial center spotlight + bottom
shadow gradient. Slow `ec-grid-drift` 60s linear infinite (respects
prefers-reduced-motion). `z-index: 0` под content (1).

**(3) Topbar telemetry pills** (AppShell.tsx): СЕТЬ: СТАБИЛЬНА /
ОБРЫВ (с pulsing dot, использует existing `isReady` socket state) +
ПАМ: 12% + ЦП: 04% (placeholder values, future real-time data). Через
`.ec-telemetry-pill` class.

**(4) Server header ID hash** (ChannelList.tsx): `◆ ID_xxxxxx_SYS_xxxxxx`
deterministic из serverId.slice(-6) + serverName.slice(0,6),
monospace, под server name. Server name теперь uppercase 0.08em
letter-spacing.

**(5) Composer redesign** (MessageInput.tsx): новая status strip над
composer-box — `>_ ЗАЩИЩЁННЫЙ_КАНАЛ` pill (accent-soft + border-accent)
+ status text «ВВОД ПОТОКА…» при focus / «ОЖИДАНИЕ СИГНАЛА…» при idle.
Bottom hints row: добавлен ШИФРОВАНИЕ E2E indicator справа (accent
glowing dot + uppercase label).

**(6) Sticky date dividers** (MessageList.tsx): новая функция
`formatLogEntryDay` — format «ЗАПИСЬ_ЖУРНАЛА_19_МАЯ_2026 //
СИНХР_ВРЕМЕНИ» с RU month abbreviations (ЯНВ/ФЕВ/МАР/etc). Style:
accent color, monospace, 0.08em tracking, 0.62rem font, hover title
показывает original «Сегодня»/«Вчера».

Pure visual+text. Никаких schema/API/logic изменений. AuthScreen
multi-step redesign — всё ещё deferred (v1.1.2 candidate).

**Предыдущие версии:** v1.1.0 (Eclipse_OS visual rebrand initial —
из Google AI Studio mockup'а который Pavel получил. Pavel-feedback:
«мне нравится как визуально он сделал, давай применим». Cyberpunk
operational system visual language adopted.

**New tokens** (apps/web/src/styles/tokens.css):
- `--ec-surface-glass` (rgba(11,15,20,0.45)) для frosted panels
- `--ec-holo-cyan` linear-gradient для holographic edges
- `--ec-glow-ai` + `--ec-glow-live` multi-layer box-shadow для avatar halos
- (Existing `--ec-accent-3` violet reused для AI variant — не дублирован)

**New utility classes**:
- `.ec-holo-edge` — 1px holographic top-edge via ::before
- `.ec-scan-line` — horizontal sweep keyframe (4s infinite, respects
  prefers-reduced-motion)
- `.ec-glass-panel` — frosted blur(20px) + saturate(140%)
- `.ec-avatar-halo--ai` — violet glow ring для bot avatars
- `.ec-avatar-halo--live` — cyan breathing 4s для speaking users
- `.ec-telemetry-pill` + variants (ok/warn) с monospace tnum
- Active channel — теперь holographic gradient left-border вместо
  solid (через `.ec-channel-item--active` style update)
- Custom scrollbar — `:hover` → cyan accent с smooth transition,
  Firefox через scrollbar-color/width

**Vocabulary rebrand** (Russian UI labels → English sci-fi tech):
- Sidebar tabs: «Каналы» → **CHANNELS** / «Работа» → **TASKS** /
  «Таблицы» → **DATA**
- Section labels: «Текстовые» → **DATA STREAMS** / «Каналы» (broadcast)
  → **BROADCAST** / «Голосовые» → **VOICE LINKS**
- Members panel: «Участники» → **TACTICAL VIEW** / «В сети» →
  **LINKED_NODES** / «Не в сети» → **SLEEP_STATE**
- Composer: «Сообщение в #X» → **INITIALIZE TRANSMISSION в #X…** /
  «Отправить» → **TRANSMIT** (+ letter-spacing 0.08em)
- «+ Новая комната» → **+ INITIALIZE ROOM**
- Brand: «Eclipse Chat» → **ECLIPSE_OS** (topbar, letter-spacing 0.18em)
- Bot badge: «BOT» → **AI_AGENT** в MessageList (только для GENERIC,
  taxonomy-role badges остаются с role-name)

**Russian content** (channel names / message content / display names /
descriptions) сохраняется — только UI/system labels рекодированы.

**Bot avatars** — теперь wrap'аются в `.ec-avatar-halo--ai` span с
violet glow ring (`--ec-glow-ai` shadow).

**Trade-offs**:
- AuthScreen redesign (multi-step biometric scan + 2FA keypad) —
  отложен в v1.1.1 чтобы scope не разбух
- Vocabulary доступно только англоязычным/смешанным users — full
  Russian fallback можно вернуть через i18n позже если потребуется
- Light theme через filter-invert (AI Studio предложение) — НЕ
  принят как anti-pattern (ломает image colors)

**Файлы изменены**: tokens.css (+140 строк effects layer),
ChannelList.tsx (7 vocab points), IntelligencePanel.tsx (1 label),
MemberList.tsx (2 sections), AppShell.tsx (brand), MessageInput.tsx
(placeholder + button label + title), MessageList.tsx (bot badge +
avatar halo wrap).

Полная история — в timeline ниже.)

**Предыдущие версии:** v1.0.2 (Composio AutomationRule UI editor —
закрывает loop из v1.0.1 (backend был ready, UI extension deferred).
Теперь OWNER может конфигурировать `COMPOSIO_ACTION` rules через
visual form вместо manual PATCH JSON. CreateRuleForm (AdminPanel
«Автоматизация» tab) расширен 4-м action type: «Composio action
(Gmail / Slack / Notion / …)» — рендерит ascending workflow:
**(1)** Status guard: если COMPOSIO_API_KEY не set → warn banner с
ссылкой на «Интеграции». Если есть только PENDING / DISCONNECTED
connections — hint «подключи app в Интеграциях». **(2)** Connection
picker: select из active connections (filtered by status ACTIVE).
**(3)** Action picker: lazy-load `/api/servers/:id/composio/
connections/:id/actions` при выборе connection — отображает list
с `displayName (name)`. **(4)** Params editor: monospace textarea с
JSON template (default: пример Gmail send_email с placeholders),
realtime JSON.parse validation, danger border + error hint если
invalid, hint про deep rendering {{user}}/{{message}}/{{channel}}.
**AutomationRow display extension** — per-action-type label «Composio →»
+ value показывает actionName в monospace. Type system extended:
`AutomationActionComposio` + ActionKind union включает
"COMPOSIO_ACTION". Pure UI/type extension, ноль schema/backend
изменений (backend handled v1.0.1). Closes #12 extra triggers
backlog item частично — Composio actions integrated, остальное —
NEW_TASK/APPROVAL/FILE_UPLOAD triggers — в v1.1+.

**Предыдущие версии:** v1.0.1 (Composio Automation Expansion —
из Pavel'ого Eclipse Library scan. **500+ OAuth-managed apps** через
единый Composio proxy: Gmail / Slack / Notion / Jira / Asana / Airtable /
Twilio / Stripe / Telegram / Discord / GitHub и ещё 490+. Massive
расширение #12 Automation system от 3 action types к ~500 connection
surfaces.

**Schema migration #46** — `ComposioConnection` model (per-server, OAuth
tokens AES-256-GCM encrypted с TWOFA_ENCRYPTION_KEY) + `AuditEventType`
расширён 3 значениями (COMPOSIO_CONNECTED / COMPOSIO_DISCONNECTED /
COMPOSIO_ACTION_EXECUTED).

**Backend** (`apps/server/src/lib/composio.ts`): pure-fetch wrapper к
Composio API — listSupportedApps / initiateConnection / verifyConnection /
disconnectConnection / executeAction / listActionsForApp. Никаких npm
deps (anti-pattern guard). Graceful disable: если COMPOSIO_API_KEY не
set — service возвращает 503, UI показывает «not configured» с setup
instructions.

**6 endpoints** (`apps/server/src/routes/composio.ts`):
GET /status, GET /apps, GET /servers/:id/composio/connections,
POST /servers/:id/composio/connect (initiate OAuth → return redirectUrl),
GET /api/composio/callback (OAuth return handler, validate via Composio
verify endpoint, promote PENDING → ACTIVE, audit, inline HTML auto-close),
DELETE /servers/:id/composio/connections/:id (Composio + Eclipse cleanup),
GET /servers/:id/composio/connections/:id/actions (list actions per app),
POST /servers/:id/composio/connections/:id/execute (manual test).

**Automation engine extended** (`apps/server/src/automation.ts`): new
ActionType `COMPOSIO_ACTION` discriminator (connectionId + actionName +
paramsTemplate JSON). `fireActionComposio` handler парсит template +
рендерит {{user}}/{{message}}/{{channel}} placeholders рекурсивно
(strings deep through objects/arrays) + executes через
composio.executeAction + audit logs.

**Frontend** (`apps/web/src/components/ComposioConnections.tsx`,
`apps/web/src/hooks/useComposio.ts`): новая secция в AdminPanel
«Интеграции» tab. Connection list с status chips (ACTIVE/PENDING/
EXPIRED), per-app icons из Composio metadata, last-used relative
display. App picker overlay с search filter, OAuth opens в new tab,
postMessage listener auto-reload'ает после callback.

Pavel-side setup: установить ENV `COMPOSIO_API_KEY` и опционально
`PUBLIC_BASE_URL` (для OAuth callback). После этого OWNER в каждом
workspace может connect apps.

**Версия v1.0.1** — patch number, хотя добавлен feature (compromise
с Pavel decision — keep 1.0.x family для UX iteration перед v1.1).

Полная история — в timeline ниже.)

**Предыдущие версии:** v1.0.0 🎉 (AI Controls milestone —
#11 закрыто. Major release: Eclipse Chat exits 0.x. Pavel-pick
после UX-серии (v0.95-v0.99). Расширили BotsTab (живёт в ServerHub
«Боты» tab) с full AI controls panel:

(1) **Test prompt** — новая «Тест» кнопка per bot открывает inline
panel с textarea + Run. Backend `POST /api/servers/:id/bots/:botId/test`
прогоняет system prompt + user input через AI provider chain (Ollama →
OpenRouter → NVIDIA → OpenAI) и возвращает response + provider +
model + latency без сохранения message в канал. Preview prompt-changes
безопасно. 503/502 graceful errors если AI not configured.

(2) **Usage stats** — новая «Стата» кнопка с inline panel: 24h / 7d /
total message counts + top-3 channels (с iconography per channel type)
+ last API usage relative. Lazy-fetched on open, cached в session.
Backend `GET /api/servers/:id/bots/:botId/usage` aggregate'ит из
существующей Message table без logs schema migration.

(3) **Audit observability** — новые enum values `BOT_PROMPT_UPDATE`,
`BOT_PROMPT_RESET`, `BOT_TEST_INVOKE` в AuditEventType. PATCH /api/
bots/:id теперь pишет audit при изменении systemPromptOverride.
Migration `20260519120000_bot_ai_audit_events` (ALTER TYPE ADD VALUE
с IF NOT EXISTS — idempotent). 45-я миграция на проде.

Per-bot busy state — UI doesn't block whole tab при run test одного
бота. Всё additive, ноль breaking changes.

Полная история — в timeline ниже.)

**Предыдущие версии:** v0.99.0 (Responsive polish pass —
Pavel-ask 19.05 «проверь чтобы всё было максимально оптимизовано и
правильно показывалось на всех устройствах». Audit показал 4
критичных issue: (1) **service worker stuck на v0.84** — users
получали stale JS chunks для всех v0.95-v0.98 компонентов; bumped
до v0.99. (2) **ChatHeaderHoverButton popover** выезжал за viewport
на ≤360px mobile (width 320 vs viewport 360); fixed `min(320,
calc(100vw - 64px))`. (3) **Modal.tsx width formula** — на mobile
с width=620 (ServerHubModal) растягивался во весь экран без breathing
room; fix `calc(100vw - 32px)`. (4) **ChannelInfoPanel + ServerHubModal
tabs** на mobile overflow'или — добавлены `overflow-x: auto`
fallback'ы на ≤400px / ≤600px. Plus: chat-header touch targets 38×38
min на mobile, flex-shrink для title на laptop 1025-1366,
prefers-reduced-motion global guard для новых компонентов. Полная
история — в timeline ниже.)

**Предыдущие версии:** v0.98.0 (Chat surface cleanup —
Pavel-ask 19.05 «середина чата должна быть чистой, все закрепы и
задачи при наведении отображались поверх экрана». ActionQueueBar
(«Контур исполнения» banner с onboarding text + sla / digest rail) и
PinnedBar («Закреплённые: N показать» strip) удалены из ленты — оба
постоянно ели вертикальное место сверху MessageList'а. Функционал
переехал в **hover-buttons chat-header'а** — compact icons с count
badge: 📌 (warn-tone) для pinned messages + ✓ (exec-tone) для open
tasks. Hover показывает popover с top-3 items preview + «Показать все»
link → opens ChannelInfoPanel на соответствующем tab. Reusable
ChatHeaderHoverButton<T> generic component. Chat-area теперь:
chat-header → MessageList → composer, без banners. Полная история — в
timeline ниже.)

**Предыдущие версии:** v0.97.0 (UX refactor Part 2 —
Pavel-feedback 19.05: «надо отдельную кнопку создания канала + лучше
экран настроек сервера». Два направления: (1) **CreateChannelModal**
заменил inline-composer внизу sidebar — теперь «+ Новая комната»
кнопка сверху Channels tab + «+» icons в section-headers (Текстовые/
Каналы/Голосовые) с pre-selected типом. Modal: name + type selector
(4 cards: TEXT/BROADCAST/VOICE/EXECUTION) + auto-focus. (2)
**ServerHubModal** объединил старые ServerInfoModal + ServerSettingsModal
в один tabbed модал: Обзор / Оформление / Настройки / Боты + collapsible
«Опасная зона» footer (leave/delete). Read-only state видит любая роль,
edit-tabs скрыты для не-OWNER. Старые 2 файла удалены — единая точка
управления сервером. Полная история — в timeline ниже.)

**Предыдущие версии:** v0.96.0 (UX refactor — Pavel-feedback
со скриншотами 19.05 «справа должны быть только участники, в sidebar
слишком много всего, надо вкладки». Major redesign в 3 направлениях:
(1) **Right rail упрощён до Members-only** — старая IntelligencePanel
с 5 tabs (Сводка/Память/Дела/Файлы/Люди) превратилась в clean
MemberList с header «Участники · 5/12». (2) **Sidebar разделён на 3
вкладки** — Каналы / Работа / Таблицы вместо длинного смешанного
списка. Persisted per-server в localStorage. (3) **(i)-кнопка в
chat-header** + новый ChannelInfoPanel — open ↓ show 4 inner tabs
(Сводка/Память/Дела/Файлы) overlay'ем сверху chat-area, ESC закрывает.
Auto-close при смене канала. CLIENT-mode унифицирован с operator UX.
Полная история — в timeline ниже.)

**Предыдущие версии:** v0.95.0 (UI density pass Phase 1 —
системный fix визуальной обрезки вместо очередного hotfix.
IntelligencePanel labels (Сводка/Память/Дела/Файлы/Люди) теперь visible
по умолчанию вместо force-hide на всех viewport'ах; на tight laptop
1025-1366 — active tab labeled, остальные icon-only с title tooltip.
HomeToday stat grid 150→132 minmax (+1-2 cards per row для 7 карточек),
ClientPortal sections 160→140. Pure CSS+layout, ноль logic. Phase 2
(v0.96) — Tables + AdminPanel + Drawer responsive. Phase 3 (v0.97) —
touch fallbacks + RU UPPERCASE word-break systematic. Сессия 18-19.05
закрыла v0.83→v0.95 — 13 prod-деплоев. Полная история — в timeline ниже.)

**Предыдущие версии:** v0.81.0 (#27 phase 2 Mobile-first PWA —
manifest расширен (id/display_override/shortcuts/categories/maskable icons),
vanilla service worker `sw.js` зарегистрирован после window-load с scope =
BASE_URL (стратегии: network-only для /api+/socket.io, cache-first для
/uploads, network-first + offline fallback для navigation, stale-while-
revalidate для прочих GET). Touch swipe nav между TEXT/EXECUTION каналами
через новый `useSwipeNavigate` hook (60px threshold + 50px drift tolerance +
700ms time limit). Voice-first FAB: mic button 40px на mobile с
recording-pulse glow animation. Push notifications skip (отдельный major
slice, требует web-push lib + Subscription schema). Подробности в timeline.)

**Предыдущие версии:** v0.80.0 (#26 phase 1 Automation system —
declarative trigger/action rules per workspace. Schema: `AutomationRule`
с JSON-stored trigger (MESSAGE_NEW + keyword + channel filter) и action
(POST_MESSAGE + target channel + template с placeholders {{user}} /
{{message}} / {{channel}}). Engine: `automation.ts` fire-and-forget на
message:new — scan enabled rules → match keyword → render template →
post message от системного user'а → emit. Anti-loop: skip authorIsBot.
CRUD `/api/servers/:id/automations` (OWNER/ADMIN only). AdminPanel tab
«Автоматизация» — list + enable toggle + delete + inline create form
(name / keyword / trigger-channel / action-channel / template). Подробности
в timeline.)

**Предыдущие версии:** v0.79.0 (#22 phase 1 Live voice
intelligence — AI extraction tasks/decisions/follow-ups из voice-
transcripts. Новый endpoint `POST /api/attachments/:id/extract-actions`
читает READY transcript audio-attachment'а, прогоняет через AI chat()
с JSON-only prompt'ом «выдели операционные элементы», парсит результат,
создаёт ActionItem'ы (max 8 per call) и связывает их с исходным
message. Skip duplicate types через existing unique constraint
(sourceMessageId+type). Frontend: button «Извлечь задачи» под transcript
блоком audio-attachment'а с inline result counter + error display.
LiveKit Egress (server-side recording для full room) — phase 2 slice.)

**Предыдущие версии:** v0.78.0 (#17 phase 1 Roles v2 — extended
`MemberRole` enum 4 → 10 (ARCHITECT/DEVELOPER/OPERATOR/CLIENT/VIEWER/GUEST),
новый `lib/permissions.ts` с 20-permission matrix × 10-role MATRIX,
`hasPermission()` + `isModOrHigher()` helpers (включает OPERATOR), Admin
Panel «Роли» tab — visual matrix viewer + role description cards с
tone-coloured chips, member role-edit dropdown расширен до 9 assignable
ролей. Phase 2 — custom roles per workspace + backend enforcement через
`hasPermission` calls. Подробности в timeline.)

**Предыдущие версии:** v0.77.0 (#21 phase 1 AI persistent memory +
semantic search — major slice. New `MessageEmbedding` model (`Float[]`
storage, no pgvector dependency — works on native PG). New `ai/embeddings.ts`
provider chain: Ollama nomic-embed-text → OpenAI text-embedding-3-small
(dimensions=768). L2-normalized vectors → cosine via dot-product. Sync
writer fires-and-forgets на каждый message:new (channel + thread, DMs
skipped в v1 для privacy + signal/noise). Search endpoint `POST
/api/servers/:id/search/semantic` — embed query → load all server
embeddings (cap 30K) → JS cosine sort → top-20 с score. Membership +
internal-channel filter. SearchOverlay 4-я tab «Семантика» с relevance
badge (% score), debounced 400ms, lazy на tab open. 503 если embedding
provider не сетап — tab скрыт. Подробности в timeline.)

**Предыдущие версии:** v0.76.0 (Bundle: #20 phase 2 dependencies
DAG viz (mini-SVG в ActionItemDrawer — 3-layer layout blockers/me/blocks
с arrows, max 6 nodes per row), #25 phase 1 Admin Panel (full-screen
OWNER+ADMIN view с 5 tabs: Обзор / Участники / Комнаты / Аудит /
Аналитика; новый endpoint `GET /api/servers/:id/audit-log` с filter по
server-scoped event types), #28 phase 2 Home AI-alerts (heuristic-derived
staleTasks 14d + escalated 24h cards в HomeToday с warn-toned alert card
в stat-grid). Подробности — в timeline ниже.)

**Предыдущие версии:** v0.75.0 (Operational Tables phase 2.5b —
RELATION + FILE field types. RELATION ячейка хранит JSON array of
rowIds из linked table (max 5), picker рендерит multi-select с
display-value первой колонки target table. FILE ячейка хранит JSON
array `{url, filename, mimeType, size}`, standalone upload через
`/api/tables/:id/upload` в `/uploads/tables/`, chip-list UI с download
+ remove. AddFieldForm: dropdown linked-table picker когда type=RELATION.
Schema: `TableField.linkedTableId` nullable FK + SetNull cascade,
TableFieldType enum +RELATION +FILE. Подробности — в timeline ниже.)

**Предыдущие версии:** v0.74.0 (Bundle: #18 phase 1 SUPPORT +
ARCHITECT bot roles, #16 phase 1 Channel.type EXECUTION (kanban as room
mode), #29 phase 1 Temporary rooms (Channel.expiresAt + cron auto-delete
+ countdown badge), #29 Focus mode (per-user localStorage toggle +
mention/pinned/own filter), #32 phase 3 MusicMiniPlayer expand modal с
big waveform. Pavel-ask «делай всё по максимуму из списка». Подробности —
в timeline ниже.)

**Предыдущие версии:** v0.73.0 (Bundle: In-app Help/Onboarding,
ActionItem dependencies phase 2 + escalation cron phase 3 + AI summary
phase 4, плюс mobile responsive simplify pass — drawer mutex, fullscreen
overlays, 2-col stat grid forced, breadcrumb nowrap, composer textarea
min-width:0, channel-action gear/trash hidden на mobile. Pavel-report
17.05: «всё криво и не адаптировано». Подробности — в timeline ниже.)

**Предыдущие версии:** v0.72.0 (Music в VOICE-каналах phase A
— backend разрешил VOICE для music sessions, new endpoint `GET /api/
servers/:id/audio-tracks`, VoiceMusicPicker modal, кнопка «Музыка» в
VOICE chat-header, MusicMiniPlayer overlay активен в любом канале.)

**Предыдущие версии:** v0.71.0 (Execution kanban phase 1 —
4-status enum OPEN/IN_PROGRESS/REVIEW/DONE, StatusBoard переписан в
4-column kanban с HTML5 drag-and-drop status transitions, ActionItem
Drawer status select с 4 значениями. До этого v0.70 Tables 2.5a.)

**Предыдущие версии:** v0.70.0 (Operational Tables phase 2.5a —
drag-and-drop reorder fields+rows, 2 templates «Задачи» / «CRM лиды»,
CreateTableModal с template picker. До этого v0.69.0 Home expansion.)

**Предыдущие версии:** v0.69.0 (Home expansion — 2 новые
секции в «Сегодня»: «На моём одобрении» (approvals waiting) + «Активные
комнаты» (top-5 channels by message-count за last 1h, presence-of-
activity heat). +2 stat cards. До этого v0.68.0 Scroll containment,
v0.67.0 Link embeds, 17.05.2026)
— https://app.star-crm.ru/eclipse-chat/

**Предыдущие версии:** v0.68.0 (Scroll containment hotfix —
ChannelList / rail / members больше не overflow за viewport на коротких
экранах), v0.67.0 (Link embeds — OG preview
cards для URL в сообщениях: backend `GET /api/embeds/preview` с
DNS-resolution SSRF guard (private-IP block, scheme check, 8s
timeout, 5MB body cap, manual redirect chain), `LinkEmbed` cache
table TTL 7d/24h, regex-based OG meta parser без HTML deps; frontend
`useLinkPreview` + memory cache + `LinkEmbedCard` (thumbnail +
title + desc + host, accent border-left, calm). До этого v0.66.0
Audio waveform, v0.65.0 Mobile hardening v2, v0.64.0 Account limit,
v0.63.0 Security & integrity pass, 17.05.2026)
— https://app.star-crm.ru/eclipse-chat/

> **Сессия 15.05 (вечер)**: v0.28 → v0.47 = 20 prod-деплоев за один заход.
> AI Agents типология (#6 brief) закрыта полностью. Execution Analytics
> base + pre-filter. Client Mode v1+v2. Premium motion + skeletons +
> cascade reveals. Brand identity scaffolding. Mobile responsive multi-
> round. Threads hotfix. Voice diagnostics + Reset. Multi-cam grid.
> AI typing indicator. Детали в timeline ниже.

## 📌 Позиционирование (зафиксировано 15.05)

Eclipse Chat **НЕ** Discord-clone / Slack-clone / Telegram-clone.

Eclipse Chat = **operational communication infrastructure** =
**Discord × Telegram × Linear × Notion × AI Workspace**.

Главная формула: **communication + execution + memory + intelligence**.

**Next-generation product north star зафиксирован отдельно:**
[`docs/NEXT-GEN-OPERATIONAL-PLATFORM.md`](docs/NEXT-GEN-OPERATIONAL-PLATFORM.md)

Новая формула платформы: **communication + execution + AI + memory +
workflows**. Это уже не "чат с фичами", а operational collaboration
platform: workspaces / rooms / execution entities / AI agents / operational
tables / client portals / automation.

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
| **v0.82.0** | 18.05 | **#19 phase 1 Bot Builder foundation** (closes engineering #19 phase 1). Visual node-editor графа — phase 2 slice (требует React-Flow / custom SVG); phase 1 расширяет automation capabilities, на которых node-editor потом построится. **Action discriminators** в `automation.ts`: `parseAction()` теперь возвращает `ActionDef = POST_MESSAGE \| CREATE_TASK \| SEND_WEBHOOK`. Engine разделён на `fireActionPostMessage` / `fireActionCreateTask` / `fireActionSendWebhook` — каждая с per-type validation. Common context (userDisplay / sourceChannelName / tplCtx) pre-fetched once и shared. **CREATE_TASK**: создаёт ActionItem с template title (`{{user}}/{{message}}/{{channel}}` placeholders), типа TASK/DECISION/FOLLOW_UP. P2002 (unique sourceMessageId+type) — silent skip как "не-fired" (правило с тем же type на том же message уже создано). createdByUserId = system user (fallback на authorUserId если system отсутствует). emit `action:item:created` для Status Board sync. **SEND_WEBHOOK**: POST на https URL с JSON body (eventId / eventType=automation.fired / ruleId / ruleName / serverId / channelId / messageId / authorUserId / content (clipped 2000) / firedAt). SSRF guard: only https://, reject localhost / 127.x / 10.x / 192.168.x / 169.254.x / 172.16-31.x. Optional HMAC-SHA256 signature через `X-Eclipse-Signature: sha256=...` header. AbortController с 8s timeout. `redirect: manual` — не follow redirects. Non-2xx → не считается fired (no fireCount increment). **Trigger.regex**: alternative или дополнение к substring keyword. Validate compileability на save через zod refine (invalid → 400). При firing — если keyword матчит, дополнительно проверяет regex; invalid regex skip silently. caseInsensitive применяется к flag 'i' regex'а. **CRUD validation** (`routes/automations.ts`): discriminated union zod schema для action. POST_MESSAGE требует target channel same-server + TEXT/BROADCAST; CREATE_TASK / SEND_WEBHOOK — без channel validation. **Frontend**: AutomationTrigger/Action types в AdminPanel расширены на 3 action discriminators. `AutomationRow` с per-action-type preview: POST_MESSAGE показывает #channel + template, CREATE_TASK — typeLabel (задача/решение/follow-up) + titleTemplate, SEND_WEBHOOK — host из URL в mono-шрифт. WHEN секция показывает regex с `/pattern/` или keyword. **CreateRuleForm v2**: radio toggle substring↔regex с live validation (red border on invalid). Action-type dropdown переключает поля: POST_MESSAGE (channel + textarea), CREATE_TASK (taskType select + textarea), SEND_WEBHOOK (url + secret + SSRF note). `canSubmit` per-type. **No schema changes** — все trigger/action data в existing JSON. **Verified**: typecheck зелёный (backend + web). | TBD |
| **v0.81.0** | 18.05 | **#27 phase 2 Mobile-first PWA** (closes engineering #27 phase 2). Pavel-order: finale из priority queue. **Manifest** (`public/manifest.webmanifest`) расширен: `id="eclipse-chat"`, `display_override` chain (window-controls-overlay → standalone → minimal-ui), `categories` (productivity / business / social), separate `purpose: any` и `purpose: maskable` иконки (нельзя «any maskable» вместе — Chromium warning), `shortcuts` (Главная + DM с deeplink через `?view=dm`). **Service worker** (`public/sw.js` — vanilla, без Workbox dep): SW_VERSION bump для invalidate. Стратегии: network-only для `/api/*` и `/socket.io/*` (никогда не cache live); cache-first для `/uploads/*` (immutable hashed names); network-first + cached app shell fallback для HTML navigation (offline page «Нет соединения» если cache промахнулся); stale-while-revalidate для прочих same-origin GET. App shell pre-cache при install (./, manifest, favicons). Old caches очищаются на activate. **Registration**: `main.tsx` регистрирует sw.js после window-load (не блокирует initial paint), scope = `import.meta.env.BASE_URL` (path-based deploy `/eclipse-chat/`). **Touch swipe nav**: новый `useSwipeNavigate` hook (60px threshold, 50px vertical drift tolerance, 700ms time limit). AppShell: `useSwipeNavigate({enabled, onSwipeLeft, onSwipeRight})` — после declaration `handleSelectChannel` (TDZ-safe). enabled = mobile && !any-drawer && !DM/voice/help/admin/home/board/teamhealth/table. Swipe навигирует по фильтру `c.type === "TEXT" \|\| c.type === "EXECUTION"` с circular wrap (next/prev modulo length). **Voice-first FAB**: existing `.ec-composer-icon-btn` на ≤640px увеличен до 40×40px (от 34px), recording state получил `box-shadow: 0 0 0 2px var(--danger)/0.45 + 0 0 16px -2px ...` + `ec-recording-pulse` animation (scale 1 → 1.08 1.4s ease-in-out infinite). `prefers-reduced-motion` отключает animation. **What's NOT в v1**: push notifications (требует web-push npm lib + VAPID keys + Subscription schema + send-on-mention/escalation backend wiring — отдельный major slice), background sync API, install-prompt UX, periodic background sync, share target. Эти — phase 3 slices. **Verified**: typecheck зелёный (backend + web). Vite собирает public/sw.js как-is (без bundling), serve'ится с BASE_URL prefix через nginx alias `/eclipse-chat/uploads/` — wait nope, manifest+sw из webroot, не uploads. nginx уже serve'ит static из dist/. Должно работать. | TBD |
| **v0.80.0** | 18.05 | **#26 phase 1 Automation system — declarative trigger/action rules per workspace** (closes engineering #26 phase 1). Pavel-order: после #22 → #26. **Schema**: новая модель `AutomationRule` (id, serverId, name, enabled, trigger TEXT-JSON, action TEXT-JSON, createdByUserId nullable SetNull, createdAt, lastFiredAt, fireCount). FK Cascade на Server. User reverse-relation `createdAutomations`. Index (serverId, enabled) для быстрого scan'а в engine. Migration `20260518120000_automation_rules` additive, zero-downtime. **Engine** (`apps/server/src/automation.ts`): `scheduleAutomation(serverId, channelId, messageId, authorUserId, content, authorIsBot, log)` fire-and-forget вызов после `emitMessageOnChannel`. Anti-loop guard: skip если `authorIsBot=true` (rule-posted messages не триггерят cascade). Load enabled rules with limit 50, match per-rule: trigger.channelId filter (null=any), trigger.keyword substring (caseInsensitive default true). Validate action.channelId same server + type TEXT/BROADCAST. Template renderer заменяет `{{user}}` / `{{message}}` (clipped 400 char) / `{{channel}}` placeholders. Post message с systemUserId (cached lookup на `system@eclipse-chat.local`, fallback на oldest user). emit `message:new` с `isBot: true`. Increment `fireCount` + update `lastFiredAt`. **CRUD routes** (`routes/automations.ts` + register в index.ts): GET `/api/servers/:id/automations` (member), POST/PATCH/DELETE — OWNER+ADMIN only. zod-валидация trigger/action discriminators. Создание validates target channel same-server + TEXT/BROADCAST; trigger.channelId optional same-server check. `serializeRule` парсит TEXT JSON для frontend ответа. **Frontend**: AdminPanel `Tab` extended на «automation» (7-я tab), lazy fetch rules при open. State: rules / rulesLoading / rulesError / showCreateRule. `toggleRule` PATCH с `enabled` flip + local optimistic update. `deleteRule` confirm + DELETE. `createRule` POST → prepend в list, close form. **Components**: `AutomationRow` — name + enabled chip + fireCount + WHEN/THEN description с trigger channel name + action channel name + template preview (120 char clip) + «Выключить»/«Удалить» buttons (OWNER+ADMIN only). `CreateRuleForm` — inline accent-bordered form: name + keyword + trigger-channel select (с «— любой канал —» option) + action-channel select + template textarea (3 rows) + Cancel/Создать кнопки. Все selectors отфильтрованы по type TEXT/BROADCAST из channels prop. **Use case example**: «Когда кто-то пишет 'спасибо' в #общий → бот публикует в #команда: "{{user}} сказал(а) спасибо в #{{channel}}: {{message}}"». **What's NOT in v1**: больше trigger types (NEW_TASK, FILE_UPLOAD, APPROVAL, MENTION), больше action types (CREATE_TASK, WEBHOOK_OUT, UPDATE_TABLE), регулярки в keyword вместо substring, conditions (regex + role + time-of-day), Bot Builder visual editor с node-graph, external integrations (Telegram bridge, GitHub webhook, Notion sync, Bitrix/1C). Все эти — phase 2/3 slices. | TBD |
| **v0.79.0** | 18.05 | **#22 phase 1 Live voice intelligence — AI extraction задач/решений/follow-ups из voice-transcripts** (closes engineering #22 phase 1). Pavel-order: после #17 → #22. **Approach choice**: вместо LiveKit Egress (требует Docker compose service + storage infra на проде) — phase 1 работает с existing v0.58 batch Whisper transcription pipeline. Любое audio-attachment автоматически транскрибируется при upload (existing); user может извлечь tasks из ready транскрипта через новую кнопку. **Backend**: новый файл `routes/attachments.ts` + `registerAttachmentRoutes` хук в `index.ts`. Endpoint `POST /api/attachments/:id/extract-actions`: membership-check через attachment → message → channel → serverId; validate `transcriptStatus === "READY"` + transcript >= 20 chars; AI chat() prompt — RU system: «выдели TASK/DECISION/FOLLOW_UP, JSON-only output, max 8 items, без markdown/preamble»; `parseExtracted` parser устойчив к ```json fences и malformed JSON; для каждого валидного item — db.actionItem.create с unique-violation skip (P2002 на existing (sourceMessageId, type)); emit `action:item:created` для каждого — Status Board / IntelligencePanel получают live update. 503 если AI не сконфигурирован, 502 если provider упал. **Frontend**: `TranscriptBlock` принимает `attachmentId` prop; добавлен dashed-border button «Извлечь задачи» под transcript text. State: extracting / extractedCount / extractedNote / extractError inline. После success — chip «+N задач» или «Ничего не выделено». Через apiJson(), не raw fetch. **Что НЕ в v1**: LiveKit Egress server-side recording (real-time mix всех participants — phase 2, требует Docker service + storage); live Whisper streaming overlay; AI capture в реальном времени во время voice-call; auto-extraction без user-click; voice-room recording controls для host'а. Phase 1 — практичный value: записал голосовое → автоматический транскрипт → один клик → ActionItem'ы в kanban. | TBD |
| **v0.78.0** | 18.05 | **#17 phase 1 Role architecture v2** (closes engineering #17 phase 1). Pavel-order: после AI memory → roles next. **Schema**: `MemberRole` enum 4 → 10 — добавлены ARCHITECT (tech-lead / decisions), DEVELOPER (engineer / room create), OPERATOR (dispatcher / mod-level), CLIENT (external client в CLIENT-mode workspace), VIEWER (read-only + аналитика), GUEST (limited). AI_AGENT не добавляется — уже выполняется через `Bot.role` taxonomy (v0.74). Migration `20260518100000_member_roles_v2` — 6 ALTER TYPE ADD VALUE, additive, zero-downtime. Existing OWNER/ADMIN/MOD/MEMBER rows безопасны. **Permission lib** (`apps/server/src/lib/permissions.ts`): 20 permission'ов (ROOM_*, MESSAGE_*, TASK_*, MEMBER_*, BOT_*, ANALYTICS_*, AI_USE), hardcoded MATRIX `Record<MemberRole, Set<Permission>>`. `hasPermission(role, perm)` + `permissionsForRole(role)` + `isModOrHigher(role)` (последний теперь включает OPERATOR в дополнение к OWNER/ADMIN/MODERATOR — operational dispatch получает moderation-level прав). **Backend wiring**: existing `isMod()` локальные helpers в `routes/music.ts` и `routes/music.ts` заменены на reuse `isModOrHigher` из централизованного lib (OPERATOR теперь mod-level в music + tables). Остальные routes — оставлены как есть (hardcoded checks), phase 2 заменит на `hasPermission` calls. `MEMBER_ROLES` массив в `routes/servers.ts` расширен до 10 элементов — POST/PATCH validates новые value'ы. **Frontend mirror** (`apps/web/src/lib/memberRoles.ts`): полная копия MATRIX + `PERMISSION_LABELS_RU` + `ROLE_LABELS_RU` + `ROLE_DESCRIPTIONS_RU` + `ROLE_TONES` (10 ролей × HSL fg/bg/border). `PERMISSION_GROUPS` (6 групп для табличного render). `hasPermission` frontend duplicate. Source-of-truth — backend; frontend файл syncs manually при schema-changes. **AdminPanel**: 6-я tab «Роли · 10» с двумя секциями: (1) карточки-описания всех 10 ролей с chip + RU-description, (2) `<table>` matrix 20 permission rows × 10 role cols (с группами как separator-rows), sticky первая колонка для UX. `RoleChip` компонент использует `ROLE_TONES` per-role colors. Members tab dropdown теперь рендерит все 9 assignable ролей (через `ROLE_ORDER.filter(r !== "OWNER").map`). `AssignableMemberRole` = `Exclude<MemberRole, "OWNER">`. **useMembers**: `MemberRole` type extended, `updateMemberRole(memberUserId, newRole)` сигнатура — `Exclude<MemberRole, "OWNER">`. **MemberList**: `ROLE_RANK` для сортировки расширен до 10 ключей (OWNER first, GUEST last). **Verified**: full monorepo typecheck зелёный. **No deploy prereqs** — schema additive ALTER TYPE ADD VALUE безопасен на live PG. **What's NOT in v1**: custom per-workspace roles + RBAC matrix editor (read-only viewer only), hasPermission calls в большинстве existing route handlers (только isMod места затронуты), AUDIT_LOG_VIEW enforcement через permission (сейчас inline OWNER/ADMIN check), member-counts breakdown per-role в Admin tab. Phase 2 — full RBAC + Role table + editable matrix UI. | TBD |
| **v0.77.0** | 17.05 | **#21 phase 1 AI persistent memory + semantic search** (closes engineering #21 phase 1). Major slice — самый killer feature §8 NEXT-GEN. **Schema**: новая модель `MessageEmbedding` с `Float[] vector` (`double precision[]` native Postgres, БЕЗ pgvector — anti-pattern на cv6067007 native PG где extension может быть не установлен; future migration на pgvector + IVFFlat — отдельный slice когда упрёмся в потолок 30K сообщений). `messageId` unique FK с Cascade. Migration additive, zero-downtime. **Embeddings module** (`ai/embeddings.ts`): provider chain Ollama (`POST {OLLAMA_BASE_URL}/api/embeddings`, model `nomic-embed-text`, 768-dim) → OpenAI (`POST /v1/embeddings`, model `text-embedding-3-small` с `dimensions=768`). Output: L2-normalized vectors (unit-length) — cosine similarity сводится к простому dot-product. `clampDim` к 768 + `l2Normalize` defensive. Env: `OLLAMA_EMBED_URL` / `OLLAMA_EMBED_MODEL` / `OPENAI_EMBED_MODEL`. `EmbeddingNotConfiguredError` если ни один не сетап. **Sync writer** (`ai/embedSync.ts`): fire-and-forget `scheduleEmbed(messageId, content, log)` вызывается после `emitMessageOnChannel` в channels.ts + после `emitThreadReplyNew` в threads.ts. Guards: min 12 chars, max 4000 chars, no-op если provider не сетап, skip duplicates через unique index. DMs скипаются в v1 (privacy + signal/noise). Bot autoreplies скипаются (засоряют). Никогда не reject promise — caller обернёт void, ошибка только log.warn. **Search endpoint** `POST /api/servers/:id/search/semantic`: body `{query, limit?}`, membership check + CLIENT mode internal-channel filter. Embed query → load `MessageEmbedding`-ов сервера (joined через `message.channel.serverId` filter, soft cap 30_000, only matching model — cross-model search не имеет смысла). JS-side cosine (dot-product unit-vectors) + threshold отсечка score ≤ 0.1 + sort desc + top-N. Response: `{query, model, total, results[]}` со score + content + channel + author meta. 503 на `EmbeddingNotConfiguredError`, 502 на provider failure. **Frontend**: новый `useSemanticSearch(serverId, query, enabled)` hook с debounce 400ms + min 3 char + outdated-response-guard через reqId counter. Auto-detect 503 → `notConfigured` flag → tab скрывается. SearchOverlay: 4-я tab «Семантика» (показывается только когда `semanticAvailable && truncated`), не участвует в auto-switch на первую non-empty (это explicit user choice). Каждый row рендерит relevance badge (% score, accent-soft, формат `XX%`). Если 0 hits + ≥3 char → EmptyState «Ничего похожего». Click на row → existing `onSelectMessage` flow (открывает channel). **AppShell wire**: SearchOverlay получает `semanticServerId={activeServerId}` prop. **Verified**: typecheck зелёный (backend + web), prisma generate ok. **Performance trade-off**: 30K messages × 768 floats × 8 bytes = ~180 MB load + ~250ms JS dot-product compute. Для типичного workspace (1-10K сообщений) — sub-100ms. **Backfill для существующих сообщений** — НЕ включён в v1 (требует batch cron + rate limit). Только новые сообщения индексируются от момента deploy'а. Future slice. | TBD |
| **v0.76.0** | 17.05 | **Bundle: #20 phase 2 DAG viz + #25 phase 1 Admin Panel + #28 phase 2 Home AI-alerts.** Pavel-ask «продолжаем». **#20 phase 2 DAG viz**: новый компонент `DepDagViz` в `ActionItemDrawer` `DependencySection`. Collapsible `<details>` с заголовком «Граф зависимостей · N ← me → M», открывается по клику. SVG layered layout (3 уровня: blockers / current task / blocks-я-блокирую), max 6 nodes per row + «+N ещё» dashed-chip для overflow. Каждый node 96×26px с tone из status (DONE=exec-soft, IN_PROGRESS=accent-soft, REVIEW=ai-soft, OPEN=surface-2). Edges с arrow-marker через `<defs><marker>`. Текущая задача — accent-filled центральный node. **#25 phase 1 Admin Panel**: новый `AdminPanel` (650+ LOC) — полноэкранный view как Home/Help, OWNER+ADMIN only. 5 tabs: **Обзор** (4 stat-cards: участников / комнат / открытых задач / владелец + clickable «Настройки» card), **Участники** (list с inline role-edit dropdown для non-OWNER members, OWNER-only edit; chip для OWNER role), **Комнаты** (list с type-glyph + name + meta «канбан / временная / internal» + кнопка «Настройки» → existing channel-settings modal), **Аудит** (новый endpoint `GET /api/servers/:id/audit-log` — filter по server-scoped types: SERVER_*, CHANNEL_*, MEMBER_*, BOT_*, MESSAGE_DELETED_BY_MOD; top-100 в обратной хронологии; OWNER+ADMIN only check на backend; lazy fetch при tab open), **Аналитика** (wire к teamHealth.data prop — 5 stat-cards: Открыто / Просрочено / Без ответственного / Среднее закрытие / Время первого ответа). Topbar shield-icon кнопка «Админ-панель» только для OWNER/ADMIN в server-view. AppShell mutex: openAdmin() закрывает home/help/board/teamhealth/table, и наоборот. Chat-title для adminOpen branch. `AssignableMemberRole` type exported — сужает MemberRole до non-OWNER. **#28 phase 2 Home AI-alerts**: heuristic-derived alerts (без AI provider call'а на каждый Home open). Backend `/api/home/today` extended: `aiSignals.staleTasks` (top-3, assignee=me, status≠DONE, updatedAt < now-14d), `aiSignals.escalated` (top-3, escalatedAt в last 24h). Frontend HomeToday: новая 7-я stat-card «AI-алерты» (warn-toned, показывается только если count>0) + новая секция «AI-алерты · требует внимания» с rows escalated (⚠ glyph, «просрочена» trailing) + stale (◌ glyph, relative «N дней назад» trailing). isEmpty проверка расширена — aiSignals считаются. **No schema changes**, только 1 новый endpoint. Typecheck зелёный (backend + web). | TBD |
| **v0.75.0** | 17.05 | **Operational Tables phase 2.5b — RELATION + FILE field types** (closes #10 phase 2.5b). Pavel-ask «продолжаем». **RELATION**: новый `TableFieldType` value + `TableField.linkedTableId` nullable + FK с SetNull cascade на Table (cleanly orphan field когда target таблица удалена). Cell.value = JSON array of rowIds (max 5 per cell — UX clarity). Backend `coerceCellValue` валидирует: parses JSON, проверяет что все rowIds существуют в `linkedTableId` того же сервера, отвергает >5, отвергает поле без linkedTableId. Новый endpoint `GET /api/tables/:id/related-rows?fieldId=X` — возвращает rows из target table с display value (значение первой по position колонки), top-200 + display-field name. AddFieldForm в OperationalTablePanel: dropdown с available tables когда type=RELATION (передаётся `availableTables` prop из AppShell через `opTables.filter(t => t.id !== selectedTableId)`). RelationCell editor — кнопка-trigger «+ связать» / «N связей», popup-picker с multi-select checkboxes на 5 связей, lazy fetch при open. Если linkedTableId=NULL после SetNull — UI рендерит «— связь сломана —» placeholder. **FILE**: новый field-type + `processStandaloneFile()` в `attachments.ts` (новая функция, паттерн как processAttachment но без Attachment row — сохраняет в `/uploads/tables/`, returns `{url, filename, mimeType, size}`). Те же magic-bytes + size guards (50/200 MB). Backend endpoint `POST /api/tables/:id/upload` — base64 inline array of files (max 5 per request), membership-only check, returns metadata array. Cell.value = JSON array объектов `{url, filename, mimeType, size}` (max 5 per cell, URL обязан начинаться с `/uploads/tables/` — prevents arbitrary URL injection). FileCell editor — chip-list файлов с download-ссылками + remove «×» + кнопка «+ файл» открывает `<input type="file" multiple>` hidden, busy-state при upload. nginx alias `/eclipse-chat/uploads/` уже recursive — сервит и `tables/` поддиректорию автоматически, без deploy-config changes. Hook `useOperationalTable` extended: `addField(name, type, options, linkedTableId)` + `loadRelatedRows(fieldId)` + `uploadFiles(File[])` (base64 conversion на frontend через ArrayBuffer + btoa). **Schema**: миграция `20260518060000_tables_relation_file` — 2 ALTER TYPE ADD VALUE + ADD COLUMN linkedTableId + CREATE INDEX + FOREIGN KEY с ON DELETE SET NULL. Zero-downtime, additive, existing rows безопасно (linkedTableId=NULL для non-RELATION fields). Typecheck зелёный (backend + web). | TBD |
| **v0.74.0** | 17.05 | **Bundle: #18 SUPPORT/ARCHITECT bots + #16 EXECUTION channel + #29 Temp rooms + Focus mode + #32 phase 3 music expand.** Pavel-ask «делай всё по максимуму». **#18 phase 1**: `BotRole` enum extended SUPPORT/ARCHITECT (helpdesk + architecture-summaries). Per-role system-prompts в `ai/botRoles.ts` (RU, 2-4 предложения, спокойный тон без морализаторства). Mention triggers: `@support`/`@поддержка`/`@хелп` и `@architect`/`@архитектор`/`@арх`. UI labels/descriptions/colors (light-violet для SUPPORT, teal для ARCHITECT) синхронизированы в `web/lib/botRoles.ts`. zod schema `BOT_ROLES` авто-обновился. **#16 phase 1 EXECUTION channel**: `ChannelType` enum + новый kanban-glyph icon в ChannelList + 4-я pill «Канбан» в channel-create form + grouping с TEXT каналами (operational rooms). AppShell render branch: когда selectedChannel.type=EXECUTION — рендерится `<StatusBoard>` scoped по `actions.channelId === selectedChannel.id` вместо chat-area. Channel-scoped kanban даёт «room as execution-surface», существующие TEXT-каналы не задеты. **#29 phase 1 Temporary rooms**: `Channel.expiresAt` nullable timestamp + `tempChannels.ts` cron каждые 60s — hard-delete (cascade messages/actions) истёкших каналов + emit `channel:deleted` в server-room. Validate в backend route: 5min..30d delta из now. PATCH endpoint поддерживает установку/снятие. `ExpiryBadge` компонент в chat-header — countdown «через 5 ч / через 12 мин», tick 30s, warn-тон когда <1h. Index `Channel(expiresAt)` для быстрого scan'а. **#29 Focus mode**: новый `useFocusMode` hook с localStorage persistence. Topbar toggle (concentric-circles icon, accent при on). AppShell фильтрует `messages` array если включён: pass только direct-mentions (@displayName), pinned, own messages, bot-replies. Banner «Фокус — только меншены, закреплённые и свои» с кнопкой выключения. **#32 phase 3 Music expand modal**: новый `MusicExpandModal` (Modal-based, 620px). Big SVG waveform из `Attachment.waveformPeaks` (v0.66 сохранил), played-bars в accent, playhead cursor, fallback sin-wave baseline для legacy attachments. Бэкенд: `serializeSession` теперь возвращает `currentTrack.waveformPeaks` через `sessionInclude`. Frontend: MusicMiniPlayer track-name стал button с onExpand prop → открывает modal с большими controls (44/64/44 px, accent-glow на play button). Read-only seek в v1 (synced session). Time clock + queue badge + host info. **Schema**: одна миграция `20260518040000_v074_bundle` (3 ALTER TYPE ADD VALUE — EXECUTION в ChannelType, SUPPORT/ARCHITECT в BotRole, + ADD COLUMN expiresAt nullable + CREATE INDEX). Zero-downtime, additive. Typecheck зелёный (backend + web). | TBD |
| **v0.73.0** | 17.05 | **Bundle: #14 In-app Help + #20 phase 2/3/4 (deps + escalation + AI summary) + mobile simplify pass.** Pavel-ask «делай всё по максимуму из списка» + last-screen «всё криво и не адаптировано». **#14 In-app Help**: новый `HelpPanel` компонент (full-screen view как Home/StatusBoard), 3 tab'а — «Полный функционал» (17 cards: workspaces/rooms/threads/DMs/voice/StatusBoard/IntelligencePanel/Tables/Music/search/approvals/Home/Incident/Client Mode/transcription/link embeds) + «Настройка ботов» (5 ролей + endpoints + HMAC webhooks) + «Горячие клавиши» (Ctrl+K / Enter / Shift+Enter / Esc / @ / : / /). Кнопка «?» в topbar рядом с поиском. AppShell: `helpOpen` state, openHelp() handler, resets всех других view-flag'ов; render branch перед selectedTable/home/board. **#20 phase 2 dependencies**: новая модель `ActionItemDependency` (composite PK + CHECK constraint no-self-loop + cascade), enum extensions DEPENDENCY_ADDED/REMOVED. Backend: POST/DELETE `/api/actions/:id/dependencies(/:depId)` с BFS-проверкой цикла (берём все edges сервера, ищем достижимость blockerId → actionId), same-server validation, P2002/P2025 mapping. `actionItemInclude` extended с lightweight `dependencies` + `blocks` select (id+title+status+type — не тяжёлый для bulk fetch'а 200 items). `serializeActionItem` отдаёт `dependencies/blocks/blockedByOpen`. Frontend: `useActionItem.addDependency/removeDependency`, `ActionItemDrawer` секция «Зависимости» с picker'ом (autocomplete по title из serverActions), per-status tone chip, отдельный `<details>` блок «Блокирует N» для outgoing edges. StatusBoard карточка: badge «🚧 blocked × N» в warn-тоне если blockedByOpen>0 и status≠DONE. **#20 phase 3 escalation**: новый `escalation.ts` — cron каждый час сканит overdue 48h+ задачи где `status ∈ {OPEN, IN_PROGRESS, REVIEW}` И `(escalatedAt IS NULL OR escalatedAt < now-7d)`. PROCESS_LIMIT=50 за проход. Set escalatedAt, activity-log ESCALATED, emit `action:item:escalated` в channel+server rooms. `useNotifications` слушает event → если `assigneeUserId/createdByUserId === currentUserId` показывает desktop notification «Эскалация — Просрочено N ч: <title>». Cron стартует через 30s после server boot. **#20 phase 4 AI summary**: `aiSummary` + `aiSummaryUpdatedAt` cached в БД. POST `/api/actions/:id/ai-summary` собирает description + last 30 comments (chronological) → AI chat() с system-prompt «2-3 предложения, без markdown, без emoji» через existing provider chain (Ollama→OpenRouter→NVIDIA→OpenAI). 503 если AI не сконфигурирован, 400 если nothing to summarize, 502 если все провайдеры упали. Activity AI_SUMMARY_GENERATED. Drawer: new секция «AI-сводка» с accent-bordered card + relative timestamp + кнопка «Сгенерировать» / «Перегенерировать». **Mobile simplify pass**: (a) AppShell drawer mutex — `setNavOpen`/`setMembersOpen` wrap'ы автоматически закрывают противоположный drawer (Pavel-screenshot показывал оба drawer'а одновременно + чат зажат, composer wrap'ит по символу). (b) responsive.css: на ≤640px channels drawer fullscreen `calc(100vw - 64px)` + members drawer `min(100vw, 420px)` (раньше 300px max), backdrop hsl(220 22% 2%/0.78) + blur 10px (раньше 0.45). (c) Breadcrumb nowrap + ellipsis + max-width `calc(100vw - 200px)`, brand-title hidden когда breadcrumb виден. (d) `.ec-chat-header > *` min-width:0, `.ec-chat-title` ellipsis. (e) `.ec-composer-wrap/.ec-composer-textarea/.ec-composer-box` min-width:0 + width:100% — composer textarea больше не сжимается до column-of-1-char placeholder. (f) `[data-channel-action]` display:none на ≤640px (gear/trash на hover-only не работали на touch, торчали столбиком слева на screenshot'е — UI для channel settings остаётся через chat-header gear). (g) `.ec-home-today__stats/.ec-team-health-stats/.ec-stat-grid` forced 2-col `repeat(2, minmax(0, 1fr))` между 320..640px, 1-col только на ≤320 (rare). Stat-card padding compressed на mobile + min-width:0 на children для ellipsis. **Schema**: 2 миграции additive: `20260518000000_action_item_dependencies` + `20260518020000_action_item_escalation_ai_summary` (zero-downtime, ALTER TYPE ADD VALUE для enum extensions, ADD COLUMN nullable для escalatedAt/aiSummary/aiSummaryUpdatedAt + новый index `ActionItem(status, dueAt)` для cron'а). 5 новых socket event'ов: ActionItemDependencyChanged, ActionItemEscalated. Frontend types в `lib/socket.ts` extended. Typecheck зелёный (backend + web). | TBD |
| **v0.72.0** | 17.05 | **Music в VOICE-каналах phase A** (closes engineering #34 phase A). Pavel-ask 17.05 «надо добавить возможность прослушивать музыку совместно со всеми кто в комнате». **Backend**: `routes/music.ts` POST start — removed VOICE rejection (был return 400). VOICE-каналы теперь принимают music sessions, тот же sync механизм (startedAt + positionMs, derived position на frontend) что и для TEXT — late-join correction уже в v0.61 встроена. New endpoint `GET /api/servers/:id/audio-tracks` — list audio attachments из всех TEXT/BROADCAST каналов сервера (top-50 by recency), используется picker'ом. **Frontend** `VoiceMusicPicker.tsx` (новый компонент) — Modal с listing audio tracks (filename + channel context + size + date), click → start session. `AppShell` extended: `showVoiceMusicPicker` state + render картинку picker'а; в chat-header убрано исключение `selectedChannel.type !== "VOICE"` для MusicMiniPlayer (теперь рендерится в любом канале); для VOICE channel без active session — accent-coloured кнопка «▶ Музыка» в header справа от title → open picker. **UX flow**: user входит в VOICE channel → видит кнопку «Музыка» → click → picker → выбирает track → music.start(attachmentId) → backend создаёт session → все в room через socket получают `music:session:updated` → MusicMiniPlayer везде показывает текущую позицию sync'нуто. **Phase B (future)**: LiveKit data channels для server-side mixed audio publish (точная sync без client clock drift). | TBD |
| **v0.71.0** | 17.05 | **Execution kanban phase 1** (частично closes engineering #20). Promotion 2-status execution flow → 4-status kanban. **Schema migration** `20260517220000_action_item_status_phase2` — ALTER TYPE ActionItemStatus ADD VALUE 'IN_PROGRESS' / 'REVIEW' (2 statements в раздельных transactions, PG enum extension pattern). Existing OPEN/DONE rows не затронуты. **Backend** `routes/actions.ts` actionStatusSchema z.enum extended на 4 значения, validation работает для PATCH и query params. `realtime.ts` AttachmentPayload-style action payloads с status union расширены. `ai/prompts.ts` ActionForPrompt тоже. **Frontend types** `lib/socket.ts` ActionItemStatus = "OPEN" \| "IN_PROGRESS" \| "REVIEW" \| "DONE". Все cross-file references (useActionItem, useServerActions, useSearch, IntelligencePanel, ActionItemDrawer) либо переименованы на shared type, либо inline import. **StatusBoard переписан**: вместо 2-col filter view (Открытые/Сделано) — 4-col kanban через `byStatus` useMemo bucket. Каждая column (OPEN/IN_PROGRESS/REVIEW/DONE) — drop target: `onDragEnter` → highlight (accent border + soft background mix), `onDrop` → `onUpdateStatus(id, columnStatus)`. Cards `draggable={true}` с opacity:0.45 при dragging, cursor:grab. Existing quick toggle (checkbox + click → mark DONE) сохранён — это shortcut, drag для promotion в intermediate states. **ActionItemDrawer** binary statusToggle → native `<select>` с 4 options + dynamic border color по статусу (OPEN=default, IN_PROGRESS=accent, REVIEW=ai, DONE=exec-filled). **Out of scope phase 1** (deferred): dependencies graph (#20 phase 2), escalation cron (phase 3), AI summary per task (phase 4). Typecheck зелёный (backend + web). 1 миграция additive, zero downtime. | TBD |
| **v0.70.0** | 17.05 | **Operational Tables phase 2.5a** (частично closes engineering #10 phase 2.5). Drag-reorder + templates. **Backend `lib/tableTemplates.ts`** — TABLE_TEMPLATES array с описанием: `blank` (legacy default), `tasks` (Название/Статус/Ответственный/Срок/Приоритет — STATUS+USER+DATE), `leads` (Имя/Этап/Email/Телефон/Заметки — STATUS+TEXT). **Backend routes/tables.ts** добавлены endpoints: (1) `POST /api/tables/:id/fields/reorder` — body `{orderedIds: []}` atomic `$transaction` с bulk position update + emit N `table:field:updated`. (2) `POST /api/tables/:id/rows/reorder` — same pattern для rows. (3) `GET /api/tables/templates` — list для frontend picker. (4) `POST /api/servers/:id/tables/from-template` — create + seed fields в одной транзакции. **Frontend useOperationalTable** добавлены actions `reorderFields(ids)` / `reorderRows(ids)` с optimistic apply + rollback через `reload()` на failure. Helper `loadTableTemplates()` с module-level cache. **Frontend OperationalTablePanel**: `sortedFields` / `sortedRows` через `useMemo` всегда sorted by position (защита от realtime emits в произвольном порядке). HTML5 drag-and-drop на `<th>` (drag handle ⋮⋮ visual hint, dataTransfer effectAllowed=move, opacity:0.4 при dragging, accent box-shadow inset 3px на dropTarget). Row drag handle — новая первая колонка с ⋮⋮ glyph (cursor:grab). DragEnd computes новый порядок и вызывает reorderFields/Rows. **Frontend CreateTableModal** (новый компонент) заменяет legacy `window.prompt`: input для имени + 3 template cards (label + description + field-count + names preview), active card highlighted accent. AppShell — `showCreateTable` state, `CreateTableModal` render с callback'ом который вызывает `createOpTable` (blank) или `createOpTableFromTemplate` (others). **Out of scope phase 2.5a** (отложено в phase 2.5b): RELATION (cross-table) field type, FILE (attachment) field, больше templates (bugs / construction / approvals / knowledge). Typecheck зелёный, 0 миграций. | TBD |
| **v0.69.0** | 17.05 | **Home expansion** (closes engineering #28). HomeToday «СЕГОДНЯ» получил 2 новые секции + 2 новые stat cards. **Backend `routes/home.ts`** extended: (1) `pendingApprovals` — `ActionItem where: { approverUserId: me, approvalStatus: PENDING }` across все servers (FK approverUserId уже SetNull — orphans защищены), serialize: id/title/type/server/channel/requestedAt/requestedBy. (2) `activeRooms` — top-5 TEXT каналов с messages в last 1h across мои workspaces. Reuse messages query из existing analytics pattern, group by channelId через JS Map (для MVP scope 1000+ messages = milliseconds), uniqueAuthors через Set. Hydrate channel + server names через `findMany({ id: { in: topIds } })`. Counts schema expanded `{tasks, overdue, incidents, activeVoice, approvals, activeRooms}`. **Frontend useHomeToday types** добавлены `HomePendingApproval` + `HomeActiveRoom`. **HomeToday UI**: 6 stat cards (раньше 4) — `На моём одобрении` (accent-coloured highlight если >0) + `Активных комнат` (idle tone). 2 новых section'а: «На моём одобрении» (accent glyph, relativeShort timestamp как trailing chip), «Активные комнаты» (# glyph, message count + author count в context). Empty-state расширен — теперь требует все 5 категорий пустыми. Section ordering: tasks → incidents → approvals → active rooms → voice (от business-critical to ambient). | TBD |
| **v0.68.0** | 17.05 | **Scroll containment hotfix.** Pavel-report 17.05: «у некоторых экран не показывает полностью все каналы, надо сделать ползунок для всего функционала». Root cause: (1) `ChannelList` root `wrap` имел только `display:flex; flexDirection:column`, **без** `height:100%` + `min-height:0` + `overflow:hidden` — `listWrap` flex:1 не получал bounded height, scroll не активировался; (2) CSS grid `.ec-shell__rail` / `.ec-shell__channels` / `.ec-shell__members` имели только `min-width:0`, **без** `min-height:0` — grid-row auto-expand'ил'ся под content, header app уходил за viewport, никакого scroll'а вообще. Fix: добавил `min-height:0 + overflow:hidden` ко всем трём grid-area + `height:100% + min-height:0 + overflow:hidden` к ChannelList root. IntelligencePanel / MemberList уже имели правильный pattern, StatusBoard/TeamHealth/HomeToday — тоже. Typecheck зелёный, ChannelList теперь правильно scroll'ит internally при любом count каналов и любом height viewport. | TBD |
| **v0.67.0** | 17.05 | **Link embeds — OG preview cards** (closes engineering #15). Закрывает единственный gap в §1 NEXT-GEN CORE chat. **Schema:** новая модель `LinkEmbed` (cuid + url@unique + status enum OK/FAILED + title/description/image/siteName + expiresAt + fetchedAt + error). Migration `20260517200000_add_link_embed_cache` создаёт enum + table + индексы. **Backend `lib/linkPreview.ts`** (~330 строк, zero deps) с фокусом на SSRF protection: (1) scheme whitelist (http/https only); (2) `dns.lookup` для каждого hostname (включая redirect targets) → block private/loopback/link-local/multicast/reserved IPv4 + IPv6 ULA/link-local + IPv4-mapped IPv6 + .local/.internal/localhost domains; (3) `AbortController` 8s timeout; (4) streaming body read с hard cap 5MB (`reader.cancel()` при overflow); (5) content-type whitelist `text/html`; (6) manual redirect chain max 5 — каждый next URL re-validated через ту же SSRF guard. **Caveat**: DNS rebinding (attacker возвращает public IP при resolve, private при fetch) частично mitigated — для полной защиты нужен custom http agent с pinned IP; v1 base case закрыт. **OG parser** regex-based (truncate head до 256KB), priority `og:title > <title>`, `og:description > <meta name=description>`, `og:image` (resolve relative URL via WHATWG `URL`), `og:site_name > hostname fallback`. Decode HTML entities. Field clamps: title 300, description 600, image URL 2048, siteName 100. **Cache**: upsert per normalized URL (lowered host, stripped fragment, default ports stripped), OK TTL 7d, FAILED TTL 24h (чтобы bad URL не долбили repeatedly). **Backend route** `GET /api/embeds/preview?url=` (auth-required, rate-limit 30/min/JWT), uniform response shape для OK + FAILED. **Frontend lib/linkExtract.ts**: extract first http(s) URL from message content, skip localhost/own-asset paths. **Frontend `useLinkPreview` hook**: session-level memory cache (Map url → data | Promise), один URL в N messages не вызывает N запросов. **Frontend `LinkEmbedCard`** (calm operational design): max-w 540px, accent border-left, optional 96×96 thumbnail (object-cover + `onError` hide fallback), title 2-line clamp + bold strong, description 2-line clamp muted, host uppercase tracking-wide footer. Skeleton минимальный (placeholder card с host fragment, без shimmer). **MessageList integration**: рендерится под message body **только если** нет attachments (visually noisy с обоими). FAILED preview → ничего не показывает (RichContent уже сделал auto-link сверху). Typecheck зелёный (backend + web), 1 migration additive, zero downtime. | TBD |
| **v0.66.0** | 17.05 | **Audio waveform — Phase 1** (closes engineering #32 phase 1, Pavel-ask «нужна визуализация проигрывателя, чтобы было видно дорожку»). Telegram-style waveform для всех audio attachments (включая voice messages из MediaRecorder). **Архитектура — zero backend deps**: peaks считаются на клиенте через `Web Audio API` (`AudioContext.decodeAudioData` → mixdown→mono → 64 bucket peak extraction → normalize 0..100), backend хранит как `Json` без CLI deps (`audiowaveform` / `ffmpeg` НЕ нужны). **Schema**: `Attachment.waveformPeaks Json?` + migration `20260517180000_add_attachment_waveform` (additive, existing rows = NULL fallback). **Backend** (`attachments.ts` + 3 routes): `AttachmentInput.waveformPeaks?: number[]`, validation `validateWaveformPeaks()` (length 32..256, range 0..100, audio mime only), processed → `db.attachment.create({ data: { waveformPeaks } })` + return в `ProcessedAttachment`. zod schemas в `channels.ts` / `dm.ts` / `threads.ts` accept optional `waveformPeaks`. Selects в read-paths расширены. Socket emit payload (`realtime.ts AttachmentPayload`) теперь содержит peaks — UI рисует waveform с первого `message:new` без reload. **Frontend lib/audioPeaks.ts** (новый, 100 строк): `computeWaveformPeaks(blob, N=64)` — failure-safe, null при decode-err / non-audio. Lazy AudioContext singleton (Safari user-gesture compat). **Frontend MessageInput**: для audio mime parallel `Promise.all([fileToBase64, computeWaveformPeaks])` — никаких extra round-trips. Voice recorder (`MediaRecorder` → File → addFiles) попадает в общий путь автоматически. **Frontend Attachments.AudioItem** полностью переписан: native `<audio controls>` → custom player (play/pause button accent-coloured + waveform SVG + currentTime/duration + scrub). Новый `Waveform` компонент: 64 rect bars, played bars accent-coloured opacity 0.95, unplayed text-dim opacity 0.45, click/pointer-drag/touch scrub через `setPointerCapture`, keyboard nav (Arrow ±5%), `role="slider"` + `aria-valuenow`. Fallback: если peaks null — 48 sin-wave baseline bars (видимый, не «пустота») + footer hint «базовая дорожка». **Не задет** music player phase 3 (separate item). **Verified**: typecheck зелёный (backend + web), `await audio.play()` через user-gesture handled, peaks для 60s voice ≈ 100ms на main thread (acceptable, для длинных файлов phase 1.5 = Worker). 1 миграция additive, zero downtime. | TBD |
| **v0.65.0** | 17.05 | **Mobile hardening v2** — closes engineering #31 (Pavel-ask «всё урезано и криво на мобильных»). 14 конкретных fixes из focused audit 17.05 (file:line привязка). **Critical:** (a) `[data-dm-btn]` MemberList opacity:0.85 на ≤640px — DM-button был полностью скрыт на touch; (b) message actions bar — уже работало (responsive.css:352-360 v0.49); (c) `Modal.tsx` body scroll-lock через `document.body.style.overflow="hidden"` на mount, `maxHeight: min(calc(100dvh - 64px), 92vh)` вместо 100vh (iOS Safari URL bar fix), backdrop padding-bottom `env(safe-area-inset-bottom)` на ≤640px, close-btn получил className `ec-modal-close` → 44×44px на mobile; (d) `ActionItemDrawer.tsx` body scroll-lock + className `ec-action-drawer` → `width: 100vw` + no border на ≤640px, close-btn `ec-drawer-close` → 44×44px; (e) composer slash-hints уже discoverable через `/task` placeholder behavior. **High:** (f) `[data-channel-action]` opacity:0.6 на ≤640px (ChannelList settings/delete были hover-only); (g) `.ec-shell__members .ec-intel-tab__label { display: inline }` на ≤640px — labels возвращены на mobile drawer 88vw (icons-only остаётся только на desktop 248px rail); (h) `.ec-op-table-scroll::after` gradient-fade hint справа на overflow:auto тaблице; (i) `.ec-music-mini-player` max-width:180px + ellipsis на ≤640px; (j) `.ec-voice-room__controls` flex-wrap:nowrap + horizontal scroll на ≤360px; (k) `.ec-status-board` explicit `grid-template-columns: 1fr` на ≤500px (раньше hybrid layout в 480-560 range); (l) HomeToday cards уже handled (`.ec-home-today__stats` 2-col на ≤760px, 1-col на ≤520px). **Medium:** (m) `.ec-search-overlay` padding 4vh на ≤500px; (n) video lightbox использует native `<video controls>` — fullscreen-button уже работает через native controls; (o) `.ec-team-health-stats` explicit `repeat(2, minmax(0, 1fr))` на ≤480px. Все изменения — additive CSS @media + className hooks + JS scroll-lock + maxHeight fix. Никаких компонентных перестроек. Frontend typecheck зелёный. 0 миграций, 0 ENV vars. | TBD |
| **v0.64.0** | 17.05 | **Account limit — макс 2 OWNER-сервера на user.** Pavel-ask. Backend: новая ENV `MAX_SERVERS_PER_USER` (default 2, override через env на проде). `POST /api/servers` теперь делает `db.member.count({ userId, role: 'OWNER' })` перед открытием transaction; если >= лимита — 403 `{error, code: 'OWNED_SERVERS_LIMIT', limit, current}`. `GET /api/servers` возвращает дополнительное поле `limits: { maxOwnedServers }` — UI не хардкодит константу. Frontend: `useServers` exposes `limits`, `ownedCount` (derived через `servers.filter(s => s.role === 'OWNER').length`), `canCreateServer`; `ServerList` принимает три новых prop'а и показывает «+» button с `disabled` state + `opacity: 0.45` + `cursor: not-allowed` + tooltip «Достигнут лимит N пространств (создано X). Удалите одно или попросите расширить лимит.» когда limit reached; AppShell `onCreateRequest` silently no-op'ит если `!canCreateServer` (не открывает модалку зря). DEPLOY-TO-STAR-CRM.md секция ENV получила commented-out пример override. Backward-compat: `limits` field optional в response — старые клиенты игнорируют. Typecheck зелёный, 0 миграций. | TBD |
| **v0.63.0** | 17.05 | **Security & integrity pass** — closes 8 пунктов из аудита 17.05. (1) **channel:join socket bypass**: socket-room присоединение теперь валидирует membership через Channel→Server→Member lookup (зеркало `thread:join`/`dm:join`); раньше любой залогиненный юзер мог join `channel:${id}` и получать `message:new`/`typing:start`/`reaction:added` чужих серверов — cross-workspace data leak. (2) **CI runs tests**: `npm run test -w @eclipse-chat/server` добавлен в `ci.yml` после typecheck — все 10 unit-тестов до сих пор не выполнялись в CI, регрессии в bot-roles / ai-mention / dm-membership проходили незамеченными. (3) **Cascade policy B** для preservation истории: `Message.userId` и `ActionItemComment.userId` стали nullable + Cascade→SetNull. После удаления юзера messages и comments остаются с автором=null; centralized `serializeUser()` helper в `lib/userView.ts` возвращает «Удалённый пользователь» placeholder — frontend ничего не трогает, shape стабильна. Стандартный chat-app паттерн (Slack/Discord/Telegram). Bot deletions / GDPR-style erasure больше не уничтожают историю. Refactored 11 файлов serializer'ов (actionItems, channels, messages, threads, dm, visits, servers, digest, incidents, ai/assistant). (4) **ActionItem approval CHECK constraint**: raw SQL CHECK на лицикл `requiresApproval ⇔ approvalStatus`. Закрывает silent-corruption surface — состояние (false, PENDING) физически невозможно. (5) **Transcript boot recovery**: при старте сервера `recoverStuckTranscripts()` revert'ит застрявшие PENDING attachments старше 10 мин в NONE с reason «прервано рестартом». UI больше не крутит спиннер вечно после crash'а сервера. (6) **Backup infrastructure**: `deploy/scripts/backup-db.sh` (pg_dump → gzip → /var/backups/eclipse-chat/, 14-day rotation) + `deploy/cron.d/eclipse-chat-backup` (04:17 daily). Install: `cp deploy/cron.d/eclipse-chat-backup /etc/cron.d/`. (7) **requireJwt hardening**: `void reply.send` → `return reply.send` — defensive, Fastify по факту прерывал chain и так, но без return было на грани UB. 3 миграции: `20260517120000_message_user_setnull`, `20260517140000_action_item_comment_user_setnull`, `20260517160000_action_item_approval_check`. Schema additive (nullable + SetNull) — existing rows backward-compat, zero downtime. Typecheck зелёный, frontend без изменений (placeholder = stable API shape). |
| **v0.62.0** | 17.05 | **Operational Tables phase 2** — продолжение #10. Closing key gaps в phase 1: (1) **Realtime collaboration** — новый `emitTableEvent(serverId, kind, payload)` helper, 8 event types (`table:updated`/`table:deleted`/`table:field:added`/`updated`/`deleted`/`table:row:added`/`updated`/`deleted`), wired в каждый mutation route. Frontend `useOperationalTables` invalidates list через reload на любой event; `useOperationalTable` apply'ит patches к local state (по `tableId` filter + field/row-level updates). Два user'а в одной таблице видят чужие правки сразу без manual reload. (2) **RBAC**: DELETE table + DELETE field теперь MOD+ only (OWNER/ADMIN/MODERATOR). Edit и create cell/row остаются open для всех members — calm operational UX без trigger-happy роли. (3) **Two new field types**: `USER` (cell.value = userId, frontend select из members с native `<select>`, validation на backend — `coerceCellValue` проверяет membership) и `CHECKBOX` (cell.value = `"true"`/`"false"`, frontend `<input type=checkbox>`, backend coerces любой truthy в `"true"`). Migration `20260517100000_table_field_types_phase2` — два `ALTER TYPE ADD VALUE` (Prisma migrate разводит по транзакциям). Schema-only change, existing rows не затронуты. AppShell теперь передаёт `members` + `socket` в `OperationalTablePanel`. Trade-offs: list-level reload вместо per-row patch (counts надо пересчитывать; для 100+ tables это станет проблемой — phase 2.5 будет patches). RBAC только на DELETE — Edit/create open для всех, эскалация при необходимости. Phase 2.5: RELATION (cross-table cells), FILE (attachment), drag-reorder, table templates. |
| **v0.61.0** | 17.05 | **Shared listening room MVP** — closes engineering #13. Synchronous audio playback на канале: один member жмёт «▶ Слушать вместе» на любом audio-attachment'е в чате, остальные members в той же комнате видят mini-player в chat header и слышат тот же track с одной timeline-позиции. Schema: новая модель `MusicSession` (channelId @unique, currentTrackAttachmentId, startedAt, positionMs, isPlaying, queue Json-string array, hostUserId) — одна сессия per channel. Migration `20260517080000_add_music_session` — additive. Backend: новый `routes/music.ts` с 7 endpoints — get state, start, pause/resume, skip, stop, queue add. Permissions: queue-add разрешено любому member; pause/resume/skip/stop — host или MOD+. Voice channels отвергаются (LiveKit pipeline coupling — phase 2). Source треков — audio/* attachments из того же server'а (не из DM — privacy). Sync: server держит `startedAt` (timestamp последнего play/resume) + `positionMs` (saved offset на pause). Frontend рассчитывает текущую позицию как `isPlaying ? (now - startedAt + positionMs) : positionMs`; mini-player tick'ает каждые 500ms для smooth progress bar. Audio element seek'ит к `position - 150ms` (compensation для perceived latency). Realtime event `music:session:updated` с full payload — клиент получает свежее состояние на каждое action любого member'а. Frontend: `useChannelMusic(channelId, socket)` hook (state + derivedPositionMs + start/togglePlayPause/skip/stop/addToQueue actions). `MusicMiniPlayer` — floating pill в chat header (play/pause + track name + progress bar + position counter + host avatar + queue count badge + skip + stop). `Attachments.AudioItem` получил optional `onPlayShared` callback — accent-coloured «▶» button рядом с download (hidden если callback undefined, e.g. в DM). Trade-offs: без late-join drift-correction (новый member может быть на ~500ms-1.5s offset); без periodic position-sync (v2 если drift станет заметным); без LiveKit interop для VOICE channels; без YouTube/Spotify integration (copyright + privacy). |
| **v0.60.0** | 17.05 | **Team Health v3** — closes engineering #12. Расширил existing analytics endpoint тремя новыми блоками без снапшотов: (1) **trends** — week-over-week sliding 7-day window для `created`/`closed` counts (current vs prev неделя; вычисляется on-the-fly из ActionItem.createdAt/updatedAt без снапшот-таблицы). (2) **perChannel** — breakdown open/overdue/closed по channelId; channels hydrated с name+type; rows отсортированы по open desc, top-8 рендерятся, overflow → "ещё N". (3) **responseTime** — median latency от root message до первого thread reply за 30-day окно; sample size; null если < 5 обсуждений (`RESPONSE_MIN_SAMPLE`). Exported pure helper `median(values)` для unit-test'ов. Frontend: `TeamHealthData` type extended с `trends`, `perChannel`, `responseTime`. Новый stat-card «Время первого ответа» рядом с «Среднее закрытие» (`formatDuration(ms)` — секунды/минуты/часы/дни). Новая секция `TrendsRibbon` с двумя cells (Создано/Закрыто) — arrow + delta + percentage; «Закрыто» growth — exec colour, «Закрыто» decline — warn; ribbon hidden если активности нет вообще. Новая секция `PerChannelSection` — table-like grid Комната/Открыто/Просроч./Закрыто с monospace numbers и conditional coloring (overdue в warn если >0, closed в exec). Все cuts из v0.30.0 scope cuts now закрыты. |
| **v0.59.0** | 17.05 | **Operational Tables phase 1** — closes engineering #10 spike. Первый срез HUGE-feature §4 NEXT-GEN — встроенные таблицы внутри пространства как operational surfaces, не отдельная Notion-like page. Schema: новые модели `Table` (id, serverId, channelId?, name, description?, createdBy), `TableField` (name, type, options, position), `TableRow` (position), `TableCell` (composite PK rowId+fieldId, value as string) + enum `TableFieldType` (TEXT/NUMBER/STATUS/DATE — четыре базовых типа в v1, без USER/RELATION/FILE/FORMULA — phase 2+). Migration `20260517060000_add_operational_tables` — additive, новые таблицы пустые. Backend: `routes/tables.ts` с 10 endpoints — list (`GET /api/servers/:id/tables`), create / detail / patch / delete table, add / patch / remove field, add / patch / remove row. Создание таблицы автоматически добавляет дефолтное поле «Название». Row update — bulk через `cells: [{fieldId, value}]`, atomic `$transaction` с upsert на каждую cell + bump table.updatedAt. Empty cell value → delete row (защита от засорения индексов). Membership-only check, без RBAC в phase 1. Frontend: два hooks (`useOperationalTables` list + `useOperationalTable` detail с CRUD ops для rename/addField/updateField/removeField/addRow/updateRow/removeRow). `OperationalTablePanel` — full chat-area replacement, header с inline-edit title + add-column form + add-row button + delete + close, HTML `<table>` с sticky thead + per-type cell editors: TEXT/NUMBER `<input>`, STATUS `<select>` со значениями из options (цветом из status-palette pool), DATE `<input type=date>`. Save on blur (single-cell PATCH вместо bulk). `AddFieldForm` inline под header с STATUS-options textbox через запятую. Field rename via click on header + edit-on-blur. `ChannelList` Context Tree: новая секция «Таблицы» под Overview (рядом с Доской задач / Здоровьем команды), скрыта в Client mode; список с rowCount badge + `+` create button. `AppShell` state `selectedTableId` сбрасывается при смене сервера / channel; render OperationalTablePanel вместо chat когда set. Realtime / relations к ActionItem / AI-fill / drag-reorder fields — out of scope phase 1, foundation под phase 2-3. |
| **v0.58.0** | 17.05 | **Voice transcription prototype** — closes engineering #9. Audio-attachments (включая voice messages из v0.50) транскрибируются background fire-and-forget после upload. Schema additive: `TranscriptStatus` enum (NONE/PENDING/READY/FAILED) + `Attachment.transcript` + `transcriptStatus` (default NONE) + `transcriptError`. Migration `20260517040000_add_attachment_transcript` — zero-downtime. Backend модуль `ai/transcribe.ts`: OpenAI Whisper API через native `fetch` (без `openai` SDK dep — Pavel anti-pattern про npm-deps), 25 MB лимит на файл (Whisper API constraint), 90s timeout с AbortController, поддерживаемые mime: mp3/mp4/wav/x-wav/ogg/webm/aac. `OPENAI_API_KEY` reuse существующего provider chain — если ключа нет, outcome=NONE и UI показывает audio без transcript блока. `processAttachment` extended: для audio mime возвращает `audioBuffer` (raw bytes для транскрипции, ноль allocation overhead для non-audio). `kickoffTranscription(attachmentId, buffer, mime, filename, context)` — fire-and-forget helper, выставляет PENDING, async вызывает Whisper, обновляет row, emit'ит `attachment:transcript:updated` в channel-room или dm-room (в зависимости от context). Wired в три upload-points: `routes/channels.ts`, `routes/dm.ts`, `routes/threads.ts`. Все три route'а возвращают новые поля через select. Frontend: `AttachmentPayload` extended с optional `transcript` / `transcriptStatus` / `transcriptError` + `AttachmentTranscriptUpdatedPayload` socket event type. `useMessages` и `useDirectMessages` подписаны на новый event — находят attachment по id в `messages[].attachments[]` и обновляют поля. `Attachments.tsx` — новый `TranscriptBlock` render под `AudioItem`: PENDING = shimmer-text "Транскрибируем…", READY = expandable блок с accent-bordered подложкой (свернут на 240 символах, кнопка «Развернуть»), FAILED = muted-line с reason, NONE = nothing. Trade-off v1: OpenAI Whisper only (paid API); future v2 — local Whisper.cpp / Ollama whisper / fallback chain. Также: voice transcription для live voice-channel сессий — отдельная задача (требует LiveKit Egress + recording infrastructure), не в этом срезе. |
| **v0.57.0** | 17.05 | **Operational search v1** — closes engineering #8. Unified search через `GET /api/servers/:id/operational-search?q=` возвращает three-way union в одном response: messages (TEXT-only, не deleted), action items (ILIKE на title+description), files (ILIKE на attachment.filename). Каждая категория ограничена 25 hits, parallel `Promise.all` для трёх запросов. Backend reused существующие Prisma includes; legacy `/api/servers/:id/search` endpoint оставлен для backward-compat (не используется новым frontend, но coexists). Frontend: `useSearch` hook полностью переписан под union result; `SearchOverlay` теперь имеет 3 tabs (Сообщения / Дела / Файлы) с counter в tab-badge + auto-switch на первую non-empty категорию когда results меняются; per-tab rendering — MessageList (existing pattern), ActionList (glyph + type + assignee + due + description preview), FileList (image-thumbnail для image/*, иначе generic-icon). Highlight функция переиспользована для всех трёх (matches окрашиваются `accent-soft`). `AppShell` callback split: `onSelectMessage` → jump в комнату, `onSelectAction` → открывает ActionItemDrawer, `onSelectFile` → jump в комнату-источник (lightbox остаётся через клик на attachment). V1 без FTS-index, sequential scan через ILIKE — performance OK до десятков тысяч rows; tsvector + GIN upgrade — будущая миграция без breaking changes для frontend. |
| **v0.56.0** | 17.05 | **Voice multi-publisher harden** — closes engineering #11. Frontend-only изменения; LiveKit room config / quotas остались на defaults (sensible для v1, нет жёстких лимитов). Был риск: при 5+ участниках с одновременно опубликованной camera + screen-share grid auto-fit minmax(280px, 1fr) выдавал бесконечно растущий список tiles, пожирая viewport. Введён **TILE_LIMIT=6**: total visible tiles в main video stage ограничен 6. Priority: screens НИКОГДА не collapse (главный operational signal), остаток квоты получают cameras с приоритетом по local (всегда вижу себя) → speaking (текущий говорящий важнее молчащих) → остальные. Overflow cameras (cameras не вошедшие в budget) падают в presence-strip как chips с camera-glyph icon, отличаясь визуально от audio-only chip'ов. Это сохраняет presence-аффинность (видно, кто включил камеру) без визуального хаоса. Расширенный voice diagnostics panel: per-source breakdown `visual: N (screens: X · cameras: Y)`, `tile budget: M/6` с warn-индикатором свернутых камер, `speaking: count`. Trade-off: hard limit 6 — арbitrary, может потребовать tuning per viewport. Адаптивный TILE_LIMIT по window width — будущее улучшение. E2e harden с 6+ участниками одновременно публикующими — оставлено как formal acceptance test (нет инструментов в session для multi-browser test). |
| **v0.55.0** | 17.05 | **Approvals** — closes engineering #7. Formal request → approve/reject flow поверх ActionItem (extension вместо отдельной Approval-таблицы — minimum viable v1, multi-approver chains = future). Schema additive: новый `ApprovalStatus` enum (NONE / PENDING / APPROVED / REJECTED) + `ActionItem.requiresApproval` Boolean + `approverUserId` (FK к User, SetNull) + `approvalStatus` (default NONE) + `approvalNote` + `approvedAt`; index `(approverUserId, approvalStatus)` для будущего «моя очередь approval». `ActionItemActivityType` enum расширен тремя значениями: `APPROVAL_REQUESTED` / `APPROVAL_APPROVED` / `APPROVAL_REJECTED`. Migration `20260517020000_add_approvals` — zero-downtime, defaults безопасны. Backend: `POST /api/actions/:id/approval` (member request approval с approver pick + optional note → status=PENDING) + `POST /api/actions/:id/approval/decision` (approver-only: APPROVED или REJECTED + optional note; 409 если не PENDING). Atomic transaction с activity-log insert. `actionItemInclude` + `serializeActionItem` extend approver объектом + 4 новыми полями; existing routes автоматически возвращают новые поля. Frontend: `useActionItem` получил `requestApproval` + `decideApproval` actions. `ActionItemDrawer` — новая Approval section с тремя состояниями: NONE (кнопка «Запросить одобрение» → форма с member-picker + note), PENDING (warn-badge + «Решение от X», если currentUser=approver — Approve/Reject buttons + decision-note textarea), APPROVED/REJECTED (read-only с note + approve timestamp + «Запросить заново» для re-cycle). `StatusBoard` карточка получила `ApprovalChip` (warn/exec/danger) когда approvalStatus≠NONE. |
| **v0.54.0** | 17.05 | **Execution entity detail drawer** — closes engineering #6. ActionItem перестал быть chip-only — теперь это first-class сущность с inline-edit drawer'ом. Schema additive: `ActionItem.priority` (ActionItemPriority enum LOW/NORMAL/HIGH/URGENT, default NORMAL) + `ActionItem.description` (Text, nullable, max 4000) + новые таблицы `ActionItemComment(id, actionItemId, userId, content, createdAt, editedAt?)` и `ActionItemActivity(id, actionItemId, userId?, type, payload, createdAt)` с audit-log enum `ActionItemActivityType` (CREATED / STATUS_CHANGED / ASSIGNEE_CHANGED / DUE_CHANGED / PRIORITY_CHANGED / TITLE_CHANGED / DESCRIPTION_CHANGED / COMMENT_ADDED / COMMENT_DELETED). Migration `20260517000000_add_action_item_drawer` — zero-downtime, defaults + nullable. Backend: `GET /api/actions/:id` (detail с comments + activities), расширенный `PATCH /api/actions/:id` (принимает priority + description, пишет activity-log в одной transaction), `POST /api/actions/:id/comments` + `DELETE /api/actions/:id/comments/:commentId` (author only). `serializeActionItemDetail` отдаёт всё через `actionItemDetailInclude`. Realtime: новые события `action:item:comment:added` / `comment:deleted`, fan-out в channel+server rooms; sync через socket в useActionItem hook. Frontend: `useActionItem(id, socket)` — fetch + live update + update/addComment/removeComment API; `ActionItemDrawer` — right-side floating panel (animation `ec-slide-in-right`) с inline title input, properties row (priority select, assignee dropdown по member list, datetime-local due, source channel ref + jump-to-message), description textarea (blur-save), comments thread с composer и delete-for-author, collapsible activity feed с человекочитаемым форматированием. Wiring: AppShell state `openActionItemId`, передаётся `onOpenAction` в `StatusBoard` (карточка теперь открывает drawer вместо jump в канал) и `IntelligencePanel` execution view (row click); checkbox toggle статуса сохранён через `stopPropagation`. |
| **v0.53.0** | 16.05 | **Workspace/Room language pass** — closes engineering #4. UI копирайт уведён от Discord-наследия в сторону NEXT-GEN positioning «operational collaboration infrastructure»: «сервер» → «пространство» (workspace), «канал» → «комната» (room) во всех user-facing строках 14 файлов. Затронуты: CreateServerModal / JoinServerModal / ServerInfoModal / ServerSettingsModal заголовки + плейсхолдеры + confirm prompts; ChannelList header / типы / placeholder композера / aria-label'ы кнопок; ChannelSettingsModal все секции (Название/Иконка/Описание + Internal toggle); AppShell chat header / empty states / drawer hint / VoiceMiniBar fallback; IntelligencePanel 5 табов + Memory/Execution/Files empty hints; SearchOverlay placeholder + hint; HomeToday/StatusBoard/TeamHealth/MemberList aria + empty states; VoiceRoom/VoiceMiniBar/VoicePlaceholder hangup + ready text; IncidentPanel «комнату инцидента»; ChannelDigestPanel «Сводка комнаты»; BotsTab «Боты пространства» + mentions copy; ActionQueueBar aria-label; AuthPage hero feature card. **Не тронуты** (намеренно): DB schema (`Server` / `Channel` остаются), API endpoints (`/api/servers/*`, `/api/channels/*`), TypeScript типы, internal variable names, code comments. BROADCAST type сохраняет термин «канал» как Telegram-flavoured announcement-stream (Discord×Telegram гибрид). |
| **v0.52.0** | 16.05 | **Group DMs** — closes engineering #3. Additive schema: новая таблица `ConversationParticipant (conversationId, userId, joinedAt)` + `DirectConversation` поля `isGroup`/`name`/`createdByUserId`; `userAId`/`userBId` стали nullable (NULL для group, заполнены для legacy 1-to-1). Migration `20260516220000_add_group_dms` (additive, zero-downtime — existing 1-to-1 rows не затронуты). Backend: unified helper `loadConversationMembers()` + `isDmMember()` — все DM-маршруты используют один membership-check независимо от типа. Новые routes: `POST /api/dm/groups` (create, 2-24 других user-id, server отвергает дубликаты и unknown ids), `PATCH /api/dm/groups/:id` (rename, host only), `POST /api/dm/groups/:id/participants` (add user, host only), `DELETE /api/dm/groups/:id/participants/:userId` (kick если host / leave если self; host не может уйти, transfer-ownership = future feature). `GET /api/dm/conversations` возвращает discriminated union: `isGroup=false` rows с `other`, `isGroup=true` rows с `participants[]+name+createdByUserId`. `emitDmConversationBumped` fan-out по всем participants (был только userA/userB). Frontend: `DmConversation` type теперь union, новые helpers `dmTitle()` и `dmIsSaved()` для унифицированного rendering. `GroupAvatar` (composite 2 stacked + counter если ≥3) + `deriveGroupTitle()`. `DirectConversationList` рендерит group rows + кнопка «Создать группу» в header. `CreateGroupDmModal` с substring-search, multi-select (selected first ordering), chip-row для выбранных, optional group-name (auto-derive если пусто). `AppShell` chat header / MessageList / MessageInput работают с обоими типами через helpers. Unit-тест `dm-membership.test.ts` — 8 cases (1-to-1 / group / saved / outsider / empty). |
| **v0.51.0** | 16.05 | **Uploads full file taxonomy** — `attachments.ts` ALLOWED_MIME расширен: Office (docx/xlsx/pptx/odt/ods/odp/csv), архивы (rar/7z/tar/gz/bz2 в дополнение к zip), extended video (mkv/avi), extra audio (m4a/aac). Magic-bytes sniff (`sniffMime` + `isMimeConsistent`, без npm dep) — клиент-объявленный mime сверяется с фактическими байтами буфера, чтобы нельзя было загрузить .exe под видом image/png. Per-mime size cap: 200 MB для video/*, 50 MB остальное. nginx `client_max_body_size` 750m → 900m. Frontend Attachments.tsx: FileBadge с label-вкладкой (DOC/XLS/PPT/PDF/CSV/MD) + новый archive-icon. MessageInput.tsx: расширен `accept=` (image/*, video/*, audio/* + explicit Office/archive mime + ext fallbacks .docx/.rar/.7z/.mkv etc) + per-mime client-side size check. Unit-тест `attachments-sniff.test.ts` — 30 cases на каждое family + mismatch detection (text/plain claim + pdf content → reject). |
| **v0.50.0** | 16.05 | **Media layer + voice messages** — video fullscreen viewer, audio/voice player cards, composer mic recorder via MediaRecorder, correct audio/video upload extensions. |
| **v0.49.0** | 16.05 | **Unread ergonomics** — active-room unread divider + jump-to-latest overlay + per-channel/DM/thread local draft sync. |
| **v0.48.x** | 16.05 | **Responsive visual system pass** — cinematic shell background, operator topbar/rail, channel/message/composer depth, Home command-center cards, desktop/tablet/mobile polish. Commit `d392b54` |
| **v0.48.0** | 16.05 | **Upload asset path fixes** — centralized `resolveAssetUrl`, avatar/server icon fallbacks, uploads MIME smoke guard. Fixes broken images under `/eclipse-chat/` path deploy |
| **v0.47.0** | 15.05 | **Client Mode v2** — `Channel.internal` Boolean + миграция `add_channel_internal` (additive, default false). Filter: internal каналы hidden для MEMBER когда `server.mode=CLIENT`. PATCH принимает internal (OWNER/ADMIN/MOD). UI: ChannelSettingsModal toggle + ChannelList lock-icon |
| v0.46.0 | 15.05 | **Threads hotfix** — `rightRailCollapsed` блокировал ThreadPanel render. onOpenThread auto-expand'ит rail |
| v0.45.0 | 15.05 | ChannelList stagger reveal cascade + PinnedBar adaptive maxHeight на mobile |
| v0.44.0 | 15.05 | Modal backdrop padding 16→8px на ≤640px |
| v0.43.0 | 15.05 | StatusBoard + ServerInfoModal grids → auto-fit responsive |
| v0.42.0 | 15.05 | Multi-cam grid — CSS Grid auto-fit minmax(280px,1fr) |
| v0.41.0 | 15.05 | **Voice diagnostics panel + Reset settings button** |
| v0.40.0 | 15.05 | **AI typing indicator** — shimmer-text при pending @ai |
| v0.39.0 | 15.05 | DM/Channel skeletons + MessageList stagger first 12 messages |
| v0.38.0 | 15.05 | Skeleton CSS helpers + MemberList/TeamHealth skeleton + ChannelList slide-right hover |
| v0.37.0 | 15.05 | **Premium motion system** (taste-skill) — lift-md / press / avatar-glow / shimmer-text / reveal-cascade |
| v0.33.0 | 15.05 | **Bot row как role-mention responder** — embedded room participant |
| v0.32.0 | 15.05 | **Brand identity scaffolding** — favicon.svg + apple-touch + og-image + manifest |
| v0.31.0 | 15.05 | Team Health → Status Board pre-filter wiring |
| v0.30.0 | 15.05 | **Execution Analytics — Team Health** dashboard |
| v0.29.0 | 15.05 | Role-aware `@`-mentions (`@moderator/@pm/@knowledge/@sales` + RU) |
| v0.28.0 | 15.05 | **AI Agents типология** — Bot.role enum + per-role prompts |
| v0.35.0 | 15.05 | **Mobile adaptation hotfix.** Pavel screenshot — tabs «Дела/Файлы/Люди» отрезались в members drawer. Расширил breakpoint hide-label с 1025-1366 → ≤1366 (все sub-desktop). Drawer width 90vw→86vw, max 320→300px. Composer hints прогрессивно прячутся: drop/@/:emoji ≤900px, Shift+Enter ≤640px — на mobile остаётся Enter + /task. Tab bar gradient-fade справа намекает на overflow scroll |
| v0.34.0 | 15.05 | **Visual polish pass.** Reusable `EmptyState` component (icon + title + hint + optional action) + 10 calm line-art SVG icons (EmptyIcons.tsx). Replaced text-only empties в TeamHealth / SearchOverlay / AppShell (DM placeholder / no-server / no-channel) — calm operational visual вместо «холодного» текста. Avatar fallback saturation 30→45 + lightness 32→34 для visual interest. `:focus-visible` rings global pass (a11y) — `.ec-btn` / `.ec-channel-item` / `.ec-message-actions` |
| v0.33.0 | 15.05 | **Bot row как role-mention responder.** Закрывает promise AI Agents типологии v0.28.0 — Bot row становится «embedded room participant». `getResponderForRole(serverId, role)` resolver: bot с подходящей `role` в server (oldest createdAt wins, deterministic) → fallback system @ai. Bot.userId (shadow user) — author message → MessageList рисует bot's avatar + role-badge через стандартную `botProfile.role` сериализацию (works on reload, не эфемерно как v0.29.0 fallback). Throttle per-channel сохранён. BotsTab: per-role hint «Отвечает на @{keyword}-mentions» с role-coloured код-chip'ом. BOT-API.md обновлён новой секцией |
| v0.32.0 | 15.05 | **Design polish slice 1.** Fix: IntelligencePanel tab overflow на узком rail — icons (5 SVG inline) + responsive label + horizontal scroll fallback + sticky utility-buttons. Brand identity scaffolding: full `index.html` meta (OG / Twitter card / manifest / canonical / robots noindex), `apps/web/public/` populated впервые — `favicon.svg`, `apple-touch-icon.svg`, `og-image.svg` (1200×630 calm brand card), `manifest.webmanifest`. PWA-ready. theme-color → `#07090D` align с `--ec-void` |
| v0.31.0 | 15.05 | **Team Health → Status Board pre-filter** — закрывает scope cut v0.30.0. StatusBoard принимает `initialFilter` prop (overdue / unassigned / by-assignee); mount-effect применяет к state. 3 новых фильтра: «Просрочено» / «Без ответственного» toggle-chip'ы + dismissible chip с avatar для assignee. `applyBoardFilters` extracted pure-функция (AND-logic). Clicking stat-card в Team Health открывает Board с авто-применённым фильтром. 9 unit-тестов на filter combinations |
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

## 🎯 Что делаем дальше (v0.49+)

По состоянию на 16.05 закрыты: ✅ Core chat foundation, ✅ voice/video
base, ✅ DMs + Saved Messages, ✅ Client Mode v2, ✅ AI Agents taxonomy,
✅ ActionItem execution layer, ✅ Status Board + Team Health, ✅ AI memory
base, ✅ Home command center, ✅ responsive cinematic UI pass.

Новый стратегический север:
**Eclipse Chat = communication + execution + AI + memory + workflows**.
Детальный план: [`docs/NEXT-GEN-OPERATIONAL-PLATFORM.md`](docs/NEXT-GEN-OPERATIONAL-PLATFORM.md).

Ближайшая engineering-очередь:

1. ✅ **Unread + jump-to-latest + draft sync** — закрыто в v0.49.0:
   active-room unread divider, jump overlay, local drafts for channels/DM/threads.

2. ✅ **Media viewer + voice messages** — закрыто в v0.50.0:
   fullscreen video, audio/voice cards, mic recorder in composer.

3. ✅ **Group DMs** — закрыто в v0.52.0. Additive `ConversationParticipant`
   join-таблица + `isGroup`/`name`/`createdByUserId` на `DirectConversation`,
   unified membership helper, новые group routes (create/rename/add/remove),
   composite GroupAvatar, CreateGroupDmModal с participant picker.

4. ✅ **Workspace/Room language pass** — закрыто в v0.53.0. UI копирайт
   уведён в сторону «пространство» / «комната» во всех user-facing
   строках; DB/API/типы остались на Server/Channel. BROADCAST сохраняет
   «канал» как Telegram-flavour announcement type.

5. **Role architecture v2** — permission matrix + визуальная иерархия:
   Architect / Developer / Operator / Client / Viewer / AI Agent.

6. ✅ **Execution entity detail drawer** — закрыто в v0.54.0. ActionItem
   получил priority, description, comments thread и activity log;
   drawer с inline-edit открывается из StatusBoard и IntelligencePanel.

7. ✅ **Approvals** — закрыто в v0.55.0. Extension на ActionItem
   (approverUserId + approvalStatus + note + timestamp), drawer UI с
   тремя состояниями (NONE/PENDING/APPROVED|REJECTED), badge на cards.
   Multi-approver chains — future расширение.

8. ✅ **Semantic search v1** — закрыто в v0.57.0. Unified operational
   search (messages + action items + files) с tabs в SearchOverlay,
   ILIKE-based. FTS upgrade (tsvector + GIN) — будущая v2 миграция без
   breaking changes для frontend.

9. ✅ **Voice transcription prototype** — закрыто в v0.58.0. Audio-
   attachments транскрибируются через OpenAI Whisper API fire-and-forget,
   UI блок с PENDING/READY/FAILED states. Live voice-channel
   transcription (LiveKit Egress) — отдельная задача.

10. 🟡 **Operational tables** — phase 1 (v0.59) + phase 2 (v0.62)
    закрыты: schema/CRUD/inline grid + realtime collab + RBAC + USER
    и CHECKBOX field types. **Phase 2.5** — RELATION (cross-table),
    FILE (attachment), drag-reorder fields/rows, table templates.
    **Phase 3** — AI-fill rows, formulas, link row→ActionItem.

11. ✅ **Voice multi-publisher harden** — закрыто в v0.56.0. TILE_LIMIT
    с priority sort (screens never collapse, speakers first), overflow
    cameras в presence-strip как chips, расширенный diagnostics. E2e
    test с 6+ participants остаётся formal acceptance — нет инструмента
    в session.

12. ✅ **Uploads: full file taxonomy** — закрыто в v0.51.0. Расширен
    ALLOWED_MIME (Office docx/xlsx/pptx/odt/ods/odp + архивы
    rar/7z/tar/gz/bz2 + extra video mkv/avi + audio m4a/aac/x-wav).
    Magic-bytes sniff (`sniffMime` + `isMimeConsistent`, без npm dep) —
    client-объявленный mime сверяется с фактическими байтами буфера.
    Per-mime size cap: 200 MB для video/*, 50 MB остальное. nginx
    `client_max_body_size` 750m → 900m. Frontend FileBadge + archive
    icon + расширенный `accept=`. 30 unit-тестов в
    `attachments-sniff.test.ts`.

13. ✅ **Shared channel playback / listening room** — MVP закрыт в
    v0.61.0. Schema (`MusicSession`), 7 routes (state/start/pause/
    resume/skip/stop/queue), single socket event `music:session:updated`,
    `MusicMiniPlayer` в chat header, «Слушать вместе» button на audio
    attachments. Late-join drift-correction, LiveKit interop, periodic
    position-sync — phase 2.

14. **In-app Help / Onboarding** — отдельная страница `/eclipse-chat/help`
    или drawer с двумя секциями: «Полный функционал» (workspaces / rooms /
    messages / threads / DMs / voice / status board / intelligence panel /
    tables / music / search) + «Настройка ботов» (создать в Settings →
    Боты, выбрать role GENERIC/MODERATOR/PM/KNOWLEDGE/SALES, API key
    `ecb_*`, webhook URL + HMAC, role-mentions, autoRespond toggle,
    systemPromptOverride). Кнопка «?» в Forge Layer. Размер M-L
    (1-2 рабочих захода). Pavel-ask 17.05.

### NEXT-GEN audit gap items (зафиксировано 17.05 после полного сверки docs/NEXT-GEN-OPERATIONAL-PLATFORM.md vs codebase)

15. **CORE chat: link embeds / OG preview cards** — единственный gap
    в §1 NEXT-GEN. RichContent рендерит markdown, но `https://example.com`
    остаётся текстовой ссылкой без card. Backend: новый endpoint
    `GET /api/embeds/preview?url=` с server-side HTML fetch + OG meta
    extract + image-thumbnail proxy через sharp (rate-limited, allowed
    schemes only). Frontend: detect URLs в RichContent, async fetch
    preview, render card под сообщением. Кэш в БД 7 дней. Risk: SSRF
    (whitelist domains? отдельный egress proxy?). S-M.

16. **Room types: execution / AI / temporary / focus** — §2 NEXT-GEN
    gap. Сейчас только TEXT/VOICE/BROADCAST + Channel.internal flag.
    Phase 1 — добавить enum value `EXECUTION` (Status Board становится
    "канал-режим" для всего workspace со своим IntelligencePanel
    contextom). Phase 2 — `TEMPORARY` (auto-delete после resolveAt).
    Phase 3 — `FOCUS` (per-user-scoped, hide noise mode). `AI rooms`
    — отдельный тип где default-participant — bot, цель: AI dialog
    surface. M на phase 1, L на полный набор.

17. **Role architecture v2** — расширить #5 NEXT-GEN. Текущие 4
    роли (OWNER/ADMIN/MODERATOR/MEMBER) → 11 ролей: + Architect,
    Developer, Operator, Client, Viewer, AI Agent, Observer, Guest.
    + permission matrix (room visibility / AI access / file
    permissions / execution actions / moderation / task mgmt /
    approval / bot mgmt / analytics access) — 9 dimensions × 11
    roles = 99 cells, конфигурируемые per-workspace. UI: визуальная
    иерархия с colour-coding, glow, status indicators, badges,
    live states. Schema-heavy: новая `RolePermission` table, либо
    JSON-based bitmask на `Member.role`. L.

18. **AI agents: реальное поведение** — §5 NEXT-GEN. Сейчас 5
    ролей (GENERIC/MODERATOR/PM/KNOWLEDGE/SALES) = prompted
    assistants с разными system-prompts. Нет фоновой логики.
    Phase 1: добавить SUPPORT + ARCHITECT в taxonomy (быстро). Phase
    2 — реальные background tasks по ролям:
    - MODERATOR: периодический scan канала на anti-spam / toxicity
      pattern matching, suggest cleanup MOD'ам.
    - PM: cron daily — overdue tasks, blocker detection (3+ assigned-
      open, no comments 48h), deadline reminders через DM.
    - KNOWLEDGE: indexable архив pinned + decisions для semantic
      Q&A (требует §22 vector store).
    - SALES: lead-summaries по client-mode channels.
    - SUPPORT: AI helpdesk на @support mention с FAQ retrieval.
    - ARCHITECT: technical summaries decisions log + auto-generated
      architecture diagrams (D2/Mermaid). L-XL.

19. **Bot Builder visual editor** — §6 NEXT-GEN. Node-based logic
    builder в браузере. Drag-and-drop nodes: trigger (message /
    mention / cron / webhook in / approval) → condition (regex /
    role check / channel filter) → action (send message / create
    task / call API / update table / post to webhook). Workflow
    chains сохраняются в JSON, выполняются server-side через
    queue. React-Flow или Reactflow.dev (lazy chunk). Backend:
    новая `BotWorkflow` table + execution engine. XL.

20. **Execution: kanban + dependencies + escalation + reminders** —
    §7 NEXT-GEN. Сейчас StatusBoard = 2-column filter view. Phase
    1: kanban-style drag-and-drop columns (OPEN / IN_PROGRESS /
    REVIEW / DONE) — расширение `ActionItemStatus` enum + drag
    handler с PATCH /api/actions/:id. Phase 2: `ActionItem.dependsOn`
    relation (blocks/blocked-by graph), UI badge "blocked by N
    tasks". Phase 3: escalation cron (если overdue 48h без
    обновления — DM креатору + assignee + manager). Phase 4: AI
    summary per-task (description + comments → 2-line takeaway).
    M-L.

21. **AI persistent memory + semantic search v2** — §8 NEXT-GEN
    killer feature. Текущий assistant получает context window
    (recent 20 + pinned + open actions) на каждый mention. Phase
    1: vector store (pgvector в PG 16 native) для messages /
    decisions / pinned. Embeddings через локальный sentence-
    transformer (без OpenAI dep) или Ollama embedding model.
    Phase 2: semantic search endpoint — заменяет ILIKE в
    SearchOverlay. Phase 3: "memory recall" — bot ищет
    relevant past discussions при ответе ("вы уже обсуждали
    auth в этом канале 3 недели назад, decision был X"). L-XL.

22. **Live voice intelligence** — §9 NEXT-GEN. LiveKit Egress
    для recording voice rooms + Whisper streaming для live
    transcription overlay. Phase 1: opt-in recording (host
    запускает, все видят red dot, transcript появляется в
    IntelligencePanel под voice room). Phase 2: live AI capture
    — Ollama parsit transcript chunks, extract tasks/decisions/
    follow-ups в real-time, отображает chips в right rail. Phase
    3: post-call summary message в associated channel. Требует
    LiveKit Egress server в Docker compose + storage для записей.
    L.

23. **Live workspace (notes / whiteboard / diagrams)** — §9 NEXT-
    GEN. Во время voice call — collaborative canvas справа.
    Phase 1: shared notepad (Yjs CRDT через y-websocket провайдер
    через наш Socket.io). Phase 2: whiteboard на Excalidraw lib
    (open-source, MIT, lazy chunk). Phase 3: D2/Mermaid live
    architecture diagrams. XL.

24. **Client portal expansion** — §10 NEXT-GEN. Текущий Client
    Mode v2 (Channel.internal + Server.mode=CLIENT) скрывает
    operator chrome. Расширение: client-side dashboard
    (`/eclipse-chat/portal/:serverId`) с project progress (open
    tasks по статусу), approvals список с CTA approve/reject,
    invoices (новая `Invoice` model — поднять отдельно), files
    aggregator, summaries (AI digest канала за период), reports
    download (PDF generation через puppeteer? или server-side
    HTML→PDF). AI client assistant: onboarding flow + Q&A bot
    с client-safe knowledge subset. L.

25. **Admin Panel** — §11 NEXT-GEN. Unified workspace settings:
    rooms list с bulk actions, roles + permissions matrix UI
    (§17), moderation queue (reported messages), audit log
    viewer, AI controls (per-bot prompt edit / memory clear /
    permissions), system analytics (response time / AI usage /
    execution health / room activity), integrations panel.
    Single `/eclipse-chat/admin` route, OWNER+ только.
    Phase 1: settings consolidation. Phase 2: analytics. Phase
    3: AI mgmt. M-L.

26. **Automation system** — §12 NEXT-GEN. Triggers (message /
    new task / approval / file upload / voice session / mention)
    + Actions (create task / notify / generate summary / update
    table / generate PDF / send webhook) + Integrations
    (Telegram bot bridge, GitHub webhook receiver, Notion sync,
    Bitrix / 1C custom HTTP). Уровень выше Bot Builder (§19) —
    workspace-scope automation, не per-bot logic. Phase 1: 3
    integrations (Telegram / GitHub / Notion). XL overall.

27. **Mobile-first phase** — §14 NEXT-GEN. Текущий responsive
    pass (v0.34→v0.45) даёт **adaptive layout**, не mobile-
    first UX. Phase 1: gesture nav (swipe left/right between
    channels, swipe down для drawer dismiss). Phase 2: PWA
    manifest + service worker (offline message queue + push
    notifications). Phase 3: voice-first mode (push-to-talk
    floating button, voice messages как primary input).
    Phase 4: native shell (Capacitor wrapper для App Store /
    Play). L-XL.

28. **Home expansion** — §15 NEXT-GEN. Сейчас Home «СЕГОДНЯ»
    показывает: assignedTasks / incidents / activeVoice / counts.
    Добавить: active rooms (top-N с recent activity heat-map),
    AI alerts (если bot обнаружил blocker / overdue / spam), Team
    Health summary card (топ-1-2 числа), Approvals queue (мои PENDING).
    S-M, чисто frontend + backend aggregation route.

29. **Focus mode + Replay timeline + Temporary rooms** — §16 NEXT-
    GEN. Focus mode: per-user toggle "hide noise", скрывает все
    messages кроме direct mentions / assignments / approvals;
    тонкая UI prop. Temporary rooms: новый `Channel.expiresAt`
    + cron auto-delete; UI badge "автоудаление через Xч". Replay
    timeline: scrubber UI поверх MessageList, фильтр messages
    по timeline range + decisions/approvals overlay; чисто
    frontend на existing data. M-L.

30. **Marketplaces + Industry runtimes** — §17 NEXT-GEN long-term.
    Agent Marketplace (install AI agents в workspace из catalog),
    AI Workflows Marketplace (templates: support / sales /
    construction / CRM), Industry Runtimes (construction /
    agency / startup / support — pre-configured workspaces с
    rooms / bots / templates). Требует §19 Bot Builder + §17
    Roles + §25 Admin foundations. XL+.

32. **Player visualization — waveform + scrubbing** — Pavel-ask 17.05
    «нужно настроить визуализацию проигрывателя видео и музыки в чате,
    чтобы было видно дорожку». Сейчас: audio/video attachments
    используют native `<audio controls>` / `<video controls>` — linear
    progress bar, без waveform. MusicMiniPlayer имеет custom pill
    progress, но без визуальной дорожки. Voice messages — то же
    (native controls).

    **Цель — три уровня визуализации:**

    **Phase 1: Audio waveform (Telegram-style)** — самое важное для
    voice messages и music. Подходы:
    - **a.** Pre-rendered waveform: backend в `processAttachment` для
      audio mime'ов сохраняет `Attachment.waveformPeaks` (Int[] N=64
      или 96 нормализованных peaks 0-100) — рассчитывается через
      `ffprobe` / `audiowaveform` CLI или JS lib `wavesurfer.js`
      analyzer (offline). Кэш в БД, рендер на frontend через SVG
      polyline или canvas. Преимущество: instant render, scrubable.
      Минус: новый migration + CLI dependency на проде.
    - **b.** Client-side decode: на mount audio attachment frontend
      decode'ит first ~3 sec через Web Audio API + рисует peaks.
      Преимущество: zero backend. Минус: задержка perceived ~200ms,
      крутится spinner.
    - **Решение:** опция **a** для phase 1 — pre-rendered, instant.
      Schema: `Attachment.waveformPeaks Json?` + migration additive.
      Backend: `audiowaveform` cli (`apt install audiowaveform`) или
      JS lib `web-audio-api` для server-side decoding.

    **Phase 2: Video timeline thumbnails** — для video attachments:
    при наведении на progress bar показывать thumbnail кадра в этой
    точке (как YouTube). Подходы: ffmpeg extract N=20 thumbnails
    при upload → sprite-sheet PNG → `Attachment.timelineSpriteUrl`.
    Стандартный pattern.

    **Phase 3: Музыкальный плеер апгрейд** — MusicMiniPlayer
    получает full-width waveform view при expand'е (а не только pill
    progress). + spectrum analyzer overlay для playing track через
    Web Audio API (real-time visualisation). Cinematic / calm
    aesthetic.

    **Места для wire-in:**
    - `Attachments.tsx` `AudioItem` / `VoiceMessageItem` —
      основной hit point.
    - `Attachments.tsx` video `<video>` thumbnail — phase 2.
    - `MusicMiniPlayer.tsx` — pill expand view + waveform.

    **Effort:** Phase 1 M (server-side decode + schema migration +
    SVG render + scrubbing handler), Phase 2 M-L (ffmpeg cli + sprite
    serving), Phase 3 S-M на base + L на real-time analyzer.
    **Impact:** H — operational chat aesthetic становится cinematic,
    voice messages сразу узнаваемы по shape, music room ощущается
    как proper player.

34. **Music в VOICE-каналах** — Pavel-ask 17.05 «в голосовые каналы
    надо добавить возможность прослушивать музыку совместно со всеми
    кто в комнате». Сейчас `MusicSession` (v0.61) работает только в
    TEXT/BROADCAST — для VOICE backend отвергает (`routes/music.ts`
    blocks at create). Нужна интеграция с LiveKit. **План phase A**
    (proof-of-concept): unblock backend VOICE-validation, frontend
    `MusicMiniPlayer` рендерить в VoiceRoom UI помимо chat-header
    (когда channel.type === VOICE). Проблема — sync drift между
    participants: voice-room participants приходят/уходят, новый
    user должен попасть в текущую timeline-позицию. v0.61 уже имеет
    `derivedPositionMs` (computed из startedAt + positionMs), это
    работает для late-join. **План phase B** (LiveKit-native, M-L):
    использовать LiveKit data channels вместо native `<audio>` —
    host streams audio bytes через LiveKit, остальные слушают как
    дополнительный publisher. Преимущество — точная синхронизация
    (LiveKit handle's clock drift), reduced bandwidth (одна copy на
    server, не N клиентов download'ат). Минус — sharper LiveKit
    coupling, нужны custom audio publishers в room. **MVP phase A**
    достаточно для community vibe «слушаем что-то вместе» — это
    1-2 commit'а, готовы к v0.72. Phase B — отдельная неделя.

33. **Mobile responsive hardening v2** — Pavel-ask 17.05 «всё урезано
    и криво». Отдельно от #27 strategic mobile-first phase (PWA / native
    shell / gestures / voice-first) — это **hardening hotfixes** для
    реальных дефектов в текущем responsive layer (v0.34→v0.45). Audit
    17.05 (Explore agent, file:line привязка).

    **Critical (UX сломана на touch):**
    - **a.** DM-button в `MemberList.tsx:193-228` `opacity: 0` hover-only
      → на touch device полностью скрыт, ЛС недоступны с мобильного.
      Fix: media-query `opacity: 0.8` на ≤640px.
    - **b.** Message actions bar (edit/delete/react) в
      `MessageList.tsx:111-126` `opacity: 0` hover-only + `position:
      absolute; top: -10px` уходит за bounds на узком экране. На mobile
      все per-message actions недоступны. Fix: на ≤640px `position:
      static` + `opacity: 1` + flex row под message-content.
    - **c.** `Modal.tsx:64-135` — нет focus trap, нет scroll-lock body,
      `maxHeight: calc(100vh - 64px)` не учитывает iOS Safari URL bar +
      виртуальную клавиатуру. На mobile modal обрезает поля под
      keyboard. Fix: `100dvh` + `safe-area-inset-bottom` padding + body
      `overflow: hidden` lock при open.
    - **d.** `ActionItemDrawer.tsx:60-73,150-159` — close-button 32×32px
      (ниже WCAG 44×44 min touch target), drawer 460px width на 375px
      экране = взрыв layout (берётся 100vw без явных стилей под mobile).
      Fix: `min(460px, 100vw)` явно + close-btn 48×48 на ≤640px.
    - **e.** `MessageInput.tsx` slash-commands на mobile не discoverable
      (hints спрятаны на ≤640px в responsive.css), но `/task` `/decision`
      работают — пользователь не знает. Fix: placeholder rotation
      «Сообщение или /task» / mobile-version hint chip.

    **High (cramped / cluttered):**
    - **f.** `ChannelList.tsx:128-143` — delete/settings button `opacity: 0`
      hover-only — same проблема что MemberList.
    - **g.** `IntelligencePanel.tsx` tabs (5 icons на 248px rail с
      icons-only на ≤1366) — нет `aria-label`, на touch нет tooltip,
      пользователь гадает что за иконка. Fix: aria-label + long-press
      tooltip или явный «What's this» FAB.
    - **h.** `OperationalTablePanel.tsx:85-91` — таблица с horizontal scroll
      на mobile, но НЕТ visual hint (gradient-fade edge или scroll
      indicator). Cells обрезаются молча.
    - **i.** `MusicMiniPlayer.tsx:34-46` — pill `max-width: none`, на узком
      топбаре съедает место для chat-header title. Fix: `max-width: 200px`
      + text-overflow на ≤640px.
    - **j.** `VoiceRoom.tsx:199-209` controls dock `flex-wrap` —
      переносится на 2-3 строки если экран < 300px (landscape с
      keyboard ≈ 220px). Fix: `flex-wrap: nowrap` + horizontal scroll.
    - **k.** `StatusBoard.tsx:98-109` — `minmax(280px, 1fr)` даёт
      одну колонку только на ≤560px; на 480-560px странный hybrid.
      Fix: явный `grid-template-columns: 1fr` на ≤500px.
    - **l.** `HomeToday.tsx:56-59` — `minmax(150px, 1fr)` на 375px
      сжимается до 1 column через auto-fit, а лучше 2-column для
      density. Fix: explicit `repeat(2, 1fr)` на ≤420px.

    **Medium polish:**
    - **m.** `SearchOverlay.tsx:50-63` — `padding: 10vh ...` слишком
      много vertical space на mobile. Fix: `5vh` на ≤500px.
    - **n.** `Attachments.tsx` video — `max-height: 220px` — норм, но нет
      fullscreen-button на touch (есть для image lightbox, нет для video).
    - **o.** `TeamHealth.tsx:68-72` stat-cards `minmax(220px, 1fr)` —
      на 420-440px странный 1.5-column гибрид. Fix: explicit 2-column.

    **Quick wins** (5 fixes × ~10 мин = 1 час суммарно, максимальный
    видимый эффект):
    1. (a) DM-button always-visible на mobile
    2. (b) Message actions bar always-visible на mobile
    3. (c) Modal `100dvh` + safe-area + body scroll-lock
    4. (d) Drawer close-button 48×48 на mobile
    5. (g) IntelligencePanel tabs `aria-label`

    **Out of scope этого item'а** (закрыто отдельным #27):
    - PWA / service worker / offline queue / push notifications
    - Native shell (Capacitor wrapper)
    - Swipe gesture nav между каналами
    - Voice-first push-to-talk floating button

    **Что NOT-broken** (audit confirmed OK):
    - Breakpoint структура (640/1024/1366) корректная.
    - Drawer system left-nav + members drawer работает.
    - VoiceRoom grid auto-fit single-column на ≤640px OK.
    - Composer textarea max-height ограничена, buttons shrink.
    - `safe-area-inset` уже используется в composer + shell-top.
    - `100dvh` уже есть в responsive.css (lines 20, 684).

    **Effort:** M (5 critical + 7 medium fixes ≈ 3-4 часа). **Impact:**
    H — мобильный UX становится usable, текущий broken.

### Сейчас приоритеты (по ROI и cohesion)

| Очередь | Что | Effort | Impact | Зачем |
|---|---|---|---|---|
| ✅ закрыто | **#33 Mobile responsive hardening v2** — закрыто в v0.65.0 (14 fixes). Strategic mobile-first phase (#27) остаётся отдельной L-tier работой (PWA / native shell / gestures / voice-first) |
| ✅ закрыто | **#32 Phase 1 audio waveform** — закрыто в v0.66.0. Phase 2 (video timeline thumbnails) + Phase 3 (MusicMiniPlayer expand view + spectrum analyzer) — остаются в backlog. |
| ✅ закрыто | **#15 link embeds** — закрыто в v0.67.0 (LinkEmbed cache table + SSRF-guarded fetch + LinkEmbedCard UI). |
| ✅ закрыто | **#28 Home expansion** — закрыто в v0.69.0 (pendingApprovals + activeRooms sections). |
| 🟡 частично | **#10 Tables phase 2.5a** — drag-reorder + 2 templates закрыто в v0.70.0. **Phase 2.5b** остаётся: RELATION (cross-table) field, FILE (attachment) field, расширенный набор templates (bugs / construction / approvals / knowledge). |
| 🟡 частично | **#20 Execution kanban phase 1** — закрыто в v0.71.0 (4-status enum + drag-drop kanban). Phase 2 (dependencies / blocks-graph), Phase 3 (escalation cron + DM на overdue 48h), Phase 4 (AI summary per-task) остаются. |
| 🟡 частично | **#34 Music в VOICE-каналах phase A** — закрыто в v0.72.0 (backend unblock + VoiceMusicPicker + UI в chat-header). Phase B (LiveKit data channels для server-side mixed audio + точный sync без клиентского drift) остаётся. |
| 🟡 частично | **#24 Client portal phase 1** — закрыто в v0.83.0. Hash-route `/#/portal/<serverId>` + новый endpoint `GET /api/servers/:id/client-portal` (progress counts + items, approvals pending+recent, files cross-channel, recent activity) + ClientPortalPage с 4 секциями + entry points (ChannelList «Клиентский портал» для CLIENT-mode + AdminPanel preview-card). Permission gate: CLIENT (primary) + OWNER/ADMIN (preview), все остальные роли — 403. Visibility filter: internal-каналы всегда hidden. Phase 2 (Invoice model + PDF reports + AI digest) + Phase 3 (public token-based access без login + email delivery) — остаются. |
| 🟡 частично | **#27 phase 3 Push notifications** — закрыто в v0.84.0. PushSubscription schema (per-device, cascade-delete) + web-push lib + VAPID config (env-driven, graceful disabled если keys missing) + lib/webPush.ts (notifyUser/notifyUsers + 410 cleanup) + 4 routes (config/subscribe/unsubscribe/test) + 4 triggers (DM message, ActionItem assigned, Approval requested, Escalation) + service worker push+notificationclick handlers + usePushNotifications hook + ProfileModal section. ENV setup на проде: `node apps/server/scripts/generate-vapid.js mailto:...` + add 3 keys в .env + 1 в web build env. |
| ✅ закрыто | **#27 phase 4 Push polish** — закрыто в v0.85.0. Mention trigger (parse @<displayName> в server channels, resolve через member lookup, push matched users) + NotificationPreferences (5 toggles: mentions/dms/assignments/approvals/escalations с default-all-true) + MutedChannel (per-channel push skip, UI bell-toggle в ChannelList). notifyUser обогащён event-type param + pref check + muted-channel check. Test endpoint использует notifyUserDirect (bypass'ит prefs — explicit user test). Background sync для offline message queue — отдельный future slice. |
| 🟡 частично | **#24 phase 2a Client Portal extension** — закрыто в v0.86.0. Invoice schema (Invoice + InvoiceItem + InvoiceStatus enum) + полный CRUD routes (admin-only) + status workflow (DRAFT→SENT→PAID/CANCELLED, с auto issuedAt/paidAt) + AI digest в client-portal payload (3-5 line summary через existing chat() chain) + Invoices section в ClientPortalPage (CLIENT видит SENT+PAID) + AdminPanel «Счета» tab (list + CreateInvoiceForm с inline line items + status transition buttons). Phase 2b (PDF generation через pdfkit) — отложено, npm registry ECONNRESET блокировал install. Phase 3 — public token-based portal access. |
| 🟡 частично | **#10 phase 3 Operational Tables AI-fill + aggregations** — закрыто в v0.87.0. Aggregations footer (SUM/AVG/COUNT/MIN/MAX) для NUMBER колонок — computed at read, без schema changes, через `aggregateNumberFields` pure helper в serialize'е. AI-fill endpoint `POST /api/tables/:id/rows/:rowId/ai-fill` — берёт schema + sample rows + current row, просит chat() заполнить пустые TEXT/NUMBER/STATUS/DATE/CHECKBOX cells, валидирует ответ (STATUS options, NUMBER/DATE format, CHECKBOX true/false) и возвращает suggestions. AI lightning button в RowEditor (видим только если есть пустые fillable cells). Phase 4 (row→ActionItem binding + per-row formulas) остаётся. |
| 🟡 частично | **#23 phase 1a Live workspace shared notepad** — закрыто в v0.88.0. VoiceNote schema (channelId UNIQUE + content text + version counter). Routes GET/PATCH `/api/channels/:id/voice-note` с optimistic concurrency (baseVersion check → 409 + current). Socket emit `voice-note:updated` в channel-room для realtime sync. useVoiceNote hook (initial fetch + socket sub + debounced save 800ms + conflict handler). VoiceNotePanel в VoiceRoom (markdown textarea + saved-status + conflict banner). Phase 1a = last-writer-wins (не CRDT) — yjs npm install failed 7 retries today, deferred phase 1b. Phase 2 — Excalidraw whiteboard. Phase 3 — D2/Mermaid diagrams. |
| 🟡 частично | **#26 phase 2a Integrations (Telegram + GitHub)** — закрыто в v0.89.0. Integration schema + IntegrationType enum (TELEGRAM_OUTGOING / GITHUB_WEBHOOK). AES-256-GCM encryption через `encryptSecret` (reuse 2FA key). Telegram outgoing: bridge на message:new event в channel — POST `api.telegram.org/bot<token>/sendMessage` (no npm dep, raw fetch + token format validation). GitHub incoming: public webhook receiver `/api/integrations/gh/:webhookPath` с HMAC-SHA256 verify (timingSafeEqual), formatter supports push/PR/issue/release/ping (RU markdown). Raw body capture через replaced JSON content-type parser. AdminPanel «Интеграции» tab с CreateIntegrationForm + one-time GH setup card (URL + secret отдаются сразу при create, потом не возвращаются). Phase 2b — TELEGRAM_INCOMING + NOTION_SYNC. |
| 🟡 частично | **#10 phase 4 row→ActionItem binding** — закрыто в v0.90.0. TableRow.actionItemId nullable ref + cascade SetNull. New endpoint POST /api/tables/:id/rows/:rowId/to-action — конвертирует row в first-class ActionItem (title из первого TEXT cell, sourceMessage — system bot post в table.channelId). Lib/systemBot.ts shared между integrations + tables (cached system shadow user). serializeTable обогащён `linkedAction` snapshot (status/title/dueAt/etc) per row. UI: «→ задача» button в action area (unlinked rows) + status badge с color tone (linked rows, click → ActionItemDrawer). Phase 4a = one-way (row → task). Phase 4b — bidirectional sync (STATUS column ↔ ActionItem.status, title column ↔ task.title). |
| ✅ закрыто | **Stability hardening v0.91.0** (19.05 после prod-recovery): voice note autosave debounce 800→1500ms (50%+ редукция write-burst), /api/health возвращает pg_stat_activity breakdown (early connection-pressure detection), AI-fill route rate-limit 20/60s, DATABASE_URL connection_limit hint в docs. |
| ✅ закрыто | **UI hotfix word-wrap v0.92.0** (19.05): «ПЕРЕГЕНЕРИРОВАТЬ» glitch в ChannelDigestPanel «Сводка комнаты» (long RU UPPERCASE слово ломалось mid-word на узком intel-rail). Текст укорочен до «✦ Заново / ✦ Резюме», `whiteSpace: nowrap` + `textOverflow: ellipsis` + `maxWidth: 100%` defensive style. |
| ✅ закрыто | **#5 phase 2 + #4 AI-write v0.93.0** — AI agent создаёт rows в operational tables по запросу из чата. `ai/taskFromChat.ts`: `hasTaskCreationIntent` regex prescan (RU/EN keywords) → `loadContext(serverId)` (server tables + members) → AI JSON extract intent + table_id + cells → per-type validation (USER displayName→userId, DATE ISO, STATUS options, NUMBER, CHECKBOX) → row.create + bot confirmation reply. Wired в `maybeReplyToMention` (skip normal AI reply если task created). Phase 2 (future) — update existing rows, batch creation, explicit `#tableName` syntax. |
| 🟡 частично | **#10 phase 4b bidirectional row↔ActionItem sync** — закрыто в v0.94.0. `lib/rowActionSync.ts` pure mappers: `mapCellToActionStatus` / `mapActionStatusToCell` с RU+EN dictionary (Открыто/Open/Todo, В работе/In Progress/Doing, На ревью/Review, Завершено/Done). `resolveMapping(fields)` picks first-by-type (TEXT/STATUS/USER/DATE). `syncRowToAction` + `syncActionToRows` с loop-guard (diff-check «source === target → no-op»). Wired в PATCH row + PATCH action endpoints с re-emit для UI realtime. v0.93 taskFromChat auto-link ActionItem после row create если table.channelId set. Phase 4c — explicit per-field mapping config UI (current convention-based). |
| ✅ закрыто | **Eclipse_OS full visual adoption v1.1.1** (19.05) — Pavel-feedback после v1.1.0: «ну такое, давай всё же попробуем этот дизайн от гугл студио». v1.1.0 был too minimal (только vocab + violet halos без visible эффектов). Эта итерация — full adoption. **Vocab correction**: English → Russian cyberpunk во всех components (КАНАЛЫ/ЗАДАЧИ/ДАННЫЕ/ПОТОКИ ДАННЫХ/ВЕЩАНИЕ/ГОЛОСОВЫЕ СВЯЗИ/ТАКТИЧЕСКИЙ ВИД/СВЯЗАННЫЕ_УЗЛЫ/СПЯЩИЙ_РЕЖИМ/ВВОД СООБЩЕНИЯ/ПЕРЕДАТЬ/СОЗДАТЬ КОМНАТУ) — mockup был на русском, я ошибочно в v1.1.0 перевёл на английский. **Atmospheric background grid** в tokens.css: `.ec-shell::before` overlay с 60×60 cyan grid lines + radial center spotlight + bottom shadow gradient + `ec-grid-drift` 60s linear infinite (reduced-motion guard). Все shell children получают z-index: 1 чтобы быть above background. **Topbar telemetry pills** (AppShell): 3 monospace pills — СЕТЬ: СТАБИЛЬНА/ОБРЫВ (using existing isReady socket state) + ПАМ: 12% + ЦП: 04% (placeholder values). Через `.ec-telemetry-pill` class с ok/warn variants. **Server header ID hash** (ChannelList): `◆ ID_xxxxxx_SYS_xxxxxx` deterministic из serverId + serverName slices, monospace 0.62rem под server name. Server name теперь uppercase letter-spacing 0.08em fontWeight 700. **Composer status strip** (MessageInput): новая row над composer-box с `>_ ЗАЩИЩЁННЫЙ_КАНАЛ` pill (accent-soft + border-accent) + status text «ВВОД ПОТОКА…» при focus / «ОЖИДАНИЕ СИГНАЛА…» idle. **ШИФРОВАНИЕ E2E indicator** добавлен в hints row справа (glowing accent dot + uppercase). **Sticky log-entry date dividers** (MessageList): новая `formatLogEntryDay` функция выдаёт «ЗАПИСЬ_ЖУРНАЛА_19_МАЯ_2026 // СИНХР_ВРЕМЕНИ» с RU month abbreviations. Hover title shows original. Все changes — pure visual+text, ноль schema/API/logic. Files: tokens.css (+40 строк background grid), ChannelList.tsx (vocab + server header ID hash), IntelligencePanel.tsx (vocab), MemberList.tsx (vocab), MessageInput.tsx (vocab + status strip + ШИФРОВАНИЕ indicator), MessageList.tsx (formatLogEntryDay + divider rebrand), AppShell.tsx (3 telemetry pills + isReady mapping). |
| ✅ закрыто | **Eclipse_OS visual rebrand v1.1.0** (19.05) — adoption из Google AI Studio mockup'а. Pavel-feedback после v1.0.2: «мне нравится как визуально он сделал, давай применим, хочу пощупать в проде». AI Studio прислал full React+Vite+Tailwind+Motion+Lucide standalone app — incompatible stack с Eclipse Chat (vanilla CSS + tokens). Извлекли design patterns + переписали под наш stack: новые tokens (`--ec-surface-glass` rgba(11,15,20,0.45), `--ec-holo-cyan` linear-gradient base, `--ec-glow-ai` + `--ec-glow-live` multi-layer shadows; existing `--ec-accent-3` violet reused), новые utility classes (`.ec-holo-edge` 1px top-edge via ::before, `.ec-scan-line` horizontal sweep keyframe 4s infinite с reduced-motion guard, `.ec-glass-panel` frosted blur(20)+saturate(140%), `.ec-avatar-halo--ai` violet glow, `.ec-avatar-halo--live` cyan breathing 4s, `.ec-telemetry-pill` + ok/warn variants), active channel left-border заменён на holographic gradient через inset box-shadow, custom scrollbar webkit + Firefox с cyan-accent hover. **Vocabulary rebrand** (Russian UI labels → English sci-fi): sidebar tabs (CHANNELS/TASKS/DATA), section labels (DATA STREAMS/BROADCAST/VOICE LINKS), members panel (TACTICAL VIEW/LINKED_NODES/SLEEP_STATE), composer (INITIALIZE TRANSMISSION/TRANSMIT/INITIALIZE ROOM), brand (ECLIPSE_OS с letter-spacing 0.18em в topbar), bot badge (AI_AGENT вместо BOT для GENERIC). **Russian content сохраняется** — только UI labels recoded. Bot avatars wrap'аются в span.ec-avatar-halo--ai для violet glow ring через box-shadow tokens. AuthScreen multi-step redesign — deferred в v1.1.1. SW_VERSION bumped → v1.1.0. Ноль schema/API изменений, pure visual+text. Files: tokens.css (+140), ChannelList.tsx, IntelligencePanel.tsx, MemberList.tsx, AppShell.tsx, MessageInput.tsx, MessageList.tsx. |
| ✅ закрыто | **Composio AutomationRule UI editor v1.0.2** (19.05) — закрывает loop из v1.0.1 (backend был ready, UI explicitly deferred). Extends CreateRuleForm (apps/web/src/components/AdminPanel.tsx, ~1500 строк component) с 4-м action type. Type additions: `AutomationActionComposio` (type: "COMPOSIO_ACTION" + connectionId + actionName + paramsTemplate JSON-string), extended ActionKind union, AutomationAction union extended. CreateRuleForm extended с serverId prop (для useComposio hook). Hook integration: useComposio loads server's Composio connections + status, filtered to activeConnections (status === "ACTIVE"). New state: composioConnectionId / composioActions[] / composioActionName / composioParams (JSON textarea с default Gmail template). useEffect lazy-loads actions list через `/api/servers/:id/composio/connections/:id/actions` endpoint когда connection selected. useMemo composioParamsValid — JSON.parse + object-type check. canSubmit + handleSubmit dispatcher extended. UI block (~120 строк): conditional disable banners (Composio not configured / no active connections), connection picker dropdown, lazy-loaded action picker dropdown с loading state, monospace JSON textarea с realtime border-color по validity, hint с code-styled placeholders. AutomationRow display extension: actionLabel «Composio →», actionPreview — monospace actionName в accent color. Ноль schema/backend changes (backend в v1.0.1). |
| ✅ закрыто | **Composio Automation Expansion v1.0.1** (19.05) — из eclipse-library scan, Pavel-pick «делаем по максимуму». 500+ OAuth apps через Composio (https://composio.dev) proxy. Schema migration #46: новая ComposioConnection model + 3 AuditEventType значения. New file `apps/server/src/lib/composio.ts` — pure-fetch wrapper (listSupportedApps / initiateConnection / verifyConnection / disconnectConnection / executeAction / listActionsForApp), AbortController timeout 12s, ComposioError class с status code. 6 endpoints в `apps/server/src/routes/composio.ts` (status / apps / connections list / connect initiate / OAuth callback handler с auto-close HTML / disconnect / actions / manual execute). Graceful disable если COMPOSIO_API_KEY env not set — UI показывает setup instructions с callback URL. Automation engine extension (`apps/server/src/automation.ts`): новый ActionDef `COMPOSIO_ACTION` + `fireActionComposio` handler с recursive params template rendering (placeholders {{user}}/{{message}}/{{channel}} в strings deep через objects+arrays). New frontend hook `useComposio.ts` + new component `ComposioConnections.tsx` (status banner / connection list с chips / app picker overlay с search + OAuth window opener + postMessage listener для auto-reload). AdminPanel «Интеграции» tab расширен — секция Composio под IntegrationsTabContent. AES-256-GCM encryption через existing twoFactor `encryptSecret` (reuse TWOFA_ENCRYPTION_KEY pattern). Audit log: COMPOSIO_CONNECTED при successful OAuth callback, COMPOSIO_DISCONNECTED, COMPOSIO_ACTION_EXECUTED (с success / latencyMs / triggeredByAutomation metadata). Pavel-side setup ENV: COMPOSIO_API_KEY + optional COMPOSIO_BASE_URL + PUBLIC_BASE_URL (для OAuth callback). Migration 46-я additive. Ноль breaking changes. AutomationRule editor UI для COMPOSIO_ACTION — deferred в v1.0.2 (current scope: connection management). |
| ✅ закрыто | **#11 AI Controls v1.0.0** 🎉 (19.05) — major release, Eclipse Chat exits 0.x. Расширили BotsTab (apps/web/src/components/BotsTab.tsx) с full AI controls per bot: **Test panel** (новая «Тест» кнопка → inline textarea + Run + result display с provider/model/latency badges + response в monospace), **Usage panel** (новая «Стата» кнопка → inline stat-grid 24h/7d/total + top-3 channels с type icons + last API usage). Backend (apps/server/src/routes/bots.ts): **POST /api/servers/:id/bots/:botId/test** — OWNER-only, прогоняет system prompt через `chat()` provider chain с user input (max 2000 chars) и returns `{response, provider, model, latencyMs, systemPromptLength, isOverride}` без message create. **GET /api/servers/:id/bots/:botId/usage** — member-readable, aggregate из существующей Message table (db.message.count × 3 windows + groupBy channelId top-3). Audit (`recordAudit`): новые типы `BOT_PROMPT_UPDATE` / `BOT_PROMPT_RESET` / `BOT_TEST_INVOKE` в AuditEventType enum (Prisma). Migration `20260519120000_bot_ai_audit_events` — postgres `ALTER TYPE ADD VALUE IF NOT EXISTS` (idempotent, outside transaction safe). PATCH handler теперь diff-checks systemPromptOverride и emit'ит UPDATE/RESET event. SW_VERSION bumped `v0.99` → `v1.0`. Hook useBots extended с `fetchUsage` / `testBot` + new types `BotUsage` / `BotTestResult`. Per-bot busy state (perBotBusy map) — UI не блокирует whole tab при одной test-run. Idempotent migration на 45-ю позицию. Pure additive, ноль breaking. |
| ✅ закрыто | **Responsive polish pass v0.99.0** (19.05) — Pavel-ask «проверь чтобы всё было максимально оптимизовано и правильно показывалось на всех устройствах». Запущен Explore audit на recent v0.95-v0.98 changes → 12 findings (4 HIGH / 5 MED / 3 LOW). Закрыты HIGH+MED issues: **SW cache bump** (apps/web/public/sw.js): SW_VERSION с `eclipse-v0.84` → `eclipse-v0.99` — critical, users с pre-v0.95 cache получали stale chunks для всех новых components (ChatHeaderHoverButton, ChannelInfoPanel, Modal, ChannelList tabs, ServerHubModal); auto-invalidate при следующем deploy. **ChatHeaderHoverButton popover width** (apps/web/src/components/ChatHeaderHoverButton.tsx): `width: 320` → `min(320px, calc(100vw - 64px))` — гарантирует popover не уезжает за edge на ≤360px mobile. **Modal.tsx width formula** (apps/web/src/components/Modal.tsx): `min(${width}px, 100%)` → `min(${width}px, calc(100vw - 32px))` — на mobile с ServerHubModal width=620 раньше растягивался во весь экран без breathing room, теперь 16px gap с каждой стороны. **ChannelInfoPanel + ServerHubModal tab-bars**: добавлены `ec-channel-info-panel__tabs` + `ec-server-hub__tabs` class hooks + responsive.css rules `overflow-x: auto` на ≤400px / ≤600px — раньше RU labels («Оформление» и др) overflow'или на mobile. **Chat-header touch targets**: responsive.css rule `.ec-chat-header button { min-width: 38px; min-height: 38px }` на ≤640px — раньше inline 26×26 кнопки не достигали HIG min. **Chat-header overflow safety**: `.ec-chat-header .ec-chat-title { flex-shrink: 1; min-width: 0 }` + `.ec-music-mini-player { max-width: 200px }` на laptop 1025-1366 — title + description + music-player + 4 right-side buttons теперь умещаются без layout break. **ChannelInfoPanel max-height**: `@media (max-height: 500px) { max-height: min(30vh, 240px) }` — на landscape mobile panel раньше ел весь chat-area. **prefers-reduced-motion global guard** для .ec-channel-info-panel descendants — defensive против любых будущих animations не использующих var(--ec-dur-*). Pure CSS + 2 inline-style fixes, ноль logic/API/schema changes. |
| ✅ закрыто | **Chat surface cleanup v0.98.0** (19.05) — Pavel-ask «середина чата должна быть чистой, все закрепы и задачи при наведении отображались поверх экрана». Убраны 2 постоянно-видимых banner'а с топа MessageList'а: **ActionQueueBar** («Контур исполнения» с onboarding-текстом «Превращай сообщения в задачи, решения и follow-up» + SLA/digest rail + горизонтальный список карточек) и **PinnedBar** (collapsible «Закреплённые: N» strip с pinned messages). Оба ели вертикальное место даже когда пользователю нужно было просто читать ленту. Функционал переехал в **hover-buttons chat-header'а** — два compact icons рядом с (i) кнопкой: **📌** (warn-tone) для pinned messages + **✓** (exec-tone) для open tasks. Render gated count > 0 (если нет items — button скрыт). Hover → popover (320px wide, top-3 preview items с titler-line + subtitle) + «Показать все (N)» footer link. Click на icon ИЛИ на item ИЛИ на «Показать все» → opens ChannelInfoPanel на соответствующем tab (memory / execution). Новый generic компонент `ChatHeaderHoverButton<T>` с props: icon / label / count / items / renderItem / itemKey / onOpenFull / accent. Mouse-leave с задержкой 160ms чтобы popover не пропадал при движении мышки. ESC/focus blur через onBlur. Удалены: apps/web/src/components/ActionQueueBar.tsx (~530 строк), apps/web/src/components/PinnedBar.tsx (~150 строк). Уделен `updateActionItem` destructure из useMessages (был для ActionQueueBar onUpdateAction prop). Chat-area теперь: chat-header (с brand/title/music/hover-buttons/settings) → MessageList → composer. Никаких banner'ов. |
| ✅ закрыто | **UX refactor Part 2 v0.97.0** (19.05) — Pavel-feedback 19.05 со скриншотами «надо сделать отдельную кнопку создания канала + лучше экран редактирования сервера». Два направления. (1) **CreateChannelModal** (новый: apps/web/src/components/CreateChannelModal.tsx) — заменил inline-composer внизу sidebar (4 type-buttons + input + send). Теперь: большая кнопка «+ Новая комната» сверху Channels tab + «+» icon buttons в section-headers (Текстовые / Каналы / Голосовые) с pre-selected `initialType` через `openCreateModal(type)`. Modal содержит: type selector (4 cards с icons + descriptions: TEXT / BROADCAST / VOICE / EXECUTION) + name input (1-80 chars validation) + auto-focus on open. Empty-state канала тоже использует modal trigger. ChannelList'у удалены ~80 строк inline composer JSX + styles (typeToggle/typeBtn) + draft/draftType/submitting state. (2) **ServerHubModal** (новый: apps/web/src/components/ServerHubModal.tsx) — объединил старые ServerInfoModal (read-only обзор) + ServerSettingsModal (edit form) в один tabbed модал. 4 вкладки: **Обзор** (icon edit + name + role + stats + structured description + invite codes + compact member list), **Оформление** (banner + brand color picker, OWNER-only), **Настройки** (name + mode toggle + description + welcome message, OWNER-only), **Боты** (BotsTab, OWNER+ADMIN). Collapsible footer «Опасная зона» с leave/delete (соответствующая role). `initialTab` prop позволяет открыть сразу на нужной вкладке (settings-icon в chat-header → tab="settings"). AppShell wiring: `showServerInfo` + `showServerSettings` state объединены в `serverHubOpen` + `serverHubTab`. Удалены: apps/web/src/components/ServerInfoModal.tsx (~490 строк), apps/web/src/components/ServerSettingsModal.tsx (~610 строк). Полная миграция функционала, ноль regression в API/handlers. |
| ✅ закрыто | **UX refactor v0.96.0** (19.05) — Pavel-feedback со скриншотами «справа должны быть только участники, в sidebar слишком много всего, надо вкладки». Major surgery 3-направлений. (1) **IntelligencePanel → MembersPanel** (apps/web/src/components/IntelligencePanel.tsx fully rewritten): убраны 5 tabs (Сводка/Память/Дела/Файлы/Люди) + VoiceIntelligence sub-component. Остался clean MemberList с header «Участники · {online}/{total}» + collapse/close buttons. MemoryView / ExecutionView / FilesView экспортированы для переиспользования. (2) **Sidebar tabs в ChannelList** (apps/web/src/components/ChannelList.tsx): 3 таба сверху — Каналы (TEXT/BROADCAST/VOICE + create-form), Работа (Доска задач / Здоровье команды / Client Portal entries), Таблицы (list + create-table button). Persisted per-server в localStorage (key `ec:sidebar-tab:<serverId>`). (3) **ChannelInfoPanel — новый компонент** (apps/web/src/components/ChannelInfoPanel.tsx): открывается (i)-кнопкой в chat-header'е. Flex-child (не overlay) занимает верх chat-area до 48vh, 4 inner tabs (Сводка/Память/Дела/Файлы). Auto-close при смене канала. ESC закрывает. AppShell wiring: serverId prop в ChannelList, intel-props убраны из IntelligencePanel call, передаются в ChannelInfoPanel call. CLIENT-mode унифицирован (same UX, без special path для intel-блока — execution/files скрыты как раньше). Pure UX changes, ноль logic/API/DB изменений. |
| ✅ закрыто | **UI density pass v0.95.0 Phase 1** (19.05) — Pavel-feedback «не весь функционал виден на экране, всё урезано». Системный density-fix вместо очередного hotfix. **IntelligencePanel labels** (responsive.css:504-520): старое правило `display: none` GLOBALLY на `.ec-shell__members .ec-intel-tab__label` прятало labels даже на full-desktop ≥1367 (members rail 272px) — где они физически помещались. Новая логика: labels visible по умолчанию (включая full-desktop + mobile drawer + tablet drawer); на tight laptop 1025-1366 (rail 224px) показываем label только для active tab — остальные icon-only с title tooltip + horizontal scroll fallback. **HomeToday stat grid** (HomeToday.tsx:55-66): `repeat(auto-fit, minmax(150px, 1fr))` → `minmax(132px, 1fr)`. +1-2 cards per row на 1080-1280px chat area, убирает awkward 2-row layout для 7 карточек (Задачи / Просрочено / Инциденты / Голос / Одобрения / Активные комнаты / AI-алерты). Mobile breakpoints 760→2col / 520→1col сохраняются. **ClientPortal sections** (ClientPortalPage.tsx:234-241): same fix `minmax(160px)` → `minmax(140px)`. Pure CSS+layout changes, ноль logic. Phase 2 (v0.96) — Tables + AdminPanel + Drawer responsive. Phase 3 (v0.97) — touch fallbacks + RU UPPERCASE word-break systematic. |
| **#1 next** | **#23 phase 1b Yjs CRDT upgrade** | S-M | M | true concurrent editing (когда npm registry даст yjs) |
| После | **#26 phase 2b** Telegram incoming + Notion sync | M-L | M | завершение integrations |
| После | **#5 phase 3 AI agent backgrounds** | M-L | H | proactive PM daily / MODERATOR scan / KNOWLEDGE indexer |
| После | **#10 phase 4c explicit field mapping UI** | S-M | M | beyond convention-based sync (multi-status workflows, custom fields) |

## 📋 Открытые follow-ups

- libheif на проде для iPhone HEIC (`apt install libheif1 libheif-dev`)
- ✅ **Backup cron** — закрыто в v0.63.0. `deploy/scripts/backup-db.sh`
  + `deploy/cron.d/eclipse-chat-backup` в репо. Install one-time:
  `sudo cp deploy/cron.d/eclipse-chat-backup /etc/cron.d/` + `sudo chmod
  644 /etc/cron.d/eclipse-chat-backup`. Manual test: `sudo /var/www/
  eclipse-chat/deploy/scripts/backup-db.sh`.
- Telegram bridge bot template (отдельный repo)
- Integration tests (Vitest + Supertest + ephemeral PG)
- i18n EN translation
- PTT + «Студийный» edge case (enhancer слетает после PTT-цикла)
- Cross-channel files aggregator (для KNOWLEDGE-секции Context Tree)
- Approvals + blockers (для EXECUTION-секции Context Tree)
- **Voice multi-publisher e2e + LiveKit quota tuning** — UI tile-budget
  + diagnostics закрыты в v0.56.0. Остаётся formal load-test с 6+
  одновременных camera+screen publishers (нет инструмента в session).
- ✅ **Uploads: Office + архивы + MIME-sniffing + bigger video cap** —
  закрыто в v0.51.0 (engineering queue #12). См. timeline / changelog.
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
