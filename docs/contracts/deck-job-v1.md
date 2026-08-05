# Eclipse Deck Job v1

`deck.job.v1` переносит редактируемую структуру презентации из Eclipse AI Hub в
Eclipse Chat. Это данные для командной проверки, а не PPTX-файл и не разрешение на
публикацию.

## Import contract

- `schemaVersion` должен быть равен `deck.job.v1`, а status — `approved`.
- Принимаются 3–20 слайдов с уникальными ID, заголовком, 1–8 тезисами, speaker notes
  и ссылками на evidence.
- Разрешены только HTTPS-ссылки без credentials; неизвестные поля и управляющие
  символы отклоняются.
- Весь JSON ограничен 128 КБ, source text — 60 000 символами.
- `externalActions`, `toolsAllowed`, `sourceContentTrusted`, `autoPublishAllowed` и
  `pptxRendered` должны быть `false`.

## Independent Chat review

Upstream approval подтверждает только то, что файл можно передать дальше. При импорте
Chat сбрасывает его, записывает `ready_for_review` и создаёт собственный `PENDING` review.
Для утверждения участник с `TASK_APPROVE` заново подтверждает факты и ссылки, права на
материалы и финальную проверку всех слайдов и заметок.

Импорт требует `Idempotency-Key`. Повтор того же source job с тем же содержимым возвращает
существующую запись, а подмена содержимого — `409`. Review использует optimistic `version`,
поэтому параллельное решение не может незаметно перезаписать первое.

## Access and data boundary

- List, import и review требуют JWT и membership; import также требует `TASK_CREATE`,
  review — `TASK_APPROVE`.
- Все запросы ограничены `serverId`, rate limit и очередью до 20 pending imports на
  оператора в workspace.
- Audit хранит только идентификаторы, решение, количество слайдов и версию, но не source
  text, speaker notes или содержимое слайдов.
- Chat не запускает tools, не загружает evidence URL и не публикует презентацию. Editable PPTX

## Endpoints

- `GET /api/servers/:id/deck-reviews`
- `POST /api/servers/:id/deck-reviews/import`
- `PATCH /api/servers/:id/deck-reviews/:reviewId`
- `POST /api/servers/:id/deck-reviews/:reviewId/render` — approved-only editable PPTX
