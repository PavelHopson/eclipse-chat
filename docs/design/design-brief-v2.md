# Eclipse Chat — Design Brief v2

> **Статус:** актуальный source of truth по визуальному языку (с 22.05.2026).
> Заменяет cyan-era артефакты в `docs/design-prompts/` — они помечены
> DEPRECATED и не являются истиной.
> Состояние проекта (версии, фичи) — в `ROADMAP.md`. Архитектура — в
> `Context.md`. Этот файл — про **визуальный язык и его правила**.

---

## 1. Что мы проектируем

Eclipse Chat — **operational platform / operator console**, Russian-first.
Не Discord-клон, не gamer chat, не generic SaaS.

Ощущение интерфейса — **calm command center**: execution-first, private,
structured, confident. Тихий, плотный, уверенный. Оператор за пультом, а
не геймер за неоновой консолью.

Композиция может быть смелой, но без визуального шума и без «AI slop»
(стоковые градиенты-везде, glow-везде, animated-везде, декор ради декора).

---

## 2. Identity (зафиксировано)

### Цвет

| Роль | Токен | Значение | Где |
|---|---|---|---|
| Primary accent | `--ec-accent` | violet `#8B5CF6` | active / selected / primary action / focus |
| Premium accent | `--ec-accent-gold` | gold `#D4AF37` | точечно: owner, награды, бренд-марка, premium-CTA |
| Status: exec | `--ec-status-exec` | green | live / done |
| Status: warn | `--ec-status-warn` | amber | pending / warning |
| Status: risk | `--ec-status-risk` | red | overdue / blocker |
| Status: idle | `--ec-status-idle` | muted blue | standby |
| Status: AI | `--ec-status-ai` | violet-indigo | AI / agent |

**Запрещено:**
- ⛔ cyan/teal как **primary** акцент — демотированы в status-only
  (`--ec-accent-2`). Не «фиксить» violet обратно на cyan.
- ⛔ warm orange как акцент или в брендинге — наследие Eclipse Forge,
  отменено. Если осталось (см. историю brand-mark) — это drift, чинить
  в сторону gold.
- ⛔ rainbow-градиенты, неон, tropical (acid green / hot pink).

### Темы

Две, обе обязательны и обе нельзя ломать:
- **VOID** — тёмная, основная. Night-blue void, 4 чёткие глубины surface.
- **SOLAR** — светлая, Notion-crisp. Белый bg/cards, whisper-cool-grey
  panels, структуру держат волосяные бордеры. Переключатель в топбаре.

SOLAR-оверрайды живут в `effects.css` (`html[data-ec-theme="solar"]`).
**Любой новый surface-класс обязан иметь SOLAR-вариант**, иначе тема
ломается.

### Типографика

- Шрифт — **Geist** (sans) + **Geist Mono** (self-hosted, `fonts.css`).
  Отдельного sci-fi-шрифта нет (Orbitron убран — это было клише).
  Иерархия строится **весом и размером**, не вторым шрифтом.
- Type scale — модульная, ratio 1.25 (`--ec-text-*`). Body ≥ 16px.
- Mono — для телеметрии, чисел, кода, тех-меток. Не для заголовков.
- Russian-first. UPPERCASE + `letter-spacing` — только для коротких
  секционных лейблов, не для контента и не для длинных строк.

---

## 3. Visual grammar v2 — правила

Единый язык для всего продукта. Из него собираются все surfaces.

### 3.1 Глубина, не рамки
Панели и карточки отделяются **глубиной и светом** (elevation: hairline-
ring `--ec-edge` + мягкая тень `--ec-elev-1/2`), а не толстыми бордерами.
Уходим от box-in-box. Это уже заложено в токенах — применять
последовательно.

### 3.2 Спокойный chrome, ведёт контент
Chrome (топбар, заголовки, рейлы) **рецессивен** — приглушён в покое,
не борется за внимание. Контент (сообщения, задачи, данные) — ярче
chrome. Никакой анимации на chrome ради «живости» (бренд-марка —
единственное исключение, и то тонко).

### 3.3 Один язык интерактивности
Каждый интерактивный элемент проходит один и тот же цикл состояний,
описанный **в CSS один раз**:
- **rest** — прозрачный / muted;
- **hover** — подъём surface + текст ярче;
- **active** — лёгкий press (`translateY(0.5px)` / `scale(0.99)`);
- **focus-visible** — accent-ring (`outline`, для клавиатуры).

⛔ **Никогда** — `onMouseEnter`/`onMouseLeave`, мутирующие `.style`
в JS. Это главный источник drift'а: hover в обход каскада нельзя
держать консистентным. Hover — только CSS.

Канонические примитивы:
- `.ec-btn` (+ `--primary` / `--ghost` / `--danger` / `--sm`) — кнопки
  с текстом.
- `.ec-icon-btn` (+ `--sm`) — **иконочная кнопка** (топбар, заголовки,
  тулбары). Призрачная в покое, surface на hover, accent на
  `[aria-pressed="true"]`.
- `.ec-field` — поля ввода.

### 3.4 Акцент — это сигнал
Violet — это «здесь важное / активное / действие». Не фон, не бордер
повсюду, не декоративный glow. Структурные элементы — нейтральные
(cool-slate). Акцент появляется там, где есть смысл, и тогда он читается.

### 3.5 Сдержанное движение
Функциональные переходы — быстрые (`--ec-dur-fast` 120ms /
`--ec-dur-base` 180ms). Ambient-петли (breathing, shimmer, scan) —
только там, где это несёт смысл (live-статус, AI «думает», бренд-марка).
Не на chrome. Всегда уважать `prefers-reduced-motion`.

### 3.6 Честные лейблы
Системные метки не врут. Не называть TLS «E2E», не показывать ложный
статус. Не вводить sci-fi-копирайт там, где он подменяет смысл
(«ОЖИДАНИЕ СИГНАЛА» вместо понятного состояния). Operator-console —
это плотность и структура, а не псевдо-терминальный театр.

---

## 4. Архитектура реализации

- React 19 + Vite + TypeScript, **vanilla CSS** слоями:
  `tokens → reset → components → effects → responsive → motion`
  (+ `fonts`). Никакой framework-миграции, никакого Tailwind.
- Стили — в CSS-классах. **Inline `style` — только для динамических
  значений** (вычисляемый цвет, прогресс, координаты). Статика inline —
  это drift, выносить в классы.
- Токены — в `tokens.css`. Эффект-классы — в `effects.css`. Не плодить
  inline-стили и не дублировать правила: если правило для surface'а уже
  есть — править его, а не добавлять конкурирующее ниже с `!important`.
- Новый surface-класс ⇒ сразу SOLAR-вариант.

### Известный технический долг (root cause drift'а)
1. **Inline-стили + JS-hover** в крупных компонентах (`AppShell`,
   `AdminPanel`, `OperationalTablePanel`, `BotsTab`, `VoiceRoom` …).
2. ~~**Дублирующиеся конфликтующие CSS-блоки** в `components.css`:
   `.ec-shell`, `.ec-shell__top`, `.ec-chat-header`, `.ec-chat-title`,
   `.ec-shell__channels` определены дважды, второй блок перебивает
   первый через `!important`. Это «исторические слои».~~
   **✅ Закрыто slice 7 (v1.2.5)** — дубль-блоки слиты, `!important`-
   война снята (трёхфайловая: `components.css` ↔ `responsive.css` ↔
   `effects.css`). Каскад держится порядком слоёв и специфичностью.
3. Декор-перегруз: радиальные градиенты + `backdrop-filter` + glow на
   каждом surface.
4. Устаревшая документация (cyan-era prompts, заголовок `tokens.css`).

Чинится **послойно**, по slice'ам (см. §5). Не одним махом.

---

## 5. План редизайна по slice'ам

Каждый slice доводится до рабочего состояния и сборки, затем следующий.

> **Статус-снимок (v1.1.99) — честно.** Slice'ы 1–5 закрыты, но они
> прошли как **применение грамматики**: inline-консоли → классы,
> JS-hover → CSS, успокоение sci-fi-визуала. Это не была смелая
> композиционная пересборка — фидбэк Pavel'я «очень мало изменений
> по дизайну» справедлив. Реальный визуальный передел (type-scale в
> контрасте, spacing-ритм, depth, рекомпозиция топбара/shell,
> фирменный media-плеер, кнопки/hover-press-focus как система) — это
> **строка R** ниже, отдельный открытый трек; галочки slice 1–5 его
> НЕ покрывают.

| Slice | Зона | Статус |
|---|---|---|
| **1** | Shell-каркас: грамматика + AppShell topbar / chat-header / бренд-марка. Примитив `.ec-icon-btn`. | ✅ грамматика (v1.1.91) |
| **2** | `ChannelList` + `ServerSwitcher` — навигация. | ✅ грамматика (v1.1.92) |
| **3** | `MessageList` + `MessageInput` — центральная сцена. | ✅ грамматика (v1.1.93) |
| **4** | Правый rail: `IntelligencePanel` / `MemberList` / `ThreadPanel`. | ✅ грамматика (v1.1.94) |
| **5** | Overlays: `Modal`, `ChannelInfoPanel`, `SearchOverlay`, `ServerHubModal`. | ✅ грамматика (v1.1.95–97) |
| 6 | Data surfaces: `OperationalTablePanel`, `StatusBoard`, `AdminPanel`, `BotsTab`. | план |
| **7** | CSS-консолидация: дубль-блоки `.ec-shell*` + `!important`-война (`components.css` ↔ `responsive.css` ↔ `effects.css`). | ✅ v1.2.5 |
| **R** | **Визуальная пересборка** (не refactor): композиция топбара/shell, кнопки + hover/press/focus как система, фирменный media-плеер, media-controls. | в работе |
| — | sci-fi-копирайт sweep (отдельный трек, решение Pavel'я). | открыто |

---

## 6. Что НЕ делать

- ❌ Не возвращать cyan как primary.
- ❌ Не возвращать warm orange в брендинг / акценты.
- ❌ Не скатываться в generic SaaS и не делать gamer/neon circus.
- ❌ Не врать системными лейблами.
- ❌ Не плодить inline-стили и JS-hover.
- ❌ Не ломать VOID и SOLAR.
- ❌ Не делать «весь редизайн сразу» — только послойно.
- ❌ Не вводить новые крупные паттерны без необходимости; сохранять
  UX-архитектуру там, где она уже стала лучше старой версии
  (свёрнутый far-left rail, упрощённый правый rail, hover-buttons).
