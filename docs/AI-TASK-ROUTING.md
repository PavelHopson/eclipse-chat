# Task-based AI routing

Начиная с `v1.7.32`, Eclipse Chat выбирает AI provider по назначению операции,
а не заставляет пользователя вручную выбирать модель.

## Что учитывает router

- тип задачи: диалог, сводка, structured extraction, agent tools или код;
- цель: баланс, скорость, экономия или качество;
- sensitivity данных: обычные или внутренние workspace data;
- пригодность provider для конкретного типа задачи;
- runtime health: повторные ошибки и средняя задержка процесса.

## Privacy policy

Все сценарии, которые используют сообщения, транскрипты, задачи, память комнаты
или bot prompt, помечаются как `sensitive`. Для них по умолчанию разрешены только:

- `ollama` — локальный inference;
- `eclipse-ai-hub` — управляемый gateway Eclipse;
- `omniroute` — self-hosted управляемый gateway.

Если подходящего маршрута нет, операция завершается безопасной ошибкой. Eclipse Chat
не отправляет внутренний контент в keyless/public fallback автоматически.

Оператор может явно разрешить дополнительные authenticated provider для sensitive traffic:

```bash
AI_SENSITIVE_PROVIDER_ALLOWLIST=yandexgpt,openai
```

Это осознанное исключение. Public/keyless provider остаётся заблокированным, даже если
его имя добавлено в allowlist. После изменения env нужен restart server. Не добавляйте
provider в allowlist, пока не проверены его retention, training и data residency policy.

## Health-aware fallback

Router хранит только process-local operational metadata:

- количество последовательных ошибок;
- сглаженную среднюю задержку;
- cooldown после двух последовательных сбоев.

Prompts, responses, API keys, user IDs и message IDs в health state не записываются.
После успешного ответа failure counter сбрасывается. После restart health начинается
с `unknown`, поэтому этот слой не является долговременным мониторингом.

## Eclipse AI Hub headers

Для управляемого AI Hub передаются только bounded routing labels:

- `X-Eclipse-AI-Task`;
- `X-Eclipse-AI-Objective`;
- `X-Eclipse-Data-Sensitivity`;
- случайный `X-Request-Id`.

Пользовательский контент и идентификаторы в routing headers не попадают.

## Диагностика

`GET /api/platform/ai/providers` доступен только platform owner и возвращает:

- sanitised provider list;
- data policy, cost tier и process-local health;
- основной и резервные маршруты для ключевых типов задач;
- gateway telemetry без prompts и пользовательских данных.

В UI это находится в `Platform Admin -> AI`. Экран показывает готовый маршрут
и причину выбора; ручного model selector в продуктовом сценарии нет.

## Backward compatibility

Вызовы `chat()` без `route` сохраняют прежний provider chain. Это нужно для smoke test
и старых служебных сценариев. Новые продуктовые вызовы обязаны задавать route явно.
