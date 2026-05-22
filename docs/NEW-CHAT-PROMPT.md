# Eclipse Chat — handoff для нового чата

> Обновлено **2026-05-22, после v1.2.4**. Прошлая сессия — 7 версий
> (v1.1.98 → v1.2.4): integrity-фиксы, плеер, рекомпозиция каркаса,
> закрыт трек Execution Cockpit. Скопируй блок ниже в новый чат.

---

Привет. Я Pavel Hopson. Eclipse Chat — продолжаем из нового чата.

## Старт

Прочитай `E:\projects\eclipse-chat\ROADMAP.md` (синхронен по v1.2.4 —
header + version-log). `CLAUDE.md` подтянет Agents/Context/Memory/
Skills.md автоматически. Source of truth по дизайну — `docs/design/
design-brief-v2.md` + `surface-map.md`. Подтверди состояние
(`/api/version` + `/api/health`), затем спроси, что брать.

## Текущее состояние

**Прод (LIVE):** **v1.2.0** — https://app.star-crm.ru/eclipse-chat/
**master HEAD = `f07e1a9` = v1.2.4.** Локально и на GitHub совпадает.

⚠️ **4 версии (v1.2.1 … v1.2.4) запушены, CI зелёный, но висят на
approve-gate** (environment `production`). Деплой не автоматический —
Pavel жмёт Approve на последнем «Deploy PROD»-ране (`f07e1a9`); он
задеплоит всё разом. Стейл-раны можно отменить (освобождает
concurrency-лок). Команда апрува — в `Agents.md` → Deploy.

## Сделано за прошлую сессию (v1.1.97 → v1.2.4)

- **v1.1.98** — integrity-фикс: `/api/version` врал (хардкод застрял
  на 1.1.89, не бампался 8 релизов); smoke-тест был тавтологичен.
  `deploy.sh` теперь сверяет `package.json` ↔ `/api/version`.
- **v1.1.99** — integrity-пакет: фикс регресса logout (`busyRef`-латч
  без сброса — кнопка мертвела); ServerHubModal color-пресеты
  выровнены по identity (убраны cyan/teal/warm); doc-sync; topbar-
  кнопки → канонический `.ec-icon-btn`.
- **v1.2.0** — трек R1: фирменный media-плеер «Signal Desk» v2 —
  scrubber с буфером/hover-preview/loading, mini-player с иерархией,
  expand-плеер без 64-барного шума, radar-ping loader видео.
- **v1.2.1** — рекомпозиция каркаса: полноширинный SaaS-топбар убран
  → командный хребет (brandbar + каналы = одна вертикаль) + центр-
  командный бар (cmdbar). Sci-fi-breadcrumb «УЗЕЛ //» убран.
- **v1.2.2 → v1.2.4 — трек R2, Execution Cockpit, ЗАКРЫТ 3/3:**
  - v1.2.2 — `cockpit.css` (общий язык: chips/cards/cols/state) +
    StatusBoard.
  - v1.2.3 — OperationalTablePanel → control desk (sticky-header,
    row-язык, inline-edit как состояние системы).
  - v1.2.4 — ActionItemDrawer → mission detail panel.
  Все три execution-поверхности на единой cockpit-системе; снят
  ~250 inline-стилей и module-level CSS-консолей, JS-hover.

Принцип сессии: design-system engineer, не patch-machine. Каждый
слайс — сборка зелёная (tsc + vite), коммит, push.

## ⚠️ Главный риск — за тобой, Pavel

**Ни shell-рекомпозиция (v1.2.1), ни весь Execution Cockpit
(v1.2.2–v1.2.4) не на проде** — висят на approve-gate. Плеер
(v1.2.0) на проде, но живого ревью по нему ты ещё не давал.

Сильно рекомендую: апрувнуть гейт и пройтись глазами по проду —
плеер, каркас (хребет/центр-бар, обе темы VOID/SOLAR), execution-
поверхности (доска, таблица, drawer задачи) — **до** того, как
копить следующий слайс. Агент рендер не видит; визуальная
верификация — за тобой.

## Открытые направления

- **Деплой + живое ревью** всего R-трека (см. риск выше).
- **R-CSS-консолидация** (brief slice 7) — дубль-блоки `.ec-shell*` /
  `.ec-chat-header` и `!important`-войны в `components.css`.
  Единственный крупный нетронутый системный долг каркаса.
- **AdminPanel / BotsTab** (brief slice 6, data surfaces) — крупный
  inline-долг; в Execution-Cockpit-ТЗ их просили НЕ трогать,
  отдельный слайс.
- Из прежних: sci-fi-копирайт sweep, audio-reactive визуализатор
  плеера, slash-команды backend, custom emoji, настоящий E2E
  (GoofCord-трек).
- Ждёт живой верификации: media-плеер, shell-рекомпозиция, все
  3 execution-поверхности, 3 voice-фикса v1.1.68/69/75.
