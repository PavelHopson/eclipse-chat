# Eclipse Chat — handoff для нового чата

> Обновлено **2026-05-23, после v1.2.14 + 398e81e (branding refresh)**.
> Прошлая сессия — 10 версий (v1.2.5 → v1.2.14) + два Pavel'ёвых
> commit'а (v1.2.10 deleted-cleanup/channel-icons/auth-gateway,
> 398e81e branding refresh). Скопируй блок ниже в новый чат.

---

Привет. Я Pavel Hopson. Eclipse Chat — продолжаем из нового чата.

## Старт

Прочитай `E:\projects\eclipse-chat\ROADMAP.md` (синхронен по v1.2.14 —
header + version-log). `CLAUDE.md` подтянет Agents/Context/Memory/
Skills.md автоматически. Source of truth по дизайну — `docs/design/
design-brief-v2.md` + `surface-map.md`. Подтверди состояние
(`/api/version` + `/api/health`), затем спроси, что брать.

## Текущее состояние

**Прод (LIVE):** **v1.2.10** — https://app.star-crm.ru/eclipse-chat/
(содержит весь R-трек до v1.2.0 включительно + slice 7 ⚠️ нет, см.
ниже — slice 7 на гейте).

**master HEAD = `398e81e` (Pavel'я branding refresh) поверх `6db75ac`
= v1.2.14 (slash-команды).** Локально и на GitHub совпадает.

⚠️ **5 версий на approve-gate, ждут апрува** (environment
`production`): v1.2.11 / v1.2.12 / v1.2.13 / v1.2.14 / 398e81e.
В проде задеплоено только v1.2.10. Апрув катит всё разом.

Команда апрува — в `Agents.md` → Deploy. Pavel жмёт Approve на
последнем «Deploy PROD»-ране (`398e81e`); он деплоит весь batch.

## Сделано за прошлую сессию (v1.2.5 → v1.2.14 + 398e81e)

- **v1.2.5** — slice 7: **CSS-консолидация (3 файла)**. Дубль-блоки
  `.ec-shell*` и `.ec-channel-item*` (Region A + B в components.css)
  слиты в одну канон-секцию «Shell — поверхности»; `!important`-война
  снята полностью (components / responsive / effects). Один видимый
  эффект: мобильный drawer каналов/участников получил свою
  drawer-тень из responsive.css (latent-баг войны fixed). brief slice
  7 → ✅.
- **v1.2.6** — **трек P1: Platform Admin (Users-only MVP)**. Новая
  иерархия за пределами per-server ролей. Schema: `User.isPlatformOwner`
  / `bannedAt` / `bannedReason` / `bannedByUserId` + audit-events
  `PLATFORM_USER_BANNED/UNBANNED/PASSWORD_RESET`. Endpoints `/api/
  platform/users/*` (list / ban / unban / reset-password). Login-gate
  + WS-gate + `requirePlatformOwner` middleware. Frontend
  `PlatformAdminPanel` Modal с табой Users + temp-pw show-once modal.
  Иконка в топбаре только при `currentUser.isPlatformOwner`.
- **v1.2.7** — **трек P2: расширение Platform Admin**. Server
  suspend (schema `Server.suspendedAt`), soft-delete user (schema
  `User.deletedAt`), Servers tab, Audit-view tab. `lib/serverGating.ts`
  → `assertServerActive` + suspend-gating 4 critical writes
  (POST message / POST channel / PATCH identity / POST action).
- **v1.2.8** — **трек P3: polish Platform Admin**. Pagination footer,
  search-debounce 300ms, row-click → details modals (per-user /
  per-server со списком owned servers, role-breakdown, audit-trail).
  Suspend-gating расширен (DELETE channel / PATCH channel / PATCH
  member role).
- **v1.2.9** — **удалённые сообщения убраны из истории чата**.
  Soft-delete в БД остаётся (audit/recovery), но в API/UI не показываются:
  `deletedAt: null` в where у GET endpoints (channels / threads / dm /
  pinned), realtime `message:deleted` теперь filter'ит из state.
- **v1.2.10** — **(Pavel'ёв commit)** "deleted message cleanup,
  channel icons, auth gateway". Развёрнут на проде. Кастомные иконки
  каналов + biometric auth-gateway + дополнения к delete cleanup.
- **v1.2.11** — **slice 6a: AdminPanel inline-долг очищен**. 10
  module-level `CSSProperties` консолей (wrap/headerRow/eyebrow/
  titleStyle/tabBar/tabBtn/card/cardLabel/cardValue/row) + inputStyle
  → `.ec-admin-*` классы. ~50 ссылок мигрированы. JS-hover не было.
- **v1.2.12** — **slice 6b: BotsTab inline-долг + JS-hover ЗАКРЫТ**.
  6 module-level CSSProperties → `.ec-bots-*`. JS-hover на `.ec-bot-card`
  (мутирующий e.currentTarget.style) убран — CSS `:hover` в cockpit.css.
  Parametric helpers (roleAvatarStyle/roleChipStyle) оставлены inline
  (legitimately dynamic per `BOT_ROLE_COLORS[role]`). **Brief-slice 6
  → ✅ полностью** (6a+6b закрыт).
- **v1.2.13** — **audio-реактивный плеер** (R-трек продолжение).
  Hook `useMusicAnalyser` (singleton AudioContext + AnalyserNode +
  WeakMap по `<audio>`). MiniPlayer на play-button onClick →
  `attachAnalyser` + `context.resume()` (user-gesture). Expand-modal
  RAF-loop читает `getByteFrequencyData()` (fftSize=128 → 64 bin'а
  ровно как баров), sqrt-curve нормализация компенсирует низко-частот
  dominance. `displayPeaks = livePeaks ?? staticPeaks` — на pause /
  reduced-motion / без AudioContext'а revertится на статичные peaks.
- **v1.2.14** — **slash-команды backend MVP**: `/me` `/shrug`
  `/tableflip` `/unflip` (transform) + `/help` (ephemeral). Registry
  + парсер в `lib/slashCommands.ts` (regex `^/(\w+)(?:\s+(.+))?$` —
  строгий, `/path/to/file` не матчится). Frontend: `useMessages`
  ловит `{ ephemeral: { content } }` в response, удаляет
  optimistic-row, рисует `.ec-ephemeral-banner` в конце MessageList
  («только вы видите», auto-clear 15с, dismiss).
- **398e81e** — **(Pavel'ёв commit, без bump версии)** "Refresh
  Eclipse branding and auth hit areas". Branding-WIP с tokens.css /
  motion.css / index.html / manifest / AuthPage / useNotifications +
  новые asset'ы (brand-mark.svg/png, app-icon.svg, og-image-brand.svg,
  apple-touch-icon.png, favicon-32.png, icon-192.png, icon-512.png).

Принцип сессии: design-system engineer, не patch-machine. Каждый
слайс — сборка зелёная (tsc + vite), коммит (мой через
`.commit-message.tmp`, `git add` explicit paths), push.

## ⚠️ Главный риск — за тобой, Pavel

**5 версий на гейте — большой накопленный фронт-визуальный передел
(slice 6a/6b AdminPanel/BotsTab cockpit-grammar + audio-реактивный
плеер + slash-команды UI + branding refresh)** + R-трек до v1.2.0
давно в проде, но плеер до и после audio-реактива выглядят ОЧЕНЬ
по-разному.

Сильно рекомендую: апрувнуть гейт и пройтись глазами по проду —
- **AdminPanel** (открой настройки сервера → Admin) — все 9 табов
  должны выглядеть как раньше (миграция cockpit-классов, computed-
  values должны быть identical).
- **BotsTab** (Admin → «Боты») — hover на bot-row должен поднимать
  surface через CSS (а не мутировать .style).
- **Audio-реактив**: открой music-сессию, play, разверни expand-
  player — 64 бара должны пульсировать в такт реальному аудио.
- **Slash-команды**: набери `/help` в любом канале — должен показаться
  банер «только вы видите» с listing команд. `/shrug` → `¯\\_(ツ)_/¯`
  appended в посланном сообщении.
- **Pavel'ёв branding** в 398e81e — новый brand-mark в топбаре,
  manifest icons.
- Обе темы VOID/SOLAR — slice 6a/6b SOLAR-совместимы через токены.

Агент рендер не видит; визуальная верификация — за тобой.

## Pavel'ёв WIP / stash

- `git stash list` показывает **`stash@{0}: pavel-sw-icons-wip`** —
  устаревший (sw.js icon-list уже в master через v1.2.11 и Pavel'ёв
  v1.2.10 / 398e81e). Можно `git stash drop stash@{0}`.
- За сессию агент **трижды** случайно подцепил Pavel'ёв uncommitted
  WIP через Edit-pattern (useAuth.ts в v1.2.6 → fix-revert; sw.js
  icons в v1.2.11; AppShell.tsx branding в v1.2.14). Урок для нового
  агента: при работе с файлом где Pavel имеет uncommitted changes
  использовать `git stash push <file>` **затем** `git checkout HEAD -- <file>`
  для подтверждения baseline-state перед Edit. `git stash pop`
  под конец восстанавливает Pavel'ёв WIP — но проверять что
  действительно applied (если pop без conflict → drop успешен;
  с conflict → manual merge). В v1.2.14 stash-pattern не сработал
  и Pavel'ёва branding ушла в мой commit — Pavel заметил overlap и
  выкатил оставшееся в 398e81e.

## Открытые направления

- **Custom emoji** — давний open. Per-server эмодзи, upload (image →
  sharp resize), unique `:shortcode:`, autocomplete в композере, в
  reactions. Schema (Emoji table) + endpoint + picker UI.
- **Sci-fi-копирайт sweep** — давний открытый хвост. Пройтись по
  ALL-CAPS телеметрии / sci-fi-лейблам, привести к спокойному
  русскому. Brief §3.6.
- **Slash-команды расширение** — /poll, /remind, /code, /shrug-with-
  args... + autocomplete UI в композере с registry-listing.
- **Audio-реактив perf** — currently setState 60 FPS заставляет
  MusicExpandModal делать full re-render. Если jank — переделать
  на ref-based DOM mutation для bars-SVG.
- **Thread-root edge** — deleted root через прямой link всё ещё
  рендерит tombstone в ThreadPanel (out-of-scope v1.2.9). Niche fix.
- **Pagination jump-to-page** в Platform Admin — UI принимает только
  offset/limit, без skip-N кнопок.
- **Per-user/server actions в details-view** — сейчас детали
  read-only; action-buttons (Ban / Reset) только из row table.
- **Реальный E2E tests** — давний хвост.

Brief-slice'ы 1–7 все ✅. Trek R ✅. Trek P (P1+P2+P3) ✅. Brief
slice 6 ✅ (через trek R2 + 6a + 6b).
