# Creative Studio — `creative.job.v1`

`creative.job.v1` — server-owned контракт задания на изображение или видео в
AI-офисе Eclipse Chat. Он не является командой внешнему генератору: сначала
фиксируются задание и стоимость, затем отдельный участник подтверждает запуск.

## Состояния

```text
Higgsfield: awaiting_quote -> awaiting_approval -> approved -> ready
Preview:                    awaiting_approval -> approved -> ready
                                      \-> rejected
```

- `awaiting_quote`: у провайдера ещё не получена точная стоимость; approval и
  выполнение запрещены;
- `awaiting_approval`: стоимость известна, человек проверяет задание, права на
  материалы и цену;
- `approved`: одно выполнение разрешено, но ещё не начато;
- `ready`: есть bounded receipt и downloadable deliverable;
- `rejected`: нужна новая версия задания;
- `failed`: терминальная ошибка адаптера без автоматического повтора.

## Первый рабочий адаптер

`eclipse-preview` создаёт `creative.brief-package.v1` без обращения к внешней
модели и с точной стоимостью `0` кредитов. Пакет содержит только проверенное
задание, quote, human approval и execution receipt. Его можно скачать и вручную
передать через Jarvis · Передача рядом.

Автоматическая подстановка пути в LocalSend намеренно запрещена: native picker
оставляет абсолютный путь вне webview, а человек ещё раз выбирает файл и
получателя.

## Higgsfield boundary

Higgsfield-задачу можно сохранить, но текущий server adapter fail-closed:

- OAuth-сессия и секреты не хранятся в браузере;
- описание MCP-tools должно быть закреплено и проверено до выдачи прав;
- стоимость и баланс запрашиваются до approval;
- MCP-вызов не выполняется без точной quote и одноразового решения;
- Unlimited/free режим веб-сайта не считается бесплатным для MCP;
- receipt не хранит signed download URL, cookies, prompts системы или secrets.

Официальная точка подключения: `https://mcp.higgsfield.ai/mcp`.

## API

- `GET /api/servers/:id/creative-jobs` — очередь и policy;
- `POST /api/servers/:id/creative-jobs` — создать idempotent job;
- `PATCH /api/servers/:id/creative-jobs/:jobId/review` — human decision с
  optimistic version;
- `POST /api/servers/:id/creative-jobs/:jobId/execute` — one-shot execution;
- `GET /api/servers/:id/creative-jobs/:jobId/artifact` — tenant-scoped download
  только готового пакета.

Все mutations имеют rate limit, tenant membership, role permission,
server-active gate и audit event. Lifecycle одновременно записывается в
transactional Office outbox; 2D/3D-клиенты остаются read-only projections.
