# Eclipse AI Office + Jarvis

Статус: первый production-shaped vertical slice начат 23 августа 2026 года.

## Целевая система

```text
Eclipse Chat / Jarvis
        |
        v
Office Core: departments · employees · tasks · runs · budgets · approvals · deliverables
        |
        v
Provider Router: OpenAI · Anthropic · Google · Ollama · OpenAI-compatible
        |
        v
Tool Gateway: projects · documents · browser · OfficeCLI · GitHub · LocalSend
        |
        v
Office Event Bus -> 2D operational view -> optional 3D office -> Sentinel Presence
```

Office Core и Sentinel являются control plane. Визуальные клиенты — только проекции. Ни 2D, ни 3D, ни аватар не могут создавать полномочия, расширять план, получать ключи или исполнять системные действия напрямую.

## Границы продуктов

| Компонент | Владеет | Не владеет |
| --- | --- | --- |
| Eclipse Chat | компания, отделы, задачи, approvals, бюджеты, операторский UI | системные ключи Sentinel, произвольный shell |
| Sentinel Core | typed PC operations, preview, approval TTL, replay protection, receipts | 2D/3D как источник истины |
| Provider Router | выбор модели сотрудника, fallback, лимиты стоимости, capability intersection | UI-состояние и секреты провайдеров в браузере |
| Tool Gateway | version-pinned tools, sandbox, scopes, audit | доверие к описаниям MCP или внешнему контенту |
| Presence | voice, avatar, listening/thinking/speaking state | файлы, API-ключи, системные инструменты |
| 2D/3D Office | доступная визуализация событий и очередей | запуск действий в обход Office Core |

## Office Core v1

Минимальные сущности:

- `Department`: назначение, владелец бюджета, политики;
- `Employee`: роль, provider route, capabilities, sandbox profile;
- `Task`: цель, входы, статус, ответственный, ограничения;
- `Run`: конкретное выполнение задачи и выбранная модель;
- `Approval`: одно внешнее или опасное действие, preview, TTL, решение;
- `Budget`: лимит сотрудника, отдела и workspace;
- `Deliverable`: артефакт, provenance, review status;
- `OfficeEvent`: версия, tenant, sequence, subject, безопасная сводка.

Состояния операционного UI:

`idle -> working -> waiting | blocked | approval | error -> completed`

Это UI-проекция, а не отдельная машина состояний. Канонический lifecycle каждого workload остаётся в его серверном контракте.

## Event Bus v1

Первый контракт — `office.event.v1`:

```json
{
  "schemaVersion": "office.event.v1",
  "id": "server-generated UUID",
  "workspaceId": "tenant id",
  "sequence": 42,
  "occurredAt": "2026-08-23T12:00:00.000Z",
  "type": "approval.requested",
  "subject": { "kind": "approval", "id": "run id" },
  "summary": "Материал готов к ручной проверке",
  "metadata": { "departmentId": "growth", "completed": 5, "total": 5 }
}
```

Правила:

- `id`, `sequence` и время назначает сервер;
- поток изолирован по `workspaceId`;
- summary и metadata жёстко ограничены по размеру и схеме;
- ключи, похожие на token, secret, password, cookie, credential или private key, отклоняются;
- события не содержат chain-of-thought, системные prompts или полные tool payloads;
- клиент использует cursor и обрабатывает повтор безопасно;
- канонический cursor-журнал и внешний ingest хранятся в PostgreSQL; прежний in-memory ring оставлен только как изолированный тестовый/reference-модуль.

Growth mutations и их Office-проекции фиксируются в одной PostgreSQL-транзакции через transactional outbox. Dispatcher повторяет временные ошибки с bounded backoff, использует durable idempotency tuple и переводит необрабатываемые записи в dead-letter без сохранения текста исключений. Каждый подтверждённый redrive создаёт отдельную append-only forensic receipt в той же транзакции, что и сброс dead-letter: сохраняются tenant, outbox id, actor id, причина, прежний error code, число попыток и номер redrive. Конкурирующий оператор без успешного compare-and-set receipt не создаёт. Защищённый status endpoint показывает только cursor, pending/dead-letter состояние и не раскрывает DSN, ключи или конфигурацию. Общий error boundary не возвращает клиенту stack, внутренние сообщения или тексты исключений.

## Provider Router v1

Каждый сотрудник имеет primary provider/model, необязательный fallback, spending cap и две capability-множества:

```text
effective capabilities = requested by employee ∩ granted by Office host ∩ supported by adapter
```

Маршрутизация fail-closed:

1. проверить exact schema;
2. остановить запрос до провайдера при исчерпанном бюджете;
3. проверить enabled adapter и точный model id;
4. запретить запуск, если хотя бы одна requested capability не выдана;
5. выбрать fallback только из заранее сохранённого маршрута;
6. записать provider/model/cost в receipt без секретов.

LLM не может выбрать себе больше прав или переписать route через prompt.

## Tool Gateway

Все инструменты делятся на классы:

- read-only: поиск, чтение проекта, безопасный preview;
- draft-only: создать черновик документа/сообщения без отправки;
- mutable: запись файла, отправка сообщения, публикация, управление ПК;
- privileged: секреты, платежи, настройки доступа — запрещены по умолчанию.

Mutable/privileged путь:

`plan -> bounded preview -> explicit approval -> one-shot execution -> receipt -> event`

MCP descriptions и retrieved content считаются недоверенными данными. Tool identity закрепляется серверным id и metadata hash. URL tools должны блокировать loopback, private ranges, metadata services, `file:` и redirect-to-private.

## Presence и Airi-inspired слой

Sentinel Presence запускается отдельным непривилегированным процессом:

- authenticated localhost WebSocket, named pipe или другой local IPC;
- session secret только в памяти и короткий срок жизни;
- monotonic sequence и replay rejection;
- renderer с `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`;
- строгий CSP и узкий preload API;
- только состояния `listening`, `thinking`, `speaking`, `acting`, `waiting_approval`;
- mute, stop speech и privacy доступны всегда;
- отсутствие API-ключей, прямого файлового доступа и системных tools.

Airi используется как архитектурный reference, не как встраиваемый монорепозиторий. До повторного использования любого пакета нужны pinned SHA, SBOM, install-script review и отдельный manifest лицензий для VRM/Live2D/голосовых ассетов.

## Реализация по срезам

### Slice 1 — Office nervous system

- [x] `office.event.v1`, tenant-isolated PostgreSQL journal и bounded read projection;
- [x] server-owned Growth lifecycle events;
- [x] JWT + membership protected cursor endpoint;
- [x] Provider Router foundation с бюджетом, fallback и capability intersection;
- [x] read-only живой журнал в существующей 2D-проекции;
- [x] unit tests на tenant isolation, secret rejection, retention, budgets и permissions.

### Slice 2 — Sentinel bridge

- [x] Sentinel-side transport-neutral Bridge с отдельным непривилегированным projection envelope;
- [x] canonical mapping в `OfficeEventInput`: `sequence`, `id` и `occurredAt` назначает только Office Core;
- [x] atomic `publishBatch`, workspace binding и one-shot approval/receipt boundary без сырых command, speech, receipt lines и секретов;
- [x] authenticated HMAC-SHA-256 atomic ingest endpoint в Office Core с server-owned `id`, `sequence` и `occurredAt`;
- [x] durable nonce receipt, exact same-request 2xx replay, conflict rejection и concurrent retry tests;
- [x] PostgreSQL 14 fresh migration QA: 87 migrations, cross-process write/exact replay/conflict/budget и invariant events=1, nonce=1, cursor=1, charge=1;
- [x] zero-downtime HMAC activation windows (`notBefore`/`notAfter`) и rotation runbook;
- [ ] production secret-manager и Windows Credential Manager provisioned для `sentinel-prod-20260824-01`; live signed delivery и последующая rotation ceremony ещё требуют runtime-проверки;
- [x] transactional Growth outbox: mutation и Office projection создаются атомарно, а доставка выполняется идемпотентным dispatcher после commit;
- [x] membership-protected health/status без раскрытия конфигурации и безопасный общий 5xx error boundary.

### Slice 3 — Company Builder

- [ ] отделы Development, QA, Design, Research, Growth, Support;
- [ ] роли и шаблоны сотрудников;
- [ ] provider/model и budget per employee;
- [ ] task assignment и deliverables;
- [ ] quiet 2D operations screen как основной режим.

### Slice 4 — Tools

- [ ] OfficeCLI в отдельном ограниченном worker;
- [x] LocalSend session scoped transfer с явным получателем и native picker, который
      не раскрывает абсолютный путь webview;
- [ ] GitHub/browser/document adapters;
- [ ] MCP metadata pinning и approval after definition change;
- [ ] audit receipts и retention policy.

### Slice 4a — Creative Studio

- [x] `creative.job.v1` для image/video задания, exact quote и human approval;
- [x] бесплатный `eclipse-preview` adapter с downloadable JSON и bounded receipt;
- [x] tenant/RBAC, idempotency, optimistic version, pending/rate/body limits и audit;
- [x] lifecycle через transactional Office outbox в общую 2D projection;
- [x] ручная передача готового файла через LocalSend без доступа Jarvis к пути;
- [ ] production Higgsfield OAuth, pinned tool metadata, exact quote и one-shot adapter.

### Slice 5 — Presence и optional 3D

- [ ] VAD -> STT -> Sentinel -> streaming TTS;
- [ ] VRM states, blink, look-at, basic lip sync;
- [ ] immediate stop/mute/privacy;
- [ ] 3D floor, follow-agent и meeting rooms как дополнительная projection;
- [ ] полноценный 2D fallback для мобильных и слабых устройств.

## Источники продуктовых решений

- 3DOffice подтверждает спрос, но не задаёт нашу архитектуру;
- `Gaurav2693/ai-office` — только visual reference;
- The Delegation — reference для team builder, cost visibility, approvals и inspector; не копировать CC BY-NC 3D assets и browser key storage;
- Hermes Office — основной reference принципа runtime-as-source-of-truth;
- OfficeCLI — изолированный document worker;
- Airi — voice/presence/plugin-permission reference после supply-chain и license review.

## Definition of done для каждого следующего slice

- основной путь понятен без инструкции;
- loading, empty, error, success, disabled, focus и reduced-motion состояния;
- desktop и mobile без horizontal overflow;
- tenant authorization проверяется на сервере;
- действия идемпотентны или одноразовы;
- secrets scan, dependency audit и focused security tests;
- Critical/High риск не считается закрытым без runtime verification.
