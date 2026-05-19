# Eclipse Chat — Futuristic Redesign Brief

> **Для:** Google AI Studio / Stitch / Gemini Pro Vision / любой UI-design AI
> **Задача:** редизайн existing operational chat platform в **максимально футуристичный visual language** — calm cinematic sci-fi, не cluttered, не gamer.
> **К промпту приложен:** `current-state.html` — структурный снимок существующих экранов с inline styles и комментариями. AI должен использовать его как baseline и предложить evolution, не полный rewrite.

---

## 0. TL;DR для AI

Eclipse Chat = **operational collaboration infrastructure** (Discord × Telegram × Linear × Notion × AI Workspace). Live в проде по адресу `app.star-crm.ru/eclipse-chat`. У продукта уже есть calm dark theme, но Pavel (owner) хочет **next-level futuristic** дизайн — like операционный центр космического корабля, не игровая консоль.

Сделай предложение по визуальной эволюции. НЕ trash existing UX architecture (sidebar tabs / chat-area / right rail / hover-buttons работают). **Эволюционируй визуал, layering, motion, micro-detail.**

---

## 1. Product positioning (фиксировано)

**Eclipse Chat = operational collaboration infrastructure.**

Формула: **communication + execution + AI + memory + workflows.**

**НЕ продаём:** AI-powered, gamer chat, enterprise.
**Продаём:** clarity / calmness / execution / coordination / operational visibility.

Целевая аудитория: AI-first teams, operators, agencies, startups, internal business teams, automation-heavy companies.

UI должен ощущаться как: **командный центр операций**, не chat app. Spaceship bridge, не Discord server.

---

## 2. Brand constraints (НЕ менять — это identity)

### Цвет

| Token | Hex | Use |
|---|---|---|
| `--ec-bg` | `#07090D` | основной фон (layered black, deepest) |
| `--ec-surface-1` | `#0B0F14` | первый surface слой |
| `--ec-surface-2` | `#11161D` | hover / selected |
| `--ec-surface-3` | `#141A22` | input / elevated |
| `--ec-accent` | `hsl(195 70% 60%)` ≈ `#5db5d9` | **cool sky cyan — главный accent. НИКОГДА warm orange!** |
| `--ec-status-exec` | green | execution / done |
| `--ec-status-warn` | amber | warnings / pending |
| `--ec-status-risk` | red | overdue / critical |
| `--ec-status-ai` | violet | AI / agent-related |
| `--ec-status-idle` | muted blue | idle / waiting |

**Запрет:** warm orange (`#FF6B35`, `#F38B26` и т.п.), tropical neon (acid green / hot pink), gradient rainbow.

### Темная тема — обязательная

Только dark mode. Light mode не нужен. **layered blacks** (4 уровня выше). Контраст с тёплыми surface'ами (как у `discord.com` warm gray) — не делать.

### Типографика

Sans-serif. Уже используется UI font stack (`-apple-system, "SF Pro Display", ...`). Russian language first-class. UPPERCASE labels с `letter-spacing` для section headers.

### Motion language

Уже есть кастомные utility classes:
- `.ec-lift-md` — premium card-lift -3px on hover + atmospheric shadow + cyan inner-border refraction
- `.ec-press` — short scale(0.97) click feedback
- `.ec-avatar-glow` — cyan limbus ring breathing 4s
- `.ec-shimmer-text` — background-clip gradient для AI generation
- `.ec-reveal-cascade` — stagger 30ms reveal для lists
- `.ec-signal-dot` — pulsing live indicator
- `.ec-telemetry-edge` — radar-edge glow

**Respect** `prefers-reduced-motion: reduce` через `--ec-dur-*` tokens (180ms → 1ms).

---

## 3. Что хочется добавить (futuristic vocabulary)

Это направления для AI чтобы предложить:

### Visual depth

- **Glassmorphism layers** — subtle (не Apple-overdo). Frosted panels поверх MessageList, semi-transparent с `backdrop-filter: blur(20px) saturate(180%)`.
- **Atmospheric depth** — каждый layer (rail / channels / chat / members) имеет parallax-like distance feel через blur + opacity + box-shadow gradients.
- **Holographic edges** — accent-coloured 1px borders с inner glow, как HUD interface.

### Data visualization prominence

- **Live telemetry strips** — мини-charts по краям экрана: activity heatmap, channel pulse, AI agent throughput. Не obnoxious, не Slack-style notification spam — calm radar.
- **Flow lines** — subtle SVG paths connecting related items (linked message → action item → table row). Visible on hover, fade-out otherwise.
- **Pulse signatures** — live channels emit subtle radial pulse в sidebar, как radar contacts.

### Iconography

- Geometric line-icons (already partial — 14px SVG monoline). Make them **more architectural** — wireframe constructions, isometric hints для system-related icons (servers / tables / automation).
- Avoid emoji-heavy approach for status. Use SVG glyphs с cyan accent.

### AI-specific surfaces

- **Thinking states** — когда AI generating, не «загружаем…» dot-loader. Use:
  - Animated cipher / shimmer effect на text placeholder
  - Wireframe brain pulse в avatar
  - Frequency wave indicator
- **AI provenance** — каждое AI-generated message имеет subtle holographic ribbon показывающий: provider / model / latency / confidence. Hover для full meta.

### Empty states

Уже есть calm line-art SVG icons. Эволюционируй в **3D wireframe constructions** — низкополигональные геометрические структуры (cube grid, tower, satellite dish). Single accent cyan stroke. Никаких персонажей / cute mascots.

### Micro-detail

- Scrollbar dvars — custom thin (4px) с cyan accent on hover.
- Focus rings — multi-layer ring (2px solid accent + 4px halo + 1px crisp inner).
- Loading shimmer — diagonal cyan sweep across skeleton.
- Cursor states — explicit `cursor: grab / grabbing` на DnD-able items.

---

## 4. Specific screens to redesign

Priority order. Each — produce mockup + key changes от current state (см. `current-state.html`).

### 4.1 Login / Auth screen (HIGH)

Currently — простая центрированная forma. Хочется:
- Background — animated nebula / star field (subtle, не distracting), generated procedurally в CSS / SVG
- Logo — geometric monogram (existing `.ec-brand-mark`), маленькая holographic ring breathing вокруг
- Form — frosted panel с inner-glow border
- "2FA" prompt — sci-fi keypad with monospace digits

### 4.2 AppShell — main operational view (HIGHEST)

The most-seen screen. Current 4-column grid:
```
| rail 68 | sidebar 248 | chat (1fr) | members 248 |
```

Хочется (preserve column structure, evolve visual):
- **Top bar** — keep height 54px, add subtle bottom border с holographic gradient
- **Rail (left ASCII narrow)** — server tiles get inner-cube depth, hovered/selected get rotation hint
- **Sidebar (channels)** — section headers с small constellation-glyph next to count badge. Active channel — left-border accent with breathing pulse
- **Chat area** — center stage. MessageList retains current density but message rows get subtle holographic edge on hover. Bot messages get distinct cyan-violet ribbon (provider provenance)
- **Members rail** — keep as-is (already simplified в v0.96). Add live activity ring around avatar (breathing if speaking in voice)

### 4.3 ChannelInfoPanel (slide-down from chat-header, v0.96)

Currently slim panel занимает ~48vh. 4 tabs (Сводка / Память / Дела / Файлы).

Хочется:
- Slide-in animation — не straight slide, а **focus shift** (current chat dims behind frosted glass)
- Tab transitions — content morphs (not snap)
- Стат в "Сводка" — live charts / sparklines, не таблица текста

### 4.4 ChatHeaderHoverButton popovers (v0.98)

Currently 320px popover с list of pinned/tasks. Хочется:
- Popover border — holographic gradient instead of solid 1px
- Item cards — stacked depth (Z-axis: each card slightly forward)
- Hover preview — peek expansion (height grows on long-hover)

### 4.5 ServerHubModal (v0.97)

Tabbed modal (Обзор / Оформление / Настройки / Боты). 4 tabs at top.

Хочется:
- Modal entry — material zoom-in with backdrop blur (already есть, polish timing)
- Tab transitions — sliding underline indicator with motion blur trail
- "Обзор" — info card grid с metric-glyph icons (channels / members / created дата) — make these into mini-HUD blocks
- "Оформление" tab — color picker upgrade: HSL slider tracks с live gradient, brand-color preview as full-shell theme demo

### 4.6 BotsTab v1.0 (NEW)

Per-bot card с inline panels (Промпт / Тест / Стата / Webhook).

Хочется:
- Bot avatar — geometric initial с breathing cyan glow
- Role chip — holographic gradient instead of flat fill
- "Тест" panel response area — terminal-like with cursor blink + typing animation effect
- "Стата" stat cards — sparkline behind big number (delta indicator green/red)

### 4.7 Operational Tables (data-heavy)

Currently dense rows. Хочется:
- Column headers — sticky + holographic top-border gradient
- Cell types — different visual depth per type (NUMBER monospace, STATUS chip с tone-aware glow, USER avatar + name)
- Aggregations footer — fixed bottom, treat as HUD metric strip
- AI-fill button — pulsing accent ring when row has empty fillable cells

### 4.8 Voice Room

LiveKit multi-camera grid + dock + intelligence rail.

Хочется:
- Speaker tile — active speaker gets full holographic frame с breathing accent
- Mic-off / deafened states — subtle glitch overlay (не invasive)
- Voice notepad panel — code-editor aesthetic (monospace, line numbers, syntax highlight)
- Music mini-player — equalizer bars instead of progress bar (when music sessions active)

### 4.9 Empty states (cross-cutting)

When channel has no messages / no tasks / no pinned items:
- Currently `<EmptyState>` component с line-art SVG icon (40×40)
- Хочется upgrade icon to **wireframe 3D construction** (satellite dish / cube grid / tower / waveform). Still monoline, still single cyan accent. Just more architectural / less doodle.

---

## 5. Output format expected

### From AI Studio / Stitch

1. **Mockup images** (PNG / SVG) для key screens (4.1, 4.2, 4.4, 4.5)
2. **Design tokens delta** — Pavel хочет видеть какие новые CSS variables нужны
3. **Motion language additions** — какие новые keyframe animations предлагаются
4. **Icon set proposal** — sample 6-8 new icons в proposed style (replace existing constellation / cube / wave / pulse iconography)

### Do NOT

- ❌ Propose Tailwind / Framer Motion migration — current stack vanilla CSS + tokens, не двигаемся
- ❌ Warm color palette anywhere
- ❌ Cute mascots / friendly illustrations
- ❌ Tropical / synthwave neon
- ❌ Heavy 3D models (WebGL / Three.js не используется)
- ❌ Animated backgrounds with high CPU load
- ❌ Light theme

### Must respect

- ✅ React 19 + Vite 6 + TypeScript (no framework migration)
- ✅ Existing component class names (`.ec-shell__*`, `.ec-channel-info-panel__*`, `.ec-intel-tabs__*`) — propose additions, не renames
- ✅ Russian primary language UI
- ✅ Mobile (≤640) + tablet (640-1024) + laptop (1025-1366) + desktop (≥1367)
- ✅ Touch targets min 38×38 on mobile
- ✅ prefers-reduced-motion respect

---

## 6. Reference

Eclipse Chat v1.0.0 is LIVE: `https://app.star-crm.ru/eclipse-chat/`

API health endpoint: `/eclipse-chat/api/version` returns `{version: "1.0.0"}`.

Stack: Node 20 + Fastify 5 + Prisma 6 + Socket.io 4 / React 19 + Vite 6 + TS 5.8 / PostgreSQL 16 + LiveKit + Ollama.

Brand identity references — Pavel ecosystem:
- Eclipse Forge (community workspace name)
- "Forge Layer" (sidebar nav concept name)
- "Intelligence Panel" (right rail concept name) — теперь simplified в v0.96 до members-only

---

**Prompt prepared 2026-05-19 by Claude Opus 4.7. Attached file: `current-state.html` (structural snapshot).**
