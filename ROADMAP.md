# Eclipse Chat — Roadmap

> **Источник истины** по Eclipse Chat: позиционирование, текущее состояние,
> фазы, версии в проде, открытые направления. Стоит отдельно от
> `E:\projects\ROADMAP.md` (общий cross-repo лог Pavel'ового монорепо).
> Любая фича, которой нет в текущем коде, попадает сюда.

**Текущая версия:** **v1.3.4** (premium SaaS pivot per Pavel verdict
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

**Изменения v1.1.25 → v1.3.4:**

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
