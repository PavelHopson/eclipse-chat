# Eclipse Chat — Surface Map

> Карта реальных экранов / поверхностей по **текущему коду** (не по
> старым мокапам). Снимок 22.05.2026, **v1.1.99**. Для редизайна —
> какие surfaces есть, чем заняты, какой их статус под grammar v2
> (см. `design-brief-v2.md`).

---

## Каркас (shell)

Оркестратор — `pages/AppShell.tsx` (~2360 строк). CSS-грид `.ec-shell`:
4 зоны (`top` / `channels` / `chat` / `members`), сетка — в
`responsive.css`. ≤1024px — single-column + drawers.

| Зона | Класс | Компонент(ы) | Что внутри |
|---|---|---|---|
| Топбар | `.ec-shell__top` | inline в AppShell | бренд + `ServerSwitcher` · breadcrumb · телеметрия + утилиты + профиль |
| Левый rail | `.ec-shell__channels` | `ChannelList` / `DirectConversationList` | комнаты пространства / список DM |
| Центр | `.ec-shell__chat` | chat-header + контентная область | заголовок + `MessageList`+`MessageInput` ИЛИ full-view |
| Правый rail | `.ec-shell__members` | `IntelligencePanel` / `MemberList` / `ThreadPanel` / `IncidentPanel` | участники / тред / инциденты |

Центральная область — мультиплекс: чат, `VoiceRoom`, `StatusBoard`
(доска / execution-комната), `HomeToday`, `HelpPanel`, `AdminPanel`,
`OperationalTablePanel`, `TeamHealth`, `EmptyState`.

---

## Surfaces и статус под grammar v2

Статус: 🟢 грамматика применена (классы/CSS-hover/токены, без
inline-drift) · 🟡 частично / drift · 🔴 не трогали.

> **Важно:** 🟢 здесь = «грамматика применена», НЕ «визуально смело
> пересобрано». Slice'ы 1–5 были рефакторингом разметки, не
> композиционным переделом (см. `design-brief-v2.md` §5, строка R).

### Shell-каркас
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| Topbar | `AppShell.tsx` | 🟢 | slice 1: inline-консоли → классы, `.ec-icon-btn`; v1.1.99: 6 action-кнопок переведены на канонический `.ec-icon-btn` (убраны 6× inline padding/color) |
| Chat header | `AppShell.tsx` | 🟢 | slice 1: inline+JS-hover кнопки → `.ec-icon-btn` |
| Бренд-марка | `motion.css` `.ec-brand-mark` | 🟢 | slice 1: была orange (drift) → gold |
| Shell-фон / рейлы | `components.css` | 🟡 | дубль-блоки `.ec-shell*` + `!important` — slice 7 (не сделан) |

### Навигация
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `ChannelList` | `ChannelList.tsx` | 🟢 | slice 2 (v1.1.92) |
| `ServerSwitcher` | `ServerSwitcher.tsx` | 🟢 | slice 2 — фикс SOLAR-бага тёмного триггера |
| `DirectConversationList` | `DirectConversationList.tsx` | 🟢 | slice 2 |

### Центральная сцена
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `MessageList` | `MessageList.tsx` | 🟢 | slice 3 (v1.1.93); JS-hover убран, floating-прототип снят |
| `MessageInput` | `MessageInput.tsx` | 🟢 | slice 3 |
| `Attachments` | `Attachments.tsx` (38KB) | 🟡 | grammar по краю; глубокий inline остаётся |
| `VoiceRoom` | `VoiceRoom.tsx` (44KB) | 🔴 | inline-стили + JS-hover |

### Правый rail
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `IntelligencePanel` | `IntelligencePanel.tsx` | 🟢 | slice 4 (v1.1.94) |
| `MemberList` | `MemberList.tsx` | 🟢 | slice 4 — JS-hover строки убран |
| `ThreadPanel` / `IncidentPanel` | — | 🟢 | slice 4 |

### Overlays
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `Modal` (база) | `Modal.tsx` | 🟢 | slice 5 (v1.1.95) |
| `ChannelInfoPanel` | `ChannelInfoPanel.tsx` | 🟢 | slice 5 (v1.1.95) |
| `SearchOverlay` | `SearchOverlay.tsx` | 🟡 | slice 6-грамматика (v1.1.96); остаётся глубокий one-off inline в hit-строках |
| `ServerHubModal` | `ServerHubModal.tsx` | 🟡 | slice 7-грамматика (v1.1.97); v1.1.99: brand-color пресеты выровнены по identity + секция inline→class; остаётся inline в баннере / mode-карточках |
| `ProfileModal` / прочие модалки | — | 🔴 | не трогали |

### Data / operational surfaces
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `OperationalTablePanel` | `OperationalTablePanel.tsx` (56KB) | 🔴 | slice 6 — крупный inline-долг |
| `StatusBoard` | `StatusBoard.tsx` (24KB) | 🟡 | slice 6 |
| `AdminPanel` | `AdminPanel.tsx` (67KB) | 🔴 | slice 6 — крупнейший inline-долг |
| `BotsTab` | `BotsTab.tsx` (52KB) | 🔴 | slice 6 |
| `HomeToday` / `TeamHealth` | — | 🟡 | grammar по ходу |
| `ActionItemDrawer` | `ActionItemDrawer.tsx` (71KB) | 🔴 | slice 6 |

### Полноэкранные / прочее
| Surface | Файл | Статус |
|---|---|---|
| `AuthPage` | `pages/AuthPage.tsx` | 🟡 (sci-fi HUD — отдельный трек) |
| `HelpPanel` | `HelpPanel.tsx` | 🔴 |
| `EmptyState` | `EmptyState.tsx` | 🟢 (унифицирован) |
| Client Portal | `pages/ClientPortal*.tsx` | 🔴 |

### Медиа-плеер
| Surface | Файл | Статус |
|---|---|---|
| `MusicMiniPlayer` / `MusicExpandModal` / `VideoPlayer` / `MediaScrubber` | `player.css` + компоненты | 🟡 — переписан в v1.1.91 (slice 1), но фирменный media-experience не доведён; трек R |

---

## Замеченный drift (для §4 brief'а)

1. **Inline-стили + JS-hover** — почищены в slice 1–5 поверхностях.
   Гуще всего остаётся в data-surfaces: `AdminPanel`,
   `OperationalTablePanel`, `BotsTab`, `ActionItemDrawer`, `VoiceRoom`.
2. **Дубль CSS-блоков** в `components.css` — `.ec-shell*`,
   `.ec-chat-header`, `.ec-chat-title` определены 2× с `!important`.
   Не сделано — slice 7.
3. ~~Бренд-марка orange~~ — **исправлено** (slice 1, → gold).
4. **Декор-перегруз** — радиальные градиенты + `backdrop-filter` +
   glow на каждом surface. Остаётся.
5. **Устаревшие prompts** — `docs/design-prompts/*` cyan/dark-only,
   помечены DEPRECATED.
6. ~~`ServerHubModal` color-пресеты cyan/teal/amber/coral~~ —
   **исправлено** (v1.1.99): пресеты выровнены по identity violet+gold.
