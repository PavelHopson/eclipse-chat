# Eclipse Chat — общие настройки звука, 10.10.2026

## Результат и граница

Локальный срез v1.7.78 в `G:/eclipse-chat-screen-audio-rc`, база detached HEAD `550e9cdb303f656bd27898e0e56109197327ae76`. Origin: `https://github.com/PavelHopson/eclipse-chat.git`; remote master сверён через `git ls-remote`, совпал с базой. Новая ветка не создавалась.

Вместо недоступного раздела в профиле теперь один реальный экран устройств и тестирования звука, общий с настройками звонка. Это не повторное внедрение RNNoise и не реализация Windows loopback. Основной checkout `E:/projects/eclipse-chat` старый и dirty, не изменялся. Существующий dirty `docs/status/voice-audio-2026-10-07.md` оставлен без правок и не входит в срез.

## Первопричины

1. `SettingsTreeNav` помечал voice-video как «Скоро», а `SettingsPanel` отдавал placeholder. Рабочий компонент существовал только внутри звонка.
2. Capture назначения PTT принимал Escape/Tab как рабочие клавиши и отменял обычную клавиатурную навигацию.
3. Тест динамиков держал context/oscillator/audio в локальных переменных: catch и unmount не освобождали их; поздние setSinkId/play могли продолжить устаревшую проверку.

## Изменения

- `VoiceSettingsContent.tsx`: выделен существующий контент, store и DSP-проверка, не скопированы во второй runtime. Открытие не вызывает getUserMedia.
- `VoiceSettingsModal.tsx`: только modal shell; `SettingsPanel.tsx` встраивает тот же контент без вложенного диалога. В nav — «Голос и звук», без обещания отдельной реализованной панели видео.
- PTT: Escape — отмена/focus, Tab — отмена назначения с обычным переходом, repeat/IME игнорируются; listeners снимаются.
- Speaker generation/resources: cleanup на reject/close/device or volume change/hidden, включая destination tracks/timer; поздний результат игнорируется и playback останавливается.
- Mic: существующий generation guard сохранён; ended/unplug останавливает тест и DSP; analyser context явно возобновляется; ошибки показываются понятным текстом без сырых исключений.
- Видимые loading/error/retry списка устройств, responsive/focus и минимум 44px для контролов.
- Root/web/server/package-lock/SW 1.7.78, без изменения dependency graph или native manifests. Backend code, auth, DB, transport и CSP не менялись.

## Реально выполненные проверки

- `npm.cmd run typecheck` — web/server pass.
- `npm.cmd test` — pass, включая 14 новых behavioral regressions; server 82 files, 474 passed, 6 skipped. Последний полный запуск после unplug/resume/final CSS изменений.
- `npm.cmd run build` — pass после последнего кода; прежние предупреждения classic boot-preferences.js и размера chunk остаются.
- `npm.cmd run security:profile:test` — 22/22 pass.
- `npm.cmd audit --omit=dev --audit-level=low` и полный `npm.cmd audit --audit-level=low` — 0 vulnerabilities; это не независимый audit vendor RNNoise/WASM.
- `node deploy/scripts/voice-audio-dev-smoke.mjs` с предустановленным Playwright — pass после последнего кода. Реальный AudioWorklet/RNNoise, синтетический non-silent сигнал; input/output ended после cleanup. Реальный LiveKit RemoteAudioTrack через два локальных WebRTC peers — non-silent, mount/mute/volume до attach сохранены. Не production SFU.
- Chromium actual SettingsPanel → общий контент → VoiceSettingsModal: no capture on open, один dialog, общий сохранённый PTT, Escape/Tab, поздний grant после stop, sanitized error, все тестовые input tracks ended.
- 1280/320/360/390/412/768 px: no horizontal overflow; reduced-motion 390px; page errors 0. Desktop/mobile screenshots просмотрены; артефакты в `.codex-qa/voice-settings/`, не для коммита.
- `git diff --check` — pass, только существующие LF/CRLF warnings.
- Read-only production GET: API 1.7.77, health ok/database true. Это не acceptance v1.7.78.

## Security/risk assessment — только этот срез

Применён установленный `conducting-cyber-risk-assessment-with-nist-800-30`: Tier 3, source review + локальные отрицательные тесты, без live attacks и без новой telemetry. Источники риска здесь accidental/structural (позднее разрешение, ошибка SDK/device, неверная клавиша). Шкала likelihood/impact Low/Moderate/High, качественная reference matrix из skill; это оценка инженерной неопределённости, не CVSS или полный pentest продукта. Ответственный — владелец voice runtime.

| Сценарий / актив | Likelihood / impact до | Finding и локальная мера | Остаток |
| --- | --- | --- | --- |
| Звук продолжается после закрытия / local output | Moderate / Low | Low, исправлен: generation + освобождение всех speaker resources, reject/late/close tests | Low до WebView2/device QA |
| Поздний mic grant / приватный input | Moderate / Moderate | Medium, существующий guard сохранён и проверен в shared mount; ended/hidden cleanup, никаких publish/record | Low локально; physical runtime не проверен |
| Raw exception / UI diagnostics | Moderate / Low | Low, исправлен: фиксированные сообщения, synthetic-secret regression, нет console/raw PCM logs | Low |
| Непроверенная native media acceptance | Moderate / Moderate | Medium, открыт: physical two-client/SFU/WebView2/Android acceptance не выполнен | Medium, не принят как закрытый |

Новых Critical/High в изменённой поверхности не выявлено. Новых endpoints, привилегий, origins, dependencies, файловых операций/команд от пользовательского ввода нет. Auth/authorization/LiveKit token gates не ослаблялись; 22 существующих security contracts зелёные. Полный Gitleaks/CodeQL и новый Linux CI в этом локальном этапе не запускались; не выдавать локальный тест за release clearance.

Пересмотреть риск при изменении capture/DSP/IPC, новой native сборке, permission/cleanup failure или после аппаратной приёмки. Не добавлять обход разрешений или raw bypass ради зелёного теста.

## Не завершено / следующий обязательный этап

- Реальный голос и шум на физических микрофонах, наушниках и слабом устройстве; речь, качество и нагрузка не выводятся из синтетического RMS/peak.
- Два физических production-клиента: tab audio с включённой передачей звука, отсутствие audio track, autoplay recovery, deafen/output switch, stop/restart/refresh/reconnect/switch room. Fixture/mock/local WebRTC не заменяют SFU acceptance.
- Windows native system-audio capture/узкий IPC/согласие/cleanup/sync и отдельная native сборка по-прежнему отсутствуют. Нельзя утверждать, что весь экран/каждое окно в Windows уже передаёт системный звук.
- Новый exact-SHA CI/security и отдельный production rollout. Migration не нужна. Нельзя повторять старый deploy с SHA `5d505b5`: stale-release guard оставлен.
- Перед публикацией проверить diff/remote ещё раз, включить только свой write-set и не включать прежний dirty status или QA screenshots. Текущий этап не разворачивал production.
