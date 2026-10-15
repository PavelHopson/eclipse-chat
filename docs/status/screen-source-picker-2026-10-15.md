# Выбор экрана/окна трансляции — 15.10.2026

## Результат и граница

Релиз v1.7.79 опубликован 15.10.2026, code `f668784b73fa8e68636d1e6e233ec9f2aac15e73`. Checkout `G:/eclipse-chat-screen-audio-rc`, detached base `366b094496a01b418d4f45a90a1bd9d8ed5485d5`; на старте remote master read-only совпал с `550e9cdb303f656bd27898e0e56109197327ae76`. Origin `https://github.com/PavelHopson/eclipse-chat.git`. Новая ветка не создавалась. Прежний dirty `docs/status/voice-audio-2026-10-07.md` и `.codex-qa` не входят в commit; основной E:/projects/eclipse-chat не менялся.

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
- До публикации read-only production API 15.10: version 1.7.77, health ok=true/database=true. Результат после разрешённого deploy приведён ниже, это отдельная проверка.
- Локально Git diff/check, manifest parity, scoped secret-pattern scan (0), exact write-set — pass. Gitleaks/CodeQL/Linux CI выполнены отдельно после публикации, см. rollout ниже.

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

Migration не нужна. Push/deploy выполнены после явного разрешения пользователя, без обхода fresh exact-SHA CI/security/approval. Старый `5d505b5` не использовать для повторного deploy.

## Подтверждённый production rollout и обновление приложения

- Пользователь разрешил push в master, штатный deploy 1.7.79 с общими настройками звука 1.7.78 и обновление приложения. Выполнен только fast-forward `HEAD:master`, без force. Вся чужая dirty работа сохранена.
- [CI 38805287518](https://github.com/PavelHopson/eclipse-chat/actions/runs/38805287518), [Security Gate 38805287752](https://github.com/PavelHopson/eclipse-chat/actions/runs/38805287752), [Deploy 38805287573](https://github.com/PavelHopson/eclipse-chat/actions/runs/38805287573): exact `f668784b73fa8e68636d1e6e233ec9f2aac15e73`, success.
- Перед approval машинно проверены master SHA, headSha/status CI+Security, deploy SHA/waiting, единственный environment `production` id 15291822396 и current_user_can_approve. Только затем одобрена эта ожидающая deployment. Проверки не ослаблялись.
- Production backup: Chat dump 439906 bytes, mode 600, pg_restore list verified. DB migration skip разрешён штатной пустой Prisma diff проверкой; schema/migrations не менялись. Supervisor RUNNING, health/database true, uploads image/webp, подписанный LiveKit webhook/config/container smoke — success.
- Независимый GET: API 1.7.79, SW `eclipse-v1.7.79`. SHA-256 всех 8 выбранных production assets совпали byte-for-byte с проверенным release build: entry JS/CSS, AppShell JS/CSS, VoiceRoom, VoiceSettingsContent, SettingsPanel, RNNoise worklet. Active index ссылается на соответствующие entry assets; это не вывод только по package manifest.
- Реальный production IAB показывает v1.7.79. Обычный login через форму прошёл; открыты «Профиль и настройки → Голос и звук» до звонка. Одна модалка, устройства перечислены, тест не запущен. 1280/390 px: no horizontal overflow, screenshots просмотрены. Учётные данные не читались/не сохранялись в файлы; настройка устройств, mic test, звонок, capture/permission prompts не запускались. Actual WebView2/system picker и два production-клиента не проверены.
- Desktop Tauri config загружает тот же production URL, поэтому интерфейс 1.7.79 приходит в существующую оболочку без изменения native binaries. Channel metadata проверена: desktop-v1.0.9, latest.json 1.0.9, 6 platform entries с signature fields; бинарники не скачивались/не устанавливались, криптографическая проверка updater signatures не выполнялась. Новая native версия/installer/APK не выпускались, Android остаётся 1.0.5. Не выдавать web update за native rebuild.
- Windows Computer Use inventory не нашёл запущенного окна Eclipse Chat. Новые программы/Windows настройки не устанавливались/не менялись. Пользователю: закончить звонок, сохранить черновик, перезагрузить интерфейс или полностью выйти через tray и открыть приложение; проверить v1.7.79 внизу.
- Supply-chain pass по установленному `analyzing-sbom-for-supply-chain-vulnerabilities`: own-CI CycloneDX 1.5 разобран (338 npm components, metadata 1.7.79; отдельный RNNoise BOM 2 components). Audit/SBOM job и Gitleaks/CodeQL зелёные. Независимые NVD/Grype/native artifact CVE scans не запускались, не заявлены.
- CodeQL open list: 14 прежних reference-doc findings в `docs/Эффекты крутые` (10 high insecure-randomness, 4 medium external-script rules), runtime paths отсутствуют. Не скрывались/не dismiss; это не новая runtime уязвимость и не полный security clearance. Medium/open native supply-chain/signing/auto-update/hardware риски предыдущего release inventory сохраняются.

Повторно разворачивать сервер сейчас не требуется. Для будущего ручного восстановления только после проверки, что этот SHA по-прежнему согласован и равен origin/master (Bash на сервере):

```bash
cd /var/www/eclipse-chat
ECLIPSE_RELEASE_SHA=f668784b73fa8e68636d1e6e233ec9f2aac15e73 \
ECLIPSE_SKIP_DB_MIGRATION=1 \
bash deploy/scripts/deploy.sh
```

Это исторический exact-SHA receipt, не команда на слепой повтор: при новом master/stale-release/error остановиться; не force и не отключать guard. Рабочая ручная приёмка picker выше по-прежнему обязательна.

## Primary references

- [Chrome screen sharing controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls): displaySurface — предпочтение pane; preferCurrentTab — предпочтение своей вкладки; финальное окно/экран нельзя выбрать вместо пользователя.
- [Microsoft WebView2 screen-capture permission](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/overview-features-apis?tabs=dotnetcsharp): host может отменять prompt; это не повод обходить consent и не подтверждение конкретного runtime у пользователя.
