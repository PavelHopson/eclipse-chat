# Task Manager → Eclipse Chat

Срез исходников: 02.11.2026. Матрица переноса и доказательства выпуска; границы production-проверки указаны ниже. Task Manager: `main` / `5a2a8f8`; Eclipse Chat: изолированный checkout на `be4720b`, кандидат v1.7.86. Локально реализованы личный план, start/pulse/stop, коррекция с optimistic version, отчёт день/неделя, CSV и фокус-сессия. Итоговые проверки координатора приведены ниже.

## Источники и сохранность

- Task Manager main: `E:\projects\task-manager`; stash `2c1ca09` (`codex-refresh-task-manager`). Рабочее дерево чистое.
- Важно: stash не содержит 75 уникальных новых файлов. Его tracked-дерево отличается от текущего main только README и отсутствием файлов, которые тогда были untracked. Все **52 blob** третьего родителя stash полностью совпадают с main. Старая версия README не является новой функциональностью.
- `G:\Кодекс\Архив\task-manager-20261101.bundle`: 639750 байт; `git bundle verify` PASS, полная история, `main` и `refs/stash` присутствуют. Bundle не сохраняет внешнюю PostgreSQL, GitHub Issues, Releases, настройки deploy и личное DPAPI-хранилище.
- Ни репозитории, ни пользовательские данные при этом аудите не удалялись. Секреты и базы не читались.

## Матрица функций

Пути Task Manager ниже относительны к его корню; пути Eclipse Chat — к этому репозиторию. «Покрыто» означает наличие реализации в коде, а не повторный runtime-тест.

| Функция / источник Task Manager | Соответствие Eclipse Chat | Решение и граница |
| --- | --- | --- |
| Создание, редактирование, завершение задач: `backend/src/controllers/taskController.js`, `frontend/src/components/CreateTaskForm.jsx`, `EditTaskModal.jsx` | `apps/server/src/routes/actions.ts`, `apps/web/src/components/ActionItemDrawer.tsx`, Prisma `ActionItem` | Покрыто более богатой моделью. Не переносить второй task API или старые числовые ID. |
| Kanban TODO/IN_PROGRESS/DONE: `frontend/src/components/KanbanBoard.jsx`, `lib/taskStatus.js` | `apps/web/src/components/StatusBoard.tsx`, статусы OPEN/IN_PROGRESS/REVIEW/DONE | Покрыто; сохранить отдельный REVIEW. |
| Сортировка, пагинация по 3 записи: `Pagination.jsx`, `SortControls.jsx` | `StatusBoard.tsx`: поиск, мои/просроченные/без исполнителя, список и доска | Пользовательская цель покрыта. Лимит 3 и сортировку любых полей не копировать механически. |
| Автор, название, состояние задачи и отметка admin-edited: Prisma `Task` | `ActionItem`, комментарии и `ActionItemActivity`; `ActionItemDrawer.tsx` | История действий полезнее отдельного admin-edited флага. Не переносить устаревшую форму username/email на каждую задачу. |
| Личный план на дату и минуты: `planRoutes.js`, `PersonalPlan.jsx`, `PlanEditor.jsx` | Локальные `apps/server/src/routes/personalPlan.ts`, `apps/web/src/components/PersonalPlan.tsx`, `PersonalActionPlan` | Перенесён базовый сценарий. Приватный план не меняет общий срок/исполнителя. Пока не опубликовано. |
| Редактирование даты существующего плана, защита версией: `planRoutes.js:63-84` | Новый план использует уникальный PUT по user/action/day и DELETE; `version` отсутствует | Частичное покрытие: перенос даты = добавить на новый день + удалить старую запись; параллельное редактирование минут last-write-wins. Не называть полной эквивалентностью. Если нужен перенос одним действием — отдельный UX-срез. |
| Список проектов, создание проекта: `projectRoutes.js`, Prisma `Project` | `apps/server/src/routes/servers.ts`, `projectPassport.ts`, `server-hub/ProjectPassportView.tsx` | Сервер/пространство и паспорт проекта уже покрывают цель. Вторую сущность Project не добавлять без необходимости. |
| Команда, владелец, участники, исключение: `projectRoutes.js:110-145`, `ProjectTeam.jsx` | `servers.ts`, Prisma `Member`, `apps/server/src/lib/permissions.ts`, `server/MembersView.tsx` | Покрыто более подробными ролями. Не ослаблять CLIENT/internal-room ограничения. |
| Одноразовые/истекающие приглашения и отзыв: `projectRoutes.js:55-108,147-206` | `apps/server/src/routes/invites.ts`, `server-hub/ServerInvitesManager.tsx` | Покрыто: maxUses, expiresAt, revokedAt и permission checks. Старый invite-контракт не копировать. |
| Отдельная регистрация/сессии и logout: `authController.js`, `authMiddleware.js`, `authSlice.js` | Существующие `apps/server/src/routes/auth.ts`, `apps/web/src/lib/api.ts` и auth/session flow | Не переносить вторую авторизацию или старые JWT/session schemas. Cross-tab logout данным аудитом отдельно не проверен. |
| Личный таймер start/pause/current: `timeRoutes.js:13-51`, `useTimeTracker.js` | `personalTime.ts`, `PersonalTime.tsx`: start/pulse/stop и восстановление активного интервала | Реализовано и проверено локально; один активный интервал на пользователя, только явный запуск. |
| Heartbeat, остановка при потере доступа/связи, лимит 24 ч: `backend/src/lib/time.js`, `timeRoutes.js` | Серверные timestamps, User row lock, partial unique index и requestId | Реализовано: остановка на подтверждённом heartbeat, признак interrupted и возможность ручной коррекции. |
| Ручная коррекция интервала, version/overlap checks: `timeRoutes.js:53-71`, `TimeEntryEditor.jsx` | PATCH personal-time/:id и встроенная форма редактирования | Реализовано и проверено локально: собственный завершённый доступный интервал, версия, запрет пересечений/будущего; 409 обновляет журнал. |
| Журнал за день/неделю, группы по проекту, CSV: `TimeJournal.jsx`, `lib/timeReport.js` | personal-time-report в выбранном рабочем пространстве, local day/week, безопасный CSV | Реализовано по текущему пространству. Точная сумма clipped интервалов, лимит 1000 с явным 413, свежий export с защитой от формул. Общий межпроектный отчёт заменён переключением рабочих пространств, а не копией старой сущности Project. |
| Локальная активность Windows, tray, idle/lock/sleep: `desktop/windows/Native.cs`, `Core.cs`, `MainForm.cs` | Chat имеет Tauri-оболочку `apps/desktop`, но не сбор активности приложений | Уникально, **отложить**, не включать в обычный таймер. Наблюдение за окнами — отдельная функция с приватностью и физическим Windows QA. |
| Шифрованный журнал DPAPI/ACL, восстановление, CSV: `desktop/windows/Storage.cs`, `desktop/README.md` | Аналога личного activity-store не найдено | Сохранить идею/исходник в bundle. Не мигрировать личный журнал автоматически и не загружать его на сервер. |
| Активная вкладка Chromium и исключения: `desktop/browser/capture.js`, `worker.js`, `manifest.json` | Аналога расширения в Chat не найдено | **Отложить**: разрешения tabs/nativeMessaging, URL и названия — чувствительные данные. Никакого автоматического подключения рабочих профилей. |
| Native messaging / named pipe bridge: `desktop/windows/BrowserBridge.cs`, `prepare-browser.ps1` | Tauri invoke/capabilities решают другую задачу: `apps/desktop/src-tauri/src/lib.rs` | Не копировать транспорт в webview. Возможный отдельный opt-in пилот с ограничением origin, текущего SID, размеров и времени сообщений. |
| Local current-task note без ID общей задачи: `desktop/README.md` | ActionItem ID уже есть в Chat, но мост отсутствует | Будущая идея: явная привязка к задаче. Сейчас автосвязь/загрузка активности не реализованы ни переносом, ни исходным desktop-пилотом. |
| Docker/Prisma/Express/Redux инфраструктура | Fastify/Prisma/React/Tauri существующего Chat | Не переносить runtime, lock-файлы, зависимости и deployment Task Manager. Переносить поведение и регрессионные сценарии. |

## Перед закрытием Task Manager

1. Довести план и таймер до подтверждённого сценария в Chat; ручную коррекцию, отчёт день/неделя и CSV завершить либо явно исключить из согласованного переноса до удаления. Критерий консолидации — согласованный функционал, а не буквальное копирование всей инфраструктуры. Desktop-наблюдение сохранено как отложенная opt-in идея и не блокирует остальные работы; реализованным оно не считается.
2. Проверить приватность между пользователями, revoked membership, внутренние клиентские комнаты, повторные запросы, конкурирующие таймеры, offline/retry и журнал/CSV.
3. Опубликовать и проверить целевую версию Chat в пределах разрешений пользователя; локальный PASS не равен production.
4. Повторно сверить чистоту Task Manager и bundle непосредственно перед удалением. Проверить наличие нужных GitHub Issues/Releases и активного Railway deployment без чтения секретов: Git bundle их не архивирует, GitHub deletion не выключает hosting.
5. Только после этого выполнить уже выбранное удаление локальной копии и GitHub-репозитория. Личное `%LOCALAPPDATA%/EclipseForge/TaskManagerActivity` и внешнюю базу этим решением автоматически не удалять.

## Доказательства аудита

- `git status --short --branch`: Task Manager `main...origin/main`, без dirty файлов.
- `git bundle verify`: PASS, complete history, `main=5a2a8f8`, `refs/stash=2c1ca09`.
- Сравнение `git diff HEAD refs/stash` и blob-хешей `refs/stash^3` с HEAD: 52/52 совпали; уникальная разница — старое README.
- Точечное чтение перечисленных routes/components/schema/desktop source и поиск аналогов в `apps/server`, `apps/web`, `apps/desktop`. Runtime desktop/browser и production в этом аудите не запускались.
- Финальный read-only review таймера: ownership, redaction, пользовательская блокировка, partial unique index и idempotency проверены по коду. Найденный Medium (старый выбор задачи после смены workspace) исправлен: `key={serverId}` у PersonalPlan/PersonalTime и проверка выбранной открытой задачи перед start. Исправление перепроверено чтением кода, не независимым browser-тестом. Других High/Medium в просмотренном срезе не найдено; это не аудит всего Chat.

## Итог проверки и следующий этап

- Координатор: итоговые новые unit/PG/helper регрессии — **41/41 PASS**. Полный server Vitest — **521 PASS, 6 skipped** (89 test files); пропущенные сценарии не объявляются проверенными.
- Координатор независимо выполнил `node --test` для task-flow/workspace-navigation — **18/18 PASS**, web production build — **PASS**.
- Focus интегрирован в личный план. Координатор перенёс тест арифметики таймера в `apps/server/tests/actionFocusTimer.test.ts`, чтобы его запускал существующий Vitest/CI: вместе с personalPlan unit **25/25 PASS**. Server typecheck повторно прошёл. PostgreSQL-сценарии остаются отдельной opt-in проверкой, их обычный CI без тестовой БД не выполняет.
- Координатор: Edge/Playwright, 1440 и 390 px — план → фокус → pause/resume/reset/Escape с возвратом фокуса → start/stop времени → журнал → смена пространства PASS; горизонтального переполнения и JS-ошибок нет. API в браузере подменён; реальные маршруты/БД проверены отдельно PostgreSQL-тестами. Исправлена потеря клавиатурного фокуса при удалении кнопки сброса таймера. Это не проверка полного приложения с настоящей авторизацией и не production smoke.
- Production опубликован 02.11.2026; исходные репозитории пока не удалены. Временные PostgreSQL и browser harness удалены после локальной проверки.
- Коррекция, отчёты и CSV завершены локально. Edge/Playwright 1440/390: день/неделя, редактирование, 409 и reload, возврат фокуса при отмене, содержимое скачанного CSV, запрет выгрузки при 413, подавление устаревшей выгрузки при смене пространства — PASS с подменённым API. Исправлено сжатие текстовых кнопок глобальными мобильными стилями; скриншот проверен визуально.
- `npm run build` — server+web PASS; security profile tests **22/22**, task/navigation/release contracts **25/25**. `npm audit --audit-level=high` проходит, но остаются **3 moderate** предупреждения glob/minimatch/@fastify/static. Новые зависимости не добавлялись; предлагаемый npm принудительный downgrade не применялся.
- Повторная проверка источника: чистый main, валидный bundle. GitHub Issues/Releases — 0; прежний Railway URL отвечает 404 fallback (это не подтверждение удаления облачной БД/сервиса).
- Дополнительные UI/dependency/desktop контракты: 114/115 PASS; единственный сбой — устаревшее ожидание двух режимов StatusBoard. Контракт обновлён для list/board/plan с сохранением default list, проверкой aria-pressed и workspace-key PersonalPlan; повторный набор conversation-flow — 8/8 PASS. Это проверка контрактов исходников, не desktop runtime.
- Следующий этап: выполнить разрешённые пользователем публикацию v1.7.86 в origin/master и штатный deploy; затем CI и production smoke → финальная проверка архива и удаление Task Manager. Отложенный desktop-мониторинг остаётся отдельной opt-in идеей. Внешние базы/личные activity journals этим решением не удаляются.

## Публикация 02.11.2026

- Пользователь явно разрешил commit/push master и штатный deploy с миграциями.
- Код: `3832e5227f35265978ebde4598119527f445e986`, `PavelHopson/eclipse-chat`, `master`, версия **1.7.86**.
- GitHub CI `41483227804`, Security Gate `41483227805`, Deploy PROD `41483227979` — **success**. Устаревший ожидающий deploy `41045174248` отменён для освобождения очереди; текущий production gate одобрен после успешных проверок.
- Журнал deploy подтверждает применение всех трёх миграций personal_action_plan, personal_action_time, personal_time_revision и `All migrations have been successfully applied`.
- Публичный smoke: `/api/version` HTTP200 и точная версия 1.7.86; `/api/health` HTTP200, ok=true/database=true; страница HTTP200; `/sw.js` содержит eclipse-v1.7.86. Новые personal-time/report API без авторизации возвращают401.
- Полный production-сценарий с авторизацией **ещё не проверен**. CUA не запустился из-за ошибки sandbox path; Playwright connector не обнаружил Chrome. Чужие cookie/секреты не извлекались, пользовательские данные не читались.
- Перед удалением Task Manager: проверить под профилем отдельную тестовую задачу → Мой план → старт/стоп таймера → перезагрузка → коррекция → день/неделя → CSV. После успешного сценария заново проверить сохранность bundle и удалить только разрешённые локальный/GitHub Task Manager; внешний runtime/БД и личные журналы не удалять.

## Авторизованный production QA и исправления 02.11.2026

- Пользователь вошёл в отдельное управляемое окно Edge. Существующие секреты/cookie не извлекались и не копировались. В Eclipse Forge создана тестовая QA-комната и синтетическая задача; рабочие задачи не менялись.
- Проверено реальным UI/API: личный план 25 минут; start/stop 37 секунд; исправление начала интервала и итог 28 секунд; недельный CSV с тестовой записью; сохранность плана/коррекции после reload. Фокус start/pause/Escape с возвратом фокуса PASS.
- На 390px обнаружен внутренний overflow select406px при контейнере362px, скрытый оболочкой. Исправление width:100%/min-width:0 проверено на той же странице: scrollWidth==clientWidth. Прямой вход в общую доску возвращён в sidebar вместо старого disabled callback.
- Кандидат1.7.87: web typecheck PASS, conversation/navigation19/19 PASS; CSS production build PASS. После deploy требуется повторить mobile/навигацию без временной инъекции CSS, затем убрать тестовые данные и удалить сохранённый Task Manager.

## Итог production QA 1.7.87

- Commit `972ee3934db53d08a6f1f4cc6085d5260a2ca7f0`: CI41493380256, Security41493380388, Deploy41493380290 — success. API фактически возвращает1.7.87.
- После настоящей перезагрузки (без injected CSS): ЗАДАЧИ → Доска задач → Мой план работает; на390px панель и select352px, scrollWidth352px, min-width0px. Сохранённый отчёт28секунд читается.
- Пустая QA-комната удалена, запись личного плана убрана. С отдельного подтверждения пользователя синтетическая задача переведена в «Выполнено». Историческая запись28секунд остаётся в личном журнале; полное удаление журнала не выполнялось.
- E:\projects\task-manager удалён после повторной проверки чистого дерева, совпадения main с GitHub и архива. Bundle639750байт сохранён, SHA256 7E1192251D3679CC9CF7AC86235338E485592BFC27E0BD320F9ABBB113EA4335.
- GitHub delete первоначально вернул403 из-за отсутствия delete_repo. Пользователь подтвердил стандартный OAuth-запрос расширения права; завершение операции будет отмечено после ответа GitHub.

## Следующие переносы без дублирования

Локальные каталоги ниже существуют на02.11.2026. Это очередь после Task Manager, а не заявление о готовой миграции или разрешение удалять другие репозитории.

| Источник | Сильный продукт | Что переносить / чего не дублировать | Условие следующего шага |
| --- | --- | --- | --- |
| Educator-AI | Eclipse Library | Курсы, прохождение и прогресс; карточка каталога сама по себе не заменяет обучение | Сверить реальный UI/данные источника и интегрировать один законченный учебный сценарий |
| Text2Image, shotforge | Eclipse Media | Генерация/история/медиаэкспорт через существующие контракты | Сначала проверить уже работающие связи; не добавлять второй генератор в Chat |
| Eclipse-webclaw | Нуждающийся продукт через отдельный коннектор | Только подтверждённые операции извлечения; учитывать лицензию до переноса исходников | Read-only аудит текущего контракта и лицензии; не встраивать чужой runtime автоматически |
| retry-http | Общие сетевые операции только при доказанном пробеле | Сопоставить retries/idempotency с текущим API-клиентом | Если эквивалент уже есть, не переносить пакет ради числа функций |
| VALHALLA | Eclipse Chat | Фокус уже реализован; привычки/прогресс/Oracle не переносились | Отдельно выбрать полезный командный сценарий; здоровье и личный мониторинг не включать автоматически |

Desktop/browser activity tracking Task Manager остаётся архивной opt-in идеей: без автостарта, чтения посещённых сайтов или включения сбора активности в Chat. Bundle — источник для возможного отдельного возвращения к ней.

## Закрытие Task Manager

- После подтверждения пользователем OAuth delete_repo команда `gh repo delete PavelHopson/task-manager --yes` завершилась успешно. Последующая проверка GitHub API репозитория вернула404.
- Локальная папка E:\projects\task-manager отсутствует. Проверенный bundle истории и stash сохранён отдельно; внешняя БД/hosting/activity-store не удалялись.
- Консолидация указанного объёма завершена: личный план, учёт времени, ручная коррекция, день/неделя и CSV доступны в production1.7.87; фокус VALHALLA встроен. Проверки доступа/конкуренции/CSV-инъекций остаются отдельными локальными тестами; реальные desktop/browser-мониторинг и многопользовательский production-тест не заявлены.
