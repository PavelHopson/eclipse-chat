# Eclipse Chat — Discord parity roadmap

> **Источник:** 6 screenshots Pavel'я Discord client + custom statuses,
> 28.05.2026. Цель — закрыть structural gap между Eclipse Chat и Discord
> для operational chat use case, **не теряя** Eclipse-specific фичи
> (operational tables, action items, AI memory, banner identity, violet+gold).
>
> **Статус-легенда:**
> - 📋 **Planned** — в очереди
> - 🟡 **In Progress** — версия идёт
> - ✅ **Done** — задеплоено (с EC версией)
> - ⛔ **Skip** — irrelevant для self-hosted operational chat
>
> **Effort scale:**
> - **S** = 1 версия (~1-3 часа frontend / 2-4 backend)
> - **M** = 2-3 версии (UI refactor / новый schema поле)
> - **L** = 4-8 версий (новая модель + backend routes + frontend)
>
> **Priority tiers (моя рекомендация, Pavel может пересортировать):**
> - 🔥 **MUST** — фундаментальный gap, без него operational chat не дотягивает
> - ⭐ **HIGH** — заметный improvement, окупает effort
> - 🟢 **MED** — polish, делать после MUST/HIGH
> - 🟡 **LATER** — большой scope или edge use case

---

## A. DM / Друзья layer (Screenshot #1)

> Фундамент которого у EC сейчас нет. DM открывается с любым member любого
> общего сервера, но нет friendship model + custom statuses + tabs.

| # | Feature | EC сейчас | Gap | Effort | Priority | Статус |
|---|---|---|---|---|---|---|
| A1 | **Friends model** (запрос → принять → друг) | DM можно открыть с любым server-member | `Friendship` schema (userA, userB, status: PENDING/ACCEPTED/BLOCKED) + 4 API routes + UI | L | 🔥 MUST | 🟡 slice 1 backend ✅ v1.5.42; slice 2 frontend foundation ✅ v1.5.43; slice 3 polish → v1.5.44 |
| A2 | **Tabs: Друзья / В сети / Все / Ожидание / Добавить** | DM list плоский | Tabbed view над DM list, фильтрация по A1 status | S (после A1) | 🔥 MUST | ✅ v1.5.44 |
| A3 | **Custom user status** «Играет в Rocket League +1», «The Sims 4 как смысл жизни» | Только presence dot (ONLINE/IDLE/DND/INVISIBLE) | `User.activityText` (до 128) + `activityEmoji` (1) + UI в StatusMenu | M | 🔥 MUST | ✅ v1.5.45 |
| A4 | **Activity hint в DM list row** под именем | Только displayName | Render A3 поле под именем | S (после A3) | 🔥 MUST | ✅ v1.5.45 (de-facto closed by A3 frontend) |
| A5 | **Top-level «Найти или начать беседу»** search bar | Search в server scope only | Global cross-server message + user + DM search overlay | M | 🟡 LATER | 📋 |
| A6 | **Right rail «Активные контакты»** — voice room peeks + screen share thumbs + group DM activity | `VoiceMiniBar` (1 строка) + IntelligencePanel members | New `ActivityRail`: voice rooms summary с avatar stacks + DM-group preview + (опц.) game activity. **БЕЗ** screen-share thumbnails = **M**; **С** thumbnails = **L** | M / L | ⭐ HIGH partial / 🟡 LATER full | 📋 |

---

## B. Settings UX (Screenshots #2-3)

> Категоризированное дерево вместо плоского ProfileModal.

| # | Feature | EC сейчас | Gap | Effort | Priority | Статус |
|---|---|---|---|---|---|---|
| B1 | **Settings панель с tree nav слева + main panel** | `ProfileModal` flat scrollable | Restructure → `SettingsPanel` с категориями: Учётная запись / Контент и общение / Данные / Интеграции / Уведомления / Голос и видео / Внешний вид / Горячие клавиши / Активность / Разработчик / Выйти | M | ⭐ HIGH | 🟡 slice 1 ✅ v1.5.51; slice 2 ✅ v1.5.53 (sessions + hotkeys) |
| B2 | **Активные сеансы** (5 устройств, по device) | `RefreshToken` table есть, UI нет | Expose `/api/auth/sessions` GET + revoke per session | S | 🟢 MED | ✅ v1.5.53 |
| B3 | **Внешний вид tab** — theme / density / scale settings | Density / Focus dim есть в ProfileModal | Move в B1 категорию «Внешний вид» + theme switcher (есть `ThemeToggle`) | S (в B1) | 🟢 MED | ✅ v1.5.51 |
| B4 | **Горячие клавиши** dedicated tab с list+rebind | Нет UI hotkeys overview | New tab с rendering shortcuts overview (read-only OK для v1; rebind = **L**) | S read-only / L rebind | 🟢 MED read-only / 🟡 LATER rebind | ✅ v1.5.53 read-only; rebind later |
| B5 | **Уведомления** category — push toggle + per-type + quiet hours | `usePushPreferences` есть, в ProfileModal | Move в B1 category + добавить quiet hours (схема `User.quietFrom`/`quietTo`) | S move / M quiet hours | 🟢 MED | ✅ v1.5.51 |

---

## C. Server view structure (Screenshot #4)

| # | Feature | EC сейчас | Gap | Effort | Priority | Статус |
|---|---|---|---|---|---|---|
| C1 | **Channel categories** «Underground», «Clubhouse» collapsable groups с hover-+ | Channels flat list под сервером | New `ChannelCategory` schema (id, name, serverId, position) + `Channel.categoryId` FK + ChannelList grouping UI | M | 🔥 MUST | ✅ v1.5.46 |
| C2 | **Server name = dropdown trigger** с ⌄ → context menu | Click открывает `ServerHubModal` | Convert header в popover trigger; ServerHubModal остаётся для full settings | M | ⭐ HIGH | ✅ v1.5.47 |
| C3 | **Server nav links**: Путеводитель / Мероприятия / Каналы и роли / Участники / Бусты | Только Members в IntelligencePanel | Add nav: «Путеводитель» = welcome screen (есть v1.5.34); «Мероприятия» = C8 events; «Каналы и роли» = combined permissions view (partial AdminPanel); «Участники» = MemberList. **Бусты** ⛔ irrelevant | M integration | ⭐ HIGH | ✅ v1.5.49 |
| C4 | **Hover invite + gear** на channel row (desktop) | `data-channel-action` hidden на mobile, есть desktop | Verify desktop visibility + add invite-to-channel button | S | 🟢 MED | ✅ v1.5.57 |
| C5 | **Composer GIF picker** (Tenor / GIPHY) | Emoji picker есть, GIF нет | Add Tenor proxy (или self-hosted GIF library) + picker tab | L | 🟡 LATER | 📋 |
| C6 | **«Показать все каналы» / «Скрыть заглушённые»** checkboxes | `MutedChannel` table, no auto-hide UI option | Server-level toggle в context menu (D1) + filter в ChannelList | S | 🟢 MED | ✅ v1.5.57 |
| C7 | **Welcome bot messages** «Добро пожаловать @user!» при join | Возможно через AutomationRule manual, no template | New `WelcomeMessage` schema per-server + auto-post on `member:joined` | S | ⭐ HIGH | ✅ v1.5.48 (использует existing `server.welcomeMessage`, без new schema; auto-post в first TEXT channel) |
| C8 | **Server Events** (Мероприятия) | Нет | New `Event` schema (title, startsAt, channelId?, RSVP) + UI list + reminder cron | L | 🟡 LATER | 📋 |

---

## D. Server context menu (Screenshot #5)

| # | Feature | EC сейчас | Gap | Effort | Priority | Статус |
|---|---|---|---|---|---|---|
| D1 | **Inline dropdown popover** с 14 actions | `ServerHubModal` modal trigger | Build popover (используя existing `.ec-popover` pattern) с pruned action list: Settings / Invite / Notifications / Create channel/category/event / Copy ID / Изоляция (incident) / Leave server | M | 🔥 MUST (after C2) | ✅ v1.5.47 |
| D2 | **Копировать ID сервера** | Нет ID exposure | One-line utility | S (part of D1) | 🟢 MED | ✅ v1.5.47 (de-facto closed by D1 action) |
| D3 | **Изоляция / Жалоба на рейд** — emergency moderation | Incidents есть | Map «Изоляция» → close-all-DM-invites + freeze new joins для сервера; «Жалоба на рейд» → создать Incident + alert OWNER | M | 🟢 MED | ✅ v1.5.56 (lock backend v1.5.54 + E1 settings entry v1.5.55 + D1 popover toggle + header badge v1.5.56); «Жалоба на рейд» отдельный slice 4+ |

---

## E. Server settings (Screenshot #6)

| # | Feature | EC сейчас | Gap | Effort | Priority | Статус |
|---|---|---|---|---|---|---|
| E1 | **Settings tree nav** (12+ categories) | `ServerHubModal` 4 tabs (Обзор/Оформление/Настройки/Боты) | Expand до tree nav с grouped sections: РЕАКЦИИ / ЛЮДИ / ПРИЛОЖЕНИЯ / МОДЕРАЦИЯ / СООБЩЕСТВО. **Стикеры/Звук** ⛔. **Бонусы буста** ⛔ | M | ⭐ HIGH | ✅ v1.5.55 |
| E2 | **Banner gradient presets** (10 swatches) рядом с custom upload | Только custom upload (`server.banner`) | UI: 10 preset gradient swatches как fallback для серверов без image | S | 🟢 MED | 📋 |
| E3 | **Server features chips** «Никаких предателей» / «Жесткие правила» / «Решай задачи» / «Только члены» / «Анализ сезона» | Нет | New `server.features` JSON array (max 5) + UI chip editor + display в WelcomeHero | S | 🟢 MED | 🟡 backend ✅ v1.5.58 (schema + PATCH identity features + DTO); chip editor + WelcomeHero render ожидает Codex slice |
| E4 | **Preview card** справа от settings | WelcomeHero (v1.5.34) только в no-channel state | Mount mini preview в right column ServerHub settings tab — reuse component | S | 🟢 MED | ✅ v1.5.57 |
| E5 | **Audit log tab** | `AuditLog` schema + audit-events tracking есть | UI table с filter (type / user / date range) | M | 🟡 LATER | ✅ v1.5.59 |
| E6 | **Custom emoji tab** | `Emoji` schema + `AdminEmojisTab` уже есть | Verify exposed в правильной E1 категории | S (moved) | 🟢 MED | ✅ v1.5.55 |

---

## F. ⛔ Skip — irrelevant для self-hosted operational chat

| Feature | Reason |
|---|---|
| Nitro / Магазин / Boost tiers | Paid features (self-hosted free) |
| Семейный центр | Child account management — не наш use case |
| Игровой оверлей | Steam/games overlay — не operational |
| Стикеры / Звуковая панель | Discord-specific media — не приоритет |
| Discord Rich Presence integration | Third-party game SDK |
| Репутация учётной записи | Discord trust system — irrelevant |

---

## Effort budget summary

| Tier | Items | Estimate (версий) |
|---|---|---|
| 🔥 **MUST** | A1, A2, A3, A4, C1, C2 (после C2 → D1) | ~12-14 версий |
| ⭐ **HIGH** | A6 partial, B1, C3, C7, E1 | ~8-10 версий |
| 🟢 **MED** | B2-B5, C4, C6, D2-D3, E2-E4, E6 | ~10-12 версий (parallel possible) |
| 🟡 **LATER** | A5, A6 full, B4 rebind, C5, C8, E5 | ~10-15 версий |
| **Total если всё** | 28 items | **~40-50 версий** EC chain |

**Реалистичный план**: MUST + HIGH = closer to Discord parity для **operational use case**, ~20-24 версии (6-8 weeks при текущем темпе).

---

## Что EC сейчас уже имеет что Discord НЕ имеет (не теряем при rebuild)

- ✅ **Operational layer** — ActionItems / Status Board / Team Health / Operational Tables / Incidents / Bot personas / Tasks per-channel-execution mode
- ✅ **AI integration** — Composio (500+ apps), multi-model providers, Anthropic skills, AI memory с semantic search, AI Card Audit (StarMarket)
- ✅ **Banner identity 4 points** (v1.5.33-36) — rail header / welcome hero / msg scroll-to-top / switcher dropdown
- ✅ **Premium violet+gold aesthetic** (banners trek, hover micro-interactions, multi-shadow violet undertone)
- ✅ **Message edit history** (v1.5.24-25) — Discord не показывает previous content snapshots
- ✅ **Custom bot personalities** (v1.2.27) — Pavel может назвать бота «Алёша» с tone, не doable в Discord без webhook hacks
- ✅ **Voice room polish** — premium hybrid atmospheric design, music session shared, voice note Yjs
- ✅ **Operational Tables** — Airtable-style в чате (Discord нет)
- ✅ **Eclipse Forge brand** — coherent multi-app (Chat / Hub / Hopson Sentinel / Media / Shotforge / Text2Image / DnD Forge / Cryptopulse)

---

## Next steps

### 31.05.2026 — IA reset вместо дальнейшего наращивания chrome

Pavel verdict по screenshots: текущий UI перегружен, глаза разбегаются,
пользователь не понимает главный сценарий. Discord-parity дальше идёт не через
добавление новых пунктов, а через **пересборку информационной архитектуры**.

Keep в постоянном UI: часы, профиль, выход, выбор темы, медиаплеер. Метрики и
графики остаются как operational layer, но не как постоянные topbar widgets.

RAM/CPU/NET: убрать из глобального topbar. Перенести в voice context
(`VoiceRoom` / diagnostics / expanded voice view), где они объясняют качество
связи и нагрузку, а не конкурируют с навигацией.

Parallel slices:

| Slice | Owner | Scope | File overlap guard |
|---|---|---|---|
| UXR1 Global chrome cleanup | Codex | topbar declutter; keep clock/profile/theme/logout/player; remove global RAM/CPU/NET | `AppShell.tsx`, chrome CSS |
| UXR2 Voice telemetry relocation | Claude | RAM/CPU/NET into voice room/diagnostics; honest unavailable states | `VoiceRoom*`, voice hooks/CSS |
| UXR3 DM home as messenger | Codex | first screen = friends/DM/search/active contacts, dashboard separate | DM/Friends/Home components |
| UXR4 Server chat cleanup | Claude | remove persistent server nav rail from channel chat mode; guide/settings stay separate | server view state/header |
| UXR5 Server popover density | Codex | compact grouped Discord-like `ServerActionsMenu` | ✅ v1.5.63 |
| UXR6 Settings shell normalization | Codex | denser Profile/Server settings windows, less decorative chrome | ✅ v1.5.62 slice 1 |

**Статус (01.06.2026):** **UXR1 + UXR2 + UXR4 → ✅ v1.5.60** (атомарный
ship: телеметрия убрана из topbar и перенесена в voice diagnostics + server nav
rail убран из chat mode). UXR3 (DM home) → ✅ v1.5.61. UXR5 popover density →
✅ v1.5.63: compact grouped menu вместо плоского action list. UXR6 settings
normalization → ✅ v1.5.62 slice 1.
Глубокая «плотная форма» topbar (сверх удаления RAM/CPU/NET) отложена до
визуального ревью — локальный browser-smoke невозможен (нет node_modules).

Original sequence:
1. **Pavel sortирует** этот список — apply кастомный priority order или подтверждает мой (MUST → HIGH → MED → LATER)
2. **Я начинаю chain** с топ-1 пункта, делаю slice-by-slice в формате EC v1.5.X (как chain v1.5.33-41)
3. **Этот документ обновляется** — статусы 📋 → 🟡 → ✅ с EC version номером после каждого ship'а
4. **Phase B Tauri desktop** continues parallel или после MUST — Pavel decides

**Источник скриншотов:** Telegram-чат Pavel ↔ assistant, 28.05.2026, 6 screenshots
**Created:** v1.5.41 era (after Discord audit pause)
**Last updated:** 31.05.2026
