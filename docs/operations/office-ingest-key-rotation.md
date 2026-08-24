# Office ingest key rotation

Этот runbook описывает ротацию HMAC-ключей между Sentinel и Eclipse Chat без остановки ingest.

## Контракт

`OFFICE_INGEST_KEYS_JSON` — объект, где ключ верхнего уровня является `keyId`. Каждый ключ содержит:

- `producerId` — стабильный идентификатор producer;
- `secret` — base64url без padding, 32–128 случайных байт;
- `workspaceIds` — точный allowlist серверов;
- `notBefore` — необязательный ISO 8601 момент включения;
- `notAfter` — необязательный ISO 8601 момент отключения, граница исключительная.

Неактивный, неизвестный и неверно подписанный ключ всегда дают одинаковый внешний ответ authentication failed. Статус и расписание ключа клиенту не раскрываются. Freshness подписи ограничена пятью минутами, но compact replay receipt хранится 30 дней: это разные границы. Transport при любом retry, включая смену keyId, обязан повторно использовать исходный producerId + nonce + body.

## Rollout схемы producer/nonce

Миграция 20260823160000_harden_office_growth_concurrency переводит replay identity с
keyId + nonce на стабильные producerId + nonce. Перед применением она аварийно
останавливается, если в существующей таблице уже есть дубликаты новой пары.

Порядок безопасного rolling rollout:

1. Заморозить плановую ротацию HMAC и удаление nonce receipts до завершения этого
   rollout. Миграция не может восстановить receipt, уже удалённую старым процессом.
2. Выполнить preflight-запрос GROUP BY producerId, nonce HAVING COUNT(*) > 1.
3. Применить миграцию: она продлевает все существующие receipts минимум до
   CURRENT_TIMESTAMP + 30 days, добавляет новый unique index и сохраняет прежний
   keyId + nonce index на окно совместимости.
4. Проверить, что pre-migration receipt получила новый 30-дневный horizon, затем
   развернуть все Eclipse Chat replicas с новым кодом и Prisma Client.
5. Проверить exact replay одним nonce через старый и новый HMAC key: journal получает
   одну запись и возвращает одну receipt.
6. Снять freeze ротации только после подтверждения всех replicas и cleanup worker с
   новым 30-дневным retention. До этого не истекать старый ключ.
7. Только в отдельном последующем релизе, когда старых бинарей не осталось, удалить
   legacy index. Не совмещать его удаление с rolling deploy новой replay semantics.
## Zero-downtime порядок

1. Создать новый случайный секрет локально и сразу сохранить его в production secret manager. Не помещать значение в Git, тикеты, чат, shell history или логи.
2. Добавить новый `keyId` в registry с `notBefore`, оставив старый ключ активным до `notAfter`. Окно перекрытия должно быть длиннее максимального clock skew, retry window и времени rolling deployment.
3. Выполнить rolling deployment Eclipse Chat со старым и новым ключом.
4. После наступления `notBefore` обновить Sentinel через его защищённое хранилище Credential Manager/DPAPI и переключить `keyId`.
5. Проверить успешный signed ingest и отсутствие роста `401`, replay conflicts и dead letters.
6. После подтверждения всех producer instances дождаться `notAfter`. Старый ключ станет невалидным автоматически.
7. После grace-периода удалить старую запись из secret manager и registry. Сам секрет уничтожить согласно политике хранилища.

Пример структуры без реальных секретов:

```json
{
  "sentinel-2026-08": {
    "producerId": "eclipse-hopson-sentinel",
    "secret": "OLD_BASE64URL_SECRET_FROM_SECRET_MANAGER",
    "workspaceIds": ["server-id"],
    "notAfter": "2026-09-01T12:00:00.000Z"
  },
  "sentinel-2026-09": {
    "producerId": "eclipse-hopson-sentinel",
    "secret": "NEW_BASE64URL_SECRET_FROM_SECRET_MANAGER",
    "workspaceIds": ["server-id"],
    "notBefore": "2026-09-01T11:30:00.000Z"
  }
}
```

## Rollback

Пока старый ключ не достиг `notAfter`, Sentinel можно вернуть на старый `keyId` без изменения сервера. После `notAfter` rollback выполняется новым key id и новым secret; продлевать скомпрометированный ключ запрещено.

При подозрении на компрометацию overlap не используется: старый ключ немедленно удаляется или получает `notAfter` в прошлом, затем выполняется аварийное обновление producer.

## Локальная persistence QA

Команда `office:qa:persistence` предназначена только для временной loopback-базы с именем `eclipse_chat_office_qa_*`. Она требует `OFFICE_QA_ACK=isolated-database` и откажется работать с remote или production database.

Фазы запускаются отдельными процессами:

```text
write -> replay -> conflict -> budget -> redrive
```

Ожидаемый результат: одна journal-запись, один nonce receipt, cursor 1; exact replay не создаёт второе событие, другой digest с тем же nonce возвращает replay_conflict. Фаза budget параллельно повторяет один логический Growth execution и доказывает одну budget charge при множестве retry. Фаза redrive доказывает атомарный сброс dead-letter и одну append-only forensic receipt.
