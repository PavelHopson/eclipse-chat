# Kimi / Moonshot provider — 2026-10-30

## Что проверено

- Официальная Kimi API Platform предоставляет OpenAI-compatible Chat Completions, Responses и Anthropic Messages API.
- Global endpoint для OpenAI-compatible вызова: `https://api.moonshot.ai/v1`.
- В официальном quickstart указаны модели `kimi-k3.1-pro` и `kimi-k3.1-pro-highspeed`; поддерживаются streaming, vision, tool calls и reasoning.
- API key должен храниться в переменной окружения/secret manager, а не в браузере или репозитории.

Источники: [Kimi API quickstart](https://platform.kimi.ai/docs/get-your-api-key), [Kimi API documentation index](https://platform.kimi.ai/docs).

## Реализация Eclipse Chat

- Добавлен серверный провайдер `moonshot` поверх существующего OpenAI-compatible транспорта.
- Провайдер включается только при одновременных `MOONSHOT_ENABLED=1` и `MOONSHOT_API_KEY`.
- Base URL не задаётся пользователем через env: используется фиксированный официальный global endpoint, чтобы не расширять SSRF-поверхность.
- Цена помечена как `unknown`, поэтому маршрутизация не считает Kimi бесплатным.
- Ключ и тело запроса не попадают в diagnostics.
- Image/vision payload пока не добавляется: текущий `ChatMessage` контракт Eclipse Chat текстовый. Это отдельный совместимый срез, а не заявление о готовом мультимодальном runtime.

## Не включено

- API key, production traffic, canary и автоматическая активация.
- Прямой live-call к Kimi из CI/локальной проверки.
- Покупка токенов и настройка billing/rate limits.
