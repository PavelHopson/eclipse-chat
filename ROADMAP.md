# Eclipse Chat — Roadmap

> **Источник истины** по Eclipse Chat: позиционирование, текущее состояние,
> фазы, версии в проде, открытые направления. Стоит отдельно от
> `E:\projects\ROADMAP.md` (общий cross-repo лог Pavel'ового монорепо).
> Любая фича, которой нет в текущем коде, попадает сюда.

## Research intake — 2026-07-01

Источник: [Eclipse Library · July 2026 project integration](https://library.eclipse-forge.ru/#guide/july-2026-project-integration).
Это стратегические references, **не реализованный функционал**.

### AI memory / operator layer

- [ ] **OpenHuman reference** — спроектировать `AI Memory` слой: room memory, project memory, "since you were away", semantic search по решениям/файлам/задачам, audit trail и удаление памяти.
- [ ] **SimpleX Chat reference** — privacy-модель для ephemeral/private rooms: одноразовые invite links/QR, минимизация метаданных, режимы client/private channel.
- [ ] **OpenClaw Mobile reference** — mobile operator control: агент предлагает действие, пользователь подтверждает с телефона; camera/location/voice только через явные permissions.

### AI routing / agent readiness

- [x] **OmniRoute reference** — phase 1 shipped in `v1.7.1`: env-gated OpenAI-compatible provider in `apps/server/src/ai/provider.ts` with `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`, `OMNIROUTE_MODEL(S)`. Next: expose provider health/cost/latency in admin diagnostics.
- [ ] **Cloudflare Agent Ready** — прогонять public landing/download/docs на AI Search, Web Bot Auth, MCP, bot-readable docs и рекомендации для agent discoverability.

### Operational workspace UX

- [ ] **TREK reference** — client/project rooms как workspace вокруг процесса: планы, опросы, shared checklist, budget/table layer, route-like progress и lightweight журнала проекта.

### Reports / reproducible artifacts

- [ ] **PPT Master reference** — project/client recap → editable PPTX: решения, задачи, deliverables, графики и speaker notes без image-only слайдов.
- [ ] **Claude Science reference** — execution rooms должны хранить результат вместе с кодом, окружением, источниками и conversation history, чтобы артефакт можно было проверить спустя месяцы.

## Implementation bridge — 2026-07-05

- [x] **v1.7.1 OmniRoute provider slice** — добавлен отдельный provider-router слой поверх существующего AI chain: `Ollama → OmniRoute → direct cloud providers → OpenAI → Pollinations`. Включается только через env, поэтому прод-поведение без `.env` не меняется.
- [x] **AI setup docs refreshed** — `docs/AI-SETUP.md` теперь отражает текущую цепочку провайдеров, Pollinations fallback и безопасный способ подключать OmniRoute.
- [x] **v1.7.2 AI provider diagnostics** — Platform Admin → AI tab показывает санитизированный список активных провайдеров: priority, type, host, auth-state, models. API keys, prompts и user content не раскрываются.
- [x] **v1.7.3 OpenHuman-inspired memory foundation** — добавлены `MemoryEntry` + migration, REST API `/api/channels/:id/memory`, мягкое архивирование записей, UI во вкладке "Память": заметки, решения, риски, факты, ссылки, действия, теги и pinned anchors.
- [ ] **Next P0: AI memory extraction + digest integration** — действие "save to memory" из сообщения/action item, AI-предложения памяти, memory delta в "since you were away", поиск по памяти.

### Voice stability hotfix — 2026-07-17

- [x] LiveKit participant identity is now per-connection (`userId:uuid`) while app `userId` lives in participant metadata. This prevents duplicate-account/device joins from kicking the previous LiveKit participant.
- [x] Client maps LiveKit metadata back to app users for avatars, volume/mute settings, video tiles and sidebar presence.
- [x] Socket `voice:join` is emitted only after successful `Room.connect()`, and `RoomEvent.Disconnected` clears local state + emits `voice:leave` to avoid ghost occupants.

### Command Center UX slice — 2026-07-17

- [x] Server guide now acts as a compact Command Center: one obvious next action, live voice rooms, unread rooms, work counters, members entry and search entry.
- [x] The guide uses existing server signals (`unread`, `voiceByChannel`, members and ActionItems) without adding new backend surfaces.
- [x] Responsive/premium styling stays inside the existing clean UI system and supports reduced-motion users.

### Notification sound layer — 2026-07-17

- [x] Added a shared Web Audio notification engine with distinct soft signals for channel messages, mentions, DMs, task escalations, voice join and voice leave events.
- [x] Local sounds are independent from browser push permission, rate-limited per source, and avoid snapshot noise on initial voice presence sync.
- [x] Settings → Notifications now includes "Уведомления и звук": master toggle, per-category toggles, volume slider and test buttons.
- [x] Browser desktop notifications are now visual-only (`silent: true`) so the app has one consistent sound layer instead of double audio.
- [x] **v1.7.12 MOSS-ready sound packs** — Settings now has selectable `Eclipse Signal` and `Soft Signal` packs, with Web Audio fallback semantics documented in `docs/sound-packs.md` for future generated assets.

### Account access recovery — 2026-07-22

- [x] Added a production-safe `access:restore` maintenance command with dry-run by default. It diagnoses admin bans and brute-force login lockouts by exact email, refuses soft-deleted accounts, and requires explicit `--apply` before changing data.
- [x] Recovery atomically clears the ban/lockout fields, revokes existing refresh sessions and writes a sanitized `PLATFORM_USER_UNBANNED` audit event. Runbook: `docs/USER-ACCESS-RECOVERY.md`.
- [x] Added a dry-run-first `password:reset` maintenance command. It generates a one-time 16-character password, stores only a bcrypt cost-12 hash, revokes existing sessions, clears login lockout counters and records a sanitized password-reset audit event.

### Public profiles and client parity — v1.7.13

- [x] Added a relationship-protected public profile API: self, shared workspace, accepted friend or existing conversation. Responses exclude email, security settings, quiet hours and other private account data.
- [x] Added profile covers and an owner-curated gallery (up to 8 images) with decoded-image validation, pixel and upload limits, WebP normalization, random filenames and owner-only deletion.
- [x] Added one responsive Telegram/Discord-inspired profile surface with status, activity, workspace role, membership dates, bio, media grid and keyboard/touch lightbox.
- [x] Profiles open consistently from messages, workspace members, friends, DM headers and voice-room participants; the primary CTA is either `Настроить профиль` or `Написать сообщение`.
- [x] Rebuilt the account profile editor around a live preview, clear avatar/cover/gallery actions, protected deletion and mobile-safe 44px controls.
- [x] Browser, Tauri desktop and Android Capacitor share the same production web surface, so the responsive profile release reaches all clients without unnecessary native-wrapper version bumps.

### Profile settings layout hotfix — v1.7.14

- [x] Replaced the inherited three-column media grid that produced uneven avatar and cover controls with direct editing actions inside the live profile preview.
- [x] Expanded the settings workspace to 1120px on large screens and switched its navigation to a horizontal rail on compact desktop/tablet widths where a permanent sidebar starved the content area.
- [x] Consolidated eleven repetitive navigation groups into five user-oriented groups, with secondary and unfinished areas collapsed by default.
- [x] Rebuilt profile identity, form footer and gallery controls for clear hierarchy, equal spacing, 44px mobile actions and safe text truncation down to 320px.

### Desktop installer and trusted updates — desktop v1.0.5

- [x] Replaced the generic NSIS artwork with reproducible Eclipse Chat sidebar/header branding; WiX receives matching dialog/banner assets.
- [x] NSIS now opens a Russian/English language selector, defaults to the matching OS language with Russian as fallback, and installs per-user without unnecessary UAC.
- [x] Generated a dedicated updater signing key, stored the private key in GitHub Actions secrets and embedded only the public verification key in the desktop binary.
- [x] Startup updater now downloads, verifies, installs and restarts into a newer release instead of logging availability only. Checks stay launch-bound to avoid interrupting calls and unsent drafts mid-session.
- [x] Desktop release workflow keeps the release private until Windows, macOS and Linux builds pass, then publishes automatically with `latest.json`, signatures and stable download aliases.
- [x] Download page now targets stable aliases from the latest GitHub Release, so users no longer receive the old committed installer after a desktop version bump.
- [ ] Configure Windows Authenticode and macOS notarization. Updater signatures protect update integrity but do not remove first-install SmartScreen/Gatekeeper warnings.

### Mobile delivery, notification center and autostart — v1.7.15 / desktop v1.0.6 / Android v1.0.5

- [x] Android web users now get a direct, cache-busted `Скачать APK` action in the mobile command bar instead of having to discover the generic download modal.
- [x] Added a persistent notification-center button with unread count and a direct path to notification settings when permissions or sounds need attention.
- [x] Wired the existing Eclipse sound engine to real LiveKit participant join/leave events without replaying the initial room roster; task assignments and approval requests now use the task signal and optional system notification.
- [x] Desktop settings now expose explicit OS-login autostart control through the official Tauri plugin. The remote production webview receives only `enable`, `disable` and `is-enabled` permissions.
- [x] Replaced Web/PWA/Android/Desktop-generated branding inputs with the new square-safe Eclipse violet/gold icon master.
- [x] Android APK, PWA cache and native wrapper versions are coordinated so the same public download URL cannot silently return a stale package.
- [x] Removed the manual `/api/version` constant. The backend now loads its manifest once at startup, while the independent smoke check detects a stale process or wrong nginx upstream.

## Applied research — 2026-07-19

Источник: [Eclipse Library · July 2026 Kimi / research / media radar](https://library.eclipse-forge.ru/#guide/july-2026-kimi-research-media-radar).

- [x] **MOSS SoundEffect reference applied** — shipped the product-side sound-pack architecture first: event taxonomy, settings UX, fallback Web Audio patterns, asset QA contract.
- [ ] **Foglamp Scan / security scanner trial** — run against API, upload, auth, LiveKit and notification surfaces before the next production release.
- [ ] **Hyper Research reference** — evaluate for AI memory digest, research rooms and citation-backed project summaries.
- [ ] **Shipper anti-slop checklist** — merge with The Taste for landing/home-screen QA before large UI redesigns.
- [ ] **Kimi K3 / provider planning** — benchmark as an optional provider through OmniRoute, never as an untracked direct dependency.

## Applied research — 2026-07-13

Источник: [Eclipse Library · Applied project plan](https://library.eclipse-forge.ru/#guide/applied-project-plan-2026-07-13).

### P0 / P1 slices

- [ ] **Voice intelligence layer** — Voicetypr/Sokuji-style local transcription, live subtitles, call summary, action-item extraction. Первый слайс: transcript panel для voice room + manual “save summary to memory”.
- [ ] **Consent-safe live translation** — real-time translated captions before translated microphone output. UI должен явно показывать: original audio, translated subtitles, consent state.
- [ ] **Operational tables hardening** — MWS Tables reference: server-side filtering/sorting, large table UX, inline editing, formula-safe fields, linked messages/tasks/decisions.
- [ ] **Client recap export** — PPT Master reference: project room → decisions/tasks/files → editable PPTX recap, не image-only slides.
- [ ] **AI provider cost diagnostics** — OmniRoute/ClawRouter pattern: per-provider latency, cost, error rate, fallback reason в Platform Admin.
- [ ] **Agent safety confirmations** — любой AI action из chat/message должен иметь preview, explicit CTA, audit log и rollback/undo где возможно.

### Guardrails

- Voice clone / live translation только с consent и видимым call indicator.
- Provider routing — только owned/legal keys, no grey-zone token bypass.
- Token-saving tools (`sqz`, caveman-like compression) сначала benchmark в sandbox; не сжимать секреты, миграции, юридический текст и точные логи.

**Актуальная версия (короткий индекс):** **v1.7.15** — direct Android delivery in the mobile header, notification-center visibility, LiveKit join/leave sounds, task notifications, desktop autostart and refreshed Eclipse app branding.

**Текущая версия:** **v1.6.98** (🗄️⚡ PARTIAL-ИНДЕКС под escalation-scan (бэклог-хвост, заход через CI). Фоновой `escalation.ts` раз в час обходит `ActionItem` где `status ∈ (OPEN,IN_PROGRESS,REVIEW)`, `dueAt < now-48h`, `(escalatedAt IS NULL OR < now-7d)`, `ORDER BY dueAt ASC LIMIT 50`. Запрос **глобальный** (без serverId/channelId) → все 4 существующих индекса `ActionItem` ведут с channelId/serverId и его НЕ покрывают → был seq-scan всей таблицы каждый час. **Новый partial composite index** `ActionItem_escalation_scan_idx ON ("dueAt") WHERE status IN (OPEN,IN_PROGRESS,REVIEW) AND dueAt IS NOT NULL` (raw-миграция `20260625120000_add_escalation_partial_index`): индексирует только кандидатов эскалации (крошечная доля таблицы — закрытые DONE и задачи без дедлайна исключены); ведущая `dueAt` → один forward index-scan покрывает и `dueAt < X`, и `ORDER BY dueAt ASC LIMIT 50` без сортировки, рано останавливается. **Prisma не выражает WHERE-индексы** → raw SQL; `migrate deploy` (deploy.sh [4/10]) применяет как есть, `prisma generate` индексы не читает, drift-проверок (`migrate dev`) в проекте нет (прод=migrate deploy, локальной БД нет). schema.prisma — doc-comment у `ActionItem` фиксирует существование индекса («не чинить как drift»). **temp-channel scan (`tempChannels.ts`) НЕ трогал** — `Channel` уже имеет `@@index([expiresAt])`, а `WHERE expiresAt < now` = чистый range-scan по нему (NULL'ы сортируются последними, не читаются); partial там лишь дублировал бы индекс = write-amplification на крошечной таблице ради ~нуля. Version 1.6.97→1.6.98 (4 точки). Verify: server `tsc --noEmit` PASS, web build PASS; миграция применится на проде при деплое (`migrate deploy`). **Бэклог-остаток:** виртуализация ленты сообщений (npm-dep + риск-рефактор скролла) — единственный крупный хвост.)

**Предыдущая:** **v1.6.97** (📲✅ ANDROID v1.0.4 НА САЙТЕ (хвост закрыт) + splash-hide. CDN отпустил → перезалит on-site `public/download/eclipse-chat.apk` на подписанный **`android-v1.0.4`** (4.8 МБ): in-app downloads (DownloadListener в `MainActivity`) + тёмный status-bar + сплеш (`@capacitor/splash-screen`). Юзеры v1.0.3 → баннер «новая версия». **Веб-часть слайса 3 дозакрыта:** `main.tsx` прячет нативный сплеш (`window.Capacitor.Plugins.SplashScreen.hide()`) по монтированию веба (rAF; graceful no-op в браузере; `launchAutoHide` страхует). Version 1.6.96→1.6.97 (4 точки). Verify: typecheck+build green, APK 4.8МБ в `dist/download/`. **Осталось (всё внешне-заблокировано локально):** partial-индексы — Prisma-миграцию НЕ сгенерить локально (нет БД); виртуализация ленты — npm-dep не добавить локально. Оба — отдельным заходом через CI/с БД. Полировка-де-нойз/перф/SOLAR/серверный-рефактор — закрыты (слайсы v1.6.90-96).

**Предыдущая:** **v1.6.96** (🧩 ПОЛИРОВКА ч.7 — серверный рефактор (по аудиту C2). 3 одинаковые inline-проверки модератора (`role !== OWNER && !== ADMIN && !== MODERATOR`) в delete/pin/unpin (`routes/messages.ts`) → вынесены в хелпер `isServerModerator(role)` (один источник правды; при смене набора ролей не разъедется). Чистый рефактор, поведение не менялось. Version 1.6.95→1.6.96 (4 точки). Verify: server `tsc --noEmit` PASS. **Осталось серверное:** partial-индексы под cron-сканы (temp-channels/escalation) — это prod-DB-миграция Prisma, делать отдельным аккуратным заходом (не в общем потоке полировки). **Крупное:** виртуализация ленты (npm-dep). **Хвост:** `android-v1.0.4` re-host (CDN из РФ).

**Предыдущая:** **v1.6.95** (🧹 ПОЛИРОВКА ч.6 — финиш де-нойза. `.ec-settings-panel` — убран radial-glow фона (оба правила, base+ops); `.ec-modal-footer::before` — убран декоративный cyan→violet градиент (border-top уже разделяет); `ServerHubModal` — хардкод `#fff`+textShadow на «авто-градиент»-лейбле → токены (`--ec-text-strong`/`--ec-overlay-bg`), активный mode-select glow упрощён до чистого 1px-кольца `var(--ec-accent)` (убран хардкод-hsl + 14px-glow). Чисто CSS + 1 TSX. Version 1.6.94→1.6.95 (4 точки). Verify: typecheck+build green. **Осталось:** серверное (moderator-helper рефактор + partial-индексы под cron — индексы = prod-DB-миграция, делать осторожно отдельно); крупное — виртуализация ленты (npm-dep+риск). + хвост: `android-v1.0.4` (CDN).

**Предыдущая:** **v1.6.94** (🧹 ПОЛИРОВКА ч.5 — memo списков + де-нойз модалок/настроек. (1) `MemberRowView` → `memo` (изменение одного участника не ре-рендерит все строки; добивка к `RichContent`/`Avatar`). (2) Де-нойз: `.ec-modal-backdrop` — убрана violet-аура (просто затемнение); `.ec-modal-close:hover` — убран glow (rotate+bg уже сигналят); `.ec-settings-section__hero/.ec-settings-card/.ec-settings-empty` — убраны radial-glow + violet-тень + inset-кольцо → `var(--ec-surface-2)` + `var(--ec-elev-1)` + токен-border (проще + корректно в SOLAR). Version 1.6.93→1.6.94 (4 точки). Verify: typecheck+build green + headless. **Осталось:** settings-panel radial + modal-footer cyan-градиент, `ServerHubModal` (P15), memo остальных списков/AppShell-пропсов, серверное (helper/индексы); виртуализация ленты — npm-dep. + хвост: `android-v1.0.4` (CDN).

**Предыдущая:** **v1.6.93** (🧹 ПОЛИРОВКА ч.4 — КОМПОЗЕР (самый «шумный» компонент по аудиту). Де-нойз `.ec-composer-box`: убраны violet+**cyan**-радиалы (cyan off-brand), `::before` holo-rail (cyan→violet линия), blur, тройной focus-glow + хардкод-тёмный фон → `var(--ec-surface-2)` + чистое акцент-кольцо на focus (корректно в SOLAR). Send-кнопка: хардкод violet-градиент + **pure-white** текст → `var(--ec-accent)` (следует brandColor сервера) + `var(--ec-accent-text)`. **Headless поймал баг, который аудит пропустил:** `.ec-composer-textarea` фон = хардкод `#05070d` (ops-theme override @9398) → в SOLAR чёрная «пилюля» инпута; → `color-mix(var(--ec-surface-1) ...)`. Чисто CSS. Version 1.6.92→1.6.93 (4 точки). Verify: build green + **headless OBSIDIAN+SOLAR композера** — чисто, инпут читаем в обеих темах. **Осталось:** де-нойз модалок/настроек (P12-14), `ServerHubModal` (P15), memo списков AppShell, серверное (helper/индексы); виртуализация ленты — упирается в npm-dep. + хвост: перезалив `android-v1.0.4` (CDN).

**Предыдущая:** **v1.6.92** (🧹 ПОЛИРОВКА ч.3 — де-нойз + ещё SOLAR-баги (Pavel «сделаем всё что осталось»). (1) **Глушим постоянные ambient-лупы** в приложении (крутились вечно, не несут инфы → перф/батарея, N online-точек = N таймлайнов): presence-пульс (`.ec-dot--online`, member/dm presence), `ec-channel-rail-breath` (активный канал), `ec-dm-avatar-breath`, `ec-dm-badge-pulse/halo`, `ec-composer-send-breath`, `ec-anim-reaction-mine` → централизованный блок `animation: none !important` в конце `components.css` (статика — цвет/бейдж/рейл — остаётся, уходит движение; лендинг-галактику не трогаем). (2) Убран glow `text-shadow` с `.ec-unread-divider`; смягчена 38px-тень `.ec-chat-header` → 8px/0.12. (3) AI-сообщение (`.ec-message-row--ai .ec-message-content` rule@~9887): был хардкод тёмный градиент (`#111827/#090f1a` → чёрный в SOLAR) + радиал-акцент → токен-тинт (акцентный border уже идентифицирует бота). Чисто CSS. Version 1.6.91→1.6.92 (4 точки). Verify: build green. **Осталось:** де-нойз ч.4 (off-brand cyan композера P1, send-кнопка P3, glow модалок/настроек P12-14, `ServerHubModal` P15), структурный перф (memo списков AppShell, виртуализация ленты — блокирована: нельзя добавить npm-dep локально, рассмотреть later/CI), серверное (moderator-helper, partial-индексы под cron). + хвост: перезалив `android-v1.0.4` (CDN).

**Предыдущая:** **v1.6.91** (🌗 ПОЛИРОВКА ч.2 — SOLAR-баги (по аудиту): хардкод-тёмные `hsl(...)` surface БЕЗ light-override рендерились чёрными блоками в светлой теме. Фикс на токены (в OBSIDIAN ~то же, в SOLAR флипается): `.ec-home__stats div` + `.ec-home-card` → `var(--ec-surface-2)`; `.ec-channel-item:hover` → `var(--ec-surface-3)`+`var(--ec-border-subtle)`; `.ec-message-actions` → `var(--ec-surface-2)` + убран лишний glow И `backdrop-filter` (фон непрозрачный → блюр не виден, но стоил compositing-слоя на КАЖДОЙ строке ленты — перф-бонус). Чисто CSS (`components.css`). Version 1.6.90→1.6.91 (4 точки). Verify: build green + headless-рендер карточек в SOLAR — светлые/читаемые. **Осталось по аудиту:** де-нойз (ambient-лупы в `motion.css`/`effects.css`, off-brand cyan в композере P1, лишние glow модалок/настроек P12-14, `ServerHubModal` хардкод-цвета P15), крупные (виртуализация ленты, memo AppShell-списков, серверные индексы).

**Предыдущая:** **v1.6.90** (⚡ ПОЛИРОВКА ч.1 — перф-оптимизация ленты (по аудиту, Pavel «отполировать до идеала без потерь оптимизации»). Без визуальных изменений: (1) `RichContent` → `memo`+`useMemo` (detectMentions/tokenize больше НЕ гоняются на каждый ре-рендер каждого сообщения — самый дешёвый крупный выигрыш в ленте); (2) `Avatar` → `memo` (рендерится в каждой строке списков, пропсы примитивные); (3) `vite.config` `manualChunks` → стабильный `vendor`-чанк (react/react-dom/scheduler) отдельно от кода приложения → WebView кэширует его между деплоями (socket.io/livekit оставлены lazy — лендинг не тяжелеет). Version 1.6.89→1.6.90 (4 точки). Verify: typecheck+build green, vendor-чанк в bundle. **NB:** worst-case mobile-перф (backdrop-filter на шелле/строках) уже убран touch-пассом v1.6.81. **Аудит дал ещё пунктов (делаю слайсами):** SOLAR-баги (хардкод-тёмные surface без light-override → чёрные блоки в светлой теме), де-нойз (ambient-лупы, off-brand cyan в композере/модалках, лишние glow/тени), крупные (виртуализация ленты, memo AppShell-списков, серверные индексы). **Хвост:** перезалив `android-v1.0.4` на сайт (in-app downloads+status-bar+splash готовы, тег есть) — БЛОКИРОВАН: GitHub-CDN таймаутит с моей машины (та же РФ-блокировка); on-site валидный v1.0.3, перезалью когда CDN отзовётся.

**Предыдущая:** **v1.6.89** (🎨📱 БРЕНДОВАЯ ИКОНКА ПРИЛОЖЕНИЯ (слайс 3/4, ч.1). Дефолтная иконка Capacitor → наш eclipse-лого. **Нативное (PR #94 + тег `android-v1.0.3`):** `apps/android` +`@capacitor/assets` (dev), `assets/icon-only.png` (1024, апскейл `icon-512`), CI-шаг `capacitor-assets generate --android` в build-debug+build-release (после `cap sync`) → все mipmap-плотности + adaptive (фон `#05070a`). Опубликован подписанный **`android-v1.0.3`** (3.2 МБ). **Веб (этот деплой):** перезалит on-site APK `public/download/eclipse-chat.apk` → теперь v1.0.3 (брендовая иконка); юзеры v1.0.2 увидят баннер «новая версия» (`NativeApkBanner`) → апдейт. Version 1.6.88→1.6.89 (4 точки). Verify: build-debug PASS (генерация иконки + сборка), `android-v1.0.3` build+sign PASS, on-site APK обновлён. ⚠️ Композицию adaptive-иконки (full-bleed лого) Pavel чекает на устройстве — если инсет/кроп, доведу источник (прозрачный foreground + отдельный фон). **Хвост слайса 3 (ч.2, если нужно):** сплеш, status-bar/safe-area, скачивание файлов внутри app (нативный DownloadListener). **Дальше:** слайс 4 — нативный голос (LiveKit, сначала оценка реализуемости).

**Предыдущая:** **v1.6.88** (🖥️⬇️ ДЕСКТОП С САЙТА (слайс 2/4). Установщики Win/Mac/Linux раньше вели на GitHub releases (в РФ нестабильно). Теперь хостятся **same-origin** в `apps/web/public/download/desktop/` (стабильные имена: `eclipse-chat-setup.exe` 2.2МБ, `eclipse-chat.msi` 3МБ, `eclipse-chat.dmg` 6.8МБ, `eclipse-chat.deb` 3.4МБ; ~15.4МБ суммарно). ⚠️ **AppImage 77МБ НЕ хостим** (слишком жирно для git) — остаётся ссылкой на GitHub (Linux-юзеры в основном на .deb). `download.html` десктоп-секция → 3 OS-кнопки (`<a download>` same-origin) + «другие форматы»: .msi (сайт) · AppImage (GitHub). `DownloadAppModal` десктоп-кнопка → открывает `download.html` (а не GitHub). `/download/` уже мимо SW (покрывает и `/desktop/`). Version 1.6.87→1.6.88 (4 точки). Verify: typecheck+build green (установщики в `dist/download/desktop/`), headless-рендер страницы ок. **При новом десктоп-релизе: перезалить эти 4 файла.** **Дальше:** слайс 3 — полировка приложения (иконка/сплеш/safe-area/скачивание файлов в app); 4 — нативный голос (LiveKit). Слайс 1/4 (страница+QR) — предыдущая версия.

**Предыдущая:** **v1.6.87** (📥📱 СТРАНИЦА ЗАГРУЗКИ + QR. Слайс 1/4. Публичная **статическая** страница `apps/web/public/download.html` (без логина, грузится мгновенно, само-содержащая — inline-стили в бренде violet/gold, без внешних шрифтов/линков) → `app.star-crm.ru/eclipse-chat/download.html`. Карточки: **Android** (QR + кнопка «Скачать APK» same-origin `<a download>` + «Как установить» = разрешение из неизвестных источников), **Компьютер** (Win/Mac/Linux → пока GitHub releases/latest), **iPhone/iPad** (Safari→PWA). **QR** сгенерён локально либой `qrcode` (она ЕСТЬ в node_modules) → статический `public/download/qr.svg` (чёрный на белом, кодирует URL страницы; НЕ рантайм-зависимость от внешнего QR-сервиса — это убило бы надёжность «с сайта»). Скан с телефона → открывает страницу на телефоне → «Скачать APK». Version 1.6.86→1.6.87 (4 точки). Verify: статика в `dist/`, headless-рендер страницы — QR валидный, вёрстка/бренд ок. **Дальше (Pavel выбрал все 4):** слайс 2 — десктоп-установщики с сайта; 3 — полировка приложения (иконка/сплеш/safe-area/скачивание файлов в app); 4 — нативный голос (LiveKit).)

**Предыдущая:** **v1.6.86** (⬇️ СКАЧИВАНИЕ APK С САЙТА (фикс «ошибка скачивания»). Pavel: кнопка в `DownloadAppModal` вела на GitHub-ассет `release-assets.githubusercontent.com`, а он в РФ нестабилен/блокируется → ошибка скачивания. **Фикс:** APK хостится **на самом сайте** (same-origin): файл `apps/web/public/download/eclipse-chat.apk` (подписанный v1.0.2, ~3 МБ) → отдаётся nginx'ом как `app.star-crm.ru/eclipse-chat/download/eclipse-chat.apk`. Кнопка «Скачать APK» теперь реальная `<a href download>` (same-origin → атрибут `download` форсит сохранение, без пустой вкладки и без GitHub-CDN). Стабильное имя файла (без версии) → линк не протухает (обновляем сам файл при релизе). `sw.js`: `/download/` мимо service-worker (не кэшируем 3 МБ, чистая отдача nginx). Version 1.6.85→1.6.86 (4 точки). Verify: web typecheck+build green (APK попал в `dist/download/`). ⚠️ Десктоп-кнопка пока на `releases/latest` (GitHub) — если тоже будут жалобы из РФ, захостим установщики на сайте отдельно. In-app баннер обновления (`NativeApkBanner`) оставлен на GitHub (открывает внешний браузер; same-origin для него = in-app-навигация без download-менеджера).)

**Предыдущая:** **v1.6.85** (📲 НАТИВНАЯ ОБОЛОЧКА слайс 5b — `@capacitor/app` + интеграция веба. **Нативное (отдельный PR #89 + тег `android-v1.0.2`):** в `apps/android` добавлен `@capacitor/app` (даёт WebView-у `App.getInfo()` + событие `backButton`); CI `build-release` стампит `versionName` из тега (→1.0.2) + `versionCode` из run_number (→10); опубликован **подписанный `android-v1.0.2`** (.apk 3.0 МБ + .aab). **Веб (этот EC-деплой):** (1) **аппаратная «Назад»** (`hooks/useNativeBackButton.ts`) — закрывает открытый оверлей (поиск/модалка/drawer'ы), если нечего — `minimizeApp` (сворачивает, не убивает → сокет/push живут); подключена в `AppShell`. (2) **Баннер «новая версия приложения»** (`components/NativeApkBanner.tsx`) — сверяет `App.getInfo().version` с последним android-релизом на GitHub, если новее → баннер со ссылкой на свежий `.apk`; смонтирован в `App.tsx`. (3) `DownloadAppModal` APK-линк → `android-v1.0.2`. Доступ к Capacitor — через инжектируемый `window.Capacitor` (веб НЕ бандлит `@capacitor/*`, remote-load), в браузере/без плагина — graceful no-op. Version 1.6.84→1.6.85 (4 точки). Verify: web typecheck+build green; android-v1.0.2 build+sign green (versionName/Code подтверждены в логе); поведение в оболочке — на устройстве за Pavel (нужно поставить APK v1.0.2). **Итог по отзывам Android:** слайсы 1 (перф) + 2 (тач-таргеты) + 3/4 (свайпы) + 5a (авто-фреш веб) + 5b (нативная оболочка) — все на проде. Хвост: Google Play (заморожен, нет аккаунта); нативный voice (LiveKit) — позже.)

**Предыдущая:** **v1.6.84** (👆📂 ЖЕСТЫ-СВАЙПЫ ДЛЯ DRAWER'ОВ (слайсы 3+4: навигация + жесты). Канальный список на мобиле живёт за левым drawer'ом, участники — за правым; раньше открывались только тапом по кнопке. Теперь **края-свайпы**: свайп вправо от левого края экрана → открыть каналы, свайп влево от правого края → участники (если рейл доступен); когда drawer открыт — обратный свайп закрывает. Новый хук `hooks/useDrawerSwipe.ts` (window-слушатели passive, ставятся 1 раз, состояние через ref → без переподписки; срабатывает только при доминирующем ГОРИЗОНТАЛЬНОМ жесте — вертикальный скролл сообщений не задет; открытие только от края, чтобы не конфликтовать с горизонт-скроллом код-блоков). Подключён в `AppShell` (`enabled: isMobile`). Version 1.6.83→1.6.84 (4 точки). Verify: web typecheck+build green; жест на устройстве за Pavel. **Хвост:** аппаратная кнопка «Назад» (закрывать drawer/модалку) + баннер «новая версия APK» — оба требуют нативного `@capacitor/app` (версия оболочки + backButton) → слайс 5b (нативная оболочка + новый подписанный APK).)

**Предыдущая:** **v1.6.83** (🔄 АВТО-ОБНОВЛЕНИЕ веб-части (слайс 5a из «автообновлений», решение Pavel «оба»). Было: поллинг `/api/version` каждые 20s → баннер «доступно обновление» + ручная кнопка `hardReload` (unregister SW + clear caches + reload). Стало: когда апдейт доступен — **тихий авто-reload в момент сворачивания приложения** (`visibilitychange` → `hidden`), активную работу не прерываем; баннер-кнопка остаётся для немедленного апдейта. Так Android-приложение (remote-load обёртка) само подтягивает свежую версию без переустановки/очистки кэша — закрывает «не вижу изменения / надо переустанавливать». Чисто клиент (`App.tsx`, 1 useEffect на `[updateAvailable]`). Version 1.6.82→1.6.83 (4 точки). Verify: web typecheck+build green. **Хвост автообновлений (5b):** баннер «новая версия APK» в Capacitor-оболочке (проверка GitHub-релизов) — отдельным слайсом. **Дальше по отзывам:** слайс 3 — упрощение мобильной навигации; 4 — жесты (свайп-дровер/назад).)

**Предыдущая:** **v1.6.82** (📱👆 ТАЧ-ТАРГЕТЫ слайс 2 — отзыв «мелкие элементы под палец». Кнопки на мобиле были 26–34px (база `.ec-icon-btn` 28, топбар 32, композер 34, действия над сообщением 26) — ниже комфортных ~44px. **Фикс (touch-only `@media (hover:none) and (pointer:coarse)`):** композер (основной ввод) `.ec-composer-icon-btn`/`.ec-composer-send` → **44px**; топбар `.ec-shell__top-actions .ec-icon-btn` → 36px (плотный ряд, иначе переполнение узкого экрана); прочие `.ec-icon-btn` → 36px; `.ec-msg-action` → 38px. Чисто CSS, в конце `responsive.css` (грузится после components.css → побеждает прежние мобильные 32–34px по порядку каскада). ПК не тронут. Version 1.6.81→1.6.82 (4 точки). Verify: web build green; устройство за Pavel. **Дальше:** слайс 3 — упрощение мобильной навигации; 4 — жесты (свайп-дровер/назад); 5 — автообновления (SW-фреш веб + баннер «новая версия APK»).)

**Предыдущая:** **v1.6.81** (📱⚡ МОБ-ПРОИЗВОДИТЕЛЬНОСТЬ слайс 1 — отзывы по Android-приложению: «очень плохая оптимизация, всё дёргается и плывёт». **Корень:** `backdrop-filter: blur(14–20px)` на постоянных панелях шелла (`.ec-shell__cmdbar`/`__channels`/`__members`/`.ec-chat-header` + ops-блок) — в Android WebView каждый кадр прокрутки пересчитывает размытие под панелью → рывки; оверскролл-«отскок» WebView → «плывёт». **Фикс (touch-only, `@media (hover:none) and (pointer:coarse)` — ПК не тронут):** `backdrop-filter: none !important` на всё (`*`), шелл-панели → плотный opaque-градиент из ops-токенов (`--ec-ops-rail-strong/-rail`, theme-aware → ок и в OBSIDIAN, и в SOLAR), `overscroll-behavior: none` (html/body/.ec-shell), глушим 2 непрерывные ambient-анимации (`.ec-anim-ai-pulse`, `.ec-anim-reaction-mine`). Чисто CSS (`components.css`, после ops-правила → побеждает по порядку каскада). Version 1.6.80→1.6.81 (4 точки). Verify: web build green; мобилку headless не воспроизводит (media touch) → Pavel чекает на устройстве «стало плавно?». **Дальше по отзывам (согласовано):** слайс 2 — тач-таргеты ≥44px/воздух; слайс 3 — упрощение мобильной навигации; слайс 4 — жесты (свайп-дровер/назад); слайс 5 — автообновления (SW-фреш веб + баннер «новая версия APK», оба по решению Pavel). Google Play заморожен (нет аккаунта).)

**Предыдущая:** **v1.6.80** (🎚️ ТУМБЛЕР ТЕМЫ — переключатель OBSIDIAN↔SOLAR из сегмент-контрола (две текст-кнопки «OBSIDIAN»/«SOLAR») переделан в привычный **слайдер-свитч** (Pavel: «сделать переключатель тем кнопку как раньше тумблиров»). Слайдящийся knob с иконкой текущей темы: **луна** = OBSIDIAN (тёмная), **солнце** = SOLAR (светлая); `role="switch"` + `aria-checked`. Новый класс `.ec-theme-switch` (52×28, knob 22, slide через `transform translateX(24px)`, `--ec-ease-spring`, reduced-motion-safe), цвета на токенах. `ThemeToggle.tsx` упрощён (убран `THEMES`-массив, бинарный toggle). Работает в обоих местах рендера: профиль-меню (StatusMenu строка «Оформление») + Настройки→Внешний вид. Логика тем не тронута (`applyTheme`/`readTheme`/localStorage те же). Version 1.6.79→1.6.80 (4 точки). Verify: web typecheck+build green, headless OBSIDIAN+SOLAR на собранном CSS — свитч корректен в обеих темах.)

**Предыдущая:** **v1.6.79** (📥 ОКНО «СКАЧАТЬ ПРИЛОЖЕНИЕ» + Android в проде. **(1)** Android доведён до **подписанного** релиза: Pavel сгенерил keystore, 4 GitHub-секрета подписи заведены, CI-job `build-release` на тег `android-v*` собирает `assembleRelease`+`bundleRelease` → подписывает **после сборки** (APK `zipalign`+`apksigner` → verify v1+v2+v3=true, AAB `jarsigner` для Play) → prerelease (PR #82). Опубликован **`android-v1.0.1`** (подписанные `.apk` 3.0 МБ + `.aab` 2.9 МБ, прямой сайдлоад). Также: GitHub-Releases-канал android (PR #81, тег→prerelease, НЕ перетирает `releases/latest`=desktop), `apps/android` в `deploy-prod` paths-ignore. **(2)** Кнопка-иконка «Скачать приложение» (download-glyph) в **топбаре** (`ec-shell__top-actions`, кластер инструментов перед сепаратором) → открывает **модалку** `DownloadAppModal` (новый lazy-компонент на базе `Modal`): три карточки — Компьютер (Win/Mac/Linux → `releases/latest`), Android (→ прямой `.apk` пререлиза), iPhone·iPad (инструкция Safari→PWA); авто-детект устройства подсвечивает «ваше устройство». Пункт «Скачать» в профиль-меню (StatusMenu) теперь тоже открывает эту модалку, а не прямой линк. Стиль на токенах (`var(--ec-*)` → OBSIDIAN+SOLAR-safe), кнопки `.ec-btn`. Version 1.6.78→1.6.79 (4 точки). ⚠️ `.apk`-линк в модалке версионно-пинован (`android-v1.0.1`) — обновлять при новом android-теге. **Хвост:** Google Play — ждёт Play-аккаунт Pavel ($25), `.aab` уже готов.)

**Предыдущая:** **v1.6.78** (📥 КНОПКА «СКАЧАТЬ ПРИЛОЖЕНИЕ» + публикация desktop-релиза (Pavel: «сделать кнопку скачать приложение»). **(1)** Опубликован draft-релиз **desktop-v1.0.4** (5 установщиков: Win .exe/.msi, Mac .dmg, Linux .AppImage/.deb — тонкие Tauri-врапперы, грузят прод-URL) → `releases/latest` теперь 302→тег (был 404). Репо PUBLIC → качается публично. ⚠️ Установщики **unsigned** (signing key для auto-update — хвост). **(2)** Пункт **«Скачать приложение»** (иконка-download, hint «Windows · Mac · Linux») добавлен в профиль-меню (`StatusMenu` `tools[]`, перед «Справка»), открывает `github.com/PavelHopson/eclipse-chat/releases/latest` в новой вкладке (`noopener`). Чисто клиент (`AppShell.tsx`), web typecheck+build green. Version 1.6.77→1.6.78 (4 точки). **Дальше (стартую следом):** Android-версия — Capacitor-скаффолд + CI (apps/ пока desktop/server/web, Capacitor НЕТ). Хвосты Android: keystore-подпись + Play-аккаунт + Android SDK в CI.)

**Предыдущая:** **v1.6.77** (🎨 ПОЛИРОВКА SOLAR ч.2 — гайд-вью (Путеводитель). Pavel «всё равно плохо» + скрин (v1.6.76): весь гайд-вью тёмный канвас под светлыми карточками. **Корень (тот же класс, что v1.6.76 ops):** `.ec-guide { background: var(--ec-void) }` (clean-ui.css), а **SOLAR переопределял `--ec-bg`, но НЕ `--ec-void`** — это ОТДЕЛЬНЫЙ токен (tokens.css:51-52: `--ec-void:#05070A; --ec-bg:#05070A;` — два разных var с одним значением), в SOLAR оставался тёмным `#05070A` → фон всего гайда тёмный. Стат-карточки сами `surface-2` (светлые) сидели на тёмном void-канвасе = сыро. **Фикс:** добавил `--ec-void` (+ `--ec-surface-glass` за компанию) в SOLAR-блок (`effects.css`), светлые значения (`hsl(225 20% 97.5%)`). **Headless-verify** (с подключённым clean-ui-чанком): `.ec-guide bg = rgb(247,248,250)` (был тёмный), стат-карточки `rgb(252,252,253)`. `--ec-surface-0` оказался нигде НЕ определён (rail → прозрачный → показывает светлый shell, ок). Чисто CSS, web typecheck+build green. Version 1.6.76→1.6.77 (4 точки). **Паттерн на будущее:** SOLAR — ретрофит поверх dark-first; протечки = base-токены вне solar-override-набора (`--ec-void`, ops были пропущены). Остаточные component-level хардкод-тёмные (если всплывут) — добивать по скринам.)

**Предыдущая:** **v1.6.76** (🎨 ПОЛИРОВКА SOLAR — вылечена «сырость» светлой темы (Pavel: «доработай светлую тему, выглядит сыро»). **Корень:** SOLAR-блок переопределял core-токены, но НЕ **ops-токены** (`--ec-ops-bg/-rail/-rail-strong/-panel*/-line*`, заданы в `:root` components.css:8972 как тёмные `#05070d…`). Эти ops-токены драйвят `body`-фон + `.ec-chat-header` + `.ec-shell__members` (часть через `!important`, потому solar-компонент-оверрайды без `!important` их не перебивали) → в светлой теме каркас/шапка/рейл оставались ТЁМНЫМИ под светлыми панелями = сыро. **Фикс:** добавил ops-токены в SOLAR-блок (`effects.css`) со светлыми значениями в тон surface-палитре (ops-bg #fff, rail hsl(225 20% 97.5%), line hsl(225 15% 84%) и т.д.) — `!important`-правила теперь берут СВЕТЛОЕ значение из токена. **Headless-verify** на собранном CSS: `body=rgb(255,255,255)`, chat-header/members светлые, ops-tokens светлые. Чисто CSS (1 блок `effects.css`), web typecheck+build green. Version 1.6.75→1.6.76 (4 точки). ⚠️ Остаточные мелочи (если есть) Pavel укажет вживую — доберу точечно.)

**Предыдущая:** **v1.6.75** (🎨 УПРОЩЕНИЕ ТЕМ — убрана VOID, остались две: **OBSIDIAN (OLED-чёрная, дефолт) + SOLAR (светлая)** (Pavel: «можем тему войд убрать и оставить только две»; OBSIDIAN зашёл на устройстве). Меньше выбора = курс на упрощение (Hick). **Реализация (минимально-рисковая, без переписи `:root`):** `ThemeToggle` → 2 варианта (obsidian/solar); `readTheme` мигрирует `null`/legacy `"void"`/`"obsidian"` → **obsidian**, только `"solar"` → solar; `applyTheme` всегда ставит `data-ec-theme` (no-attr VOID-дефолта больше нет). Boot-скрипт `index.html` (анти-FOUC) применяет `obsidian` по умолчанию (solar если явно) → существующие VOID-юзеры мигрируют на OBSIDIAN без FOUC. VOID-токены `:root` остаются как **legacy-база** под OBSIDIAN-оверрайдом (graceful fallback, визуально не показывается; `--ec-void` токен-цвет жив — используется в clean-ui/ServerSwitcher). AppearanceSection-текст обновлён. Чисто клиент (`ThemeToggle.tsx`, `index.html`, `AppearanceSection.tsx`), web typecheck+build green. Version 1.6.74→1.6.75 (4 точки).)

**Предыдущая:** **v1.6.74** (🎨 НОВАЯ ТЕМА OBSIDIAN (OLED true-black) — третья выбираемая тема к VOID/SOLAR (Pavel выбрал из 3 концептов). Чистый чёрный фон для AMOLED (экономит батарею на телефоне), акценты violet+gold максимально контрастны, бренд сохранён. **Архитектура:** EC тема = `html[data-ec-theme]` (VOID=дефолт `:root`, SOLAR/OBSIDIAN — атрибут). OBSIDIAN тёмная как VOID → новый блок в `effects.css` переопределяет **core-токены** (`--ec-bg/--ec-void/--ec-surface-1..4/--ec-border-*` → near-black) + **ops-токены** (`--ec-ops-bg/-rail/-rail-strong/-panel/-line*`, которые драйвят shell-surface'ы chat-header/members/channels через `!important` — но значение из токенов → чёрное) + 2 чисто-хардкод surface (`.ec-shell`, `.ec-shell__cmdbar`, без `!important` → перебиты спецификацией `html[data-ec-theme]` 0,1,1 > базовые 0,1,0). **Переключатель:** `ThemeToggle` из бинарного (void↔solar) → 3-вариантный сегмент `radiogroup` (переиспользует `.ec-density-seg` классы — ноль нового CSS); в профиль-меню (StatusMenu) + Настройки→Внешний вид. Boot-скрипт `index.html` (анти-FOUC) применяет obsidian из localStorage. Чисто клиент (`effects.css`, `ThemeToggle.tsx`, `AppearanceSection.tsx`, `index.html`), web typecheck+build green; **headless-verify obsidian на реальном собранном CSS** (desktop layout — надёжно). Version bump 1.6.73→1.6.74 (4 точки). ⚠️ Полноту черноты по всем микро-поверхностям Pavel дочекает на устройстве — итерирую при остаточном tint.)

**Предыдущая:** **v1.6.73** (📱 ФИКС МОБИЛКИ — каналы. Жалоба Pavel со скрина (Android Chrome, ~393px): в дровере каналов имена обрезаны до 1 символа. **Причина:** per-channel move-select (`.ec-channel-move-select`, «Без категории ▾») на десктопе `display:none` (там drag&drop), а в `@media ≤1024` его ВКЛЮЧАЛИ (`display:inline-flex`) как мобильный аффорданс перемещения — он жрал ширину строки (max-width 118px), имя сплющивалось. Каналы и так сгруппированы под заголовками категорий → дубль. **Фикс:** на ≤1024 `.ec-channel-move-select { display:none }` (как десктоп → имена полные); перемещение в категорию на мобилке — через настройки канала/десктоп (drag). Заодно дровер каналов чуть шире: `min(320px,86vw)` → `min(360px,92vw)` (меньше тёмная полоса справа). Чисто CSS (`responsive.css`), web typecheck+build green. ⚠️ Headless мобилку не воспроизводит — Pavel проверяет на устройстве. (Параллельно пофикшен мобильный оверфлоу в eclipse-library: PR #10, `.layout minmax(0,1fr)` + `.sidebar min-width:0`, cache-bust v4.))

**Предыдущая:** **v1.6.72** (Безопасность/гигиена — удалён временный owner-lockout boot-хук + вычищен мёртвый recovery-код. **(1) 🔴 Снят временный хук** из `apps/server/src/index.ts` (после `registerPlatformRoutes`), добавленный в v1.6.67: он сбрасывал `failedLoginAttempts/lockoutUntil` у всех platform-owner'ов на КАЖДОМ рестарте сервера → постоянно ослаблял brute-force-защиту owner-аккаунта. Теперь lockout работает штатно; восстановление owner'а — через self-serve сброс пароля по recovery-кодам (v1.6.68) или 2FA-recovery. **(2) 🧹 Вычищен мёртвый recovery-код** в `pages/AuthPage.tsx` (файл tree-shaken, НЕ импортируется — прод-логин в `HeroOperationalStage`): удалены шаг `step="recovery"`, состояние `pwdRecovery*`, `submitPwdRecovery`, кнопка «Забыли пароль?» и блок recovery-вью (мои v1.6.68-правки, легшие не в тот файл); неиспользуемый импорт `apiPath` снят; 2FA-recovery (`useRecovery`/`recoveryCode`) оставлен (легит). web+server typecheck green. **Pavel подтвердил: зашёл обычным паролем + создал recovery-коды → гейт снят, выкачено v1.6.72** (через merge master в ветку, перебивка версии 1.6.70→1.6.72). Закрывает оба хвоста v1.6.67-69.)
**Предыдущая:** **v1.6.71** (AI — +4 провайдера в @ai-цепочку (директива Pavel «внедрять все модели из батчей»). Все OpenAI-compatible, добавлены в `apps/server/src/ai/provider.ts` по существующему шаблону (env-gated, опциональны, per-provider `*_MODELS` CSV), позиция — ПОСЛЕ free (Groq/Cerebras/Yandex…), ПЕРЕД paid OpenAI: **(6c) DeepSeek** (офиц. `api.deepseek.com/v1`, `deepseek-chat`/`deepseek-reasoner`) · **(6d) GLM/Zhipu** (z.ai standard API `api.z.ai/api/paas/v4`, `glm-4.6/4.7/5.2` — НЕ Coding-Plan-подписка, та на `/api/coding/paas/v4`) · **(6e) MiMo/Xiaomi** (офиц. `api.xiaomimimo.com/v1`, `mimo-v2.5-pro`) · **(6f) Custom OpenAI-compatible** (generic slot `CUSTOM_LLM_BASE_URL`+`CUSTOM_LLM_API_KEY` — под OpenModel-промо DeepSeek-V4-Flash; URL НЕ хардкодим, провенанс шлюза не подтверждён). **⚠️ Все 4 — сторонние/КНР-провайдеры:** @ai-контент уходит к ним → env-gated, дормант до ключей, НЕ для чувствительных данных; приоритет free/локальных (Ollama/Groq) сохранён. Эндпоинты верифицированы (web). Server typecheck green; шапка `provider.ts` + root `.env.example` обновлены. **Дебанк:** ценники канала («Opus в 28×», «482₽ за 4 млрд токенов») НЕ эндорсим — модели включены как обычные дешёвые провайдеры, качество проверять на своих задачах. **Хвосты директивы:** те же провайдеры в eclipse-ai-hub / Shotforge / Text2Image (отдельные репо, свои абстракции — следующими PR); **star-crm/starmarket — ВНЕ зоны** (Вася/другой чат), держу до координации. **Note:** #71 (temp-хук cleanup) теперь перебить на **v1.6.72** при мерже.)

**Предыдущая:** **v1.6.70** (🔴 ФИКС РАСКЛАДКИ десктопа ≥1367px — широкие экраны рендерили кашу: колонка каналов раздувалась на пол-экрана, чат сжимался в полоску (заголовок «Тут о…» клипало, «Начало канала» переносилось по словам, композер схлопывался). **Причина:** override `@media (min-width:1367px) .ec-shell.ec-shell--has-server` в `responsive.css` остался ТРЁХколоночным (`288px minmax(0,1fr) 256px`) — реликт дорейловой раскладки (v0.49). С v1.6.57 базовый грид стал ЧЕТЫРЁХколоночным (`rail spine chat members`), но этот override НЕ обновили → `grid-template-columns` (3 кол.) рассинхрон с `grid-template-areas` (4 кол.: `rail brand cmd cmd` / `rail channels chat members`); CSS-grid авто-создал implicit 4-ю колонку и сдвинул треки: rail=288, channels=1fr (раздут!), chat=256, members=auto. **На ноутбуках 1025-1366 баг НЕ проявлялся** (там корректный 4-кол. override line 64) — поэтому headless-проверка рейла v1.6.57 (узкий вьюпорт) его не поймала; live-инцидент только на больших мониторах. **Фикс:** добавил `var(--ec-rail-width)` → `var(--ec-rail-width) 288px minmax(0,1fr) 256px` (4 кол., зеркало laptop-оверрайда; designed wider sidebars 288/256 для больших мониторов сохранены). Чисто CSS (1 правило `responsive.css`), web typecheck+build green. **Диагностика по задеплоенному бандлу** (fetch прод index.html→entry-JS→`AppShell-*.css` → грид-правило подтверждено сломанным в проде; не кэш Pavel'а). Деплою СРАЗУ (НЕ гейтнут). **Note:** #71 (temp-хук cleanup) был v1.6.70-гейтнут — перебить на v1.6.71 при мерже.)

**Предыдущая:** **v1.6.69** (ФИКС — «Забыли пароль?» в НАСТОЯЩЕЙ логин-форме. v1.6.68 добавил recovery-шаг в `pages/AuthPage.tsx` — но это **МЁРТВЫЙ КОД**: App.tsx рендерит `LandingPage` → `HeroOperationalStage` (`components/landing/LandingVisuals.tsx`), а `AuthPage` НИГДЕ не импортируется (потому его строк и не было в бандле — tree-shaken). **Диагностика:** греп бандла на строки AuthPage → пусто; App.tsx → `<LandingPage>`; LandingPage → `<HeroOperationalStage onLogin/onRegister>`. Перенёс recovery-флоу в `HeroOperationalStage`: state recoveryMode/recCode/recNewPwd + `submitRecovery` (fetch `/api/auth/password-recovery/reset`), ссылка «Забыли пароль?» в hint логина, recovery-вью (email+код+новый пароль, переиспускает `ec-hero-access__*` классы) + done-состояние. Бэк-эндпоинты + settings-карточка (v1.6.68) были верны — только login-UI был не в том файле. Проверка: web typecheck green, build green, **ASCII-id `hero-rec-email` ПОДТВЕРЖДЁН в бандле** (`index`-чанк, LandingPage eager). **Урок:** прод-логин = `HeroOperationalStage`, НЕ `pages/AuthPage.tsx` (последний — dead code, кандидат на удаление). e2e проверить живьём. **Хвосты:** почистить dead `AuthPage.tsx` recovery-правки; удалить temp owner-lockout-хук после подтверждения доступа.)

**Предыдущая:** v1.6.68 (Безопасность/recovery — self-serve сброс пароля по одноразовым кодам (Pavel просил «кнопку сброса пароля»; выбрал вариант B — recovery-codes, без email/SMTP, т.к. SMTP в EC нет). Full-stack. **Схема+миграция:** новое nullable-поле `User.passwordRecoveryCodes` (JSON bcrypt-хэшей; миграция `20260621120000_add_password_recovery_codes`, аддитивный `ALTER TABLE ADD COLUMN TEXT` — деплой гонит `prisma migrate deploy`). Переиспользованы generic-хелперы `generateRecoveryCodes`/`verifyRecoveryCode` из `security/twoFactor.ts` (тот же формат что 2FA, отдельный набор). **Бэк (`routes/auth.ts`):** `POST /api/auth/password-recovery/generate` (authed + re-confirm пароля, sensitive → коды обходят пароль; 10 кодов 1 раз, перезапись старых) + `POST /api/auth/password-recovery/reset` (UNAUTHED: email case-insensitive + код + новый пароль → verify+consume код, set пароль, `resetLockout`, гасит сессии; anti-enumeration generic-ответ + constant-time на несуществующем user'е; audit `AUTH_PASSWORD_CHANGE` via:recovery_code). Enum AuditEventType НЕ расширял (переиспользовал значения). **Фронт:** самодостаточный `PasswordRecoveryCard` в Настройки→Безопасность (свой state, `apiJson`, показ кодов 1 раз + копирование) + новый шаг `recovery` в `AuthPage` («Забыли пароль?» на логине → email+код+новый пароль; переиспользует ec-auth-классы/PasswordReveal). web+server typecheck green (после `prisma generate`), build green. **Verified-by-construction** (переиспользует проверенные классы); **e2e (генерация→сброс) проверить живьём.** **Хвост:** удалить временный owner-lockout-хук (v1.6.69) после подтверждения Pavel'ом доступа + генерации им кодов.)

**Предыдущая:** v1.6.67 (HOTFIX — owner login-lockout clear на старте. Pavel заблокирован brute-force login-локом на мобиле (мис-ввод пароля → 5 неудач → 15-мин лок в БД `User.failedLoginAttempts/lockoutUntil`), восстановиться не мог: self-serve reset в EC НЕТ, платформенный reset под админ-логином (а owner заблокирован), прямого доступа к БД у меня нет. Email-lookup case-insensitive (`mode:insensitive`) — почта/мобильная автокапитализация ни при чём; чистый мис-пароль. Фикс: одноразовый boot-хук в `index.ts` (после registerPlatformRoutes) — `db.user.updateMany({where:{isPlatformOwner:true, locked/attempts>0}, data:{failedLoginAttempts:0, lockoutUntil:null}})`. **Пароль НЕ трогаем** — только снимаем лок, owner вводит свой верный пароль; success сам обнуляет счётчик. Без env-гейта (одноразовый деплой). **⚠️ ВРЕМЕННО — удалить в v1.6.68** после восстановления доступа (иначе owner-лок постоянно сбрасывается на рестарте). server typecheck green. **Фоллоу-ап (Pavel просил):** self-serve «забыли пароль» — настоящий must-fix (нужен канал доставки токена: email/SMTP — проверить инфру).)

**Предыдущая:** v1.6.66 (EC продукт — **typing-индикатор в ЛС (full-stack, первый бэк-слайс сессии)**. Pavel уточнил: EC он делает ОДИН, `apps/server` — моя зона (Вася = StarMarket, не EC), поэтому бэк-фоллоу-апы НЕ заблокированы. Зеркало канал-typing для ЛС-room. **Бэк** (`index.ts`): `dm:typing:start/stop` хендлеры → broadcast в `dm:${conversationId}` (исключая sender); membership-verify через `loadConversationMembers`/`isDmMember` из `routes/dm.ts` (1:1 + группы, защита от spoof'а в чужой диалог); ephemeral, без DB-записи. **Socket** (`lib/socket.ts`): события `DmTypingStart/Stop` + payload-типы. **Клиент** (`useDirectMessages.ts`): `typingUsers` state + per-user 5s auto-expire таймеры + emit/receive (точное зеркало useMessages); сброс при смене диалога. **Вринг** (`AppShell.tsx`): DM-композер `onTypingStart/Stop` (был no-op `() => undefined`) → emit; `<TypingIndicator>` в DM-области (переиспользован канал-компонент). **Дисплей** (Telegram): «печатает…» (accent) замещает статус в шапке 1:1 (`DmPeerHeader typing`), «X печатает…»/«X, Y печатают…» в шапке групп (`DmGroupHeader typingNames`). MessageInput троттлит (один start за burst) → серверная нагрузка ок. Web+server typecheck green, build green; headless-verify состояний шапки. **⚠️ Live round-trip (2 юзера) проверить вживую** (как AI — socket-цепочку headless не прогнать); клиент+сервер зеркалят рабочий канал-typing → высокая уверенность. **Фоллоу-ап:** «печатает…» в СТРОКАХ списка ЛС (нужно глобальное typing-состояние по всем диалогам, не только активному), lastSeen.)

**Предыдущая:** v1.6.65 (EC продукт — presence в шапке ГРУППОВЫХ ЛС (Telegram-паритет, завершает presence-тему ЛС). Раньше шапка групп-ЛС = только аватар-стопка + название. Теперь под названием — подзаголовок **«N участников · M в сети»**, симметрично 1:1-шапке (v1.6.63). Новый компонент `components/DmGroupHeader.tsx` (GroupAvatar 26px + 2-строчный заголовок), подключён в `AppShell.tsx` в ветке chat-header для групп (`selectedDm.isGroup`); импорт `GroupAvatar` уехал из AppShell в компонент. `participants` включает текущего юзера (deriveGroupTitle исключает его из названия) → length = размер группы. «В сети» считается по live `manualStatus` участников через общий `dmStatusMeta` (active = ONLINE/IDLE/DND), показывается только при M>0. RU-плюрализация «участник/участника/участников» (edge-кейсы 1/21→участник, 2-4→участника, 11-14→участников верны). Чисто клиент (`DmGroupHeader.tsx` нов., `AppShell.tsx`), typecheck (`noUnusedLocals`)+build green; headless-verify 4 кейса (5/1/2/21 участников) на реальном CSS. **Presence-тема ЛС закрыта** (шапка 1:1 + список + шапка групп). **Фоллоу-ап (нужен бэкенд):** typing-индикатор в ЛС (useDirectMessages не имеет typing — нет socket-событий), lastSeen у offline.)

**Предыдущая:** v1.6.64 (EC продукт — presence в СПИСКЕ ЛС теперь корректный + DRY с шапкой. Продолжение v1.6.63: при разработке presence-шапки выяснилось, что presence-точки в **списке** ЛС (`DirectConversationList`) всегда серые в режиме ЛС — они брали онлайн из `onlineUserIds` (= server-members), а `useMembers(null)` возвращает [] вне сервера. Т.е. даже у ONLINE-собеседника точка была серой. Фикс: общий хелпер `lib/dmPresence.ts` (`dmStatusMeta` — manualStatus→{color,label,active}), используется И в шапке (`DmPeerHeader`, рефактор с локального map), И в списке. В списке `manualStatus` теперь приоритетен (live по socket), members-online — лишь fallback при отсутствии manualStatus. Так точки в списке отражают реальный статус (зелёная/золотая/красная/серая) и **совпадают по цвету с шапкой**. Удалён мёртвый локальный `presenceColor` + `showOnline`-ветка (теперь `statusMeta.active`). Чисто клиент (`lib/dmPresence.ts` нов., `DmPeerHeader.tsx`, `DirectConversationList.tsx`), typecheck (`noUnusedLocals`)+build green; headless-verify 5 состояний строк списка на реальном CSS (ONLINE=зелёная с glow, было серо). **Фоллоу-ап тот же:** lastSeen у offline (нужен бэкенд), presence участников групп-ЛС.)

**Предыдущая:** v1.6.63 (EC продукт — presence в шапке 1:1 ЛС (Telegram-паритет). Pavel: «EC продукт/веб». Раньше шапка личного диалога = только аватар + имя; теперь под именем — статус собеседника + presence-точка на аватаре, как в Telegram. Новый компонент `components/DmPeerHeader.tsx` (аватар 26px + presence-точка bottom-right + 2-строчный заголовок имя/подзаголовок), подключён в `AppShell.tsx` в ветке chat-header для 1:1 (группы/Избранное не тронуты). **Источник присутствия — `selectedDm.other` из `useDirectConversations`** (`manualStatus` ONLINE/IDLE/DND/INVISIBLE + кастом-статус `activityEmoji`/`activityText`, live-обновляются по socket). **Важно (data-model):** НЕ опираемся на server-members — `useMembers(null)` возвращает [] в режиме ЛС (activeServerId=null), поэтому `onlineUserIds` там пуст; presence ЛС живёт ТОЛЬКО в DmOther. **Безопасно:** точка+статус-лейбл показываются ТОЛЬКО при заданном `manualStatus`; кастом-активность (приоритетнее лейбла, как Telegram) — при наличии; при отсутствии данных — просто имя (ничего не выдумываем). Цвета — общие токены `--ec-presence-*`. Чисто клиент, typecheck (`noUnusedLocals`)+build green; headless-verify 5 состояний (online/idle/dnd/custom/none) на реальном CSS — двухстрочный заголовок не клипает (header 48-52px). **Фоллоу-ап:** «последний раз в сети» (lastSeen) у offline-собеседника — нужен бэкенд-сигнал; presence для участников групп-ЛС.)

**Предыдущая:** v1.6.62 (AI — РФ-провайдер YandexGPT как приватный/надёжный запасной к keyless-Pollinations. Pavel: «давай» на РФ free-tier. Добавлен 6b-й провайдер в `ai/provider.ts` — **YandexGPT** через **OpenAI-compatible** эндпоинт Yandex Cloud (`llm.api.cloud.yandex.net/v1`). Встал в цепочку чисто, БЕЗ нового call-кода: auth `Api-Key <key>` (не Bearer) переопределён через `extraHeaders.Authorization` (spread идёт после дефолтного Bearer → бьёт его); модель = URI `gpt://<folder>/<model>` — короткие имена авто-оборачиваются (`.map`), полные `gpt://` оставляются. Требует ДВЕ env: `YANDEX_API_KEY` + `YANDEX_FOLDER_ID` (env-gated → дормант пока Pavel не впишет). Позиция: после Mistral, ПЕРЕД OpenAI и Pollinations (free-RU-private важнее paid и keyless-public). **Почему Yandex, а не GigaChat:** стандартный TLS (GigaChat требует российский CA-сертификат на сервере = инфра/Вася + OAuth-токен-флоу вместо статик-ключа — тяжелее и непроверяемо). **⚠️ Не проверен живьём** (нет ключа на тест) — построен по докам Yandex Cloud OpenAI-compat; когда Pavel впишет ключ+folder и проверит, если детали (endpoint/auth/model-URI) не сойдутся — итерирую. Server typecheck green; header-доку + `.env.example` обновлены. **Получить ключ:** Yandex Cloud → создать каталог + сервисный аккаунт с ролью `ai.languageModels.user` + API-ключ; folder_id из консоли. **Фоллоу-ап:** если Pavel сможет только GigaChat (Sber ID проще регать) — доделаю его OAuth+CA (нужен Вася для cert).)

**Предыдущая:** v1.6.61 (AI — keyless free-LLM для @ai (Pollinations), чтобы AI ожил БЕЗ ключей. **Контекст:** провайдеры Groq/Cerebras/Mistral (v1.6.53) требуют free-ключей, но регистрация западных AI-сервисов из РФ Pavel'у недоступна → AI был дормант. Решение: добавлен 8-й провайдер в `ai/provider.ts` — **Pollinations** (`text.pollinations.ai/openai`, OpenAI-compatible, **keyless**, протестирован: `/openai/chat/completions` совместим с call-логикой один-в-один, dummy Bearer). Включён **ПО УМОЛЧАНИЮ** и стоит **последним** в цепочке (Ollama→…→OpenAI→**Pollinations**): любой реальный ключ выше важнее, но когда ключей нет — @ai всё равно живой. Отключить: `POLLINATIONS_DISABLED=1`. **Приватность:** шлём `private:true` (генерация НЕ в публичную ленту Pollinations) + `referrer`; для этого в `ProviderConfig` добавлен `extraBody` (provider-specific JSON-поля, мерджатся поверх base body — не содержит model/messages). Как у любого cloud-LLM, контент @ai уходит на внешний сервис — для полной приватности Pavel выбрал держать опцией Ollama (self-host, не сейчас). **Надёжность:** анонимный tier rate-limited (наблюдал 429 / таймаут на сложных промптах) — сглаживается существующим retry/backoff (429/5xx) + model-fallback; это **best-effort free**, но строго лучше мёртвого @ai. Модель по умолчанию `openai` (override `POLLINATIONS_MODELS` CSV). `isAiConfigured()` теперь ВСЕГДА true (если не отключён). Server typecheck green; `.env.example` + header-доку обновлены. **Выбор Pavel** из 3 опций (Pollinations сейчас / РФ free-tier GigaChat-Yandex / self-host Ollama). **Фоллоу-апы:** если Pollinations часто 429 — добавить РФ-провайдер (GigaChat/YandexGPT, приватнее) или Ollama; качество модели на длинном контексте проверить живьём.)

**Предыдущая:** v1.6.60 (Гигиена — выпил мёртвого topbar-CSS (cleanup-слайс после упрощения). Упрощение v1.6.46-47 удалило топбар-виджеты (телеметрия-пилюли NET/MEM/CPU · sparkline · network-wave · SpiderClock · utility-meters + focus-режим), но их CSS остался размазанным по 5 файлам. Греп-аудит подтвердил **ноль JSX-производителей** у всего family → ~200 строк мёртвого CSS снято: `tokens.css` (`.ec-telemetry`/`-pill*` + keyframe `ec-telemetry-risk-pulse`), `motion.css` (`.ec-telemetry-edge` + keyframe `ec-telemetry-sweep`), `effects.css` (весь блок `.ec-spider-clock*` ~86 строк + @900px override), `components.css` (`.ec-sparkline*` + `.ec-net-wave*` + keyframe `ec-net-wave-bar` + 4 группы `.ec-shell__utility-meters*`), `responsive.css` (telemetry-pill mobile-hide + utility-meters media-queries + spider-clock). **Хирургия в групповых селекторах:** где dead-классы делили правило с живыми (`.ec-music-mini-player` — РЕНДЕРИТСЯ в AppShell:1487; `.ec-theme-toggle`/`.ec-shell__user-chip`/`.ec-logout-btn`), удалял ТОЛЬКО мёртвые строки, живые сохранял; в reduced-motion и aria-label группах (`.ec-icon-btn[aria-label="Инциденты"/"Уведомления"]` — кнопки удалены) — то же. `useTelemetry`-хук жив (voice-статы в VoiceRoom через другую разметку, не `.ec-telemetry*`) — НЕ тронут. Бандл: index.css 170.3→166.7 kB, AppShell.css 349.9→346.6 kB (~7 kB сырого CSS). build green (PostCSS скомпилировал → синтаксис цел). Verify-by-construction: классов нет в DOM → удаление их правил не меняет рендер. **Codex-adjacent shell** — branch от свежего origin/master (7d4305f). ROADMAP сам помечал «полный выпил — отдельным cleanup-слайсом»: закрыто. Кандидаты на будущее: мёртвые JS-флаги `homeOpen`/`selectedTableId` (always-false, читаются в breadcrumb → не unused-local).)

**Предыдущая:** v1.6.59 (Дизайн — Discord-каркас, слайс 3/3: **разгрузка топбара**. Завершает 3-слайсовую дугу «Discord-каркас» (Pavel выбрал из 3 макетов). Командный бар (`ec-shell__cmdbar`) нёс смешанный кластер инструментов+идентичности; три вторичные утилиты — **🌓 Тема (VOID/SOLAR) · 🔔 Уведомления · ❔ Справка** — переехали из всегда-видимого топбара в **профиль-меню за аватаром** (`StatusMenu`), модель Discord/Telegram «аватар = хаб аккаунта». В топбаре остаются постоянные действия: Поиск · AI (флагман) · Участники · аватар-чип · Выход (подписная анимация двери — функц. акцент, не режем); админ-иконки (Админ/Platform-Админ) оставлены — они и так role-gated, не шум для 95%. Для обычного юзера топбар ужался ~8→5 элементов. `StatusMenu` расширен опциональными `themeSlot` (рендерит `<ThemeToggle/>` строкой «Оформление») + `tools[]` (Уведомления с live-hint/active/dim, Справка); уведомления/тема — `closeOnClick:false` (щёлкнул-увидел), Справка закрывает меню. **Боковой риск устранён:** тему применял ТОЛЬКО `ThemeToggle` в mount-эффекте; в lazy-меню он на старте не монтируется → SOLAR не вставал бы до открытия меню. Применение темы (`data-ec-theme=solar`) добавлено в существующий анти-FOUC boot-скрипт `index.html` (рядом с density/focus-dim) — заодно убирает FOUC темы; `<ThemeToggle/>` и в Settings→Внешний вид не тронут. Чисто клиент (`AppShell.tsx` cmdbar-чистка + StatusMenu-проп, `StatusMenu.tsx`, `index.html`). typecheck (`noUnusedLocals`)+build green. **Codex-adjacent shell** — branch от свежего origin/master (7c47faf), rebase-чек перед merge. Десктоп headless-verify раскладки. **Дизайн-дуга Discord-каркас завершена (3/3).** Дальше — на выбор Pavel: доводка AI после ключей · мобильный фикс таб-бара по фидбеку · новая тема.)

**Предыдущая:** v1.6.58 (Дизайн — Discord-каркас, слайс 2/3: **мобильный нижний таб-бар**. Новый `components/BottomNav.tsx` — 4 таба под большой палец (Серверы / Личные / Друзья / Я); активный таб из состояния (`showProfile→Я · friendsOpen→Друзья · inDmMode→Личные · else→Серверы`); хендлеры маппят на существующие состояния (Личные/Серверы открывают левый drawer-список каналов/ЛС). `position: fixed` нижний бар (token `--ec-bottomnav-height:56px`, CSS `.ec-bnav-*` в clean-ui.css, `safe-area-inset-bottom`); drawers (каналы/участники) подняты над баром (`bottom: var(--ec-bottomnav-height)` в responsive.css), чат-область получила `padding-bottom` под бар. Рендерится только на ≤1024 (`isMobile`). **АДДИТИВНО** — гамбургер-дровера оставлены как fallback (мобилка навигабельна даже если таб-бар потребует правки). Чистый клиент; typecheck+build green. ⚠️ **Mobile НЕ удалось headless-проверить** — выяснено минимальным тестом: headless-Edge не уважает `--window-size` для CSS-viewport (рендерит ~500px вместо 390 → ложный клип 4-го таба у ЛЮБОГО fixed-flex бара, даже без app-CSS). Код = стандартный fixed-flex паттерн, build green — но **нужна проверка на реальном устройстве/моб-эмуляции** (Pavel). Десктоп-рейл (слайс 1) проверялся headless ОК (там нет viewport-коллапса). **Дальше:** слайс 3 — разгрузка топбара.)

**Предыдущая:** v1.6.57 (Дизайн — Discord-каркас, слайс 1/3: **постоянный левый server-rail (веб)**. Pavel выбрал из 3 ASCII-макетов «Discord-каркас». Вернул far-left вертикальный рейл-иконок (реверс v1.1.51 «rail→топбар»): Главная + ЛС (с unread-бейджем) + список серверов (active = violet left-pill + accent-bg, Discord-стиль `border-radius` square→rounded на hover/active) + создать/вступить. **Смена сервера теперь в 1 КЛИК** (было: открыть дропдаун→выбрать). Новый компонент `components/ServerRail.tsx` (переиспользует `ServerIcon`, экспортирован из ServerSwitcher), грид-колонка `rail` в `responsive.css` (token `--ec-rail-width: 68px`; обновлены desktop has-server/no-server грид + laptop-брейкпоинт + комментарий v1.1.51), CSS `.ec-rail-*` в `clean-ui.css`. На desktop топбарный `ServerSwitcher` скрыт (рейл его заменил, общие nav-хендлеры `navSelectServer`/`navOpenDms`); на mobile рейл НЕ рендерится — нижний таб-бар будет в слайсе 2. Чистый клиент. typecheck (`noUnusedLocals`)+build green; **headless-рендер на реальных CSS подтвердил раскладку** (рейл+спайн+чат+участники, active-pill, badge). **Codex-adjacent shell** — branch от свежего origin (master 207b7b2), rebase-чек перед merge. **Дальше:** слайс 2 (мобильный нижний таб-бар Чаты/Серверы/Друзья/Я), слайс 3 (разгрузка топбара).)

**Предыдущая:** v1.6.56 (Микрокопия — plain-language + точность (доработка EC под «максимально просто и понятно»; разведка по моим зонам чат/ЛС/поиск, не трогая voice/settings/categories=Codex, каждый кейс верифицирован по коду). (1) SearchOverlay placeholder `ЗАПРОС_ПОИСКА // сообщения · задачи · файлы…` (leftover tactical-жаргон старого surface-language) → `Поиск по сообщениям, каналам, файлам…`. (2) SearchOverlay no-results hint ссылался на **«таблицу»** — фичу, ВЫРЕЗАННУЮ в slice 1-2 (Operational Tables) → убрал устаревшую ссылку (точность). (3) DM-пустое состояние: 2-шаговая инструкция «Открой профиль участника и нажми «Написать в личку»…» → концис «Начни переписку через «Друзья» выше или собери группу кнопкой ＋» (указывает на on-screen affordances, минимум движений) + дружелюбнее title «Пока нет диалогов». Чисто клиент (`SearchOverlay.tsx` + `DirectConversationList.tsx`), typecheck+build green. Note: Esc-закрытие create-модалок проверил — уже работает (Modal.tsx гасит Escape; наводка разведки была неверной, не трогал).)

**Предыдущая:** v1.6.55 (Voice: быстрее подключение + presence мгновенно для всех (жалоба Pavel «долгое подключение в голосовую + все должны видеть кто в голосовых»). **Диагноз:** серверный voice-presence УЖЕ полный и server-wide (`buildVoicePresenceSnapshot` = снимок ВСЕХ VOICE-каналов ВСЕХ серверов юзера + дельты `voice:participant:*` в `server:${id}` room, куда все члены join'ятся на connect, + 30s re-poll + reconnect). Корень — **тайминг клиентского join** (`useVoice.ts`): (1) token-fetch и lazy-import `livekit-client` (~140KB gzip) шли ПОСЛЕДОВАТЕЛЬНО → `Promise.all` (overlap, max вместо sum); (2) `voice:join` presence-broadcast эмитился ТОЛЬКО ПОСЛЕ полного LiveKit-connect → 1-3s остальные не видели тебя в комнате → теперь эмитим РАНО (сразу после token, до connect), на провал connect — откат `voice:leave` (флаг voiceJoinEmitted); (3) `AppShell` префетчит `livekit-client` при открытии VOICE-канала (до клика «подключиться») — к join() либа уже в кэше (bundle-split цел: платят только зашедшие в голосовой). Чисто клиент (`useVoice.ts` + `AppShell.tsx`), typecheck+build green. **Codex hot-domain** (voice — его), branch от свежего origin (master 87a831c, без Codex-пуша), rebase перед merge. Остаток вне кода: сам `r.connect` (LiveKit-инфра RTT/ICE/локация сервера) — серверная латентность.)

**Предыдущая:** v1.6.54 (AI-помощник «Что я пропустил» — рефайн (Pavel выбрал из Phase-2: one-tap AI-сводка непрочитанного вместо скролла). Фича УЖЕ была (since-last-visit infra: `/api/channels/:id/visit` дельта + `/api/channels/:id/since-summary` AI-проза + one-tap кнопка в `SinceLastVisitBanner`). Под директиву «минимум движений, без шума»: CTA переименована «✦ Что произошло» → **«✦ Что я пропустил»** (формулировка Pavel), loading → «Читаю историю…»; убран самый шумный блок (3-item recent-actions список + мёртвый `typeGlyph`). Остались компактные счётчики + инцидент + AI-проза-резюме (hero). Чисто клиент (`SinceLastVisitBanner.tsx`), typecheck (`noUnusedLocals`)+build green. **Channel-only** (для ЛС нужны `/api/dm` visit+summary эндпоинты — follow-up). **Live-активация:** AI-проза работает только когда заданы LLM-ключи (провайдеры v1.6.53). **Phase-2 follow-up:** AI-first prominence (CTA крупнее/primary), DM-поддержка — лучше после живого взгляда Pavel + ключей.)

**Предыдущая:** v1.6.53 (AI: +3 бесплатных LLM-провайдера в @ai-цепочку — **Groq / Cerebras / Mistral** (директива Pavel «подключать бесплатные ллм модели для помощи, минимум движений»). Все OpenAI-compatible, добавлены в `ai/provider.ts` по существующему шаблону (env-gated, опциональны, per-provider `*_MODELS` CSV-фолбэк). Новая priority-цепочка авто-фолбэка: Ollama → **Groq** → **Cerebras** → OpenRouter → NVIDIA → **Mistral** → OpenAI — чем больше free в цепочке, тем надёжнее @ai для пользователя (на 429 одного → следующий, уже есть retry/backoff). Дефолт-модели (overridable env): groq=`llama-3.3-70b-versatile`, cerebras=`llama-3.3-70b`, mistral=`mistral-small-latest`. `.env.example` получил AI-секцию. Server typecheck green; чисто аддитивно. **ТРЕБУЕТ от Pavel:** добавить free API-ключи в prod-env (бесплатная регистрация console.groq.com / cloud.cerebras.ai / console.mistral.ai) — код дормант пока ключей нет. **РАЗВОРОТ НАПРАВЛЕНИЯ:** AI теперь = помощник для упрощения UX (минимум движений), поэтому ранее намеченный CUT Channel-Info AI-вкладок (Memory/Execution/Since-last-visit) ОТМЕНЯЕТСЯ — AI-помощников растим, не режем. **Phase 2 (предложить Pavel):** конкретные простые AI-помощники под «минимум движений» — proactive summary «что я пропустил» / compose-help / one-tap answers.)

**Предыдущая:** v1.6.52 (Упрощение до ядра — слайс 8: удаление admin-вкладки «Аналитика» (always-visible, но **дублирует дашборд «Здоровья команды»** — те же метрики Открыто/Просрочено/Без-ответственного/среднее-закрытие; Здоровье остаётся как настоящий дом этих метрик). Из `AdminPanel.tsx` вырезаны: `analytics` из Tab-union, nav-кнопка, content-рендер (StatCard-грид) + локальные хелперы `StatCard` + `formatDurationShort` (использовались ТОЛЬКО этим табом). **`teamHealth`-проп ОСТАВЛЕН** (используется в overview-табе) → AppShell не тронут, cross-component coupling нет. AdminPanel-чанк 43→41 KB. typecheck (`noUnusedLocals`) + build green. Не трогал (отдельные слайсы/блокеры): Bots-таб (ServerHubModal, **@ai-риск** — bots могут быть точкой включения агента, нужна проверка), Automation-таб (большой: `AutomationRow` + 5 типов + create-form + 3 хендлера), Invoices-таб (gated `serverMode==="CLIENT"`, ждёт миграции CLIENT-режима). **Diminishing returns достигнуты** — ядро острижено (8 слайсов, ~9900 строк удалено); остаток требует: @ai-проверки (bots), объёма (automation), approval-миграции (CLIENT/invoices), живого взгляда Pavel (дизайн-полировка батч 2).)

**Предыдущая:** v1.6.51 (Упрощение до ядра — слайс 7: удаление admin-вкладки «Интеграции» (вебхуки + Composio-коннекторы — advanced, не ядро). Из `AdminPanel.tsx` вырезаны: `integrations` из Tab-union, nav-кнопка, content-рендер, 4 state-переменные (`integrations`/`...Loading`/`...Error`/`showCreateIntegration`) + lazy-fetch effect + 2 импорта → удалены 2 файла `AdminIntegrationsTab.tsx` + `ComposioConnections.tsx` (использовались ТОЛЬКО этой вкладкой). **@ai НЕ затронут** — встроенный агент живёт в `ai/assistant.ts` (server-side, через `ai/provider`), независим от integration-UI; серверные роуты integrations/composio оставлены (per решение «@ai остаётся»; composio ещё нужен `ai/botRoles.ts`). AdminPanel-чанк 64→43 KB (~21 KB advanced-кода долой). typecheck (web `noUnusedLocals`+`noUnusedParameters`) + build green. **Осталось из admin-вкладок:** «Боты» (`BotsTab`) живёт в `ServerHubModal` (+ AppShell `serverHubTab` union содержит «bots») — отдельный слайс из-за cross-component type-coupling; вкладки «Автоматизации»/«Аналитика»/«Счета» — по запросу. **Следующее:** ServerHub bots-таб; дизайн-полировка батч 2; с «да» Pavel — миграция-снос CLIENT-режима.)

**Предыдущая:** v1.6.50 (Упрощение до ядра — слайс 6: удаление Клиентского портала (CRM-вью внешнего клиента — не Telegram/Discord, был в CUT-листе). **Удалены 4 файла:** `pages/ClientPortalContainer.tsx` + `pages/ClientPortalPage.tsx` + `hooks/useClientPortal.ts` (клиент) + `routes/clientPortal.ts` (сервер; импортёр — только index.ts). `App.tsx`: вырезана вся portal-маршрутизация (`#/portal/<id>` hash-route, `PORTAL_HASH_RE`, `portalServerId` state + parseLandingHash-ветка, `ClientPortalContainer`-рендер) → authenticated всегда = AppShell; auth-panel hash + unknown-route логика целы. AppShell: убраны 2 прохода `onOpenClientPortal` (ChannelList + AdminPanel — кнопки «Открыть портал» больше не передаются). index.ts: снят clientPortal импорт + регистрация. **CLIENT-режим (`Server.mode`) НЕ тронут** — это Prisma-поле, полный снос = миграция схемы (нужен явный «да» Pavel — отдельный слайс); пока CLIENT остаётся calm-UI флагом без портала (осиротевший optional `onOpenClientPortal`-проп + gated-кнопка в ChannelList/AdminPanel оставлены — безвредны, never-render, чистка позже). Web+server typecheck (web `noUnusedLocals`) + build green; ClientPortal-чанк ушёл из бандла. Старые `#/portal/X`-ссылки теперь → 404 (фича удалена). **Следующее:** дизайн-полировка батч 2; либо удаление admin-вкладок интеграций/ботов + (с «да» Pavel) миграция-снос CLIENT-режима + роутов invoices/analytics.)

**Предыдущая:** v1.6.49 (Упрощение до ядра — слайс 5 (дизайн-полировка, батч 1): де-нойз пустых состояний + токен-гигиена в духе «Telegram × Discord». `.ec-empty-state__icon` (components.css): убраны бесконечный `ec-empty-icon-breath` (5.6s) + **cyan** orbit-кольцо `::after` (`hsl(180 70% 55%)` — off-brand палитра, revoked в пользу violet+gold; + `ec-empty-orbit` 18s infinite spin) → оставлен один статичный violet-халоу `::before`. `.ec-empty-state__title`: снят gradient text-fill (violet→text + `-webkit-text-fill-color: transparent`) → solid; inline `titleStyle` в `EmptyState.tsx` поднят на `--ec-text-strong` (inline перебивает класс — оба теперь strong, без градиента). DM-список (dm-home.css): `.ec-dmx-row.is-active .ec-dmx-row__pres` хардкод `#10151c` → наследует `--ec-surface-1` из базы (ломал светлую тему на активной строке). Одна правка затрагивает ВСЕ пустые состояния (ЛС/каналы/дом/и т.п.). Чисто CSS + 1 inline-color. typecheck (`noUnusedLocals`) + build green; deterministic removal → verify by-construction (как de-noise v1.6.41-45). **Решение Pavel 19.06:** @ai-агент в чате ОСТАЁТСЯ → роуты bots/composio/integrations/automations НЕ режем. **Следующее:** ещё полировка дома/ЛС (presence в DM-header = Telegram-паритет и т.п.); отдельный слайс — удаление admin-вкладок интеграций/ботов + ClientPortal (клиент) → затем их серверные роуты.)

**Предыдущая:** v1.6.48 (Упрощение до ядра — слайс 3: прунинг серверных роутов. Удалены 3 файла: `routes/tables.ts` / `routes/incidents.ts` / `routes/home.ts` + их импорты и регистрации в `index.ts`. Это **единственные** роуты, чьи клиентские потребители уже на 100% сняты (хуки `useOperationalTables`/`useIncidents`/`useHomeToday` удалены в слайсе 2). Верификация перед резом: импортёр — только `index.ts` (нет server cross-import'ов), нет vitest-тестов на эти эндпоинты, `actions.ts` НЕ тронут (Здоровье + Codex). Прочие «advanced»-роуты (invoices / analytics / integrations / composio / bots / clientPortal) **ОСТАВЛЕНЫ** — у них ещё живые клиентские вызовы (admin-вкладки / клиентский портал / `@ai`-агент в чате, который handled не в messages.ts → в bots/composio); их прунинг — только после удаления соответствующих клиентских потребителей. Prisma-схема не тронута (миграций нет — модели в БД остаются). Server typecheck (`tsc -p --noEmit`) green; unit-тесты гоняет CI. `realtime.ts` emitIncident* стали dead exports (безвредно, не unused-local). **Следующее:** слайс 4 (Здоровье команды на тонком task-бэкбоне), слайс 5 (дизайн «Telegram × Discord»); отдельный слайс — admin-вкладки интеграций/ботов + ClientPortal + решение по @ai → затем их серверные роуты.)

**Предыдущая:** v1.6.47 (Упрощение до ядра — слайс 2: физическое удаление мёртвого кода вырезанных в слайсе 1 модулей. **Удалены 9 файлов**: компоненты `HomeToday` / `OperationalTablePanel` / `CreateTableModal` / `IncidentPanel` / `SpiderClock` / `TelemetryViz` + хуки `useHomeToday` / `useOperationalTables` / `useIncidents` (единственный реальный импортёр — AppShell; остальные совпадения grep'а — комментарии). Из `AppShell.tsx` убраны: 4 lazy-импорта + 3 хук-импорта + вызовы (useOperationalTables-деструктур, useIncidents, useHomeToday) + 4 рендер-ветки (таблица-панель / HomeToday / IncidentPanel / CreateTableModal) + осиротевший хендлер `openActiveServer`. Мёртвые флаги `homeOpen`/`selectedTableId` оставлены (always-false/null; читаются в breadcrumb/`activeTableId`, поэтому `noUnusedLocals` не падает) — полный выпил состояния отдельным cleanup-слайсом; `showIncidents` выпилен полностью (больше нигде не читался). **StatusBoard / ActionItemDrawer / TeamHealth НЕ тронуты** (Здоровье на тонком task-бэкбоне — слайс 4). Из бандла ушли чанки HomeToday/OperationalTablePanel/IncidentPanel/CreateTableModal/SpiderClock/TelemetryViz. typecheck (`noUnusedLocals: true`) + `vite build` green. Серверные роуты tables/incidents/home — слайс 3. **Следующее:** слайс 3 (прунинг серверных роутов: tables/incidents/integrations/automations/composio/bots/clientPortal/invoices/analytics, `actions.ts` оставить), слайс 4 (Здоровье на тонком бэкбоне), слайс 5 (дизайн-полировка «Telegram × Discord»).)

**Предыдущая:** v1.6.46 (Упрощение до ядра — слайс 1: IA-реформа + прунинг навигации. Директива Pavel: «упростить EC до ядра — тренировки, здоровье команды, создание комнат, чаты, ЛС; сделать смесью Telegram × Discord». **Топбар-declutter** (командный бар нёс много шума): убраны focus-режим, инциденты-бейдж, телеметрия-пилюли (сеть/память/CPU + Sparkline/NetworkWave + хук useTelemetry), SpiderClock — остаются поиск/справка/админ/platform-admin/уведомления/AI/тема/профиль/выход. **Сайдбар**: standalone «Доска задач» и «Операционные таблицы» убраны из навигации (`onOpenStatusBoard/tables/onOpenTable/onCreateTable` → undefined) вместе с их Ctrl+K quick-nav записями; Доска остаётся drill-down целью из «Здоровья команды» (не самостоятельный вход). HomeToday уже не лендинг (главная = ЛС+Друзья, Telegram-паттерн — было ранее). **Остаются**: голос целиком, Друзья (Discord), Тренировки, Здоровье команды, каналы (текст/голос), ЛС. Чистая правка `AppShell.tsx` — только entry-points; код вырезаемых модулей живёт до slice 2 (lazy-чанки HomeToday/OperationalTablePanel/IncidentPanel ещё собираются, но недостижимы). typecheck `tsc -b` + `vite build` green. Коллизия с Codex обойдена: серверный `actions.ts` не тронут (Здоровье — на тонком task-бэкбоне, slice 4). **Следующие слайсы:** 2 — физ. удаление мёртвых клиент-модулей (HomeToday/Tables/Incidents/тяжёлый StatusBoard/ClientPortal/admin-интеграции-боты/декор); 3 — прунинг серверных роутов; 4 — Здоровье на тонком task-бэкбоне; 5 — дизайн-полировка «Telegram × Discord».)

**Предыдущая:** v1.6.45 (De-noise pass — слайс 5: chat-header + chat-фон + galaxy (последний — с явного «да» Pavel на signature-элемент). `.ec-chat-header`: убраны triple-layer radial-ауры (violet+cyan) → плоская подложка, holo-рейл `::before` → none, violet inset-glow и EOF violet drop-glow (`hsl(258 90% 62% / .74)`) → тонкая нижняя кромка. `.ec-shell__chat`: убраны radial-ауры фона чата → плоская подложка. **galaxy-backdrop** приглушён (умеренно, не снесён — остаётся брендовой атмосферой): auth 0.62→0.30, home 0.42→0.20, in-app shell 0.32→0.12 (едва уловим за контентом). Чисто CSS. Verify by-construction + build green. Pinned/AI message-маркеры (gold/accent border) оставлены — функциональные, не glow. **De-noise (умеренно) по сути завершён** — флагман спокойный: чистые поверхности + функциональные акценты. Дальнейшее — точечно по запросу.)

**Предыдущая:** v1.6.44 (De-noise pass — слайс 4: прочие list-row'ы. Консолидированным override-блоком (после всех row-дефов) убраны у `friend-row` / `member-row` / `search-hit` / `popover-item` / `srv-menu-row` / `dm-row`: hover-slide (`translateX`) и violet drop-shadow на hover (→ `--ec-elev-1`). Заглушены бесконечные декоративные анимации dm-row: online-avatar breath + unread-badge pulse (`ec-dm-badge-pulse`) — индикаторы остаются, но статичные. bg-tint hover + функциональные active/unread рейлы сохранены. Verify by-construction (hover/animation-состояния — удаление transform/shadow/animation однозначно; build green, override в бандле). Чисто CSS. **Осталось:** message-row/chat-header violet-glow'ы (`.ec-chat-header` shadow, `.ec-message-row--pinned/ai`) — мелкий слайс 5; **galaxy-backdrop** — signature brand, только с явного «да» Pavel.)

**Предыдущая:** v1.6.43 (De-noise pass — слайс 3: core nav + sidebar. Аудит выявил: `text-glow` в EC НЕТ (был только в hub); `.ec-channel-list` sidebar уже чистый (только transient `--menu-open` нёс violet radial-ауру → убрана). Главная цель — **channel-item** (основная навигация): active-канал нёс violet→cyan градиент-фон + 3-слойный violet halo + рейл с glow и БЕСКОНЕЧНЫМ pulse (`ec-channel-rail-breath`) + hover-slide + hover-halo (`::after`). Де-нойзнут (override-блоком, чтобы не трогать mojibake-комменты в файле): active = спокойный accent-tint bg + бордер + сплошной рейл (без градиента/halo/pulse); убраны hover-slide и hover-halo. Функциональный «где я» индикатор сохранён (verified headless — active читается ясно, спокойно). Чисто CSS. **Осталось (слайс 4, опц.):** прочие list-row'ы (friend/member/dm/search/popover/srv-menu — те же hover-slide/рейлы) тем же правилом; galaxy-backdrop intensity — но это signature brand-элемент, тонировать только с явного «да» Pavel.)

**Предыдущая:** v1.6.42 (De-noise pass — слайс 2: floating surfaces. Поповеры — убран holo-рейл `.ec-popover-surface::before` (cyan→violet кромка). Модалки — `.ec-modal-box` (оба theme-варианта): accent-22% бордер → нейтральный, violet мульти-тень (inset glow + drop glow) → одна чистая `--ec-shadow-modal`. Карточки внутри модалок (`.ec-settings-card`/`.ec-server-hub-panel`/`.ec-admin-row`/`.ec-bot-card`) — убрана violet radial-аура, accent-бордер → нейтральный, плоская поверхность. cockpit-head уже был чистым (surface-1, без ауры; corner-brackets сняты в слайсе 1). Verified headless — модалка+поповер спокойные плоские панели, без glow/рейлов. Чисто CSS. **Слайс 3:** sidebar (`.ec-channel-list`/`.ec-rail`), text-glow, accent left-rail на list-row'ах, интенсивность galaxy-backdrop.)

**Предыдущая:** v1.6.41 (De-noise pass — слайс 1 (умеренно, по запросу Pavel «максимальный упор на простоту, убрать весь шум»). Сняты 4 общие декоративные утилиты у источника (tokens.css), → каскадом по ВСЕМУ app: `.ec-holo-edge` (1px cyan holo-рейл), `.ec-scan-line` (бесконечный sweep), `.ec-shimmer-sweep` (hover-блик на CTA), `.ec-corner-brackets` (tactical уголки) — все стали no-op (классы остаются hook'ами, обратная совместимость). Также убран modal-open holo-sweep (`.ec-modal-header.ec-holo-edge::before`). Референс-поверхность «Друзья» де-нойзнута полностью: убраны violet-аура фона view + violet-аура hero + violet мульти-тень (→ одна чистая `--ec-elev-1`), accent-бордер 22% → нейтральный; функциональные акценты (CTA, активный таб, presence, eyebrow) сохранены. Verified headless (Друзья 1440 — спокойная плоская поверхность). Чисто CSS, без схемы. **Следующие слайсы:** per-surface violet-ауры/мульти-тени (модалки, попаповеры, cockpit-head, sidebar), text-glow, интенсивность galaxy-backdrop, surface-rail на row'ах — катить тем же умеренным правилом.)

**Предыдущая:** v1.6.40 (TeamHealth stat-grid orphan fix — design-QA «Здоровья команды» нашёл ту же семью бага, что и доска: stat-грид через inline `style={grid}` = `repeat(auto-fit, minmax(220px,1fr))` на **5** карточках (хедер-комментарий врал «4») ронял 5-ю карту в одинокий orphan-ряд на ~1100px (4+1). Грид перенесён из inline-стиля в класс `.ec-team-health-stats` (responsive.css) со сбалансированными брейкпоинтами: 5 в ряд (>1180) → 3+2 (≤1180) → 2col (≤480, как было) → 1col (≤320, как было). Удалён мёртвый inline-объект `grid`; skeleton-плейсхолдер выровнен на 5 карт (было 4). Verified headless на реальном responsive.css (1440=5, 1100=3+2, 390=2col). Чисто frontend, без схемы. Заметка: TeamHealth ещё на легаси module-level inline-style объектах (vs cockpit-классы StatusBoard) — кандидат на отдельный рефактор-слайс.)

**Предыдущая:** v1.6.39 (StatusBoard column-wrap fix — design-QA доски задач выявил реальный баг раскладки: grid `auto-fit` ломал 4-статусную канбан-доску на 2 ряда (3 колонки + «Сделано» отдельно снизу) на промежуточной ширине (~1100px), ломая модель «4 статуса сразу». Доска переведена на фиксированные `repeat(4, minmax(260px, 1fr))` (board-specific `.ec-status-board`, общий `.ec-cck-board` не тронут — table/drawer без изменений): 4 колонки всегда в одном ряду, h-scroll на узком desktop/tablet, ≤500px → 1fr stacked. Verified headless на реальном cockpit.css (1100 → один ряд, 390 → stack). Чисто CSS. Известный фоллоу: `.ec-cck__tools` toolbar overflow'ит на mobile — общий cockpit-chrome (table/drawer тоже), отдельный слайс с проверкой всех трёх.)

**Предыдущая:** v1.6.38 (Friends/DM design-QA pass — экран «Друзья» приведён к bounded readable column: на широких экранах список друзей больше НЕ растягивается во всю ширину (actions не уезжали к дальнему краю с огромным пустым промежутком) — `max-width: 60rem` + center на hero/tabs/sections. Добавлен reduced-motion guard для friends-анимаций: EC полагается на zeroing `--ec-dur-*` токенов, но бесконечный pulse на `.ec-friends-tab__dot` и hardcoded-duration (220-280ms) переходы row/tab токен-zeroing НЕ глушил → теперь глушатся явно. `.ec-friends-view` получил `min-width: 0` (scrollable flex-панель — best practice) + `overflow-wrap` на подзаголовке hero (защита от overflow длинного RU-текста). Чисто CSS, frontend-only, без схемы. Desktop (1440) render-verified headless-харнессом на реальных CSS; mobile — eyeball на проде. Системный reduced-motion gap (token-zeroing vs hardcoded durations по ВСЕМУ app) — кандидат на глобальный `*`-guard отдельным слайсом.)

**Предыдущая:** v1.6.37 (Server banner gradient fallback — серверы без banner-картинки больше не показывают один и тот же плоский placeholder. Добавлен util `serverBannerGradient` (`apps/web/src/lib/serverBanner.ts`): детерминированный on-brand cover-градиент — из `brandColor` сервора (баннер совпадает с акцентом), иначе одна из 10 курированных тёмных палитр по `hash(serverId)`. Применено в Путеводителе (`ServerWelcomeHero`) и в превью вкладки «Оформление» (`ServerHubModal`), где превью обновляется live при выборе цвета акцента и честно подписано «Авто-градиент — нет изображения». Чисто frontend, без schema/backend. E2 discord-parity (banner gradient presets) частично закрыт fallback-частью; owner-selectable persisted пресеты (поле `server.bannerGradient`) + rail-header cover — следующие слайсы. cyan/teal не используется декоративно, reduced-motion N/A (статичный градиент).)

**Предыдущая:** v1.6.36 (Voice presence snapshot hotfix — список пользователей в голосовых комнатах больше не зависит только от стартового socket connect и дельта-событий. Клиент явно запрашивает `voice:presence:request` при mount/reconnect и держит 30s fallback-refresh; backend отдаёт актуальный `voice:state` + `voice:meta` snapshot только по серверам, где пользователь состоит. Исправляет пустые/неполные участники под voice-каналами после пропущенного snapshot-а или reconnect-а.)

**Предыдущая:** v1.6.35 (Voice audio setup — настройки голоса получили пресеты «Офис / Шумно / USB-студия», проверку вывода звука, явную оценку уровня микрофона и сохранение валидированных audio-параметров. Noise suppression и mic gain теперь применяются live в активной комнате через republish/replaceTrack без обязательного reconnect; PTT сохраняет публикацию микрофона и глушит track, а не ломает enhancer chain. Backend/schema без изменений.)

**Предыдущая:** v1.6.34 (Composer drop guard — исправлен путь drag/drop, где browser-generated `text/html` попадал в file pipeline и показывал «Не поддерживается: text/html». Composer теперь отделяет реальные файлы от HTML/URL drag-артефактов: настоящие файлы идут в attachments, ссылки/текст вставляются в draft, HTML-разметка не загружается как файл. Локальные `.html` по-прежнему не разрешены как вложения по security-причине. Backend/schema без изменений.)

**Инфраструктурный слайс без app-version bump:** Network Gateway v0.1 — добавлен deploy/runbook для собственного закрытого VPN+proxy: WireGuard full-tunnel для доверенных устройств, Squid HTTP/HTTPS CONNECT proxy с basic-auth внутри WireGuard namespace и host-only bind `127.0.0.1:3128`, `.gitignore` защищает `deploy/network-gateway/secrets/` и `state/`. Это не меняет runtime Eclipse Chat, API, schema, web bundle или `/api/version`; следующий продуктовый слайс — platform-admin metadata UI без хранения приватных ключей.

**Предыдущая:** v1.6.33 (File share composer fix — Web Share Target для файлов больше не подставляет имя файла/список имён в текст draft-а перед отправкой: вложения остаются pending attachments, а настоящий текст/URL share сохраняется. Обычный file picker/drop не менялся: `addFiles` по-прежнему только добавляет previews. Backend/schema без изменений.)

**Предыдущая:** v1.6.32 (Voice Room command dock + music bot presentation + shell lazy split — панель связи в голосовых комнатах переработана в более аккуратный grouped dock: кнопки получили компактные hit-targets, разделители групп, спокойные active/danger состояния и reduced-motion fallback. Общий плеер теперь представлен в комнате как честный `Eclipse Music` bot-card/chip поверх существующей `MusicSession`: показывает трек, состояние, host и быстрые действия «Плеер/Трек», но не делает ложный claim о трансляции системного звука или отдельном серверном LiveKit-боте. Для ускорения старта `AppShell` вынес редкие панели (`FriendsView`, `HomeToday`, `ServerWelcomeHero`, `ChannelsAndRolesView`, `MembersView`, `ChannelInfoPanel`, `IntelligencePanel`, `StatusMenu`) в lazy chunks. Backend/schema без изменений.)

**Предыдущая:** v1.6.31 (Voice Room theater + real connection quality — голосовые комнаты получили более читаемый video-stage для camera/screen-share: в режиме «Эфир» visual grid раскрывается шире, stage получает спокойный theatre-backdrop, screen-share получает больший safe-height. В `useVoice` добавлен live listener `RoomEvent.ConnectionQualityChanged`; карточки и compact presence-чипы показывают реальное качество связи участника (`excellent/good/poor/lost/unknown`) без фейковых claims. LiveKit publish flow, fullscreen API и shared music player не менялись. Backend/schema без изменений.)

**Предыдущая:** v1.6.30 (Voice Room layout control — в голосовых комнатах добавлен per-channel переключатель раскладки «Вместе / Эфир / Чат»: default сохраняет stage+chat, режим «Эфир» скрывает chat-панель, режим «Чат» отдаёт основную ширину чату, но сохраняет stage и dock связи доступными. Для camera/screen-share fullscreen добавлен служебный overlay с именем участника, типом источника и подсказкой Esc; Fullscreen API, LiveKit publish flow и shared music player не менялись. Layout state хранится в localStorage с безопасным in-memory fallback, mobile/tablet получили явную CSS-раскладку. Backend/schema без изменений.)

**Предыдущая:** v1.6.29 (Voice Room visual polish — голосовые комнаты получили более цельную визуальную систему: stage/chat-панели сведены в общий glass-shell с holo rail, карточки участников получили явные speaking/muted/hover состояния без вытянутых теней, dock связи стал компактнее и профессиональнее за счёт усиленных focus/active/disabled states и аккуратной подсветки. Fullscreen для camera/screen-share и shared music player сохранены без изменения поведения; desktop/tablet/mobile и reduced-motion покрыты CSS-правками. Backend/schema без изменений.)

**Предыдущая:** v1.6.28 (Voice Room v2 stability pass — голосовые комнаты получили устойчивый split-layout: эфир/участники слева, полноценный чат комнаты справа, composer внутри chat-панели на всю ширину, компактный sticky dock связи не наезжает на сообщения. Для VOICE-комнат скрыты task/slash-команды, чтобы не провоцировать ошибочные задачи из голосового контекста; обычные сообщения, файлы, emoji и общий музыкальный плеер сохранены. Desktop/tablet/mobile раскладка зафиксирована через явные min/max зоны, reduced-motion поведение сохранено. Backend/schema без изменений.)

**Предыдущая:** v1.6.27 (Voice visual fullscreen — LiveKit camera/screen-share tiles in voice rooms получили явную кнопку «На весь экран». Fullscreen использует browser Fullscreen API, сохраняет `object-fit: contain`, не меняет shared music player и не трогает LiveKit publish options. Кнопка появляется на hover/focus, в fullscreen остаётся доступной для выхода; есть reduced-motion fallback. Backend/schema без изменений.)

**Предыдущая:** v1.6.26 (Composer slash macro cleanup — ASCII utility-команды `/shrug`, `/tableflip`, `/unflip` больше не засоряют чат служебной строкой `/command`: composer перехватывает их как text macro и отправляет только итоговый текст. `/task` остаётся operator-командой, `/me` и `/help` остаются backend slash-командами. Backend/schema без изменений.)

**Предыдущая:** v1.6.25 (Team Health shared training catalog — разделы и видео «Тренировок» больше не живут в browser-localStorage одного устройства: добавлены серверные `TrainingSection` / `TrainingVideo` с миграцией, REST CRUD для каталога, OWNER/ADMIN-only управление и member-read для всех участников сервера. YouTube-ссылки и загруженные файлы сохраняются как общий каталог, клиенты обновляются через `training:catalog:updated`; старый локальный каталог владельца импортируется в сервер при первом открытии раздела после деплоя.)

**Предыдущая:** v1.6.24 (Voice room split layout — голосовая комната разделена на две рабочие зоны: слева эфир, участники и компактная панель связи; справа полноценный чат комнаты с историей сообщений и composer внутри той же панели. Desktop получает side-by-side layout, tablet/mobile складываются в вертикальный поток без обрезания чата. Backend/schema без изменений.)

**Предыдущая:** v1.6.23 (Voice room text chat + compact call dock — голосовые комнаты теперь поддерживают обычные сообщения канала: backend больше не отклоняет POST /api/channels/:id/messages для VOICE, frontend показывает компактную ленту «Чат комнаты» прямо в voice-сцене и оставляет обычный composer снизу. Панель связи исправлена после визуального smoke: больше не растягивается в широкую декоративную балку, а работает как компактный professional dock. Schema без изменений.)

**Предыдущая:** v1.6.22 (Voice room UX simplification — из основного экрана голосовой комнаты
убрана громоздкая рабочая заметка; вместо неё подключён обычный message composer канала с теми же
attachments, emoji, slash/action flow и draft-поведением, что в текстовых комнатах. Панель связи
пересобрана как более профессиональный floating dock: крупнее hit targets, спокойный glass surface,
явная подпись «Связь», более читаемые состояния, мобильная горизонтальная прокрутка. No backend/schema.)

**Предыдущая:** v1.6.21 (Landing auth access redesign — окно авторизации на лендинге
пересобрано как premium access-module: добавлены статусная шапка, статичный контурный сигил,
trust-строка Self-hosted/TLS/2FA ready, более спокойные поля, сегментированный режим вход/создание
и усиленный CTA. Pure frontend design slice: логика авторизации, API и schema не менялись; тяжёлые
continuous effects не возвращались после performance pass.)

**Предыдущая:** v1.6.20 (Landing performance pass — убран реальный root cause
подлагиваний на лендинге: `CursorTrail` больше не держит бесконечный RAF в пустоту,
отключается на touch/mobile и сбрасывает canvas transform при resize. Hero auth-frame
больше не тащит SVG turbulence + blur stack, а offscreen memory/security-анимации
переведены в статичные состояния с `content-visibility: auto`. No backend/schema.)

**Предыдущая:** v1.6.19 (Channel message layout polish — собственные сообщения в каналах
больше не уезжают вправо отдельной карточкой: avatar и content снова живут в одном левом
read rail, поток читается как командный канал, а не как личный чат. `+`-меню composer'а
уплотнено по высоте/ширине и меньше перекрывает историю. No backend/schema.)

**Предыдущая:** v1.6.18 (Composer grid/popover hotfix — исправлен реальный root cause
после v1.6.17: старый `grid-template-columns: ... !important` больше не сжимает textarea
в мини-колонку, а `overflow: hidden` на composer-box больше не клипает `+`-меню.
Textarea занимает всю рабочую ширину строки, `+` popover снова видим. No backend/schema.)

**Предыдущая:** v1.6.17 (Composer hotfix — исправлена визуальная иерархия
после v1.6.16: `+` больше не превращается в крестик, send стал компактной icon-only
кнопкой фиксированной ширины, textarea снова занимает основное пространство composer'а,
mobile grid явно держит `+ / input / emoji / send` без растянутой фиолетовой кнопки.
No backend/schema.)

**Предыдущая:** v1.6.16 (Discord-style message composer — вторичные действия
перенесены в `+`-меню: отправка файлов, голосовое сообщение, создание задачи и честные
disabled-пункты «ветка/опрос» со статусом «скоро». Основная строка сообщения стала чище:
слева один action trigger, по центру textarea, справа emoji + send; постоянные shortcut-hints
под composer скрыты как визуальный шум. No backend/schema.)

**Предыдущая:** v1.6.15 (Team Health training media grid — «Тренировки»
переведены в полноценную медиатеку: stage занимает доступную ширину, карточки видео стали
компактными и предсказуемыми, загруженные file-video получают отдельный portrait-friendly
режим без огромной 16:9 пустоты, список видео скроллится внутри блока и больше не наезжает
на секцию «По комнатам». No backend/schema.)

**Предыдущая:** v1.6.14 (Team Health training file uploads — в «Тренировках»
добавлена загрузка видеофайлов MP4/WebM/MOV/MKV/AVI до 200 MB. Upload endpoint
`POST /api/servers/:id/training-videos/upload` требует JWT + membership и разрешён
только OWNER/ADMIN; backend валидирует video MIME, размер и magic bytes через общий
attachment pipeline, файлы кладутся в `/uploads/training-videos/`. UI показывает
кнопку загрузки только администраторам, рендерит локальные файлы через `<video controls>`,
старые YouTube-записи сохраняет. Каталог разделов/видео по-прежнему localStorage на
устройстве, без ложной командной синхронизации. No schema.)

**Предыдущая:** v1.6.13 (Team Health training two-column layout — «Тренировки»
перестали быть широким пустым контейнером: desktop получил раздельные зоны управления
и видео-stage, shell ограничен рабочей шириной, форма больше не тянется через весь
экран, tablet/mobile складываются в одну колонку. No backend/schema.)

**Предыдущая:** v1.6.12 (Team Health training layout fix — одиночные
YouTube-тренировки больше не растягиваются в широкий hero-баннер: библиотека
переведена на bounded card grid, форма добавления стала компактным control
surface, видео ограничены рабочей шириной/высотой и остаются читаемыми на
mobile. No backend/schema.)

**Предыдущая:** v1.6.11 (Team Health training design QA — блок
«Тренировки» выровнен с системными field/button primitives, получил сводку
активного раздела, более читаемые видео-карточки с fallback-ссылкой на YouTube,
mobile/reduced-motion polish и отдельные SOLAR overrides. Данные по-прежнему
локальные на устройстве; UI не заявляет командную синхронизацию. No backend/schema.)

**Предыдущая:** v1.6.10 (Team Health training library — в «Здоровье
команды» добавлен отдельный раздел «Тренировки»: можно создавать новые разделы,
переименовывать их и добавлять YouTube-видео в безопасный встроенный плеер.
Данные хранятся локально в браузере по `serverId`, поэтому UI не заявляет
командную синхронизацию; shared backend-каталог можно добавить отдельным
schema-слайсом. No backend/schema.)

**Предыдущая:** v1.6.9 (Channel categories usability — категории в левом
rail теперь можно переименовывать и удалять через видимые action-кнопки прямо в
заголовке категории. Right-click меню осталось fallback'ом, но основной путь стал
discoverable; удаление подтверждается, каналы внутри переходят в «Без категории»
через существующий backend SetNull/socket flow. No backend/schema.)

**Предыдущая:** v1.6.8 (Chat YouTube embed — ссылки на YouTube/youtu.be
в сообщениях теперь открываются прямо в безопасном inline-плеере под текстом
сообщения. Парсер принимает только валидные youtube hosts и videoId формата
YouTube, iframe строится через `youtube-nocookie.com`, обычные ссылки по-прежнему
идут в OG preview. No backend/schema.)

**Предыдущая:** v1.6.7 (QA infrastructure cleanup — server test runner теперь
использует локальный `vitest` из devDependencies вместо сетевого `npx`, поэтому
`npm test` детерминированно работает в workspace/CI. Prisma Friendship FK cleanup:
`requestedByUserId` остаётся required, но referential action исправлен с невозможного
`SET NULL` на `CASCADE`; добавлена additive migration, API/DTO/UI не менялись.)

**Предыдущая:** v1.6.6 (Voice media quality pass — voice controls dock
стал плотнее и профессиональнее: 44px touch targets, активные/опасные состояния
с нижним индикатором, ровная volume-pill. Webcam/screen-share больше не
зажимаются дефолтами: LiveKit получает явные capture/publish options
(камера 720p/30fps, screen-share до 1080p/30fps с повышенным bitrate), video
stage получает приоритетную высоту, screen tile занимает всю строку без
760px clamp, `video` принудительно `object-fit: contain`, voice-note
компактнее только при активном визуальном потоке. No schema/backend.)

**Предыдущая:** v1.6.5 (Modal viewport containment — настройки сервера,
профиля и длинные рабочие панели теперь открываются как ограниченные viewport
окна: modal body получил корректный `min-height:0`, server/settings tree panels
живут в вычисленной доступной высоте, left-nav/main/preview scroll'ятся внутри
своих колонок, preview в ServerHub больше не вываливается за нижний край, mobile
получил full-height safe layout. No schema/backend.)

**Предыдущая:** v1.6.4 (Daily usability finish pass — закреплён более
стабильный рабочий layout: chat header стал sticky, message cards больше не
зависят от ширины rail'ов через `100vw - ...`, текст/attachments получили
безопасный overflow и max-height, composer стал стабильным bottom command dock,
channel search/rows и member rows получили практичные focus/hover/touch states,
DM button у участников появляется по hover/focus без визуального шума. No
schema/backend.)

**Предыдущая:** v1.6.3 (Closer-to-concept shell correction — v1.6.2
оказался слишком CSS-only и не попадал в фактический DOM по ключевым зонам:
правый rail уже использует `.ec-mem*`, а composer держал inline-grid. Исправлено:
composer получил явные layout-modifier classes, участники оформлены по реальным
`.ec-mem*` hooks, сообщения стали компактнее и ближе к content-card композиции
из референса, action-toolbar закреплён справа у карточки, attachments/audio/video
получили единый card treatment, mobile widths пересчитаны. No schema/backend.)

**Предыдущая:** v1.6.2 (Premium operations shell redesign — основной
интерфейс получил более смелую и практичную визуальную систему: topbar собран
в спокойные utility-кластеры, левый rail и список участников стали читаемыми
операционными панелями, сообщения оформлены как content-first карточки с
привязанным action-toolbar, composer стал command dock с понятными touch
target'ами, серверное меню получило устойчивый popover-surface, voice controls
получили профессиональную dock-геометрию. Есть mobile breakpoints и
prefers-reduced-motion fallback. No schema/backend.)

**Предыдущая:** v1.6.1 (Visible chat surface reset — v1.6.0 оказался
слишком осторожным, поэтому чат получил уже заметную базовую композицию:
сообщения стали content-first карточками по ширине содержимого вместо
растянутой full-width пелены, action toolbar визуально привязан к сообщению,
лента получила более явный depth/background, composer dock стал плотнее,
контрастнее и практичнее на desktop/mobile. No schema/backend.)

**Предыдущая:** v1.6.0 (Design clarity pass — everyday chat and voice
surfaces стали спокойнее и практичнее: лента сообщений получила тихий hover,
чётче отделённый action-toolbar, аккуратнее avatar/time emphasis и менее шумный
composer dock. Voice room shared note переехала с inline-style плиты на
профессиональную surface: compact header, readable textarea, честные save/conflict
states, mobile stacking и reduced-motion fallback. No schema/backend.)

**Ещё раньше:** v1.5.99 (Voice shared music audience clarity — shared
music bridge в голосовой комнате получил честный room-aware статус:
«N участников в комнате» + состояние синхронизации/паузы рядом с текущим
треком. Формулировка не обещает, что у каждого участника реально звучит аудио
на устройстве; она показывает доступность общего плеера для комнаты и снимает
путаницу «мой локальный плеер должен транслироваться другу». Backend/schema не
менялись.)

**Ещё раньше:** v1.5.98 (Voice shared music UX — голосовая комната
теперь явно показывает “Музыку для всей комнаты”: статус общего плеера,
текущий трек и инициатора запуска, CTA «Выбрать трек» / «Открыть плеер» и
честное пояснение, что локальный звук устройства не транслируется. VoiceMusicPicker получил
понятный intro, empty state и профессиональные строки выбора. Backend/schema не
менялись: используется существующий `/api/channels/:id/music` +
`music:session:updated`.)

**Ещё раньше:** v1.5.97 (Practical visual system pass — единый polish
для ежедневных поверхностей: button hierarchy, composer dock, channel/member
rows, empty states, topbar utility chips, settings/server surfaces и voice
participant cards. Цель — меньше визуального шума, понятнее active/hover/focus
states, стабильные touch targets на mobile и `prefers-reduced-motion` fallback.
No schema/backend.)

**Предыдущая:** v1.5.96 (Voice/chat visual polish — голосовая комната
получила компактный профессиональный control dock: стабильные join CTA,
квадратные action-buttons, отдельный volume capsule и mobile horizontal scroll.
AI/bot-сообщения больше не растягивают фиолетовый фон на всю ширину ленты:
подсветка ограничена карточкой контента, а общий hover сообщений стал тише.
No schema/backend.)

**Предыдущая:** v1.5.95 (Command palette shortcut guard — глобальный
`Ctrl/⌘+K` больше не перехватывается, когда фокус стоит в `input`, `textarea`,
`select`, `contenteditable` или `role="textbox"`. Это сохраняет быстрый вход в
палитру из навигационных поверхностей, но не срывает набор сообщений, форм и
настроек. No schema/backend.)

**Предыдущая:** v1.5.94 (Recent command palette cleanup — группа
«Недавние» в `Ctrl/⌘+K` получила явную кнопку «Очистить». Она удаляет только
локальный список command id из `localStorage`, не трогает backend и не влияет на
доступность самих команд. Если storage недоступен, видимое состояние всё равно
очищается. No schema/backend.)

**Предыдущая:** v1.5.93 (Recent command palette — `Ctrl/⌘+K` теперь
поднимает последние открытые команды наверх в группу «Недавние». Хранится только
локальный список command id в `localStorage`, без текста/PII и без backend; если
команда исчезла из текущего контекста, она не показывается. Переход работает даже
если storage недоступен. No schema/backend.)

**Предыдущая:** v1.5.92 (Command palette groups — быстрые переходы в
`Ctrl/⌘+K` сгруппированы по смыслу: Навигация / Личные / Каналы / Данные /
Настройки. Буквенные маркеры заменены на понятные типовые glyph: экран, диалог,
канал, таблица, раздел. Empty state теперь подсказывает искать канал, диалог,
таблицу или настройки; нижняя строка управления показывает `↑↓ выбрать · Enter
открыть · Esc закрыть`. No schema/backend.)

**Предыдущая:** v1.5.91 (Keyboard-first command palette — быстрые
переходы в `Ctrl/⌘+K` получили управление без мыши: `ArrowUp/ArrowDown`
перемещают active row, `Enter` открывает выбранный канал/DM/таблицу/экран,
hover синхронизирует selection, `aria-activedescendant` связывает input с текущей
командой. Search filters не перехватываются, чтобы date/channel controls оставались
нативными. No schema/backend.)

**Предыдущая:** v1.5.90 (Command palette quick navigation — `Ctrl/⌘+K`
теперь не только ищет по сообщениям, но и сразу даёт быстрые переходы к каналам,
личным диалогам, таблицам, друзьям, путеводителю, участникам и настройкам. Пустой
стартовый экран поиска заменён практичной сеткой команд; результаты по сообщениям,
делам, файлам и семантике сохранены. Mobile 390px получает одно-колоночный список
с крупными touch targets; `prefers-reduced-motion` отключает hover-сдвиги. No schema/backend.)

**Предыдущая:** v1.5.89 (Rail quick room search — left rail получает быстрый
поиск по комнатам во вкладке «Каналы»: фильтр работает по названию комнаты и названию
категории, matching categories раскрываются автоматически, режим поиска скрывает
create/dropzone controls и показывает понятный empty state. UX goal: меньше скролла,
меньше угадывания, быстрее перейти в нужную комнату. No schema/backend.)

**Предыдущая:** v1.5.88 (Server rail/menu polish — server actions menu in
ChannelList теперь ведёт себя как раскрывающийся rail-block, а не floating overlay:
меню остаётся под server header в потоке layout, двигает channel tabs/list вниз,
получает активный trigger state, более читаемые hover/focus rows и solid premium
surface. Fixes UX debt after v1.5.87: menu works, but should not visually collide
with channel navigation. No schema/backend.)

**Предыдущая:** v1.5.87 (Server menu inline rail fallback — ChannelList server actions
popover теперь рендерится локальным absolute-слоем под server header вместо body portal.
Это убирает зависимость от viewport positioning, portal stacking и старых CSS-чанков.
Trigger propagation/ref outside-click handling остаются; sidebar header получает явный
local z-layer. Fixes case: chevron виден, но клик по server header не показывает меню
в rail. No schema/backend.)

**Предыдущая:** v1.5.86 (Server menu trigger hardening — server actions
popover теперь защищён от внешних pointer/click handlers: trigger останавливает
всплытие, outside-click проверяет реальный menu ref вместо CSS closest, portal
получает высокий inline z-index. Fixes case: header показывает chevron/hover, но
меню сервера не появляется в rail. No schema/backend.)

**Предыдущая:** v1.5.85 (Discord-parity E3 frontend — server feature
chips получили production UI: владелец редактирует до 5 коротких тезисов в
ServerHub settings, PATCH `/api/servers/:id/identity` отправляет реальное
`features` поле, предпросмотр и `ServerWelcomeHero` рендерят чипы только из
сохранённого backend DTO. Описание остаётся текстом, features больше не
приходится имитировать списками в description. No schema/backend.)

**Предыдущая:** v1.5.84 (Voice music sync fix — общий плеер в
голосовой комнате теперь scoped к `voice.activeChannelId`, а socket при
`voice:join` входит в `channel:{voiceChannelId}` room и выходит при
voice-leave/disconnect. Fixes case: host запускает музыку в voice room, у него
играет, а у другого участника в той же комнате не приходит session update из-за
открытого другого chat/DM. No schema.)

**Предыдущая:** v1.5.83 (Auth cosmic refresh — анимированная страница
входа получает production-safe visual layer на основе Pavel'ового wide
black-hole reference: один локальный оптимизированный WebP 2560px/178KB вместо
набора тяжёлых JPG, фон + gold/cyan/violet glass treatment в landing auth hero и
fullscreen AuthPage, existing login/register/2FA handlers сохранены, no external
fonts/scripts/CDN, `prefers-reduced-motion` выключает drift/shimmer. No
backend/schema.)

**Предыдущая:** v1.5.82 (Deadline 404 scene — берём full deadline
animation concept в production-safe виде: inline SVG + React countdown вместо
jQuery/CDN, no external fonts/scripts, RU recovery copy, CTA «На главную» /
«Назад», unknown client routes render standalone 404, `prefers-reduced-motion`
freezes motion without losing scene meaning. No backend/schema.)

**Предыдущая:** v1.5.81 (Server menu instant-close fix — server actions
popover больше не закрывается на каждый captured scroll после клика по header.
Scroll теперь только пересчитывает позицию portal-меню; outside click, Escape и
action-click продолжают закрывать меню. Fixes regression where server menu
disappeared immediately after opening. No backend/schema.)

**Предыдущая:** v1.5.80 (Server guide depth cards — Animated Parallax
Card pattern адаптирован без `vanilla-tilt`/CDN: `apps/web/src/lib/tilt.ts`
получил `depthTiltProps` с cursor-following glow vars + лёгким 3D tilt, а
quick entries в `ServerWelcomeHero` стали `ec-depth-card`. Эффект ограничен
практичным выбором канала в путеводителе, размеры layout не меняет, mobile
gracefully no-op, `prefers-reduced-motion` сбрасывает transform/transition. No
backend/schema.)

**Предыдущая:** v1.5.79 (Pinned-message micro-interaction — CodePen
favorite-button motion pattern адаптирован в production-safe Eclipse UI:
кнопка «Закрепить» в message toolbar получила tactile confirm animation
без GSAP/CDN: icon jump/flip, small socket-hole, button press. Motion ограничен
stateful action'ом, respects `prefers-reduced-motion`, не добавляет false UI claims
и не меняет API/schema.)

**Предыдущая:** v1.5.78 (Channel rail compact pass — левый rail приведён
к роли навигации, а не второго hero. Compact override для server header с
баннером перенесён в always-loaded `components.css`: banner больше не создаёт
высокую пустую область в сайдбаре, независимо от lazy chunks. Tabs
`Каналы / Задачи / Данные`, category headers, channel rows и bottom create CTA
поджаты по высоте и визуально приглушены; active channel оставлен violet-only
без cyan как декоративного акцента. No backend/schema.)

**Предыдущая:** v1.5.77 (Server menu portal fix — исправление регресса
v1.5.76: server actions menu больше не рендерится внутри левого rail stacking
context. Меню вынесено через React portal в `document.body`, поэтому tabs
`Каналы / Задачи / Данные` и список каналов не могут прорисоваться поверх него.
Дополнительно убран устаревший helper «Скоро v1.5.48+» у disabled action
«Создать событие» — теперь без ложной версии. No backend/schema.

**Предыдущая:** v1.5.76 (Shell IA cleanup — следующий практичный проход
по верхнему и левому краю после v1.5.75. Workspace switcher стал компактным
списком без баннерных строк внутри dropdown, чтобы переключение пространств не
выглядело как отдельный промо-экран поверх каналов. Server actions menu получило
иконки, более плотные строки, явные группы и меньшую высоту, чтобы действия
сканировались быстрее и не перекрывали половину rail. Topbar выровнен как набор
однородных утилитарных капсул: метрики, часы, тема, профиль, выход. No
backend/schema.

**Предыдущая:** v1.5.75 (Guide layout pass — заметная доработка после
ревью Pavel'я на v1.5.74. В server guide убран дублирующий chat-header
«Путеводитель»: активная вкладка server-nav остаётся единственным уровнем
навигации. Guide расширен до 1320px, баннер стал адаптивнее, body получил
рабочую 2-колоночную структуру: слева описание/секции, справа sticky «Быстрые
входы». Секции фиксированы в 2 колонки на desktop и 1 колонку на tablet/mobile,
чтобы chips и длинные ссылки не дробились в узких карточках. Mobile/tablet
fallback сохраняет один поток без sticky. No backend/schema.

**Предыдущая:** v1.5.74 (Clean shell quality pass — практичный первый слой
интерфейса по ревью Pavel'я. Верхняя панель оставляет только постоянные полезные
контролы: реальные метрики `/api/health` (сеть/память/CPU), часы, тему, профиль
и выход; вторичные icon-only actions убраны из первого визуального слоя. Guide
перестроен из текстовой стены в сканируемую сводку: реальные счётчики сервера,
intro, секции и chips из описания без ложных claims. Mobile: метрики схлопываются
до сети на tablet и скрываются на узком viewport; guide stats/chips остаются
читаемыми на 390px. Дополнительно убран обрезанный top CTA на landing mobile:
на 390px остаётся hero CTA без горизонтального overflow. No backend/schema.

**Предыдущая:** v1.5.73 (Popover solid inline — обход CSS-чанк-кэша.
Pavel видит version-label (свежий main bundle), но popover прозрачный → ленивый
AppShell-чанк (JS+CSS) застрял в кэше, отдельно от main bundle. Фикс: solid-фон
поповера (`background:--ec-surface-2`, `backdrop-filter:none`, `background-image:none`)
задан **inline-стилем** в `ServerActionsMenu` — едет в JS-чанке, бьёт любой CSS
(в т.ч. устаревший). Применится как только AppShell-чанк у клиента обновится.
Решающий тест для Pavel'я — incognito (нулевой кэш). No backend/schema.

**Предыдущая:** v1.5.72 (Version label в UI — диагностика кэша. По запросу
Pavel'я: всегда-видимая надпись `v{CLIENT_VERSION}` (build-time via Vite define) в
fixed bottom-right (mono, dim, pointer-events:none). Показывает реально запущенную
версию → сразу видно, на свежем bundle браузер или на устаревшем кэше. Прод-диагноз
подтвердил: deployed CSS-чанки (AppShell/EmptyIcons) содержат solid-popover
(`background:--ec-surface-2`) — сервер отдаёт правильно; если у клиента прозрачный,
это HTTP-кэш старого чанка. No backend/schema.

**Предыдущая:** v1.5.71 (Clean redesign slice 8 ч.2 — компактный channel-header
(спек Pavel'я #2). Когда у сервера есть баннер, header'у давался класс `--banner`
→ `min-height 96px` + cover-баннер за именем = большой пустой hero над tabs
(баннер дублировал «Путеводитель»). Override в clean-ui.css: `--banner` header
становится компактным (min-height 0, `background-image: none !important`, scrim
убран) — имя + OWNER-чип + chevron в одну строку, как в эталоне server-view.
Пустое место над tabs убрано. Верифицировано рендером (сайдбар+header+popover на
реальных CSS: header компактный, popover solid). No backend/schema.

**Предыдущая:** v1.5.70 (Clean redesign slice 8 — guide-композиция + popover
close-on-scroll (спек Pavel'я, часть 1/2). **Guide**: `.ec-guide__inner` left-aligned
(не центрирован), max-width 1040, margin-left clamp(24px,5vw,72px); баннер 210px
растянут под ширину; описание читаемой мерой 68ch (не «стена»); быстрые входы
компактной сеткой. **Popover** (`ServerActionsMenu`): закрывается при любом scroll
(capture-фаза ловит scroll списка каналов) — channel-select/outside/Escape уже
закрывали. Часть 2 (rail layout: fixed header/tabs/scroll, убрать пустой hero над
tabs — переборка ChannelList) следующим слайсом. No backend/schema.

**Предыдущая:** v1.5.69 (Update-banner быстрее — конец «ревью устаревшего».
Механизм version-mismatch banner («ДОСТУПНО ОБНОВЛЕНИЕ · vX» → bulletproof reload
с unregister SW + clear caches) уже существовал (App.tsx, v1.1.2), но poll был
60s → ревьюер скриншотил в первую минуту после deploy, видел старый bundle и
думал «не пофикшено». Теперь: poll 60s→20s + **немедленная проверка /api/version
при возврате на вкладку** (visibilitychange + focus). Переключился на вкладку
ревьюить — баннер сразу, если задеплоено новее. Никакого нового тоста не нужно
было — улучшен существующий. No backend/schema.

**Предыдущая:** v1.5.68 (Clean redesign slice 7 — popover bulletproof.
v1.5.66 фикс поповера жил в clean-ui.css, но тот грузится как CSS-чанк компонента
(MemberList/guide) и в некоторых view не подгружался → base `.ec-popover-surface`
(прозрачный `--ec-overlay-bg` 0.93 + blur) просвечивал список каналов под server-
меню. Теперь solid-фон вшит в сам `.ec-popover-surface` в **always-loaded
components.css** (background `--ec-surface-2`, blur убран). Верифицировано рендером
БЕЗ clean-ui.css — solid. Фиксит все поповеры разом. No backend/schema.

**Предыдущая:** v1.5.67 (Clean redesign slice 6 — review-фиксы Pavel'я к
clean-ui.css: (1) `.ec-mem__close + .ec-mem__close { margin-left:0 }` — спейсинг
collapse+close кнопок в header участников. (2) `prefers-reduced-motion` guard для
новых `.ec-mem*`/`.ec-guide*` (transition/transform/animation → none). (3) mobile
clamp (≤640px) для guide: паддинги/баннер 148px/иконка 56px/карточки в один
столбец — чтобы не был широким на 390px. (4) `overflow-wrap/word-break` на
guide desc+welcome (длинные токены/URL в user-описании не переполняют мобайл).
Верифицировано рендером guide@390. No backend/schema.

**Предыдущая:** v1.5.66 (Clean redesign slice 5 — popover + channel-top
(по скрину Pavel'я). (1) Server-actions popover: `.ec-popover-surface` имел
`--ec-overlay-bg` (0.93 alpha) + blur → список каналов просвечивал сквозь поповер,
текст наезжал. Override `.ec-server-actions-menu.ec-popover-surface` (специфичность
0,2,0) → solid `--ec-surface-2`, без blur, чистый border/shadow. (2) Channel-top
hero (`MessageList.ec-msg-channel-top`): убран full-bleed cinematic банер с
overlaid текстом и выцветшим server-баннером за «Начало канала #X» — теперь чистый
компактный text-only header (base class, 84px). Убраны channelTopBanner usage +
resolveAssetUrl import. No backend/schema.

**Предыдущая:** v1.5.65 (Clean redesign slice 4 — правый рейл (обёртка).
Догон slice 1: «ТАКТИЧЕСКИЙ ВИД» жил не только в MemberList, но и в `IntelligencePanel`
(desktop right-rail обёртка с собственным `ec-rail` header + holo-edge + tactical-
иконкой, рендерил MemberList с hideHeader). Теперь IntelligencePanel — тонкая
обёртка над MemberList с его чистым header («Участники N/M» + collapse + close).
В MemberList добавлен `onCollapse` (desktop chevron). Убраны IconMembers +
ec-rail театр. MembersView (hideHeader) не затронут. No backend/schema.

**Предыдущая:** v1.5.64 (Clean redesign slice 3 — composer declutter.
Убран декоративный `ec-composer-strip` над полем ввода («>_ Защищённый канал» +
фейковое «в эфире»/«печатает…» по own-focus + scan-dots) — sci-fi-театр на
каждом канале + **ложный security-claim** (канал не E2E-шифрован). Удалён
vestigial `focused` state. Chat-header канала проверен — уже чистый (глиф + имя +
divider + описание), не трогался. No backend/schema.

**Предыдущая:** v1.5.63 (Clean redesign slice 2 — экран «Путеводитель».
`ServerWelcomeHero` переписан на `clean-ui.css` (.ec-guide*). Было: баннер
full-bleed за текстом, гигантский заголовок и описание-стена с эмодзи
наслаивались, «ПРОСТРАНСТВО»-eyebrow. Стало: баннер — контейнерная шапка
(rounded, не за текстом), иконка сервера + имя + meta (реальный memberCount),
описание читаемой колонкой (max-width 760, leading-relaxed), welcome-callout
с accent-border, «Быстрые входы» каналами-карточками (auto-fill grid). Данные
без изменений (server.banner/icon/description/welcomeMessage + featured channels).
Верифицировано статикой с реальным длинным описанием. No backend/schema.

**Предыдущая:** v1.5.62 (Clean redesign slice 1 — рейл участников без театра.
По утверждённому эталону `docs/design/ia-reset/server-view.html`: `MemberList`
переписан на чистый `clean-ui.css` (namespace ec-mem-, existing токены). Убрано:
«ТАКТИЧЕСКИЙ ВИД»-header (polygon-щит), «◇ N узлов в сети» net-signal, sci-fi-
лейблы групп (КОМАНДОРЫ/ОПЕРАТОРЫ/ЛИЧНЫЙ_СОСТАВ/СПЯЩИЙ_РЕЖИМ), game-иконки ролей
(crown/rune/shield). Стало: спокойный header «Участники N/M», группы по ролям
русскими лейблами (Владелец / Администраторы / … / Не в сети) с count+collapse,
role-чипы (OWNER=gold, ADMIN/MOD=violet), presence-точки, оффлайн приглушены, DM
по hover. Вся логика (сорт/группы/collapse-persist/voice/presence) сохранена.
Верифицировано статикой на реальных tokens.css+clean-ui.css. Первый кирпич
единого чистого языка; дальше — sidebar/header/guide. No backend/schema.

**Предыдущая:** v1.5.61 (IA reset slice 2 — UXR3 «Мессенджер как Главная».
**Лендинг**: «Главная» (brand-mark + home-кнопка, `openHome`) теперь открывает
мессенджер (DM-режим + экран «Друзья»), а не операционный дашборд. Дашборд
«Сегодня» (`HomeToday`) больше не лендинг — `homeOpen` нигде не выставляется в
true; компонент сохранён в коде для возможного возврата как отдельная «Сводка».
**DM-сайдбар** (`DirectConversationList`) переписан под утверждённый прототип
(`docs/design/ia-reset/dm-home.html`): новый `dm-home.css` (namespace ec-dmx-,
existing токены) — header «Сообщения» + поиск (client-side фильтр) + accent-rail
на active/hover + presence-точки + activity-хинты + unread-бейдж + «Избранное».
Данные/логика без изменений, inline-стили → классы. Верифицировано статикой на
реальных tokens.css. No backend/schema.

**Предыдущая:** v1.5.60 (IA reset slice 1 — UXR1+UXR2+UXR4 атомарно.
**UXR1**: RAM/CPU/NET pills удалены из глобального topbar AppShell (часы/профиль/
тема/выход/плеер остаются); сняты now-unused `useTelemetry`/`TelemetryViz` импорты
в AppShell. **UXR2**: серверная телеметрия переехала в voice context — в панель
«Voice diagnostics» (`VoiceRoom`) добавлены строки ПАМ/ЦП (сервер) + связь
(онлайн/оффлайн + pg.active) из existing `useTelemetry` (`/api/health`); null/offline
→ честный «нет данных», без fake-метрик, без анимации (reduced-motion-safe). **UXR4**:
server-home tab rail (`ServerNavBar`) больше не висит над каналами — `showServerNav`
исключает `serverView==="chat"`; чтобы не застрять, `ServerSwitcher.onSelect` ставит
`serverView="guide"` (клик по server-иконке = server-home, откуда доступны
guide/каналы-роли/участники). Channel header + actions + search в chat не тронуты.
No backend/schema. UXR3/UXR5/UXR6 — отдельные слайсы далее. Визуал на 3 viewport'ах
ждёт ревью Pavel'я (локальный browser-smoke невозможен — нет node_modules).

**Предыдущая:** v1.5.59 (Discord-parity E5 — real ServerHub audit-log tab.
Латентный backend `feat/claude/audit-log-real` включён в ship: server-scoped
audit events теперь пишутся для server/channel/member/identity/banner/bot
мутаций с `metadata.serverId`; read endpoint `GET /api/servers/:id/audit-log`
закрыт OWNER/ADMIN и фильтрует по serverId, type, userId, since/until, take/skip.
Frontend заменил placeholder в `ServerHubModal → Модерация → Audit log` на
реальный view: RU labels для server-scoped типов, actor avatar/name, relative
time с absolute tooltip, target из metadata, фильтры type/actor/date-range,
pagination «Загрузить ещё», loading skeleton, empty/error states. No fake rows:
`MEMBER_KICKED`/`MESSAGE_DELETED_BY_MOD` остаются пустыми пока нет продюсеров).

**Предыдущая:** v1.5.58 (Discord-parity E3 backend — Server feature chips.
`Server.features` nullable `String?` (JSON-encoded `String[]` до 5 элементов,
каждый ≤40 chars). Migration `20260529140000_add_server_features` additive
ALTER TABLE. PATCH `/api/servers/:id/identity` body extended: `features?: string[] | null`
(trim → filter empty → slice 5 → JSON.stringify в БД; null/[] clears).
GET `/api/servers` DTO теперь возвращает `features: string | null` (JSON string)
per-server. Frontend будет парсить → render chips в WelcomeHero (Codex slice).
Incident note: первая попытка v1.5.58 (commit 7a2f02e) была reverted из-за
`FST_ERR_DUPLICATED_ROUTE` на `GET /api/servers/:id/audit-log`; re-ship содержит
только E3 schema/PATCH/DTO).

**Предыдущая:** v1.5.57 (Discord-parity MED batch 1 — C4/C6/E4/E6.
C4: channel row desktop hover actions now include invite-to-channel copy,
generating `?invite=<code>&channel=<channelId>` and `useChannels` consumes
`channel` query after join/reload to open the target channel. C6: server actions
menu adds localStorage-backed «Скрыть заглушённые» / «Показать заглушённые»,
filtering ChannelList over existing muted channel ids while keeping active
channel visible. E4: ServerHub settings gets a right-side mini Welcome preview
reusing `ServerWelcomeHero` with unsaved name/description/welcome/mode/color
form state. E6 remains verified: custom emoji tab is exposed under E1
«Реакции → Эмодзи». No schema/backend routes changed; E3/E5 backend remains
Claude PR #15 latent).

**Предыдущая:** v1.5.56 (Discord-parity D3 frontend — Server isolation
toggle UI в D1 popover. `ServerActionsMenu` action «Изоляция»/«Снять изоляцию»
динамический label по `server.lockedAt`. New `IsolationConfirmDialog` — reason
input ≤500 chars для lock mode, simple confirm для unlock, error display inline.
AppShell wire через `useServers.updateServerLock(serverId, locked, reason?)`
(E1 v1.5.55 уже представил mutation, мой slice добавляет popover entry-point +
header badge). `ChannelList` header теперь рендерит inline pill badge «Закрыт»
(warning amber tone hsl 38 90%) рядом с server name когда `lockedAt !== null`,
с tooltip и aria-label. `ServerRow` type расширен `lockedReason?` для tooltip-display.
Closes D3 полностью: backend v1.5.54 + settings entry-point v1.5.55 +
popover frontend v1.5.56).

**Предыдущая:** v1.5.55 (Discord-parity E1 — Server settings tree nav.
`ServerHubModal` переведён с flat 4 tabs на grouped tree-nav: «Сервер»
(Обзор/Оформление/Настройки), «Реакции» (Эмодзи через existing
`AdminEmojisTab`), «Люди» (Роли/Участники с existing owner role select),
«Приложения» (Боты), «Модерация» (Изоляция + Audit log placeholder
«Скоро в v1.5.56+»), «Сообщество» (Приглашение). Existing identity/banner/
brandColor/mode/description/welcome/invite/bots/leave/delete flows сохранены.
D3 settings entry-point добавлен: lock reason input + POST/DELETE
`/api/servers/:id/lock` через `useServers.updateServerLock`, без backend/schema
change. Mobile tree collapses into horizontal rail; prefers-reduced-motion
отключает nav motion).

**Предыдущая:** v1.5.54 (Discord-parity D3 backend — Server isolation
emergency lock. Server расширен 3 nullable полями: `lockedAt` (timestamp),
`lockedReason` (≤500 chars audit), `lockedByUserId` (FK SetNull при удалении user'а).
Migration `20260529130000_add_server_lock` — additive ALTER TABLE + FK constraint.
Параллельная система к existing `suspendedAt` (platform-admin disable): lockedAt =
OWNER/ADMIN temp join-gate (members + writes продолжают работать). Routes:
POST `/api/servers/:id/lock` (body { reason? ≤500 }, OWNER/ADMIN, idempotent) +
DELETE `/api/servers/:id/lock` (OWNER/ADMIN). Gate в POST `/api/servers/join/:code`:
после existing-member короткого пути, новые joins получают 403 если lockedAt !== null
с сохранённым lockedReason в payload. GET `/api/servers` DTO теперь возвращает
lockedAt + lockedReason per-server для UI badge «Сервер закрыт». Frontend UI для
toggle и badge ждёт в D-frontend slice. Pre-version-bump backend slice; bump склеен).

**Предыдущая:** v1.5.53 (Discord-parity B1 slice 2 — Settings sessions UI
+ Hotkeys read-only. Категория «Сессии и устройства» теперь грузит реальные
`GET /api/auth/sessions`, показывает browser/OS hint, IP, lastSeenAt с
«Активна сейчас» для <5 минут, optimistic `DELETE /api/auth/sessions/:id`
с refetch и честным helper'ом про refresh token/access JWT expiry. Категория
«Горячие клавиши» закрыта read-only списком только подтверждённых handlers:
Ctrl/Cmd+K search, composer Enter/Shift+Enter, @/`:emoji:` autocomplete,
`/task`, Esc close для modal/popover и Ctrl+Shift+Backquote voice diagnostics.
Placeholder-разделы обновлены на актуальный next target v1.5.55+; backend/schema
не менялись).

**Предыдущая:** v1.5.52 (Discord-parity B2 backend — Active sessions endpoint.
`RefreshToken` расширен 3 nullable полями: `userAgent` (truncated 512 chars),
`ipAddress` (X-Forwarded-For или req.ip fallback), `lastSeenAt` (bumped на каждый
findValid hit). Migration `20260529120000_add_session_metadata` + compound index
`(userId, lastSeenAt)` для GET sorted-by-activity query. Refresh layer:
`storeRefreshToken(userId, hash, meta?)` теперь принимает session meta,
`findValidRefreshTokenRow` best-effort bump'ает lastSeenAt с catch-and-ignore
race. Auth routes (register/login/refresh-rotate/password-change) обновлены —
передают `sessionMetaFromReq(req)` helper. Новые REST: `GET /api/auth/sessions`
(sorted by lastSeenAt DESC, tokenHash never exposed) + `DELETE /api/auth/sessions/:id`
с owner check (404 если другого user'а — privacy, не leak'аем existence).
"Logout from everywhere" остаётся через existing POST /api/auth/logout
(deleteAllUserRefresh). Frontend UI ждёт в B1 «Сессии и устройства» category.
Pre-version-bump backend slice; bump склеен с этим release'ом).

**Предыдущая:** v1.5.51 (Discord-parity B1 slice 1 — Settings tree nav.
`ProfileModal` удалён: настройки перенесены в `SettingsPanel` с tree-nav слева
и main panel справа. Existing profile/security/activity/push/theme/density/focus
dim/PWA install/logout flows сохранены в новых категориях: «Учётная запись»,
«Активность», «Уведомления», «Внешний вид», плюс placeholder-разделы «Скоро
в v1.5.5X+». B5 frontend закрыт в категории «Уведомления → Тихие часы»:
toggle, `input type="time"` для `quietFrom/quietTo`, timezone autodetect/read-only,
PATCH `/api/users/me/quiet-hours`, optimistic update + revert через `useProfile`,
индикатор «Сейчас тишина». Mobile tree-nav collapses в horizontal scroll;
prefers-reduced-motion отключает nav/card motion).

**Предыдущая:** v1.5.50 (Discord-parity B5 backend — Quiet hours.
Три nullable String на User: `quietFrom` / `quietTo` (HH:MM, 24-hour) +
`timezone` (IANA name). Migration `20260529100000_add_quiet_hours`
additive ALTER TABLE. New helper `apps/server/src/lib/quietHours.ts`:
pure `isInQuietHours()` парсит HH:MM в minutes-from-midnight, computes
current time в user-timezone через `Intl.DateTimeFormat` formatToParts
(h23 hourCycle), сравнивает window (same-day если from<to, midnight-spanning
если from>to). Defensive fallbacks: invalid IANA → server TZ, Intl
unavailable → UTC, invalid HH:MM → disabled. Push pipeline integration:
`notifyUser()` после existing per-event preference check добавлена quiet-hours
проверка — skip push с `{ skipped: "quiet-hours" }` если в window.
Independent от per-event toggle (mentions/dms могут быть enabled, но quiet
silences всё). Route: `PATCH /api/users/me/quiet-hours` (Zod HH:MM regex,
Intl runtime-validate для IANA, rate 30/15min). `publicProfile` DTO
расширен 3 полями).

**Предыдущая:** v1.5.49 (Discord-parity C3 — Server navigation links.
Добавлен server-scoped nav в main area: «Путеводитель» как standalone
`ServerWelcomeHero`, disabled placeholder «Мероприятия» с честным «Скоро в
v1.5.50+», «Каналы и роли» как read-only обзор каналов + матрица ролей из
существующего frontend permission mirror, «Участники» как full-screen
`MemberList`. Default при server-open теперь guide; выбор канала переводит
main area в chat mode. CLIENT-mode фильтрует «Каналы и роли» для не-manager
ролей. Backend/schema не менялись. Mobile nav скроллится горизонтально;
prefers-reduced-motion отключает underline/hover motion).

## Active Design Track — IA reset / Discord-density rebuild

**Decision 31.05.2026:** текущий интерфейс визуально и структурно перегружен.
Причина не в отдельных цветах, а в смешении четырёх слоёв в одном chrome:
global app controls, messenger/DM, server/channel structure и operational
metrics. Следующий дизайн-трек — не добавлять новые эффекты, а перестроить
information architecture под плотную Discord-like модель, сохранив
Eclipse-specific operational layer.

**Что остаётся в постоянном UI:** часы, профиль, выход, выбор темы,
медиаплеер. Метрики и графики статистики остаются, но не как постоянные
topbar-pills на каждом экране.

**RAM/CPU/NET decision:** убрать из глобального top chrome. Перенести в
контекст голосовых комнат / voice diagnostics: показывать в `VoiceRoom`,
voice mini-player / voice expanded view и diagnostics drawer, где эти данные
имеют смысл для качества связи. В обычном DM/server chat они не должны
конкурировать с навигацией и контентом.

**Целевая IA:**

```text
App
├─ Global server rail        56-72px
├─ Context sidebar           DM list или server channel tree
├─ Main workspace            friends / chat / server guide / stats
└─ Optional right rail       active contacts / members / metrics
```

**Slice plan (parallel-safe):**

1. **UXR1 — Global chrome cleanup.** Убрать RAM/CPU/NET из topbar, сократить
   постоянные topbar icons, оставить часы/profile/theme/logout/media controls
   в спокойной плотной форме. Owner: Codex.
2. **UXR2 — Voice telemetry relocation.** Вынести RAM/CPU/NET в voice context:
   `VoiceRoom`, voice mini/expanded surfaces, diagnostics drawer; без false
   claims, только реальные/уже существующие значения или честный unavailable.
   Owner: Claude.
3. **UXR3 — DM home as messenger.** Главный экран = друзья/контакты/DM search
   + active contacts right rail. Operational dashboard уходит в отдельный
   `Stats/Overview` view, не first screen. Owner: Codex.
4. **UXR4 — Server mode cleanup.** В server chat убрать постоянный
   server-home tab rail из chat mode; оставить channel header + actions +
   search. Server guide/каналы-роли/участники открываются как отдельные views,
   но не шумят над каждым каналом. Owner: Claude.
5. **UXR5 — Server popover density.** Привести `ServerActionsMenu` к compact
   Discord-like menu: grouped actions, right icons, checkboxes, danger group,
   no oversized holo surface. Owner: Codex.
6. **UXR6 — Settings shells normalization.** `SettingsPanel` и
   `ServerHubModal` остаются tree-nav, но визуально становятся плотными
   settings windows: меньше glow/cards, больше readable rows/forms. Owner:
   split after UXR1-UXR5.

**Non-goals:** не трогать schema/backend без отдельного product reason; не
делать новые декоративные hero/effects; не рисовать метрики/активность, если
нет реального data source; не ломать existing Discord-parity функционал.

**Предыдущая:** v1.5.48 (Discord-parity C7 — Welcome bot auto-post.
При успешном `POST /api/servers/join/:code` после `emitMemberJoined` fire-and-forget
block: если `server.welcomeMessage` configured, находит first TEXT channel
(lowest position) и постит system-bot message с rendered'нным шаблоном —
`{{user}}` placeholder заменяется на `@<displayName>` нового member'а. Используется
systemBot user из `lib/systemBot.ts` (auto-create если ещё не существует).
Edge cases silent skip: no welcomeMessage / no TEXT channel / systemBot create
fail / DB write fail — error логгируется через `req.log.warn`, member join всё
равно success. Permission-modelен через existing PATCH `/api/servers/:id`
(OWNER configures welcomeMessage; 500-char zod limit). Backend-only slice, frontend
без изменений — system message рисуется existing isBot=true badge. ~50 LOC в
одном файле `apps/server/src/routes/servers.ts`).

**Предыдущая:** v1.5.47 (Discord-parity C2 + D1 — Server dropdown
trigger + inline context menu. Server name в левом rail теперь открывает
popover с chevron affordance вместо прямого ServerHubModal. Меню фильтрует
actions по роли: OWNER/ADMIN видят settings/create channel/create category/event
placeholder/incident, все участники видят invite/notifications/copy ID, OWNER не
видит leave. ServerHubModal остаётся full settings через action; invite ведёт в
overview с invite-кодом, notifications — в ProfileModal push section, isolation —
в IncidentPanel quick-open. Copy ID использует `navigator.clipboard.writeText`
и inline toast. Mobile получает 80vw popover и 44px touch rows).

**Предыдущая:** v1.5.46 (Discord-parity C1 — Channel categories.
Backend `ChannelCategory` + `Channel.categoryId` взят из C1 commit `a20caf9`;
frontend: ChannelList grouping, uncategorized сверху, collapsible categories с
localStorage `ec.channelList.collapsed.<serverId>`, create/rename/delete category,
create-channel-in-category hover `+`, desktop DnD reorder/move, socket `category:*`
live update, mobile move-to select вместо touch drag. Version label synced в 4 местах).

**Предыдущая:** v1.5.45 (Discord-parity A3 — Custom user status
frontend wire. Backend `User.activityText` / `User.activityEmoji` латентно
попал в v1.5.44 master HEAD; этот slice включает UI: ProfileModal получил
секцию «Кастомный статус» с text ≤128 и emoji preset picker (≤64 unicode),
clear через null semantics и optimistic update с revert on error. Activity
рендерится под displayName в MemberList rows, DM list rows и FriendsView rows:
secondary 12-13px tone, accent на emoji, truncate на desktop/mobile. Socket
`user:activity:updated` обновляет локальные caches в members / DM conversations /
friends без F5. Version label синхронизирован в 4 местах; schema/backend не
менялись в этом slice).

**Предыдущая:** v1.5.44 (Discord-parity A2 — tabbed Friends view.
`FriendsView` заменён с flat 4-section layout на Discord-style tabs:
«Друзья» (default, accepted sorted по displayName), «В сети» (accepted с
manualStatus ONLINE/IDLE/DND, INVISIBLE скрыт), «Все» (accepted + секция
«Заблокированные» под separator), «Ожидание» (Входящие/Исходящие с separator),
«Добавить» (action-tab: открывает `AddFriendDialog`, не меняет active tab).
Badge на «Ожидание» pulse'ит при `pendingIn.length > 0`. Фильтрация полностью
frontend-side поверх existing `GET /api/friends` response; backend/schema не
менялись. Tab nav получил violet accent underline, action-tab с dashed
underline feel, mobile horizontal scroll на 390px и prefers-reduced-motion
fallback для underline/pulse. Frontend-only; deployed 28.05.2026).

**Предыдущая:** v1.5.43 (Discord-parity A1 slice 2 — Friends model
frontend foundation. Добавлен frontend contract layer для backend v1.5.42:
`apps/web/src/types/api.ts` с `FriendshipDto`/friends response types,
`useFriends(socket)` hook с initial `GET /api/friends`, 30s polling fallback,
socket-driven refresh на `friend:request:received` /
`friend:request:accepted` / `friend:removed` / `friend:blocked`, mutations
send/accept/remove/block/unblock через реальные endpoint'ы.

DM sidebar получил `FriendsPanel` между «Избранное» и DM list: pending-in badge
с violet pulse, отдельное состояние main area `FriendsView`. `FriendsView`
показывает секции «Входящие запросы» / «Друзья» / «Исходящие» /
«Заблокированные» без tabs (A2 отдельным slice), с empty/loading/error states,
desktop actions и mobile dropdown actions. Click по ACCEPTED friend открывает
существующий DM через `openDmWith(userId)`. `AddFriendDialog` отправляет запрос
по email/displayName и маппит 404/403/409/429 в честные RU errors. CSS следует
established Eclipse surface grammar: accent border/aura/holo rail, row left rail,
hover translate, SOLAR overrides и prefers-reduced-motion guard. A1 остаётся
🟡 до polish/final slice 3; deployed 28.05.2026).

**Предыдущая:** v1.5.42 (Discord-parity A1 slice 1 — Friends model
backend foundation. Новая `Friendship` модель: один row на нормализованную
пару (userAId < userBId), статусы PENDING/ACCEPTED/BLOCKED, requestedByUserId
+ blockedByUserId для аудита. Migration `20260528120000_add_friendships`:
unique pair index + два compound index'а (userAId,status) / (userBId,status)
для быстрого «мои PENDING incoming / ACCEPTED / BLOCKED» query. Cascade
на user'е (обе стороны), SetNull на requestedBy/blockedBy для audit
integrity при soft-delete user'а.

REST routes `apps/server/src/routes/friends.ts`:
- POST /api/friends/request (rate 20/15min) — поиск target по
  userId|email|displayName, auto-accept если mirror PENDING, 403 если BLOCKED,
  idempotent на ACCEPTED
- POST /api/friends/:id/accept — только addressee
- DELETE /api/friends/:id — cancel/decline/unfriend (любая сторона)
- POST /api/friends/block (rate 30/15min) — create или transition в BLOCKED
- DELETE /api/friends/block/:userId — только blocker (silent unblock, без emit)
- GET /api/friends?status=ALL|ACCEPTED|PENDING_IN|PENDING_OUT|BLOCKED —
  grouped response (5 категорий)

Socket events на `user:${userId}` room:
- friend:request:received → addressee
- friend:request:accepted → requester
- friend:removed → other участник (cancel/decline/unfriend)
- friend:blocked → blocked user (gates DM write на frontend'е)

Race-safe (P2002 retry на unique pair), threat-modeled (privacy не leak'ит
кто кого blocked — generic 403 «Blocked»). Frontend slice 2 (Codex) =
v1.5.43, slice 3 = v1.5.44. deployed 28.05.2026).

**Предыдущая:** v1.5.41 (Discord-inspired UX trek #2 — channel
emoji prefix prominent. `.ec-channel-glyph--emoji` bumped с 0.98rem до
1.18rem font-size + accent halo drop-shadow (color-mix accent 32% →
56% на hover/active). В chat-header — 1.32rem с accent halo 42%
(заметнее в title typography). Channel emoji теперь читается как
brand-element канала, не plain icon (Discord pattern «((📺))-обсуждение»
visual emphasis). CSS-only, no logic changes; deployed 28.05.2026).

**Предыдущая:** v1.5.40 (Discord-inspired UX trek #1 — Members
list role-group headers. Заменён flat СВЯЗАННЫЕ_УЗЛЫ section в MemberList
на role-grouped collapsible subsections с counts (Discord pattern «President
| 1, Sergeant at Arms | 4»). Сохранена Eclipse cyberpunk identity через
ROLE_GROUP_LABEL map: КОМАНДОРЫ (OWNER), ОПЕРАТОРЫ (ADMIN), МОДЕРАТОРЫ
(MODERATOR), АРХИТЕКТУРА (ARCHITECT), ИНЖЕНЕРЫ (DEVELOPER), ДИСПЕТЧЕРЫ
(OPERATOR), ЛИЧНЫЙ_СОСТАВ (MEMBER), КЛИЕНТЫ (CLIENT), НАБЛЮДАТЕЛИ
(VIEWER), ГОСТИ (GUEST). Order по существующему ROLE_RANK. Each section
collapsible через chevron ▾ кнопку, state persist'ится per-server в
localStorage (key COLLAPSE_KEY_PREFIX + serverId). Section labels стали
clickable buttons (.ec-section-label--toggle CSS: hover bg accent 8%,
focus-visible outline). СПЯЩИЙ_РЕЖИМ offline section — тоже collapsible
(persist key + ":offline" suffix). serverId prop wired через AppShell
→ IntelligencePanel → MemberList. Frontend-only, no schema changes;
deployed 28.05.2026).

**Предыдущая:** v1.5.39 (Phase B Tauri 2 #2 — plugins layer:
notification + updater + window-state. Desktop app version bumped 1.0.0
→ 1.0.1.
- `tauri-plugin-notification` (Cargo.toml + lib.rs Builder + capability
  `notification:default`) — native OS notifications. Existing
  `useNotifications` hook на web-side может детектить
  `window.__TAURI_INTERNALS__` и переключаться с Web Notifications API на
  Tauri plugin для лучшей desktop integration (Action Center / Notification
  Center / libnotify). Wire'инг web-side hook — отдельный slice, не в
  v1.5.39.
- `tauri-plugin-updater` (Cargo + lib.rs Builder + capability
  `updater:default` + plugins.updater config в tauri.conf.json). Endpoints
  pointing на `github.com/PavelHopson/eclipse-chat/releases/latest/download/
  latest.json` (signed manifest). Pubkey placeholder — Pavel должен
  сгенерировать keypair `npm run tauri signer generate -- -w ~/.tauri/
  eclipse-chat.key` + заменить placeholder в tauri.conf.json + сохранить
  private key в password manager + добавить TAURI_SIGNING_PRIVATE_KEY
  GitHub secret для CI publish pipeline (v1.5.41).
- `tauri-plugin-window-state` (Cargo + lib.rs Builder, capabilities не
  требует — background plugin). Drop-in: сам сохраняет window position/size
  в OS config dir перед close, восстанавливает на launch.
- README обновлён: full signing key generation guide + plugin docs +
  roadmap до v1.0.5.
deployed 27.05.2026).

**Предыдущая:** v1.5.38 (Phase B Tauri 2 #1 — apps/desktop/
workspace scaffold. Phase A PWA harden закрыта (v1.5.30/32/37);
открывается Phase B — native desktop app.
Структура:
- apps/desktop/package.json — @eclipse-chat/desktop v1.0.0, Tauri CLI как
  optionalDependencies (CI safety: install не блокируется если binary не для
  linux-x64). Scripts tauri:dev / tauri:build:{msi,nsis,dmg,deb,appimage} +
  icons:gen helper.
- apps/desktop/src-tauri/Cargo.toml — Rust workspace, tauri v2 + tauri-plugin-shell
  v2 deps. Release profile lto + opt=s + strip → minimal binary size.
- apps/desktop/src-tauri/{build.rs, src/main.rs, src/lib.rs} — main.rs с
  windows_subsystem=windows для отсутствия console window; lib.rs Tauri entry
  point готов для mobile_entry_point (Phase C iOS/Android когда дойдём).
- apps/desktop/src-tauri/tauri.conf.json — identifier ru.star-crm.eclipse-chat,
  productName Eclipse Chat, beforeDev/Build commands пробрасывают на
  apps/web workspace, frontendDist=../../web/dist, bundle targets все 5.
- apps/desktop/src-tauri/capabilities/default.json — core + shell:open
  permissions (Tauri 2 capabilities model).
- apps/web/package.json — новый script build:desktop = vite build --mode desktop.
  Reads новый apps/web/.env.desktop с VITE_BASE_PATH=/ (override path-based
  /eclipse-chat/ prod prefix, в Tauri shell base path не нужен).
- apps/desktop/README.md — full setup guide: prereqs (Rust 1.94+, WebView2),
  first-time setup (npm install + icons:gen), dev/build commands, roadmap до
  v1.0.5 (auto-update, tray, MS Store, GitHub Releases CI).
Important: desktop scripts NOT named `build` (avoid colision с root
`npm run build --workspaces --if-present` который CI/prod использует —
desktop opt-in build). Tauri CLI как optionalDependencies → npm ci в CI
не fail'ится если linux binary недоступен. /api/version и web prod build
не задеты этой версией; deployed 27.05.2026).

**Предыдущая:** v1.5.37 (Phase A — PWA harden #3: POST
share_target Level 2 — files share для installed PWA. v1.5.32 был
GET text/url only; теперь полноценно "Share photo from Gallery →
Eclipse Chat" работает на Android Chrome.
Architecture: manifest share_target.action = ./share-target POST
multipart с files[] (image/*, video/*, audio/*, pdf, txt). SW
intercept'ит POST на /share-target → парсит FormData → сохраняет
File objects в IDB store "shares" с UUID key + timestamp → 303
redirect на /?share-id=<uuid>. Frontend useShareTarget extension on
mount читает share-id из URL → IDB lookup → expose pendingFiles[]
+ pendingContent (если text+title+url шли вместе с files). Async
cleanup стары entries (TTL 10 min). MessageInput получил prefillFiles
prop + onPrefillFilesConsumed — addFiles() через тот же путь что
file picker / drop (unified validation + previews). Both DM и
channel composer mounts получают share.pendingFiles. SW_VERSION
bumped; deployed 27.05.2026).

**Предыдущая:** v1.5.36 (Server banners trek #4 (final) —
ServerSwitcher dropdown banner preview. Каждый server row в
top-left dropdown с банером: новый class .ec-srv-menu-row--banner с
inline backgroundImage url + 64px min-height + left-to-right gradient
overlay (hsl 0.88→0.30) для читабельности иконки+labelя поверх
изображения. text-shadow на label, active accent rail остаётся
видимым. Без banner'а — стандартный compact MenuRow (no regression).
Identity preview в момент выбора рабочего пространства; замыкает
4-trek chain v1.5.33-36; deployed 26.05.2026).

**Предыдущая:** v1.5.35 (Server banners trek #3 — scroll-to-top
banner в chat. MessageList получил props channelTopBanner +
channelTopSubtitle, рендерит .ec-msg-channel-top header первым child
в scroll-контейнере (перед всеми messages). Когда user scroll'ит к
началу канала — видит «Начало канала #X в [Server]» хедер. С banner:
min-height 200px, cover background, gradient overlay 180deg, text-
shadow, larger title; без banner: subtle 84px text-only label с
border-bottom. AppShell передаёт activeServer.banner +
activeServer.name. Discord pattern; deployed 26.05.2026).

**Предыдущая:** v1.5.34 (Server banners trek #2 — Welcome hero
для активного сервера когда канал не выбран. Раньше plain EmptyState
«Выберите комнату»; теперь cinematic full-area hero: cover background-
image из server.banner (1500×500 webp), gradient overlay (от прозрачного
к тёмному), centered content stack — eyebrow «Пространство» + huge
name (clamp 38-68px) + description + welcomeMessage chip + «Быстрые
входы» featured channels grid (до 6 TEXT/BROADCAST/EXECUTION). Без
banner'а — solid surface с теми же данными (no regression). Новый
ServerWelcomeHero компонент в apps/web/src/components/, ~80 LOC +
CSS rules .ec-server-welcome*. AppShell ветка !selectedChannelId
переключена с EmptyState на новый hero; deployed 26.05.2026).

**Предыдущая:** v1.5.33 (Server banners trek #1 — ChannelList
rail header banner. Server.banner был в schema с v0.10.1 (1500×500
webp) + upload/change в ServerHubModal, но в основном UI нигде не
рендерился. ChannelList получил prop serverBanner + class modifier
.ec-channel-list__header--banner: cover background-image, min-height
96px, gradient overlay sup-down (от прозрачного к hsl(220 22% 4% /
0.92)) для text-contrast на любом изображении, text-shadow на server
name + role-badge + info-icon, hover preserves backdrop transparency.
Identity reinforcement — banner виден ВСЕГДА когда сервер активен.
Без banner'а — compact header preserved (no regression). AppShell
передаёт activeServer.banner ?? null; deployed 26.05.2026).

**Предыдущая:** v1.5.32 (Phase A — PWA harden #2: Web Share
Target API. manifest.webmanifest получил share_target (GET-based,
params: share_title/share_text/share_url) + launch_handler focus-
existing. Eclipse Chat теперь появляется в системном «Поделиться» меню
(Android Chrome, Windows Chrome, Edge): user share'ит link/text из
любого app → Eclipse Chat installed PWA открывается с pre-filled
composer текущего канала (или DM если в DM-режиме). Новый
useShareTarget hook парсит URL params на mount, чистит их через
history.replaceState, экспортит composed content (title\n\ntext\n\nurl).
MessageInput получил prefillContent + onPrefillConsumed props: при
non-null prefill + пустой draft заменяет draft на prefill, фокусит
textarea, дёргает consume(). Если draft не пустой — пропускаем prefill
(защита user's work). Files share (image/video) defer'нут до v1.5.33
(POST + SW interception + IDB); deployed 26.05.2026).

**Предыдущая:** v1.5.31 (VoiceRoom screen-share polish trio:
1) overlay-chip top-left с backdrop-blur заменил gradient bottom-bar —
имя+source-icon читается на любом видео-контенте, включая чёрные frames
recursive screenshare (Pavel screenshot 26.05); 2) justifySelf:stretch +
width:100% explicit override родительского justify-items:center, screen
tile теперь force-stretches на всю ширину grid (раньше aspect-ratio +
max-height давали intrinsic-sized centered tile ~580px); 3) placeholder
с big avatar+name+«подключается…» в центре пока loadedmetadata не fired,
user видит КТО шарит до первого frame'а; deployed 26.05.2026).

**Предыдущая:** v1.5.30 (Phase A — PWA harden #1: новый
useInstallPrompt hook captures beforeinstallprompt event (Chrome/Edge/
Android) + detects iOS Safari standalone fallback. Install секция в
ProfileModal с кнопкой «Установить» (canInstall) или «Поделиться →
На экран Домой» hint для iOS. localStorage dismiss cooldown 7 дней
чтобы не спамить. App Badging API в useNotifications: setAppBadge/
clearAppBadge на icon в taskbar/launcher когда unread > 0 (Chrome
desktop, Edge, Android — iOS Safari/Firefox graceful skip через
feature-detect). SW_VERSION bumped v1.3.1 → v1.5.30 для активации
cleanup стары caches + добавлено в version-bump чеклист как 4-я
spot; deployed 26.05.2026).

**Предыдущая:** v1.5.29 (VoiceRoom screenshare tile fix:
v1.1.68 переключил object-fit=contain + per-tile aspectRatio из source
metadata, но `flexBasis: 100%, maxWidth: 100%` на screen-share inline
style тихо игнорировался (flex-свойства на grid item — no-op). Tile
оставался clamped к maxWidth=760, центрировался в 1500px grid → screen
share выглядел маленьким куском с пустым полем по бокам.
Fix: gridColumn '1/-1' (правильный grid способ span'а), maxWidth:none
(снимает 760-cap для screen-share), maxHeight:64vh (защита от 16:9
tile выше viewport если parent очень широкий). Webcam tile попадает
в row 2 → нормальный размер. Применён только к isScreen, обычные
camera tiles не задеты; deployed 25.05.2026).

**Предыдущая:** v1.5.28 (CSS split + font preload + vite tuning:
index.css slim до critical (fonts/tokens/reset/effects/motion ~148KB);
новый app.css объединяет components/responsive/player/cockpit ~178KB,
lazy с AppShell + ClientPortalContainer chunk'ами. Landing visitor
больше не платит ~178KB raw / ~27KB gzip за UI-сетку чата которую не
видит. Font preload <link rel="preload"> в index.html с stable woff2
name (vite assetFileNames без hash для woff2) — браузер грузит Geist
+ GeistMono параллельно с JS до CSS-discovery, сокращая FOIT/LCP.
chunkSizeWarningLimit=600 silence livekit-client false-positive.
Net: landing first paint ~256→~105 KB gzip (-59%); deployed
25.05.2026).

**Предыдущая:** v1.5.27 (Bundle split Партия 2: 20 modals/panels
внутри AppShell.tsx переведены на React.lazy + 3 Suspense boundaries
(panel ternary / right rail trio / modals section). AppShell.js 790 KB
→ 397 KB raw (-50%) / gzip 200 KB → 106 KB (-47%). Новые lazy chunks:
AdminPanel 73, ServerHubModal 54, VoiceRoom 54, PlatformAdminPanel 37,
ActionItemDrawer 28, ProfileModal 27, OperationalTablePanel 21,
HelpPanel 18, SearchOverlay 14, TeamHealth 13, IncidentPanel 13,
MusicExpandModal 10, ThreadPanel 8, StatusBoard 7, ChannelSettingsModal 7,
CreateGroupDmModal 5, CreateTableModal/VoiceMusicPicker/JoinServerModal/
CreateServerModal ~1-3 KB. Первый paint грузит только AppShell shell
+ MessageList + ChannelList + IntelligencePanel + composer essentials;
admin/voice/search/modals подгружаются по open click'у — null fallback;
deployed 25.05.2026).

**Предыдущая:** v1.5.26 (Landing P1 responsive audit fix:
reverse v1.4.5 auth-first decision — на ≤900 (tablet/mobile)
.ec-landing__hero-copy теперь order:1 (headline сразу виден как
premium product pitch), .ec-landing__hero-stage order:2 (форма ниже
как secondary CTA); halo сдвинут вниз так чтобы верх arc лежал ниже
навбара — top:120/right:-160 на ≤900 + top:80/right:-180/280×280
на ≤560. Top nav CTA «Запустить контур» больше не пересекается с
eclipse arc на 390px. Scope: scoped в apps/web/src/styles/landing.css
(cyan zone), product UI не тронут; deployed 25.05.2026).

**Предыдущая:** v1.5.25 (DM edit history extend: PATCH
/api/dm/messages/:id обёрнут в $transaction со snapshot'ом в
MessageEdit (та же таблица, schema-less changes); new GET
/api/dm/messages/:id/edits с participant-only check через
loadConversationMembers + isMember; useMessageEditHistory принимает
isDm флаг → переключает endpoint; MessageList prop isDm forward'ит;
AppShell DM mount передаёт isDm. Accordion UI идентичен; deployed
25.05.2026).

**Предыдущая:** v1.5.24 (Message edit history: new MessageEdit
model + migration, PATCH сохраняет snapshot в транзакции, new
GET /api/messages/:id/edits endpoint, useMessageEditHistory hook,
MessageList «(изменено)» button → inline accordion с timeline
previous versions. Migration applied на prod через prisma migrate
deploy; deployed 25.05.2026).

**Предыдущая:** v1.5.23 (Search filters: backend
operational-search query params since/until/channelId; useSearch hook
state extension; SearchOverlay filter row UI с date range + channel
select + reset btn; deployed 25.05.2026). **Tagged milestone:** v1.7.0
(`55971dd`, после chain v1.5.13 → v1.5.22).

**Предыдущая:** v1.5.22 (Quick reactions picker: 6 popular emoji
(👍 ❤️ 😂 🎉 🔥 👀) inline в message actions toolbar, click — immediate
toggle without opening full picker. Mine variant с accent ring +
halo on hover. Separator перед main actions для visual rhythm.
deployed 25.05.2026).

**Предыдущая:** v1.5.21 (IncidentPanel polish: panel root top
accent rail, card .ec-incident-card с variant modifiers (--open/
--resolved). Open variant — danger continuous breath ec-incident-open-
pulse 3.4s + hover лифт. Resolved variant — subtle calm baseline +
accent halo на hover; deployed 25.05.2026).

**Предыдущая:** v1.5.20 (AdminPanel polish: tabs c accent halo + glow
disc, cards с radial bg + accent border + top holo rail + clickable
lift hover + accent halo shadow, inputs focus state из .ec-field v1.5.7
unified ring).

**v1.5.19** (Voice occupants sticky list polish:
inline-styles → .ec-voice-occupant-* classes. Premium design language:
accent left rail 24% + hover translateX bg accent 8% + speaking variant
(color → accent + font 600 + avatar accent ring + ec-presence-pulse
3.6s breath) + muted opacity. Server-wide visibility подтверждена per
voicePresence.ts broadcasting в server:${serverId} room; deployed
25.05.2026). **Tagged milestone:** v1.6.0 (`69a08bb`, design
polish milestone после chain v1.5.3 → v1.5.12 — 10 версий, 25+ surfaces).

**v1.3.4** (historical, pre-pivot — premium SaaS pivot per Pavel verdict
24.05.2026: v1.3.x ушло слишком abstract/archival/minimal — возврат
к cinematic premium SaaS landing per HTML reference brief. Eclipse
halo backdrop в hero (740×740 cyan crescent с drop-shadow glow) +
полный 3-col product UI console mockup на right side (rail + main
feed с 3 cards: system progress / Мария сообщение с file / Иван
голосовой канал с waveform / + side панель оператора с dial +
status list); huge H1 «Коммуникация которая работает.» (clamp 58-
112px) + lead + 4 chips (Self-hosted / Encrypted / AI Memory /
Real-time); trust band flat 6-col row с monoline glyphs (Docker /
Nginx / Postgres / Minio / Redis / Grafana); features section с
4-card premium grid (Чаты и каналы / Задачи и проекты / Голос и
видео / Клиентские порталы); AI Memory split layout с visual
diagram (2 orbits + central core «AI» + 6 floating nodes) + copy
«Система помнит важное.»; Security split layout с 3D rotated cube
+ 3 sec-cards (AES-256 / RBAC / self-hosted) + bullets list ✓;
Final CTA split block с «ИЛИ» separator; gradient primary button
(linear-gradient cyan bright→deep) + ghost button. v1.3.3:
environmental pressure pass: edge vignette + fixed left/right
viewport rules с fade (implied continuation outside viewport);
hero stage fragments сжаты ещё; Memory band переведена в operational
archaeology — 8 numbered entries (#0142 .. #0001);
edge vignette + fixed left/right viewport rules с fade (implied
continuation outside viewport) → stronger framing без новой
визуальной сложности; hero stage fragments сжаты ещё (убраны
trace.detail + fragment.actor — explanation → implication);
Memory band переведена в operational archaeology — 8 numbered
entries (#0142 .. #0001) с descending timestamps от сегодня до
12.04.2026 (deploy date), depth opacity fade для глубоких слоёв
(0.5–1.0), archaeology signature footer «42 дня записи · 1 847
событий»; primary CTA получил deployment-command vibe — mono font,
sharp corners (2px), `▸` prefix через ::before; slice C: hero stage
больше не «UI mockup» — убраны chrome / rail / 2-panel grid / field
overlay / 3-row feed; вместо них 4 разрежённых operational
fragment'а в asymmetric column (trace pulse / primary execution
fragment без bubble / memory continuum traces / mono process
signature); Memory section перевeдена в full-bleed
`MemoryContinuumLayer` — выламывается из shell padding через
negative margin (100vw); Security переписана в
`SecurityAuthorityBlock` — deployment authority, NO visual art;
Execution rows получили density variation (primary 38px padding /
compact 20px / offset 12% indent text-only); copy сжат
по всем секциям; v1.3.1: monumental type + asymmetric hero grid 4fr/5fr +
hero stage больше не «UI mockup» — убраны chrome / rail / 2-panel
grid / field overlay / 3-row feed; вместо них 4 разрежённых
operational fragment'а в asymmetric column (trace pulse / primary
execution fragment без bubble / memory continuum traces / mono
process signature); Memory section перевeдена в full-bleed
`MemoryContinuumLayer` — выламывается из shell padding через
negative margin (100vw), без grid visual+copy, monumental statement
+ 4 sweeping memory traces (when / entity / body); Security
переписана в `SecurityAuthorityBlock` — deployment authority, NO
visual art (lock-in-rack убран как SaaS marketing trope), manifest
из 4 mono spec/value pairs + numbered ledger из 4 deployment
assertions; Execution rows получили density variation (primary 38px
padding / compact 20px / offset 12% indent text-only); copy сжат
по всем секциям — «implication, not explanation» per Pavel brief;
v1.3.1: monumental type + asymmetric hero grid 4fr/5fr + vertical
signal line левее H1 + silence tokens (thin/base/monumental) +
asymmetric section heads и splits + bigger body line-height; БЕЗ
sticky markers / status pills / conic-gradient noise / decorative
sci-fi gimmicks per Pavel'я brief «already running, не trying to
impress»;
v1.3.0 LIVE: slice A copy rewrite + nav cleanup —
hero «Исполнение / без хаоса.», sections переписаны в operational
verbs, bottom CTA single statement;
v1.2.32 LIVE: clean hash-route `#auth-panel` для cold-open
embedded auth, без glow-overrides; landing polish-pass: убраны 3D tilt /
Mac controls / dial / metrics column / voice waveform / composer strip /
signal-dot pulse / hero-title glow / progress glow / gradient CTAs;
mobile ≤700px заменён на compact status block; embedded auth теперь
полностью cyan/void без violet/gold;
прод сейчас на v1.2.26; включает также: Galaxy/Clock/Theme/Deadline effects +
UX-copy + дизайн-полиш + редизайн WS-1 + системный редизайн ЗАКРЫТ 8/8 +
светлая тема SOLAR (Notion-crisp) + фикс AuthScreen + смена пароля +
визуальный передел AppShell ЗАКРЫТ 4/4 + топбар-полиш +
фикс высоты строк участников + читаемый разделитель даты +
медиа-плеер ЗАКРЫТ 4/4 (перемотка + очередь + видео + watch-party) +
фикс лайтбокса + живые анимации плеера + честный TLS-ярлык композера +
redesign slice 1 — grammar v2 + фирменный плеер + кнопки + logout +
redesign slice 2 — навигация ServerSwitcher + ChannelList +
redesign slice 3 — центральная сцена MessageList + MessageInput +
redesign slice 4 — правый rail IntelligencePanel / MemberList / ThreadPanel +
redesign slice 5 — Modal-база + ChannelInfoPanel +
redesign slice 6 — SearchOverlay +
redesign slice 7 — ServerHubModal +
фикс version-дрейфа `/api/version` + smoke-тавтологии +
logout-надёжность + identity-фикс пресетов + topbar на `.ec-icon-btn` +
трек R1 — media-плеер «Signal Desk» v2 +
рекомпозиция каркаса — командный хребет + центр-бар +
трек R2 — Execution Cockpit ЗАКРЫТ 3/3: cockpit-система +
StatusBoard + OperationalTablePanel + ActionItemDrawer +
CSS-консолидация slice 7 — дубль-блоки .ec-shell* и !important-война +
трек P1 — Platform Admin для super-admin'а (Users-only: бан / снять
бан / сброс пароля + login/WS-gate) +
трек P2 — расширение Platform Admin: serverы (заморозка/разморозка),
аудит-таба, soft-delete user, suspend-gating critical writes +
трек P3 — polish Platform Admin: pagination + search-debounce +
row-click details (user/server) + suspend-gating шире +
удалённые сообщения убраны из истории чата (UI/API фильтр) +
кастомные иконки комнат + биометрический auth-gateway +
slice 6a — AdminPanel inline-долг очищен +
slice 6b — BotsTab inline-долг + JS-hover ЗАКРЫТ; brief-slice 6 ✅ +
audio-реактивный плеер: Web Audio API + AnalyserNode + RAF bars +
slash-команды backend: /me /shrug /tableflip /unflip /help +
emoji-кнопка композера с категорированным picker'ом +
nginx trailing-slash редирект `/eclipse-chat → /eclipse-chat/` +
og-image displayed URL с `/` +
thread-root edge fix v1.2.9 — удалённый root по прямой ссылке 404 +
Platform Admin details: action-buttons inside modal (Ban / Unban /
Reset PW / Delete для user, Suspend / Unsuspend для server) +
slash-команды autocomplete UI: backend-команды /me /shrug /tableflip
/unflip /help в slash-hint strip +
Platform Admin pagination jump-to-page (Стр. [_] / N) во все табы +
custom emoji backend MVP: schema + 3 endpoints (list / upload / delete) +
custom emoji frontend slice 1: AdminPanel «Эмодзи» tab + upload/delete UI +
custom emoji frontend slice 2: parser `:shortcode:` → `<img>` в RichContent +
useServerEmojis hook + cross-component invalidation через window event +
custom emoji frontend slice 3: `:` autocomplete с custom emoji + image
preview в popover +
custom emoji slice 4: reactions с custom emoji (backend whitelist
расширен + EmojiPicker secondary section + img-render reaction pill) +
custom emoji slice 5: real-time invalidation через socket
(emoji:created / emoji:deleted events) +
sci-fi sweep slice 1: композер UX-copy (ЗАЩИЩЁННЫЙ_КАНАЛ →
«Защищённый канал», ВВОД ПОТОКА → «печатает», ПЕРЕДАТЬ → «Отправить») +
AI agents Партия 1 slice 1: Bot.personality overlay — admin даёт боту
характер/юмор поверх роли + UI «Личность» в BotsTab +
AI agents Партия 2 slice 1: Tool foundation — registry + 3 базовых
tool'а (post_message / create_task / update_table_row) +
AI agents Партия 2 slice 2: Agent loop runtime + @mention integration +
agent-mode toggle в BotsTab +
Landing redesign v2: operational-infrastructure эстетика (cool cyan
palette scoped в landing.css, brutal type hierarchy, новый skeleton
с named slots для Codex'а — hero-stage / memory-diagram /
security-art)).

> **v1.1.90 … v1.2.26 задеплоены — в проде v1.2.26. v1.2.27 …
> v1.2.30 запушены и ждут approve-gate Pavel'я. Деплой НЕ
> автоматический по пушу. ⚠️ v1.2.20 + v1.2.27 включают Prisma
> migrations — при деплое нужен `prisma migrate deploy`:
>   - `20260523200000_add_custom_emojis`
>   - `20260523210000_add_bot_personality`**

> **⚠️ ЦВЕТ-ПРАВИЛО ИЗМЕНЕНО (бриф Pavel'я 20.05.2026).** Прежнее
> «cool-tone, НИКОГДА warm» — ОТМЕНЕНО. Новая identity: **violet
> `#8B5CF6` — primary акцент**, **gold `#D4AF37` — premium-точечно**,
> cyan/teal демотированы в **status-only**. Не «фиксить» violet
> обратно на cyan.

**Изменения v1.1.25 → v1.5.24:**

- **v1.5.24** — **Message edit history** (25.05.2026). Pavel «продолжаем».
  Functional feature из открытого списка: snapshot previous content на
  каждый edit, click «(изменено)» → inline accordion с timeline.
  - **Schema** (`apps/server/prisma/schema.prisma`): новый model
    `MessageEdit { id, messageId, previousContent, editedAt }`,
    relation на Message с onDelete CASCADE (history исчезает с
    message). Index `[messageId, editedAt]` для быстрого fetch newest-
    first.
  - **Migration** (`20260525170000_add_message_edits`): CREATE TABLE
    + index + foreign key constraint. Cascade-safe.
  - **Backend PATCH `/api/messages/:id`** (existing edit endpoint):
    обёрнут в `db.$transaction` — перед перезаписью Message.content
    сохраняется snapshot в MessageEdit (previousContent = current
    content, editedAt = previous editedAt OR createdAt для первого
    edit'а). Failure on UPDATE откатит snapshot — нет orphan rows.
  - **New endpoint** `GET /api/messages/:id/edits`: list snapshots
    newest-first. Member-only через channel → server → Member lookup
    (защищает history от non-member'ов). Возвращает `{ edits: [{ id,
    previousContent, editedAt }] }`.
  - **Frontend hook** `useMessageEditHistory(messageId, enabled)`
    (`apps/web/src/hooks/useMessageEditHistory.ts`): lazy fetch на
    enabled=true, cache в state (loadedFor — skip refetch на toggle).
    Exposes `edits, loading, error, reload`.
  - **MessageList UI**: «(изменено)» span → button `.ec-msg-edited`
    с `aria-expanded`. Click toggles `editHistoryId` (один accordion
    в кодовой list — экономия памяти). Под message rendered
    `.ec-msg-edit-history` accordion: header "История правок" + loading/
    error/empty states + timeline of edits с timestamps + pre-formatted
    previous content. Empty hint объясняет что first edit после
    deployment не имеет snapshot'а (это первое редактирование с
    history-фичей).
  - **CSS** (`components.css`): `.ec-msg-edited` interactive button
    (hover/expanded → accent + underline). `.ec-msg-edit-history`
    cinematic frame (radial accent + accent border + inset highlight).
    Per-entry — accent left border 2px + mono timestamp + content
    pre-block.
  - **DM messages не охвачены** — отдельный PATCH route
    `dm/messages/:id` (другой endpoint, не тронут — out of scope для
    этого slice).
  - **Files**: `apps/server/prisma/schema.prisma` (MessageEdit model
    + Message.edits relation), `apps/server/prisma/migrations/
    20260525170000_add_message_edits/migration.sql`, `apps/server/src/
    routes/messages.ts` (PATCH transaction + new GET edits endpoint),
    `apps/web/src/hooks/useMessageEditHistory.ts` (new hook), `apps/
    web/src/components/MessageList.tsx` (import, state, button +
    accordion JSX), `apps/web/src/styles/components.css` (`.ec-msg-
    edited` + `.ec-msg-edit-history*` ~85 строк).
  - **Bundle**: CSS 323.84 → 325.80 KB (+1.96 / +0.33 gzip); AppShell
    chunk +~3 KB (new hook + accordion JSX); frontend bundle structure
    unchanged.
  - **Migration impact**: новая таблица, существующие messages не
    тронуты. Прод `prisma migrate deploy` apply'ит при deploy.
    Reversible: drop table — history исчезает, edit flow продолжает
    работать.
  - **Tests**: tsc clean, vite build OK, Prisma generate OK.

- **v1.5.23** — **Search filters: date range + channel select**
  (25.05.2026). Pavel «продолжаем». Functional feature из открытого
  списка — расширение `/api/servers/:id/operational-search` фильтрами
  + UI filter row в SearchOverlay.
  - **Backend** (`apps/server/src/routes/servers.ts operational-search`):
    добавлены query params `?since=ISO&until=ISO&channelId=string`.
    ISO datetime parsed → Date через `Date.parse` (invalid тихо ignored).
    Все три findMany (messages/actions/files) фильтруются:
    - createdAt range через единый createdAtFilter (gte/lte combined).
    - channelId — message.channel.id / actionItem.channelId / attachment.
      message.channel.id (только messages этого канала).
  - **Frontend hook** (`useSearch.ts`): новый `filters` state
    (`{ since, until, channelId }`), новый `setFilters` setter. ОВ
    useEffect filter values добавлены в deps → refetch при change.
    URLSearchParams builds query string properly (skips null values).
  - **SearchOverlay UI** (`SearchOverlay.tsx`): новый блок
    `.ec-search-filters` под search bar, выше tabs. Три `<label>`
    с datetime-local inputs (since/until) + select c channels list +
    reset button (`✕`) появляется только если хотя бы один фильтр
    активен. backward-compat: filter row показывается только если
    `filters` + `onChangeFilters` props переданы.
  - **CSS** (`components.css`): новый блок `.ec-search-filter*` —
    mono uppercase labels, custom inputs с accent focus ring (unified
    с `.ec-field`), danger-tinted reset btn с scale hover.
  - **AppShell wire**: useSearch теперь возвращает `filters` +
    `setFilters`. SearchOverlay получает `filters`, `onChangeFilters`,
    `channels` (mapped из существующего channels array).
  - **Files**: `apps/server/src/routes/servers.ts` (3 findMany фильтры
    + query parsing), `apps/web/src/hooks/useSearch.ts` (SearchFilters
    type + state), `apps/web/src/components/SearchOverlay.tsx` (Props
    extend + filter row JSX), `apps/web/src/pages/AppShell.tsx`
    (props wire), `apps/web/src/styles/components.css` (.ec-search-
    filter* ~55 строк).
  - **Bundle**: CSS 322.31 → 323.84 KB (+1.53 / +0.13 gzip); JS chunks
    unchanged (минорный +0.4 KB по AppShell от useSearch state).
  - **Tests**: tsc clean, vite build OK.

- **v1.5.22** — **Quick reactions picker** (25.05.2026). Pavel «продолжай»
  — next item открытого списка functional features. 6 popular emoji
  inline в actions toolbar — без opening full picker, Slack/Linear pattern.
  - **MessageList renderRow**: prepended quick-react buttons (👍 ❤️
    😂 🎉 🔥 👀) перед main toolbar. Каждый — `.ec-msg-action ec-msg-
    quick-react`. Click → `onToggleReaction(messageId, emoji)`
    immediately (мгновенный toggle, нет opening picker'а).
  - **Mine variant** (`--mine`): если user уже поставил эту реакцию —
    button accent-soft + inset accent ring. Click — снимает реакцию
    (toggle behavior).
  - **Hover effects** (`.ec-msg-quick-react:hover`): `translateY(-1px)
    scale(1.18)` + accent-mix bg + accent halo `0 4px 12px -6px /
    0.50`. Mine variant — accent-soft bg + accent ring + halo `0 4px
    14px -4px / 0.60`.
  - **Separator** (`.ec-msg-action-sep`): 1px vertical line border-subtle
    после 6 emojis перед main actions (thread/picker/copy/edit/delete/
    pin). Visual rhythm разделение.
  - **Existing picker button** (smiley face) сохранён — открывает
    full EmojiPicker для случаев когда нужна не из 6 popular.
  - **Files**: `apps/web/src/components/MessageList.tsx` (quick-reacts
    render block + separator inside actions toolbar), `apps/web/src/
    styles/components.css` (.ec-msg-quick-react + --mine + .ec-msg-
    action-sep, ~30 строк).
  - **Bundle**: CSS 321.73 → 322.31 KB (+0.58 / +0.10 gzip); AppShell
    chunk без изменений (.tsx минорный +25 строк JSX).
  - **Tests**: tsc clean, vite build OK.

- **v1.5.21** — **IncidentPanel polish** (25.05.2026). Pavel «продолжай».
  Single panel surface ещё не получивший unified design language.
  - **Panel root** (`.ec-incident-panel::before`): top accent rail
    cyan→violet bridge (единый язык с modal-header / popover / chat-
    header / composer).
  - **Incident card** (`.ec-incident-card`): new className + variant
    modifiers `--open`/`--resolved`. Inline JS hover handlers (mouseEnter/
    Leave с boxShadow) **удалены** — CSS hover берёт верх. Hover —
    `translateY(-2px)`.
  - **`--resolved` variant**: subtle border-subtle baseline, на hover
    border → accent 24% mix + violet halo `0 10px 28px -10px / 0.40`
    + inset accent (calm, не отвлекает).
  - **`--open` variant**: danger border + radial danger bg + новый
    `ec-incident-open-pulse` 3.4s breath. Continuous danger
    box-shadow ramp (16→26px / 0.40→0.60) — привлекает внимание к
    unresolved incidents без агрессии. Hover лифт + сильнее halo
    `0 12px 32px -10px hsl(0 70% 50% / 0.55)`.
  - **prefers-reduced-motion**: `.ec-incident-card--open` в общий
    RM-блок.
  - **Files**: `apps/web/src/components/IncidentPanel.tsx` (renderCard
    className wire, inline hover handlers removed), `apps/web/src/
    styles/components.css` (.ec-incident-panel + .ec-incident-card*
    блок ~55 строк), `apps/web/src/styles/motion.css` (1 keyframe + RM
    extend).
  - **Bundle**: CSS 320.27 → 321.73 KB (+1.46 / +0.22 gzip); frontend
    chunks unchanged.
  - **Tests**: tsc clean, vite build OK.

- **v1.5.20** — **AdminPanel polish** (25.05.2026). Pavel «продолжаем
  по списку» — next item. AdminPanel surfaces (`.ec-admin-tabs`,
  `.ec-admin-card`, `.ec-admin-input`) выровнены под общий design
  language.
  - **Admin tabs** (`.ec-admin-tabs/.ec-admin-tab`): container получил
    subtle radial accent + inset highlight. Tab hover — translateY(-1px)
    (вместо просто color shift). Active tab — accent halo
    `0 4px 14px -6px / 0.50` + `::after` blurred 8px halo disc (= pattern
    SearchOverlay tabs v1.5.7).
  - **Admin cards** (`.ec-admin-card`): accent-tinted border 14% mix
    + radial bg + multi-shadow с violet undertone + top accent rail
    `::before` (cyan→violet bridge static). overflow: hidden — rail
    aligned border-radius. `--clickable` variant hover теперь
    translateY(-2px) + bigger radial bg 10% + accent halo
    `0 10px 28px -10px / 0.45` + inset accent 1px (cinematic feel).
  - **Admin inputs** (`.ec-admin-input`): focus state выровнен под
    `.ec-field` (v1.5.7) — accent border + `0 0 0 3px accent-soft` ring
    + `0 0 22px / 0.18` violet halo + inset highlight + bg →
    input-bg-focus.
  - **Files**: `apps/web/src/styles/cockpit.css` (.ec-admin-tabs/-tab
    + .ec-admin-card + .ec-admin-input rewrites).
  - **Bundle**: CSS 318.70 → 320.27 KB (+1.57 / +0.15 gzip); frontend
    chunks unchanged.
  - **Tests**: tsc clean, vite build OK.

- **v1.5.19** — **Voice occupants sticky list — premium polish + verify
  server-wide visibility** (25.05.2026). Pavel прислал screenshot
  (Eclipse Forge sidebar) и попросил «в голосовых комнатах надо видеть
  всех кто там находится на панели слева под комнатами, должны видеть
  все пользователи сервера, которые даже не находятся в этих комнатах».
  Это значит: voice occupants list под voice channel — visible ВСЕМ
  server members (не только тем кто в комнате). Серверная сторона уже
  это broadcast'ит (per voicePresence.ts emit `voice:participant:joined/
  left/meta/speaking` в `server:${serverId}` room — ВСЕ members получают
  events независимо от того в voice ли они сами). На client'е также
  snapshot seeded при connect через `voice:state`/`voice:meta`. Поведение
  работает корректно. Текущая реализация в ChannelList.tsx — inline
  styles (≈80 строк). Pavel'я ссылка на скриншот — желание чтобы это
  выглядело premium.
  - **TSX refactor** (`ChannelList.tsx renderVoiceOccupants`): inline
    styles переведены на `.ec-voice-occupant-list`/`-row`/`-row__avatar`/
    `-row__name`/`-row__state` classes. Modifier variants: `--speaking`,
    `--muted`. data-state атрибут для glyph differentiation
    (deafened/muted).
  - **CSS** (`components.css` after .ec-channel-item rules): premium
    list-row treatment в едином design language:
    - Container: accent left rail 24% mix + inset 1px violet glow.
    - Row hover: bg `color-mix accent 8%` + color → text + translateX(2px)
      (same pattern что DM rows / channel-list active / member rows /
      search hits / popover items / srv menu rows / message stream).
    - **Speaking variant**: color → accent + font-weight 600 + avatar
      shadow `0 0 0 1.5px accent, 0 0 12px / 0.65` + `ec-presence-pulse`
      3.6s breath (тот же что у MemberList online dot).
    - **Muted variant**: avatar opacity 0.6, name opacity 0.7.
  - **prefers-reduced-motion**: `.ec-voice-occupant-row--speaking
    .ec-voice-occupant-row__avatar` добавлен в общий RM-блок.
  - **Visibility confirmed**: server-wide broadcast уже работает —
    backend `voicePresence.ts` emit'ит в `server:${serverId}` (ВСЕ members
    получают), backend `index.ts buildVoicePresenceSnapshot` seeded
    initial snapshot для всех VOICE channels на user'овских серверах
    при connect. Frontend `useVoicePresence` хранит `byChannel` snapshot
    и обновляется по delta events.
  - **Files**: `apps/web/src/components/ChannelList.tsx` (renderVoiceOccupants
    refactor inline → classNames), `apps/web/src/styles/components.css`
    (.ec-voice-occupant-* блок ~70 строк), `apps/web/src/styles/motion.css`
    (RM extend).
  - **Bundle**: CSS 317.11 → 318.70 KB (+1.59 / +0.25 gzip); AppShell
    chunk 786.89 → 786.33 KB (−0.56 — inline styles вынесены в CSS).
  - **Tests**: tsc clean, vite build OK.

- **v1.5.18** — **AI Партия 3: model-level fallback + 429 backoff retry**
  (25.05.2026). Pavel «продолжаем». Из открытого backend-list'а —
  «Партия 3: Free model fallback chain (DeepSeek → Llama 3.1 → Qwen +
  robust retry on rate-limit с backoff)». Provider-level chain
  (Ollama → OpenRouter → NVIDIA → OpenAI) уже был; добавлен
  **model-level fallback внутри провайдера** + **exponential backoff
  retry** на 429/5xx.
  - **ProviderConfig refactor**: `model: string` → `models: string[]`.
    Iterate'ит через каждую model при rate-limit / 5xx — fallback'ит
    на следующую модель того же провайдера прежде чем уйти на
    следующий provider.
  - **New env vars** (CSV, plural form): `OPENROUTER_MODELS`,
    `OLLAMA_MODELS`, `NVIDIA_MODELS`, `OPENAI_MODELS`. Legacy single-
    model env vars (`OPENROUTER_MODEL` etc.) сохранены — parseModels
    helper handles обе формы. Default OpenRouter chain если env
    пустой: **`deepseek/deepseek-chat-v3.1:free`,
    `meta-llama/llama-3.3-70b-instruct:free`,
    `qwen/qwen-2.5-72b-instruct:free`** — три бесплатные модели по
    rotation'у при rate-limit.
  - **Retry logic** (`callWithRetry`):
    - **429 rate-limit**: exponential backoff 500ms → 1500ms → 4000ms
      (3 retries max, 4 total attempts).
    - **5xx server error**: single retry after 1000ms (transient outage).
    - **4xx auth / bad request / network / timeout**: NO retry, fail
      immediately и surface к outer model/provider fallback.
  - **Logger output**: при retry → `[ai] retry <provider>/<model>
    after Nms (status X, attempt N)`. При model failure →
    `[ai] model failed <provider>/<model>: <reason>, trying next
    model`. При provider failure → `[ai] provider failed <provider>
    (models tried: ...): <reason>, trying next provider`. Server
    debug visibility ясная: видно где chain'ом ушли.
  - **API signature совместим**: outer `chat()` функция unchanged
    (тот же ChatMessage[] + opts → ChatResult). Caller'ы
    (`assistant.ts`, `agentLoop.ts`, `taskFromChat.ts`) не требуют
    изменений.
  - **Files**: `apps/server/src/ai/provider.ts` (ProviderConfig types
    update, parseModels helper, callProviderModel + callWithRetry +
    callProvider refactor, sleep helper, BACKOFF_DELAYS_MS const).
  - **Bundle**: server-only refactor, frontend chunks unchanged
    (main 239.67 / AppShell 786.89 / CPC 19.16 / livekit 513.91).
  - **Tests**: tsc clean, vite build OK.

- **v1.5.17** — **Bundle split: React.lazy + Suspense для AppShell/Portal**
  (25.05.2026). Pavel «продолжаем по списку» — top открытых направлений
  был deferred Bundle split. Real perf win для landing visitors.
  - **App.tsx refactor**: `import { AppShell }` и `import {
    ClientPortalContainer }` заменены на `React.lazy(() => import(...)
    .then(m => ({ default: m.X })))` (named-to-default shim — React.lazy
    умеет только default export). LandingPage остаётся eager — visitors
    видят его instantly без waterfall'а.
  - **Suspense wrapper** обнимает оба lazy-сценария (AppShell и Portal),
    fallback совпадает с initial loading state (`Загрузка…`) — нет
    «двойного перехода» при cold-start на authenticated user-а.
  - **Effect on cold-load** (landing visitor):
    - **Main bundle** (eager): 1050.59 → **239.67 KB** (−77% / gzip
      278.11 → **73.91 KB** = **−73% gzip**).
    - **AppShell chunk** (lazy): 786.89 KB / 198.53 gzip — грузится
      ТОЛЬКО после login. Tucks livekit-client peers, useVoice,
      useChannelMusic, ServerHubModal, AdminPanel и всё что под
      AppShell.
    - **ClientPortalContainer chunk** (lazy): 19.16 KB / 5.22 gzip —
      грузится только при `#/portal/<id>` hash.
    - **EmptyIcons chunk**: 3.12 KB auto-split Rollup'ом
      (используется обоими сценариями).
    - **livekit-client** chunk (existing, unchanged): 513.91 KB —
      separate chunk был раньше, теперь tucks к AppShell в graph'е.
  - **Vite config**: не тронут — default Rollup automatic code-splitting
    для dynamic imports срабатывает без manualChunks override.
  - **Edge cases handled**:
    - `#auth-panel` hash на cold-start — `LandingPage` (eager) рендерится
      сразу с auth surface.
    - `#/portal/X` hash на authed user — Suspense fallback показывает
      Загрузка пока ClientPortalContainer chunk fetch'ится.
    - Auth → AppShell transition — Suspense fallback ~50-200ms (chunk
      грузится с network); previous behavior был instant render.
    - Logout → Re-login — AppShell chunk уже cached, instant.
  - **Files**: `apps/web/src/App.tsx` (imports → lazy + Suspense wrap).
  - **Tests**: tsc clean, vite build OK с 5 chunks вместо 2.

- **v1.5.16** — **VoiceRoom premium polish** (25.05.2026). Pavel
  «продолжай». Последний major surface не получивший unified design
  language — voice room (1098 строк TSX, в основном inline styles —
  rewrite опасный). Hybrid стратегия: атмосферные accents через
  `::before/::after` поверх existing classNames + новые classNames
  на ключевых child surfaces (controls, presence cards, video tiles)
  с CSS-overrides.
  - **Room atmosphere** (`.ec-voice-room::before/::after`): top
    accent rail (cyan→violet gradient) + bottom radial violet glow.
    Без conflict'а с inline radial backgrounds в `roomWrap`.
  - **Controls dock** (`.ec-voice-room__controls`): accent-tinted
    border 22% mix !important (override inline shadow's border-like
    look) + `::before` top holo rail (cyan→violet bridge с border-
    radius matching `--ec-radius-full`).
  - **Control buttons** — добавлен helper `ctrlClassFor(style)`:
    reference-identity mapping inline style → semantic className
    (`ec-vr-ctrl`/`--danger`/`--accent`). 8 control buttons получили
    className (mic/deafen/camera/screen-share/stats/diagnostics/
    settings/leave). Hover behavior per-variant: base — translateY
    + accent halo `0 6px 18px -6px / 0.55`; danger — red halo
    `hsl(0 70% 55% / 0.65)`; accent (already-active) — усиленный
    `0 8px 26px -4px / 0.62` halo.
  - **Presence cards** (`.ec-vr-presence-card`): added className,
    hover translateY(-2px). Speaking variant получает continuous
    `ec-vr-card-pulse` 3.2s — accent box-shadow ramp (40% → 55%
    + 12 → 14px drop + 28px violet halo на peak).
  - **Video tiles** (`.ec-vr-video-tile`): hover translateY(-2px)
    + multi-shadow ramp. (Speaking variant defined in CSS — wire
    ожидает добавления `speaking: boolean` в `VoiceVisualTrack` type
    в useVoice.ts; deferred — текущий type не имеет этого field'а.)
  - **prefers-reduced-motion**: `.ec-vr-presence-card--speaking` +
    `.ec-vr-video-tile--speaking` в RM-блоке.
  - **Files**: `apps/web/src/styles/player.css` (.ec-voice-room
    pseudo-elements + controls override + .ec-vr-ctrl* + .ec-vr-
    presence-card* + .ec-vr-video-tile* — ~110 строк), `apps/web/
    src/styles/motion.css` (2 keyframes + RM extend), `apps/web/
    src/components/VoiceRoom.tsx` (ctrlClassFor helper + className
    на 8 controls + presence-card + video-tile root).
  - **Bundle**: CSS 314.13 → 317.11 KB (+2.98 / +0.49 gzip);
    JS 1050.10 → 1050.59 KB (+0.49 — helper + classNames).
  - **Tests**: tsc clean, vite build OK.

- **v1.5.15** — **lightbox premium polish + window-level drag-drop overlay**
  (25.05.2026). Pavel «давай это сделаем» — combo из топ-3 рекомендаций.
  VoiceRoom выделен в v1.5.16 из-за scope (1098 строк TSX).
  - **Attachment lightbox** (`Attachments.tsx Lightbox`): inline-styles
    переведены на `.ec-lightbox-*` classes (player.css).
    Backdrop — radial violet aura at center + 90% darkness + blur
    14px (тот же паттерн что у `.ec-modal-backdrop` v1.5.5). Image
    получил accent-tinted border + violet drop-shadow `0 30px 70px
    -22px hsl(258 86% 35% / 0.55)` + inset holo. Controls (top-right):
    .ec-lightbox-btn 38→40px с accent radial bg + accent border на
    hover + violet halo shadow. Caption (bottom): centered pill с
    accent border + radial bg + glass blur; filename + meta (size +
    dims + counter). Nav buttons (если multi) получают accent scale
    1.06 hover.
  - **Full-screen drag-drop overlay** (new feature):
    `MessageInput.tsx` теперь регистрирует window-level
    `dragenter/leave/over/drop` listeners (counter-based для browser
    nesting bug). `dataTransfer.types` filter ловит только real file
    drag (не intra-page drag). Когда `windowDragOver=true` → portal
    renders `.ec-drag-overlay` поверх viewport. Cinematic card:
    radial violet aura backdrop + 2px dashed accent border 55% mix +
    triple shadow (drop + inset accent + 80px violet glow) +
    `ec-modal-zoom-in` entry + `ec-drag-card-pulse` 2.4s continuous
    glow ramp (boxshadow 0.65→0.80 + 80→120px halo). 64px violet
    play-btn-style icon (radial fill, тот же что audio play btn в
    v1.5.6) с continuous breath. Title «Бросьте файлы» + hint
    «Любое количество — будут вложены к следующему сообщению».
  - **Existing composer drag** (узкий drop на сам composer)
    сохранён — два уровня detection coexist'ят.
  - **prefers-reduced-motion**: `.ec-drag-overlay__card` + `__icon`
    + `.ec-lightbox-backdrop` + `.ec-lightbox-img` добавлены в
    общий RM-блок (fallback animation: none).
  - **Files**: `apps/web/src/styles/player.css` (`.ec-lightbox-*`
    block ~85 строк + `.ec-drag-overlay*` block ~50 строк),
    `apps/web/src/styles/motion.css` (1 keyframe + RM extend),
    `apps/web/src/components/Attachments.tsx` (inline styles
    Lightbox удалены, classNames wired), `apps/web/src/components/
    MessageInput.tsx` (createPortal import, windowDragOver useEffect
    с window listeners, portal overlay JSX перед form content).
  - **Bundle**: CSS 308.87 → 314.13 KB (+5.26 / +0.86 gzip);
    JS 1049.84 → 1050.10 KB (+0.26 — небольшой createPortal +
    useEffect wire).
  - **Tests**: tsc clean, vite build OK.

- **v1.5.14** — **shared music room: auto-advance + server-wide playlist**
  (25.05.2026). Pavel «следующий трек не включается, надо чтобы в
  комнате создавался плейлист из всех треков, которые в чатах сервера
  и в комнате можно было все включать в плейлисте и переключать».
  Серьёзная feature (не CSS pass) — расширение voice-room shared
  listening.
  - **Auto-advance fix (critical bug)**: `<audio>` в MusicMiniPlayer
    не слушал `onEnded` event — поэтому когда трек заканчивался,
    backend не получал skip, следующий из queue не запускался.
    Новый `isHost: boolean` prop через AppShell (`music.session.host.id
    === user.id`); только host вызывает `onSkip()` на ended (избегаем
    403 storm от non-host listeners — каждый клиент тоже видит ended
    почти одновременно). Если queue пуст — backend дропает session +
    эмитит null, socket update приводит всех в idle.
  - **Backend new endpoint** `GET /api/servers/:id/audio-library`
    (`apps/server/src/routes/servers.ts`): member-only, limit 200,
    sort by createdAt desc. Возвращает все audio attachments в каналах
    сервера (с фильтром `internal: false` для CLIENT-mode + role MEMBER),
    с привязкой к channel + uploader. `waveformPeaks` (Prisma Json
    column) сериализуется как `number[] | null` через `Array.isArray`
    guard.
  - **Backend new endpoint** `POST /api/channels/:id/music/playlist`
    (`apps/server/src/routes/music.ts`): bulk-set плейлиста. Body
    `{ attachmentIds: string[] }` (zod, max 200). Первый attachment
    → current track (host берёт control), остальные → REPLACE queue
    (атомарный upsert в одной DB транзакции). Battery filter — `findMany`
    одной группой проверяет что каждый id audio + принадлежит серверу;
    битые id фильтруются молча, сохраняется порядок из request'а.
    Эффективнее N+1 запросов через старый /queue endpoint.
  - **Frontend new hook** `useServerAudioLibrary(serverId)` (`apps/web/
    src/hooks/useServerAudioLibrary.ts`): загружает library, caches
    в state. Refetch при serverId change. В AppShell hook
    активируется ТОЛЬКО когда modal open + music.session есть —
    избегаем бесполезный fetch на idle.
  - **Frontend hook extension** `useChannelMusic`: новый
    `startPlaylist(ids: string[])` callback → POST /music/playlist.
  - **MusicExpandModal playlist section** (`apps/web/src/components/
    MusicExpandModal.tsx`): новые props `library: LibraryTrack[]`,
    `libraryLoading`, `onStartTrack(id)`, `onAddToQueue(id)`,
    `onStartPlaylist(ids[])`. UI: header «Аудиотека · N треков» +
    «▶ Проиграть все» CTA в правом углу (вызывает onStartPlaylist
    со всеми ids). Per-row layout: filename + `#channel · uploader`
    sub-text + actions (▶ play / + queue) скрыты до hover + badge
    states (`играет` для current track, `в очереди` для tracks уже
    в queue). Current track row подсвечен accent-soft + accent left
    rail. Empty state «В этом пространстве пока нет аудиофайлов».
  - **CSS** (`apps/web/src/styles/player.css`): новый блок
    `.ec-player-library*` — accent-tinted container, scrollable list
    max-h 280px, row hover bg + translateX(2px), current row с accent
    left rail `::before`, badge styles (current accent vs queued grey),
    actions opacity 0 → 1 on hover, новый `.ec-icon-btn--sm` modifier
    22×22px для compact playlist buttons.
  - **AppShell wire**: `useServerAudioLibrary(showMusicExpand &&
    music.session ? activeServerId : null)` (conditional fetch), все
    handlers wired в `<MusicExpandModal>` invocation.
  - **prefers-reduced-motion**: existing scroll transition уже
    respect'ит RM (используется var(--ec-dur-fast) который sets to
    1ms в RM-блоке).
  - **Files**: `apps/web/src/components/MusicMiniPlayer.tsx`
    (`isHost` prop + onEnded handler), `apps/web/src/components/
    MusicExpandModal.tsx` (props + library section + helpers),
    `apps/web/src/hooks/useChannelMusic.ts` (startPlaylist),
    `apps/web/src/hooks/useServerAudioLibrary.ts` (новый),
    `apps/web/src/pages/AppShell.tsx` (import + hook + props wire),
    `apps/web/src/styles/player.css` (.ec-player-library*),
    `apps/server/src/routes/servers.ts` (audio-library endpoint),
    `apps/server/src/routes/music.ts` (playlist endpoint + zod schema),
    + 3 version bump files + ROADMAP.md.
  - **Bundle**: CSS 305.93 → 308.87 KB (+2.94 / +0.37 gzip);
    JS 1046.65 → 1049.84 KB (+3.19 / +0.77 gzip — new playlist UI +
    hook + handlers + types).
  - **Tests**: tsc clean (после 2 type narrow fixes — `msg.channel`
    null guard через flatMap), vite build OK.

- **v1.5.13** — **waveform wave-flow animation** (25.05.2026). Pavel
  прислал screenshot текущего audio плеера: «давай в музыкальном плеере
  сделаем дорожку более анимированной с анимациями и ввиде волны».
  Bars видны хорошо но статичные — добавил continuous wave breath на
  все bars + deeper sine fallback shape.
  - **Idle wave**: каждый `<rect>` waveform получает `.ec-wave-bar`
    класс с `ec-wave-flow` 2.4s ease-in-out infinite — scaleY
    0.85 ↔ 1.15. Per-bar `animationDelay: ${i * 70}ms` через inline
    style — wave propagation illusion слева направо (40+ bars × 70ms =
    больше чем 1 cycle, так что в любой момент wave visible на всей
    дорожке). `transform-box: fill-box; transform-origin: center` +
    `will-change: transform` для smooth GPU rendering.
  - **Live ripple** (existing v1.5.3): `.ec-wave-bar--live` теперь
    оверайдит `.ec-wave-bar` animation через cascade priority —
    last 4 played bars near playhead получают stronger `ec-wave-pulse`
    720ms (scaleY 1 → 1.45) когда playing. Layering — idle wave
    flows, live zone pulses ярче.
  - **Fallback peaks**: было `Array.from({length: 48}, (_, i) =>
    30 + sin(i/2)*12)` — простой sine 18-42 range, 48 bars.
    Стало 64 bars с тройной composition (primary `sin(i*0.28)*28` +
    secondary harmonic `sin(i*0.65)*12` + drift `sin(i*1.1)*6`),
    clamped 18-92. Cinematic waveform shape без actual peak data —
    выглядит как реальный track даже если decode failed.
  - **opacity**: unplayed bars 0.45 → 0.5 для лучшей видимости wave
    animation на background segments.
  - **prefers-reduced-motion**: `.ec-wave-bar` (новый base class)
    добавлен в RM-блок наряду с `--live` variant — fallback
    `animation: none` (статичные bars).
  - **Files**: `apps/web/src/components/Attachments.tsx` (Waveform
    bars: className wired, inline animationDelay per-bar + deeper
    fallback peaks 48→64 + tripple sine), `apps/web/src/styles/
    motion.css` (1 new keyframe + .ec-wave-bar base + RM extend).
  - **Bundle**: CSS 305.76 → 305.93 KB (+0.17 / ~+0.03 gzip);
    JS 1046.52 → 1046.65 KB (+0.13). Minimal — single keyframe + 1
    style modifier.
  - **Tests**: tsc clean, vite build OK.


> Roadmap entries для v1.4.0 → v1.5.2 ещё не дописаны (большой
> design pass: v1.4.0 wow-pass milestone tag, v1.4.5 audit fixes,
> v1.5.0 section deep polish milestone tag, v1.5.1 Home dashboard,
> v1.5.2 AppShell combo). v1.5.3 идёт ниже — следующий chat surface
> slice. Catch-up по v1.4-v1.5.2 — отдельной сессией.

- **v1.5.12** — **MemberList row premium polish** (25.05.2026). Pavel
  «продолжаем». Right-rail member roster был единственным sidebar
  list'ом ещё не полированным (DM list v1.5.2, channel list v1.5.11,
  search hits v1.5.7, popover items v1.5.7, srv menu rows v1.5.7
  — все имели accent left rail + translateX + bg accent-mix).
  Member row выровнен под этот язык.
  - **Row** (`.ec-member-row`): новый `::before` accent rail (2px,
    scaleY 0→1 + opacity 0→1 transition). На hover/focus-within
    background → `color-mix(in srgb, var(--ec-accent) 8%, transparent)`,
    `translateX(2px)`, halo `0 4px 14px -8px hsl(258 86% 50% / 0.40)`.
  - **Avatar** (`.ec-member-row__avatar`): `border-radius: 50%` для
    halo, на hover row scale(1.04) + soft accent halo
    `0 0 18px -4px var(--ec-accent-soft)`. Тот же паттерн что
    `.ec-msg-avatar-wrap` (message stream v1.5.3) — единый avatar
    behavior.
  - **Presence dot** (`.ec-member-row__presence`): online users
    (`:not(.ec-member-row--offline) .ec-member-row__presence`)
    получают continuous `ec-presence-pulse` 3.6s — green halo
    box-shadow ramp 6→10px / 55→85%. Подтверждает «alive» статус;
    offline остаётся плоской.
  - **DM button** (`.ec-member-row__dm`): теперь въезжает справа
    (`translateX(4px)` idle → `translateX(0)` на hover row, вместо
    мгновенного opacity 0→1). Hover button — `translateY(-1px)`
    с !important (overriding row's translateX scope) + accent border
    + `0 4px 14px -6px / 0.55` halo.
  - **prefers-reduced-motion**: presence-pulse + member-row::before
    transition добавлены в RM-блок.
  - **Files**: `apps/web/src/styles/components.css` (member-row +
    avatar + presence + dm-btn rewrites), `apps/web/src/styles/
    motion.css` (RM extend).
  - **Bundle**: CSS 304.41 → 305.76 KB (+1.35 / +0.07 gzip);
    JS unchanged. Pure CSS pass.
  - **Tests**: tsc clean, vite build OK.

- **v1.5.11** — **trio polish: ChatHeader + ChannelList active + ThemeToggle knob**
  (25.05.2026). После прохождения «по списку» effects (#5/#7/#11/#15
  все уже applied в существующей кодовой базе — handoff был outdated),
  Pavel «продолжай». Batch trio из daily-visible micro-surfaces.
  - **ChatHeader** (`.ec-chat-header`): triple-layer bg — radial violet
    0%/0% (8%) + radial cyan 100%/100% (5%) + base depth linear-gradient
    (was: single linear-gradient). Border-bottom accent-tinted (12% mix).
    Box-shadow ramped + inset accent baseline. Top accent rail `::before`
    (cyan→violet bridge, static — единый design language с modal-header
    / popover-surface / composer-box). `.ec-chat-title__glyph` получил
    accent drop-shadow `0 0 6px / 0.40` (#hash / voice-icon weight).
  - **ChannelList active item** (`.ec-channel-item--active`):
    - Background: 90deg violet 15% → 20% mix + cyan bridge 6% middle
      stop (deeper, more visible active state).
    - Border 18% → 24% accent mix.
    - Box-shadow: `0 0 28px -4px / 12%` outer halo + `0 4px 14px -8px
      hsl(258 86% 35% / 0.45)` violet depth shadow.
    - **Rail** (`::before`): 16 → 22px tall, halo `0 0 14 → 16px /
      55% → 75%` + secondary gold `0 0 6px / 35%`. Новый
      `ec-channel-rail-breath` 4.4s — box-shadow oscillates violet
      16→24px / 75→95% и gold 6→10px / 35→55%.
  - **ThemeToggle** (`.ec-theme-toggle__knob`): continuous 4s breath
    (`ec-theme-knob-breath` для VOID violet eclipse, `-solar` variant
    для SOLAR gold sun). Knob теперь чувствуется как живой eclipse-shape,
    не плоский switch.
  - **prefers-reduced-motion**: `ec-channel-item--active::before` +
    `ec-theme-toggle__knob` добавлены в RM-блок.
  - **Files**: `apps/web/src/styles/components.css` (ChatHeader rewrite
    + top rail ::before + glyph drop-shadow + ChannelList active rewrite
    + rail breath wire), `apps/web/src/styles/effects.css` (ThemeToggle
    knob 2 animation hooks), `apps/web/src/styles/motion.css` (3 new
    keyframes + RM extend).
  - **Bundle**: CSS 303.17 → 304.41 KB (+1.24 / +0.22 gzip);
    JS unchanged (1046.52 / 277.02). Pure CSS pass.
  - **Tests**: tsc clean, vite build 4.69s OK.

- **v1.5.10** — **DeadlineSignal premium polish** (effect #5 applied,
  25.05.2026). Pavel «делаем дальше по списку» — следующий пункт
  effects folder: дедлайн анимация. Текущая base + overdue alert
  была слишком простая (плоская pill + плоский box-shadow ring).
  Переработана с unified design language.
  - **Base pill**: добавлен `border` (accent-tinted, color-mix
    deadline 22%) + inset highlight `0 1px 0 hsl(0 0% 100% / 0.04)`.
    Padding слегка увеличен (0.12rem/0.48rem → 0.14rem/0.50rem)
    для breathing room. Color background 14% → 16% mix.
  - **Hover**: `translateY(-1px)` + border bump до 38% mix +
    `0 4px 14px -6px` deadline-colored halo. Card элевируется
    при наведении (актуально для long task-list где нужно tap'ать
    pill).
  - **Ring (progress arc)**: drop-shadow glow 3px → 4px (brighter
    baseline).
  - **Overdue alert**: переписан полностью. Был — single box-shadow
    ring pulse 0→4px. Стал — multi-layer:
    - `transform: scale(1 → 1.04)` — pill живёт, не плоско pulse'ит.
    - Inner ring `0 0 0 0→4px / 10% mix` + outer halo `0 0 12→26px /
      55→70% mix` + inset highlight. Тройной shadow создаёт depth.
    - Static border-color (55% mix) + background (22% mix) — overdue
      pills сразу выделяются среди других даже без animation step.
    - Ring stroke получает sync'нутую `ec-deadline-ring-glow` 1.6s —
      filter drop-shadow ramps 4 → 10px (double-stack), визуально
      «горящий контур».
  - **prefers-reduced-motion**: оба keyframe (alert + ring-glow) в
    RM-блоке — fallback `animation: none`.
  - **Files**: `apps/web/src/styles/effects.css` (signal pill + hover
    + ring drop-shadow + overdue 3-layer pulse + 1 new keyframe +
    RM extend). `DeadlineSignal.tsx` НЕ тронут — pure CSS pass.
  - **Bundle**: CSS 301.89 → 303.17 KB (+1.28 / +0.17 gzip);
    JS unchanged. Sole element pass — surgical impact.
  - **Tests**: tsc clean, vite build 4.30s OK.

- **v1.5.9** — **EclipseGalaxy decoration enhancement** (25.05.2026).
  Pavel «делаем дальше по списку» — top открытых направлений был
  right-rail EclipseGalaxy (заявленный в handoff'е как «уже animated,
  но можно усилить halo breath + crescent rotation speed»). Полный
  pass по eclipse-визуалу — он же ставит mood'у каждой страницы.
  - **`--shell` variant**: opacity 0.25 → 0.32. Больше presence
    в right rail без отвлечения от content'а.
  - **Halo** (`.ec-galaxy__halo`): deeper layered colors — теперь
    4 radial layers (violet core 28% / mid-violet 20% / **gold accent
    16%** / distant cyan 8%). Это «hybrid identity» — violet+gold
    (см. memory `eclipse_color_violet_gold`). Blur 22→24px. Breath
    keyframe обновлён: opacity range 0.62/0.92 → 0.56/1.0, scale
    1/1.035 → 1/1.06 (≈на 70% больше amplitude). Duration 9s → 7s
    (faster breathing — eclipse «alive»).
  - **Corona / crescent** (`.ec-galaxy__corona`): rotation 24s → 16s
    (явный «active eclipse» feeling). Conic gradient переработан —
    добавлены gold flare (45° hsl 100% 70% / 0.92) + extra violet
    accent + cyan bridge. Crescent теперь действительно читается как
    solar disc за лунным затмением, не плоское halo.
  - **Core** (`.ec-galaxy__core`): новый subtle 5.6s pulse breath
    (`ec-galaxy-core-pulse` keyframe) — scale 1/1.025 + box-shadow
    accent ramps 28%→48% + добавлен secondary 32px gold halo
    `hsl(45 100% 70% / 0.18)` на peak'е. Подтягивает взгляд к центру
    затмения без агрессии.
  - **Stars** (`.ec-galaxy__stars span`): 2px → 3px size (заметнее) +
    halo обогащён — primary violet 14px + secondary gold 4px. Каждая
    звезда теперь — живая точка света, не плоский dot.
  - **prefers-reduced-motion**: `.ec-galaxy__core` добавлен в
    existing RM-блок (наряду с halo/corona/ring/streams/stars).
  - **Files**: `apps/web/src/styles/effects.css` (1 variant opacity
    + 4 visual element rewrites + 1 keyframe + RM extend).
    EclipseGalaxy.tsx НЕ тронут — pure CSS pass.
  - **Bundle**: CSS 301.41 → 301.89 KB (+0.48 / +0.09 gzip);
    JS unchanged. Visual impact >> bundle cost.
  - **Tests**: tsc clean, vite build 4.31s OK.

- **v1.5.8** — **composer premium polish** (25.05.2026). Pavel
  «продолжаем» — next slice из daily-touched surfaces. Composer
  (`MessageInput`) — caretакта-сайт пользователя при каждом сообщении,
  заслуживает hero-treatment как send-button и focus-state.
  - **Composer box**: triple-layer background (radial violet 0%/0%
    + radial cyan 100%/100% + base hsl 10% / 0.62). Top accent rail
    `::before` (cyan→violet gradient, opacity 0.6 idle → 1.0 на focus).
    Multi-shadow с violet undertone `0 4px 14px -10px / 0.30`.
    Focus-within state — стronger border accent + 26px violet glow
    + 8px violet depth shadow.
  - **Send button**: переведён с flat linear-gradient на radial
    `hsl(258 86% 72% → 52%)` premium fill (как audio play btn в
    v1.5.6 — единый visual language для primary actions). Triple
    inset shadow (highlight + base + bottom shade). Continuous 4.2s
    breath (`ec-composer-send-breath`) на canSend=true: box-shadow
    осцилляция + accent glow ramp. Hover — brightness(1.08) +
    translateY(-1px) + 28px violet halo + paper-plane icon
    translateX(2px) translateY(-1px) («launch» motion). Active —
    inset press-in shadow + scale(0.96).
  - **Icon buttons** (attach/voice/emoji): hover теперь
    `color-mix accent 10%` bg + accent color + `0 4px 14px / 0.45`
    violet halo (вместо плоского surface-3).
  - **Textarea**: `caret-color: var(--ec-accent)` — violet каретка;
    placeholder получает accent-tinted color на focus (35% mix).
  - **`.ec-kbd`**: gradient background (surface-2 → violet 6% mix)
    + inset highlight/shade — выглядит как реальная физическая
    клавиша вместо плоского tag'а.
  - **prefers-reduced-motion**: `ec-composer-send-breath` добавлен
    в RM-блок — fallback animation:none.
  - **Files**: `apps/web/src/styles/components.css` (composer-box +
    send + icon-btn + textarea + kbd блоки), `apps/web/src/styles/
    motion.css` (1 keyframe + RM extend).
  - **Bundle**: CSS 299.32 → 301.41 KB (+2.09 / +0.29 gzip);
    JS unchanged (1046.52 / 277.02). Pure CSS pass.
  - **Tests**: tsc clean, vite build 4.67s OK.

- **v1.5.7** — **design polish combo: 6 surfaces за один pass**
  (25.05.2026). Pavel «продолжаем разработку и доработку дизайна»
  + список из 6 направлений (SearchOverlay / Server switcher /
  ContextMenu+Dropdown / Form inputs / Toast banners / Empty states).
  Batched в один deploy чтобы избежать 30 минут CI-waiting на 5
  отдельных циклов.

  **SearchOverlay** (Ctrl+K): backdrop с radial violet aura at center
  + blur 10→12px; panel — accent-tinted border + multi-shadow
  (`0 30px 70px / 0.45`) + top holo sweep `::before` (cyan→violet
  bridge 1.6s ease-out, как у modal-header v1.5.5); search-bar
  получил `:focus-within` glow ring (inset -2px accent + 24px aura);
  input bigger 1.04rem + accent caret-color; tabs row — subtle accent
  tint background; active tab `::after` — blurred 8px halo disc;
  hits row — accent left-rail `::before` (scaleY anim) + bg accent-soft
  + translateX(3px) + `0 4px 14px -8px / 0.45` shadow + focus-visible
  с inset accent border.

  **Popover/ContextMenu base** (`.ec-popover-surface` + `.ec-popover-item`):
  единый cinematic frame для AutocompletePopover + ParticipantContextMenu
  + любых будущих floating menus. Radial violet aura + accent border
  (24% mix) + multi-shadow + top holo rail static (не sweep — frequent
  popover'ы не должны отвлекать). Items получают accent left rail на
  hover/active + translateX(2px) + background accent 10% mix. Entry
  через `ec-popover-in` (220ms scale 0.97→1 + translateY -4→0).
  AutocompletePopover полностью перенесён с inline на classNames
  (исчез wrap/itemStyle/itemActive/headerLabel — все стали
  `.ec-popover-*`). ParticipantContextMenu получил className на root
  div.

  **Form inputs**: `.ec-field:focus` обогащён — `0 0 22px / 0.18` glow
  ring + inset highlight `0 1px 0 hsl(0 0% 100% / 0.04)`. `select.ec-field`
  получил custom SVG chevron (violet baseline, gold on focus) через
  `data:image/svg+xml` background. Global `input[type="checkbox"]` +
  `input[type="radio"]` — `accent-color: var(--ec-accent)` + 16px
  size + hover `scale(1.1)` + accent drop-shadow + focus-visible ring.

  **Toast / banners**: `.ec-ephemeral-banner` — добавлен radial accent
  aura backdrop + accent left rail `::before` + entry анимация
  `ec-banner-slide-in` (translateY -8→0 + opacity 0→1 + drop-shadow
  appear). Visual consistency с popover/search/modal через тот же
  paradigm — multi-layer бекграунд + accent rail.

  **Empty states**: EmptyState получил `.ec-empty-state` className.
  Icon-wrap наращен orbital rings — `::before` (-10% inset, 1px violet
  18%) + `::after` (-22% inset, 1px cyan 12%, 18s slow rotate).
  Continuous 5.6s breath на icon (scale 1.04 + accent drop-shadow
  ramp). Title получил linear-gradient text fill (text-strong → 65%
  accent mix) + letter-spacing 0.005em. Entry — `ec-fade-in` 360ms.

  **Server switcher**: `.ec-srv-panel` (workspace dropdown в topbar) —
  заменён базовый `var(--ec-surface-2)` на cinematic stack (radial
  violet aura + overlay-bg + accent border 24% mix + multi-shadow +
  backdrop-blur 16px). Top holo rail `::before` (same gradient pattern).
  Entry `ec-popover-in` 220ms с `transform-origin: top left`.
  `.ec-srv-menu-row` — accent left rail на hover/aria-current (same
  pattern как popover-item/search-hit) + bg accent 10% mix + shadow
  `0 4px 12px -8px / 0.4`.

  **prefers-reduced-motion**: все 4 новых continuous/transition анимации
  (`ec-popover-in`, `ec-banner-slide-in`, `ec-empty-icon-breath`,
  `ec-empty-orbit`) + targeted selectors добавлены в общий RM-блок.

  **Files**: `apps/web/src/styles/components.css` (SearchOverlay block
  rewrite + new `.ec-popover-surface/.ec-popover-item/.ec-popover-header`
  + `.ec-empty-state*` + `.ec-srv-panel` rewrite + `.ec-srv-menu-row::before`
  rail + form input enhancements + `select.ec-field` chevron),
  `apps/web/src/styles/motion.css` (4 keyframes + RM extend extensions),
  `apps/web/src/styles/cockpit.css` (`.ec-ephemeral-banner` rewrite),
  `apps/web/src/components/AutocompletePopover.tsx` (inline → className),
  `apps/web/src/components/ParticipantContextMenu.tsx` (className на
  root), `apps/web/src/components/EmptyState.tsx` (2 classNames added).

  **Bundle**: CSS 290.66 → 299.32 KB (+8.66 / +1.44 gzip);
  JS 1047.07 → 1046.52 KB (-0.55 — inline styles вынесены в CSS,
  TSX shrunk). Net: 6 surface polish за ~10 KB CSS.

  **Tests**: tsc clean, vite build 4.88s OK. Vitest skip (registry
  ECONNRESET); CI Validate отработает.

- **v1.5.6** — **media players premium redesign** (25.05.2026). Pavel
  показал скриншот текущих audio плееров (2 stacked cards с
  Hollywood_Undead + LeanJe filenames) — слишком обычные. Также
  скриншот video player с DEVIL MAY CRY (Netflix). Verdict: «надо
  чтобы были анимированные красивые профессиональные плееры,
  максимально крутой и не обычный».
  - **Audio container** (`.ec-audio-attachment`): padding 0.65rem →
    1rem 1.05rem, grid-col 42→56px (для bigger play btn), gap 10→14px,
    width 500→520px. Background — triple-layer: radial violet 0%/0%
    (10% intensity) + radial cyan 100%/100% (6%) + linear depth.
    Border accent-tinted `color-mix(in srgb, var(--ec-accent) 18%, ...)`.
    Box-shadow многослойный: violet drop-shadow `0 14px 38px -16px
    hsl(258 86% 35% / 0.40)` + base depth + inset holo. На :hover
    `translateY(-1px)` + border intensify + violet shadow ramp до 55%.
    Voice variant — стronger accent border (34% mix) + violet aura
    шире (16% radial). Top accent rail `::before` — 1px cyan→violet
    bridge gradient (как в modal-header sweep, но static).
  - **Audio play button** (`.ec-audio-attachment__icon`): 42 → 52px,
    переведён с outline-style (transparent bg + violet text) на solid
    accent fill — `radial-gradient(circle at 30% 30%, hsl(258 86% 72%),
    hsl(258 86% 52%))` + white SVG icon с drop-shadow. Triple
    box-shadow: outer violet `0 6px 18px -4px / 0.55` + inset highlight
    + inset bottom shade (3D depth). **Continuous 3.6s breath**
    (`ec-audio-play-breath` keyframe) — outer shadow осциллирует между
    /0.55 и /0.70. Hover scale(1.06) + intensified halo. Active
    scale(0.94). SVG glyph 14→18px + drop-shadow для veneer.
  - **Audio title** (`.ec-audio-attachment__title`): 0.875rem → 0.92rem,
    letter-spacing 0.005em. Mask-image `linear-gradient(to right, black
    88%, transparent 100%)` — soft fade на overflow вместо hard ellipsis.
  - **Audio meta row** — chips вместо plain text. Timestamp (first span)
    получил violet pill: `hsl(258 86% 62% / 0.12)` bg + border + accent
    color hsl 78%, padding 1px 7px, `--ec-radius-sm`. Остальные spans
    остаются inline-text для контраста с chip.
  - **Custom volume slider** (`.ec-audio-volume-slider`): native input
    range полностью кастомизирован через
    `::-webkit-slider-runnable-track` + `::-webkit-slider-thumb` (+
    Firefox equivalents `::-moz-range-track`/`::-moz-range-thumb`).
    Track 4px tall, fill — `linear-gradient(to right, accent 0% var(--volume-progress),
    grey 100%)`. CSS-variable `--volume-progress` устанавливается inline
    `style` в TSX из `${volume*100}%` — live update без re-render
    через CSS. Thumb 13px circle с radial gradient white→violet, accent
    border, triple box-shadow (3px halo + 6px deep drop). На :hover
    thumb scale(1.18) + halo ramp до 4px/0.28. Focus-visible — halo
    bump до 0.45. Fallback `accentColor: var(--ec-accent)` оставлен
    inline для Safari/Firefox legacy.
  - **Audio download btn**: 32→36px, добавлен subtle bg
    `hsl(225 14% 60% / 0.04)`, hover ramp — accent + border-accent +
    accent-soft bg + `translateY(-1px)` + `0 4px 14px -6px / 0.55`
    drop. Active scale(0.94).
  - **Video container** (`.ec-video-attachment`): border accent-tint
    (18% mix), triple-radial background (violet + cyan + surface).
    Box-shadow violet undertone `0 16px 42px -14px / 0.40`. Hover
    `translateY(-2px)` + border 38% mix + shadow ramp до 55%.
    Top accent rail `::before` (1px cyan→violet) + bottom darkness
    overlay `::after` (50% height linear-gradient к hsl 4% / 0.85).
  - **Video element**: opacity 0.84 → 0.86 idle, на hover ramp до 1.0 +
    `scale(1.018)` (subtle zoom-in over 700ms).
  - **Video play overlay** (`.ec-video-attachment__play svg`): 52 → 84px
    с padding 14 → 24px. Background — radial violet
    `hsl(258 86% 70% → 40% / 0.85)` (cinematic glow disc, не plain
    backdrop). Box-shadow: outer `0 8px 32px / 0.6` + inset highlight.
    **Continuous 2.8s halo pulse** (`ec-video-play-halo` keyframe) —
    drop-shadow осциллирует 18→28px. Hover scale(1.08) + halo до 0.85.
  - **Video meta bar**: padding 0.45→0.55rem, border accent-tinted
    (20% accent), background dual-layer linear-gradient к hsl 4%/0.82
    + saturated backdrop-filter 16px / 160%. Box-shadow + inset
    highlight для glass effect. Filename now `font-weight: 600 +
    letter-spacing 0.005em`. Size получил mono font + accent color
    hsl 78% + tracking-wide — выглядит как HUD-измерение.
  - **prefers-reduced-motion**: 2 новых анимации (`ec-audio-play-breath`,
    `ec-video-play-halo`) добавлены в общий RM-блок через
    `.ec-audio-attachment__icon` + `.ec-video-attachment__play svg`
    селекторы → `animation: none !important`. Структурные improvements
    (border, shadow, glass) — сохраняются.
  - **Files**: `apps/web/src/styles/components.css` (full
    `.ec-audio-attachment*` block rewrite + full `.ec-video-attachment*`
    block rewrite + `.ec-audio-volume-slider` block), `apps/web/src/
    styles/motion.css` (2 keyframes + RM extend), `apps/web/src/
    components/Attachments.tsx` (1 input — добавлен className + style
    с CSS-variable + типизация `as React.CSSProperties`).
  - **Bundle**: CSS 284.74 → 290.66 KB (+5.92 KB / +1.00 gzip);
    JS 1047.07 → 1047.13 KB (+0.06 — единственная `as React.CSSProperties`
    типизация в TSX). Pure design-layer pass.
  - **Tests**: tsc clean, vite build 3.53s OK. Vitest skip (registry
    ECONNRESET); CI Validate отработает.

- **v1.5.5** — **modal motion choreography pass** (25.05.2026). Pavel
  «продолжаем разработку и доработку дизайна» — pick из открытых
  направлений: централизованный visual polish base `Modal.tsx` +
  `.ec-modal-*` CSS. Все 14+ модалок (ChannelSettings, CreateChannel,
  CreateServer, JoinServer, Profile, TwoFactorSetup, MusicExpand,
  VoiceSettings, ServerHub, PlatformUserDetails, etc.) наследуют от
  базы — single-edit-wide-impact.
  - **Backdrop**: вместо плоского `rgba(0,0,0,0.55)` теперь double-layer:
    `radial-gradient` violet aura at center (10% → 4% → transparent) +
    base darkness 58%. Blur 8→10px. Анимация — новый `ec-modal-backdrop-in`
    keyframe (opacity 0→1 + blur 0→10px, fade-in feel «свет собирается»).
  - **Modal-box zoom**: keyframe `ec-modal-zoom-in` обогащён 3D
    perspective(1200px) + `rotateX(2.4deg → 0)` для лёгкого Y-tilt'а
    («окно поднимается»). Дополнительно ramp по `drop-shadow`: на 60%
    keyframe — max accent halo `0 18px 38px hsl(258 86% 55% / 0.22)`,
    оседает в финальный `0 14px 28px / 0.14`.
  - **Modal-box surface**: добавлена 1px accent-tinted border
    (`color-mix(in srgb, var(--ec-accent) 22%, default)`) + inset 1px
    holo line `hsl(258 86% 62% / 0.10)` + большой fall-shadow
    `0 30px 70px -22px hsl(258 86% 35% / 0.45)`. Дают «парящее» окно
    с накопленным violet glow вокруг.
  - **Header holo-edge sweep**: override `.ec-modal-header.ec-holo-edge::before`
    — 1px cyan baseline сохраняется, поверх него layered linear-gradient
    с peak `hsl(180 70% 75%) → hsl(258 86% 75%)` (cyan→violet bridge),
    background-size 220% + animation `ec-modal-holo-sweep` 1.6s ease-out
    delay 120ms (single pass после backdrop'а). Линия «оживает» один
    раз при открытии модалки.
  - **Close button** (`.ec-modal-close`): hover → accent color +
    accent-soft background + `0 0 14px -4px hsl(258 86% 62% / 0.55)`
    glow + `rotate(90deg)` (X становится + при hover'е). Active —
    `rotate(90deg) scale(0.92)`. focus-visible — accent outline.
  - **Footer mirror**: добавлен симметричный 1px hairline `::before`
    (transparent → cyan 0.22 → violet 0.18 → transparent), без анимации.
    Сохраняет visual rhythm — header sweep + footer baseline = paired
    accent rails.
  - **prefers-reduced-motion**: `ec-anim-modal-zoom`, `ec-anim-modal-backdrop`,
    `.ec-modal-header.ec-holo-edge::before` все в RM-блоке — все анимации
    через `animation: none !important`. Статичная картинка остаётся
    читабельной.
  - **Files**: `apps/web/src/styles/motion.css` (2 keyframes +
    `.ec-anim-modal-backdrop` utility + RM extend), `apps/web/src/styles/
    components.css` (`.ec-modal-backdrop` rewrite, `.ec-modal-box` border
    + shadow + transform-origin, `.ec-modal-header.ec-holo-edge::before`
    override, `.ec-modal-close` polish, `.ec-modal-footer::before` mirror).
    `Modal.tsx` НЕ тронут — все улучшения через CSS селекторы.
  - **Bundle**: CSS 282.55 → 284.74 KB (+2.19 KB / +0.45 gzip);
    JS unchanged (1047 KB / 276.97 gzip) — pure CSS pass.
  - **Tests**: tsc clean, vite build 7.21s OK. Vitest skip (registry
    ECONNRESET); CI Validate отработает.

- **v1.5.4** — **topbar AI agent button** (25.05.2026). Pavel verdict
  «продолжаем» — next small fast win из открытых направлений: violet
  glow icon между Notifications и SpiderClock'ом + click ripple.
  - **Button**: новая `.ec-ai-btn` (поверх `.ec-icon-btn`) в
    `apps/web/src/pages/AppShell.tsx` сразу перед `<SpiderClock />`.
    SVG — 4-point sparkle с малым акцент-блеском (opacity 0.7).
    Continuous violet glow breath через `.ec-anim-ai-pulse` —
    3.8s `drop-shadow(0 0 3-11px hsl(258 86% 62% / 0.30-0.70))`
    + цвет дрейфит между `hsl(258 86% 72%)` и `hsl(258 86% 80%)`.
  - **Hover**: `translateY(-1px)` + brighter color + усиленный
    glow `0 0 12px / 0.65`.
  - **Click ripple**: `<span>` с `key={aiRippleKey}` — каждый клик
    инкрементит ключ → React перемонтирует элемент → запускается
    540ms `ec-ai-ripple` keyframe (`scale(1) → scale(10)`,
    `opacity 0.65 → 0`). Material-style диффузия из центра кнопки,
    overflow:hidden на самой кнопке.
  - **Functional wiring**: click → `window.dispatchEvent(new
    CustomEvent("ec-ai-trigger"))`. `MessageInput` слушает этот event
    в новом `useEffect` — если textarea пуста, prefill «@ai » + focus
    + caret в конец; если что-то введено — просто focus (не затирает
    draft).
  - **Why @ai prefix**: существующая server-side AI mention infrastructure
    (`apps/server/src/ai/assistant.ts` + frontend mirror в
    `apps/web/src/lib/aiMention.ts`) уже понимает `@ai` keyword и
    запускает GENERIC bot reply. Кнопка — visual shortcut в уже
    работающий flow.
  - **prefers-reduced-motion**: `ec-anim-ai-pulse`, `ec-anim-ai-ripple`,
    `.ec-ai-btn`, `.ec-ai-btn-ripple` добавлены в общий RM-блок —
    fallback `animation: none` + reset.
  - **Files**: `apps/web/src/pages/AppShell.tsx` (+state aiRippleKey,
    +button JSX), `apps/web/src/components/MessageInput.tsx`
    (+useEffect window listener), `apps/web/src/styles/motion.css`
    (2 keyframes + 2 utility-классов + RM extend), `apps/web/src/styles/
    components.css` (45 строк `.ec-ai-btn` + `.ec-ai-btn-ripple`).
  - **Bundle**: CSS 281.40 → 282.55 KB (+1.15), JS 1046.04 → 1047.07 KB
    (+1.03). Gzip соразмерный (+0.22 / +0.28).
  - **Tests**: tsc clean, vite build 3.17s OK. Vitest skip (та же
    локальная ECONNRESET к npmjs.org); CI Validate отработает.

- **v1.5.2** — **AppShell wow combo** (24.05.2026, `e1a03b4`). Pavel
  «комбинация» AppShell effects. Telemetry pills extended с history
  (last 20 samples / 200s sliding window) → `Sparkline` mini-charts
  (inline SVG, currentColor matching pill status, 30×16px) в ПАМ и
  ЦП pills. New `NetworkWave` (4-bar pulse, staggered animation-delay)
  в СЕТЬ pill. DM rows premium hover: active indicator scaleY +
  translateX(2px), avatar `breath` pulse у online users, unread
  badge pulse + violet halo. Quick action buttons получили Material
  ripple на click (CSS keyframe scale + opacity transition).
  Hook `useTelemetry` extended с `memHistory` / `cpuHistory` arrays
  для sparkline'ов.

- **v1.5.1** — **Home dashboard «Сегодня» polish** (24.05.2026, `c2bb212`).
  `useAnimatedCounter` hook (smooth count-up RAF, easeOutQuart) для
  numeric stat cards. Time-of-day greeting (4 периода: ночь/утро/день/
  вечер с accent colors). Premium zen empty state «Всё под контролем»
  — eclipse orb 56px + 3 radiating rings (concentric, staggered
  opacity fade) + breath-animated checkmark внутри (scale 0.94→1.0
  4s ease). Stat-card hover glow усилен (violet box-shadow ramp).

- **v1.5.0** — **wow-pass slice B (section polish)** MILESTONE
  (24.05.2026, `49dbd4c`, **tagged v1.5.0**). После v1.4 wow-fix
  Pavel «зафиксируем дизайн» — milestone. Деёп polish на secondary
  landing sections:
  - **AI Memory** animated diagram — SVG `<line>` connection lines
    между central core «AI Memory» и 6 floating nodes (Решения /
    Документы / Задачи / Обсуждения / Файлы / Участники), data
    pulses (SVG `<animate>` along path), orbit rotation (52s slow
    + 34s reverse), node hover triggers connection line accent.
  - **Security cube** — `transform: rotateX(55deg) rotateZ(45deg)`
    3D faces, continuous slow spin (40s), layered drop-shadows для
    depth, nested rings around cube.
  - **Cyber grid backdrop** — fixed background `repeating-linear-
    gradient` 1px violet/cyan lines + radial mask fade.
  - **Shield rings** (security visual) — 3 concentric circles с
    staggered breath.
  - **Nav magnetic links** — каждый nav-link получает inline hover
    rect tracking (mouse x/y → tilt 4deg + accent shift). Scroll-
    driven sliding cyan indicator под active nav (intersect-based).

- **v1.4.5** — **audit fixes P1/P2** (24.05.2026, `adfcb44`). Pavel'я
  ultrareview audit verdict. P1 desktop fit (nav 160→104px height,
  hero 860→640px, auth frame 480→440px — auth frame обрезался на
  1440×1000), P1 mobile auth-first (order swap stage/copy на
  ≤700px), P2 off-screen elements fix (memory orbit overflow:hidden),
  P2 security copy precision (TLS + AES-256-GCM + RBAC+2FA вместо
  overstated «end-to-end encryption»).

- **v1.4.1 / 1.4.2 / 1.4.3 / 1.4.4** — auth form polish + hotfixes
  (`9e2b7f9` / `364a6a2` / `d82cc7a` / `34c8a75`). v1.4.1 — premium
  auth form polish: floating labels (React state-based, нет browser
  autofill hack'а), field icons (UserIcon/MailIcon/LockIcon),
  tab horizontal slide indicator, corner brackets pulse. v1.4.2
  hotfix layout (slider wrapper ломал flex parent, `::before`
  конфликтовал с border-image). v1.4.3 — hero H1 fix per Pavel
  («Работа в одном контуре.» вместо «Коммуникация которая
  работает.»). v1.4.4 hotfix floating labels (наезжали на values
  когда password не пустой).

- **v1.4.0** — **wow-pass cinematic premium polish** MILESTONE
  (24.05.2026, `87bad9c`, **tagged v1.4.0**). Phase 3 effects
  integration. Pavel «зафиксируем дизайн» в этой точке. Что
  применено из effects folder:
  - **#1 Cursor trail** — canvas particle system (vanilla, без libs)
    на landing hero, accent violet/cyan particles trailing mouse,
    fade-out 800ms.
  - **#2 Electric border** (применено также в v1.3.12 auth) — SVG
    feTurbulence + feDisplacementMap filter для accent frame.
    Animated через CSS step-function на baseFrequency.
  - **#6 Tilt cards** (concept, без vanilla-tilt lib) — 4 feature
    cards landing с 3D parallax: rotateX/rotateY tracking mouse
    relative к card center, perspective(1000px), spring-back
    transition.
  - **Magnetic CTA button** — primary CTA «Войти в контур»
    attracts cursor (transform: translate tracking mouse delta).
  - **Holographic shimmer** на auth frame — `linear-gradient`
    rainbow с background-position animation 6s loop.
  - **Split-text reveal H1** — staggered span-per-letter с
    animation-delay (50ms per char), `transform: translateY(20px)`
    → 0 + opacity 0 → 1.
  - **Logo** теперь 140px desktop с brightness/contrast filter +
    cyan drop-shadow.

- **v1.3.12** — **S1 auth form effects** (`bb7fd77`). 3 эффекта из
  Pavel'я effects folder применены на AuthPage:
  - **#2 Electric Border** — accent frame получает SVG turbulence/
    displace filter animation. Frame «потрескивает».
  - **#17 Password scanner beam** — inline scanner line бежит через
    password field когда user typing (linear-gradient background-
    position 1.4s linear infinite).
  - **Submit success state** — на successful auth кнопка checkmark
    explosion (CSS scale + multiple radial pseudo-elements fade-out).

- **v1.3.5 → v1.3.11** — logo integration chain (`8f9fc4c` →
  `1eac191`). Pavel прислал `docs/design/logo.png` 49MB original.
  Через .NET `System.Drawing.Bitmap` resize до 1600×1067 +
  compressed → 0.14MB (`apps/web/public/eclipse-chat-logo.png`),
  backup standard size в `eclipse-chat-logo-standard.png` 2.1MB.
  Везде применён через `${import.meta.env.BASE_URL}eclipse-chat-logo.png`.
  v1.3.5 — premium hero access panel (console mockup убран —
  squeezed на узком viewport, заменён custom auth form embedded).
  v1.3.6 — премиум custom auth form в нашей палитре + анимации.
  v1.3.7 — Eclipse Chat logo (PNG) везде: landing / AppShell /
  AuthPage. v1.3.8 — больше logo (visibility fix). v1.3.9 — ещё
  больше + contrast boost. v1.3.10 — Pavel'я новый увеличенный
  logo + standard backup. v1.3.11 — logo ещё крупнее (PC visibility).

- **v1.5.3** — **chat surface polish combo** (25.05.2026). Pavel verdict
  «v1.5.2 закрыли AppShell-combo, дальше Chat surface». Делаем premium
  pass на message stream — четыре концентрированных полировки внутри
  `MessageList` + `Attachments`.
  - **Sender chip premium**: `<strong>` имени автора заменён на
    `<button className="ec-msg-author">` — hover/focus-visible меняет
    color на `--ec-accent` без подчёркивания, active даёт `color-mix`
    на 20% darker. Avatar wrapper получил отдельный класс
    `.ec-msg-avatar-wrap` с transition `transform + box-shadow`; на
    hover строки avatar делает `scale(1.04)` + мягкий accent halo
    (`0 0 18px -4px var(--ec-accent-soft)`). AI-роль badge не тронут
    (уже работает).
  - **Timestamp hover reveal**: оба `<time>` элемента (header и
    sticky-time в grouped) получают `title=` с полной датой через
    новый `formatFullDateTime()` (`ru-RU` locale, «25 мая 2026, 21:34»).
    На hover строки время меняет color с `--ec-text-dim` на
    `--ec-accent`. Sticky-time дополнительно теперь подсвечивается
    при direct hover'е на сам tag.
  - **Reactions glow**: inline-стили реакций вынесены в класс
    `.ec-msg-reaction` (+`.ec-msg-reaction--mine` для своих). Hover
    даёт `translateY(-1px) scale(1.06)` + accent border + soft
    `box-shadow 0 4px 14px -4px var(--ec-accent-soft)`. Свои реакции
    получают `.ec-anim-reaction-mine` — continuous 4.2s breath по
    `box-shadow` + `border-color` (keyframe `ec-reaction-mine-breath`).
    Counter получил отдельный `<span key={r.count} className="ec-msg-
    reaction-count ec-anim-count-bump">` — при изменении значения
    React перемонтирует элемент и проигрывает 320ms `ec-count-bump`
    (translateY -2px + scale 1.18 → back).
  - **Voice waveform live**: `Waveform` принимает новый prop
    `isPlaying`. Когда `true`, 4 последних played bars перед playhead
    получают класс `.ec-wave-bar--live` — 720ms `scaleY(1 → 1.45 → 1)`
    с staggered `animation-delay: ${distFromHead * 90ms}` (trailing
    ripple от playhead'а назад). Дополнительно рендерится вертикальная
    `<line className="ec-wave-playhead">` на позиции `fillIdx * slot` —
    1.4px stroke `--ec-accent`, opacity-pulse 1.1s
    (`ec-wave-playhead` keyframe). SVG получил общий класс
    `.ec-waveform` (вынесен из inline-style).
  - **prefers-reduced-motion**: все 4 новых анимации
    (`reaction-mine`, `count-bump`, `wave-bar--live`, `wave-playhead`)
    добавлены в `@media (prefers-reduced-motion: reduce)` блок — fallback
    `animation: none` + reset `opacity/transform`, как и старые
    motion-tokens.
  - **Дизайн lock**: identity v1.4.0 milestone сохранён — только
    polish существующих surface'ов, никаких структурных изменений.
    Hybrid color scope соблюдён: chat surface = product UI = violet/gold
    accent identity (через `--ec-accent` token, который в AppShell
    маппится на violet `#8B5CF6`).
  - **Файлы**: `apps/web/src/styles/motion.css` (4 keyframes + 5
    utility-классов + prefers-reduced-motion extend), `apps/web/src/
    styles/components.css` (5 новых компонент-классов после
    `.ec-msg-pill` секции), `apps/web/src/components/MessageList.tsx`
    (формат-helper `formatFullDateTime` + avatar wrap class + author
    button + time class + reaction класс-перенос + count bump key
    re-mount), `apps/web/src/components/Attachments.tsx` (Waveform
    `isPlaying` prop + live-zone классификация + playhead line).
  - **Bundle**: CSS 281.40 KB → 48.97 KB gzip (+~трос от polish);
    JS 1046 KB → 276.69 KB gzip (без изменений — только TSX patches
    внутри уже подключённых компонент).
  - **Tests**: `tsc -b --noEmit` clean, `npm run build` (vite v6.4.2)
    OK 3.08s. Local vitest skip — `npx --yes vitest@2.1.8` упёрся в
    `ECONNRESET` к registry.npmjs.org с локальной машины Pavel'я;
    CI Validate job делает тот же `npm test` с прод-сетью и
    отрабатывает чисто (так шли все v1.5.x релизы).

- **v1.3.4** — **premium SaaS pivot** per Pavel verdict (24.05.2026):
  «v1.3 ушло слишком abstract / archival / minimal. DO NOT make it
  archival/black-box only. Need cinematic premium SaaS: large eclipse
  halo in hero, strong product UI mockup on right, big headline left,
  feature cards, AI memory visual diagram, security visual anchor,
  final CTA. Like Behance/Linear/Vercel top-tier product landing.»
  - **Hero** (full reference HTML brief): grid 0.95fr/1.15fr min-height
    860px. Left = eyebrow «Операционная платформа для команд» + H1
    monumental «Коммуникация / которая работает.» (clamp 58-112px,
    accent cyan inline) + lead 460px max + 2 CTA (primary gradient
    pill + ghost) + chips row (Self-hosted / Encrypted / AI Memory /
    Real-time, mono dots). Right = product UI console mockup 520px
    height, 3-col 180/1fr/190: rail (Контур label + 4 nav items active),
    main (topline + 3 cards — Система операционная сводка с progress 76%,
    Мария + file attachment, Иван + voice waveform), side (Панель
    оператора + dial 88px + status list). **Eclipse halo** behind:
    740×740 circle, right 48 top 48, border 1px cyan + border-top 10px
    white, drop-shadow двойной cyan glow. **Wow effect.**
  - **Trust band**: flat 6-col row с monoline SVG glyphs (Docker /
    Nginx / Postgres / Minio / Redis / Grafana), mono labels uppercase,
    opacity 0.55.
  - **Features section**: section-grid 0.55fr/1fr. Left copy + ghost
    CTA. Right 4-card grid (290px min-height): «Чаты и каналы / Задачи
    и проекты / Голос и видео / Клиентские порталы», каждая с icon
    54px + h3 + body.
  - **AI Memory**: split 1fr/0.78fr. Left = visual diagram 380px
    height (2 elliptical orbits 270×160 + 470×240 + central core 108px
    с «AI Memory» mono + 6 floating .node labels: Решения / Документы
    / Задачи / Обсуждения / Файлы / Участники). Right = copy «Система
    помнит важное.»
  - **Security**: split 0.9fr/1.1fr. Left = copy «Ваши данные — ваш
    контроль.» + 4 ✓ bullets + ghost CTA. Right = 3D rotated cube
    (rotateX 55deg / rotateZ 45deg, layered shadows + nested rings) +
    3 sec-cards (Данные защищены AES-256 / Доступ контролируется RBAC
    / Инфраструктура принадлежит вам).
  - **Final CTA**: split block 1fr/0.8fr с border + gradient bg, padding
    60×74. Left h2 «Готовы запустить рабочий контур?» + body. Right
    vertical actions stack (primary + «ИЛИ» mono separator + ghost).
  - **Buttons**: primary `linear-gradient(180deg, #6cc3e5, #2d86b1)`,
    color #021018, radius 3px, box-shadow `0 0 40px rgba(93,181,217,.18)`.
    Mono font 12px weight 800 letter-spacing 0.14em. **Gradient pill,
    not flat.** Ghost: bg rgba(5,10,16,0.44), border cyan-hair.
  - **Atmosphere**: 3 layered radial gradients (top-right cyan rim 18%
    opacity + center faint 4.5% + linear depth top→bottom). Edge framing
    rules `body::before/::after` fixed left/right 4.8vw vertical lines
    с linear-gradient mask fade (kept from v1.3.3).
  - **Что удалено из v1.3.x**: operational fragments hero stage,
    archeological memory log (8 numbered entries), deployment authority
    block (mono spec/value pairs), full-bleed memory band breakout,
    edge vignette atmosphere, `▸` mono prefix CTA + sharp 2px corners,
    vertical signal line под H1, asymmetric H1 grid 4fr/5fr, eyebrow
    `[NN]` prefix, density variation execution rows, process meta in
    hero stage.
  - **Что сохранено**: dark/cyan palette (base-0 углублён до #03070b),
    edge body::before/::after framing rules, cinematic motion primitives
    (Reveal / SignalDot), footer base structure.

- **v1.3.3** — **environmental pressure pass**. Pavel verdict про v1.3.2:
  «first version that feels like a real operational environment. DO NOT
  add more visual complexity. Next pass should focus on pressure, scale,
  continuity, mystery, environmental persistence. Not more design.»
  - **Atmosphere**: добавлен edge vignette (radial inset darkness
    55%→100%) — corners глубже, центр читается. Pure darkness, NO
    chroma, NO particles, NO decoration. Pavel: «deeper edge darkness».
  - **Edge framing**: `.ec-landing::before/::after` — fixed left/right
    viewport rules (1px, opacity 0.12, mask fade 22%/78%). Это «рамка
    системы которая идёт за viewport». Pavel: «stronger framing /
    implied continuation outside viewport / larger invisible system
    around the hero».
  - **Hero stage compression**: убраны explanatory parts — `trace.detail`
    («Канал договорился сам — без оператора»), `fragment.actor`
    («— Мария»), memory traces сокращены («Клиентский контекст удержан»
    → «контекст удержан»). Pavel: «less explanation, more implication.
    Already active, already alive».
  - **Memory band → operational archaeology**: основная переработка.
    Pavel: «can become the iconic section. Operational archaeology /
    decision traces / persistent context / history embedded into the
    system». Реализация:
    - 8 numbered entries вместо 4 (`#0142` → `#0001`) — implies
      массивный непрерывный лог.
    - Descending timestamps от сегодня (+ 14:02) через вчера и
      19.05/12.05 до глубокой даты deploy (12.04). Это history
      embedded, не «recent activity».
    - `depth` variant per entry (now/today/recent/deep) — opacity
      fade (1.0 / 0.92 / 0.7 / 0.5) для archaeological visual depth.
    - Title: «Среда помнит каждое решение.» (было «Состояние не
      исчезает.») — more confident, archaeological.
    - Footer signature: «42 дня записи · 1 847 событий · contour
      active since 12.04.2026» — implies долгую operational record.
    - Grid: добавлена id колонка (`#NNNN` mono) перед when/entity/body.
  - **Primary CTA как deployment command**: Pavel: «Reduce web-button
    feeling. Deployment action / system initiation / contour
    activation». `.ec-landing-btn--primary`:
    - mono font (JetBrains Mono / Geist Mono).
    - sharp corners (radius 2px вместо 8px).
    - `▸` prefix через `::before` — terminal/command vibe.
    - letter-spacing 0.14em — wider tracking.
  - **Mobile**: clarity сохранён, complexity не возвращена. Memory
    grid на mobile flow'ится в 2 colums (id+when сверху, entity и
    body под ними).
  - **Атмосферный бриф соблюдён**: NO particles, NO noise overlays,
    NO decorative motion, NO fake sci-fi. Только silence, discipline,
    negative space, slow persistence. Pavel: «do not over-design».

- **v1.3.2** — **v1.3 visual authority slice C: hero перестаёт
  быть UI mockup'ом, Memory становится full-bleed continuity layer,
  Security становится deployment authority block**. Pavel brief
  (24.05.2026): «Stop treating it like a UI mockup. operational
  traces / execution continuity / active system surface / living
  infrastructure. Less perfect boxes / dashboard symmetry / clean
  UI showcase. Must stop feeling like AI feature section. Need
  full-width continuity layer feeling. System remembers everything.
  Must feel deployment authority. Not SaaS security marketing.
  Infrastructure ownership, self-hosted sovereignty, operational
  control. Already running.»
  - **HeroOperationalStage** (`LandingVisuals.tsx`): полная
    переделка. Из stage убраны:
    - chrome bar (mac-ish окно) — был «UI window» trope;
    - rail с 3-layer nav (sidebar of our product);
    - 2-panel grid (execution feed + memory list) — был mini
      dashboard;
    - field overlay из grid lines (code-editor mockup pattern);
    - 3-row execution stream (feed/dashboard эстетика);
    - access-prompt CTA card (дублировал hero CTA).
    Stage теперь = column из 4 разреженных fragment'ов в asymmetric
    space, без external border box:
    1. `__trace` (align-self: flex-end) — operational pulse
       `EXEC / +0034ms · ROUTE STABLE · детали`, mono тонкая.
    2. `__fragment` (align-self: flex-start) — один primary
       execution event, plain text без bubble/card, только thin
       top border-rule; meta line (origin + time) + body
       monumental statement + actor signature.
    3. `__memory` (align-self: flex-end, signal-left rule) —
       3 memory continuum traces «Контур помнит».
    4. `__process` (align-self: flex-start) — mono signature
       `Memory live · Route stable · Ingress 142KB/s`.
    Auth-mode: stage заменяется auth-dock'ом (заголовок + close
    button + auth panel) без stage decorations — auth это отдельный
    слой доступа, не «внутри окна продукта».
  - **MemoryContinuumLayer** (`LandingSections.tsx`, новый):
    замeняет `MemoryStorySection`. Pavel: «full-width continuity
    layer feeling». Реализация:
    - Full-bleed band — выломан из `.ec-landing__shell` через
      `margin-inline: calc(50% - 50vw); width: 100vw`. Visual
      явно «другой слой» через elevated background gradient +
      cyan top border-signal.
    - Inner container max-width 1280px с shell-matching padding,
      column flex с silence gaps.
    - Head: eyebrow `[03] Слой памяти` + monumental statement
      «Контур помнит всё, что произошло внутри.» (`clamp(2.6rem,
      5.2vw, 5rem)`), asymmetric left-padded с signal vertical
      rule.
    - Stream: 4 memory traces в sweeping column, каждый =
      `mono when · mono entity · body text`, разделены
      border-hair rules.
    - Footer: mono signature `memory / persistent · since deploy`
      + link к docs.
    - НЕТ grid visual+copy. НЕТ constellation art.
  - **SecurityAuthorityBlock** (`LandingSections.tsx`, новый):
    замeняет `SecurityStorySection`. Pavel: «deployment authority,
    NOT SaaS security marketing. Infrastructure ownership,
    self-hosted sovereignty, operational control». Реализация:
    - Внутри shell (не full-bleed), stacked vertical layout.
    - Head: eyebrow `[04] Контроль среды` + monumental statement
      «Развёртывание в вашем слое.».
    - **Manifest row** (`__authority-manifest`): 4-col grid из mono
      spec/value pairs (`host: ваш сервер` / `транспорт: TLS · scoped`
      / `ключи: AES-256-GCM` / `роли: RBAC + 2FA`). Plain text без
      card chrome — это deployment statement, не attestation badges.
    - **Numbered ledger** (`__authority-ledger`): 4 нумерованных
      assertion-строки (`01-04`), каждая = mono index + body
      text. Statements типа «Контур разворачивается внутри вашей
      сети без внешнего облака.»
    - Footer: mono `ваш host · ваши ключи · ваша сеть` + link.
    - НЕТ visual art. НЕТ lock-in-rack image (SaaS trope). НЕТ
      3-card attestation grid (badge-style).
  - **Execution rows density variation** (`__execution-row--*`):
    rows получили variant per data:
    - `primary` (rows 0 + 2): full 38px padding, all parts (index +
      state + tail).
    - `compact` (row 1): тонкий 20px padding, без tail.
    - `offset` (row 3): 12% left padding, text-only, italic title,
      без index / state — «editorial imbalance» per brief.
  - **Copy compression** по всем секциям: меньше explanation, больше
    implication. Hero subhead «Сигнал, задача, голос и доступ
    держатся в одном состоянии.», hero title «Контур уже идёт.»,
    trust title «Контур остаётся внутри.», system title «Работа не
    распадается.», memory title «Контур помнит всё, что произошло
    внутри.», authority title «Развёртывание в вашем слое.».
  - **CSS**: переписан scoped под slice C. Удалены dead `.ec-hero-console`
    (старый stage), `.ec-landing__split / story / security-frame /
    memory-layer / deployment-layer` (Codex'овы intermediate iterations).
    Добавлены `.ec-hero-stage__*`, `.ec-landing__memory-band-*`,
    `.ec-landing__authority-*`, `.ec-landing__execution-row--*`
    variants. Legacy `MemoryConstellation` / `SecurityStackArt`
    стили оставлены для override через `renderHeroStage` slot
    (preview / dev mode).
  - **Брифовые констрейнты соблюдены:**
    - NO field grid overlay (UI mockup trope) ✓
    - NO chrome bar (mac-окно reference) ✓
    - NO multi-row execution feed (dashboard) ✓
    - NO access-prompt CTA card (дублировал hero CTAs) ✓
    - NO visual art в Security (SaaS marketing) ✓
    - NO grid visual+copy в Memory (feature section) ✓
    - NO new motion gimmicks (existing Reveal + SignalDot only) ✓
    - asymmetric pacing через silence tokens + offset alignment ✓
    - dense numerical mono attestations в Security ✓
    - full-bleed continuity layer Memory ✓
    - density variation в Execution rows ✓

- **v1.3.1** — **v1.3 visual authority slice B: monumental hero +
  asymmetric pacing + density contrast**. Strict constraints от
  Pavel'я: «already running, не trying to impress». NO sticky
  markers / NO animated status pills / NO conic-gradient noise /
  NO decorative gimmicks. Continuity достигается через rhythm и
  discipline, не индикаторы.
  - **Type scale bumped** (monumental hierarchy):
    - `--L-type-display`: `clamp(3.5rem, 9vw, 7.5rem)` →
      `clamp(4rem, 11vw, 9rem)` — hero H1 monumental.
    - `--L-type-h1`: `clamp(2.5rem, 5vw, 4rem)` →
      `clamp(3rem, 6vw, 5.5rem)` — section headers больше для
      contrast к body.
    - `--L-type-body`: `1.02rem` → `1.15rem` — calm reading.
    - `--L-track-display`: `-0.025em` → `-0.035em` —
      monumental letters прижаты tighter.
  - **Silence tokens** (asymmetric vertical pacing):
    - `--L-silence-thin: 96px`
    - `--L-silence-base: 200px`
    - `--L-silence-monumental: 320px`
    Применены: trust band `margin-top: var(--L-silence-thin)`,
    sections `padding-top: var(--L-silence-base)`, CTA
    `margin-top: var(--L-silence-monumental)` — drama-pause перед
    финальным statement.
  - **Hero composition** (asymmetric + monumental):
    - Grid `1fr 1.05fr` (almost 50/50) → `4fr 5fr` — stage
      доминирует.
    - `align-items: center` → `end` — copy «оседает» к baseline.
    - `min-height: 540px` → `min(720px, 88vh)` — почти fullscreen.
    - Hero copy: `padding-left: var(--L-gap-4)` + `::before`
      vertical 1px signal line (cyan, opacity 0.35,
      mask-image fade на концах) — **infrastructural marker**,
      не animation. Hero subhead: `max-width 38ch` → `50ch`,
      `line-height 1.55` → `1.6`.
    - Hero title: `line-height 0.95` → `0.92` — tighter
      monumental stack.
  - **Section heads asymmetric**:
    - Grid `1.2fr 1fr` → `1.4fr 0.8fr` — title dominant.
    - Section title `line-height 1.0` → `0.96` — tighter.
    - Section copy `line-height 1.6` → `1.65` — calmer.
  - **Split sections asymmetric**:
    - `1fr 1fr` → `5fr 4fr` — visual либо copy доминирует, не 50/50.
  - **Mobile ≤700px**:
    - Silence tokens ужимаются (`thin 56`, `base 120`,
      `monumental 160`) — иначе занимали бы экран целиком.
    - Hero copy `padding-left: 0` + signal line `display: none`
      (column-stack mode на mobile, нет места для vertical motif).
    - Asymmetric grids collapse to 1fr.
  - **НЕ сделано** (NEXT в slice C-E):
    - Features cards → editorial numbered narrative
    - AI Memory full-width takeover
    - Security dense numerical
    - Atmosphere depth + monoline SVG trust logos
    - Product scene auth-overlay
  - **НЕ сделано** (исключено per Pavel'я brief):
    - sticky `[01-06]` markers
    - animated status pill `[●] КОНТУР АКТИВЕН`
    - conic-gradient noise
    - decorative atmospheric particles
  Сборка зелёная (tsc + vite). Без миграций.

- **v1.3.0** — **v1.3 visual authority pass slice A: copy rewrite +
  nav cleanup**. Реакция на Pavel'я brief «Принципиальный Product
  Designer + Cinematic Systems Art Director» (24.05.2026): «landing
  feels clean dark SaaS вместо mission-critical execution
  infrastructure; нужна visual authority + operational gravity без
  glow / glass / gradients».
  - Решение: phased v1.3 в 5 слайсов (a/b/c/d/e). Slice A — zero
    visual atom, только copy + cleanup. Минимальный risk, fast
    iteration.
  - **HERO copy**:
    - Eyebrow `ОПЕРАЦИОННАЯ ПЛАТФОРМА ДЛЯ КОМАНД` →
      `[01] КОНТУР ИСПОЛНЕНИЯ` (engineering pagination + specific).
    - H1 `Коммуникация которая работает.` →
      `Исполнение / без хаоса.` (operational verb, sharp,
      eliminates-chaos promise).
    - Subhead `Чат, задачи, голос и клиентские порталы…` (feature
      dump) → `Один контур для команд, которые работают,
      а не обсуждают работу.`
    - CTAs `Запустить рабочий контур` / `Посмотреть демо` →
      `Запустить контур` / `Открыть демо`.
  - **REMOVED** в hero:
    - 4 chip-tags `SELF-HOSTED · ENCRYPTED · AI MEMORY · REAL-TIME`
      (повторяли features секцию + заглушали brutal type).
  - **NAV cleanup**:
    - 5 menu links (`Продукт / Возможности / Безопасность / Тарифы
      / Документация`) удалены. Они scrollIntoView в overlapping
      секции — semantic noise. Brand + Вход + «Запустить контур» —
      достаточно.
  - **SECTION HEADLINES**:
    - Features: `Одна система. Полный контроль.` →
      `Одна система. Без пропусков.` + eyebrow `[02] Поверхности`.
    - AI Memory: `Система помнит важное.` → `Контекст остаётся.` +
      eyebrow `[03] AI Memory`.
    - Security: `Ваши данные — ваш контроль.` →
      `Инфраструктура в ваших руках.` + eyebrow
      `[04] Архитектурное обещание`.
    - Bottom CTA: `Готовы запустить рабочий контур?` →
      `Запустите контур.` (statement, не вопрос).
  - **FEATURES copy** (4 items):
    - `Чаты и каналы → Каналы`: «Обсуждения, разделённые по
      проектам. Без шума, без потерь.»
    - `Задачи и проекты → Исполнение`: «Из сигнала — задача.
      Ответственный виден сразу.»
    - `Голос и видео → Голос`: «Созвон без внешних сервисов.
      Запись остаётся в контексте.»
    - `Клиентские порталы → Клиенты`: «Внешний доступ к проекту —
      без хаоса в переписке.»
  - **SECURITY bullets**: 4 → 3. Убран «Резервное копирование»
    (hygiene, не differentiator). Оставлены три сильных утверждения
    про TLS / RBAC / self-hosted.
  - **AI MEMORY copy**: feature-dump («сохраняет контекст команды:
    решения, документы, договорённости…») → outcome statement
    («Решения, файлы, обсуждения — связаны контекстом. Новый
    человек в команде включается через минуты, не дни.»). CTA
    `Узнать больше` → `Открыть AI Memory`.
  - **SECURITY copy**: «Self-hosted архитектура. Шифрование на всех
    уровнях. Никаких облаков из вашего разрешения.» →
    «Self-hosted. On-premise. Шифрование на всех уровнях.
    Архитектура не требует доверия третьей стороне.» CTA
    `Подробнее о безопасности` → `Архитектура безопасности`.
  - **BOTTOM CTA**: ghost backup `Посмотреть демо` + `или` divider
    удалены. Single CTA = single command.
    Sub: `Разверните Eclipse Chat…` → `Один сервер. Один контур.
    Полный контроль.`

  **NOT YET в slice A** (запланировано в slice B-E):
  - Hero composition: monumental type bump + vertical signal line +
    60/40 grid (slice B).
  - Features cards → editorial numbered typography без borders
    (slice C).
  - AI Memory constellation + slow signal arc + wireframe sphere
    (slice C).
  - Security amber hint на core lock (slice C).
  - Atmosphere depth: scanline overlay + multi-layer radial +
    section dividers `[ N / 6 ]` (slice D).
  - Trust band: text → monoline SVG logos (slice D).
  - Product scene auth as overlay over live console (slice E).

  Сборка зелёная (tsc + vite). Без миграций.

- **v1.2.32** — **clean commit: hash-route `#auth-panel` для cold-open
  embedded auth**. Follow-up к Codex'овым uncommitted правкам после
  v1.2.31 polish-pass. Pavel verdict: «оставить только hash-route идею,
  visual glow-часть выкинуть».
  - **App.tsx**: новый `AUTH_PANEL_HASH = "#auth-panel"` + regex.
    `parseLandingHash()` теперь возвращает `{ portalServerId,
    wantsAuthPanel }` — supports parallel hash routes (existing
    `#/portal/<serverId>` сохранён). На init — если URL содержит
    `#auth-panel`, `authSurface` стартует с "login". `hashchange`
    listener реагирует на runtime смену. `openAuthSurface` пишет
    hash через `replaceLandingHash(AUTH_PANEL_HASH)`,
    `closeAuthSurface` — `replaceLandingHash(null)`. Без reload, без
    отдельной page route.
  - **NOT включено** (выкинуто из Codex'овой uncommitted работы):
    - `repeating-conic-gradient` rotating cyan rays на
      `.ec-auth-terminal-frame`
    - `radial-gradient` cyan glow по pointer position
    - `drop-shadow 0 0 24px hsl(199 58% 60% / 0.08)`
    - `box-shadow inset -40px 80px` на `.ec-auth-terminal`
    Pavel в polish-pass'е v1.2.31 явно сказал «не добавлять новые
    эффекты» — revert до clean v1.2.31 landing.css.
  - **Deploy gate**: v1.2.31 уже LIVE на проде (deployed 24.05 ~07:23
    UTC, smoke `/api/version=1.2.31` + `/api/health ok:true`
    зелёные). v1.2.32 — точечный hash-route addition, без миграций.
  Сборка зелёная (tsc + vite).

- **v1.2.31** — **landing polish-pass: убираем dribbble/SaaS/crypto-вайб,
  приводим к calm operational infrastructure**. Реакция на brutal QA
  v1.2.30 (Claude). Pavel: «меньше, строже, дороже. Не добавлять новых
  эффектов».
  - **Удалено** (по списку #1-7 Pavel'я):
    - 3D tilt в `OrbitalSurface` (`intensity={3.6}`) → flat surface.
      OrbitalSurface перестал использоваться в visuals.
    - Fake Mac-controls chrome (`.ec-hero-console__chrome-actions` × 3
      серых кружка) — brief: «no fake futuristic UI».
    - Декоративный dial с двумя ring'ами + radial gradient core.
    - Metrics column (3 cards: dial + meter + status list).
    - Composer strip (`.ec-hero-console__composer` с fake
      input-actions).
    - Voice waveform panel (24 анимированных бара с 3.36s каскадом
      delay — выглядело как лагающая анимация).
    - Signal-dot pulse animation 4s (на всех dots глобально —
      нарушение «calm»).
    - Glow на progress bar (`box-shadow: 0 0 18px`).
    - Text-shadow на hero-title-accent (был 0 0 30px glow).
    - Eclipse-rim glowing border (`0 0 42px + 120px` shadow).
    - Hero-console backlight (decorative cyan + amber radial).
    - Grid-pattern overlay на surface (code-editor mockup trope).
    - Gradient на primary CTA (`linear-gradient` → flat
      `var(--L-signal)`).
    - hover-bounce `transform: translateY(-1px)` на primary CTA.
    - `margin-top: 220px` magic-number на security mobile labels.
  - **Упрощено**:
    - HeroOperationalStage: 3-col grid (rail/workspace/metrics) →
      **2-col** (rail/workspace). Workspace: 3 panels (primary/voice/
      memory) → **2** (primary execution + memory). Rail: 5 menu
      items → **3** operational (Общий контур / Исполнение / AI
      Memory). Минус ~60% data points в hero zone.
    - LIVE_EVENTS: 3 → 2 (Иван voice-event удалён вместе с voice
      panel).
    - `.ec-hero-console__surface` background: 2-layer gradient mix →
      простой `linear-gradient(var(--L-base-2), var(--L-base-1))`.
    - Progress bar: 10px height с glow → 6px flat fill.
    - Signal dots: 7px с глобальным glow + pulse → 6px flat (active
      сохраняет точечный glow — единственный «сигналит»).
  - **Embedded auth — cyan/void**:
    - `--ec-accent-gold` тоже зацианлен (Pavel: «без gold» — было
      `var(--L-amber)`).
    - Single-layer focus ring `0 0 0 1px hsl(199 58% 60% / 0.45)`
      вместо 3-stack shadow (был glow overload).
    - Hidden identity elements: `.ec-auth-logo` / `.ec-auth-radar` /
      `.ec-auth-top-hud` / `.ec-auth-orbit` / `.ec-auth-product-strip`
      / `.ec-auth-subtitle` — дублировали landing-context.
    - `.ec-auth-title text-shadow` 0 0 24px убран.
  - **Mobile ≤700px**: hero-console hidden, заменяется на compact
    status block:
    ```
    [●] КОНТУР АКТИВЕН
        3 / 5 СИСТЕМ ОНЛАЙН
    [    Открыть вход    ]
    ```
    Auth-mode (когда юзер кликнул «Открыть вход») возвращает full
    surface. Это убивает 2-screen vertical scroll heavy console на
    mobile.
  - **Trust band copy**: «Доверие инфраструктурам» → **«Работает на»**.
  Сборка зелёная (tsc + vite). Без миграций.
- **v1.2.30** — **landing + встроенная auth-сцена вместо отдельной страницы**.
  Не косметический фикс, а передел входной поверхности Eclipse Chat:
  авторизация теперь живёт прямо внутри hero-сцены лендинга и
  раскрывается как экран доступа к продукту, а не как отдельный view.
  - **App orchestration**:
    - `apps/web/src/App.tsx` больше не монтирует отдельный fullscreen auth
      как корневую неавторизованную страницу.
    - `LandingPage` получает `authMode`, `authPanel`, `onCloseAuth` и
      управляет встроенным состоянием входа/регистрации прямо внутри
      лендинга.
  - **Landing redesign** (`apps/web/src/pages/LandingPage.tsx` +
    `components.css`):
    - hero-stage умеет переключаться между обзорной сценой и встроенным
      экраном доступа;
    - добавлен возврат `Обзор платформы` без ухода на отдельную страницу;
    - на mobile есть автоскролл к auth-stage, чтобы форма не жила в
      сломанной узкой колонке.
  - **Auth embedded mode** (`apps/web/src/pages/AuthPage.tsx` +
    `tokens.css`):
    - введён presentation-mode `embedded`, где auth не лочит `body`,
      не рендерит отдельный overlay-shell и остаётся частью landing
      composition;
    - сохранены режимы `Вход / Регистрация`, но теперь они ощущаются как
      нативный экран в продуктовой сцене.
  - **Premium effects из `docs/Эффекты крутые`**:
    - animated dual-border для auth-контейнера;
    - beam-индикатор активной вкладки `Вход / Регистрация`;
    - более выразительное password-field/reveal поведение.
  - **Usability / touch**:
    - увеличены hit-area у CTA, mode-toggle, submit и reveal-кнопки;
    - переключение `Вход / Регистрация` локально проверено кликом с
      реальной сменой `aria-selected` и индикатора.
  - **Проверка**:
    - `npm run build -w @eclipse-chat/web` — зелёный;
    - локальный browser smoke: landing -> `Открыть вход` -> embedded auth
      -> `Регистрация` -> `Вход` — проходит;
    - ошибок `error/warn` в браузерной консоли не было.

- **v1.2.29** — **AI agents Партия 2 slice 2: Agent loop runtime +
  @mention integration**. Closes основной loop AI-agents trek'а.
  Бот теперь реально **действует** — пишет в каналы, создаёт
  задачи, правит таблицы. Не только отвечает.
  - **Provider extension** (`ai/provider.ts`):
    - `ChatMessage` теперь discriminated union с `tool_calls`
      (assistant) и `role: "tool"` (function-result).
    - `ChatToolCall` / `ChatToolSpec` (OpenAI-compatible).
    - `chat(messages, { tools?, toolChoice? })` — пробрасывает
      tools в body, парсит `choices[0].message.tool_calls`.
    - `ChatResult.toolCalls: ChatToolCall[]` — empty если LLM
      ответил текстом, иначе содержит function-вызовы.
    - Empty-completion check учитывает tool_calls (не fail если
      content='' но tool_calls есть).
  - **`ai/agentLoop.ts`** — `runAgentLoop({ systemPrompt,
    initialMessages, toolContext, log, ... })`:
    - Limits: `MAX_TURNS=5`, `MAX_TOTAL_MS=45_000`,
      `MAX_TOOL_CALLS_PER_TURN=5`.
    - Loop: chat → parse tool_calls → execute via
      `executeToolCall` → append `role: "tool"` messages → loop.
    - На no tool_calls — финальный text return.
    - На timeout / max-turns — возвращает partial text + flag
      `truncated`.
    - На JSON-parse fail args — append error к LLM, продолжаем
      (self-heal'инг).
  - **Integration** (`ai/assistant.ts`):
    - `BotResponder.capabilities: string[]` + загрузка через
      `bot.capabilities` JSON в getResponderForRole.
    - `executeChannelBotReply` ветка `agentMode =
      responder.capabilities.includes("agent")`. Если true →
      `runAgentLoop` с augmented system prompt'ом (включает
      описание tools + channel/server context); иначе старый
      `chat()` flow.
    - Augmented prompt просит **не вызывать `post_message` для
      текущего канала** — финальный text сам уходит в trigger-
      channel. `post_message` — для **других** каналов.
    - Финальный bot message пропускается если `replyText.trim()
      === ""` (только tools, без summary).
    - Log включает `agentMode`, `toolCallCount` для
      observability.
  - **UI toggle** (`BotsTab.tsx`):
    - Новая кнопка «Agent» (рядом с «Авто»). Active = agent mode
      ON.
    - PATCH `agentMode: boolean` — backend меняет capabilities
      list: добавляет/убирает «agent» entry.
  - **Backend** (`routes/bots.ts`):
    - `updateBotBody.agentMode?: boolean`.
    - PATCH handler: parse capabilities JSON → filter «agent» →
      conditionally add → stringify back.
    - GET response — computed `agentMode: boolean` (capabilities
      includes "agent").
  - **Что НЕ сделано** (для будущего):
    - Bot Builder visual flow editor (Партия 1 финиш).
    - Voice agents (Партия 4).
    - Free model fallback chain detailed (Партия 3) —
      OpenRouter уже работает, но без robust retry.
    - Per-tool capability gating (сейчас all-or-nothing agent
      mode).
  Сборка зелёная (tsc + vite + tsc server). Без миграций.
- **v1.2.28** — **AI agents Партия 2 slice 1: Tool foundation**.
  Backend infrastructure для tool-use loop'а. Сами tools созданы и
  готовы к вызову; **integration в @mention agent loop — следующий
  slice** (v1.2.29).
  - **`apps/server/src/ai/tools/`** — новая папка:
    - `types.ts` — `Tool<Args, Result>`, `ToolCallContext`,
      `ToolResult` discriminated union.
    - `registry.ts` — `ALL_TOOLS`, `getToolByName`,
      `getOpenAiToolSpecs()` (для передачи в chat() с function
      calling), `executeToolCall(name, args, ctx)` safe wrapper.
    - `postMessage.ts` — `post_message(channel_id, content)`.
      Bot пишет в TEXT-канал текущего сервера. Проверки:
      channel.serverId === ctx.serverId, channel.type === TEXT,
      server.suspendedAt == null, content ≤ 4000 chars.
    - `createTask.ts` — `create_task(channel_id, title, type?,
      assignee_email?, due_at?)`. Bot создаёт ActionItem с типом
      TASK/DECISION/FOLLOW_UP. Schema требует `sourceMessageId`,
      поэтому tool сам создаёт source-message «📋 Задача: <title>»
      от имени бота — даёт visible trace + удовлетворяет FK.
      Assignee по email (LLM легче генерирует чем cuid), validates
      что user — member текущего сервера. Realtime emit'ы для
      message + action.
    - `updateTableRow.ts` — `update_table_row(table_id, row_id,
      cell_updates[])`. Bot правит ячейки operational table.
      Validates: table.serverId, row.tableId, field.tableId для
      каждого update. Transaction upsert по `(rowId, fieldId)`
      composite PK. Bump row.updatedAt + emit
      `table:row:updated`.
  - **Каждый tool:**
    - Zod schema на args (type-safe + runtime validation).
    - JSON Schema (`parameters`) — для OpenAI-compatible function
      calling спецификации.
    - structured log на successful execution (audit trail).
    - Возвращает `ToolResult<T>` — никогда не throw'ит наружу,
      `executeToolCall` ловит.
  - **Что НЕ сделано в этом slice** (для v1.2.29):
    - Agent loop runtime (`runAgentLoop`).
    - Integration tools в @mention path (assistant.ts должен
      использовать function-calling вместо обычного chat).
    - Provider extension: chat() должен принимать `tools[]`.
    - Safety boundaries: max turns / timeout / cost limits.
  - **Free model gate** — DeepSeek-chat-v3 (free OpenRouter)
    поддерживает function calling. Если качество слабое — Партия 3
    добавит fallback chain.
  Сборка зелёная (tsc server). Без миграций.
- **v1.2.27** — **AI agents Партия 1 slice 1: Bot.personality
  overlay**. Начало большого AI-agents trek'а (по запросу Pavel'я
  24.05.2026). Цель: боты как **личности** с именами, характерами,
  чувством юмора — не безличные ассистенты. Этот слайс — foundation
  (личность как короткий overlay поверх role-prompt'а), без tool-use
  и full-agentic loop'а ещё.

  Trek plan:
  - **Партия 1: Personalities** ← здесь
  - **Партия 2: Tool foundation** (post_message / create_task /
    update_table_row) — bot реально действует в server'е
  - **Партия 3: Free model fallback** (OpenRouter chain DeepSeek →
    Llama → Qwen)
  - **Партия 4: Voice agents** (LiveKit join + Whisper STT +
    Cloudflare TTS) — большой track, после tools

  v1.2.27 changes:
  - **Schema**: `Bot.personality String?` (nullable, до 1000
    символов). Migration `20260523210000_add_bot_personality`:
    `ALTER TABLE "Bot" ADD COLUMN "personality" TEXT;` Additive.
  - **`resolveBotSystemPrompt`** в `ai/botRoles.ts` принимает
    четвёртый optional аргумент `personality`. Если задан и нет
    full `systemPromptOverride` — append «## Твоя личность»
    overlay'ом к role base-prompt. Tone — directive («оставайся в
    характере, используй юмор где уместен, реагируй как живой
    человек»), без RP-кавычек (бесплатные модели лучше следуют
    прямым инструкциям).
  - **`BotResponder`** type расширен `personality: string | null`.
    Все 2 caller'а (@mention + autoRespond paths) загружают
    `personality` и пробрасывают в resolve.
  - **`bots.ts` routes**:
    - `GET /api/servers/:id/bots` — `personality` в response.
    - `PATCH /api/servers/:id/bots/:botId` — принимает
      `personality?: string | null`, max 1000 chars, trim, пустая
      строка → null.
    - `GET /api/bot/me` — `systemPrompt` теперь рассчитывается с
      `personality` для self-aware debug'а.
    - Test-invoke endpoint тоже использует personality.
  - **Frontend**:
    - `useBots.ts` — `BotRow.personality` + `updateBot({ personality
      })`.
    - `BotsTab.tsx` — новая кнопка «Личность» рядом с «Промпт». При
      открытии — textarea с placeholder-примером для UX
      («Тебя зовут Алёша. Ты дружелюбный senior dev…»). Counter
      «{N} / 1000». «Очистить» (если personality задан) +
      «Сохранить».
  - **Не делано** (следующие slice'ы Партии 1):
    - Edit bot avatar (пока берётся auto). Pavel хотел чтобы можно
      было «называть» бота — `bot.name` редактируется через
      существующее поле «Название», `user.displayName` syncs auto.
      Slice 2 при необходимости — отдельный аватар-uploader.
  Сборка зелёная (tsc + vite + tsc server). ⚠️ Migration deploy
  на проде: `cd apps/server && npx prisma migrate deploy`.
- **v1.2.26** — **sci-fi sweep slice 1: композер UX-copy**.
  Начало sci-fi-копирайт sweep'а (brief §3.6 — «привести ALL-CAPS
  телеметрию к спокойному русскому»). Conservative подход: только
  места, которые я сам трогал в этой sessии. Identity-сильные строки
  (AuthPage / branding) — не трогаю, Pavel/Codex их редизайнили
  в `0e999ef`.
  - **Композер `MessageInput.tsx`:**
    - `ЗАЩИЩЁННЫЙ_КАНАЛ` → `Защищённый канал` (snake-case CAPS →
      обычный).
    - `ВВОД ПОТОКА` / `ОЖИДАНИЕ СИГНАЛА` → `печатает…` / `в эфире`
      (лаконично, не military-ops тон).
    - `Передача сигнала в #...` → `Сообщение в #...` (placeholder).
    - `Открыт защищённый канал…` → `Канал открыт…` (DM placeholder).
    - `ПЕРЕДАТЬ` (button) → `Отправить`. Letter-spacing 0.08em →
      0.06em (CAPS-tracking ослаблен).
    - Title `ПЕРЕДАТЬ (Enter)` → `Отправить (Enter)`.
  - **Не трогал** `tokens.css` (Codex активная зона) — комментарий
    `«ОЖИДАНИЕ СИГНАЛА…» / «ВВОД ПОТОКА…»` на line 979 устарел, но
    safe leave (косметика, не функционал).
  - Slice 2+ sweep'а: ChannelList / IncidentPanel / VoiceRoom /
    Composer-strip CSS-tracking — отдельными слайсами с Pavel'я
    подтверждением тона.
  Сборка зелёная (tsc + vite). Без миграций.
- **v1.2.25** — **custom emoji slice 5: real-time invalidation
  через socket**. Завершает custom-emoji track (5 слайсов). После
  upload/delete admin'ом — emoji мгновенно появляется/исчезает у
  всех members сервера без F5.
  - **Backend** `realtime.ts`: `emitEmojiCreated(serverId, payload)`
    + `emitEmojiDeleted(serverId, { id })` — broadcast в
    `server:${serverId}` room. `routes/emojis.ts`: POST вызывает
    `emitEmojiCreated` после `db.emoji.update` (с URL), DELETE —
    `emitEmojiDeleted` сразу после `db.emoji.delete`.
  - **Frontend** `lib/socket.ts`: новые `SocketEvents.EmojiCreated
    = "emoji:created"`, `EmojiDeleted = "emoji:deleted"`.
  - **`useServerEmojis(serverId, socket?)`** расширен — принимает
    optional `Socket`. Если подключён — подписывается на
    `emoji:created`/`emoji:deleted`, фильтрует по `serverId` в
    payload, вызывает `refresh()`. Window event оставлен fallback'ом
    для optimistic AdminEmojisTab-local UX (без socket round-trip).
  - **AppShell** прокидывает `socket` в `useServerEmojis`.
  Сборка зелёная (tsc + vite + tsc server). Без миграций.

  **Custom emoji track полностью закрыт** (5 слайсов):
    v1.2.20 backend MVP / v1.2.21 admin UI / v1.2.22 RichContent
    parser / v1.2.23 `:` autocomplete / v1.2.24 reactions /
    v1.2.25 real-time socket.
- **v1.2.24** — **custom emoji slice 4: reactions с custom emoji**.
  Закрывает «использование в reactions» из handoff'а.
  - **Backend** `apps/server/src/routes/messages.ts`:
    - Helper `parseCustomShortcode(emoji)` — `:shortcode:` parser.
    - Async `validateReactionEmoji(emoji, serverId)` — Unicode из
      whitelist OR `:shortcode:` существует в `Emoji` table для
      `serverId`. DM (serverId=null) — custom запрещены (custom
      emoji per-server).
    - `reactionBody.emoji` ослаблен с zod refine на просто
      `string.min(1).max(64)`; реальная валидация — в route после
      того как knows serverId сообщения.
    - POST `/api/messages/:id/reactions` — после permission check
      вызов `validateReactionEmoji` → 400 если не ok.
    - DELETE `/api/messages/:id/reactions/:emoji` — shape OK
      (Unicode whitelist OR shortcode format). Если row нет —
      idempotent ok.
  - **Frontend** `EmojiPicker.tsx`: новый optional prop
    `customEmojis`. Если есть entries — popover рендерит вторую
    секцию `Сервер` с custom emoji thumbnails (img 20×20). onPick
    отдаёт `:shortcode:` (не URL). Высота popover'а грузится 240px
    вместо 130px чтобы влезли 2 секции. Layout: flex column с
    grid-секциями.
  - **MessageList** — прокидывает `customEmojis` в EmojiPicker.
    Reaction pill: inline IIFE check `:shortcode:` → если найден в
    `customEmojis` → `<img 18×18>`, иначе Unicode-as-text.
  Сборка зелёная (tsc + vite + tsc server). Без миграций.

  Custom emoji track **закрыт** (4 слайса). Осталось — real-time
  через socket (вместо window event); это polish, не feature.
- **v1.2.23** — **custom emoji frontend slice 3: `:` autocomplete +
  picker integration**. После slice 2 (parser) emoji видны в
  сообщениях, но discoverable только если вручную набрать
  `:exact_shortcode:`. Этот слайс даёт popover-autocomplete.
  - **AutocompletePopover** — Props получили optional
    `customEmojis?: Record<string, string>`. `AutocompleteItem`
    получил optional `imageUrl?: string` (для custom emoji
    preview).
  - **`buildItems`** для `:`-trigger: после Unicode shortcodes
    добавляет custom server emoji (priority — выше Unicode,
    ближе к workspace context). Skip коды, которые есть в Unicode
    whitelist (избежать дублей).
  - **Render** — если item имеет `imageUrl`, popover-row показывает
    `<img width=18 height=18>` слева от display. Lazy-loading.
  - **MessageInput** — новый optional prop `customEmojis`,
    прокидывает в AutocompletePopover.
  - **Wiring** в AppShell — channel-mode MessageInput получает
    `customEmojis={customEmojis}` (тот же hook'овый map что
    RichContent). DM остаётся без custom emoji (нет server
    context).
  - **Bonus fix** — channel-mode MessageInput раньше **не получал**
    `mentionNames`, поэтому @-autocomplete не показывал participants
    канала (только AI keywords). Теперь прокидывается из members.
  - **Не реализовано** (следующие слайсы):
    - Picker UI custom-emoji вкладка (для click-based выбор).
    - Использование в reactions (backend `ALLOWED_EMOJI` — нужно
      расширить на `:custom:`).
    - Real-time через socket (вместо window event).
  Сборка зелёная (tsc + vite). Без миграций.
- **v1.2.22** — **custom emoji frontend slice 2: parser
  `:shortcode:` → `<img>` в RichContent**. Закрывает «emoji видны в
  сообщениях» — основное UX-обещание custom-emoji track'а.
  - **`useServerEmojis(serverId)`** hook — fetches `listServerEmojis`,
    кэширует как `Record<shortcode, url>`. Refresh на смену
    `serverId`. Cross-component invalidation через `window` event
    `eclipse:emojis-changed` (custom-event с `{ serverId }` detail).
    Helper `notifyEmojisChanged(serverId)`.
  - **RichContent** — новый optional prop `customEmojis?:
    Record<string, string>`. Tokenizer: после Unicode-whitelist
    проверяет custom map; если match — emit token `customEmoji`
    с URL. Render: `<img src=url style={width:1.4em, height:1.4em,
    object-fit:contain, vertical-align:-0.3em}>` + alt/title
    `:shortcode:`. Lazy-loading.
  - **Priority order** в `tokenize`: Unicode whitelist > custom
    server emoji > raw text. Тоже самое если `:smile:` loaded как
    custom — Unicode выиграет, чтобы избежать брендирования общих
    кодов.
  - **Wiring** — `AppShell` вызывает `useServerEmojis(activeServerId)`,
    прокидывает `customEmojis` в:
    - `<MessageList>` (channel-mode; DM-mode без custom emoji);
    - `<ThreadPanel>` (root + replies — оба RichContent);
    - channel description `<RichContent>`.
  - **AdminEmojisTab** — после upload / delete вызывает
    `notifyEmojisChanged(serverId)` → useServerEmojis в AppShell
    перечитывает → emoji появляется в чате без switch'а сервера.
  - **Не реализовано** (следующие слайсы):
    - Autocomplete `:shortcode:` в композере с custom emoji
      (extend AutocompletePopover).
    - Picker UI custom emoji вкладка.
    - Использование в reactions (backend `ALLOWED_EMOJI` ограничен —
      нужно расширить на `:custom:`).
    - Real-time через socket (вместо window event).
  Сборка зелёная (tsc + vite). Без миграций (schema из v1.2.20).
- **v1.2.21** — **custom emoji frontend slice 1: AdminPanel
  «Эмодзи» tab + upload/delete UI**. Следующий слайс custom-emoji
  track'а после backend MVP v1.2.20.
  - **`lib/emojis.ts`** — API client (`listServerEmojis`,
    `uploadServerEmoji`, `deleteServerEmoji`) + тип `ServerEmoji`.
  - **`AdminEmojisTab.tsx`** — таб «Эмодзи» в AdminPanel.
    Upload-row: `<input type=file>` + shortcode field +
    «Загрузить». Auto-suggest shortcode из filename (lowercase
    `[a-z0-9_-]`). Client-side валидация: mime
    (jpeg/png/webp/gif/avif), size ≤ 5 MB, shortcode regex
    `[a-z0-9_-]{2,30}`. Список — grid auto-fill 180px, thumbnail
    48×48 + shortcode + uploader + «×» удалить (с `confirm()`).
  - **AdminPanel integration** — новая `tab === "emojis"`, кнопка
    «Эмодзи» между «Комнаты» и «Роли». Видна только OWNER+ADMIN
    (как весь AdminPanel — `accessDenied`).
  - **Не реализовано** (следующие слайсы):
    - Парсер `:shortcode:` → `<img>` в RichContent.
    - Autocomplete `:shortcode:` в композере (extend
      AutocompletePopover).
    - Picker UI с custom-emoji вкладкой.
    - Использование в reactions (backend `ALLOWED_EMOJI` → расширить
      на custom).
  Сборка зелёная (tsc + vite). Без миграций (schema уже из v1.2.20).
- **v1.2.20** — **custom emoji backend MVP**. Из handoff'а: «Custom
  emoji — давний open. Per-server эмодзи, upload (image → sharp
  resize), unique `:shortcode:`, autocomplete в композере, в
  reactions». Этот слайс — только **backend foundation** (schema +
  3 endpoints). Frontend (autocomplete, picker, parser, reactions)
  — отдельными слайсами.
  - **Schema** `prisma/schema.prisma`: новый `Emoji` model — id /
    serverId (FK Cascade) / shortcode / url / uploaderId (FK
    SetNull) / createdAt. `@@unique([serverId, shortcode])` +
    `@@index([serverId])`. Relations: `Server.emojis Emoji[]`,
    `User.uploadedEmojis Emoji[]`.
  - **Migration** `20260523200000_add_custom_emojis/migration.sql`:
    CREATE TABLE + FK constraints (Cascade server, SetNull
    uploader) + unique + index.
  - **Routes** `apps/server/src/routes/emojis.ts`:
    - `GET /api/servers/:id/emojis` — list. Member-only. Возвращает
      `{ id, shortcode, url, uploader, createdAt }[]`.
    - `POST /api/servers/:id/emojis` — upload. OWNER + ADMIN.
      JSON+base64 (как server-icon). Shortcode validation
      `[a-z0-9_-]{2,30}` lowercase. Sharp resize 128×128 webp
      quality=85. Лимит `MAX_EMOJIS_PER_SERVER=100`, body 8 MB,
      binary 5 MB, mime: jpeg/png/webp/gif/avif. Conflict 409 на
      дубль shortcode + при достижении лимита.
    - `DELETE /api/emojis/:id` — uploader OR OWNER/ADMIN. Cleanup
      файла best-effort.
  - Все mutation-endpoints через `ensureServerActive` —
    suspend-gating Platform Admin'а распространяется.
  - Файлы: `/uploads/emojis/<serverId>-<emojiId>.webp`.
  - Registration в `apps/server/src/index.ts`.
  Сборка зелёная (tsc server). **⚠️ Migration deploy:** на проде
  `cd apps/server && npx prisma migrate deploy` после `git pull`.
- **v1.2.19** — **Platform Admin pagination jump-to-page**. Из
  handoff'а: «Pagination jump-to-page в Platform Admin — UI
  принимает только offset/limit, без skip-N кнопок».
  - `PaginationFooter` получил optional prop `onJumpToPage(page)`.
    Между «← Назад» и «Вперёд →» появляется compact input «Стр.
    [_] / N». На Enter / blur валидирует число (1..totalPages) и
    вызывает callback. Пустой / NaN / out-of-range / совпадение с
    currentPage — ничего не делает.
  - Видим только если totalPages > 2 (при ≤ 2 страницах prev/next
    достаточно).
  - Прокинут во **все три** табы Platform Admin: Users / Servers /
    Audit. Каждый передаёт `setOffset((page - 1) * PAGE_SIZE)`.
  - CSS в `cockpit.css` (стабилен, Codex не лезет): новые классы
    `.ec-platform-admin__pagination-jump*` — width 52px, tabular
    nums, hidden spinner arrows (компактнее).
  Сборка зелёная (tsc + vite). Без миграций. Frontend-only.
- **v1.2.18** — **slash-команды autocomplete UI: backend-команды
  в slash-hint strip**. Из handoff'а: «Slash-команды расширение
  → autocomplete UI в композере с registry-listing».
  - В `MessageInput.tsx` рядом с `SLASH_COMMANDS` (operator:
    `/task` `/decision` `/followup`) добавлен `BACKEND_COMMANDS`:
    `/me /shrug /tableflip /unflip /help` (из `lib/slashCommands.ts`
    backend'а, v1.2.14). Frontend их **не парсит** — отправляет
    как обычный текст, backend transform'ит (или возвращает
    ephemeral для `/help`).
  - `slashMatches` разделён на `operatorMatches` + `backendMatches`.
    Hint strip рендерит оба flat list'ом, под одним `<div>`.
    operator-matches скрыты в Client Mode (`hideSlashCommands`),
    backend-matches видны везде — `/help` и transform-команды
    работают и для клиента.
  - `noArg=true` для `/shrug /tableflip /unflip /help` — на выбор
    заполняется без trailing space (можно сразу Enter). `/me`
    требует аргумент → space.
  Сборка зелёная (tsc + vite). Без миграций. Frontend-only.
- **v1.2.17** — **Platform Admin details: action-buttons inside
  modal**. Закрытие из handoff'а: «per-user/server actions в
  details-view — сейчас детали read-only; action-buttons (Ban /
  Reset) только из row table».
  - **PlatformUserDetailsModal** — новые optional props `onBan` /
    `onUnban` / `onReset` / `onDelete` принимают `PlatformUser`.
    Action-bar после chip'ов: condintional buttons по состоянию
    юзера (bannedAt / deletedAt). Для `isPlatformOwner` — все
    действия скрыты (как в row).
  - **PlatformServerDetailsModal** — `onSuspend` / `onUnsuspend`,
    Action-bar по `suspendedAt`.
  - **PlatformAdminPanel** — передаёт callbacks: каждый
    `setActionError(null) + setXTarget(s/u) + setDetailsTargetId
    (null)` — закрывает details modal и открывает confirm modal с
    тем же UX, что row table.
  - **CSS — без правок** в components.css (там сейчас активный
    Codex'ёв landing-стилей WIP). Action-bar — `<div style=...>`
    inline (flex/gap/wrap) — это исключение из «inline только для
    динамики» с explicit reason в коде, чтобы не лезть в conflict
    с Codex'овым untracked CSS.
  Сборка зелёная (tsc + vite + tsc server). Без миграций.
- **v1.2.16** — **thread-root edge fix v1.2.9**. Закрытие из
  follow-up списка v1.2.9: удалённый root, открытый по прямой
  ссылке `/thread/:rootId`, всё ещё возвращался backend'ом и
  фронт рисовал tombstone в ThreadPanel.
  - **Backend.** `GET /api/messages/:id/thread` теперь отдаёт
    404 если `root.deletedAt !== null` (раньше — только если root
    physically not found). Frontend `useThread` ловит `ApiError`
    через `.catch` → выставляет `error` state → ThreadPanel
    показывает «Не удалось загрузить thread» вместо tombstone.
  - **POST** уже корректно отвергал deleted root (410 Gone) —
    не тронут.
  - Дополняет v1.2.9 (main feed / thread replies / DM / pinned)
    — закрывает последний known edge.
  Сборка зелёная (tsc server). Без миграций. 3 строки в backend.
- **v1.2.15** — **emoji-кнопка композера + nginx trailing-slash фикс
  + og-image URL коррекция**. Три параллельных фикса в одном bump'е.
  - **Emoji-кнопка композера.** Новый `ComposerEmojiPicker.tsx` —
    popover с tab-bar (8 категорий: Эмоции / Жесты / Сердца /
    Природа / Еда / Спорт / Объекты / Знаки) + grid 8 cols, ≈100
    emoji. Click-outside / Escape — закрывает. Position fixed +
    clamp в viewport. `MessageInput.tsx` — кнопка-смайлик
    (lucide-style smiley SVG) между voice и textarea; `insertEmoji`
    вставляет на caret position (как `applyAutocomplete`-pattern).
    Grid композера: `hideAttachments=true` → 3 cols `auto / 1fr /
    auto`, `false` → 5 cols. Работает и в thread/DM.
    `components.css` дорос `.ec-emoji-picker*` секцией (НЕ
    tokens.css — Pavel'ёв WIP не зацепили).
    NB: существующий `EmojiPicker.tsx` оставлен — он специально для
    reactions с 12-emoji whitelist'ом (`ALLOWED_EMOJI` синхрон с
    server validation).
  - **nginx trailing-slash редирект** — root cause «у некоторых не
    открывается ссылка входа». `deploy/nginx/eclipse-chat.conf` не
    имел редирект `/eclipse-chat → /eclipse-chat/`; запрос без `/`
    не матчил ни один `^~ /eclipse-chat/...` location и падал в
    generic `location /` main-сайта star-crm.ru → SPA-router
    отдавал брендированный 404 main-сайта. Добавлен exact-match
    `location = /eclipse-chat { return 301 $scheme://$host/
    eclipse-chat/; }`. На проде заработает после `sync-nginx.sh` +
    `nginx -s reload`.
  - **og-image displayed URL коррекция.** В `og-image.svg` и
    `og-image-brand.svg` displayed text был `app.star-crm.ru/
    eclipse-chat` без `/`. При unfurl в Telegram/Slack/WhatsApp/VK
    люди видели ссылку без `/` на превью-картинке, копировали
    вручную → попадали на 404 main-сайта. Хотя `og:url` мета был
    правильный со `/`, но пользователи копируют **то, что видят**,
    не href. Текст в обоих SVG получил trailing `/`.
  - **HTTP-Referer для OpenRouter** — `apps/server/src/ai/
    provider.ts` за компанию получил `/eclipse-chat/` (cosmetic).
  Сборка зелёная (tsc + vite + tsc server). Без миграций.
- **v1.2.14** — **slash-команды backend MVP** (/me /shrug /tableflip
  /unflip /help + ephemeral banner).
  - **Backend** `lib/slashCommands.ts` — registry + парсер.
    Regex `^/(\w+)(?:\s+(.+))?$` строгий: `/path/to/file` не матчится
    (после `\w+` ожидается whitespace или EOL), проходит обычным
    сообщением. Два kind: `transform` (модифицирует content, дальше
    штатный flow) / `ephemeral` (возврат JSON caller'у без записи в
    БД и без broadcast). Unknown → ephemeral-ошибка «Команда /xxx не
    найдена. /help для списка.»
  - **Integration** в POST `/api/channels/:id/messages`: вызов после
    permission-checks (member / BROADCAST role / suspend-gate), до
    создания message. Ephemeral пропускает attachments (нелогично
    совмещать /help + image).
  - **Команды:**
    - `/me <действие>` — `_Pavel <действие>_` (IRC-классика).
    - `/shrug` / `/tableflip` / `/unflip` — добавляют ASCII-арт к
      содержимому.
    - `/help` — ephemeral список команд.
  - **Frontend.** `useMessages` ловит ephemeral в response: удаляет
    optimistic-row (никогда не придёт через socket), показывает
    баннер «только вы видите» (auto-clear 15с, dismiss-кнопка).
    `MessageList` рисует баннер после pendingBotTyping, перед
    jump-latest. AppShell прокидывает props через destructure
    useMessages.
  - **CSS** `.ec-ephemeral-banner` в cockpit.css: accent 8% tint +
    inset border, label uppercase accent, content monospace
    pre-wrap, dismiss absolute top-right.
  Сборка зелёная (tsc + vite). Без миграций.
- **v1.2.13** — **audio-реактивный плеер (R-трек продолжение)**.
  Из v1.2.0 (Signal Desk v2) playhead был «живым», но 64 бара
  вейвформы оставались статичными pre-rendered peaks. Теперь —
  реальная audio-reactive визуализация при playing через Web Audio
  API.
  - **Hook `useMusicAnalyser`** — singleton AudioContext +
    AnalyserNode на каждый `<audio>`-элемент (WeakMap по audio).
    `attachAnalyser(audio)` идемпотентен, зовётся из user-gesture
    (play-button onClick) — `context.resume()` снимает suspended-
    состояние браузера. `createMediaElementSource` ловит
    InvalidStateError если уже привязан — fallback на статичные
    peaks. fftSize=128 → 64 frequency-bin'а, ровно столько же что
    и баров.
    Singleton `currentMusicAudio` — MiniPlayer регистрирует свой
    `<audio>` на mount, Expand-modal находит analyser по ссылке.
  - **MusicMiniPlayer** — на play-button onClick зовёт
    `attachAnalyser` (user-gesture требование). На mount/unmount
    регистрирует/убирает audio из singleton.
  - **MusicExpandModal** — RAF-loop читает
    `analyser.getByteFrequencyData()`, нормализует через sqrt-curve
    (компенсирует low-freq dominance, без неё басы доминируют),
    обновляет `livePeaks` state. Бары в SVG используют
    `displayPeaks = livePeaks ?? staticPeaks` — на pause или
    reduced-motion или без AudioContext'а revertится на статичные
    peaks v1.2.0.
  - **Reduced-motion** — RAF не стартует, бары статичны.
  - **Cross-origin** — uploads same-origin, MediaElementSource
    работает без CORS-проблем.
  Сборка зелёная (tsc + vite). Без миграций — чистый клиент.
- **v1.2.12** — **slice 6b: BotsTab inline-долг + JS-hover очищены.
  Brief-slice 6 ЗАКРЫТ полностью** (6a AdminPanel + 6b BotsTab).
  - **Долг убран:** 6 module-level CSSProperties консолей
    (`sectionLabel` / `groupCard` / `fieldHint` / `inputStyle` /
    `botCard` / `monoChip`) — все ссылки → `.ec-bots-*` классы.
    Spread-сайты `{...inputStyle, ...overrides}` → `className=
    "ec-bots-input" style={overrides}`.
  - **JS-hover на bot-card убран.** onMouseEnter/Leave мутировал
    `e.currentTarget.style.borderColor` и `.background` — заменено
    на CSS `:hover` (`.ec-bot-card:hover { background, border-color }`).
    Главный источник drift'а по brief'у §3.3 закрыт.
  - **Parametric helpers** `roleAvatarStyle(role)` и `roleChipStyle(role)`
    оставлены inline — legitimately dynamic (цвета берутся из
    `BOT_ROLE_COLORS[role]` per-role). Бриф §4 явно разрешает inline
    для динамических значений.
  - `cockpit.css` дорос секцией `.ec-bots-*`: section-label /
    group-card / field-hint / input (+ :focus) / mono-chip + новый
    `.ec-bot-card` с правильным :hover-переходом surface+border.
    SOLAR-совместимо через токены.
  Сборка зелёная (tsc + vite). Без миграций.
- **v1.2.11** — **slice 6a: AdminPanel inline-долг очищен**. Закрытие
  первой половины brief-slice 6. Per-server AdminPanel.tsx (~2000 строк)
  переведён на cockpit-grammar.
  - **Долг убран:** 10 module-level CSSProperties консолей (`wrap` /
    `headerRow` / `eyebrow` / `titleStyle` / `tabBar` / `tabBtn(active)` /
    `card` / `cardLabel` / `cardValue` / `row`) + локальный
    `inputStyle` (~50 ссылок суммарно) → `.ec-admin-*` классы.
    `style={NAME}` и spread-сайты `{...card, ...overrides}` →
    `className="..." style={overrides}`. Импорт `CSSProperties` удалён.
  - **Tab-кнопки.** `style={tabBtn(active)}` → `className="ec-admin-tab"`
    + active-state через `aria-selected` (CSS
    `.ec-admin-tab[aria-selected="true"]`).
  - **Clickable cards** (Settings / Client Portal) — modifier
    `.ec-admin-card--clickable` (cursor + hover surface bump).
  - **JS-hover здесь не было** — никаких onMouseEnter/Leave; всё
    интерактивное через CSS :hover / [aria-selected].
  - `cockpit.css` дорос секцией `.ec-admin-*` (wrap / header / eyebrow /
    title / tabs / tab / card / card-label / card-value / row / input +
    clickable modifier). SOLAR-совместимо через токены.
  - **Не делано (slice 6b — следующим):** BotsTab.tsx
    (1388 строк / 91 inline match) — отдельный слайс v1.2.12.
  Сборка зелёная (tsc + vite). Без миграций.


- **v1.2.10** — **кастомные иконки комнат + новый биометрический шлюз на auth-экране**.
  - **Каналы.** Emoji-пикер в настройках комнаты заменён на фирменный набор
    SVG-иконок. Добавлен единый registry/renderer для `ec:*`-иконок с
    обратной совместимостью для старых emoji. Новый glyph-язык подключён
    в sidebar, chat-header и ChannelSettingsModal.
  - **Auth.** Экран входа теперь стартует с отдельного biometric gate:
    idle-вращение линий вокруг сенсора, hover-подсветка панели, click →
    короткое «сканирование» → раскрытие текущей панели входа. Логика
    email/password/2FA не менялась по сути, только entrance UX.
  - **Совместимость.** `useAuth.register()` синхронизирован с текущим
    контрактом `AuthPage` (возврат `{ success, error? }`), чтобы web-сборка
    снова была зелёной.
  - **Проверка.** `npm run build -w @eclipse-chat/web` проходит. Локальный
    browser-smoke в in-app browser не подписан: среда не открыла localhost
    preview (`ERR_CONNECTION_REFUSED`).

- **v1.2.9** — **удалённые сообщения убраны из истории чата**. Запрос
  Pavel'я: «надо чтобы удалённые сообщения не сохранялись в истории
  чата» (на скрине — четыре tombstone'а «сообщение удалено» подряд).
  - **Подход.** Soft-delete в БД остаётся (audit-trail / recovery /
    moderation). Меняется только UI/API-видимость: сообщения с
    `deletedAt !== null` не отдаются клиенту и не остаются в state
    после realtime-события `message:deleted`. Обратимо через SQL:
    `UPDATE "Message" SET "deletedAt"=NULL WHERE id='...';`
  - **Backend.** Добавлен `deletedAt: null` в where:
    + `channels.ts` GET `/api/channels/:id/messages` (main feed)
    + `threads.ts` GET thread replies
    + `dm.ts` GET DM messages + last-message preview (nested
      include `messages.where`)
    + `messages.ts` GET pinned (defensive; pinnedAt уже null'ится при
      delete)
    Search (`servers.ts`) и home-recent (`home.ts`) уже фильтровали
    `deletedAt: null` — не тронуто. Aggregates (analytics/digest/
    incidents/visits) — не main feed, оставлены как есть на потом.
  - **Frontend.** `useMessages` socket-handler `onDeleted` теперь
    **убирает** message из state (через filter), а не оставляет
    tombstone (раньше: `{...m, content: "", deletedAt}`). Defensive
    filter в `MessageList`/`ThreadPanel` render-map: если deletedAt
    != null проскочит — не рисуем.
  - **Известное (out of scope).** Thread root, открытый по прямой
    ссылке после удаления, всё ещё рендерится с tombstone в
    ThreadPanel (backend отдаёт root отдельно без фильтра). Pavel'я
    intent касается main feed — это закрыто. Thread-root edge —
    follow-up.
  Сборка зелёная (tsc + vite). Без миграций — чистая API/UI правка.
- **v1.2.8** — **трек P3: polish Platform Admin** — pagination,
  search-debounce, row-click details (user/server), расширенный
  suspend-gating. Закрытие хвоста треkа P.
  - **Backend.** Suspend-gating расширен на ещё 3 write-точки:
    DELETE `/api/channels/:id` (удаление каналов), PATCH
    `/api/channels/:id` (rename/edit), PATCH
    `/api/servers/:id/members/:userId` (role-changes). Не блокируем
    DELETE server / leave / icon — это destructive owner-actions /
    user-exit, suspend не должен запирать выход.
  - **Backend.** Новые details-endpoints: GET
    `/api/platform/users/:id/details` (профиль + owned servers +
    `memberCount` + audit-trail entries где user был actor ИЛИ target
    в metadata) и GET `/api/platform/servers/:id/details` (профиль +
    role-breakdown через `groupBy` + audit-trail entries где сервер
    упомянут в metadata.targetServerId/serverId). Audit-trail —
    последние 50 событий.
  - **Frontend.** `PlatformAdminPanel` обогащён:
    - Pagination footer (общий компонент `PaginationFooter`) на
      всех 3 табах: range `1–50 из 137` + «← Назад» / «Вперёд →».
      Page-size: Users 50 / Servers 50 / Audit 100.
    - Search-debounce 300ms (Users, Servers) через `useDebounced`
      hook — load летит после паузы в наборе, не на каждую клавишу.
    - Row-click → details-modal: новые компоненты
      `PlatformUserDetailsModal` и `PlatformServerDetailsModal`.
      Action-кнопки в строке делают `stopPropagation`, чтобы клик
      по кнопке не открывал details. Hover на строке подсвечивает
      имя accent'ом — подсказка кликабельности.
    - При смене search/filter offset сбрасывается в 0 (не зависать
      на пустой странице).
  - **Details modals.** Header (avatar/icon + name + email/owner +
    chips статусов), секции:
    - User: «Состояние» (бан/удаление — when/who/reason), «Серверы в
      собственности» (table с created/size/status), «История событий»
      (audit table — time/type/actor/metadata).
    - Server: «Заморозка» (when/who/reason если suspended), «Состав по
      ролям» (chips с количеством по каждой роли,
      OWNER/ADMIN→accent-gold/accent), «История событий».
  - **CSS** в cockpit.css: `__row--clickable`, `__pagination` /
    `__pagination-range`, `__details*` blocks (head/headtext/name/sub/
    meta/chips/section), `__role-chips`. SOLAR-совместимо через токены.
  Сборка зелёная (tsc + vite). Без миграции, только код.
- **v1.2.7** — **трек P2: расширение Platform Admin — Servers + Audit
  + soft-delete user + suspend-gating**. Закрытие исходного запроса
  Pavel'я («все пользователи, сброс паролей, баны юзеров, баны
  серверов»). К P1-набору добавлено: delete-user (soft), список и
  заморозка серверов, audit-view-таба, реальное блокирование writes
  в замороженных серверах.
  - **Schema** (Prisma migration `20260523150000_platform_admin_p2`):
    `User.deletedAt / deletedReason / deletedByUserId` + self-relation
    `UserDeletedBy`; `Server.suspendedAt / suspendedReason /
    suspendedByUserId` + self-relation `ServerSuspendedBy`;
    `AuditEventType` расширен `PLATFORM_USER_DELETED /
    PLATFORM_SERVER_SUSPENDED / UNSUSPENDED`. Без data-step.
  - **Soft-delete vs hard.** Выбран soft: deletedAt + Reason + By.
    Login / WS отбиваются 403 «навсегда», refresh-токены revoked,
    сокеты разорваны. Данные пользователя (сообщения, задачи,
    комментарии) остаются — UI рисует их как «удалённый
    пользователь», audit-trail цел. Обратимо вручную SQL:
    `UPDATE "User" SET "deletedAt"=NULL WHERE id='...'`. Серверы,
    которыми владел deleted user, не каскадят — используй «Заморозить».
  - **Suspend-gating** (`lib/serverGating.ts` →
    `ensureServerActive(serverId, reply)`): подключён в 4 critical
    write-точках — POST `/api/channels/:id/messages` (постинг
    сообщений), POST `/api/servers/:id/channels` (создание каналов),
    PATCH `/api/servers/:id/identity` (server settings), POST
    `/api/messages/:id/actions` (создание задач/решений). Заморожен →
    403. Чтение (история, member-list, каналы) НЕ блокируется —
    история не пропадает.
  - **Login-gate + WS-gate** расширены `deletedAt`-check'ом
    (рядом с существующим `bannedAt`-check'ом из P1, разные
    error-messages). `requirePlatformOwner` тоже отклоняет deleted.
  - **Endpoints (`routes/platform.ts`).** К P1-набору добавлено:
    POST `/api/platform/users/:id/delete` (double-confirm:
    reason + ввод слова «удалить»),
    GET `/api/platform/servers` (поиск по name/ownerEmail + filter
    active/suspended + пагинация),
    POST `/api/platform/servers/:id/suspend`,
    POST `/api/platform/servers/:id/unsuspend`,
    GET `/api/platform/audit-log` (filter type/userId + пагинация).
    list-users теперь принимает `status=all/active/banned/deleted`
    (старый `banned=true/false` поддержан для backward-compat).
    Safety: cannot self-delete; cannot delete/ban/reset другого
    platform-owner'а; cannot ban/reset уже удалённого.
  - **Frontend.** `PlatformAdminPanel` переписан на 3 табы (Users /
    Servers / Audit). Users-таба получила Delete-кнопку с
    double-confirm (reason + ввод «удалить») + статус-чип «Удалён».
    Servers-таба — таблица с favicon-style icon, member/channel
    counts, mode-chip, suspend/unsuspend confirm-модалки. Audit-таба
    — read-only таблица с фильтрами type/userId. Все три табы — на
    cockpit-grammar (`.ec-cck-table` / `chip` / `banner`),
    SOLAR-совместимые через токены.
  - **Не делано (можно потом).** Suspend-gating шире (DELETE
    channel, role-changes, member-kicks) — оставлено на потом, в P2
    закрыты главные write-точки. Pagination UI («next/prev» кнопки) —
    list-API уже принимает offset/limit, UI показывает первый
    page (50/100); можно добавить позже.
  Сборка зелёная (tsc + vite). ⚠️ деплой = `prisma migrate deploy`
  применится автоматом (deploy.sh [4/10]).
- **v1.2.6** — **трек P1: Platform Admin — глобальная super-admin
  панель для владельца платформы (Users-only MVP)**. Новый трек.
  Запрос Pavel'я: «админ панель для супер админа, который будет видеть
  всех пользователей … сброс пароля, баны пользователей, баны серверов».
  - **Корень.** В прежней модели 10 ролей `MemberRole` (OWNER…GUEST)
    — все per-server; platform-уровня вообще не было. Super-admin —
    отдельная иерархия (флаг `User.isPlatformOwner`), не пересекается
    с per-server ролями. **P1 покрывает users; servers/suspend +
    audit-view-таба — P2.**
  - **Schema (Prisma migration `20260523120000_platform_admin_p1`):**
    `User.isPlatformOwner` / `bannedAt` / `bannedReason` /
    `bannedByUserId` + self-relation `UserBannedBy`; `AuditEventType`
    расширен `PLATFORM_USER_BANNED/UNBANNED/PASSWORD_RESET`. Data-step
    seed'ит `isPlatformOwner=true` для `man773608@gmail.com`
    (idempotent — UPDATE с WHERE).
  - **Backend.** `requirePlatformOwner` middleware (DB-lookup на
    каждом запросе — downgrade флага действует сразу). Login-gate в
    `auth.ts`: password проверяется первым (чтобы не утечь banned-
    флаг перебором email'ов), затем `bannedAt !== null` → 403 с
    причиной. WS connect-gate в `socketAuth.ts`: banned → `next(err)`.
    `routes/platform.ts`: `GET /api/platform/users` (поиск + фильтр
    banned/active + пагинация), `POST .../ban` (refresh tokens
    revoke + `disconnectUser` сразу), `POST .../unban`,
    `POST .../reset-password` (crypto-random 16-char temp pw,
    bcrypt-hash, возвращает raw ОДИН РАЗ; никогда не пишется в audit
    metadata). `publicUser` в `/api/auth/me` теперь отдаёт
    `isPlatformOwner`. Safety: cannot self-ban, cannot ban/reset
    другого platform-owner'а.
  - **Frontend.** `PlatformAdminPanel.tsx` — Modal с таблицей
    пользователей (cockpit-grammar: `.ec-cck-table` / `chip` /
    `banner`), confirm-модалки для каждого действия, show-once temp-pw
    модалка с copy-to-clipboard. Иконка в топбаре появляется ТОЛЬКО
    при `currentUser.isPlatformOwner === true`. SOLAR-совместима через
    токены.
  - **Reset-password flow.** Backend возвращает plaintext temp-pw в
    response один раз; UI показывает в модалке с warning «больше не
    появится». Pavel передаёт юзеру out-of-band (Telegram / звонок /
    лично). Email-инфры нет — самый честный flow для admin'а.
  - **Не реализовано в P1 (P2):** список/suspend серверов;
    audit-view-таба (логирование событий уже идёт, view впереди);
    search/filter ярче; details-view per user.
  Сборка зелёная (tsc + vite). ⚠️ деплой требует
  `prisma migrate deploy` (новые поля + enum-значения).
- **v1.2.5** — **slice 7: CSS-консолидация — дубль-блоки `.ec-shell*`
  + `!important`-война (3 файла)**. Закрытие brief-slice 7.
  - **Корень.** Декор каркаса определялся дважды: «Shell home /
    brand» (регион A) и «Immersive app surface» (регион B) в
    `components.css` задавали одни и те же селекторы (`.ec-shell`,
    `.ec-shell__cmdbar`, `.ec-chat-header`, `.ec-channel-item*` …);
    поздний блок перебивал ранний через `!important`. Война
    оказалась трёхфайловой — часть `!important` в `components.css`
    была load-bearing против `responsive.css` (фон `.ec-shell`,
    drawer-тени) и зеркалилась `!important`'ом в SOLAR-блоке
    `effects.css`.
  - **`components.css`:** дубль-блоки слиты — один канонический блок
    на селектор (декор — в секции «Shell — поверхности», nav — в
    «Channel list», layout/типографика — в grammar-блоке slice 1).
    Все ~25 shell-декор `!important` сняты.
  - **`responsive.css`:** убран misplaced `.ec-shell { background }`
    (appearance в layout-файле — корень одной из войн);
    `.ec-shell__drawer-btn` — мёртвый `background: transparent` под
    `!important`'ом components.css удалён, файл оставлен layout-only;
    снят `!important` у mobile `.ec-chat-title`.
  - **`effects.css`:** SOLAR shell-блок — `!important` снят, тему
    держит специфичность `html[data-ec-theme] .x` (0,2,1) над
    `.x` (0,1,0).
  - **Один видимый эффект (latent-баг войны исправлен):** на мобиле
    off-canvas drawer каналов/участников теперь показывает свою
    drawer-тень (`responsive.css`), а не десктопную «хребет»-тень —
    раньше `!important` глушил drawer-правило.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite).
- **v1.2.4** — **Execution Cockpit 3/3 ЗАКРЫТ: ActionItemDrawer →
  mission detail panel**. Drawer задачи (2109 строк) переведён на
  cockpit-язык.
  - **Долг убран:** ~25 module-level `CSSProperties`-консолей
    (`backdrop` / `drawer` / `headerStyle` / `bodyStyle` /
    `sectionLabel` / `propRow` / `inlineInput` / `titleInput` /
    `descTextarea` / `composerWrap` / `sendBtn` …) и весь
    inline-style долг (~95) → cockpit-классы. JS-hover в CommentRow
    (`hover`-state) и dep-picker (`onMouseEnter`-мутация `.style`)
    → CSS.
  - **Mission detail panel:** сильный identity-блок (type-glyph +
    тип + status-капсула + hero-заголовок); ясная иерархия секций
    (свойства / одобрение / зависимости / описание / сводка /
    комментарии / история); approval/dependency-формы — inset-
    панели; кастомные кнопки → канонические `.ec-btn`.
  - `cockpit.css` дорос drawer-слоем (`.ec-cck-drawer*` /
    `.ec-cck-sec*` / `.ec-cck-prop*` / `.ec-cck-field*` /
    `.ec-cck-comment*` / `.ec-cck-inset` / `.ec-cck-deprow` /
    `.ec-cck-statussel`). DAG-граф зависимостей (SVG) сохранён,
    токены приведены к реальным (`--ec-status-*-soft`).
  Логика (approval workflow, dependency DAG, AI summary, realtime
  sync) не тронута. **Трек R2 — Execution Cockpit — закрыт 3/3**:
  StatusBoard + OperationalTablePanel + ActionItemDrawer на единой
  cockpit-системе. Сборка зелёная (tsc + vite).
- **v1.2.3** — **Execution Cockpit 2/3: OperationalTablePanel →
  control desk**. Операционная таблица (1762 строки) переведена на
  cockpit-язык.
  - **Долг убран:** ВСЕ module-level `CSSProperties`-консоли
    (`wrap` / `header` / `titleInput` / `actionBtn` / `bodyScroll` /
    `tableStyle` / `thStyle` / `tdStyle` / `cellInput` /
    `cellInputFocus`) удалены, весь inline-style долг (~64) → классы.
    JS-hover в RelationCell (`onMouseEnter`-мутация `.style`) → CSS
    `.ec-cck-pop__row:hover`.
  - **Control desk, не spreadsheet:** sticky-header `.ec-cck-th` —
    плотный, чёткий; строка реагирует на курсор целиком
    (`.ec-cck-row:hover`); column rhythm; drag/drop — data-атрибуты.
  - **Inline-edit как состояние системы:** `.ec-cck-cell` в покое
    выглядит текстом, focus = input-bg + accent-кольцо.
  - Sci-fi-заголовок (uppercase + tracking + display-font) →
    спокойное editable-поле `.ec-cck-titlefield`. Кастомные
    `actionBtn` → канонические `.ec-btn`. Row-action-язык
    (`.ec-cck-rowbtn` / `.ec-cck-act`), linked-action badge —
    tone-driven.
  - `cockpit.css` дорос table-слоем (`.ec-cck-table*` /
    `.ec-cck-cell*` / field-header / row-action / relation-popover /
    file-chip).
  Логика (drag-reorder, AI-fill, realtime sync, RELATION/FILE) не
  тронута. Остаётся ActionItemDrawer (3/3). Сборка зелёная.
- **v1.2.2** — **трек R2: Execution Cockpit — система + StatusBoard**
  (ТЗ Pavel'я: ядро execution-части ощущалось «старым слоем с
  косметикой»). Заход — design-system, не patch-machine.
  - **`cockpit.css` — общий язык операционных поверхностей.**
    Примитивы заданы один раз токенами: `.ec-cck__head` (композиция
    identity / tooling), `.ec-cck-filter` (toggle-фильтр),
    `.ec-cck-chip` — ОДИН tone-driven chip на все
    status/due/approval/blocker (цвет через `--tone`),
    `.ec-cck-card` / `.ec-cck-col` (карта и колонка с
    hover/drag/drop-target состояниями), `.ec-cck-check`,
    `.ec-cck-empty`, `.ec-cck-banner`. State-язык
    (hover/press/focus/drop/done) — в CSS один раз.
  - **StatusBoard переведён на cockpit-язык целиком.** Убраны все
    module-level `CSSProperties`-консоли (`wrap` / `header` /
    `board` / `column` / `card` / `checkbox` / `filterBtn` …) и
    inline-стили. Sci-fi-заголовок «EXECUTION_BOARD //» (mono +
    caps) убран → спокойный `.ec-cck__title`. Три разрозненных
    inline-чипа (due / approval / blocked) → один `.ec-cck-chip`.
    Логика (фильтры, drag-drop, 4-status buckets) не тронута.
  Первый из трёх execution-surface'ов; OperationalTablePanel и
  ActionItemDrawer — следующими, на готовой cockpit-системе.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite).
- **v1.2.1** — **рекомпозиция каркаса: командный хребет + центр-бар**
  (трек R, shell). Полноширинный SaaS-топбар убран — самый
  generic-элемент композиции. Бренд + переключатель пространств
  уехали в левую колонку: `brandbar` + список каналов теперь одна
  вертикаль — «командный хребет» с общей правой кромкой и тенью.
  Глобальный бар сжат до центра над чатом (`cmdbar`): локация
  слева, действия справа. Грид `.ec-shell` пересобран —
  `"brand cmd cmd" / "channels chat members"`, асимметрия (хребет
  272px шире правого рейла 248px). Sci-fi-breadcrumb «УЗЕЛ //»
  (mono + caps + tracking) убран → спокойный `.ec-shell__loc`
  (пространство приглушено, канал — акцент). Wordmark «ECLIPSE_CHAT»
  убран из chrome — компактная бренд-марка как home-кнопка.
  Дубль-правила `.ec-shell__top` ретаргечены на brandbar/cmdbar
  (без нового слоя поверх старого). Responsive: все breakpoints +
  mobile `"brand cmd"`. SOLAR-варианты. Сборка зелёная (tsc + vite).
- **v1.2.0** — **трек R1: фирменный media-плеер «Signal Desk» v2**
  (ТЗ Pavel'я — плеер ощущался «utilitarian browser-feel»).
  Root cause: плеер был набором стандартных медиа-виджетов под
  violet-glow'ом, не авторский объект. Передел:
  - **MediaScrubber → фирменное ядро таймлайна.** Было: дефолтная
    браузерная полоска fill+dot. Стало: три слоя — buffered
    (загружено) / fill (сыграно) / playhead; hover-предпросмотр —
    над курсором всплывает время точки, куда попадёшь при клике
    («подсказка» до коммита); drag с pointer-capture, thumb растёт;
    loading — дорожка идёт shimmer'ом, пока длительность неизвестна.
    `bufferedMs` читается из `<audio>/<video>.buffered`.
  - **Mini-player → объект с иерархией.** Было: 11 равновесных
    контролов в пилюле (контрол-стрип). Стало: primary-зона (play ·
    имя · таймлайн · время) ведёт; utility-кластер (громкость / next
    / expand / stop) за hairline-разделителем и приглушён.
  - **Expand-player → showpiece.** Убран шум: вейвформа больше НЕ
    пульсирует всеми 64 барами (`ec-wave-pulse` удалён) — бары
    статичны (это реальные peaks трека, данные). Единственный
    «живой» элемент — playhead: линия + светящийся узел. Добавлен
    hover-предпросмотр времени по вейвформе.
  - **VideoPlayer — фирменный radar-ping loader** `.ec-signal-loader`
    («ищу сигнал»: ядро дышит, расходятся концентрические кольца)
    вместо браузерного border-спиннера. Buffered-слой в скраббере.
  - **Control language — убран AI-slop.** `.ec-player-ctrl` больше
    не светится drop-shadow-glow'ом на каждом hover (grammar v2 §3.4:
    accent — сигнал, не декор). Glow зарезервирован за hero-play и
    live-сигналом; hover = surface + brighten, как у `.ec-icon-btn`.
  - Hero-play: `data-state` оптически центрирует play-треугольник
    в круге.
  SOLAR-корректность: ghost-маркеры переведены на theme-aware токены
  (+ override для всегда-тёмного видео). reduced-motion — петли
  гаснут. Чистый фронт, без миграций. Сборка зелёная (tsc + vite).
- **v1.1.99** — **integrity-фиксы + честная сверка docs↔код**
  (ТЗ Pavel'я «redesign недотянут, много эффекта — мало цельности»).
  - **Logout — регресс надёжности.** `LogoutButton`: `busyRef`
    ставился в `true` и НИКОГДА не сбрасывался — латч в один конец.
    `onLogout` по типу `void | Promise<void>` может быть async и
    упасть; `void onLogout()` глотал rejection. Если logout падал
    или не уводил со страницы — кнопка после первого клика мертва
    (`if (busyRef.current) return`), выйти нельзя без перезагрузки.
    Фикс: вызов обёрнут в `finish()` с try/finally — латч и
    состояние откатываются, если компонент пережил logout; таймеры
    чистятся на unmount, `setState` гейтится `mountedRef`. Театр
    (дверь/фигурка) не тронут — надёжность первой.
  - **Identity-конфликт.** `ServerHubModal` color-пресеты
    (`Cool sky` cyan, `Teal mint` teal, `Amber`/`Coral` warm,
    `Plasma pink`/`Lime` тропик-неон) противоречили design-brief-v2
    §2 — каждый задаёт серверу `--ec-accent` (primary). Заменены на
    identity-набор: Затмение / Аметист / Индиго / Лазурь / Золото /
    Сталь (violet-семья + gold + холодные). Комментарий-контракт
    против повторного дрейфа.
  - **Враньё доков.** `design-brief-v2.md` §5: slice'ы 2–7 висели
    «план» — приведено к реальности + честная пометка, что slice
    1–5 были применением грамматики, не композиционным переделом
    (новая строка R). `surface-map.md` — снимок v1.1.90 → v1.1.99,
    статусы синхронизированы.
  - **Topbar button drift → система.** 6 action-кнопок топбара
    сидели на `.ec-btn--ghost` + 6× повторённый inline
    `style={{padding}}` + inline-color по open-state. Переведены на
    канонический `.ec-icon-btn`: accent активного — через
    `[aria-pressed]` + CSS, счётчик инцидентов → `.ec-count-badge`,
    danger-иконка → `.ec-icon-btn--alert`. Мёртвые
    `.ec-shell__top-actions .ec-btn*` правила и класс-сирота
    `.ec-focus-toggle` убраны.
  - `ServerHubModal` brand-color секция: inline-консоли свотчей /
    HSL-тюнера / actions-ряда → классы `.ec-hub-swatch*` /
    `.ec-hub-hsl*` / `.ec-hub-actions`.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite). Большой
  визуальный передел (топбар/shell-композиция, фирменный плеер,
  кнопки как система) — отдельный трек R, следующими слайсами.
- **v1.1.98** — **фикс: `/api/version` врал + smoke-тавтология
  (integrity-фикс)**. После деплоя v1.1.97 прод отдавал
  `/api/version` → `1.1.89`, хотя редизайн (слайсы 1-7) реально
  выкачен. Корень: хардкод версии в `apps/server/src/index.ts`
  (эндпойнт `/api/version`) застрял на `1.1.89` — не бампался 8
  релизов (v1.1.90…v1.1.97), хотя три других места бампа
  (`package.json` ×2, `sw.js`) шли в ногу. Почему дрейф не ловился:
  `deploy.sh` брал `EXPECTED_VERSION` для smoke ИЗ ТОГО ЖЕ хардкода
  `index.ts` и сверял с `/api/version`, который этот хардкод и
  возвращает → проверка сравнивала строку саму с собой, упасть не
  могла структурно. Фикс: (1) все 4 места бампа синхронизированы на
  1.1.98, включая хардкод `index.ts`; (2) `deploy.sh` читает
  `EXPECTED_VERSION` из `apps/server/package.json` — независимый
  источник, smoke стал реальной кросс-сверкой package.json ↔
  `/api/version` и поймает любой будущий дрейф хардкода. Чистый
  фикс, без миграций. Сборка зелёная (tsc + vite).
- **v1.1.97** — **redesign slice 7: ServerHubModal под grammar v2**.
  12 inline-style консолей (`tabBar`, `tabBtn`, `sectionCard`,
  `sectionLabel`, `fieldHint`, `inputStyle`, `stat`, `statLabel`,
  `statValue`, `codeBox`, `memberRowStyle`, `roleSelect`) → классы
  `.ec-hub-*`. JS-hover в компоненте не было. Глубокий one-off inline
  (баннер, icon-box, color-presets, mode-карточки, danger-зона) —
  оставлен (не reused, не drift-механизм), помечен follow-up'ом.
  Сборка зелёная (tsc + vite). Живой визуальный smoke не делался.
- **v1.1.96** — **redesign slice 6: SearchOverlay под grammar v2**.
  10 inline-style консолей → классы `.ec-search-*`. JS-hover hit-строк
  убран целиком (4 списка — сообщения / дела / файлы / семантика —
  раскрашивались через `onMouseEnter`-мутацию `.style`) → CSS
  `:hover`. Табы поиска успокоены: были mono + tracking 0.14em →
  спокойный sans-eyebrow. Остаток: глубокий статический inline внутри
  hit-строк (текст-спаны) — не drift-механизм, помечен как
  follow-up. ServerHubModal (1036 строк) — отдельный slice 7.
  Сборка зелёная (tsc + vite). Живой визуальный smoke не делался.
- **v1.1.95** — **redesign slice 5: overlays — Modal-база +
  ChannelInfoPanel под grammar v2**.
  - **Modal** — базовая модалка (её используют ВСЕ диалоги, поэтому
    это рычаг на все overlay'и). 6 inline-консолей → классы
    `.ec-modal-*`, JS-hover close-кнопки убран → `.ec-icon-btn`.
    Удалено мёртвое off-grammar правило `tokens.css` («uppercase
    brand framing» для заголовка — всегда перекрывалось inline'ом);
    заголовок теперь спокойный `.ec-modal-title`.
  - **ChannelInfoPanel** — 6 inline-консолей → `.ec-channel-info-
    panel*` / `.ec-info-tab*`. JS-hover close-кнопки убран. Табы
    успокоены: были mono + tracking 0.16em → спокойный sans-eyebrow.
  - SearchOverlay (818 строк) и ServerHubModal (1036) — каждый
    размером со слайс, вынесены в отдельный slice 6.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite). Живой
  визуальный smoke не делался.
- **v1.1.94** — **redesign slice 4: правый rail (IntelligencePanel /
  MemberList / ThreadPanel) под grammar v2**.
  - **IntelligencePanel** — 6 inline-консолей → классы `.ec-rail*`.
    Заголовок «ТАКТИЧЕСКИЙ ВИД» успокоен визуально: был mono +
    tracking 0.18em («терминальный крик») → спокойный sans
    section-eyebrow (как `.ec-tactical-header__title` в v1.1.80).
    Текст-копирайт не тронут (sci-fi sweep — отдельное решение).
  - **MemberList** — 5 inline-консолей → `.ec-member-list*` /
    `.ec-member-row*`. JS-hover строки участника убран (подсветка +
    подъём + раскрытие DM-кнопки шли через `onMouseEnter`-мутацию
    `.style`) — теперь CSS `:hover`/`:focus-within`. Floating-подъём
    строки убран (как у сообщений в slice 3 — ровное сканирование).
  - **ThreadPanel** — 9 inline-консолей → классы `.ec-thread*`,
    JS-hover close-кнопки убран, заголовок успокоен.
  - Close-кнопки railّа переведены на канонический `.ec-icon-btn`.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite). Живой
  визуальный smoke не делался.
- **v1.1.93** — **redesign slice 3: центральная сцена (MessageList +
  MessageInput) под grammar v2**. Самая крупная поверхность.
  - **MessageList** — 13 inline-style консолей вынесены в классы
    `.ec-message-list*` / `.ec-message-row*` / `.ec-msg-*`. JS-hover
    убран целиком: ряд сообщения подсвечивался и раскрывал
    action-toolbar + sticky-время через `onMouseEnter`-мутацию
    `.style` — теперь чистый CSS `:hover`/`:focus-within`. Floating-
    прототип (translateY-подъём каждой строки) убран как твичи на
    плотной ленте — спокойный surface-tint; характер живёт в
    тулбаре. 10 кнопок toolbar'а → `.ec-msg-action` + семантические
    тона (accent/warn/danger). Реакции / тред / action-таблетки —
    единый `.ec-msg-pill`-hover.
  - **MessageInput** — 14 inline-style консолей вынесены в классы
    `.ec-composer*` / `.ec-slash-hint*` / `.ec-kbd`. JS-hover убран
    (attach / voice / slash-подсказки). Фокус коробки — CSS
    `:focus-within` вместо React-state. Operator-strip
    («ЗАЩИЩЁННЫЙ_КАНАЛ» / «ВВОД ПОТОКА») оставлен как identity
    (решение v1.1.90), переведён на классы. Drag-over теперь даёт
    видимый violet-ring (раньше фон-фидбэк был мёртв под `!important`).
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite). Живой
  визуальный smoke не делался.
- **v1.1.92** — **redesign slice 2: навигация (ServerSwitcher +
  ChannelList) под grammar v2**. Продолжение передела.
  - **ServerSwitcher** — триггер и пункты меню переведены на классы
    `.ec-srv-*` (theme-aware токены). Исправлен **SOLAR-баг**: триггер
    «Пространства» жил на хардкоде `hsl(214 …)` — в светлой теме был
    тёмным пятном; теперь корректен в обеих темах. JS-hover убран.
  - **ChannelList** — все inline-style консоли (`wrap`, `headerStyle`,
    `serverTrigger`, `listWrap`, `composerRow`, `sectionAddBtn`,
    `deleteBtn`, `sidebarTabBar`, `sidebarTabBtn`) вынесены в классы
    `.ec-channel-list*` / `.ec-channel-action` / `.ec-section-add` /
    `.ec-sidebar-tab*`. JS-hover убран целиком: действия комнаты
    (mute/settings/delete) проявляются через CSS `:hover`/`:focus-within`,
    а не через `onMouseEnter`-мутацию `.style`. Кнопка «+» секции
    крутится на hover; действия — единый icon-character.
  - **Убран фейковый sci-fi server-ID хэш** («◆ ID_XXXXXX_SYS_…») из
    шапки пространства — декоративный мусор без смысла (cyberpunk
    «превратился в шум»). Заголовок чище: имя + роль.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite). Живой
  визуальный smoke не делался.
- **v1.1.91** — **redesign slice 1: visual grammar v2 + фирменный
  медиа-плеер + кнопки с характером + logout-микровзаимодействие**.
  Крупный креативный передел (запрос Pavel'я). Source of truth по
  дизайну вынесен в `docs/design/design-brief-v2.md` +
  `surface-map.md`; cyan-era `docs/design-prompts/*` помечены
  DEPRECATED.
  - **Медиа-плеер — фирменный «Signal Desk».** Новый `player.css` —
    единый визуальный язык для аудио и видео. Переписаны
    `MediaScrubber` (`--frac`-дорожка с зажигающимся thumb),
    `MusicMiniPlayer` (капсула «под напряжением» — подсвеченный
    левый край при игре, gold-кольцо ведущего, hover-reveal
    громкости), `VideoPlayer` (авто-скрытие панели, фирменное
    loading-кольцо вместо браузерного спиннера, hero play-кнопка),
    `MusicExpandModal` (showpiece: атмосферная waveform-сцена,
    transport с дышащей play-кнопкой + emit-кольцом, очередь с
    подсветкой «Далее»). Нативный `<video controls>` не используется.
  - **Кнопки с характером.** Система: `.ec-btn` подаётся навстречу
    курсору (микро-подъём + тень), press вдавливает; `.ec-btn--primary`
    — violet sheen (teal-градиент убран как off-identity), halo на
    hover; `.ec-btn--danger` — тревожное свечение; новый канонический
    `.ec-icon-btn`; `.ec-player-ctrl` / `.ec-player-play` —
    плеер-контролы с hover-glow.
  - **Logout — showpiece.** Hover: рамка наливается красным, дверь
    распахивается, оператор шагает к порогу, профиль-чип рядом
    гаснет (grayscale + dim — «предпросмотр отсутствия»). Click —
    уходит сквозь проём, дверь захлопывается. reduced-motion fallback.
  - **Grammar-фундамент.** Канонический `.ec-icon-btn`; inline-style
    консоли `AppShell` (топбар/chat-header/каркас) вынесены в классы;
    JS-hover (`onMouseEnter/Leave` → `.style`) убран из шапки; бренд-
    марка переведена с off-identity orange на gold; снят animated
    shimmer с wordmark'а; устаревший заголовок `tokens.css` обновлён.
  Чистый фронт, без миграций. Сборка зелёная (tsc + vite). **Живой
  визуальный smoke не делался** — нужен бэкенд + сессия; проверить
  при ревью. Дальше — slice 2+ (см. design-brief-v2 §5).
- **v1.1.90** — **честный TLS-ярлык композера (integrity-фикс)**.
  Композер показывал бейдж «ШИФРОВАНИЕ» с tooltip'ом «End-to-end
  encryption активно» — но реального E2E нет: сервер хранит
  сообщения в Postgres открытым текстом и читает их. Бейдж врал
  пользователю (и висел во ВСЕХ каналах, включая публичные, где
  E2E концептуально неприменимо). Фикс — переформулировка в
  TLS-правду: бейдж «ШИФРОВАНИЕ» → «TLS», tooltip → «Соединение
  защищено TLS — сквозного (E2E) шифрования нет». Транспорт
  реально под TLS (HTTPS/WSS) — новый ярлык не врёт. Пилл
  «ЗАЩИЩЁННЫЙ_КАНАЛ» и плейсхолдер «защищённый канал» оставлены:
  для TLS-соединения это корректно. `AuthPage` HUD «ЗАЩИЩЁННАЯ
  СВЯЗЬ АКТИВНА» — про соединение (TLS), не про контент, не
  тронут. Чистый фронт, без миграций. Настоящий E2E — отдельная
  фаза, см. «📋 Открытые follow-ups» → E2E-шифрование.
- **v1.1.89** — **живые анимации музыкального плеера** (запрос
  Pavel'я). Плеер «оживает», пока трек играет:
  - **Анимированная вейвформа** в расширенном плеере — бары «дышат»
    (`scaleY` от центра), у каждого своя длительность и фаза →
    неровный органичный ритм, не механический unison.
  - **Мини-эквалайзер «now playing»** в плеере шапки — 3 столбика
    с разным темпом, рядом с названием трека.
  Всё CSS-keyframe, гейтится на `isPlaying` (на паузе статично),
  уважает `prefers-reduced-motion`. Без аудио-анализа (Web Audio
  AnalyserNode) — это надёжно и дёшево; реактивность под реальный
  звук — возможный апгрейд later.
- **v1.1.88** — **фикс: видео-плеер в лайтбоксе ломал вёрстку**.
  Лайтбокс рендерился не как полноэкранный оверлей — съезжал в поток
  страницы (чат виден вокруг плеера, панель управления оторвана вниз
  экрана). Root cause: `Lightbox` рендерится внутри `.ec-message-row`,
  у которой от `ec-anim-message-enter` (`animation-fill-mode: both`)
  остаётся `transform: translateY(0)`. Любой не-`none` transform у
  предка делает его containing-block'ом для `position: fixed` →
  backdrop оверлея позиционировался относительно строки сообщения, а
  не вьюпорта. Баг пред-сессионный, но стал заметен на кастомном
  видео-плеере (слайс 3) — раньше лайтбокс с нативным `<video>`
  открывали реже. Фикс — `Lightbox` рендерится через `createPortal`
  в `document.body`, вне всех трансформированных предков. Картинки и
  watch-party не затронуты (watch-party — в `Modal` на верхнем уровне
  AppShell, без transform-предков).
- **v1.1.87** — **медиа-плеер, слайс 4: watch-party (синхро-видео)**.
  Финальный слайс — фича закрыта 4/4. Архитектура: **без новой
  таблицы и миграции** — существующая синхро-сессия (`MusicSession`)
  media-агностична, переиспользована для видео.
  - **backend** — `loadAudioAttachment` принимает audio И video →
    `/music/start` поднимает синхро-сессию с видео-вложением.
  - **`MusicExpandModal`** — для видео-трека рендерит синхро-`<video>`
    (следует за серверной позицией сессии — тот же алгоритм, что у
    `<audio>` мини-плеера) + `MediaScrubber` для перемотки (host/MOD,
    синхронно всем зрителям). Заголовок → «Совместный просмотр».
  - **`MusicMiniPlayer`** — у видео-сессии фоновый `<audio>` не
    дублирует звук (играет `<video>` в модалке).
  - **Точка входа** — кнопка «Смотреть вместе» в лайтбоксе видео →
    `music.start` → синхро-сессия для комнаты.
  **Медиа-плеер ЗАКРЫТ 4/4:** 1 перемотка + анимир. скраббер ·
  2 очередь · 3 кастомный видео-плеер · 4 watch-party.
- **v1.1.86** — **медиа-плеер, слайс 3: кастомный видео-плеер**.
  Видео-вложения играли через нативный `<video controls>` в лайтбоксе.
  - **`VideoPlayer`** — новый компонент: своя панель (play/pause,
    громкость, полный экран), перемотка через общий `MediaScrubber`
    (ядро из слайса 1), центральная play-кнопка, hover-glow на
    кнопках — дизайн-язык макета `eclipse-os-v1`. Воспроизведение
    локальное (синхро-watch-party — слайс 4).
  - **Лайтбокс → галерея** — листает соседние вложения: видео
    переключается кнопками next/prev в плеере (+ авто-переход по
    `onEnded`), картинки — стрелками ‹ › / клавишами ←/→. Счётчик
    «N/всего» в подписи.
  Дальше по фиче: слайс 4 — watch-party (синхро-видео в голосовой).
- **v1.1.85** — **медиа-плеер, слайс 2: видимая очередь + перемотка
  по вейвформе**. Расширенный плеер (`MusicExpandModal`) показывал
  только счётчик `+N в очереди`, большая вейвформа была read-only.
  - **backend** — `GET /api/channels/:id/music/queue` — резолвит
    очередь (attachment IDs) в треки с именами, в порядке очереди;
    битые id молча отсеиваются. Membership-only.
  - **`MusicExpandModal`** — большая вейвформа стала перематываемой
    (click + drag, host/MOD+; server-side seek через slice-1 эндпоинт
    `/music/seek` → все слушатели ре-синхронятся; плейхед следует за
    курсором при drag). Добавлен видимый список очереди — имена
    ближайших треков, hover-glow на строках.
  Дальше по фиче: слайс 3 — видео (тот же `MediaScrubber`),
  4 — watch-party (синхро-видео в голосовой).
- **v1.1.84** — **медиа-плеер, слайс 1: перемотка + анимированный
  скраббер**. Старт фичи «свой плеер для видео и музыки» (запрос
  Pavel'я). Прогресс-бар синхро-музыки был display-only — перемотки
  не было.
  - **backend** — `POST /api/channels/:id/music/seek` (host / MOD+):
    двигает `positionMs`, при playing сбрасывает `startedAt` на now,
    ре-броадкастит сессию → все слушатели ре-синхронятся (механизм
    как у skip/pause/resume). Без миграции — правит существующую
    `MusicSession`.
  - **`MediaScrubber`** — новый переиспользуемый компонент:
    click-to-seek + drag, hover-glow (дорожка утолщается, thumb
    проявляется и светится — язык дизайн-макета `eclipse-os-v1`),
    клавиши ←/→ на ±5 c. Во время drag — локальная позиция, коммит
    на сервер один раз на отпускании указателя. Это «ядро» будущего
    видео-плеера (слайс 3).
  - `useChannelMusic.seek()`; интеграция в `MusicMiniPlayer` (заменил
    статичный бар); hover-glow на кнопках плеера.
  Дальше по фиче: слайс 2 — очередь/«следующий», 3 — видео,
  4 — watch-party (синхро-видео в голосовой).
- **v1.1.83** — **читаемый разделитель даты в ленте**. Из аудита
  главного экрана: разделитель дня рендерил
  «ЗАПИСЬ_ЖУРНАЛА_20_МАЯ_2026 // СИНХР_ВРЕМЕНИ» (`formatLogEntryDay`)
  — дату нельзя было прочесть как дату. Переключён на уже
  существовавший `formatDay` — «Сегодня» / «Вчера» / «20 мая».
  Мёртвая `formatLogEntryDay` удалена, дублирующий `title` снят.
  Объективные пункты аудита закрыты; остаток — sci-fi-копирайт как
  identity-вопрос (СВЯЗАННЫЕ_УЗЛЫ / СПЯЩИЙ_РЕЖИМ / «Передача
  сигнала» и т.п.) и честность ярлыка «ШИФРОВАНИЕ» — за решением
  Pavel'я.
- **v1.1.82** — **фикс: строки участников были вдвое выше нормы**.
  Аудит главного экрана (по просьбе Pavel'я). Root cause: `rowStyle` в
  `MemberList.tsx` — CSS-grid из 3 колонок (`auto 1fr auto`), но строка
  рендерит 4 элемента — аватар, имя, роль-пилл и **DM-кнопку**
  («написать в личку», видна для всех кроме себя). 4-й элемент
  переносился на вторую implicit-grid-строку → высота КАЖДОЙ строки
  участника удваивалась (~36 → ~66px), панель «Тактический вид»
  выглядела разреженной/сломанной. Фикс — 4-й трек
  (`auto 1fr auto auto`); пустой схлопывается в 0, когда DM-кнопки нет.
  Баг пред-сессионный (виден на ранних скриншотах). One-line fix.
- **v1.1.81** — **топбар-полиш** (опциональный остаток после передела
  4/4). Правая зона топбара была «свалкой» из ~12 элементов в один
  ряд. Введён hairline-разделитель `.ec-topbar-sep` — режет зону на 3
  читаемых кластера: **статус** (телеметрия) | **инструменты** (иконки
  + часы + тема) | **идентичность** (профиль). Gap внутри кластера
  уплотнён (`--ec-space-2` → `--ec-space-1`), воздух дают разделители.
  Убран мёртвый скрытый offline-дот (`display:none` хардкодом —
  наследие до телеметрии v1.1.38). Чистая композиционная правка,
  нулевой behavior-change. Глубже (схлопнуть вторичные иконки в
  overflow-меню) — отдельная структурная задача, если понадобится.
- **v1.1.80** — **визуальный передел, слайс 4 — иерархия масштаба +
  воздух (ФИНАЛЬНЫЙ)**. Закрывает 4-слайсовый передел AppShell.
  Главная правка — инвертированная типо-иерархия: `.ec-chat-title`
  (название канала — главный заголовок контент-области) рендерился
  мелким uppercase-mono chrome'ом (0.86rem, caps) — самое важное
  выглядело как служебная мелочь. Стало — настоящий заголовок:
  `--ec-text-md` (18px), естественный регистр («Музыка», не «МУЗЫКА»),
  плотный трекинг, display-шрифт. Calm section-eyebrow:
  `.ec-tactical-header__title` («ТАКТИЧЕСКИЙ ВИД») — mono + weight 700
  + tracking 0.18em («терминальный крик») → sans, weight 600,
  tracking 0.06em, чуть крупнее: чистый секционный лейбл, не
  sci-fi-readout. Воздух: `.ec-channel-item` 34 → 38px (nav-элемент
  дышит); `.ec-section-label` отделён от списка (margin 12px сверху /
  8px снизу — разрыв между секциями). **Передел AppShell закрыт 4/4:**
  1 type-система (Geist) · 2 декластер chrome · 3 цвет-дисциплина ·
  4 иерархия + воздух. Требует визуальной проверки. Опциональный
  остаток-полиш (не в 4 слайсах): плотность топбара, app-wide
  uppercase-mono в модалках / auth.
- **v1.1.79** — **визуальный передел, слайс 3 — цвет-дисциплина**.
  violet был «акцентом везде» (AI-app-клише). Структурный violet-tint
  `hsl(258 70% …)` — бордеры, hairline-тени, декоративные glow/wash,
  scrollbar, generic-hover — задавлен в нейтральный cool-slate
  `hsl(225 14% …)`: hue+sat сдвинуты, lightness/alpha сохранены
  (предсказуемо, ревьюабельно). Затронуты: весь shell-chrome
  `components.css` (~50 точек), elevation-токены `--ec-edge` /
  `--ec-elev-1` / `--ec-elev-2` + inset-rim'ы `--ec-shadow-modal` /
  `--ec-atmos-strong` (`tokens.css`) — violet-кольцо было на КАЖДОЙ
  приподнятой карточке app-wide, `responsive.css`. Настоящие акценты
  «по делу» — наоборот, промоутнуты до истинного `--ec-accent`
  (`hsl(258 90% 66%)`): active-канал, focus-ring компонентов
  (`.ec-field:focus`), глобальный `:focus-visible` (`reset.css`).
  Остаток violet не тронут намеренно: utility-классы `tokens.css`
  (corner-brackets, breadcrumb-cyber, tactical-header, status-pill —
  component-level, кандидаты на передел в слайсе 4) и эффекты
  (galaxy / spider-clock / glow-breathe — акцент по дизайну, не
  chrome). Слайс 3 из 4 (дальше: layout / иерархия масштаба / воздух).
  Требует визуальной проверки.
- **v1.1.78** — **SOLAR-палитра переписана под Notion-crisp**. После
  фидбека Pavel'я «светлая тема — кошмар». Сначала подтвердилось: видимый
  «половинчатый» вид (тело чата + панель участников тёмные при светлом
  каркасе) — **устаревший кэш бандла**, не баг кода. Доказано изолированным
  headless-рендером задеплоенного CSS с `data-ec-theme="solar"` — все 4
  панели рендерятся светлыми; SOLAR-оверрайды для chat/members есть с
  v1.1.67. После hard-reload каркас стал полностью светлым. **Реальная
  проблема** — сама палитра: surface-ramp немонотонный
  (`--ec-surface-1` #e2e9f0 ТЕМНЕЕ `--ec-bg` #eef3f7, а `--ec-surface-2`
  #f7fafc светлее) → нет иерархии глубины, панели читались тяжёлыми
  серыми блоками, тема «вымытая». **Фикс:** ~22 SOLAR-токена в
  `effects.css` переписаны под Notion-crisp — bg/cards/inputs белые,
  panels — whisper-cool-grey, структуру держат волосяные бордеры,
  hover/active — заметный нейтральный серый; монотонный ramp; cool
  undertone (hue ~225) в тон night-blue VOID. Закрыты два token-gap'а:
  `--ec-input-bg-focus` и `--ec-text-placeholder` отсутствовали в SOLAR
  (фокус инпута / placeholder уходили в тёмные дефолты). Хардкод
  blue-tinted градиенты `.ec-shell` / `.ec-shell__top` → флэт на токенах
  + crisp border. Проверено headless-рендером перед деплоем. Только
  SOLAR; VOID не затронут.
- **v1.1.77** — **визуальный передел, слайс 2 — декластер chrome**.
  Снят максималистский sci-fi-chrome главного экрана → Linear/Notion-
  тишина. Удалены два декоративных псевдо-слоя `.ec-shell`: blueprint
  dot-grid + radial-точки (`::before`, анимация `ec-console-field-drift`
  26s) и диагональные accent-линии + vignette (`::after`).
  Анимированные orbit-sweep линии `.ec-shell__top::after` (5.2s) и
  `.ec-chat-header::after` (6.4s) удалены — топбар и chat-header держат
  разделение статичным `border-bottom`. Фон `.ec-shell`: 3 радиальных
  glow (cool-sky / violet / gold) → почти флэт `#07090d` + один очень
  слабый верхний violet-wash. Удалены dot-grid'ы: `.ec-tactical-grid`
  (подложка `MemberList`) и фоновая grid-сетка `.ec-message-list`.
  Подчищено за собой: второе, дубль-определение `.ec-shell::before`
  v1.1.1 («Atmospheric grid» + `ec-grid-drift` 60s) в `tokens.css` —
  оба blueprint-слоя перекрывали друг друга, удалены вместе; мёртвые
  keyframes `ec-console-field-drift` / `ec-grid-drift`; SOLAR-override'ы
  `.ec-shell::before/::after` (`effects.css`); media-override
  `.ec-shell::before` (`responsive.css`); блок `prefers-reduced-motion`
  (`components.css`) ужат до единственного живого
  `.ec-home-today__header::after`. Keyframe `ec-orbit-sweep` оставлен —
  есть потребитель `.ec-anim-orbit-sweep`. Чистый декор-removal,
  нулевой behavior-change. Слайс 2 из 4 (дальше: цвет-дисциплина,
  layout / иерархия / воздух). Требует визуальной проверки.
- **v1.1.76** — **визуальный передел, слайс 1 — type-система**. После
  фидбека Pavel'я «дизайн как был говно, так и остался» — настоящий
  визуальный передел AppShell (не инкремент). **Диагноз:** `tokens.css`
  ссылался на Orbitron / Inter / JetBrains Mono, но НИ ОДИН шрифт не
  был подключён — `@font-face` не существовало нигде, файлов в
  `public/` нет. Весь интерфейс рендерился системным fallback'ом
  (Segoe UI). Вся «командно-центровая» типографическая идентичность
  физически отсутствовала в проде — корень «дешёвого / generic»
  вида. **Фикс:** self-host **Geist + Geist Mono** (Vercel, OFL-1.1;
  variable woff2, веса 100–900, Latin + Cyrillic — Geist 1.7.0+
  добавил кириллицу, критично для Russian-first; ~70 KB каждый,
  фингерпринтятся Vite'ом, без внешнего CDN). Новый `fonts.css` с
  `@font-face`. Токены `--ec-font-sans` / `--ec-font-display` →
  Geist, `--ec-font-mono` → Geist Mono. **Orbitron убран совсем** —
  sci-fi-клише, читалось как generic; display строится весом +
  размером, без отдельного шрифта. Убраны Inter-специфичные
  `font-feature-settings` (ss01/cv11). `text-wrap: balance` на
  заголовках, `pretty` на параграфах. Слайс 1 из 4 визуального
  передела (дальше: деклаттер chrome, цвет-дисциплина, layout /
  иерархия / воздух). Требует визуальной проверки.
- **v1.1.75** — **фикс: PTT не переживал audio-enhancer-цепочку**
  (item из списка открытых направлений). Root cause: в PTT-режиме
  mic при join вообще не публиковался (`setMicrophoneEnabled(false)`);
  трек создавался заново на каждое нажатие клавиши через
  `setMicrophoneEnabled(true)` → каждый раз свежий raw-трек.
  Enhancer-цепочка (mic gain + DSP) прикрепляется только на join →
  в PTT не применялась никогда. Фикс: mic публикуется ВСЕГДА на join
  (в т.ч. PTT) — enhancer прикрепляется один раз; в PTT трек сразу
  глушится через `mediaStreamTrack.enabled=false`. PTT-хендлеры
  (keydown/keyup/blur) толкают `mediaStreamTrack.enabled` вместо
  `setMicrophoneEnabled` — тот же gate-паттерн, что у VAD (проверен
  в проде) — enhancer-цепочка переживает нажатия. Fallback: если
  опубликованный трек не резолвится — старый путь
  `setMicrophoneEnabled` (PTT не ломается, просто без enhancer —
  worst case = текущее поведение). Blast radius — только PTT-режим
  (open/VAD/join-flow для них не меняется). Known: `toggleMute`
  имеет аналогичную особенность (`setMicrophoneEnabled`-цикл роняет
  enhancer) — отдельный мелкий follow-up. Требует верификации
  живым звонком.
- **v1.1.74** — **housekeeping: мёртвый rail-CSS удалён**. Server-rail
  (`ServerList`) свёрнут в topbar ещё в v1.1.51, но cosmetic-CSS
  остался мёртвым хвостом. Удалены: `.ec-shell__rail` (из двух
  shared-групп с channels/members + два standalone-правила),
  `.ec-server-rail` + `::before`, `.ec-rail-space-label`,
  `.ec-rail-nav-btn` / `.ec-server-tile` (+ `--active`/`--add`/
  `--join` модификаторы), токен `--ec-rail-width`
  (components.css / motion.css / tokens.css). `.ec-rail-expand`
  (раскрытие channels на mobile) — живой, не тронут. Чистый
  dead-code removal, нулевой behavior-change.
- **v1.1.73** — **светлая тема SOLAR, слайс 5 (финальный)**.
  Закрывает SOLAR-трек. Новый theme-aware токен `--ec-surface-sunken`
  (recessed/sunken sub-panels — карточки, табы, code-блоки внутри
  панелей; дефолт тёмный в `tokens.css`, светлый в `effects.css`).
  Захардкоженное тёмное семейство `hsl(208 16% 6–10%)` — 16
  occurrences — переведено на токен: `AdminPanel` (6), `HelpPanel`
  (3), `AdminIntegrationsTab` (2), `ProfileModal` (2),
  `AdminInvoicesTab` (1), `HomeToday` (1), `StatusBoard` (1).
  Мини-фикс `videoOverlay`: метка участника на видео-тайле (имя +
  «Камера»/«Демонстрация экрана») использовала `--ec-text-*` (в
  SOLAR тёмный) над тёмным scrim'ом → нечитаема. Текст метки сделан
  фиксированно-светлым (white-on-scrim читается в обеих темах).
  **SOLAR закрыт** — каркас / overlay'и / voice-room / заголовки
  панелей / recessed-поверхности переведены на theme-aware токены,
  светлая тема рабочая по всему приложению. VOID не затронут.
- **v1.1.72** — **светлая тема SOLAR, слайс 4 — заголовки панелей +
  overlay-остатки**. Захардкоженная тёмная header-полоса панелей
  `hsl(210 25% 4% / 0.55)` → токен `--ec-overlay-header-bg` (введён
  в слайсе 2) в 4 файлах: `ActionItemDrawer`, `IntelligencePanel`,
  `OperationalTablePanel`, `ThreadPanel` — шапки drawer'а задач /
  тактической панели / операционных таблиц / тредов в SOLAR теперь
  светлые. Overlay-остатки `hsl(200 8%)` → `--ec-overlay-bg`:
  `VoiceStatsOverlay`, `ComposioConnections`. 6 точечных swap'ов на
  существующие токены, без новых. VOID не затронут. Дальше —
  слайс 5: recessed-семейство `hsl(208 16%)` (~16 хардкодов в
  Admin / Help / Home / Profile / StatusBoard) через новый
  `--ec-surface-sunken` + мини-фикс videoOverlay-метки.
- **v1.1.71** — **светлая тема SOLAR, слайс 3 — voice-room**.
  Продолжение SOLAR-трека. Тёмные хардкоды voice-комнаты
  (`VoiceRoom.tsx`, ≈10 поверхностей) переведены на theme-aware
  токены: `topBar` (фон-fade → `--ec-surface-1`), `controlsDock`
  (→ `--ec-overlay-bg`), `controlBtn` ×2 + inline volume-control
  (фон → `--ec-surface-3`, border → `--ec-border-subtle`),
  `presenceCard` speaking+rest (→ `--ec-surface-2`), `muteBadge`
  border (→ `--ec-bg`, чтобы badge «вырезался» в любой теме),
  `stripChip` (→ `--ec-surface-2`). Фон комнаты `.ec-voice-room`:
  тёмные atmospheric-радиалы в SOLAR заменены theme-scoped
  override'ом (`effects.css`) на светлый. videoTileWrap оставлен
  тёмным — рамка за видео уместна в любой теме (как в плеерах).
  VOID — имперцептивный сдвиг (≤2-3% lightness; alpha-варианты
  унифицированы). Known: videoOverlay (name-label на видео-тайле)
  — dark scrim + `--ec-text-strong` (в SOLAR тёмный) → метка
  нечитаема, отдельный мини-фикс. Дальше — слайс 4: хвост
  per-component тёмных литералов (Admin / Status / Home / Help /
  Server* и др.).
- **v1.1.70** — **светлая тема SOLAR, слайс 2 — плавающие
  поверхности**. Продолжение SOLAR-трека (после слайса 1 — каркас).
  Введён theme-aware токен `--ec-overlay-bg` (+ `--ec-overlay-header-bg`
  для sub-полос): дефолт тёмный в `tokens.css`, SOLAR-значения
  светлые в `effects.css`. Захардкоженное тёмное семейство
  `hsl(200 8% 9–12%)` в 5 плавающих компонентах заменено на токен:
  `Modal` (один фикс покрывает ВСЕ модалки приложения —
  Profile/ServerHub/VoiceSettings/CreateChannel/…),
  `ParticipantContextMenu`, `EmojiPicker`, `StatusMenu`,
  `SearchOverlay` (панель + header-полоса). Теперь модалки / меню /
  popover'ы / Ctrl+K-поиск в SOLAR рендерятся светлыми. В VOID —
  сдвиг ≤2% lightness (имперцептивно; заодно overlay-фон
  унифицирован между компонентами). Архитектурно чисто — token-ификация,
  без className-хаков. Дальше слайс 3 — voice-room (≈14 хардкодов) +
  остальные per-component тёмные литералы.
- **v1.1.69** — **фикс: «замученный микрофон»** (баг Pavel'я).
  Регресс v1.1.59: audio-enhancer стал подключаться ВСЕГДА — даже в
  default-кейсе (NS "standard" + mic gain 1.0), где Web Audio-цепочка
  это чистый no-op `src→gain(1.0)→dest`. Лишний round-trip через
  `MediaStreamDestination` (пересоздание трека из AudioContext,
  возможный ресэмплинг, риск glitch'ей под нагрузкой) деградировал
  звук — голос звучал «замученным». Фикс: enhancer подключается
  ТОЛЬКО когда реально обрабатывает звук — режим "aggressive"
  (DSP-цепочка highpass+lowpass+compressor+gain) ИЛИ mic gain ≠ 1.0.
  Default-кейс снова публикует raw mic-трек напрямую (как до
  v1.1.59) — нативный WebRTC-пайплайн без лишних хопов. Known
  limitation: изменение mic gain с 1.0 на лету (когда enhancer'а не
  было на join) применится при следующем join — на лету работает,
  если gain ≠ 1.0 уже на входе в канал.
- **v1.1.68** — **фикс: демонстрация экрана и вебка показывались
  обрезанными** (баг Pavel'я). Видео-тайл `VideoTrackTile` был
  жёстко залочен в `aspectRatio: 16/9`; источник иной формы
  (4:3-вебка, не-16:9 screen-share) рендерился cover-style — края
  картинки срезаны. Фикс: тайл подстраивается под натуральные
  пропорции источника — на `loadedmetadata`/`resize` читается
  `videoWidth/videoHeight`, `aspect-ratio` тайла = пропорции видео
  (fallback 16:9 до прихода metadata). box совпадает с content →
  нет ни обрезки (cover), ни чёрных полос (contain), ни искажения
  (fill) — независимо от того, что навяжет object-fit. Доп.:
  `object-fit: contain` выставлен через `setProperty(…, "important")`
  — защита от любого CSS. `resize`-listener держит пропорции в
  синхроне при смене окна screen-share. Изменения локализованы в
  `VideoTrackTile` — узкий blast radius.
- **v1.1.67** — **светлая тема SOLAR, слайс 1 — shell-каркас**. Новый
  трек после закрытия системного редизайна: довести светлую тему.
  SOLAR-токены были (effects.css), но декоративный слой «Immersive
  app surface» в components.css хардкодит тёмные поверхности через
  `!important` — в SOLAR они оставались тёмными, тема выглядела
  сломанной. Слайс 1 — каркас главного экрана: добавлены
  theme-scoped `html[data-ec-theme="solar"]` !important-overrides
  (специфичность (0,2,1) бьёт (0,1,0)) для `.ec-shell` (фон),
  `.ec-shell::after` (тёмный vignette погашен — в светлой теме
  затемнял бы края), `.ec-shell__top` + topbar-кнопки + brand-home,
  `.ec-shell__channels`/`__members`, `.ec-chat-header`,
  `.ec-shell__chat`, `.ec-composer-box`. Значения — через
  SOLAR-токены. **VOID (тёмная) не затронута** — все правила
  theme-scoped, нулевой риск для текущих юзеров; SOLAR — opt-in
  (ThemeToggle, default VOID). CSS-бандл 115.5 → 117.3 KB. Дальше
  слайсы 2+ — модалки / overlay / voice-room / per-component
  тёмные хардкоды.
- **v1.1.66** — **системный редизайн, инкремент 8 — полиш (empty
  states)** (бриф §15). **Завершает системный редизайн — 8/8.**
  Триаж §15: компонент `EmptyState` + game-icon-set `EmptyIcons`
  были созданы (v1.1.22) как единый паттерн, но миграция не была
  доведена — 4 компонента (`MessageList`, `DirectConversationList`,
  `IncidentPanel`, `BotsTab`) всё ещё держали ad-hoc
  `<div className="ec-empty">` со своей вёрсткой. Все 4 мигрированы
  на `<EmptyState>` + game-иконки (void_signal / data_shard /
  bug_core / bot_eye) — единый calm-ритм, floating-иконка,
  консистентная типографика. `EmptyState.title` расширен `string`
  → `ReactNode` (для inline-акцента «#канал» в empty-channel).
  Мёртвый CSS `.ec-empty*` (4 правила в components.css + 1 в
  responsive.css) удалён. CSS-бандл 116.2 → 115.5 KB (−0.6 KB).
  Motion отдельной правки не потребовал — motion.css организован,
  без leftover cyan, reduced-motion покрыт; миграция заодно
  унифицировала motion empty-states (общий game-icon-float). Custom
  emoji (§16) — отдельным треком (нужны Gemini-ассеты + backend),
  в инкремент не входит. **Системный редизайн закрыт 8/8.**
- **v1.1.65** — **системный редизайн, инкремент 7b — focus dimming**
  (бриф §11, «Тихий фокус»). Завершает инкремент 7. Пока курсор в
  composer'е (набор сообщения), боковые панели `.ec-shell__channels`
  + `.ec-shell__members` мягко гаснут (opacity 0.6 + blur 1px) —
  чат-колонка выходит в центр внимания. Реализовано **pure-CSS через
  `:has(.ec-composer-textarea:focus)`** — без JS-трекинга фокуса,
  AppShell не тронут. Возврат панели: blur composer'а ИЛИ наведение
  курсора на саму панель (`:hover` → opacity 1). Триггер только
  набор (скролл-чтение не триггерит — выбор Pavel'я). Авто-поведение,
  отдельного user-facing «режима» не вводит — нет коллизии с
  существующим «Фокус-режимом» (#29, фильтр контента). Kill-switch:
  `data-focus-dim="off"` на `<html>` (хук `useFocusDim` + анти-FOUC
  inline-скрипт), контрол — карточка-тоггл «Затемнение панелей при
  наборе» в `ProfileModal`, default включено. `prefers-reduced-motion`
  — авто-затухание выключается целиком. CSS-бандл 115.3 → 116.2 KB.
  **Системный редизайн: 7 из 8 инкрементов закрыты, остался 8
  (полиш §15–16).**
- **v1.1.64** — **системный редизайн, инкремент 7a — density modes**
  (бриф §12). Инкремент 7 раздроблён на два слайса: **7a density**
  (этот) + **7b focus dimming** (§11, следующий). Пользовательская
  плотность интерфейса: 3 уровня **Стандарт / Компактно / Тактика**
  (Balanced / Compact / Tactical). Архитектура: `data-density` на
  `<html>` → CSS `:root[data-density]` переопределяет примитивную
  spacing-шкалу `--ec-space-*` (density модифицирует primitive-слой
  three-layer-токенов — ритм всего UI меняется разом, компоненты не
  трогаются). Compact ≈ −18%, Tactical ≈ −27% по вертикали. Хук
  `useDensity` (localStorage), контрол — сегментированный 3-way в
  `ProfileModal` (новая секция «Плотность интерфейса»). Анти-FOUC:
  inline-скрипт в `index.html` ставит `data-density` до первой
  отрисовки. **Default = Стандарт** — для всех существующих юзеров
  ничего не меняется (нулевой риск деплоя), Compact/Tactical строго
  opt-in. Tactical = «плотнее всех» (выбор Pavel'я). Дальше 7b
  (focus dimming §11) + инкремент 8.
- **v1.1.63** — **системный редизайн, инкремент 6 — tactical panel**
  (бриф §10 «network intelligence layer»). Правая панель «ТАКТИЧЕСКИЙ
  ВИД» (`IntelligencePanel` + `MemberList`). (1) **Premium role-badges:**
  `.ec-status-pill--owner` был warm-orange (`hsl(28 90%)`) — свип
  v1.1.55 тронул только cyan, этот badge остался off-identity. OWNER =
  премиум-роль → переведён на **gold** (`--ec-accent-gold*`, #D4AF37) +
  мягкий glow (единственный бейдж со свечением — gold-точечно). Всем
  pill'ам добавлен тонкий inset-highlight — лёгкая глубина вместо
  плоской заливки. (2) **Компактные строки:** per-row
  `.ec-corner-brackets` (tactical 1px-уголки на hover) сняты со строки
  участника — заменены floating depth-hover'ом (`translateY(-1px)` +
  `--ec-elev-1`), консистентно со slice 4 (сообщения) и composer'ом.
  CSS-правило `.ec-corner-brackets` живёт — ещё 3 потребителя
  (HomeToday / StatusBoard / TeamHealth). (3) **Network intelligence
  layer:** под header'ом панели — спокойная monospace signal-строка
  `◇ N УЗЛОВ В СЕТИ · M В ЭФИРЕ` (online-узлы + считанные из
  `voiceChannelByUser` voice-активные). Одна линия, без бокса/border'а
  — тихий system-readout, постоянного веса почти не добавляет
  (progressive disclosure). «в эфире» — teal (voice = статус).
  CSS-бандл 113.0 → 114.1 KB raw. Дальше 7–8.
- **v1.1.62** — **системный редизайн, инкремент 5 — сообщения + медиа**
  (бриф §8). Сами сообщения переделаны раньше (WS-1 slice 4 —
  floating-hover). Остаток §8 — медиа: у изображений (`imageWrap`)
  была рамка + radius, но не было тени → добавлена мягкая тень
  глубины («subtle media frame», картинка — лёгкая floating-карточка,
  не ломает поток). Hover картинки: почти-невидимый `scale(1.005)`
  заменён на `translateY(-2px)` + усиление тени — консистентно с
  floating-языком (как у видео-вложений, у тех frame+тень уже были).
  timestamp / реакции уже ненавязчивы — не трогались. Дальше 6–8.
- **v1.1.61** — **системный редизайн, инкремент 4 — composer** (бриф
  §9 «command / signal composer»). `.ec-composer-box` — полупрозрачный
  glass: фон `hsl(216 24% 10% / 0.55)` + `backdrop-filter: blur(20px)`
  + мягкая тень глубины («floating»). Focus — мягкое свечение
  (`0 0 22px` glow) вместо жёсткого 1px-ring'а. Высота ↓ (vertical
  padding `space-2`→`space-1`). icon-кнопки компактнее (32→28),
  send-кнопка компактнее (padding `0.55/0.9`→`0.4/0.7`). Плейсхолдер
  в Eclipse-стиле: «Передача сигнала в #канал…» / «Открыт защищённый
  канал…». Slash-command-first (новые `/poll /ai /note /deploy
  /remind` из брифа) НЕ добавлены — требуют backend-обработчиков;
  текущие `/task /decision /followup` сохранены. Дальше 5–8.
- **v1.1.60** — **системный редизайн, инкремент 3 — channels panel**
  (бриф §3). Дополняет WS-1 slice 3 (иерархия rest/unread/active
  была сделана). active-канал: убран дублирующий accent-бар
  (`inset 3px` box-shadow) — остался один чистый маркер (`::before`
  pill + мягкое внутреннее свечение). Категории каналов упрощены:
  3 цветных glowing-diamond'а (после violet-свипа стали violet/
  violet/green — полу-сломано) заменены на единый спокойный
  muted-маркер без glow и без per-type цветов (тип канала виден по
  тексту категории + глифам). Дальше инкременты 4–8.
- **v1.1.59** — фича: **усиление своего голоса** (mic gain regulator,
  запрос Pavel'я). Инфраструктура `micGain` (0..2) уже была в
  `useVoiceSettings`, но (а) UI-контрола не было, (б) применялась
  только в режиме noise-suppression "aggressive". Фикс: `audioEnhancer`
  получил режим `gainOnly` (цепочка `src→gain→dest` без DSP-фильтров);
  `useVoice` создаёт enhancer **всегда** в эфире (полная DSP-цепочка
  для "aggressive", только gain-стадия для standard/off) — регулятор
  работает на лету в любом режиме. В `VoiceSettingsModal` добавлена
  секция «Усиление микрофона» (слайдер 0–200 %). Известное ограничение:
  push-to-talk re-publish'ит raw-трек (enhancer-цепочка как и раньше
  не переживает PTT — отдельный фикс).
- **v1.1.58** — фича: **регулировка любой громкости** (запрос
  Pavel'я «надо вообще чтобы любую громкость регулировать»). Введён
  единый shared-хук `useMediaVolume` — общая громкость non-voice-call
  медиа (music shared-плеер + аудио-вложения / голосовые сообщения),
  module-level store с live-sync между всеми плеерами + localStorage
  + `storage`-event между вкладками. `MusicMiniPlayer` переведён на
  хук (с собственного state v1.1.57); `AudioItem` (Attachments) —
  добавлен speaker + слайдер. Теперь все 3 аудио-контура регулируются:
  **voice-звонок** (`useVoiceSettings` — per-participant + master,
  было), **музыка**, **аудио-вложения**.
- **v1.1.57** — фича: **регулировка громкости музыки** (запрос
  Pavel'я). `MusicMiniPlayer` — добавлен регулятор: speaker-кнопка
  (toggle mute, иконка отражает 3 состояния — mute / low / high) +
  `<input type=range>` (`accent-color` violet). Громкость
  client-local (каждый слушатель свою — НЕ shared session-property),
  persist в `localStorage` (`eclipse-chat:music-volume`), применяется
  к локальному `<audio>` через effect. Mute восстанавливает прошлый
  уровень.
- **v1.1.56** — **системный редизайн, инкремент 2 — top bar** (бриф
  §7 «calm tactical, не cockpit overload»). Топбар переведён с flex
  `space-between` на grid `auto / minmax(0,1fr) / auto` — три
  смысловые зоны: **left** (бренд + ServerSwitcher), **center**
  (breadcrumb «УЗЕЛ // …» — вынесен из left в `.ec-shell__top-center`,
  центрирован), **right** (telemetry + utility). Utility-иконки
  (поиск / справка / админ / фокус / инциденты / уведомления)
  приглушены в покое (`--ec-text-muted`), проявляются до `--ec-text`
  на hover; активные остаются accent. Telemetry уже декластеризован
  (slice 1). Дальше инкременты 3–8.
- **v1.1.55** — **системный редизайн, инкремент 1 — цвет-фундамент**
  (бриф Pavel'я §4–5). Старт большого редизайна (8 инкрементов).
  Identity сменена cyan → **violet** primary + **gold** premium.
  tokens.css: `--ec-accent` → `hsl(258 90% 66%)` (#8B5CF6), новый
  `--ec-accent-gold` (#D4AF37), `--ec-bg` глубже (#05070A), текст по
  брифу (#E7EAF0 / #8B93A3), `--ec-danger` → #FF4D6D, нейтральные
  border-токены, новые glass-de-box токены (`--ec-glass-*`). Свип
  всех хардкод cyan-литералов → violet: ~210 в 6 CSS-файлах + 56 в
  19 TSX-файлах (hue 195/204/205/206/207/180 → 258; S/L сохранены).
  Статус-цвета (idle-blue, exec-green, warn-amber, risk-red,
  ai-violet) и тёмные surface-серые (`hsl(200/208`) — НЕ тронуты.
  Build чист. Дальше инкременты 2–8: top bar, channels, composer,
  сообщения+медиа, tactical panel, focus/density, полиш.
- **v1.1.54** — редизайн **WS-1 slice 4 (ПРОТОТИП на ревью) —
  floating-сообщения**. Завершающий кусок WS-1. Язык: сообщение под
  курсором «всплывает» — отделяется глубиной/светом, не линией.
  `.ec-message-row:hover` — убран hover-border (`border-color
  hsl(.../0.08)`); фон → спокойный cool-tinted (без прежнего
  cyan-tinted gradient'а); тень → `--ec-elev-1` (hairline-край +
  мягкая глубина, тот же depth-токен что в slice 2) + внутренний
  highlight; добавлен `transform: translateY(-2px)` — row физически
  поднимается к курсору. Rest-state не тронут (уже лёгкий —
  borderless, без фона). AI-строки (`--ai`) и pinned сохраняют свои
  сигнальные accent-бары. ⏳ Ждёт ревью Pavel'я: подтвердит язык →
  при желании докрутка (spacing/air между группами, сила подъёма).
  **С этим WS-1 закрыт: slices 1–4 на проде.**
- **v1.1.53** — **фикс сломанного composer'а на mobile** (root cause
  давнего mobile-бага). `responsive.css` (`@media ≤1024px`) форсил
  `.ec-composer-box` в `grid-template-columns: 34px minmax(0,1fr) 38px
  !important` — 3 колонки. Но `MessageInput` рендерит **4** дочерних
  (скрепка│микрофон│textarea│отправить) — кнопку голосовой записи
  добавили позже, а responsive-правило не обновили. 4-й ребёнок не
  влезал → textarea сваливался в 38px-колонку → плейсхолдер «ВВОД
  СООБЩЕНИЯ» схлопывался в вертикальную полоску по символу, send-
  кнопка уезжала на 2-й ряд. Прежняя «заплатка» (`min-width:0` на
  `.ec-composer-textarea`) чинила симптом, не причину. Фикс:
  `grid-template-columns`-форс убран из responsive-правила (inline
  `boxStyle` в MessageInput знает точное число колонок — 4 либо 2
  для `hideAttachments`); inline `1fr` → `minmax(0,1fr)` для
  гарантированного сжатия textarea-колонки на узких экранах.
- **v1.1.52** — **фикс mobile-топбара после v1.1.51** (скриншот Pavel'я,
  Xiaomi). ServerSwitcher с именем+chevron (до 230px) + wordmark
  «ECLIPSE_CHAT» переполняли тесный мобильный топбар — элементы
  наезжали. Фикс: (1) `ServerSwitcher` получил проп `compact` —
  на mobile триггер icon-only (квадрат 36×36, без лейбла и chevron;
  имена видны в дропдауне); (2) `.ec-shell__brand-title` —
  `display:none` на ≤1024 (wordmark убран, brand-mark-иконка
  остаётся home-кнопкой). Десктоп не затронут.
  ⚠️ На скриншоте также виден сжатый composer (плейсхолдер в
  вертикальную полоску) — НЕ от этой серии правок (chat-колонка на
  mobile не менялась); вероятно давний нерешённый mobile-баг, нужен
  Chrome DevTools remote.
- **v1.1.51** — **server-rail → topbar-control** (запрос Pavel'я).
  Вертикальный far-left rail (`ServerList`) убран целиком; вместо
  него в topbar — кнопка `ServerSwitcher` (иконка + имя активного
  пространства; DM-режим → «Личные сообщения»). Клик раскрывает
  выпадающую панель со ВСЕМ содержимым прежнего rail: Главная,
  Поиск, Личные сообщения, список пространств, Создать, Вступить.
  Панель рендерится через React-portal в `document.body` —
  `.ec-shell__top` несёт `overflow:hidden` + `backdrop-filter`
  (containing-block для fixed-потомков), внутри неё popover был бы
  обрезан; portal + `position:fixed` + clamp к viewport обходят это.
  Grid: rail-колонка убрана из `.ec-shell` (база + 2 desktop-
  breakpoint'а + mobile off-canvas). Постоянный визуальный вес ↓.
  Хвост: `--ec-rail-width` токен + `.ec-server-tile`/`.ec-rail-*`/
  `.ec-shell__rail` cosmetic-CSS остались мёртвыми — отдельная
  чистка. breadcrumb «УЗЕЛ //» дублирует имя сервера со switcher'ом
  — можно подрезать.
- **v1.1.50** — редизайн **WS-1: slice 2 закрыт + slice 3 ChannelList**.
  *slice 2 — MessageList:* триаж (inline + CSS) показал — чат-зона
  состоит из чипов, сигналов, dense-rows и уже-glass floating-
  элементов; плоских `border: 1px solid`-панелей под depth-конвертацию
  здесь нет. Сами сообщения (`.ec-message-row`) — это **slice 4**.
  Искусственное изменение не вносилось → **slice 2 завершён по всем
  зонам** (8 раскаток).
  *slice 3 — иерархия левой панели:* три тира внимания в ChannelList.
  `.ec-channel-item` base-цвет `--ec-text-muted` (66%) → `--ec-text-dim`
  (50%) — спокойный «rest»-канал рецессивен («почти исчезает»). hover
  поднимает до `--ec-text`, unread (`text-strong` + 600 + cyan-badge) и
  active (gradient-bg + accent-bar + glow) уже громкие — не тронуты.
  Затемнение rest автоматически обостряет контраст всех трёх тиров.
  Найдено для будущего: на active-канале два accent-бара (`::before`
  pill + `inset 3px` box-shadow из tokens.css) — кандидат на declutter.
- **v1.1.49** — редизайн **WS-1 slice 2 — раскатка #7: OperationalTablePanel**.
  Триаж табличной зоны: сетка ячеек (thead/tbody/tfoot border'ы),
  header double-line (`border` + holo-edge — паттерн сквозной по
  всем panel-header'ам, ActionItemDrawer его сознательно оставил),
  кнопки / инпуты / чипы / drag-сигналы / статус-badge'и —
  функциональны по калибровке, оставлены. Depth-язык применён к
  единственной не-табличной floating-поверхности —
  RelationCell-dropdown'у: `border: 1px solid` + pure-black
  drop-shadow → `--ec-elev-2` (cool-tinted hairline-ring +
  глубина; бонус — уход pure-black тени на cool-tinted токен).
  Тонкий результат ожидаем: таблица legitimно использует border'ы
  как структурную сетку. **slice 2 осталось: MessageList (чат).**
- **v1.1.46** — новая волна эффектов из папки Pavel'я `Эффекты`:
  lightweight `EclipseGalaxy` без WebGL/CDN для AuthScreen и HomeToday,
  `SpiderClock` в topbar как системный live-time widget, `ThemeToggle`
  (`VOID`/`SOLAR`) с сохранением в localStorage и `DeadlineSignal` для
  задач с дедлайном. Все эффекты переписаны нативно на React/CSS, без
  GSAP/jQuery/Three.js, с поддержкой `prefers-reduced-motion`.
- **v1.1.48** — редизайн **WS-1 slice 2 — раскатка #6: ActionItemDrawer**.
  5 card/section-контейнеров drawer'а задач — `border` →
  `--ec-elev-1`. Compact dep-rows, инпуты, кнопки, accent-боксы
  оставлены. ChannelInfoPanel проверен — token-border'ов нет.
- **v1.1.47** — редизайн **WS-1 slice 2 — раскатка #5: voice-зона**.
  VoiceStatsOverlay + ParticipantContextMenu — убран дублирующий
  `border` (`--ec-shadow-modal` уже несёт hairline-ring).
  VoiceNotePanel / VoicePlaceholder / VoiceRoom-diagnostics —
  `border` → `--ec-elev-1`. Кнопки / чипы / инпуты / icon-круги
  voice оставлены (не box-in-box).
- **v1.1.25** — убран Electric Border (SVG-turbulence давал шум на
  AuthScreen terminal) + фикс AuthScreen layout + `thinking_orb` —
  вращающаяся game-иконка пока AI генерирует ответ.
- **v1.1.26** — animated rotating-ray border на AuthScreen terminal:
  conic-gradient луч обегает рамку терминала (замена Electric Border).
- **v1.1.27** — анимированная кнопка выхода (`components/LogoutButton.tsx`):
  при клике фигурка-оператор проходит сквозь дверь, створка
  захлопывается → logout. Эффект «Logout Button» из набора.
- **v1.1.28** — Active Navbar Indicator: скользящий индикатор
  активного таба sidebar (эффект «Active Navbar Indicator»).
- **v1.1.29** — parallax mouse-tilt на 7 stat-карточках HomeToday
  (`lib/tilt.ts` — `perspective rotateX/rotateY` по курсору, max 6°,
  desktop-only, respects reduced-motion). Эффект «Animated Parallax Card».
- **v1.1.30** — Animated Delete Button (`components/DeleteButton.tsx`):
  урна с откидной крышкой, «документ» падает внутрь и разрезается,
  финал — зелёная галочка. Применён к «Удалить» в Danger Zone
  ServerHubModal (owner). `confirm()` → анимация ∥ `onDelete()`.
- **v1.1.31** — Animated Password Field на AuthScreen: eye-toggle
  (slashed-eye → open-eye) + cyan scan-полоса по полю при
  переключении password↔text. `PasswordReveal` в `pages/AuthPage.tsx`.
- **v1.1.32** — parallax-tilt расширен на 5 stat-карточек TeamHealth
  (переиспользован `lib/tilt.ts`, hover-тень `.ec-lift-md` сохранена).
- **v1.1.33** — UX-copy проход (правило Codex «не продавать AI как
  фичу, продавать clarity/execution»): AI/ИИ-жаргон убран из 19
  user-facing строк. «AI-сводка» → «Сводка», «ИИ-резюме» → «Краткое
  резюме», «ИИ думает…» → «Собираем…», «AI-алерты» → «Сигналы»,
  AI-fill кнопка таблиц → «Авто», «Intelligence-панель» (на members-
  кнопке, rail упрощён до MemberList) → «Участники», и т.д. BotsTab
  (конфиг ботов) намеренно не тронут — там AI-терминология уместна.
  Стале-замечание: HelpPanel-entry «Intelligence Panel» описывает
  старую 5-таб архитектуру — нужен отдельный docs-accuracy фикс.
- **v1.1.34** — docs-accuracy: stale HelpPanel-entry «Intelligence
  Panel» (из v1.1.33-замечания) исправлен. Карточка описывала
  несуществующую 5-таб архитектуру rail'а. Заменена на 2 точные:
  «Информация о комнате» ((i)-кнопка → 4 таба Сводка/Память/Дела/
  Файлы) + «Участники» (правый rail = MemberList). Проверено по
  коду: ChannelInfoPanel `ChannelInfoTab` + IntelligencePanel.

- **v1.1.35** — дизайн-полиш **Wave 1** (чистка warm-цветов).
  Проведён 4-зонный дизайн-аудит (чат / модалки / voice / панели,
  4 параллельных агента) — ~60 находок. Wave 1 закрыл системное
  нарушение холодного правила: 13 мест с сырым оранжевым/янтарным
  `hsl(28–47°)` и хардкодом `#e6c45e` переведены на санкционированные
  `--ec-status-*` / `--ec-warn` токены (MessageList pinned+DECISION-
  tint, RichContent self-mention, TeamHealth stat-карточки +
  blockedChip, OperationalTablePanel TASK_STATUS_TONE, VoiceNotePanel
  conflict-banner, VoiceStatsOverlay + VoiceSettingsModal VU-метры,
  IncidentPanel pinned-блок, BotsTab key-alert, AdminInvoicesTab
  STATUS_TONE, ComposioConnections). Wave 2 (битые/незаконченные
  места: голые кнопки → `.ec-btn`, мёртвый код) + Wave 3
  (консистентность: токены типографики, унификация stat-карточек /
  section-label, `focus-visible`) — в очереди.

- **v1.1.36** — дизайн-полиш **Wave 2** (битые/незаконченные места).
  Голые браузерные кнопки → `.ec-btn` (MessageInput voice-recorder
  «Отмена»/«Готово», CreateGroupDmModal footer — теперь с hover /
  focus-visible / disabled из дизайн-системы). Удалён мёртвый код
  `(isHost || true)` в MusicMiniPlayer + неиспользуемый проп
  `currentUserId` (skip/stop видны всем, права проверяет backend).
  Удалены ad-hoc `submitBtn` / `cancelBtn` стили. Wave 3
  (консистентность: токены типографики, унификация stat-карточек /
  section-label, `focus-visible`, `#fff` → токен) — в очереди.

- **v1.1.37** — дизайн-полиш **Wave 3** (чистка хардкод-hex цветов).
  27 мест с сырым hex → токены, нулевое визуальное изменение
  (hex = точное значение токена): redundant-fallback
  `var(--ec-accent-text, #fff)` → `var(--ec-accent-text)` (×13),
  сырой `color: "#fff"` → `var(--ec-accent-text)` (×12, текст на
  accent/danger-фоне), `#070b0f` → `var(--ec-void)`, `#e8e8ed`
  fallback убран. Legit `#fff` фон QR-кода (TwoFactorSetupModal)
  оставлен.

- **v1.1.38** — редизайн **WS-1 «Облегчение» slice 1**: declutter
  телеметрии. Top-bar по принципу progressive disclosure: pill
  «СЕТЬ» виден всегда, ПАМ/ЦП свёрнуты в `.ec-telemetry`-группу —
  разворот по hover ИЛИ авто при warn/risk (проблема всплывает
  сама). mem/cpu продублированы в title СЕТЬ-pill. Постоянный
  визуальный вес топ-бара ↓ (3 pill → 1).

- **v1.1.39** — редизайн **WS-1 slice 2 (ПРОТОТИП на ревью)**:
  «язык разделения» через глубину/свет вместо линий. Новые токены
  `--ec-edge` / `--ec-elev-1` / `--ec-elev-2` (почти-невидимый
  hairline-край + мягкая тень глубины — замена `border: 1px solid`).
  Применён к эталонной зоне **HomeToday**: у stat-карточек и строк
  убран видимый border — отделяются глубиной (accent-bar +
  elevation-тень), hover = подъём по тени, без accent-рамки.
  ⏳ Ждёт ревью Pavel'я: подтвердит язык на HomeToday → раскатка
  токенов `--ec-elev-*` на остальные ~150 bordered-мест (slice 2
  rollout), затем slice 3 (иерархия левой панели) + slice 4
  (лёгкие сообщения).
- **v1.1.40** — редизайн **WS-1 slice 2 — раскатка #1: TeamHealth**.
  «Язык разделения» распространён на дашборд «Здоровье команды»:
  у stat-карточек и overload-строк убран `border: 1px solid` —
  отделяются `--ec-elev-1`-тенью, hover-строк = подъём по
  `--ec-elev-2`. Консистентно с HomeToday (dashboard-family).
  Раскатка идёт зона-за-зоной (Pavel смотрит параллельно);
  значения языка токенизированы — правка `--ec-elev-*` в одном
  месте подхватится везде.

- **v1.1.41** — фикс **страницы входа: центровка**. Причина —
  устаревший `.ec-auth-shell` (grid-раскладка СТАРОЙ auth-страницы
  до cinematic-rewrite v1.1.14) оставался в components.css и,
  импортируясь после tokens.css, перебивал правильный
  `position:fixed; flex-center` → logo + терминал уезжали в
  левый-верхний угол, форма обрезалась. Удалён весь мёртвый
  old-auth CSS-блок (components.css 1403–2599, ~1200 строк:
  `ec-auth-page` / `hero` / `panel` / `feature` / `preview` /
  `board` — подтверждено 0 использований в tsx). AuthScreen снова
  центрирован. Бонус: CSS-бандл **126.5 → 103.9 KB** (−22.6 KB
  raw / −3.8 KB gzip).

- **v1.1.42** — фича: **смена пароля в профиле**. Endpoint
  `POST /api/auth/change-password` (JWT + rate-limit 10/15 мин):
  проверка текущего пароля (bcrypt), запрет совпадения нового с
  текущим, новый по правилам регистрации (8+, буквы + цифры).
  Успех инвалидирует все refresh-токены (защита от компрометации)
  и сразу выдаёт текущему устройству свежую пару — оно не
  вылетает, остальные сессии завершаются. Аудит `AUTH_PASSWORD_
  CHANGE` (enum уже был — миграция не нужна). Frontend — хук
  `useChangePassword` + collapsible-секция «Пароль» в ProfileModal
  (3 поля, клиент-валидация зеркалит backend).

- **v1.1.43** — редизайн **WS-1 slice 2 — раскатка #2: StatusBoard**.
  «Язык разделения» на kanban-доске: у column'ов и task-карточек
  убран `border: 1px solid` → `--ec-elev-1`-тень. Drop-target
  колонки = подъём по `--ec-elev-2` (cool-tinted край) вместо
  смены border-color. Dashboard-family (HomeToday + TeamHealth +
  StatusBoard) переведён на depth-разделение.

- **v1.1.44** — редизайн **WS-1 slice 2 — раскатка #3: info-панели**.
  Depth-язык на IncidentPanel (incidentCard + post-mortem-боксы;
  OPEN-инцидент сохраняет danger-рамку как статус-сигнал, hover =
  подъём по `--ec-elev-2`) и ChannelDigestPanel (wrap + statCard).
  Откалибровано: панели/карточки → глубина; инпуты, dense-rows
  (`itemRow`), функциональные/сигнальные border'ы оставлены.

- **v1.1.45** — редизайн **WS-1 slice 2 — раскатка #4: модалки**.
  `Modal.tsx` — убран дублирующий `border` (`--ec-shadow-modal`
  уже несёт hairline-ring + глубину). `ProfileModal` —
  `avatarSection` (карточки avatar / 2FA / push / пароль) на
  `--ec-elev-1`; секции 2FA/push переключают elev-1 ↔ elev-2 как
  enabled-сигнал вместо accent-border.

> **Дизайн-аудит — хвост.** Waves 1–3 закрыли все P1 + ключевые
> P2 (warm-цвета, битые места, хардкод-hex). Остаток аудита —
> нормализация typography-шкалы (`0.55–0.7rem` → токены),
> унификация `.ec-btn` / stat-карточек / section-label в
> переиспользуемые компоненты, системный `focus-visible`,
> backdrop-токен — это **refactor-объём**, рекомендован отдельным
> focused-проходом, не массовой косметической правкой.

> Backlog CSS-эффектов из набора Pavel'я **закрыт** (v1.1.22–v1.1.32).
> Остаток набора — standalone-демки (галактика / 404 / паук-часы),
> не применимы к продукту.

---

## Карта функционала — срез 20.05.2026 (Pavel)

> Полный feature-status по 17 направлениям. Сверено с кодом —
> точно. ✅ done · 🟡 partial · ❌ нет.

1. **Core chat** ✅ — markdown/code/replies/reactions/edit/delete/
   pin/embeds/uploads/media-viewer/voice-msg/drag&drop/unread/
   draft-sync/threads/audio-waveforms.
2. **Workspaces & rooms** ✅ — TEXT/VOICE/BROADCAST/EXECUTION/
   temporary/focus/client. ❌ AI-rooms как отдельный тип.
3. **Role system** ✅ — 10 ролей + 20-perm matrix, AdminPanel viewer.
   ❌ AI-Agent/Observer роли. 🟡 glow/live-states. ❌ phase 2
   (custom roles / editable RBAC).
4. **Tables** 🟡 — 8 field-types/realtime/RBAC/aggregations/AI-fill/
   row→ActionItem. ❌ formulas/filters/sorting, pre-built types,
   AI-classify.
5. **AI agents** 🟡 reactive-only — 7 bot-ролей + mention-responder.
   ❌ background-tasks по ролям (proactive).
6. **Bot builder** 🟡 — AutomationRule JSON (3 actions). ❌ visual
   node-editor.
7. **Execution** ✅ — msg→task/decision/follow-up, kanban,
   priorities/due/assignees, DAG, approvals, escalation+AI-summary.
8. **AI memory** 🟡 single-room — embeddings/semantic-search/
   since-last-visit/portal-digest. ❌ cross-room knowledge graph,
   agent-memory.
9. **Voice** ✅ — live/noise-suppr/screen-share/video/music/whisper/
   AI-extract/notepad. ❌ recording(Egress), live-summaries,
   whiteboard(yjs blocked).
10. **Client portals** ✅ — CLIENT-mode/hash-route/progress/
    approvals/invoices. ❌ PDF-reports(pdfkit blocked), public
    token-access, email.
11. **Admin panel** 🟡 — 7 tabs + audit + analytics. ❌ AI-controls,
    moderation queue, AI-usage analytics.
12. **Automation** 🟡 — MESSAGE_NEW trigger + 3 actions + 2/10
    интеграций (Telegram/GitHub). ❌ др. triggers/actions/
    интеграции.
13. **Design & UX** ✅ — calm operational UI, motion-suite, adaptive
    room modes. (Идёт редизайн WS-1 — см. design-vision выше.)
14. **Mobile** ✅ — responsive + PWA + push (5 triggers). ❌ offline
    queue, native shell (Capacitor).
15. **Operational dashboard** ✅ — Home «СЕГОДНЯ» 7 stat-cards.
    ❌ cross-workspace blockers, live socket-updates (manual reload).
16. **Advanced** 🟡 — focus/temporary rooms. ❌ per-room health,
    replay timeline.
17. **Long-term** ❌ — agent/workflow marketplace, industry runtimes.

---

## Дизайн-vision Pavel (20.05.2026) — «Communication OS»

> **Источник истины** по направлению редизайна. Pavel прислал
> развёрнутый vision. Формула цели:
> **Discord focus + Linear cleanliness + Notion calmness +
> Sci-fi atmosphere + Operator workflow logic.**

**Главный диагноз (подтверждён дизайн-аудитом):** UI визуально
тяжёлый — box-in-box, много границ и постоянного chrome, много
конкурирующих зон внимания → когнитивная нагрузка, нет «потока».

**Принцип-разрешение** (в vision есть противоречие «Часть 1
добавить» vs «Часть 2 убрать»): **progressive disclosure** —
ёмкость растёт, постоянный визуальный вес падает. Ведём по
Части 2 (уточнённый тезис).

**4 рабочих потока:**

- **WS-1 «Облегчение»** — borders → depth/blur/glow, иерархия
  левой панели (active ярко / rest почти исчезает), лёгкие
  «floating» сообщения, declutter телеметрии, снижение
  cognitive load. Фундамент. ← **выбран первым.**
- **WS-2 Контекст** — Focus Chat Mode (панели гаснут в потоке
  чтения/набора), adaptive density (Compact / Balanced /
  Tactical), contextual UI (voice / AI / tasks меняют layout).
- **WS-3 Атмосфера** — живой фон (subtle dust / orbital
  gradients, НЕ cyberpunk-neon), символы каналов по типу,
  участники-«узлы сети», empty-state eclipse-orb, system-
  сообщения в стиле терминальных событий («SYSTEM // …»).
- **WS-4 Communication OS** — сообщение → задача / голосование /
  AI-prompt / workflow-node / заметка / execution-block.

**Custom emoji** (статусы / роли / задачи / атмосфера / реакции;
тёмная база + violet/gold + glow; PNG 128/64/32 + SVG) —
отдельный asset-трек (генерация через Gemini), идёт параллельно.

**Изменения v1.1.19 → v1.1.24:**

- **v1.1.19** — CI: `paths-ignore` в deploy-prod.yml — docs-only
  коммиты больше не триггерят deploy (убрана путающая красная
  «cancelled» история).
- **v1.1.20** — mobile: убран промежуточный планшетный 3-кол режим,
  всё ≤1024px = single-column + drawers (breakpoint 900→1024).
- **v1.1.21** — ВРЕМЕННЫЙ viewport-diagnostic badge (mobile debug,
  удалён в v1.1.22).
- **v1.1.22** — game-иконки в empty states. 22 PNG в
  `public/game-icons/`, `lib/gameIcons.ts` helper, EmptyIcons
  переписан (eclipse_core / task_pin / bug_core / data_shard /
  bot_eye / void_signal / focus_ring / gold_orbit). `.ec-game-icon`
  — cyan drop-shadow + breathing-float.
- **v1.1.23** — Electric Border на AuthScreen terminal. SVG
  turbulence filter `#ec-electric` (инжектится 1× в App.tsx,
  numOctaves 3, scale 18). `.ec-electric-border` overlay из 3
  слоёв (line + 2 glow). Terminal clip-path → border-radius.
- **v1.1.24** — role game-иконки в MemberList: OWNER→owner_crown,
  ADMIN→admin_rune, MODERATOR→mod_shield. `.ec-role-icon` 15px.

**⚠️ Mobile layout — НЕ решён.** v1.1.13/17/18/20 — серия попыток
(breakpoint 640→900→1024, specificity fix, !important). Pavel:
телефон на v1.1.21 всё равно показывает cramped layout. Диагностика
неубедительна (badge не дал данных). ОТЛОЖЕНО — нужен device-side
debug (DevTools remote / точная CSS-ширина viewport'а).

**Изменения v1.1.18 (mobile bug — настоящая причина):**

Pavel: «не помогло, всё так же криво» — даже в incognito (чистая
загрузка). Это доказало: баг НЕ в SW-кэше, а в самом CSS.

Root cause — CSS specificity:
- base `.ec-shell:not(.ec-shell--has-server)` = (0,2,0)
- mobile media-query `.ec-shell` = (0,1,0)
- Media-queries не добавляют specificity → base перебивал
  media-query → grid НЕ сворачивался для shell без активного
  сервера → rail+channels перекрывали chat.

v1.1.13/.16/.17 breakpoint-правки били мимо — media-query всё
равно проигрывал по специфичности.

Fix: оба media-блока (900 mobile + 1024 tablet) — селектор
перечисляет все 3 формы (`.ec-shell` / `.has-server` /
`:not(.has-server)`) + `!important` на grid-template-*.
Media-query теперь всегда выигрывает.

**Изменения v1.1.17:** mobile breakpoint 640 → 900 (нужно но
недостаточно — specificity bug оставался).

**Изменения v1.1.16:** SearchOverlay cyber polish.

**Предыдущие версии:** v1.1.15 (SW update delivery fix), v1.1.14
(cinematic AuthScreen), v1.1.13 (mobile topbar overflow fix).

**Изменения v1.1.17 (mobile bug fix):**

Pavel: «не могу отправить сообщение — экран перекрыт меню слева».
Screenshot — rail + channels + chat все side-by-side, composer
сжат в узкую полосу.

Root cause: mobile breakpoint был 640px. Телефон Pavel'я даёт
CSS-viewport в диапазоне 640-1024px → срабатывал «tablet»
3-колоночный layout. На телефонной ширине → chat squeeze.

Fix: mobile/phone breakpoint **640 → 900px** синхронно:
- responsive.css — 4× `@media (max-width: 640px)` → 900
- useMediaQuery.ts `useIsMobile` → 900
- AppShell.tsx inline isMobile → 900
- tokens.css `--ec-bp-mobile` → 900

Новая раскладка: ≤900 phone (single-column + drawers) /
901-1024 tablet / >1024 desktop.

**Изменения v1.1.16:**

SearchOverlay cyber polish — cipher input + holo header +
glowing icon + monospace tabs.

**Предыдущие версии:** v1.1.15 (SW update delivery fix), v1.1.14
(cinematic AuthScreen), v1.1.13 (mobile topbar overflow fix).

**Изменения v1.1.16:**

SearchOverlay (Ctrl+K операционный поиск):
- Search input — monospace JetBrains Mono + 0.02em tracking,
  placeholder «ЗАПРОС_ПОИСКА // сообщения · задачи · файлы…»
- Input wrap header — darker bg + `.ec-server-header-edge` holo
  bottom line
- Search icon — cyan accent + 4px drop-shadow glow
- Result tabs (Сообщения/Задачи/Файлы) — monospace 0.65rem 0.14em
  uppercase cipher

**Изменения v1.1.15 (critical fix):**

SW update delivery fix — телефон Pavel'я застрял на старом bundle
11 версий. Root cause: banner reload перехватывался SW + не было
periodic `reg.update()`. Fix: `hardReload()` (unregister SW +
clear caches) + `setInterval(reg.update, 60s)`.

**Предыдущие версии:** v1.1.14 (cinematic AuthScreen rewrite),
v1.1.13 (mobile topbar fix), v1.1.12 (OperationalTablePanel).

**Изменения v1.1.15 (critical bug fix):**

Root cause — телефон Pavel'я застрял на старом bundle:
1. **Banner reload перехватывался SW.** App.tsx update-banner
   кнопка «ПЕРЕЗАГРУЗИТЬ» делала `window.location.reload()` —
   но это НЕ обходит Service Worker (navigation идёт через SW
   fetch handler). Застрявший старый SW вечно отдавал старый
   bundle.
2. **main.tsx никогда не перепроверял sw.js.** SW регистрировался
   один раз без периодического `registration.update()`. Mobile
   Chrome не перепроверял sw.js неделями если вкладка живёт долго.

Fix:
- **App.tsx `hardReload()`** — banner-кнопка теперь: unregister
  ВСЕ SW → clear ВСЕ caches → reload. Чистый fetch без
  SW-перехвата.
- **main.tsx** — `registration.update()` сразу + `setInterval`
  каждые 60s. Форсит mobile Chrome ловить новый sw.js.

nginx уже отдаёт sw.js с `no-cache, must-revalidate` (verified
на проде) — конфиг был правильный, проблема была чисто
client-side.

**Изменения v1.1.14:**

Полный rewrite AuthPage → cinematic multi-step AuthScreen
(credentials → 2FA keypad → success) с HUD shell, radar bg,
tactical corners. См. commit 670c56e.

**Предыдущие версии:** v1.1.13 (mobile topbar overflow fix),
v1.1.12 (OperationalTablePanel polish), v1.1.11 (ActionItemDrawer
+ ThreadPanel).

**Изменения v1.1.14:**

Полный rewrite AuthPage (single-page board → HUD-style terminal
со step-flow credentials → twofa → success).

**Shell:**
- Rotating radar grid bg (concentric rings 90s spin + 64px grid
  + crosshairs)
- 4 viewport tactical corner brackets (64×64 L-shapes)
- Top HUD: «СЕТЬ ECLIPSE … POS+СИНХР+T» (fake telemetry 1.2s)
- Bottom HUD: «● ЗАЩИЩЁННАЯ СВЯЗЬ АКТИВНА … ВЕРСИЯ 1.0.0.99»
- Eclipse logo (pure-CSS square frame + radial eclipse symbol +
  breathing aura)
- ECLIPSE title (Orbitron + shimmer) + ПРОТОКОЛ_ШЛЮЗА_V1.0
- Central terminal box cut-corner clip-path + cyan/violet accent
  bars

**Step credentials:** lock icon + Вход/Регистрация toggle +
monospace fields (Личность оператора / Секретный код / Имя) +
ПРОДОЛЖИТЬ slide-fill button.

**Step twofa:** shield icon + 6 pin slots (blinking caret) +
3×4 numeric keypad (auto-submit) + RECOVERY-КОД переключатель.

**Step success:** unlock icon + pinging green ring + ДОСТУП
РАЗРЕШЁН.

Auth API (onLogin/onRegister/2FA/recovery) сохранена без
изменений — только presentation layer переписан.

**Сборка**: 6 files, +1055/-418. CSS bundle 100.59 → 112.98 KB
raw (+12.4 KB), gzip 18.75 → 20.74 KB. Old `.ec-auth-board-*` /
`.ec-auth-preview*` classes теперь dead (cleanup отдельно).

**Изменения v1.1.13 (mobile fix):**

Pavel прислал screenshot с телефона: telemetry pills съедали
topbar. responsive.css fix:
- < 900px: hide ПАМ + ЦП pills
- < 640px: hide ВСЕ telemetry pills + breadcrumb
- < 480px: hide brand-title text

**Предыдущие версии:** v1.1.12 (OperationalTablePanel cyber
polish), v1.1.11 (ActionItemDrawer + ThreadPanel), v1.1.10
(ChannelInfoPanel + IntelligencePanel).

**Изменения v1.1.13 (mobile fix):**

Pavel прислал screenshot с телефона: pills СТАБИЛЬНА / ПАМ 11% /
ЦП 23% доминировали topbar, ECLIPSE_CHAT brand-title обрезан,
breadcrumb «УЗЕЛ //» не виден.

Root cause: v1.1.7 telemetry pills + v1.1.4 breadcrumb cyber
добавлены без mobile breakpoints.

Fix (responsive.css):
- **< 900px**: hide ПАМ + ЦП pills (оставляем только СЕТЬ
  индикатор)
- **< 640px**: hide ВСЕ telemetry pills + весь breadcrumb (он
  дублируется в chat-header sticky-bar)
- **< 480px**: hide brand-title text (остаётся только icon)

CSS bundle 100.15 → 100.59 KB (+0.44 KB).

**Изменения v1.1.12:**

OperationalTablePanel (таблицы) cyber polish:
- header `.ec-server-header-edge` + darker bg
- titleInput uppercase 0.08em display font (Orbitron)
- thStyle (column headers) monospace 0.6rem 0.16em JetBrains Mono
- Table icon в header → cyan drop-shadow glow (4px halo)

CSS bundle unchanged.

**Изменения v1.1.11:**

ActionItemDrawer (детали задачи):
- header `.ec-server-header-edge` + darker bg
- sectionLabel monospace 0.65rem 0.18em + display:flex для diamond
- 4 sections с color-coded ◆ diamond prefix:
  - «Название» cyan
  - «Свойства» cyan
  - «Одобрение» warn-yellow
  - «Описание» cyan

ThreadPanel (thread replies overlay):
- header `.ec-server-header-edge` + darker bg
- headerLabel monospace 0.65rem 0.18em
- Title «Тред» → «ТРЕД_ОБСУЖДЕНИЯ» (cyber framing)
- Reply count → cyan bordered pill (accent-soft bg + accent
  border, consistent с IntelligencePanel count badge)
- Thread icon → cyan accent
- separator monospace 0.6rem 0.18em

**Предыдущие версии:** v1.1.10 (ChannelInfoPanel +
IntelligencePanel cyber polish — продолжение polish track по
Pavel «продолжай»).

**Изменения v1.1.11:**

**ActionItemDrawer** (детали задачи):
- header `.ec-server-header-edge` (holo bottom-line) + darker bg
- sectionLabel monospace 0.65rem 0.18em + display:flex для diamond
- 4 sections получили color-coded ◆ diamond prefix:
  - «Название» cyan
  - «Свойства» cyan
  - «Одобрение» warn-yellow
  - «Описание» cyan

**ThreadPanel** (thread replies overlay):
- header `.ec-server-header-edge` + darker bg
- headerLabel monospace 0.65rem 0.18em
- Title «Тред» → «ТРЕД_ОБСУЖДЕНИЯ» (cyber framing)
- Reply count → cyan bordered pill (accent-soft bg + accent
  border, consistent с IntelligencePanel count badge)
- Thread icon → cyan accent
- separator monospace 0.6rem 0.18em

**Сборка**: 6 files changed, +43/-22. CSS bundle unchanged 100.15
KB (existing classes + inline tweaks).

**Предыдущие версии:** v1.1.10 (ChannelInfoPanel +
IntelligencePanel cyber polish — продолжение polish track по
Pavel «продолжай»).

**Изменения v1.1.10:**

**ChannelInfoPanel** (открывается через (i) в chat-header):
- 4 tabs (Сводка / Память / Дела / Файлы) → `.ec-hud-tab` class
  (top-fade gradient + 2px glowing bottom bar)
- tabBtn — fontSize 0.62rem, letter-spacing 0.16em, JetBrains Mono
- borderBottom inline удалён (handled через hud-tab::after pseudo)

**IntelligencePanel** (правый rail с members):
- header → `.ec-server-header-edge` class (1px holographic bottom
  gradient line)
- headerStyle bg slightly darker (hsl 210 25% 4% / 0.55)
- headerLabel «ТАКТИЧЕСКИЙ ВИД» — monospace 0.62rem 0.18em,
  text-muted color
- headerCount «N/M» — violet badge (accent-3 на soft bg с violet
  border) consistent с `.ec-tactical-header__count`
- IconMembers color violet (accent-3) consistent с MemberList
  tactical-header icon (v1.1.4)

**Сборка**: 6 files changed, +33/-20. CSS bundle unchanged 100.15
KB (existing classes + inline tweaks).

**Предыдущие версии:** v1.1.9 (StatusBoard + TeamHealth
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

- **🆕 Лендинг Eclipse Chat (`/eclipse-chat/` без авторизации)** —
  публичная маркетинговая страница: hero + ценностные блоки + форма
  регистрации/входа inline (а не сразу AuthPage за gate'ом). Сейчас
  заход на `/eclipse-chat/` неавторизованным юзером сразу даёт
  AuthPage (биометрический шлюз → credentials). Нужен промежуточный
  лендинг: что такое Eclipse Chat / для кого / call-to-action
  «Войти» + «Создать аккаунт» с inline-формой. **Делает Pavel через
  Codex** — заведено как параллельный трек.
- **🆕 nginx trailing-slash редирект на проде** — `app.star-crm.ru/
  eclipse-chat` (без `/`) сейчас отдаёт 200 + 24 KB HTML — это
  404-страница главного сайта star-crm.ru (его SPA-router ловит
  unknown route). `app.star-crm.ru/eclipse-chat/` (со `/`) работает
  как надо. Фикс на стороне nginx (вне репозитория Eclipse Chat):
  `location = /eclipse-chat { return 301 $scheme://$host/eclipse-chat/; }`
  Однострочник, точечный exact-match.
- **🆕 «Ссылка входа не открывается у некоторых» — расследование** —
  у одних пользователей `/eclipse-chat/` открывается, у других —
  нет. Кандидаты на причину: (а) trailing-slash issue выше, (б) sw.js
  cache stale, (в) deep-link генерация без `/` в invitation URLs /
  share-links / магазинной иконке, (г) браузерная нормализация URL,
  (д) промежуточные прокси/CDN. Открыто в текущей сессии.
- **E2E-шифрование (DM + приватные каналы)** — крупный отдельный
  трек, заведён после integrity-фикса v1.1.90. Сейчас E2E нет:
  сервер хранит сообщения открытым текстом и читает их (ярлык
  композера с v1.1.90 честно говорит «TLS», не «E2E»). Цель —
  настоящее сквозное шифрование для DM и приватных каналов
  (референс — GoofCord, github.com/Milkshiift/GoofCord,
  privacy-by-default). Объём: клиентская криптография, управление
  ключами (генерация, обмен, ротация устройств), DB-схема под
  публичные ключи + миграция, политика для истории сообщений,
  ограничения для серверных фич (поиск, AI-память, боты не смогут
  читать E2E-контент). Многосессионный трек — начинать с
  архитектурного плана.
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
