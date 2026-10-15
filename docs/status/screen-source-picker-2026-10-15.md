# Выбор экрана/окна трансляции — 15.10.2026

## Результат и граница

Локальный RC v1.7.79, checkout `G:/eclipse-chat-screen-audio-rc`, detached base `366b094496a01b418d4f45a90a1bd9d8ed5485d5`; remote master read-only совпал с `550e9cdb303f656bd27898e0e56109197327ae76`. Origin `https://github.com/PavelHopson/eclipse-chat.git`. Новая ветка не создавалась. Прежний dirty `docs/status/voice-audio-2026-10-07.md` и `.codex-qa` не входят в commit; основной E:/projects/eclipse-chat не менялся.

Пользователь показывает Windows-приложение: разрешение только на собственную вкладку, без выбора рабочего стола/приложений. Исправлена настройка запроса захвата. Сам native WebView2 picker и конкретная игра ещё не проверены: не утверждаем завершённую Windows acceptance по mock или Chromium.

## Причина и минимальный diff

- `SCREEN_SHARE_CAPTURE_OPTIONS` в существующем `useVoice.ts` содержал `preferCurrentTab: true`. В установленном LiveKit этот параметр без изменения доходит до `navigator.mediaDevices.getDisplayMedia`.
- Это предпочтение текущей вкладки согласуется с показанным диалогом. Точное поведение установленного у пользователя WebView2 до/после требует ручной проверки, а не вывода только по снимку.
- Теперь `preferCurrentTab: false` и `video: { displaySurface: "window" }`. Последнее — подсказка категории, не принудительный выбор конкретного окна; monitor/tab не исключаются. Игра выбирается как окно, если доступна в picker, либо через монитор. Универсальный захват всех игр/защищённого контента не обещается.
- Audio constraints/systemAudio, bitrate, stop/stale cleanup, user activation, native consent, permissions/ACL и server transport не менялись. Нет автоjoin, скрытого enumeration, IPC, auto-selection flags, нового capture service или dependency.
- Два новых регрессионных теста подключены через уже существующий voice-room suite: SDK conversion и cancel без повторной попытки/refresh. Browser harness проверяет реальный `createLocalScreenTracks` через stub только системного API. Локальный QA base допускает лишь http://127.0.0.1, чтобы обойти занятый чужим процессом порт, не выключая его.
- Root/web/server/lockfile/SW синхронно 1.7.79. Native desktop/Android versions не менялись: приложение загружает remote frontend. В roadmap убран случайный повтор собственной записи 1.7.78.

## Проверки

- `node --test deploy/scripts/voice-room-ui.test.mjs deploy/scripts/voice-audio-processing.test.mjs deploy/scripts/voice-settings-flow.test.mjs`: 53/53 pass.
- `npm.cmd test`: 154 root checks; server 82 files, 474 passed / 6 skipped.
- `npm.cmd run typecheck`, `npm.cmd run build`: pass. Прежние предупреждения boot-preferences.js classic script и chunk size остаются.
- `npm.cmd run security:profile:test`: 22/22 pass.
- `npm.cmd audit --audit-level=low`: 0 vulnerabilities. No install/update, dependency graph неизменен, lockfile diff — только версии приложения.
- Chromium `voice-audio-dev-smoke.mjs` на своём loopback 5188: actual SDK до native-API границы получает preferCurrentTab=false/displaySurface=window/systemAudio=include. Fixture monitor/browser возвращают screen video+audio, fixture window без audio — только screen video. Во всех случаях tracks ended после stop; cancel — один запрос, без retry.
- Соседний smoke: actual RNNoise на synthetic input; actual LiveKit RemoteAudioTrack через local WebRTC peers non-silent; shared SettingsPanel → call/PTT/late grant/error flow; 320/360/390/412/768/1280 px без horizontal overflow, reduced-motion, page errors 0. Никакой пользовательский desktop/window/microphone не захватывался. Это не production SFU/hardware/native UI acceptance.
- Read-only production API 15.10: version 1.7.77, health ok=true/database=true. Активные assets/SW в этом этапе не сравнивались, новый deploy не выполнялся.
- Git diff/check, manifest parity и exact write-set проверяются перед commit; Gitleaks/CodeQL/Linux CI в этом локальном этапе не запускались.

## Пропорциональный security-pass

Применён установленный `conducting-cyber-risk-assessment-with-nist-800-30`, Tier 3: только screen-capture request/privacy. Источники — код/SDK, primary Chrome docs, локальные negative/integration tests. Модель — qualitative five-level likelihood×impact, reference matrix; helper `scripts/process.py:score_risk` вызван offline без записи файлов. Оценки — инженерное суждение, не измеренная вероятность/CVSS; владелец — voice runtime owner.

| ID / событие | Источник / актив | Likelihood / impact / risk | Мера / остаток |
| --- | --- | --- | --- |
| PICK-01: случайно выбран весь монитор, показаны другие приложения | Accidental / приватность экрана | Moderate / High / Moderate (Medium) | По умолчанию категория окон, финальный выбор и подтверждение у пользователя; Medium residual, весь монитор по запросу пользователя не запрещён |
| PICK-02: захват без подтверждения или поздний grant после выхода | Structural / приватность capture | Low / High / Low | Штатный getDisplayMedia без bypass/forced device, прежние stale cleanup tests зелёные; Low residual до native QA |
| PICK-03: WebView2 игнорирует hint / игра не даёт изображение | Structural / доступность трансляции | Moderate / Low / Low | Не обещать все игры; физическая Windows/SFU acceptance остаётся release gate |

Новых подтверждённых Critical/High уязвимостей в этом diff не выявлено. Не добавлены secrets/logging/raw PCM/frame logs, новые origins/capabilities, endpoints, command execution, upload, XSS surface или server permission changes. Broad Desktop privileges не расширялись. Это не полный pentest продукта, не закрытие старых native/supply-chain рисков и не гарантия системного звука.

Пересмотр: после реального WebView2 acceptance, изменения SDK/runtime/capture/IPC или любого нарушения stop/cancel/consent. Нельзя ослаблять prompt или автоматически выбирать экран ради прохождения smoke.

## Обязательная ручная приёмка после разрешённого выпуска

1. Перезагрузить remote UI в Windows-приложении, убедиться в актуальном SW/версии. Войти в тестовую voice room, нажать демонстрацию только явно.
2. Системный picker предлагает окна приложений и мониторы, а не только Eclipse Chat. Нажать «Отмена» — ничего не публикуется. Если остаётся старый диалог, остановиться и зафиксировать WebView2/native version; не включать unsafe flags.
3. Выбрать безопасное тестовое окно → второй клиент видит выбранное окно. Остановить; выбрать монитор → второй клиент видит этот монитор. Проверить несколько мониторов и окно игры (отдельно borderless/exclusive fullscreen), не обещать результат заранее.
4. Stop/OS stop/leave/refresh/reconnect/switch room закрывают capture; повторный запуск снова требует подтверждения. Mic mute/deafen сохраняются.
5. Browser audio checkbox, наличие/отсутствие screen audio и слышимость проверяются отдельно. Windows native loopback по-прежнему не реализован этим срезом.

Migration не нужна. Push/deploy требуют отдельного выпуска в согласованный master с fresh exact-SHA CI/security/approval; старый `5d505b5` не использовать. До публикации этого commit обычный production pull не получит исправление.

## Primary references

- [Chrome screen sharing controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls): displaySurface — предпочтение pane; preferCurrentTab — предпочтение своей вкладки; финальное окно/экран нельзя выбрать вместо пользователя.
- [Microsoft WebView2 screen-capture permission](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/overview-features-apis?tabs=dotnetcsharp): host может отменять prompt; это не повод обходить consent и не подтверждение конкретного runtime у пользователя.
