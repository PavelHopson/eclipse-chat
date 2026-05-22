# Eclipse Chat — Surface Map

> Карта реальных экранов / поверхностей по **текущему коду** (не по
> старым мокапам). Снимок 22.05.2026, v1.1.90. Для редизайна — какие
> surfaces есть, чем заняты, какой их статус под grammar v2 (см.
> `design-brief-v2.md`).

---

## Каркас (shell)

Оркестратор — `pages/AppShell.tsx` (~2370 строк). CSS-грид `.ec-shell`:
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

Статус: 🟢 соответствует · 🟡 частично / drift · 🔴 не трогали.

### Shell-каркас
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| Topbar | `AppShell.tsx` | 🟡→🟢 | slice 1: inline-консоли → классы, `.ec-icon-btn`, бренд успокоен |
| Chat header | `AppShell.tsx` | 🟡→🟢 | slice 1: inline+JS-hover кнопки → `.ec-icon-btn` |
| Бренд-марка | `motion.css` `.ec-brand-mark` | 🔴→🟢 | slice 1: была orange (drift) → gold |
| Shell-фон / рейлы | `components.css` | 🟡 | дубль-блоки + `!important` — slice 7 |

### Навигация
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `ChannelList` | `ChannelList.tsx` (1247) | 🟡 | slice 2 |
| `ServerSwitcher` | `ServerSwitcher.tsx` (519) | 🟡 | slice 2 |
| `DirectConversationList` | `DirectConversationList.tsx` | 🟡 | slice 2 |

### Центральная сцена
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `MessageList` | `MessageList.tsx` (1165) | 🟡 | slice 3; hover-«floating» помечен ПРОТОТИП |
| `MessageInput` | `MessageInput.tsx` (1090) | 🟡 | slice 3; composer-театр успокоить |
| `Attachments` | `Attachments.tsx` (38KB) | 🟡 | slice 3 |
| `VoiceRoom` | `VoiceRoom.tsx` (44KB) | 🔴 | slice 6 |

### Правый rail
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `IntelligencePanel` | `IntelligencePanel.tsx` | 🟡 | slice 4 |
| `MemberList` | `MemberList.tsx` (432) | 🟡 | slice 4 |
| `ThreadPanel` / `IncidentPanel` | — | 🔴 | slice 4 |

### Overlays
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `Modal` (база) | `Modal.tsx` | 🟡 | slice 5 |
| `ServerHubModal` | `ServerHubModal.tsx` (41KB) | 🔴 | slice 5 |
| `SearchOverlay` | `SearchOverlay.tsx` (27KB) | 🔴 | slice 5 |
| `ChannelInfoPanel` | `ChannelInfoPanel.tsx` | 🟡 | slice 5 |
| `ProfileModal` / прочие модалки | — | 🔴 | slice 5 |

### Data / operational surfaces
| Surface | Файл | Статус | Заметки |
|---|---|---|---|
| `OperationalTablePanel` | `OperationalTablePanel.tsx` (56KB) | 🔴 | slice 6 — inline-стили |
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

---

## Замеченный drift (для §4 brief'а)

1. **Inline-стили + JS-hover** — `onMouseEnter/Leave`, мутирующие
   `.style`. Гуще всего: `AppShell`, `AdminPanel`, `OperationalTablePanel`,
   `BotsTab`, `VoiceRoom`. Каскад в обход — drift неизбежен.
2. **Дубль CSS-блоков** в `components.css` — `.ec-shell*`,
   `.ec-chat-header`, `.ec-chat-title` определены 2× с `!important`.
3. **Бренд-марка orange** против violet+gold identity (чинится slice 1).
4. **Декор-перегруз** — радиальные градиенты + blur + glow на каждом
   surface.
5. **Устаревшие prompts** — `docs/design-prompts/*` cyan/dark-only,
   помечены DEPRECATED.
